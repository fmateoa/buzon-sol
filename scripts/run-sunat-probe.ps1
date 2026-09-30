<# Pasa la credencial DPAPI al proceso de prueba por stdin, sin argumentos ni archivo de texto claro. #>
[CmdletBinding()]
param(
    [ValidateSet('connection','passive-check','relogin-check','logout-check','dependency-check','inventory-check','catalog-check','read-safe-check','files-safe-check','expiry-idle','expiry-active')]
    [string]$Mode = 'connection',
    [ValidateRange(1,180)][int]$Minutes = 15
)

$ErrorActionPreference = 'Stop'
$path = Join-Path (Join-Path $env:LOCALAPPDATA 'BuzonSol') 'sunat-test-credential.clixml'
$saved = Import-Clixml -LiteralPath $path
if ($saved.Ruc -isnot [Security.SecureString] -or $saved.User -isnot [Security.SecureString] -or
    $saved.Password -isnot [Security.SecureString]) { throw 'Credencial local inválida' }

try {
    $payload = @{
        ruc = ConvertFrom-SecureString $saved.Ruc -AsPlainText
        solUser = ConvertFrom-SecureString $saved.User -AsPlainText
        password = ConvertFrom-SecureString $saved.Password -AsPlainText
    } | ConvertTo-Json -Compress
    $env:SUNAT_PROBE_MINUTES = [string]$Minutes
    $payload | pnpm --filter @buzon-sol/worker exec tsx ../../scripts/probe-sunat-adapter.ts "--$Mode"
    $code = $LASTEXITCODE
} finally {
    $saved.Ruc.Dispose()
    $saved.User.Dispose()
    $saved.Password.Dispose()
    $payload = $null
    Remove-Item Env:SUNAT_PROBE_MINUTES -ErrorAction SilentlyContinue
}
exit $code
