import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from database import SessionLocal
from services.project_service import get_project
from services.training_service import (
    start_training, stop_training, get_training_status,
    get_metrics_queue, get_gpu_info,
)

router = APIRouter(prefix="/api/projects/{project_id}/train", tags=["train"])


class TrainParams(BaseModel):
    model: str = "yolov8n"
    epochs: int = 100
    batch_size: int = 16
    image_size: int = 640
    gpu_enabled: bool = True


@router.post("/start")
def _start_training(project_id: int, params: TrainParams):
    db = SessionLocal()
    try:
        project = get_project(db, project_id)
        if not project:
            return {"error": "Project not found"}
        name = project.name
    finally:
        db.close()
    return start_training(project_id, name, params.model_dump(), SessionLocal)


@router.post("/stop")
def _stop_training(project_id: int):
    return stop_training()


@router.get("/status")
def _training_status(project_id: int):
    status = get_training_status()
    status["gpu"] = get_gpu_info()
    return status


@router.websocket("/ws")
async def ws_training(websocket: WebSocket, project_id: int):
    await websocket.accept()
    queue = get_metrics_queue()
    try:
        while True:
            # Check for client messages
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                msg = json.loads(data)
                if msg.get("action") == "get_gpu":
                    gpu = get_gpu_info()
                    await websocket.send_json({"type": "gpu", **gpu})
            except asyncio.TimeoutError:
                pass

            # Drain metrics queue
            while queue and not queue.empty():
                try:
                    metric = queue.get_nowait()
                    await websocket.send_json(metric)
                except Exception:
                    break

            # Always send GPU info periodically
            gpu = get_gpu_info()
            await websocket.send_json({"type": "gpu", **gpu})

            await asyncio.sleep(1)

            # Check if training ended
            status = get_training_status()
            if status["status"] in ("completed", "failed", "stopped", "idle"):
                if status["status"] in ("completed", "failed", "stopped"):
                    await websocket.send_json({"type": "status", "status": status["status"]})
                    break

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
