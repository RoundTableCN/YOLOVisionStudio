import os
from sqlalchemy.orm import Session
from models.db_models import Project, Image, Label, Annotation
from services.file_service import save_upload, generate_thumbnail, delete_files


def import_images(db: Session, project_id: int, project_name: str, files: list[tuple[str, bytes]]) -> list[Image]:
    """files: list of (filename, file_bytes)"""
    images = []
    for filename, data in files:
        saved_path, width, height = save_upload(data, project_name, filename)
        file_size = os.path.getsize(saved_path)
        thumb_path = generate_thumbnail(saved_path, project_name, filename)

        image = Image(
            project_id=project_id,
            filename=filename,
            original_path=saved_path,
            thumbnail_path=thumb_path,
            width=width,
            height=height,
            file_size=file_size,
        )
        db.add(image)
        images.append(image)
    db.commit()
    for img in images:
        db.refresh(img)
    return images


def list_images(db: Session, project_id: int, page: int = 1, page_size: int = 50, search: str = "") -> tuple[list[Image], int]:
    q = db.query(Image).filter(Image.project_id == project_id)
    if search:
        q = q.filter(Image.filename.ilike(f"%{search}%"))
    total = q.count()
    images = q.order_by(Image.imported_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return images, total


def get_image(db: Session, image_id: int) -> Image | None:
    return db.query(Image).filter(Image.id == image_id).first()


def delete_image(db: Session, image_id: int) -> bool:
    image = get_image(db, image_id)
    if not image:
        return False
    delete_files(image.original_path, image.thumbnail_path)
    db.delete(image)
    db.commit()
    return True


def dataset_stats(db: Session, project_id: int) -> dict:
    image_count = db.query(Image).filter(Image.project_id == project_id).count()
    label_count = db.query(Label).filter(Label.project_id == project_id).count()
    annotation_count = db.query(Annotation).join(Image).filter(Image.project_id == project_id).count()
    return {
        "total_images": image_count,
        "total_labels": label_count,
        "total_annotations": annotation_count,
    }
