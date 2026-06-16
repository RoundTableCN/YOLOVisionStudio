import os
import json
import shutil
from datetime import datetime
from sqlalchemy.orm import Session
from models.db_models import Project

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")


def _project_workspace(project_name: str) -> str:
    safe_name = "".join(c if c.isalnum() or c in "_- " else "_" for c in project_name).strip().replace(" ", "_").lower()
    return os.path.join(WORKSPACES_DIR, safe_name)


def _create_workspace_dirs(project_name: str):
    ws = _project_workspace(project_name)
    for sub in ["dataset", "labels", "models", "outputs", "logs", "thumbnails"]:
        os.makedirs(os.path.join(ws, sub), exist_ok=True)
    meta_path = os.path.join(ws, "project.json")
    if not os.path.exists(meta_path):
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({"name": project_name, "created_at": datetime.utcnow().isoformat()}, f, ensure_ascii=False, indent=2)
    return ws


def list_projects(db: Session, search: str = "", sort: str = "updated_at") -> list[Project]:
    q = db.query(Project)
    if search:
        q = q.filter(Project.name.ilike(f"%{search}%"))
    order_map = {
        "updated_at": Project.updated_at.desc(),
        "created_at": Project.created_at.desc(),
        "name": Project.name.asc(),
    }
    q = q.order_by(order_map.get(sort, Project.updated_at.desc()))
    return q.all()


def create_project(db: Session, name: str, description: str = "") -> Project:
    project = Project(name=name, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)
    _create_workspace_dirs(name)
    return project


def get_project(db: Session, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def update_project(db: Session, project_id: int, name: str = None, description: str = None) -> Project | None:
    project = get_project(db, project_id)
    if not project:
        return None
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> bool:
    project = get_project(db, project_id)
    if not project:
        return False
    ws = _project_workspace(project.name)
    db.delete(project)
    db.commit()
    if os.path.exists(ws):
        shutil.rmtree(ws, ignore_errors=True)
    return True
