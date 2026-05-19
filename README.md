# Meeting Assistant

NestJS API + Vite React frontend.

## 一行启动

首次使用先安装依赖：

```bash
pnpm install
pnpm db:up
pnpm db:setup
```

之后在项目根目录一行启动前后端：

```bash
pnpm dev
```

- Web: http://127.0.0.1:5173/
- API health: http://127.0.0.1:3001/api/v1/health

## 本地实时转写（可选）

本地实时转写使用 FunASR 官方 Runtime SDK Docker 服务。Meeting Assistant 只作为 websocket client 连接该服务；项目不 vendoring FunASR 源码，不维护自写 FunASR bridge，也不使用浏览器语音识别降级。

启动前需要先运行 Docker Desktop。

```bash
pnpm db:up
pnpm funasr:up
pnpm dev
```

默认服务地址为 `ws://127.0.0.1:10095`，可通过 Web 端环境变量 `VITE_FUNASR_WS_URL` 调整。首次启动会下载官方 ONNX 模型到 `funasr-runtime-resources/models/`。

```bash
pnpm funasr:logs
pnpm funasr:down
```

Docker 服务使用官方实时 2pass 组合：

- `damo/speech_fsmn_vad_zh-cn-16k-common-onnx`
- `damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-onnx`
- `damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online-onnx`
- `damo/punc_ct-transformer_zh-cn-common-vad_realtime-vocab272727-onnx`
- `damo/speech_ngram_lm_zh-cn-ai-wesp-fst`
- `thuduj12/fst_itn_zh`
