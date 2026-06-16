from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from services.project_service import get_project
from services.model_service import list_models, import_external_pt, delete_model, get_model_info, scan_workspace_models

router = APIRouter(prefix="/api/projects/{project_id}/models", tags=["models"])


@router.get("/")
def _list_models(project_id: int, db: Session = Depends(get_db)):
    models = list_models(db, project_id)
    items = [
        {"id": m.id, "project_id": m.project_id, "name": m.name, "path": m.path,
         "base_model": m.base_model, "is_trained": m.is_trained,
         "created_at": m.created_at.isoformat() if m.created_at else ""}
        for m in models
    ]
    return {"items": items, "total": len(items)}


@router.post("/import")
async def _import_model(
    project_id: int,
    name: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await file.read()
    filename = name or file.filename or "model.pt"
    model = import_external_pt(db, project_id, project.name, content, filename)
    return {"id": model.id, "name": model.name, "path": model.path}


@router.delete("/{model_id}")
def _delete_model(project_id: int, model_id: int, db: Session = Depends(get_db)):
    ok = delete_model(db, model_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"status": "deleted"}


@router.get("/{model_id}/info")
def _get_model_info(project_id: int, model_id: int):
    info = get_model_info(model_id)
    if not info.get("path"):
        raise HTTPException(status_code=404, detail="Model not found")
    return info


@router.get("/workspace/scan")
def _scan_workspace(project_id: int, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"files": scan_workspace_models(project.name)}
