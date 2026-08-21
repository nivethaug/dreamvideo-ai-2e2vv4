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

    # Video models only: models whose output modality includes video.
    video_models = [m for m in data if "video" in _output(m)]
    # Honest fallback: if OpenRouter has no video-output models, offer the
    # image-output generation models (closest real generation capability).
    selected = video_models
    note = None
    if not selected:
        selected = [m for m in data if "image" in _output(m)]
        note = ("No video-output models are currently available on OpenRouter; "
                "showing image-generation models instead.")

    models = []
    for m in selected:
        mid = m.get("id", "")
        meta = m.get("metadata") or {}
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
            "name": m.get("name") or mid,
            "context_length": m.get("context_length"),
            "pricing": m.get("pricing"),
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
