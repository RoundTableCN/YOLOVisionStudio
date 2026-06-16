from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from services.project_service import get_project
from services.dataset_service import import_images, list_images, get_image, delete_image, dataset_stats
from services.file_service import is_allowed_image

router = APIRouter(prefix="/api/projects/{project_id}/datasets", tags=["datasets"])


def _project_name(db: Session, project_id: int) -> str:
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.name


@router.get("/")
def _list_images(project_id: int, page: int = 1, page_size: int = 50, search: str = "", db: Session = Depends(get_db)):
    images, total = list_images(db, project_id, page=page, page_size=page_size, search=search)
    items = [
        {
            "id": img.id,
            "project_id": img.project_id,
            "filename": img.filename,
            "original_path": img.original_path,
            "thumbnail_path": img.thumbnail_path,
            "width": img.width,
            "height": img.height,
            "file_size": img.file_size,
            "imported_at": img.imported_at.isoformat() if img.imported_at else "",
        }
        for img in images
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/upload")
async def _upload_images(
    project_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    name = _project_name(db, project_id)
    file_data: list[tuple[str, bytes]] = []
    for f in files:
        if not f.filename or not is_allowed_image(f.filename):
            continue
        content = await f.read()
        file_data.append((f.filename, content))

    if not file_data:
        raise HTTPException(status_code=400, detail="No valid image files provided")

    images = import_images(db, project_id, name, file_data)
    return {"imported": len(images)}


@router.get("/images/{image_id}")
def _get_image(project_id: int, image_id: int, db: Session = Depends(get_db)):
    image = get_image(db, image_id)
    if not image or image.project_id != project_id:
        raise HTTPException(status_code=404, detail="Image not found")
    return {
        "id": image.id,
        "project_id": image.project_id,
        "filename": image.filename,
        "original_path": image.original_path,
        "thumbnail_path": image.thumbnail_path,
        "width": image.width,
        "height": image.height,
        "file_size": image.file_size,
        "imported_at": image.imported_at.isoformat() if image.imported_at else "",
    }


@router.delete("/images/{image_id}")
def _delete_image(project_id: int, image_id: int, db: Session = Depends(get_db)):
    image = get_image(db, image_id)
    if not image or image.project_id != project_id:
        raise HTTPException(status_code=404, detail="Image not found")
    delete_image(db, image_id)
    return {"status": "deleted"}


@router.get("/stats")
def _dataset_stats(project_id: int, db: Session = Depends(get_db)):
    return dataset_stats(db, project_id)
