import os
import cv2
import threading
import queue
import uuid
import base64

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")
MODELS_DIR = os.path.join(BASE_DIR, "models")

_model_cache = {}
_model_lock = threading.Lock()
_video_jobs: dict[str, queue.Queue] = {}

# YOLO-style class colors (bright, distinct)
_CLASS_COLORS = [
    (0, 0, 255), (0, 255, 0), (255, 0, 0), (0, 255, 255), (255, 255, 0),
    (255, 0, 255), (128, 0, 255), (255, 128, 0), (0, 128, 255), (128, 255, 0),
    (255, 0, 128), (0, 255, 128), (128, 128, 255), (255, 128, 128), (128, 255, 128),
    (255, 128, 255), (128, 255, 255), (255, 255, 128), (0, 128, 128), (128, 0, 0),
]


def _class_color(cls_id: int) -> tuple:
    return _CLASS_COLORS[cls_id % len(_CLASS_COLORS)]
_model_available = None  # None=unchecked, True/False


def _safe_project_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "_- " else "_" for c in name).strip().replace(" ", "_").lower()


def get_model(project_name: str, model_name: str = None):
    """Get or load a YOLO model. Returns model or None if unavailable."""
    global _model_available
    from ultralytics import YOLO

    cache_key = f"{project_name}:{model_name or 'best'}"
    with _model_lock:
        if cache_key in _model_cache:
            return _model_cache[cache_key]

    safe_name = _safe_project_name(project_name)

    # Priority 1: workspace trained model
    model_dir = os.path.join(WORKSPACES_DIR, safe_name, "models")
    pt_files = []
    if os.path.exists(model_dir):
        pt_files = sorted(
            [f for f in os.listdir(model_dir) if f.endswith(".pt")],
            key=lambda x: os.path.getmtime(os.path.join(model_dir, x)),
            reverse=True,
        )

    # Priority 2: project-level models dir
    if not pt_files and os.path.exists(MODELS_DIR):
        pt_files = sorted(
            [f for f in os.listdir(MODELS_DIR) if f.endswith(".pt")],
            key=lambda x: os.path.getmtime(os.path.join(MODELS_DIR, x)),
            reverse=True,
        )
    if pt_files:
        model_path = os.path.join(MODELS_DIR if not os.path.exists(os.path.join(WORKSPACES_DIR, safe_name, "models")) or not os.listdir(os.path.join(WORKSPACES_DIR, safe_name, "models")) else os.path.join(WORKSPACES_DIR, safe_name, "models"), pt_files[0])
    else:
        model_path = f"{model_name or 'yolov8n'}.pt"

    try:
        model = YOLO(model_path, verbose=False)
        # Enable FP16 for 2-3x speedup on NVIDIA GPUs
        import torch
        if torch.cuda.is_available():
            try:
                model.model.half()
            except Exception:
                pass  # Some models don't support half precision
        _model_available = True
        _model_cache[cache_key] = model
        return model
    except Exception:
        _model_available = False
        return None


