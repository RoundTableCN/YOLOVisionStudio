from sqlalchemy.orm import Session
from models.db_models import Label, Annotation


def list_labels(db: Session, project_id: int) -> list[Label]:
    return db.query(Label).filter(Label.project_id == project_id).order_by(Label.created_at.asc()).all()


def create_label(db: Session, project_id: int, name: str, color: str = "#00FF00") -> Label:
    label = Label(project_id=project_id, name=name, color=color)
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


def update_label(db: Session, label_id: int, name: str = None, color: str = None) -> Label | None:
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        return None
    if name is not None:
        label.name = name
    if color is not None:
        label.color = color
    db.commit()
    db.refresh(label)
    return label


def delete_label(db: Session, label_id: int) -> bool:
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        return False
    db.delete(label)
    db.commit()
    return True


def label_stats(db: Session, project_id: int) -> dict:
    labels = db.query(Label).filter(Label.project_id == project_id).all()
    result = []
    for label in labels:
        count = db.query(Annotation).filter(Annotation.label_id == label.id).count()
        result.append({
            "id": label.id,
            "name": label.name,
            "color": label.color,
            "annotation_count": count,
        })
    return {"labels": result, "total_labels": len(labels)}
