import os
import threading
import queue
import time
from datetime import datetime
from sqlalchemy.orm import Session

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")

_training_lock = threading.Lock()
_current_job: dict | None = None
_metrics_queue: queue.Queue | None = None
_stop_flag = threading.Event()

YOLO_MODELS = {
    "yolov8n": "yolov8n.pt",
    "yolov8s": "yolov8s.pt",
    "yolov8m": "yolov8m.pt",
}


def _safe_project_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "_- " else "_" for c in name).strip().replace(" ", "_").lower()


def get_gpu_info() -> dict:
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        name = pynvml.nvmlDeviceGetName(handle)
        temp = None
        try:
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        except Exception:
            pass
        return {
            "available": True,
            "name": name.decode() if isinstance(name, bytes) else name,
            "memory_total_mb": info.total // (1024 * 1024),
            "memory_used_mb": info.used // (1024 * 1024),
            "utilization_pct": util.gpu,
            "temperature_c": temp,
        }
    except Exception:
        return {
            "available": False,
            "name": None,
            "memory_total_mb": None,
            "memory_used_mb": None,
            "utilization_pct": None,
            "temperature_c": None,
        }


def _generate_yaml(project_id: int, project_name: str, db: Session) -> str:
    """Generate YOLO dataset YAML and export labels to txt files. Returns yaml path."""
    from models.db_models import Image, Label, Annotation

    safe_name = _safe_project_name(project_name)
    ws = os.path.join(WORKSPACES_DIR, safe_name)

    train_images_dir = os.path.join(ws, "outputs", "train_images")
    train_labels_dir = os.path.join(ws, "outputs", "train_labels")
    os.makedirs(train_images_dir, exist_ok=True)
    os.makedirs(train_labels_dir, exist_ok=True)

    labels = db.query(Label).filter(Label.project_id == project_id).order_by(Label.id.asc()).all()
    class_names = [l.name for l in labels]

    images = db.query(Image).filter(Image.project_id == project_id).all()

    for img in images:
        src = img.original_path
        dst = os.path.join(train_images_dir, img.filename)
        if os.path.exists(src) and not os.path.exists(dst):
            try:
                if os.path.getsize(src) < 100 * 1024 * 1024:
                    import shutil
                    shutil.copy2(src, dst)
            except Exception:
                pass

        annotations = db.query(Annotation).filter(Annotation.image_id == img.id).all()
        txt_name = os.path.splitext(img.filename)[0] + ".txt"
        txt_path = os.path.join(train_labels_dir, txt_name)
        with open(txt_path, "w") as f:
            for ann in annotations:
                label_idx = ann.label_id - labels[0].id if labels else ann.label_id - 1
                f.write(f"{max(0, label_idx)} {ann.x_center:.6f} {ann.y_center:.6f} {ann.width:.6f} {ann.height:.6f}\n")

    yaml_path = os.path.join(ws, "outputs", "data.yaml")
    yaml_content = {
        "path": ws.replace("\\", "/"),
        "train": train_images_dir.replace("\\", "/"),
        "val": train_images_dir.replace("\\", "/"),
        "nc": len(class_names),
        "names": class_names,
    }
    import yaml as _yaml
    with open(yaml_path, "w") as f:
        _yaml.dump(yaml_content, f, default_flow_style=False)

    return yaml_path


def _on_fit_epoch_end(trainer):
    global _metrics_queue
    if _metrics_queue is None:
        return
    try:
        m = trainer.metrics
        metrics = {
            "type": "epoch",
            "epoch": trainer.epoch + 1,
            "total_epochs": trainer.epochs,
            "loss": round(float(m.get("train/loss", 0)), 4),
            "mAP50": round(float(m.get("metrics/mAP50(B)", 0)), 4),
            "mAP50_95": round(float(m.get("metrics/mAP50-95(B)", 0)), 4),
            "precision": round(float(m.get("metrics/precision(B)", 0)), 4),
            "recall": round(float(m.get("metrics/recall(B)", 0)), 4),
        }
        _metrics_queue.put(metrics)
    except Exception:
        pass


