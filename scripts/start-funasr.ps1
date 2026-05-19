$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $root ".venv-funasr\Scripts\python.exe"
$serverScript = Join-Path $root "vendor\FunASR\runtime\python\websocket\funasr_wss_server.py"
$logFile = Join-Path $root "funasr-server.log"
$errorLogFile = Join-Path $root "funasr-server.err.log"
$modelsRoot = Join-Path $root "funasr-runtime-resources\hf-models"
$offlineModelDir = Join-Path $modelsRoot "paraformer-zh"
$puncModelDir = Join-Path $modelsRoot "ct-punc"
$svModelDir = Join-Path $modelsRoot "campplus"
$offlineSegmentsDir = Join-Path $root "funasr-offline-segments"

if (!(Test-Path $pythonExe)) {
  throw "FunASR Python environment not found: $pythonExe. Run scripts/setup-funasr.ps1 first."
}

if (!(Test-Path $serverScript)) {
  throw "FunASR server script not found: $serverScript"
}

$requiredModelDirs = @($offlineModelDir, $puncModelDir, $svModelDir)
foreach ($dir in $requiredModelDirs) {
  if (!(Test-Path $dir)) {
    throw "FunASR model directory not found: $dir. Run scripts/download-funasr-models.ps1 first."
  }
}

foreach ($module in @("torch", "torchaudio", "funasr", "modelscope", "websockets", "numpy", "scipy")) {
  & $pythonExe -W "ignore::SyntaxWarning" -c "import $module" 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Missing Python module '$module' in $pythonExe. Run scripts/setup-funasr.ps1 first."
  }
}

$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*funasr_wss_server.py*" } |
  Select-Object -ExpandProperty ProcessId -ErrorAction SilentlyContinue

foreach ($processId in $existing) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Wait-Process -Id $processId -Timeout 5 -ErrorAction SilentlyContinue
  } catch {
  }
}

foreach ($path in @($logFile, $errorLogFile)) {
  if (Test-Path $path) {
    for ($attempt = 0; $attempt -lt 5; $attempt += 1) {
      try {
        Remove-Item $path -Force -ErrorAction Stop
        break
      } catch {
        Start-Sleep -Milliseconds 300
      }
    }
  }
}

Start-Process `
  -FilePath $pythonExe `
  -ArgumentList @(
    "-u",
    $serverScript,
    "--host", "127.0.0.1",
    "--port", "10095",
    "--certfile", "0",
    "--ngpu", "0",
    "--device", "cpu",
    "--ncpu", "4",
    "--asr_model", $offlineModelDir,
    "--asr_model_online", "__disabled__",
    "--vad_model", "__disabled__",
    "--punc_model", $puncModelDir,
    "--sv_model", $svModelDir,
    "--worker_threads", "3",
    "--concurrent_vad", "1",
    "--concurrent_asr_online", "1",
    "--concurrent_asr_offline", "1",
    "--concurrent_punc", "1",
    "--concurrent_sv", "1",
    "--save_offline_segments",
    "--save_offline_segments_dir", $offlineSegmentsDir
  ) `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorLogFile `
  -WindowStyle Hidden

Write-Host "FunASR starting on ws://127.0.0.1:10095"
Write-Host "Log file: $logFile"
Write-Host "Error log: $errorLogFile"
