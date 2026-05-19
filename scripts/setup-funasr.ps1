$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $root ".venv-funasr\Scripts\python.exe"
$requirementsFile = Join-Path $PSScriptRoot "funasr-requirements.txt"

if (!(Test-Path $pythonExe)) {
  Write-Host "Creating FunASR Python environment: $root\.venv-funasr"
  uv venv --python 3.12 (Join-Path $root ".venv-funasr")
}

Write-Host "Installing PyTorch CPU packages ..."
uv pip install --python $pythonExe torch torchaudio --index-url https://download.pytorch.org/whl/cpu

Write-Host "Installing FunASR runtime packages ..."
uv pip install --python $pythonExe -r $requirementsFile

Write-Host "FunASR environment is ready: $pythonExe"
