<# S-01/S-03: sin -Auth inspecciona el acceso público; -Auth pide credenciales ocultas y prueba el login HTTP. #>
[CmdletBinding()]
param([switch]$SelfTest, [switch]$Auth)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$allowedHosts = @('www.sunat.gob.pe', 'api-seguridad.sunat.gob.pe', 'e-menu.sunat.gob.pe', 'ww1.sunat.gob.pe')

function Get-SafeLocation([uri]$Url) {
    $queryKeys = [System.Web.HttpUtility]::ParseQueryString($Url.Query).AllKeys | Where-Object { $_ }
    return [ordered]@{
        origin = $Url.GetLeftPart('Authority')
        query_keys = @($queryKeys | Sort-Object)
    }
}

function Get-SunatPage([uri]$Url, $Session) {
    $steps = @()
    for ($i = 0; $i -lt 8; $i++) {
        if ($Url.Host -notin $allowedHosts -or $Url.Scheme -ne 'https') {
            throw 'URL fuera de los orígenes SUNAT esperados'
        }
        $response = Invoke-WebRequest -Uri $Url -WebSession $Session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
        if ($null -eq $response) { throw 'La solicitud HTTP no devolvió respuesta' }
        $steps += [ordered]@{ status = [int]$response.StatusCode; location = Get-SafeLocation $Url }
        if ([int]$response.StatusCode -notin @(301, 302, 303, 307, 308)) {
            return @{ response = $response; url = $Url; steps = $steps }
        }
        $Url = [uri]::new($Url, [string]$response.Headers.Location)
    }
    throw 'Demasiadas redirecciones'
}

