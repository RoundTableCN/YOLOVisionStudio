import os
import uuid
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WORKSPACES_DIR = os.path.join(BASE_DIR, "workspaces")
THUMBNAIL_MAX_SIZE = 300
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def is_allowed_image(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def save_upload(file_data: bytes, project_name: str, filename: str) -> tuple[str, int, int]:
    """Save uploaded image to workspace dataset dir. Returns (saved_path, width, height)."""
    safe_project = _safe_project_name(project_name)
    dataset_dir = os.path.join(WORKSPACES_DIR, safe_project, "dataset")
    os.makedirs(dataset_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    saved_path = os.path.join(dataset_dir, unique_name)

    with open(saved_path, "wb") as f:
        f.write(file_data)

    with Image.open(saved_path) as img:
        width, height = img.size

    return saved_path, width, height


def generate_thumbnail(original_path: str, project_name: str, filename: str) -> str:
    """Generate thumbnail, return thumbnail path."""
    safe_project = _safe_project_name(project_name)
    thumb_dir = os.path.join(WORKSPACES_DIR, safe_project, "thumbnails")
    os.makedirs(thumb_dir, exist_ok=True)

    unique_name = f"thumb_{uuid.uuid4().hex}_{filename}"
    thumb_path = os.path.join(thumb_dir, unique_name)

    with Image.open(original_path) as img:
        img.thumbnail((THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE), Image.LANCZOS)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.save(thumb_path, "JPEG", quality=85)

    return thumb_path


def delete_files(*paths: str):
    for p in paths:
        if p and os.path.exists(p):
            os.remove(p)


def _safe_project_name(project_name: str) -> str:
    return "".join(c if c.isalnum() or c in "_- " else "_" for c in project_name).strip().replace(" ", "_").lower()
