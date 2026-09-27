$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$prePushHook = Join-Path $repositoryRoot '.githooks\pre-push'

if (-not (Test-Path -LiteralPath $prePushHook -PathType Leaf)) {
    throw "Pre-push hook not found: $prePushHook"
}

git -C $repositoryRoot config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to configure the Git hooks path.'
}

git -C $repositoryRoot update-index --chmod=+x -- .githooks/pre-push
if ($LASTEXITCODE -ne 0) {
    throw 'Failed to mark the pre-push hook as executable.'
}

$userToken = [Environment]::GetEnvironmentVariable('SONARQUBE_TOKEN', 'User')
$processToken = [Environment]::GetEnvironmentVariable('SONARQUBE_TOKEN', 'Process')

Write-Host 'Git hooks enabled: .githooks'
if ([string]::IsNullOrWhiteSpace($userToken) -and [string]::IsNullOrWhiteSpace($processToken)) {
    Write-Warning 'SONARQUBE_TOKEN is not configured. SonarCloud analysis will be skipped during pre-push.'
    Write-Host 'Set the token as a Windows User environment variable; do not commit it to the repository.'
} else {
    Write-Host 'SONARQUBE_TOKEN found; pre-push can run the SonarCloud analysis.'
}
