# YOLO Model Files / YOLO 模型文件

下载 YOLOv8 模型权重文件并放入此目录。

Download the YOLOv8 model weights and place them in this directory.

---

## Required Models / 所需模型

| Model | File | Size / 大小 | Download / 下载 |
|-------|------|-------------|-----------------|
| YOLOv8 Nano | `yolov8n.pt` | ~6.5 MB | [下载 / Download](https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt) |
| YOLOv8 Small | `yolov8s.pt` | ~22.6 MB | [下载 / Download](https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s.pt) |
| YOLOv8 Medium | `yolov8m.pt` | ~52.1 MB | [下载 / Download](https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m.pt) |

## Quick Download / 快速下载

**PowerShell / Windows:**

```powershell
cd models
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt" -OutFile "yolov8n.pt"
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s.pt" -OutFile "yolov8s.pt"
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m.pt" -OutFile "yolov8m.pt"
```

**wget / Linux & macOS:**

```bash
cd models
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8n.pt
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8s.pt
wget https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m.pt
```

---

放入模型文件后，应用会自动识别此目录中的模型。

The app will auto-detect models placed in this folder.
