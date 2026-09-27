$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$prePushHook = Join-Path $repositoryRoot '.githooks\pre-push'

if (-not (Test-Path -LiteralPath $prePushHook -PathType Leaf)) {
    throw "Pre-push hook bulunamadı: $prePushHook"
}

git -C $repositoryRoot config --local core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    throw 'Git hooks yolu ayarlanamadı.'
}

git -C $repositoryRoot update-index --chmod=+x -- .githooks/pre-push
if ($LASTEXITCODE -ne 0) {
    throw 'Pre-push hook çalıştırılabilir olarak işaretlenemedi.'
}

$userToken = [Environment]::GetEnvironmentVariable('SONARQUBE_TOKEN', 'User')
$processToken = [Environment]::GetEnvironmentVariable('SONARQUBE_TOKEN', 'Process')

Write-Host 'Git hooks etkinleştirildi: .githooks'
if ([string]::IsNullOrWhiteSpace($userToken) -and [string]::IsNullOrWhiteSpace($processToken)) {
    Write-Warning 'SONARQUBE_TOKEN tanımlı değil. SonarCloud taraması pre-push sırasında atlanacaktır.'
    Write-Host 'Tokenı güvenli şekilde Windows User ortam değişkeni olarak tanımlayın; repoya yazmayın.'
} else {
    Write-Host 'SONARQUBE_TOKEN bulundu; pre-push SonarCloud taraması çalıştırabilir.'
}
