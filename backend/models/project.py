"""Project (video), scene and video-job models — all scoped to owning user."""
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from core.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="Untitled")
    idea = Column(Text, nullable=False, default="")
    style = Column(String(64), nullable=False, default="Cinematic 2.39:1")
    model = Column(String(128), nullable=False, default="")
    duration_seconds = Column(Integer, nullable=False, default=8)
    status = Column(String(32), nullable=False, default="Draft")
    provider_url = Column(Text, nullable=True)
    provider_metadata = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)
    visual_prompt = Column(Text, nullable=False, default="")
    voiceover = Column(Text, nullable=False, default="")
    direction = Column(Text, nullable=False, default="")
    seconds = Column(Integer, nullable=False, default=6)
    media_url = Column(Text, nullable=True)
    media_attribution = Column(String(255), nullable=True)


class VideoJob(Base):
    __tablename__ = "video_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="Processing")
    provider = Column(String(64), nullable=False, default="none")
    provider_job_id = Column(String(255), nullable=True)
    provider_url = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
