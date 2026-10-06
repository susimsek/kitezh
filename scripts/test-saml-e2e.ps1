param([switch]$ConfigureOnly, [switch]$ForceAuthentication)

# Local Docker fixture only. Uses real signed assertions and normal OIDC/PKCE endpoints.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$appOrigin = 'http://localhost:9090'
$idpOrigin = 'http://localhost:8082'

function New-TestClient {
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $handler.UseCookies = $true
    return [System.Net.Http.HttpClient]::new($handler)
}

function Send-TestRequest($Client, [string]$Method, [uri]$Url, $Fields, $Json, $Token) {
    if ($Url.GetLeftPart([System.UriPartial]::Authority) -notin @($appOrigin, $idpOrigin)) {
        throw 'Refusing to send test credentials or assertions outside the local fixture.'
    }
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)
    try {
        if ($null -ne $Fields) {
            $dictionary = [System.Collections.Generic.Dictionary[string,string]]::new()
            foreach ($key in $Fields.Keys) { $dictionary.Add([string]$key, [string]$Fields[$key]) }
            $request.Content = [System.Net.Http.FormUrlEncodedContent]::new($dictionary)
        } elseif ($null -ne $Json) {
            $request.Content = [System.Net.Http.StringContent]::new($Json, [System.Text.Encoding]::UTF8, 'application/json')
        }
        if ($Token) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token) }
        if ($Method -eq 'POST' -and $Url.AbsolutePath -eq '/login/saml2/sso/saml-e2e') {
            [void]$request.Headers.TryAddWithoutValidation('Origin', $idpOrigin)
            [void]$request.Headers.TryAddWithoutValidation('Sec-Fetch-Mode', 'navigate')
            [void]$request.Headers.TryAddWithoutValidation('Sec-Fetch-Dest', 'document')
        }
        $response = $Client.SendAsync($request).GetAwaiter().GetResult()
        try {
            return @{
                Status = [int]$response.StatusCode
                Body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                Location = $response.Headers.Location
                Url = $Url
            }
        } finally { $response.Dispose() }
    } finally { $request.Dispose() }
}

function Follow-TestRedirects($Client, $Response) {
    for ($step = 0; $step -lt 12 -and $Response.Status -in @(301, 302, 303); $step++) {
        $next = [uri]::new($Response.Url, $Response.Location)
        $Response = Send-TestRequest $Client GET $next
    }
    return $Response
}

function Read-TestForm($Response) {
    $match = [regex]::Match($Response.Body, '<form\b[^>]*action=["'']([^"'']*)["''][^>]*>', 'IgnoreCase')
    if (-not $match.Success) { throw "Expected HTML form, received HTTP $($Response.Status)." }
    $fields = @{}
    foreach ($input in [regex]::Matches($Response.Body, '<input\b[^>]*>', 'IgnoreCase')) {
        $name = [regex]::Match($input.Value, '\bname=["'']([^"'']*)["'']', 'IgnoreCase')
        $value = [regex]::Match($input.Value, '\bvalue=["'']([^"'']*)["'']', 'IgnoreCase')
        if ($name.Success) {
            $fields[[System.Net.WebUtility]::HtmlDecode($name.Groups[1].Value)] = [System.Net.WebUtility]::HtmlDecode($value.Groups[1].Value)
        }
    }
    return @{ Url = [uri]::new($Response.Url, [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)); Fields = $fields }
}

function Encode-TestQuery($Fields) {
    return (($Fields.Keys | ForEach-Object { [uri]::EscapeDataString($_) + '=' + [uri]::EscapeDataString([string]$Fields[$_]) }) -join '&')
}