def _train_thread(target: dict, db_session_factory):
    global _current_job, _stop_flag, _metrics_queue
    from ultralytics import YOLO

    _stop_flag.clear()
    project_id = target["project_id"]
    model_name = target["model"]
    epochs = target["epochs"]
    batch = target["batch_size"]
    imgsz = target["image_size"]
    gpu = target["gpu_enabled"]

    try:
        _current_job["status"] = "running"
        _metrics_queue.put({"type": "status", "status": "preparing", "message": "Exporting dataset..."})

        db = db_session_factory()
        yaml_path = _generate_yaml(project_id, target["project_name"], db)
        db.close()

        _metrics_queue.put({"type": "status", "status": "training", "message": f"Training on {yaml_path}"})

        device = 0 if gpu else "cpu"
        model = YOLO(YOLO_MODELS.get(model_name, "yolov8n.pt"))
        model.add_callback("on_fit_epoch_end", _on_fit_epoch_end)

        results = model.train(
            data=yaml_path,
            epochs=epochs,
            batch=batch,
            imgsz=imgsz,
            device=device,
            workers=0,
            verbose=False,
        )

        safe_name = _safe_project_name(target["project_name"])
        model_dir = os.path.join(WORKSPACES_DIR, safe_name, "models")
        os.makedirs(model_dir, exist_ok=True)
        best_path = os.path.join(model_dir, f"best_{model_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pt")
        model.save(best_path)

        _current_job["status"] = "completed"
        _current_job["model_path"] = best_path
        mAP50 = round(float(results.results_dict.get("metrics/mAP50(B)", 0)), 4) if hasattr(results, "results_dict") else 0
        mAP50_95 = round(float(results.results_dict.get("metrics/mAP50-95(B)", 0)), 4) if hasattr(results, "results_dict") else 0
        _metrics_queue.put({
            "type": "status",
            "status": "completed",
            "message": "Training completed",
            "model_path": best_path,
            "mAP50": mAP50,
            "mAP50_95": mAP50_95,
        })

    except Exception as e:
        _current_job["status"] = "failed"
        _current_job["error"] = str(e)
        _metrics_queue.put({"type": "status", "status": "failed", "message": str(e)})


def start_training(project_id: int, project_name: str, params: dict, db_session_factory) -> dict:
    global _current_job, _metrics_queue, _stop_flag

    with _training_lock:
        if _current_job and _current_job.get("status") == "running":
            return {"error": "Training already in progress"}

        _metrics_queue = queue.Queue()
        _current_job = {
            "project_id": project_id,
            "project_name": project_name,
            "status": "starting",
            "params": params,
            "started_at": datetime.utcnow().isoformat(),
        }

        target = {
            "project_id": project_id,
            "project_name": project_name,
            "model": params.get("model", "yolov8n"),
            "epochs": params.get("epochs", 100),
            "batch_size": params.get("batch_size", 16),
            "image_size": params.get("image_size", 640),
            "gpu_enabled": params.get("gpu_enabled", True),
        }

        thread = threading.Thread(target=_train_thread, args=(target, db_session_factory), daemon=True)
        thread.start()
        _current_job["thread"] = thread

        _metrics_queue.put({"type": "status", "status": "starting", "message": "Initializing..."})
        return {"status": "started", "project_id": project_id}


def stop_training() -> dict:
    global _current_job, _stop_flag
    if not _current_job or _current_job.get("status") != "running":
        return {"error": "No training in progress"}
    _stop_flag.set()
    _current_job["status"] = "stopped"
    if _metrics_queue:
        _metrics_queue.put({"type": "status", "status": "stopped", "message": "Training stopped by user"})
    return {"status": "stopped"}


def get_training_status() -> dict:
    global _current_job
    if not _current_job:
        return {"status": "idle"}
    return {"status": _current_job.get("status", "unknown"), "params": _current_job.get("params"), "started_at": _current_job.get("started_at")}


def get_metrics_queue() -> queue.Queue | None:
    global _metrics_queue
    return _metrics_queue
