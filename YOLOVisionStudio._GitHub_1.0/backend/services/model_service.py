import os
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from models.db_models import Model


BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")


def _safe_project_name(name: str) -> str:
    return "".join(c if c.isalnum() or c in "_- " else "_" for c in name).strip().replace(" ", "_").lower()


def scan_workspace_models(project_name: str) -> list[dict]:
    """Scan workspace models dir for .pt files not yet in DB."""
    safe_name = _safe_project_name(project_name)
    model_dir = os.path.join(WORKSPACES_DIR, safe_name, "models")
    if not os.path.exists(model_dir):
        return []
    models = []
    for f in os.listdir(model_dir):
        if f.endswith(".pt"):
            full_path = os.path.join(model_dir, f)
            stat = os.stat(full_path)
            models.append({
                "name": f,
                "path": full_path,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    return sorted(models, key=lambda m: m["modified_at"], reverse=True)


def list_models(db: Session, project_id: int) -> list[Model]:
    return db.query(Model).filter(Model.project_id == project_id).order_by(Model.created_at.desc()).all()


def import_model(db: Session, project_id: int, name: str, path: str, base_model: str = "custom") -> Model:
    model = Model(project_id=project_id, name=name, path=path, base_model=base_model, is_trained=True)
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def import_external_pt(db: Session, project_id: int, project_name: str, file_bytes: bytes, original_filename: str) -> Model:
    """Copy an external .pt file into workspace and create DB record."""
    safe_name = _safe_project_name(project_name)
    model_dir = os.path.join(WORKSPACES_DIR, safe_name, "models")
    os.makedirs(model_dir, exist_ok=True)

    name = original_filename if original_filename.endswith(".pt") else f"{original_filename}.pt"
    dest_path = os.path.join(model_dir, name)
    # Avoid overwrite
    if os.path.exists(dest_path):
        base, ext = os.path.splitext(name)
        dest_path = os.path.join(model_dir, f"{base}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}{ext}")

    with open(dest_path, "wb") as f:
        f.write(file_bytes)

    size_mb = round(os.path.getsize(dest_path) / (1024 * 1024), 2)
    model = Model(
        project_id=project_id,
        name=os.path.basename(dest_path),
        path=dest_path,
        base_model="imported",
        is_trained=True,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def delete_model(db: Session, model_id: int) -> bool:
    model = db.query(Model).filter(Model.id == model_id).first()
    if not model:
        return False
    # Delete the file
    if model.path and os.path.exists(model.path):
        os.remove(model.path)
    db.delete(model)
    db.commit()
    return True


def get_model_info(model_id: int) -> dict:
    """Get model info including file stats."""
    model_path = None
    try:
        from database import SessionLocal
        db = SessionLocal()
        m = db.query(Model).filter(Model.id == model_id).first()
        db.close()
        if m:
            model_path = m.path
    except Exception:
        pass

    info = {"id": model_id, "path": model_path}
    if model_path and os.path.exists(model_path):
        stat = os.stat(model_path)
        info["size_mb"] = round(stat.st_size / (1024 * 1024), 2)
        info["modified_at"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
    return info
