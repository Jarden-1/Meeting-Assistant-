# Meeting Assistant

NestJS API + Vite React frontend.

## 一行启动

首次使用先安装依赖：

```bash
npm install
npm run install:all
npm run db:setup
```

之后在项目根目录一行启动前后端：

```bash
npm run dev
```

- Web: http://127.0.0.1:5173/
- API health: http://127.0.0.1:3001/api/v1/health

本地 FunASR 是可选能力；需要实时本地转写时：

```powershell
# 第一次安装 Python 依赖（会下载 PyTorch/FunASR，较慢）
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/setup-funasr.ps1

# 之后启动本地转写服务
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-funasr.ps1
```
