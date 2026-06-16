import asyncio
import json
import os
from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, Form
from fastapi.responses import FileResponse
from services.project_service import get_project
from database import SessionLocal
from services.inference_service import infer_image, infer_video, infer_camera_stream, _video_jobs

router = APIRouter(prefix="/api/inference", tags=["inference"])


def _get_project_name(project_id: int) -> str:
    db = SessionLocal()
    try:
        project = get_project(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project.name
    finally:
        db.close()


@router.post("/image")
async def infer_image_endpoint(
    project_id: int = Form(...),
    model_name: str = Form("yolov8n"),
    class_ids: str = Form(""),
    file: UploadFile = File(...),
):
    name = _get_project_name(project_id)
    content = await file.read()
    ids = [int(x) for x in class_ids.split(",") if x] if class_ids else None
    result = infer_image(name, content, model_name, ids)
    return {
        "detections": result["detections"],
        "annotated_path": result["annotated_path"],
        "image_width": result["image_width"],
        "image_height": result["image_height"],
    }


@router.post("/video")
async def infer_video_endpoint(
    project_id: int = Form(...),
    model_name: str = Form("yolov8n"),
    class_ids: str = Form(""),
    file: UploadFile = File(...),
):
    name = _get_project_name(project_id)
    content = await file.read()
    ids = [int(x) for x in class_ids.split(",") if x] if class_ids else None
    job = infer_video(name, content, model_name, ids)
    return {"task_id": job["task_id"]}


@router.websocket("/ws/video/{task_id}")
async def ws_video_progress(websocket: WebSocket, task_id: str):
    await websocket.accept()
    q = _video_jobs.get(task_id)
    if not q:
        await websocket.send_json({"type": "error", "message": "Task not found"})
        await websocket.close()
        return
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
            while not q.empty():
                try:
                    msg = q.get_nowait()
                    await websocket.send_json(msg)
                    if msg.get("type") in ("complete", "error"):
                        return
                except Exception:
                    break
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/camera")
async def ws_camera_stream(websocket: WebSocket):
    await websocket.accept()

    # Read query params manually from the WebSocket URL
    qp = websocket.url.query if hasattr(websocket.url, 'query') else ""
    params = {}
    for part in qp.split("&"):
        if "=" in part:
            k, v = part.split("=", 1)
            params[k] = v

    project_id = int(params.get("project_id", 0))
    camera_id = int(params.get("camera_id", 0))
    model_name = params.get("model_name", "yolov8n")

    if not project_id:
        await websocket.send_json({"type": "error", "message": "project_id required"})
        await websocket.close()
        return

    # Send acknowledgment immediately before heavy loading
    await websocket.send_json({"type": "status", "status": "loading", "message": "Loading model and opening camera..."})

    try:
        name = _get_project_name(project_id)
    except HTTPException as e:
        await websocket.send_json({"type": "error", "message": str(e.detail)})
        await websocket.close()
        return

    # Mutable filter state shared with generator
    filter_state = {"enabled": None}  # None = all enabled

    stream = infer_camera_stream(camera_id, name, model_name, filter_state)
    first = next(stream)
    if isinstance(first, dict) and first.get("type") == "error":
        await websocket.send_json(first)
        await websocket.close()
        return

    try:
        await websocket.send_json(first)
        for data in stream:
            try:
                incoming = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                msg = json.loads(incoming)
                if msg.get("action") == "stop":
                    break
                elif msg.get("action") == "filter":
                    ids = msg.get("class_ids", [])
                    filter_state["enabled"] = set(ids) if ids else None
            except asyncio.TimeoutError:
                pass
            await websocket.send_json(data)
            # No sleep — push frames as fast as possible
    except WebSocketDisconnect:
        pass
    except Exception:
        pass


@router.get("/annotated/{file_path:path}")
def serve_annotated(file_path: str):
    # Normalize Windows paths
    fp = file_path.replace("/", os.sep)
    if not os.path.exists(fp):
        # Try with different path format
        if os.path.exists(file_path):
            fp = file_path
        else:
            raise HTTPException(status_code=404, detail="File not found")
    # Set proper MIME for video files
    media_type = None
    if fp.endswith(".mp4"):
        media_type = "video/mp4"
    elif fp.endswith(".avi"):
        media_type = "video/x-msvideo"
    elif fp.endswith(".mov"):
        media_type = "video/quicktime"
    return FileResponse(fp, media_type=media_type)
