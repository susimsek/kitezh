@echo off
setlocal

for /f "delims=" %%R in ('git rev-parse --show-toplevel 2^>nul') do set "REPOSITORY_ROOT=%%R"
if not defined REPOSITORY_ROOT (
  echo Git repository not found. 1>&2
  exit /b 1
)

git -C "%REPOSITORY_ROOT%" config --local core.hooksPath .githooks
if errorlevel 1 (
  echo Failed to configure the Git hooks path. 1>&2
  exit /b 1
)

echo Git hooks enabled: .githooks
endlocal
