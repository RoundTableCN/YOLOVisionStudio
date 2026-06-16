import os, time as _time
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db, BASE_DIR
from models.db_models import SystemConfig
from services.training_service import get_gpu_info

_last_heartbeat = 0.0

router = APIRouter(prefix="/api/system", tags=["system"])


class OpenFolderBody(BaseModel):
    path: str


@router.post("/open-folder")
def open_folder(body: OpenFolderBody):
    """Open a folder in Windows Explorer."""
    import subprocess
    p = os.path.normpath(body.path)
    if os.path.isdir(p):
        subprocess.Popen(["explorer", p])
        return {"status": "ok"}
    return {"status": "error", "message": f"Path not found: {p}"}


@router.get("/heartbeat")
def heartbeat():
    """Called periodically by frontend to signal browser is open."""
    global _last_heartbeat
    _last_heartbeat = _time.time()
    return {"alive": True}


@router.get("/last-heartbeat")
def last_heartbeat():
    """Returns seconds since last frontend heartbeat."""
    return {"seconds_ago": _time.time() - _last_heartbeat}


@router.get("/gpu")
def _gpu_info():
    return get_gpu_info()


@router.get("/cameras")
def list_cameras():
    """Fast camera detection using DSHOW (returns instantly for unavailable cameras)."""
    import cv2
    cameras = []
    seen = set()
    for i in range(8):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                h, w = frame.shape[:2]
                key = f"{w}x{h}"
                if key not in seen:
                    seen.add(key)
                    cameras.append({"id": i, "name": f"Camera {i} - {w}x{h}"})
            cap.release()
        else:
            cap.release()
    return {"cameras": cameras, "total": len(cameras)}


@router.get("/yolo-classes")
def yolo_classes():
    """Return COCO class names that YOLOv8 can detect (80 classes)."""
    classes = [
        "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
        "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
        "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
        "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
        "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
        "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
        "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
        "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
        "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
        "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
    ]
    return {"classes": [{"id": i, "name": name} for i, name in enumerate(classes)], "total": len(classes)}


@router.get("/logs")
def _system_logs(page: int = 1, page_size: int = 100):
    log_dir = os.path.join(BASE_DIR, "logs")
    logs = []
    if os.path.exists(log_dir):
        log_files = sorted([f for f in os.listdir(log_dir) if f.endswith(".log")], reverse=True)
        for lf in log_files[:10]:
            logs.append({"file": lf, "size": os.path.getsize(os.path.join(log_dir, lf))})
    return {"items": logs, "total": len(logs), "page": page, "page_size": page_size}


@router.post("/cache/clear")
def _clear_cache():
    """Clear model cache and temp files."""
    from services.inference_service import _model_cache
    _model_cache.clear()
    # Clean workspace outputs older than 7 days
    workspaces_dir = os.path.join(BASE_DIR, "workspaces")
    if os.path.exists(workspaces_dir):
        import time
        cutoff = time.time() - 7 * 86400
        for ws in os.listdir(workspaces_dir):
            outputs_dir = os.path.join(workspaces_dir, ws, "outputs")
            if os.path.exists(outputs_dir):
                for f in os.listdir(outputs_dir):
                    fp = os.path.join(outputs_dir, f)
                    try:
                        if os.path.getmtime(fp) < cutoff:
                            os.remove(fp)
                    except Exception:
                        pass
    return {"status": "cleared"}


@router.get("/config")
def _get_config(db: Session = Depends(get_db)):
    configs = db.query(SystemConfig).all()
    result = {}
    for c in configs:
        result[c.key] = c.value
    return result


class UpdateConfigBody(BaseModel):
    key: str
    value: str


@router.put("/config")
def _update_config(body: UpdateConfigBody, db: Session = Depends(get_db)):
    config = db.query(SystemConfig).filter(SystemConfig.key == body.key).first()
    if config:
        config.value = body.value
    else:
        config = SystemConfig(key=body.key, value=body.value)
        db.add(config)
    db.commit()
    return {"key": body.key, "value": body.value}
