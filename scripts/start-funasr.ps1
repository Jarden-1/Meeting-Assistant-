$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pythonExe = "D:\conda\envs\funasr310\python.exe"
$serverScript = Join-Path $root "vendor\FunASR\runtime\python\websocket\funasr_wss_server.py"
$logFile = Join-Path $root "funasr-server.log"
$errorLogFile = Join-Path $root "funasr-server.err.log"
$modelsRoot = Join-Path $root "funasr-runtime-resources\hf-models"
$offlineModelDir = Join-Path $modelsRoot "paraformer-zh"
$onlineModelDir = Join-Path $modelsRoot "paraformer-zh-streaming"
$vadModelDir = Join-Path $modelsRoot "fsmn-vad"
$puncModelDir = Join-Path $modelsRoot "ct-punc"
$svModelDir = Join-Path $modelsRoot "campplus"

if (!(Test-Path $pythonExe)) {
  throw "FunASR Python environment not found: $pythonExe"
}

if (!(Test-Path $serverScript)) {
  throw "FunASR server script not found: $serverScript"
}

$requiredModelDirs = @($offlineModelDir, $onlineModelDir, $vadModelDir, $puncModelDir, $svModelDir)
foreach ($dir in $requiredModelDirs) {
  if (!(Test-Path $dir)) {
    throw "FunASR model directory not found: $dir. Run scripts/download-funasr-models.ps1 first."
  }
}

$existing = Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*funasr_wss_server.py*" } |
  Select-Object -ExpandProperty ProcessId -ErrorAction SilentlyContinue

foreach ($processId in $existing) {
  try {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  } catch {
  }
}

if (Test-Path $logFile) {
  Remove-Item $logFile -Force
}
if (Test-Path $errorLogFile) {
  Remove-Item $errorLogFile -Force
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
    "--asr_model_online", $onlineModelDir,
    "--vad_model", $vadModelDir,
    "--punc_model", $puncModelDir,
    "--sv_model", $svModelDir
  ) `
  -RedirectStandardOutput $logFile `
  -RedirectStandardError $errorLogFile `
  -WindowStyle Hidden

Write-Host "FunASR starting on ws://127.0.0.1:10095"
Write-Host "Log file: $logFile"
Write-Host "Error log: $errorLogFile"
