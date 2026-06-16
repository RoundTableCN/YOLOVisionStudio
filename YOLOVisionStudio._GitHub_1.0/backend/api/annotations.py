from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.annotation_service import get_annotations, save_annotations, delete_annotation

router = APIRouter(prefix="/api/projects/{project_id}/annotations", tags=["annotations"])

class AnnotationItem(BaseModel):
    label_id: int
    x_center: float
    y_center: float
    width: float
    height: float

class SaveAnnotationsBody(BaseModel):
    image_id: int
    annotations: list[AnnotationItem]


@router.get("/")
def _get_annotations(project_id: int, image_id: int, db: Session = Depends(get_db)):
    annotations = get_annotations(db, image_id)
    items = [
        {
            "id": a.id,
            "image_id": a.image_id,
            "label_id": a.label_id,
            "x_center": a.x_center,
            "y_center": a.y_center,
            "width": a.width,
            "height": a.height,
        }
        for a in annotations
    ]
    return {"items": items}


@router.post("/")
def _save_annotations(project_id: int, body: SaveAnnotationsBody, db: Session = Depends(get_db)):
    annotations = save_annotations(db, body.image_id, [a.model_dump() for a in body.annotations])
    return {"saved": len(annotations)}


@router.delete("/{annotation_id}")
def _delete_annotation(project_id: int, annotation_id: int, db: Session = Depends(get_db)):
    ok = delete_annotation(db, annotation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"status": "deleted"}
