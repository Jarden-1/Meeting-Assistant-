$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$modelsRoot = Join-Path $root "funasr-runtime-resources\hf-models"

$repos = @(
  @{
    Name = "paraformer-offline"
    Url = "https://www.modelscope.cn/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch.git"
    Dir = Join-Path $modelsRoot "paraformer-zh"
  },
  @{
    Name = "paraformer-online"
    Url = "https://www.modelscope.cn/damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online.git"
    Dir = Join-Path $modelsRoot "paraformer-zh-streaming"
  },
  @{
    Name = "vad"
    Url = "https://www.modelscope.cn/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch.git"
    Dir = Join-Path $modelsRoot "fsmn-vad"
  },
  @{
    Name = "punc"
    # README 推荐的 ct-punc 会解析到通用大标点模型：
    # iic/punc_ct-transformer_cn-en-common-vocab471067-large
    # 不使用 zh-cn-common-vad_realtime-vocab272727；那个是实时小模型，标点质量明显较差。
    Url = "https://www.modelscope.cn/iic/punc_ct-transformer_cn-en-common-vocab471067-large.git"
    Dir = Join-Path $modelsRoot "ct-punc"
  },
  @{
    Name = "speaker-verification"
    Url = "https://www.modelscope.cn/iic/speech_campplus_sv_zh-cn_16k-common.git"
    Dir = Join-Path $modelsRoot "campplus"
  }
)

New-Item -ItemType Directory -Force -Path $modelsRoot | Out-Null

foreach ($repo in $repos) {
  if (Test-Path (Join-Path $repo.Dir ".git")) {
    Write-Host "Skip existing repo: $($repo.Name)"
    continue
  }

  if (Test-Path $repo.Dir) {
    Remove-Item -Recurse -Force $repo.Dir
  }

  Write-Host "Cloning $($repo.Name) ..."
  git clone $repo.Url $repo.Dir
}

Write-Host "FunASR model repositories are ready under: $modelsRoot"
