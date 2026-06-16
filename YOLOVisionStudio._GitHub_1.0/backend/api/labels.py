from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.label_service import list_labels, create_label, update_label, delete_label, label_stats

router = APIRouter(prefix="/api/projects/{project_id}/labels", tags=["labels"])

class CreateLabelBody(BaseModel):
    name: str
    color: str = "#00FF00"

class UpdateLabelBody(BaseModel):
    name: str | None = None
    color: str | None = None


@router.get("/")
def _list_labels(project_id: int, db: Session = Depends(get_db)):
    labels = list_labels(db, project_id)
    return {
        "items": [{"id": l.id, "project_id": l.project_id, "name": l.name, "color": l.color, "created_at": l.created_at.isoformat() if l.created_at else ""} for l in labels],
        "total": len(labels),
    }


@router.post("/")
def _create_label(project_id: int, body: CreateLabelBody, db: Session = Depends(get_db)):
    label = create_label(db, project_id, name=body.name, color=body.color)
    return {"id": label.id, "project_id": label.project_id, "name": label.name, "color": label.color}


@router.put("/{label_id}")
def _update_label(project_id: int, label_id: int, body: UpdateLabelBody, db: Session = Depends(get_db)):
    label = update_label(db, label_id, name=body.name, color=body.color)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return {"id": label.id, "project_id": label.project_id, "name": label.name, "color": label.color}


@router.delete("/{label_id}")
def _delete_label(project_id: int, label_id: int, db: Session = Depends(get_db)):
    ok = delete_label(db, label_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Label not found")
    return {"status": "deleted"}


@router.get("/stats")
def _label_stats(project_id: int, db: Session = Depends(get_db)):
    return label_stats(db, project_id)
