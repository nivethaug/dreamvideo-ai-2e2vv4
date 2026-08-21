"""OpenRouter client — all calls server-side with the user's decrypted BYOK key."""
import json
import httpx

OPENROUTER_BASE = "https://openrouter.ai/api/v1"


class OpenRouterError(Exception):
    pass


def _headers(api_key: str) -> dict:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dreamvideo-ai.dreamagent.cloud",
        "X-Title": "DreamVideo AI",
    }


async def list_models(api_key: str) -> list[dict]:
    """Fetch real model list. Returns normalized models with duration range when available."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(f"{OPENROUTER_BASE}/models", headers=_headers(api_key))
        if res.status_code != 200:
            raise OpenRouterError(f"OpenRouter models request failed ({res.status_code})")
        data = res.json().get("data", [])

    def _output(m):
        return ((m.get("architecture") or {}).get("output_modalities")) or []

    # Curated video-model catalog (local list), matched against OpenRouter by id.
    CURATED_VIDEO_MODELS = [
        {"id": "black-forest-labs/flux-video-upscale", "name": "FLUX Video Upscale", "duration_min": 5, "duration_max": 10},
        {"id": "bytedance/seedance-2.0-mini", "name": "Seedance 2.0 Mini", "duration_min": 4, "duration_max": 10},
        {"id": "bytedance/seedance-2.5", "name": "Seedance 2.5", "duration_min": 5, "duration_max": 10},
        {"id": "black-forest-labs/flux.3-video", "name": "FLUX.3 Video", "duration_min": 5, "duration_max": 10},
        {"id": "minimax/h3", "name": "MiniMax H3", "duration_min": 5, "duration_max": 10},
        {"id": "runway/aleph-2.0", "name": "Runway Aleph 2.0", "duration_min": 5, "duration_max": 10},
        {"id": "runway/gen-4.5", "name": "Runway Gen-4.5", "duration_min": 5, "duration_max": 10},
        {"id": "x-ai/grok-imagine-video-1.5", "name": "Grok Imagine Video 1.5", "duration_min": 5, "duration_max": 10},
        {"id": "alibaba/happyhorse-1.1", "name": "HappyHorse 1.1", "duration_min": 5, "duration_max": 10},
        {"id": "alibaba/happyhorse-1.0", "name": "HappyHorse 1.0", "duration_min": 5, "duration_max": 10},
        {"id": "x-ai/grok-imagine-video", "name": "Grok Imagine Video", "duration_min": 5, "duration_max": 10},
        {"id": "kwaivgi/kling-v3.0-pro", "name": "Kling Video v3.0 Pro", "duration_min": 5, "duration_max": 10},
        {"id": "kwaivgi/kling-v3.0-standard", "name": "Kling Video v3.0 Standard", "duration_min": 5, "duration_max": 10},
    ]

    catalog = {m.get("id", ""): m for m in data}

    def _is_video(m):
        return "video" in _output(m) or "video" in (m.get("id", "") + " " + (m.get("name") or "")).lower()

    # Local filter: curated video models that actually exist on OpenRouter.
    selected = []
    for cur in CURATED_VIDEO_MODELS:
        m = catalog.get(cur["id"])
        if m is None:
            # try fuzzy id match (vendor prefixes can vary)
            matches = [v for k, v in catalog.items() if k.endswith(cur["id"].split("/", 1)[-1])]
            m = matches[0] if matches else None
        if m is not None:
            selected.append((m, cur))

    note = None
    if not selected:
        # Fallback: any video-capable models found in the live catalog.
        fallback = [m for m in data if _is_video(m)]
        if fallback:
            selected = [(m, None) for m in fallback]
            note = "Showing all video-capable models found on OpenRouter."
        else:
            selected = [(None, cur) for cur in CURATED_VIDEO_MODELS]
            note = ("These video models are not currently returned by your OpenRouter account's "
                    "catalog; generation may fail until they are available.")

    models = []
    for m, cur in selected:
        if m is not None:
            mid = m.get("id", "")
            name = m.get("name") or mid
            pricing = m.get("pricing")
            context_length = m.get("context_length")
        else:
            mid = cur["id"]
            name = cur["name"]
            pricing = None
            context_length = None
        if cur is not None:
            dmin, dmax = cur["duration_min"], cur["duration_max"]
        else:
            meta = (m.get("metadata") or {}) if m else {}
            dmin = meta.get("min_duration") or 5
            dmax = meta.get("max_duration") or 10
        try:
            dmin = max(5, min(10, int(dmin)))
            dmax = max(5, min(10, int(dmax)))
        except (TypeError, ValueError):
            dmin, dmax = 5, 10
        if dmax < dmin:
            dmin, dmax = dmax, dmin
        models.append({
            "id": mid,
            "name": name,
            "context_length": context_length,
            "pricing": pricing,
            "duration_min": dmin,
            "duration_max": dmax,
        })
    return {"models": models, "note": note}


async def chat(api_key: str, model: str, messages: list[dict], max_tokens: int = 2000) -> str:
    payload = {"model": model, "messages": messages, "max_tokens": max_tokens}
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            f"{OPENROUTER_BASE}/chat/completions",
            headers=_headers(api_key),
            json=payload,
        )
        if res.status_code != 200:
            # never log the key; status + generic body only
            raise OpenRouterError(f"OpenRouter chat failed ({res.status_code}): {res.text[:300]}")
        data = res.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise OpenRouterError(f"Unexpected OpenRouter response shape: {e}")


def extract_json(text: str):
    """Parse JSON from an LLM response that may be wrapped in code fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return json.loads(text)
