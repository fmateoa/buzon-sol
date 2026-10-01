<# Pasa la credencial DPAPI al proceso de prueba por stdin, sin argumentos ni archivo de texto claro. #>
[CmdletBinding()]
param(
    [ValidateSet('connection','passive-check','relogin-check','logout-check','dependency-check','inventory-check','catalog-check','read-safe-check','files-safe-check','login-diagnose','logout-diagnose','read-unread-check','collision-check','logout-delay','master-logout-js','logout-cookies','isolation-check','e2e-persist','e2e-archive','search-check','label-check','schema-check','capacity-check','logout-lifetime','expiry-idle','expiry-active')]
    [string]$Mode = 'connection',
    [ValidateRange(1,180)][int]$Minutes = 15,
    [string[]]$Names = @(),
    # Solo e2e-archive: elementos ya leídos por cuenta que se abren, y si además se guardan sus archivos en el S3 local.
    [ValidateRange(1,50)][int]$Items = 5,
    [switch]$Files
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    # Sin pnpm global: shim temporal sobre `corepack pnpm` para este proceso y sus hijos.
    $shim = Join-Path ([IO.Path]::GetTempPath()) 'buzon-pnpm-shim'
    New-Item -ItemType Directory -Path $shim -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $shim 'pnpm.cmd') -Value "@echo off`r`ncorepack pnpm %*" -Encoding ascii
    $env:PATH = "$shim;$env:PATH"
    $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
}
$Names = @($Names | ForEach-Object { $_ -split ',' } | Where-Object { $_ })  # `pwsh -File` no separa arreglos por comas.
function Read-Saved([string]$name) {
    $leaf = if ($name) { "sunat-test-credential-$name.clixml" } else { 'sunat-test-credential.clixml' }
    $saved = Import-Clixml -LiteralPath (Join-Path (Join-Path $env:LOCALAPPDATA 'BuzonSol') $leaf)
    if ($saved.Ruc -isnot [Security.SecureString] -or $saved.User -isnot [Security.SecureString] -or
        $saved.Password -isnot [Security.SecureString]) { throw 'Credencial local inválida' }
    return $saved
}

$script = if ($Mode -in 'e2e-persist','e2e-archive') { 'e2e-persist.ts' } else { 'probe-sunat-adapter.ts' }
$savedList = @()
try {
    $entries = @()
    foreach ($name in $(if ($Names.Count -gt 0) { $Names } else { @('') })) {
        $saved = Read-Saved $name
        $savedList += $saved
        $entries += @{
            ruc = ConvertFrom-SecureString $saved.Ruc -AsPlainText
            solUser = ConvertFrom-SecureString $saved.User -AsPlainText
            password = ConvertFrom-SecureString $saved.Password -AsPlainText
        }
    }
    # Solo isolation-check y e2e-* aceptan varias cuentas; los demás modos reciben una sola credencial plana (la primera de -Names).
    $multi = $Mode -in 'isolation-check','e2e-persist','e2e-archive'
    $payload = if ($Names.Count -gt 0 -and $multi) { @{ accounts = $entries } | ConvertTo-Json -Depth 4 -Compress } else { $entries[0] | ConvertTo-Json -Compress }
    $env:SUNAT_PROBE_MINUTES = [string]$Minutes
    $env:E2E_ARCHIVE_ITEMS = [string]$Items
    if ($Files) { $env:E2E_ARCHIVE_FILES = '1' }
    $payload | pnpm --filter @buzon-sol/worker exec tsx "../../scripts/$script" "--$Mode"
    $code = $LASTEXITCODE
} finally {
    foreach ($item in $savedList) { $item.Ruc.Dispose(); $item.User.Dispose(); $item.Password.Dispose() }
    $payload = $null
    Remove-Item Env:SUNAT_PROBE_MINUTES, Env:E2E_ARCHIVE_ITEMS, Env:E2E_ARCHIVE_FILES -ErrorAction SilentlyContinue
}
exit $code
