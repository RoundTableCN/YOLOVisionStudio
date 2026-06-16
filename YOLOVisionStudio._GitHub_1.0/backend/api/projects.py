from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from services.project_service import list_projects, create_project, get_project, update_project, delete_project

router = APIRouter(prefix="/api/projects", tags=["projects"])

class CreateProjectBody(BaseModel):
    name: str
    description: str = ""

class UpdateProjectBody(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("/")
def _list_projects(search: str = "", sort: str = "updated_at", db: Session = Depends(get_db)):
    projects = list_projects(db, search=search, sort=sort)
    items = [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "created_at": p.created_at.isoformat() if p.created_at else "",
            "updated_at": p.updated_at.isoformat() if p.updated_at else "",
            "thumbnail_path": p.thumbnail_path,
        }
        for p in projects
    ]
    return {"items": items, "total": len(items)}


@router.post("/")
def _create_project(body: CreateProjectBody, db: Session = Depends(get_db)):
    try:
        project = create_project(db, name=body.name, description=body.description)
        return {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at.isoformat() if project.created_at else "",
            "updated_at": project.updated_at.isoformat() if project.updated_at else "",
            "thumbnail_path": project.thumbnail_path,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{project_id}")
def _get_project(project_id: int, db: Session = Depends(get_db)):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat() if project.created_at else "",
        "updated_at": project.updated_at.isoformat() if project.updated_at else "",
        "thumbnail_path": project.thumbnail_path,
    }


@router.put("/{project_id}")
def _update_project(project_id: int, body: UpdateProjectBody, db: Session = Depends(get_db)):
    project = update_project(db, project_id, name=body.name, description=body.description)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat() if project.created_at else "",
        "updated_at": project.updated_at.isoformat() if project.updated_at else "",
        "thumbnail_path": project.thumbnail_path,
    }


@router.delete("/{project_id}")
def _delete_project(project_id: int, db: Session = Depends(get_db)):
    ok = delete_project(db, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "deleted"}