function Get-FormInfo([string]$Html, [uri]$BaseUrl) {
    $formTags = [regex]::Matches($Html, '<form\b[^>]*>', 'IgnoreCase')
    foreach ($tag in $formTags) {
        $action = [regex]::Match($tag.Value, '\baction\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        if (-not $action) { continue }
        $actionUrl = [uri]::new($BaseUrl, [System.Net.WebUtility]::HtmlDecode($action))
        if (-not $actionUrl.AbsolutePath.EndsWith('/oauth2/j_security_check')) { continue }
        $method = [regex]::Match($tag.Value, '\bmethod\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value.ToUpperInvariant()
        $formBody = [regex]::Match($Html, '(?is)' + [regex]::Escape($tag.Value) + '(?<body>.*?)</form>').Groups['body'].Value
        $formBody = [regex]::Replace($formBody, '(?s)<!--.*?-->', '')
        $fields = [regex]::Matches($formBody, '<input\b[^>]*\bname\s*=\s*["'']?([^\s>"'']+)', 'IgnoreCase') |
            ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
        return [ordered]@{
            method = $method
            action = Get-SafeLocation $actionUrl
            action_is_j_security_check = $true
            field_names = @($fields)
            captcha_field_present = 'captcha' -in $fields
        }
    }
    throw 'No se encontró el formulario j_security_check'
}

function Read-MaskedText([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}

function Get-RowsShape($Response) {
    $mime = ([string]$Response.Headers.'Content-Type' -split ';')[0]
    $shape = 'not-json'
    if ($mime -eq 'application/json') {
        try {
            $json = ConvertFrom-Json -AsHashtable $Response.Content
            $shape = if ($json['rows'] -is [array]) { 'array' } elseif ($null -eq $json['rows']) { 'null' } else { 'other' }
        } catch { $shape = 'invalid-json' }
    }
    return [ordered]@{ status = [int]$Response.StatusCode; mime = $mime; rows_shape = $shape }
}

function Find-MasterUrl([string]$Html) {
    $decoded = [System.Net.WebUtility]::HtmlDecode($Html).Replace('\/', '/').Replace('\u0026', '&')
    $matches = [regex]::Matches($decoded, '(?i)https://ww1\.sunat\.gob\.pe/ol-ti-itvisornoti/visor/master\?[^\s"''<>\\]+')
    foreach ($match in $matches) {
        $candidate = $match.Value.TrimEnd(')', ';', ',')
        $url = [uri]$candidate
        if ($url.Host -eq 'ww1.sunat.gob.pe' -and $url.AbsolutePath.EndsWith('/visor/master')) { return $url }
    }
    return $null
}

function Get-MenuHints([string]$Html, [uri]$PageUrl) {
    $iframeTags = [regex]::Matches($Html, '(?is)<iframe\b[^>]*>')
    $iframeSources = @()
    $iframeIds = @()
    foreach ($tag in $iframeTags) {
        $iframeId = [regex]::Match($tag.Value, '\b(?:id|name)\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        if ($iframeId) { $iframeIds += $iframeId }
        $src = [regex]::Match($tag.Value, '\bsrc\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        if (-not $src) { $iframeSources += 'sin_src'; continue }
        try {
            $iframeUrl = [uri]::new($PageUrl, [System.Net.WebUtility]::HtmlDecode($src))
            $iframeSources += $iframeUrl.GetLeftPart('Authority')
        } catch { $iframeSources += 'src_no_url' }
    }
    $scriptLocations = @([regex]::Matches($Html, '(?is)<script\b[^>]*\bsrc\s*=\s*["'']([^"'']+)', 'IgnoreCase') |
        ForEach-Object {
            try {
                $scriptUrl = [uri]::new($PageUrl, [System.Net.WebUtility]::HtmlDecode($_.Groups[1].Value))
                [ordered]@{ origin = $scriptUrl.GetLeftPart('Authority'); path = $scriptUrl.AbsolutePath }
            } catch { [ordered]@{ origin = 'src_no_url'; path = '' } }
        })
    $query = [System.Web.HttpUtility]::ParseQueryString($PageUrl.Query)
    $inlineScripts = @([regex]::Matches($Html, '(?is)<script\b(?![^>]*\bsrc\s*=)[^>]*>(?<body>.*?)</script>') |
        ForEach-Object { $_.Groups['body'].Value })
    $codeHints = @()
    $flowHints = @()
    foreach ($script in $inlineScripts) {
        foreach ($line in ($script -split "`n")) {
            if ($line -notmatch '(?i)iframeApplication|ifrVCE|ww1\.sunat|\.src\s*=|attr\s*\(\s*["'']src|buzon') { continue }
            $withoutStrings = [regex]::Replace($line, '"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''', '[string]')
            $withoutStrings = [regex]::Replace($withoutStrings, '\b\d{5,}\b', '[number]')
            $identifiers = @([regex]::Matches($withoutStrings, '[A-Za-z_$][\w$]*') |
                ForEach-Object { $_.Value } | Where-Object { $_ -ne 'string' -and $_ -ne 'number' } | Select-Object -Unique)
            if ($identifiers.Count -gt 0) { $codeHints += ,$identifiers }
            if ($codeHints.Count -ge 20) { break }
        }
        foreach ($marker in @('cargaBuzon2', 'function cargaBuzon', 'iframeApplication.attr')) {
            $offset = $script.IndexOf($marker, [StringComparison]::OrdinalIgnoreCase)
            if ($offset -lt 0) { continue }
            $excerpt = $script.Substring($offset, [Math]::Min(2200, $script.Length - $offset))
            $excerpt = [regex]::Replace($excerpt, '(?s)"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|`(?:\\.|[^`\\])*`', '[string]')
            $excerpt = [regex]::Replace($excerpt, '\b\d{5,}\b|\b[A-Za-z0-9_\-]{40,}\b', '[opaque]')
            $excerpt = [regex]::Replace($excerpt, '\s+', ' ').Trim()
            $flowHints += [ordered]@{ marker = $marker; structure = $excerpt }
        }
    }
    return [ordered]@{
        exe_is_buzon = $query['exe'] -eq 'buzon'
        contains_visor_master = $Html.Contains('/visor/master')
        contains_itvisornoti = $Html.Contains('itvisornoti')
        contains_ww1_origin = $Html.Contains('ww1.sunat.gob.pe')
        iframe_count = $iframeTags.Count
        iframe_ids = @($iframeIds | Sort-Object -Unique)
        iframe_src_origins = @($iframeSources | Sort-Object -Unique)
        script_locations = $scriptLocations
        inline_script_count = $inlineScripts.Count
        relevant_line_identifiers = $codeHints
        flow_hints = $flowHints
    }
}

if ($SelfTest) {
    $testHtml = '<form method="POST" action="j_security_check"><input name="state" value="secret"></form>'
    $test = Get-FormInfo $testHtml ([uri]'https://api-seguridad.sunat.gob.pe/oauth2/loginMenuSol?state=secret')
    if ($test.method -ne 'POST' -or 'state' -notin $test.field_names -or
        ($test | ConvertTo-Json -Depth 8) -match 'secret') { throw 'Falló la autoprueba' }
    $master = Find-MasterUrl '<iframe src="https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/master?hc=private&amp;token=private"></iframe>'
    if (-not $master -or $master.Query -notmatch 'token=private') { throw 'Falló la autoprueba del visor' }
    $hints = Get-MenuHints '<iframe src="https://ww1.sunat.gob.pe/visor/master?token=private"></iframe><script src="/app.js?token=private"></script><script>function cargaBuzon(){iframeApplication.attr("src", "private");}</script>' ([uri]'https://e-menu.sunat.gob.pe/MenuInternet.htm?exe=buzon')
    if (-not $hints.exe_is_buzon -or $hints.iframe_src_origins[0] -ne 'https://ww1.sunat.gob.pe' -or
        ($hints | ConvertTo-Json -Depth 8) -match 'private') { throw 'Falló la autoprueba de redacción' }
    Write-Output 'self-test: ok'
    return
}

try {
    $stage = 'portada'
    $session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
    $homePage = Get-SunatPage ([uri]'https://www.sunat.gob.pe/') $session
    $links = @($homePage.response.Links | Where-Object { $_.href -match '/oauth2/loginMenuSol' } |
        ForEach-Object { [uri]::new($homePage.url, [System.Net.WebUtility]::HtmlDecode($_.href)) } |
        Where-Object { $_.Host -eq 'api-seguridad.sunat.gob.pe' })
    if ($links.Count -eq 0) { throw 'No se encontró el enlace SOL en la portada' }
    $link = $links | Where-Object { $_.Query -match 'originalUrl=' -and $_.Query -match 'state=' } | Select-Object -First 1
    if (-not $link) { $link = $links[0] }
    $query = [System.Web.HttpUtility]::ParseQueryString($link.Query)
    $stage = 'formulario'
    $login = Get-SunatPage $link $session
    $form = Get-FormInfo $login.response.Content $login.url
    $cookies = @($session.Cookies.GetCookies($link) | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $listUrl = [uri]('https://ww1.sunat.gob.pe/ol-ti-itvisornoti/visor/listNotiMenPag?tipoMsj=1&codCarpeta=00&codEtiqueta=&page=1&des_asunto=&codMensaje=&tipoOrden=NADA&_=' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    $anonymousList = @()
    foreach ($variant in @('plain', 'xhr')) {
        $stage = 'control_sin_sesion'
        $headers = @{}
        if ($variant -eq 'xhr') { $headers['X-Requested-With'] = 'XMLHttpRequest' }
        $result = Invoke-WebRequest -Uri $listUrl -Headers $headers -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
        $anonymousList += [ordered]@{ variant = $variant; response = Get-RowsShape $result }
    }
    $finding = [ordered]@{
        home = $homePage.steps
        login = $login.steps
        link_count = $links.Count
        link_has_originalUrl = -not [string]::IsNullOrEmpty($query['originalUrl'])
        link_has_state = -not [string]::IsNullOrEmpty($query['state'])
        form = $form
        cookie_names = $cookies
        anonymous_list = $anonymousList
    }
    if ($Auth) {
        $stage = 'entrada_local'
        $ruc = Read-MaskedText 'RUC de prueba (entrada oculta)'
        $user = Read-MaskedText 'Usuario SOL (entrada oculta)'
        $password = Read-MaskedText 'Clave SOL (entrada oculta)'
        if ($ruc -notmatch '^\d{11}$' -or [string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($password)) {
            throw 'Formato de credencial inválido'
        }
        $actionMatch = [regex]::Match($login.response.Content, '<form\b[^>]*\baction\s*=\s*["'']([^"'']*j_security_check)', 'IgnoreCase')
        if (-not $actionMatch.Success -or $form.method -ne 'POST') { throw 'El formulario de login cambió' }
        $actionUrl = [uri]::new($login.url, [System.Net.WebUtility]::HtmlDecode($actionMatch.Groups[1].Value))
        if ($actionUrl.Host -ne 'api-seguridad.sunat.gob.pe' -or $actionUrl.Scheme -ne 'https') { throw 'Acción de login inesperada' }
        $postBody = @{
            tipo = '2'; dni = ''; custom_ruc = $ruc; j_username = $user; j_password = $password
            captcha = ''; originalUrl = $query['originalUrl']; lang = ''; state = $query['state']
        }
        $stage = 'post_login'
        $postResponse = Invoke-WebRequest -Uri $actionUrl -Method Post -Body $postBody -ContentType 'application/x-www-form-urlencoded' -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
        if ($null -eq $postResponse) { throw 'El POST no devolvió respuesta' }
        $password = $null; $postBody = $null
        $authSteps = @([ordered]@{ status = [int]$postResponse.StatusCode; location = Get-SafeLocation $actionUrl })
        $lastUrl = $actionUrl
        for ($i = 0; $i -lt 8 -and [int]$postResponse.StatusCode -in @(301, 302, 303, 307, 308); $i++) {
            $stage = 'redireccion_login'
            $lastUrl = [uri]::new($lastUrl, [string]$postResponse.Headers.Location)
            if ($lastUrl.Host -notin $allowedHosts -or $lastUrl.Scheme -ne 'https') { throw 'Redirección fuera de SUNAT' }
            $postResponse = Invoke-WebRequest -Uri $lastUrl -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
            if ($null -eq $postResponse) { throw 'La redirección no devolvió respuesta' }
            $authSteps += [ordered]@{ status = [int]$postResponse.StatusCode; location = Get-SafeLocation $lastUrl }
        }
        $authLists = @()
        foreach ($variant in @('plain', 'xhr', 'xhr_ruc')) {
            $stage = 'listado_autenticado'
            $headers = @{}
            if ($variant -ne 'plain') { $headers['X-Requested-With'] = 'XMLHttpRequest' }
            if ($variant -eq 'xhr_ruc') { $headers['X-Ruc'] = $ruc }
            $result = Invoke-WebRequest -Uri $listUrl -Headers $headers -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
            $authLists += [ordered]@{ variant = $variant; response = Get-RowsShape $result }
        }
        $finding.auth = [ordered]@{
            redirect_steps = $authSteps
            final_origin = $lastUrl.GetLeftPart('Authority')
            login_form_returned = $postResponse.Content -match 'j_security_check'
            account_marker_matches = $postResponse.Content.Contains($ruc)
            direct_lists_before_master = $authLists
        }
        $stage = 'buscar_visor'
        $masterUrl = Find-MasterUrl $postResponse.Content
        $finding.auth.master_link_found = $null -ne $masterUrl
        $finding.auth.menu_hints = Get-MenuHints $postResponse.Content $lastUrl
        if ($masterUrl) {
            $stage = 'obtener_html_visor'
            $masterPage = Get-SunatPage $masterUrl $session
            $finding.auth.master = [ordered]@{
                steps = $masterPage.steps
                mime = ([string]$masterPage.response.Headers.'Content-Type' -split ';')[0]
            }
            $afterMaster = @()
            foreach ($variant in @('xhr_ruc', 'xhr_ruc_referer')) {
                $stage = 'listado_tras_visor'
                $headers = @{ 'X-Requested-With' = 'XMLHttpRequest'; 'X-Ruc' = $ruc }
                if ($variant -eq 'xhr_ruc_referer') { $headers['Referer'] = $masterUrl.AbsoluteUri }
                $result = Invoke-WebRequest -Uri $listUrl -Headers $headers -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
                $afterMaster += [ordered]@{ variant = $variant; response = Get-RowsShape $result }
            }
            $finding.auth.lists_after_master = $afterMaster
        }
        $ruc = $null; $user = $null
    }
    $finding | ConvertTo-Json -Depth 8
} catch {
    # Las excepciones HTTP pueden incluir la URL de sesión: no imprimir Message ni StackTrace.
    Write-Error "La sonda SUNAT falló en $stage`: $($_.Exception.GetType().Name)"
    exit 1
}