function Get-ConsoleToken($Client, [string]$Console) {
    $verifier = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $challenge = [Convert]::ToBase64String([System.Security.Cryptography.SHA256]::HashData([System.Text.Encoding]::ASCII.GetBytes($verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $state = [guid]::NewGuid().ToString()
    $callback = "$appOrigin/$Console/callback"
    $query = Encode-TestQuery @{
        response_type = 'code'; client_id = "$Console-console"; redirect_uri = $callback
        scope = "openid profile email $Console-api"; state = $state
        code_challenge = $challenge; code_challenge_method = 'S256'
    }
    $response = Send-TestRequest $Client GET "$appOrigin/oauth2/authorize?$query"
    for ($step = 0; $step -lt 8 -and $response.Status -eq 302; $step++) {
        $next = [uri]::new($response.Url, $response.Location)
        if ($next.GetLeftPart([System.UriPartial]::Path) -eq $callback) {
            $values = @{}
            foreach ($part in $next.Query.TrimStart('?').Split('&')) {
                $pair = $part.Split('=', 2)
                $values[[uri]::UnescapeDataString($pair[0])] = [uri]::UnescapeDataString($pair[1])
            }
            if ($values.state -ne $state -or -not $values.code) { throw 'OIDC state or code validation failed.' }
            $tokenResponse = Send-TestRequest $Client POST "$appOrigin/oauth2/token" @{
                grant_type = 'authorization_code'; client_id = "$Console-console"
                redirect_uri = $callback; code = $values.code; code_verifier = $verifier
            }
            if ($tokenResponse.Status -ne 200) { throw "OIDC token exchange failed: HTTP $($tokenResponse.Status)." }
            return ($tokenResponse.Body | ConvertFrom-Json).access_token
        }
        $response = Send-TestRequest $Client GET $next
    }
    throw "OIDC authorization did not return a code: HTTP $($response.Status)."
}

$adminClient = New-TestClient
try {
    $ready = Send-TestRequest $adminClient GET "$appOrigin/actuator/health/readiness"
    $metadata = Send-TestRequest $adminClient GET "$idpOrigin/simplesaml/saml2/idp/metadata.php"
    if ($ready.Status -ne 200 -or $metadata.Status -ne 200) { throw 'Application or IdP is not ready.' }
    $login = Send-TestRequest $adminClient POST "$appOrigin/login" @{ username = 'admin'; password = 'admin' }
    if ($login.Status -ne 302) { throw 'Local fixture admin login failed.' }
    $adminToken = Get-ConsoleToken $adminClient admin
    $providers = Send-TestRequest $adminClient GET "$appOrigin/api/admin/identity-providers?size=20&q=saml-e2e" $null $null $adminToken
    if ($providers.Status -ne 200) { throw 'Provider catalog could not be read.' }
    $existing = ($providers.Body | ConvertFrom-Json).content | Where-Object alias -eq 'saml-e2e'
    $settings = @{
        registrationId = 'saml-e2e'; alias = 'saml-e2e'; providerType = 'saml'; displayName = 'SimpleSAMLphp E2E'; iconKey = 'generic'
        enabled = $true; hideOnLogin = $false; accountLinkingOnly = $false; trustEmail = $false; mfaRequired = $false
        shortStateParameter = $false; caseSensitiveUsername = $false; storeTokens = $false; storedTokensReadable = $false
        requiredClaims = 'sub,email'; guiOrder = 0; showInAccountConsole = 'always'; syncMode = 'import'
        clientAuthenticationMethod = 'client_secret_basic'; scopes = 'openid'; userNameAttribute = 'sub'
        samlMetadataUri = "$idpOrigin/simplesaml/saml2/idp/metadata.php"
        samlServiceProviderEntityId = "$appOrigin/saml2/service-provider-metadata/saml-e2e"
        samlPrincipalAttribute = 'uid'; samlEmailAttribute = 'email'; samlFirstNameAttribute = 'givenName'; samlLastNameAttribute = 'sn'
        samlNameIdFormat = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
        samlSignAuthnRequests = $false; samlWantAssertionsSigned = $true
        samlForceAuthentication = [bool]$ForceAuthentication; samlPassSubject = $false
        samlAuthnRequestBinding = 'REDIRECT'; samlResponseBinding = 'POST'; samlLogoutBinding = 'REDIRECT'
    }
    $providerUrl = "$appOrigin/api/admin/identity-providers"
    $method = 'POST'
    if ($existing) { $providerUrl += '/' + $existing.id; $method = 'PUT' }
    $saved = Send-TestRequest $adminClient $method $providerUrl $null ($settings | ConvertTo-Json) $adminToken
    if ($saved.Status -notin @(200, 201)) { throw "Provider configuration failed: HTTP $($saved.Status), $($saved.Body)" }
    Write-Output 'SAML_PROVIDER_CONFIG=PASS'
    if ($ConfigureOnly) { return }

    foreach ($testUser in @('user1', 'user2')) {
        $firstUsername = $null
        for ($attempt = 1; $attempt -le 2; $attempt++) {
            $client = New-TestClient
            try {
                $start = Send-TestRequest $client GET "$appOrigin/saml2/authenticate/saml-e2e"
                if ($start.Status -ne 302) { throw "SAML start failed: HTTP $($start.Status)." }
                $page = Follow-TestRedirects $client $start
                $form = Read-TestForm $page
                if (-not $form.Fields.ContainsKey('SAMLResponse')) {
                    $form.Fields.username = $testUser
                    $form.Fields.password = 'password'
                    $page = Send-TestRequest $client POST $form.Url $form.Fields
                    $page = Follow-TestRedirects $client $page
                    $form = Read-TestForm $page
                }
                if (-not $form.Fields.ContainsKey('SAMLResponse') -or $form.Url.AbsoluteUri -ne "$appOrigin/login/saml2/sso/saml-e2e") {
                    throw 'IdP did not produce a SAML POST to the exact ACS.'
                }
                $acs = Send-TestRequest $client POST $form.Url $form.Fields
                if ($acs.Status -ne 302 -or ([string]$acs.Location) -match 'error|account_link_required') {
                    throw "SAML ACS failed: HTTP $($acs.Status), redirect=$($acs.Location)."
                }
                $session = Send-TestRequest $client GET "$appOrigin/oidc/session-status"
                if ($session.Status -ne 200 -or -not ($session.Body | ConvertFrom-Json).authenticated) { throw 'No authenticated local SSO session.' }
                $accountToken = Get-ConsoleToken $client account
                $profile = Send-TestRequest $client GET "$appOrigin/api/account/profile" $null $null $accountToken
                if ($profile.Status -ne 200) { throw 'Authenticated Account API could not be read.' }
                $account = $profile.Body | ConvertFrom-Json
                if ($account.email -ne "$testUser@example.com" -or $account.emailVerified) { throw 'Imported profile or email trust is incorrect.' }
                if ($firstUsername -and $account.username -ne $firstUsername) { throw 'Repeated SAML login created a different local user.' }
                $firstUsername = $account.username
                $denied = Send-TestRequest $client GET "$appOrigin/api/admin/users" $null $null $accountToken
                if ($denied.Status -ne 403) { throw 'SAML test user unexpectedly obtained administrative access.' }
                Write-Output "SAML_HTTP user=$testUser login=$attempt ACS=302 SESSION=authenticated ACCOUNT=200 ADMIN=403 STABLE_USER=PASS"
                if ($testUser -eq 'user1' -and $attempt -eq 1) {
                    $replayClient = New-TestClient
                    try {
                        $replay = Send-TestRequest $replayClient POST $form.Url $form.Fields
                        $replaySession = Send-TestRequest $replayClient GET "$appOrigin/oidc/session-status"
                        if ($replay.Status -ne 302 -or ([string]$replay.Location) -notmatch '/login\?error' -or $replaySession.Status -ne 401 -or ($replaySession.Body | ConvertFrom-Json).error -ne 'unauthorized') {
                            throw 'An unsolicited replay of an SP-initiated response was not rejected.'
                        }
                        Write-Output 'SAML_REPLAY_WITHOUT_REQUEST_SESSION=REJECTED'
                    } finally { $replayClient.Dispose() }
                }
            } finally { $client.Dispose() }
        }
    }
    Write-Output 'SAML_E2E=PASS (HTTP only; not a Chrome UI result)'
} finally { $adminClient.Dispose() }
