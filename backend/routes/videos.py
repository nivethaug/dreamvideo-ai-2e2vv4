"""Video pipeline routes: models, script/scene generation, jobs, scenes, AI edit."""
import json
import datetime
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from core.auth import get_current_user
from core.config import settings
from models.user import ApiCredential
from models.project import Project, Scene, VideoJob
from services import crypto_service
from services.openrouter_service import (
    OpenRouterError, list_models, chat, extract_json,
)

router = APIRouter(prefix="/api/v1/videos", tags=["Videos"])


def _get_openrouter_key(db: Session, user_id: int) -> str:
    cred = (
        db.query(ApiCredential)
        .filter(ApiCredential.user_id == user_id, ApiCredential.provider == "openrouter")
        .first()
    )
    if not cred:
        raise HTTPException(status_code=400, detail="No OpenRouter API key saved. Add one in Settings.")
    return crypto_service.decrypt(cred.encrypted_key)


def _own_project(db: Session, user_id: int, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _own_scene(db: Session, user_id: int, scene_id: int) -> Scene:
    scene = (
        db.query(Scene)
        .join(Project)
        .filter(Scene.id == scene_id, Project.user_id == user_id)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


def _own_job(db: Session, user_id: int, job_id: int) -> VideoJob:
    job = (
        db.query(VideoJob)
        .join(Project)
        .filter(VideoJob.id == job_id, Project.user_id == user_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------------------------------------------------------- models

@router.get("/models")
async def get_models(user=Depends(get_current_user), db: Session = Depends(get_db)):
    key = _get_openrouter_key(db, user.id)
    try:
        result = await list_models(key)
    except OpenRouterError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {e}")
    return {"models": result["models"], "note": result["note"]}


# ---------------------------------------------------------------- projects

class CreateProjectRequest(BaseModel):
    title: Optional[str] = "Untitled"
    idea: str = ""


@router.post("/projects")
async def create_project(request: CreateProjectRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    project = Project(user_id=user.id, title=request.title or "Untitled", idea=request.idea)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_dict(db, project)


@router.get("/projects")
async def list_projects(user=Depends(get_current_user), db: Session = Depends(get_db)):
    projects = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return {"projects": [_project_dict(db, p) for p in projects]}


@router.get("/projects/{project_id}")
async def get_project(project_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return _project_dict(db, _own_project(db, user.id, project_id))


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    project = _own_project(db, user.id, project_id)
    db.delete(project)
    db.commit()
    return {"deleted": True}


def _project_dict(db: Session, project: Project) -> dict:
    scenes = (
        db.query(Scene)
        .filter(Scene.project_id == project.id)
        .order_by(Scene.position)
        .all()
    )
    jobs = (
        db.query(VideoJob)
        .filter(VideoJob.project_id == project.id)
        .order_by(VideoJob.created_at.desc())
        .all()
    )
    latest = jobs[0] if jobs else None
    return {
        "id": project.id,
        "title": project.title,
        "idea": project.idea,
        "status": project.status,
        "model": project.model,
        "duration": project.duration_seconds,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "scenes": [_scene_dict(s) for s in scenes],
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "provider_url": j.provider_url,
                "error": j.error,
                "expires_at": None,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ],
        "latest_video_url": latest.provider_url if latest and latest.status == "Completed" else None,
    }


# ---------------------------------------------------------------- generation

class GenerateScriptRequest(BaseModel):
    idea: str = Field(min_length=3)
    model: Optional[str] = None
    duration: int = Field(default=8, ge=5, le=10)


@router.post("/generate-script")
async def generate_script(request: GenerateScriptRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    key = _get_openrouter_key(db, user.id)
    duration = max(5, min(10, request.duration))
    prompt = f"""You are a short-form video director. Create a {duration}-second video plan for this idea:
"{request.idea}"

Return ONLY valid JSON with this exact shape:
{{
  "title": "short catchy video title",
  "scenes": [
    {{
      "position": 1,
      "heading": "short scene heading",
      "duration": seconds-for-this-scene,
      "visual_prompt": "detailed visual description for stock footage search / generation",
      "voiceover": "voiceover narration text for this scene",
      "search_query": "2-4 word stock footage search query"
    }}
  ]
}}
Use 3-5 scenes whose durations sum to {duration} seconds."""

    model = request.model or "openai/gpt-4o-mini"
    try:
        raw = await chat(key, model, prompt)
        data = extract_json(raw)
    except OpenRouterError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {e}")

    scenes_data = data.get("scenes") or []
    if not scenes_data:
        raise HTTPException(status_code=502, detail="Model returned no scenes. Try again.")

    project = Project(user_id=user.id, title=data.get("title") or "Untitled", idea=request.idea,
                      model=model, duration=duration, status="Draft")
    db.add(project)
    db.flush()
    for i, s in enumerate(scenes_data):
        db.add(Scene(
            project_id=project.id,
            position=s.get("position") or (i + 1),
            heading=str(s.get("heading") or f"Scene {i + 1}")[:255],
            duration=int(s.get("duration") or 3),
            visual_prompt=s.get("visual_prompt") or "",
            voiceover=s.get("voiceover") or "",
            search_query=s.get("search_query") or "",
        ))
    db.commit()
    db.refresh(project)
    return _project_dict(db, project)


# ---------------------------------------------------------------- scenes

class SceneUpdateRequest(BaseModel):
    heading: Optional[str] = None
    visual_prompt: Optional[str] = None
    voiceover: Optional[str] = None
    search_query: Optional[str] = None
    media_url: Optional[str] = None
    media_attribution: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=1, le=10)


@router.put("/scenes/{scene_id}")
async def update_scene(scene_id: int, request: SceneUpdateRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    scene = _own_scene(db, user.id, scene_id)
    for field in ("heading", "visual_prompt", "voiceover", "search_query", "media_url", "media_attribution", "duration"):
        val = getattr(request, field)
        if val is not None:
            setattr(scene, field, val)
    db.commit()
    return _scene_dict(scene)


# ---------------------------------------------------------------- AI edit

class EditSceneRequest(BaseModel):
    instruction: str = Field(min_length=3)


@router.post("/scenes/{scene_id}/edit")
async def edit_scene(scene_id: int, request: EditSceneRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    scene = _own_scene(db, user.id, scene_id)
    key = _get_openrouter_key(db, user.id)
    project = scene.project
    model = project.model or "openai/gpt-4o-mini"
    prompt = f"""You are editing one scene of a short video. Apply this user instruction:
"{request.instruction}"

Current scene JSON:
{json.dumps(_scene_dict(scene), indent=2)}

Return ONLY valid JSON: {{"heading": str, "visual_prompt": str, "voiceover": str, "search_query": str}}
Keep the same style; change only what the instruction asks."""

    try:
        raw = await chat(key, model, prompt)
        data = extract_json(raw)
    except OpenRouterError as e:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {e}")

    scene.heading = str(data.get("heading") or scene.heading)[:255]
    scene.visual_prompt = data.get("visual_prompt") or scene.visual_prompt
    scene.voiceover = data.get("voiceover") or scene.voiceover
    scene.search_query = data.get("search_query") or scene.search_query
    db.commit()
    return {"original": None, "updated": _scene_dict(scene)}


# ---------------------------------------------------------------- video jobs

class CreateVideoRequest(BaseModel):
    project_id: int
    model: Optional[str] = None
    duration: Optional[int] = None


@router.post("")
async def create_video(request: CreateVideoRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    project = _own_project(db, user.id, request.project_id)
    duration = max(5, min(10, request.duration or project.duration or 8))
    if request.model:
        project.model = request.model
    project.duration = duration
    project.status = "Processing"

    import json as _json
    job = VideoJob(project_id=project.id, user_id=user.id, provider="none", status="Queued",
                   metadata_json=_json.dumps({"model": project.model or request.model,
                                              "duration": duration}))
    db.add(job)
    db.commit()
    db.refresh(job)
    return _job_dict(job)


@router.get("/jobs/{job_id}")
async def get_job(job_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    job = _own_job(db, user.id, job_id)
    if job.status in ("Queued", "Processing"):
        _advance_job(db, job)
    return _job_dict(job)


def _advance_job(db: Session, job: VideoJob):
    """
    Advance the job honestly. OpenRouter is a chat/LLM router — it cannot
    generate video files. If no real video-generation provider is configured,
    the job fails with an honest message rather than fabricating a video.
    A future provider can be wired in here via VIDEO_PROVIDER_URL etc.
    """
    provider = getattr(settings, "VIDEO_PROVIDER_URL", None) or None
    if not provider:
        job.status = "Failed"
        job.error = (
            "No video-generation provider is configured for this deployment. "
            "OpenRouter (your saved key) handles script/scene/AI-edit steps, but "
            "actual video rendering requires a real video-generation provider. "
            "Your storyboard, scenes and media selections are saved — connect a "
            "video provider to enable rendering."
        )
        job.project.status = "Failed"
        db.commit()
        return

    # Real provider path (kept for when VIDEO_PROVIDER_URL is configured)
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                provider,
                json={"prompt": _compose_prompt(db, job), "duration": _job_meta(job).get("duration")},
            )
            resp.raise_for_status()
            data = resp.json()
        url = data.get("url") or data.get("video_url")
        if not url:
            job.status = "Failed"
            job.error = "Provider did not return a video URL."
        else:
            job.status = "Completed"
            job.provider_url = url
            job.project.status = "Completed"
    except Exception as e:  # noqa: BLE001
        job.status = "Failed"
        job.error = f"Video provider error: {e}"
        job.project.status = "Failed"
    db.commit()


def _compose_prompt(db: Session, job: VideoJob) -> str:
    scenes = db.query(Scene).filter(Scene.project_id == job.project_id).order_by(Scene.position).all()
    parts = [f"{s.heading}: {s.visual_prompt}" for s in scenes]
    return f"{job.project.title}. " + " | ".join(parts)


def _job_meta(job: VideoJob) -> dict:
    import json as _json
    try:
        return _json.loads(job.metadata_json) if job.metadata_json else {}
    except Exception:  # noqa: BLE001
        return {}


def _job_dict(job: VideoJob) -> dict:
    meta = _job_meta(job)
    return {
        "id": job.id,
        "project_id": job.project_id,
        "status": job.status,
        "model": meta.get("model"),
        "duration": meta.get("duration"),
        "provider_url": job.provider_url,
        "error": job.error,
        "expires_at": None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
