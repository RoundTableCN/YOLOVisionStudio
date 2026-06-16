from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, DateTime, ForeignKey, JSON, Boolean,
)
from sqlalchemy.orm import relationship
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    thumbnail_path = Column(String(512), nullable=True)

    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    labels = relationship("Label", back_populates="project", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="project", cascade="all, delete-orphan")
    trainings = relationship("Training", back_populates="project", cascade="all, delete-orphan")


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    original_path = Column(String(1024), nullable=False)
    thumbnail_path = Column(String(1024), nullable=True)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    file_size = Column(Integer, nullable=False)
    imported_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="images")
    annotations = relationship("Annotation", back_populates="image", cascade="all, delete-orphan")


class Label(Base):
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    color = Column(String(7), default="#00FF00")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="labels")
    annotations = relationship("Annotation", back_populates="label", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), nullable=False)
    label_id = Column(Integer, ForeignKey("labels.id", ondelete="CASCADE"), nullable=False)
    x_center = Column(Float, nullable=False)
    y_center = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    image = relationship("Image", back_populates="annotations")
    label = relationship("Label", back_populates="annotations")


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    path = Column(String(1024), nullable=False)
    base_model = Column(String(50), default="yolov8n")
    is_trained = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    training_id = Column(Integer, nullable=True)

    project = relationship("Project", back_populates="models")


class Training(Base):
    __tablename__ = "trainings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="running")
    params = Column(JSON, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    metrics = Column(JSON, nullable=True)
    log_path = Column(String(1024), nullable=True)

    project = relationship("Project", back_populates="trainings")


class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String(255), primary_key=True)
    value = Column(Text, nullable=True)
