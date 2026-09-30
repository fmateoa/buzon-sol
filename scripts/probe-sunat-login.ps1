<# S-01/S-03: sin -Auth inspecciona el acceso público; -Auth pide credenciales ocultas y prueba el login HTTP. #>
[CmdletBinding()]
param([switch]$SelfTest, [switch]$Auth, [switch]$SavedCredential)

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
    $buzonTarget = $null
    $logoutFlow = $null
    foreach ($script in $inlineScripts) {
        $targetMatch = [regex]::Match($script, 'function\s+cargaBuzon\s*\(\s*\)\s*\{\s*logoutAndLoad\s*\(\s*["'']([^"'']+)', 'IgnoreCase')
        if (-not $targetMatch.Success) { continue }
        try {
            $targetUrl = [uri]::new($PageUrl, [System.Net.WebUtility]::HtmlDecode($targetMatch.Groups[1].Value))
            $targetQuery = [System.Web.HttpUtility]::ParseQueryString($targetUrl.Query)
            $buzonTarget = [ordered]@{
                origin = $targetUrl.GetLeftPart('Authority')
                is_menu_internet = $targetUrl.AbsolutePath.EndsWith('/MenuInternet.htm')
                action_is_exe = $targetQuery['action'] -eq 'exe'
                action_name = if ($targetQuery['action'] -match '^[A-Za-z_-]{1,24}$') { $targetQuery['action'] } else { 'opaque' }
                query_keys = @($targetQuery.AllKeys | Where-Object { $_ } | Sort-Object)
            }
        }
        catch { $buzonTarget = [ordered]@{ origin = 'no_url'; query_keys = @() } }
        break
    }
    foreach ($script in $inlineScripts) {
        $flowStart = $script.IndexOf('function logoutAndLoad2', [StringComparison]::OrdinalIgnoreCase)
        if ($flowStart -lt 0) { continue }
        $flowSource = $script.Substring($flowStart, [Math]::Min(5000, $script.Length - $flowStart))
        $formAction = [regex]::Match($flowSource, '\baction\s*:\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        $ajaxUrl = [regex]::Match($flowSource, '\$\.ajax\s*\(\s*\{\s*url\s*:\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        $ajaxType = [regex]::Match($flowSource, '\btype\s*:\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        $dataType = [regex]::Match($flowSource, '\bdataType\s*:\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
        $suffix = [regex]::Match($flowSource, 'url\s*\+\s*["'']([?&][A-Za-z_-]+=?)["'']\s*\+\s*subdm', 'IgnoreCase').Groups[1].Value
        $logoutFlow = [ordered]@{
            action_is_prevApp = $formAction -eq 'prevApp'
            ajax_url_is_menu = $ajaxUrl -match 'MenuInternet\.htm'
            method = if ($ajaxType -in @('GET','POST')) { $ajaxType } else { 'other' }
            data_type = if ($dataType -in @('text','json','html')) { $dataType } else { 'other' }
            subdomain_suffix = if ($suffix -match '^[?&][A-Za-z_-]+=?$') { $suffix } else { 'unknown' }
        }
        break
    }
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
        foreach ($marker in @('function logoutAndLoad', 'function cargaBuzon2', 'function cargaBuzon', 'iframeApplication.attr')) {
            $offset = $script.IndexOf($marker, [StringComparison]::OrdinalIgnoreCase)
            if ($offset -lt 0) { continue }
            $start = if ($marker -eq 'iframeApplication.attr') { [Math]::Max(0, $offset - 1500) } else { $offset }
            $excerpt = $script.Substring($start, [Math]::Min(3000, $script.Length - $start))
            $excerpt = [regex]::Replace($excerpt, '(?s)"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|`(?:\\.|[^`\\])*`', '[string]')
            $excerpt = [regex]::Replace($excerpt, '\b\d{5,}\b|\b[A-Za-z0-9_\-]{40,}\b', '[opaque]')
            $excerpt = [regex]::Replace($excerpt, '(?i)(token|hc|state|code|ruc)=([^&\s"''\\]+)', '$1=[redacted]')
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
        buzon_target = $buzonTarget
        logout_flow = $logoutFlow
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
    if ($Auth -or $SavedCredential) {
        $stage = 'entrada_local'
        if ($SavedCredential) {
            $credentialPath = Join-Path (Join-Path $env:LOCALAPPDATA 'BuzonSol') 'sunat-test-credential.clixml'
            $saved = Import-Clixml -LiteralPath $credentialPath
            if ($saved.Ruc -isnot [Security.SecureString] -or $saved.User -isnot [Security.SecureString] -or
                $saved.Password -isnot [Security.SecureString]) { throw 'Credencial local inválida' }
            $ruc = ConvertFrom-SecureString -SecureString $saved.Ruc -AsPlainText
            $user = ConvertFrom-SecureString -SecureString $saved.User -AsPlainText
            $password = ConvertFrom-SecureString -SecureString $saved.Password -AsPlainText
            $saved.Ruc.Dispose(); $saved.User.Dispose(); $saved.Password.Dispose()
        } else {
            $ruc = Read-MaskedText 'RUC de prueba (entrada oculta)'
            $user = Read-MaskedText 'Usuario SOL (entrada oculta)'
            $password = Read-MaskedText 'Clave SOL (entrada oculta)'
        }
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
        if (-not $masterUrl -and $finding.auth.menu_hints.logout_flow.action_is_prevApp -and
            $finding.auth.menu_hints.logout_flow.method -eq 'POST' -and
            $finding.auth.menu_hints.buzon_target.action_name -eq 'buzon' -and
            $finding.auth.menu_hints.logout_flow.subdomain_suffix -eq '&s=') {
            $stage = 'prev_app'
            $menuEndpoint = [uri]'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm'
            $prevApp = Invoke-WebRequest -Uri $menuEndpoint -Method Post -Body @{ action = 'prevApp' } -ContentType 'application/x-www-form-urlencoded' -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
            if ($null -eq $prevApp) { throw 'prevApp no devolvió respuesta' }
            $prevText = ([string]$prevApp.Content).Trim()
            $prevLocation = $null
            $prevIsVisor = $false
            if ($prevText -and $prevText -notmatch '[<>\s]') {
                try {
                    $prevUrl = [uri]::new([uri]'https://ww1.sunat.gob.pe/', $prevText)
                    $prevLocation = Get-SafeLocation $prevUrl
                    $prevIsVisor = $prevUrl.AbsolutePath.StartsWith('/ol-ti-itvisornoti/')
                }
                catch { }
            }
            $finding.auth.prev_app = [ordered]@{ status = [int]$prevApp.StatusCode; mime = ([string]$prevApp.Headers.'Content-Type' -split ';')[0]; body_nonempty = $prevText.Length -gt 0; target = $prevLocation; target_is_visor = $prevIsVisor }
            $stage = 'abrir_buzon_menu'
            $targetMatch = [regex]::Match($postResponse.Content, 'function\s+cargaBuzon\s*\(\s*\)\s*\{\s*logoutAndLoad\s*\(\s*["'']([^"'']+)', 'IgnoreCase')
            $target = [uri]::new($lastUrl, [System.Net.WebUtility]::HtmlDecode($targetMatch.Groups[1].Value))
            if ($target.Host -ne 'e-menu.sunat.gob.pe' -or $target.AbsolutePath -ne '/cl-ti-itmenu/MenuInternet.htm' -or
                [System.Web.HttpUtility]::ParseQueryString($target.Query)['action'] -ne 'buzon') { throw 'Destino de buzón inesperado' }
            $targetPage = Get-SunatPage ([uri]($target.AbsoluteUri + '&s=ww1')) $session
            $finding.auth.menu_buzon = [ordered]@{
                steps = $targetPage.steps
                mime = ([string]$targetPage.response.Headers.'Content-Type' -split ';')[0]
                final_is_master = $targetPage.url.AbsolutePath.EndsWith('/visor/master')
            }
            if ($finding.auth.menu_buzon.final_is_master) { $masterUrl = $targetPage.url; $masterPage = $targetPage }
            else { $masterUrl = Find-MasterUrl $targetPage.response.Content }
            $finding.auth.master_link_found = $null -ne $masterUrl
        }
        if ($masterUrl) {
            $stage = 'obtener_html_visor'
            if (-not $masterPage) { $masterPage = Get-SunatPage $masterUrl $session }
            $finding.auth.master = [ordered]@{
                steps = $masterPage.steps
                mime = ([string]$masterPage.response.Headers.'Content-Type' -split ';')[0]
            }
            $afterMaster = @()
            foreach ($boxCode in @('1', '2')) {
                foreach ($variant in @('plain', 'xhr', 'xhr_ruc', 'xhr_ruc_referer', 'anonymous')) {
                    $stage = 'listado_tras_visor'
                    $boxUrl = [uri]($listUrl.AbsoluteUri -replace 'tipoMsj=1', "tipoMsj=$boxCode")
                    $headers = @{}
                    if ($variant -in @('xhr','xhr_ruc','xhr_ruc_referer','anonymous')) { $headers['X-Requested-With'] = 'XMLHttpRequest' }
                    if ($variant -in @('xhr_ruc','xhr_ruc_referer','anonymous')) { $headers['X-Ruc'] = $ruc }
                    if ($variant -eq 'xhr_ruc_referer') { $headers['Referer'] = $masterUrl.AbsoluteUri }
                    if ($variant -eq 'anonymous') {
                        $result = Invoke-WebRequest -Uri $boxUrl -Headers $headers -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
                    } else {
                        $result = Invoke-WebRequest -Uri $boxUrl -Headers $headers -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
                    }
                    $afterMaster += [ordered]@{ box = $boxCode; variant = $variant; response = Get-RowsShape $result }
                }
            }
            $finding.auth.lists_after_master = $afterMaster
            $stage = 'salida'
            $exitSteps = @()
            foreach ($action in @('prevApp', 'salir')) {
                $exitResponse = Invoke-WebRequest -Uri ([uri]'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm') -Method Post -Body @{ action = $action } -ContentType 'application/x-www-form-urlencoded' -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
                if ($null -eq $exitResponse) { throw 'Salida sin respuesta' }
                $exitSteps += [ordered]@{ action = $action; status = [int]$exitResponse.StatusCode }
                if ($action -eq 'prevApp') {
                    $logoutText = ([string]$exitResponse.Content).Trim()
                    $logoutIsVisor = $false
                    if ($logoutText -and $logoutText -notmatch '[<>\s]') {
                        try { $logoutIsVisor = ([uri]::new([uri]'https://ww1.sunat.gob.pe/', $logoutText)).AbsolutePath.StartsWith('/ol-ti-itvisornoti/') }
                        catch { }
                    }
                    $finding.auth.exit_prev_app = [ordered]@{ body_nonempty = $logoutText.Length -gt 0; target_is_visor = $logoutIsVisor }
                    if ($logoutIsVisor) {
                        $stage = 'salida_visor'
                        $cookiePath = [regex]::Match($postResponse.Content, '\brandomCookie\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
                        $domainValue = [regex]::Match($postResponse.Content, '\bdominio\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
                        $finding.auth.exit_domain_structure = @($postResponse.Content -split "`n" | Where-Object { $_ -match '\bdominio\b' } | Select-Object -First 12 | ForEach-Object {
                            $line = [regex]::Replace($_, '"[^"\r\n]*"|''[^''\r\n]*''', '[string]')
                            ([regex]::Replace($line, '\b\d{5,}\b', '[number]')).Trim()
                        })
                        $finding.auth.exit_subdomain_structure = @($postResponse.Content -split "`n" | Where-Object { $_ -match '\bsubdominio\b' } | Select-Object -First 10 | ForEach-Object {
                            $line = [regex]::Replace($_, '"[^"\r\n]*"|''[^''\r\n]*''', '[string]')
                            ([regex]::Replace($line, '\b\d{5,}\b', '[number]')).Trim()
                        })
                        $subdomainAssignment = [regex]::Match($postResponse.Content, '\bvar\s+subdominio\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
                        $finding.auth.exit_subdomain_class = if ($subdomainAssignment -in @('ww1','www','e-menu')) { $subdomainAssignment } else { 'other' }
                        $iframeLine = @([regex]::Matches($postResponse.Content, '(?m)^\s*iframeAnterior\.attr\([^\r\n]*', 'IgnoreCase') | ForEach-Object { $_.Value } | Where-Object { $_ -match 'encodeURIComponent\(response\)' } | Select-Object -First 1)[0]
                        $finding.auth.exit_visor_structure = [regex]::Replace($iframeLine, '"([^"\r\n]*)"|''([^''\r\n]*)''', {
                            param($m)
                            $literal = if ($m.Groups[1].Success) { $m.Groups[1].Value } else { $m.Groups[2].Value }
                            if ($literal -match '^[/?&=.:#-]*$') { return "'$literal'" }
                            return "[string:$($literal.Length)]"
                        })
                        if (-not $cookiePath) { $stage = 'ruta_iframe_ausente'; throw 'No se encontró randomCookie' }
                        if (-not $domainValue) { $stage = 'dominio_iframe_ausente'; throw 'No se encontró dominio' }
                        $iframeParts = [regex]::Match($iframeLine, 'dominio\s*\+\s*["'']([^"'']+)["'']\s*\+\s*randomCookie\s*\+\s*["'']([^"'']+)["'']\s*\+\s*encodeURIComponent\(response\)', 'IgnoreCase')
                        if (-not $iframeParts.Success) { $stage = 'estructura_iframe_inesperada'; throw 'Estructura de salida inesperada' }
                        $logoutUrl = $null
                        $combined = 'https://ww1.sunat.gob.pe' + $iframeParts.Groups[1].Value + $cookiePath + $iframeParts.Groups[2].Value + [uri]::EscapeDataString($logoutText)
                        if ([uri]::TryCreate($combined, [UriKind]::Absolute, [ref]$logoutUrl) -and $logoutUrl.Scheme -eq 'https' -and $logoutUrl.Host.EndsWith('.sunat.gob.pe')) {
                            $stage = 'peticion_iframe_salida'
                            $logoutPage = Get-SunatPage $logoutUrl $session
                            $logoutHtml = [string]$logoutPage.response.Content
                            $innerU = [regex]::Match($logoutHtml, '\bvar\s+u\s*=\s*["'']([^"'']+)', 'IgnoreCase').Groups[1].Value
                            $firstAjaxExpr = [regex]::Match($logoutHtml, '(?is)\$\.ajax\s*\(\s*\{\s*url\s*:\s*(.*?)\s*,\s*type\s*:').Groups[1].Value
                            $innerPrefix = [regex]::Match($firstAjaxExpr, '^["'']([^"'']*)["'']').Groups[1].Value
                            $firstAjaxBlock = [regex]::Match($logoutHtml, '(?is)\$\.ajax\s*\(\s*\{.*?success\s*:').Value
                            $firstAjaxMethod = [regex]::Match($firstAjaxBlock, '\btype\s*:\s*["'']([^"'']*)', 'IgnoreCase').Groups[1].Value
                            $firstAjaxData = [regex]::Match($firstAjaxBlock, '\bdata\s*:\s*["'']([^"'']*)', 'IgnoreCase').Groups[1].Value
                            $firstAjaxContentType = [regex]::Match($firstAjaxBlock, '\bcontentType\s*:\s*["'']([^"'']*)', 'IgnoreCase').Groups[1].Value
                            $innerTarget = $null
                            $innerTargetShape = if ($innerU -and [uri]::TryCreate([uri]::new($logoutUrl, $innerPrefix), $innerU, [ref]$innerTarget)) {
                                [ordered]@{ origin=$innerTarget.GetLeftPart('Authority'); path=$innerTarget.AbsolutePath;
                                    query_keys=@([System.Web.HttpUtility]::ParseQueryString($innerTarget.Query).AllKeys | Where-Object { $_ }) }
                            } else { [ordered]@{ valid=$false; u_length=$innerU.Length; prefix_length=$innerPrefix.Length;
                                expression=([regex]::Replace($firstAjaxExpr, '"[^"\r\n]*"|''[^''\r\n]*''', '[string]')) } }
                            $finding.auth.exit_visor = [ordered]@{ steps = $logoutPage.steps; mime = ([string]$logoutPage.response.Headers.'Content-Type' -split ';')[0];
                                first_ajax_target = $innerTargetShape;
                                first_ajax_method = if ($firstAjaxMethod -in @('GET','POST')) { $firstAjaxMethod } else { 'other' };
                                first_ajax_data_keys = @([System.Web.HttpUtility]::ParseQueryString($firstAjaxData).AllKeys | Where-Object { $_ });
                                first_ajax_data_length = $firstAjaxData.Length;
                                first_ajax_data_is_logout = $firstAjaxData -eq 'logout';
                                first_ajax_content_type = if ($firstAjaxContentType -match '^[A-Za-z0-9/;= +.-]{1,100}$') { $firstAjaxContentType } else { 'other' };
                                has_location_js = $logoutHtml -match '(?i)location[.\[]|location\s*='; has_meta_refresh = $logoutHtml -match '(?i)http-equiv\s*=\s*["'']?refresh';
                                has_iframe = $logoutHtml -match '(?i)<iframe'; contains_visor_origin = $logoutHtml -match 'ol-ti-itvisornoti'; html_length = $logoutHtml.Length;
                                has_post_message = $logoutHtml -match '(?i)postMessage'; has_form_submit = $logoutHtml -match '(?i)\.submit\s*\('; has_window_close = $logoutHtml -match '(?i)window\.close';
                                form_count = [regex]::Matches($logoutHtml, '<form\b', 'IgnoreCase').Count;
                                script_count = [regex]::Matches($logoutHtml, '<script\b', 'IgnoreCase').Count;
                                script_paths = @([regex]::Matches($logoutHtml, '<script\b[^>]*\bsrc\s*=\s*["'']([^"'']+)', 'IgnoreCase') | ForEach-Object {
                                    try { ([uri]::new($logoutUrl, $_.Groups[1].Value)).AbsolutePath } catch { 'invalid' }
                                });
                                inline_script_structure = @([regex]::Matches($logoutHtml, '(?is)<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>') | ForEach-Object {
                                    $code = [regex]::Replace($_.Groups[1].Value, '(?s)"(?:\\.|[^"\\])*"|''(?:\\.|[^''\\])*''|`(?:\\.|[^`\\])*`', '[string]')
                                    $code = [regex]::Replace($code, '\b\d{5,}\b|\b[A-Za-z0-9_-]{30,}\b', '[opaque]')
                                    ([regex]::Replace($code, '\s+', ' ')).Trim().Substring(0, [Math]::Min(1400, ([regex]::Replace($code, '\s+', ' ')).Trim().Length))
                                });
                                inline_literals = @([regex]::Matches($logoutHtml, '(?is)<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>') | ForEach-Object {
                                    [regex]::Matches($_.Groups[1].Value, '"([^"\r\n]*)"|''([^''\r\n]*)''') | Select-Object -First 25 | ForEach-Object {
                                        $literal = if ($_.Groups[1].Success) { $_.Groups[1].Value } else { $_.Groups[2].Value }
                                        $u = $null
                                        if ([uri]::TryCreate($literal, [UriKind]::Absolute, [ref]$u) -and $u.Scheme -in @('http','https')) {
                                            [ordered]@{ kind='absolute_url'; origin=$u.GetLeftPart('Authority'); path=$u.AbsolutePath; query_keys=@([System.Web.HttpUtility]::ParseQueryString($u.Query).AllKeys | Where-Object { $_ }) }
                                        } elseif ($literal.StartsWith('/')) {
                                            [ordered]@{ kind='relative_path'; path=($literal -split '[?]')[0]; length=$literal.Length }
                                        } else { [ordered]@{ kind='other'; length=$literal.Length; has_u=$literal.Contains('u'); has_logout=$literal.Contains('logout') } }
                                    }
                                }) }
                            if ($innerTarget -and $innerTarget.Host -eq 'ww1.sunat.gob.pe' -and
                                $innerTarget.AbsolutePath -eq '/ol-ti-itvisornoti/visor/master' -and
                                $firstAjaxMethod -eq 'POST' -and $firstAjaxData -eq 'logout' -and
                                $firstAjaxContentType.StartsWith('application/x-www-form-urlencoded')) {
                                $logoutAjax = Invoke-WebRequest -Uri $innerTarget -Method Post -Body $firstAjaxData -ContentType $firstAjaxContentType -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -ErrorAction SilentlyContinue -TimeoutSec 25
                                $checkAfterAjax = Invoke-WebRequest -Uri $listUrl -Headers @{ 'X-Requested-With'='XMLHttpRequest'; 'X-Ruc'=$ruc } -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
                                $finding.auth.exit_visor_ajax = [ordered]@{ status=[int]$logoutAjax.StatusCode; protected_list=Get-RowsShape $checkAfterAjax }
                            }
                        } else {
                            $finding.auth.exit_visor = [ordered]@{ url_is_sunat = $false; domain_is_https_prefix = $domainValue -eq 'https://'; prefix_contains_sunat = $iframeParts.Groups[1].Value.Contains('sunat'); prefix_starts_with_slash = $iframeParts.Groups[1].Value.StartsWith('/'); prefix_length = $iframeParts.Groups[1].Value.Length; suffix_length = $iframeParts.Groups[2].Value.Length; cookie_path_length = $cookiePath.Length }
                        }
                    }
                }
            }
            if ([int]$exitResponse.StatusCode -in @(301,302,303,307,308)) {
                $stage = 'redireccion_salida'
                $exitTarget = [uri]::new([uri]'https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', [string]$exitResponse.Headers.Location)
                $exitPage = Get-SunatPage $exitTarget $session
                $finding.auth.exit_redirect = [ordered]@{ steps = $exitPage.steps; mime = ([string]$exitPage.response.Headers.'Content-Type' -split ';')[0] }
            }
            $stage = 'comprobar_salida'
            $checkAfterExit = Invoke-WebRequest -Uri $listUrl -Headers @{ 'X-Requested-With'='XMLHttpRequest'; 'X-Ruc'=$ruc } -WebSession $session -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 25
            $finding.auth.exit = [ordered]@{ steps = $exitSteps; protected_list = Get-RowsShape $checkAfterExit }
        }
        $ruc = $null; $user = $null
    }
    $finding | ConvertTo-Json -Depth 8
} catch {
    # Las excepciones HTTP pueden incluir la URL de sesión: no imprimir Message ni StackTrace.
    Write-Error "La sonda SUNAT falló en $stage (línea $($_.InvocationInfo.ScriptLineNumber)): $($_.Exception.GetType().Name)"
    exit 1
}
