@echo off
setlocal

for /f "delims=" %%R in ('git rev-parse --show-toplevel 2^>nul') do set "REPOSITORY_ROOT=%%R"
if not defined REPOSITORY_ROOT (
  echo Git repository bulunamadı. 1>&2
  exit /b 1
)

git -C "%REPOSITORY_ROOT%" config --local core.hooksPath .githooks
if errorlevel 1 (
  echo Git hooks yolu ayarlanamadı. 1>&2
  exit /b 1
)

echo Git hooks etkinleştirildi: .githooks
endlocal
