<#
Orquesta la validación remota pendiente (plan/01-backend.md ⛔, plan/02-sunat-integration.md) con cuentas autorizadas.
Usa run-sunat-probe.ps1 (credenciales DPAPI, salida redactada). No fija ninguna puerta SUNAT_*: eso lo decide el operador
con el resultado en la mano. Cada etapa termina con su código de salida y se registra un resumen en
%LOCALAPPDATA%\BuzonSol\validate-integration-<fecha>.log (sin secretos).

Uso:
  .\scripts\validate-integration.ps1 -Names A,B                 # etapas 1-3 (solo lectura segura + archivo de leídos)
  .\scripts\validate-integration.ps1 -Names A,B -IncludeUnread  # + S-14 (abre UN no leído: irreversible; pide confirmación)
  .\scripts\validate-integration.ps1 -Names A,B -Stage 2        # una etapa concreta
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string[]]$Names,
    [ValidateSet(0,1,2,3,4)][int]$Stage = 0,   # 0 = todas las etapas seguras
    [switch]$IncludeUnread,
    [ValidateRange(1,50)][int]$Items = 5,
    [switch]$Files
)

$ErrorActionPreference = 'Stop'
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$root = Split-Path -Parent $PSScriptRoot
$probe = Join-Path $PSScriptRoot 'run-sunat-probe.ps1'
$logDir = Join-Path $env:LOCALAPPDATA 'BuzonSol'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir ("validate-integration-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$results = [System.Collections.Generic.List[object]]::new()

function Write-Log([string]$text) { Write-Host $text; Add-Content -LiteralPath $log -Value $text }

function Invoke-Probe([string]$mode, [string[]]$accounts, [hashtable]$extra = @{}) {
    Write-Log ("`n=== {0} [{1}] ===" -f $mode, ($accounts -join ','))
    $probeArgs = @('-File', $probe, '-Mode', $mode)
    if ($accounts.Count -gt 0) { $probeArgs += @('-Names', ($accounts -join ',')) }
    foreach ($k in $extra.Keys) { $probeArgs += @("-$k"); if ($extra[$k] -isnot [bool]) { $probeArgs += [string]$extra[$k] } }
    # La salida del probe ya está redactada; se muestra y se guarda tal cual.
    & pwsh @probeArgs 2>&1 | Tee-Object -FilePath $log -Append | Out-Host
    $code = $LASTEXITCODE
    $results.Add([pscustomobject]@{ Mode = $mode; Accounts = ($accounts -join ','); Exit = $code })
    if ($code -ne 0) { Write-Log "FALLÓ $mode (exit $code)"; }
    return $code
}

# --- Etapa 0: prerrequisitos -------------------------------------------------
Write-Log "Validación de integración — $(Get-Date -Format s) — cuentas: $($Names -join ', ')"
foreach ($n in $Names) {
    $p = Join-Path $logDir "sunat-test-credential-$n.clixml"
    if (-not (Test-Path -LiteralPath $p)) { throw "Falta la credencial '$n'. Ejecutar: .\scripts\sunat-test-credential.ps1 -Name $n" }
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command corepack -ErrorAction SilentlyContinue)) { throw 'No hay pnpm ni corepack en el PATH (instalar Node.js 20+).' }
    # Shim temporal: los procesos hijos (run-sunat-probe.ps1) llaman a `pnpm` directamente.
    $shim = Join-Path ([IO.Path]::GetTempPath()) 'buzon-pnpm-shim'
    New-Item -ItemType Directory -Path $shim -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $shim 'pnpm.cmd') -Value "@echo off`r`ncorepack pnpm %*" -Encoding ascii
    $env:PATH = "$shim;$env:PATH"
    $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
    Write-Log 'pnpm no estaba en el PATH: se usa `corepack pnpm` mediante un shim temporal.'
}
if ($Names.Count -lt 2) { Write-Log 'AVISO: con una sola cuenta no se puede demostrar aislamiento (S-17/S-18); isolation-check se omite.' }
Write-Log 'Requisito: stack de pruebas arriba (docker compose -f compose.test.yml up -d); e2e-* escriben en la base local.'

