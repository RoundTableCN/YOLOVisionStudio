from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from api.projects import router as projects_router
from api.datasets import router as datasets_router
from api.labels import router as labels_router
from api.annotations import router as annotations_router
from api.models import router as models_router
from api.train import router as train_router
from api.inference import router as inference_router
from api.system import router as system_router
from fastapi.responses import FileResponse
import os as _os


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="YOLOVision Studio API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(datasets_router)
app.include_router(labels_router)
app.include_router(annotations_router)
app.include_router(models_router)
app.include_router(train_router)
app.include_router(inference_router)
app.include_router(system_router)


@app.get("/api/thumbnail/{file_path:path}")
def serve_file(file_path: str):
    if not _os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/api/image/{file_path:path}")
def serve_image(file_path: str):
    if not _os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
