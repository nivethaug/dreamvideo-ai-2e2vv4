"""Pexels media proxy — keeps PEXELS secret server-side, runtime live search."""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_user

router = APIRouter(prefix="/api/media", tags=["Media"])

PEXELS_BASE = "https://api.pexels.com/videos/search"


@router.get("/search")
async def search_media(
    q: str = Query(min_length=1),
    per_page: int = Query(default=12, ge=1, le=40),
    user=Depends(get_current_user),
):
    api_key = os.getenv("PEXELS")
    if not api_key:
        raise HTTPException(status_code=503, detail="Pexels is not configured on the server")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                PEXELS_BASE,
                params={"query": q, "per_page": per_page},
                headers={"Authorization": api_key},
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Pexels request failed: {e}")

    videos = []
    for v in data.get("videos", []):
        files = v.get("video_files") or []
        best = None
        for f in files:
            if f.get("file_type") == "video/mp4":
                best = f
                if (f.get("width") or 0) >= 1280:
                    break
        image = v.get("image")
        if not best or not image:
            continue
        photographer = v.get("user", {}).get("name", "Unknown")
        videos.append({
            "id": v.get("id"),
            "url": best.get("link"),
            "preview": image,
            "duration": v.get("duration"),
            "attribution": f"Video by {photographer} on Pexels",
            "pexels_url": v.get("url"),
        })
    return {"videos": videos}
