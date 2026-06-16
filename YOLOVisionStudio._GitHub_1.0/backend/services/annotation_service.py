from sqlalchemy.orm import Session
from models.db_models import Annotation


def get_annotations(db: Session, image_id: int) -> list[Annotation]:
    return db.query(Annotation).filter(Annotation.image_id == image_id).all()


def save_annotations(db: Session, image_id: int, annotations_data: list[dict]) -> list[Annotation]:
    """annotations_data: [{"label_id": 1, "x_center": 0.5, "y_center": 0.5, "width": 0.3, "height": 0.2}, ...]"""
    db.query(Annotation).filter(Annotation.image_id == image_id).delete()
    new_annotations = []
    for ad in annotations_data:
        ann = Annotation(
            image_id=image_id,
            label_id=ad["label_id"],
            x_center=ad["x_center"],
            y_center=ad["y_center"],
            width=ad["width"],
            height=ad["height"],
        )
        db.add(ann)
        new_annotations.append(ann)
    db.commit()
    for ann in new_annotations:
        db.refresh(ann)
    return new_annotations


def delete_annotation(db: Session, annotation_id: int) -> bool:
    ann = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not ann:
        return False
    db.delete(ann)
    db.commit()
    return True