$runAll = $Stage -eq 0
Push-Location $root
try {
    # --- Etapa 1: transporte y sesión (S-01…S-08) — no abre ningún mensaje ----
    if ($runAll -or $Stage -eq 1) {
        foreach ($m in 'connection','passive-check','relogin-check','logout-check','dependency-check') {
            if ((Invoke-Probe $m @($Names[0])) -ne 0) { break }
        }
    }

    # --- Etapa 2: inventario, catálogos y esquema (S-06…S-12) — solo listados -
    if ($runAll -or $Stage -eq 2) {
        foreach ($m in 'inventory-check','catalog-check','schema-check','capacity-check') {
            [void](Invoke-Probe $m @($Names[0]))
        }
        # S-10/S-12: con 'catalog-check' y 'schema-check' revisar si las filas traen codCarpeta no nulo.
    }

    # --- Etapa 3: aislamiento y persistencia E2E (S-17/S-18, BE-3/BE-7) -------
    if ($runAll -or $Stage -eq 3) {
        if ($Names.Count -ge 2) { [void](Invoke-Probe 'isolation-check' $Names) }
        [void](Invoke-Probe 'read-safe-check' @($Names[0]))
        [void](Invoke-Probe 'files-safe-check' @($Names[0]))
        [void](Invoke-Probe 'e2e-persist' $Names)
        $extra = @{ Items = $Items }
        if ($Files) { $extra.Files = $true }
        # Abre solo elementos ya leídos; el probe debe reportar unexpectedReads = 0.
        [void](Invoke-Probe 'e2e-archive' $Names $extra)
    }

    # --- Etapa 4 (opt-in): S-14, efecto de abrir un NO leído -----------------
    if ($Stage -eq 4 -or ($IncludeUnread -and $runAll)) {
        Write-Host "`nS-14 abre un mensaje NO leído en SUNAT: el cambio 0→1 es IRREVERSIBLE." -ForegroundColor Yellow
        Write-Host 'Usar solo una cuenta de prueba cuyo mensaje sin leer pueda perderse.'
        $answer = Read-Host "Escribir el nombre de la cuenta ($($Names[0])) para confirmar"
        if ($answer -ceq $Names[0]) { [void](Invoke-Probe 'read-unread-check' @($Names[0])) }
        else { Write-Log 'S-14 omitido por el usuario.' }
    }
} finally { Pop-Location }

# --- Resumen ------------------------------------------------------------------
Write-Log "`n=== Resumen ==="
$results | Format-Table -AutoSize | Out-String | ForEach-Object { Write-Log $_ }
$failed = @($results | Where-Object Exit -ne 0)

Write-Log @'
Siguiente (manual, decisión del operador; nada de esto lo hace este script):
 1. Registrar cada resultado en specs/buzon-sol/sunat/integration-status-*.md (matriz S-xx) y marcar [x] en plan/01-backend.md
    solo las pruebas que pasaron.
 2. Con S-01–S-08 y S-17/S-18 superadas: fijar en el entorno del worker y la API ENABLE_SUNAT_JOBS=true,
    SUNAT_CONNECTION_CLIENT_READY, SUNAT_TRANSPORT_VALIDATED (y SUNAT_READ_VALIDATED / SUNAT_FILE_CLIENT_READY si S-13–S-16 pasaron).
    No fijar SUNAT_CRON_VALIDATED ni SUNAT_PASSIVE_START_VALIDATED hasta cerrar S-05 y S-04.
 3. Levantar API y worker (ver apps/api/README.md), iniciar sesión en la web y ejecutar POST /inventory desde la interfaz;
    comprobar bandejas, actividad, lectura explícita, descarga y archivo por cuenta.
'@

Write-Host "`nRegistro: $log"
if ($failed.Count -gt 0) { exit 1 } else { exit 0 }
