<# Guarda una credencial de prueba cifrada con DPAPI para el usuario de Windows actual. #>
[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_-]{0,20}$')][string]$Name = '',
    [switch]$Delete,
    [switch]$All
)

$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:LOCALAPPDATA 'BuzonSol'
$leaf = if ($Name) { "sunat-test-credential-$Name.clixml" } else { 'sunat-test-credential.clixml' }
$path = Join-Path $directory $leaf

if ($Delete) {
    if ($All) { Get-ChildItem -LiteralPath $directory -Filter 'sunat-test-credential*.clixml' -ErrorAction SilentlyContinue | Remove-Item }
    else { Remove-Item -LiteralPath $path -ErrorAction SilentlyContinue }
    Write-Output 'Credencial de prueba eliminada.'
    return
}

$ruc = Read-Host 'RUC de prueba (entrada oculta)' -AsSecureString
$user = Read-Host 'Usuario SOL (entrada oculta)' -AsSecureString
$password = Read-Host 'Clave SOL (entrada oculta)' -AsSecureString
try {
    if ($ruc.Length -ne 11 -or $user.Length -eq 0 -or $password.Length -eq 0) {
        throw 'Formato de credencial inválido'
    }
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    [pscustomobject]@{ Ruc = $ruc; User = $user; Password = $password } |
        Export-Clixml -LiteralPath $path -Force
    Write-Output 'Credencial cifrada para este usuario de Windows. No se guardó en el repositorio.'
} finally {
    $ruc.Dispose(); $user.Dispose(); $password.Dispose()
}
