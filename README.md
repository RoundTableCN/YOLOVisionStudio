# YOLOVision Studio

本地 YOLOv8 可视化训练与识别平台 —— 一个用于图像标注、YOLO 模型训练和实时目标检测推理的桌面应用，全部在本地运行。

Local YOLOv8 Visual Training & Recognition Platform — a desktop application for image annotation, YOLO model training, and real-time object detection inference, all running locally.

---

## Features / 功能

- **图像标注 / Image Annotation** — 在可视化画布上绘制边界框、分配标签、管理数据集
- **模型训练 / Model Training** — 使用可配置的超参数在自定义数据集上训练 YOLOv8 模型（nano/small/medium）
- **推理 / Inference** — 对图像和视频运行目标检测，实时查看标注结果
- **项目管理 / Project Management** — 管理多个项目，每个项目拥有独立的工作空间、数据集和模型
- **系统监控 / Dashboard** — 通过 NVIDIA pynvml 监控 GPU/CPU 系统资源

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|-----------|-------------------|
| Frontend / 前端 | React + TypeScript, Tailwind CSS, Fabric.js, Vite |
| Backend / 后端 | Python FastAPI, SQLAlchemy, SQLite |
| ML Engine / 机器学习 | Ultralytics YOLOv8, PyTorch, OpenCV |
| Desktop / 桌面 | Electron（可选外壳 / optional shell） |
| Real-time / 实时通信 | WebSocket（训练进度、系统状态） |

## Prerequisites / 环境要求

- **Python 3.11+** — 安装 `backend/requirements.txt` 中的依赖包
- **Node.js 18+** — 用于前端开发服务器
- **YOLO 模型权重** —— 下载链接见 [models/README.md](models/README.md)

## Quick Start / 快速开始

### 1. Clone & Install / 克隆并安装

```bash
git clone https://github.com/YOUR_USERNAME/yolovision-studio.git
cd yolovision-studio
```

### 2. Download Model Weights / 下载模型权重

```bash
# 下载链接见 models/README.md
cd models
# Windows PowerShell:
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt" -OutFile "yolov8n.pt"
# Linux & macOS:
# wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt
```

### 3. Install Python Dependencies / 安装 Python 依赖

```bash
pip install -r backend/requirements.txt
```

### 4. Launch / 启动

**Windows:**
```
START.bat
```

**Manual / 手动启动:**
```bash
# Terminal 1 — Backend / 后端
cd backend
uvicorn main:app --host 127.0.0.1 --port 8618

# Terminal 2 — Frontend / 前端
cd frontend
npx vite --port 5173
```

浏览器打开 / Open [http://127.0.0.1:5173](http://127.0.0.1:5173)。

## Project Structure / 项目结构

```
├── START.bat                # Windows 启动器 / Windows launcher
├── launcher.py              # 跨平台启动脚本 / Cross-platform launcher
├── package.json             # Electron 及开发脚本 / Electron & dev scripts
├── tsconfig.electron.json
├── electron/                # Electron 主进程 (TypeScript)
│   ├── main.ts
│   ├── preload.ts
│   └── python-manager.ts
├── frontend/                # React 单页应用 / React SPA
│   ├── src/
│   │   ├── components/      # FabricCanvas, LabelSidebar, ImageStrip, Layout
│   │   ├── pages/           # ProjectList, Dataset, Annotate, Train, Models, Inference, Settings
│   │   ├── hooks/           # useWebSocket
│   │   ├── api/             # API 客户端 / API client
│   │   └── types/           # TypeScript 类型定义 / TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── backend/                 # Python FastAPI 后端
│   ├── main.py              # 应用入口，CORS，生命周期
│   ├── database.py          # SQLAlchemy + SQLite 配置
│   ├── requirements.txt
│   ├── models/              # 数据库模型 (SQLAlchemy ORM)
│   ├── services/            # 业务逻辑层
│   └── api/                 # 路由处理
├── models/                  # YOLO 权重文件 (.pt) —— 需单独下载 / download separately
└── workspaces/              # 用户项目数据（已 gitignore）/ User project data (gitignored)
```

## Architecture / 架构

```
Browser (React) ──HTTP/WS──▶ FastAPI (Python) ──▶ SQLite
                    │
Electron Shell ─────┘ (可选 / optional, 内嵌浏览器并自动启动后端 / wraps browser + auto-starts backend)
```

后端运行在 `127.0.0.1:8618`。前端开发服务器运行在 `127.0.0.1:5173`，通过 Vite 代理 API 请求。

The backend runs on `127.0.0.1:8618`. The frontend dev server runs on `127.0.0.1:5173` and proxies API calls via Vite.

## License / 许可证

MIT