def _draw_annotations(image, boxes, model, enabled_classes: set = None):
    """Draw YOLO-style bounding boxes on image. Filters by enabled_classes if provided."""
    annotated = image.copy()
    if boxes is None:
        return annotated
    for box in boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])
        if enabled_classes is not None and cls_id not in enabled_classes:
            continue
        cls_name = model.names.get(cls_id, str(cls_id)) if hasattr(model, 'names') else str(cls_id)
        color = _class_color(cls_id)
        cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
        label = f"{cls_name} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (int(x1), int(y1)-th-4), (int(x1)+tw+4, int(y1)), color, -1)
        cv2.putText(annotated, label, (int(x1)+2, int(y1)-4),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
    return annotated


def infer_image(project_name: str, image_bytes: bytes, model_name: str = None, class_ids: list = None) -> dict:
    """Run inference on a single image. Optionally filter by class_ids."""
    model = get_model(project_name, model_name)

    safe_name = _safe_project_name(project_name)
    outputs_dir = os.path.join(WORKSPACES_DIR, safe_name, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    input_path = os.path.join(outputs_dir, f"infer_{uuid.uuid4().hex}.jpg")
    with open(input_path, "wb") as f:
        f.write(image_bytes)

    results = model.predict(input_path, verbose=False, imgsz=640, half=True)
    result = results[0]

    enabled = set(class_ids) if class_ids else None
    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            if enabled is not None and cls_id not in enabled:
                continue
            cls_name = model.names.get(cls_id, str(cls_id)) if hasattr(model, 'names') else str(cls_id)
            detections.append({
                "x1": round(x1, 1),
                "y1": round(y1, 1),
                "x2": round(x2, 1),
                "y2": round(y2, 1),
                "class_name": cls_name,
                "confidence": round(conf, 4),
            })

    annotated = _draw_annotations(result.orig_img, result.boxes, model, enabled)
    output_path = os.path.join(outputs_dir, f"annotated_{uuid.uuid4().hex}.jpg")
    cv2.imwrite(output_path, annotated)

    return {
        "detections": detections,
        "annotated_path": output_path,
        "image_width": result.orig_shape[1],
        "image_height": result.orig_shape[0],
    }


def infer_video(project_name: str, video_bytes: bytes, model_name: str = None, class_ids: list = None) -> dict:
    """Start video inference in background thread. Returns task_id immediately."""
    global _video_jobs
    task_id = uuid.uuid4().hex
    safe_name = _safe_project_name(project_name)
    outputs_dir = os.path.join(WORKSPACES_DIR, safe_name, "outputs")
    os.makedirs(outputs_dir, exist_ok=True)

    input_path = os.path.join(outputs_dir, f"video_in_{task_id}.mp4")
    with open(input_path, "wb") as f:
        f.write(video_bytes)

    output_path = os.path.join(outputs_dir, f"video_out_{task_id}.mp4")
    progress_queue = queue.Queue()
    _video_jobs[task_id] = progress_queue
    enabled = set(class_ids) if class_ids else None

    def _process():
        try:
            model = get_model(project_name, model_name)
            cap = cv2.VideoCapture(input_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            frame_idx = 0
            tick_start = cv2.getTickCount()
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                results = model.predict(frame, verbose=False, imgsz=416, half=True)
                annotated = _draw_annotations(results[0].orig_img, results[0].boxes, model, enabled)
                out.write(annotated)
                frame_idx += 1
                if frame_idx % 5 == 0 or frame_idx == 1:
                    elapsed = (cv2.getTickCount() - tick_start) / cv2.getTickFrequency()
                    progress_queue.put({
                        "type": "progress",
                        "frame": frame_idx,
                        "total": total_frames,
                        "fps_processing": round(frame_idx / elapsed, 1) if elapsed > 0 else 0,
                    })

            cap.release()
            out.release()
            progress_queue.put({
                "type": "complete",
                "output_path": output_path,
                "total_frames": frame_idx,
            })
        except Exception as e:
            progress_queue.put({"type": "error", "message": str(e)})

    thread = threading.Thread(target=_process, daemon=True)
    thread.start()

    return {"task_id": task_id}


def infer_camera_stream(camera_id: int, project_name: str, model_name: str = None, filter_state: dict = None):
    """Generator yielding frames. filter_state: {"enabled": set|None} for live class filter.
    Uses background thread for non-blocking camera capture."""
    import threading as _thr

    # Open camera
    cap = cv2.VideoCapture(camera_id, cv2.CAP_ANY)
    if not cap.isOpened():
        cap = cv2.VideoCapture(camera_id, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(camera_id)

    if not cap.isOpened():
        yield {"type": "error", "message": f"Cannot open camera {camera_id}"}
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    # Load model
    model = get_model(project_name, model_name)

    # Thread-safe frame queue and stop flag
    frame_queue = queue.Queue(maxsize=2)
    stop_event = _thr.Event()
    read_error = [None]

    def capture_thread():
        try:
            while not stop_event.is_set():
                ret, frame = cap.read()
                if not ret:
                    read_error[0] = "Camera read failed"
                    break
                # Drop old frame if queue full (non-blocking put)
                try:
                    frame_queue.put(frame, timeout=0.1)
                except Exception:
                    while not frame_queue.empty():
                        try:
                            frame_queue.get_nowait()
                        except Exception:
                            break
        except Exception as e:
            read_error[0] = str(e)

    thread = _thr.Thread(target=capture_thread, daemon=True)
    thread.start()

    frame_count = 0
    start_time = None

    try:
        while not stop_event.is_set():
            try:
                frame = frame_queue.get(timeout=5)
            except Exception:
                if read_error[0]:
                    break
                continue

            if read_error[0]:
                break

            frame_count += 1

            if model is not None:
                results = model.predict(frame, verbose=False, imgsz=320, half=True, conf=0.25)
                annotated = frame.copy()
                detections = []

                if results[0].boxes is not None:
                    for box in results[0].boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        cls_id = int(box.cls[0])
                        cls_name = model.names.get(cls_id, str(cls_id)) if hasattr(model, 'names') else str(cls_id)

                        detections.append({
                            "x1": round(x1, 1), "y1": round(y1, 1),
                            "x2": round(x2, 1), "y2": round(y2, 1),
                            "class_name": cls_name, "confidence": round(conf, 4),
                            "class_id": cls_id,
                        })

                        # Draw YOLO-style annotation if class is enabled
                        enabled = filter_state["enabled"] if filter_state else None
                        if enabled is not None and cls_id not in enabled:
                            continue

                        color = _class_color(cls_id)
                        cv2.rectangle(annotated, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                        label = f"{cls_name} {conf:.2f}"
                        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                        cv2.rectangle(annotated, (int(x1), int(y1)-th-4), (int(x1)+tw+4, int(y1)), color, -1)
                        cv2.putText(annotated, label, (int(x1)+2, int(y1)-4),
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
            else:
                annotated = frame
                detections = []

            _, buffer = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 50])
            frame_b64 = base64.b64encode(buffer).decode("utf-8")

            if start_time is None:
                start_time = cv2.getTickCount()
                frame_count = 0
            elapsed = (cv2.getTickCount() - start_time) / cv2.getTickFrequency()
            current_fps = frame_count / elapsed if elapsed > 0 else 0

            yield {
                "frame": frame_b64,
                "detections": detections,
                "fps": round(current_fps, 1),
                "model_available": model is not None,
            }

    finally:
        stop_event.set()
        thread.join(timeout=3)
        cap.release()
