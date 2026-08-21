"""OpenRouter BYOK credential routes — encrypted at rest, never returned decrypted."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.auth import get_current_user
from models.user import ApiCredential
from services import crypto_service
from services.openrouter_service import OpenRouterError, list_models

router = APIRouter(prefix="/api/v1/credentials", tags=["Credentials"])

PROVIDER = "openrouter"


class SaveKeyRequest(BaseModel):
    api_key: str


def _get_credential(db: Session, user_id: int) -> ApiCredential | None:
    return (
        db.query(ApiCredential)
        .filter(ApiCredential.user_id == user_id, ApiCredential.provider == PROVIDER)
        .first()
    )


@router.get("/openrouter")
async def get_status(user=Depends(get_current_user), db: Session = Depends(get_db)):
    cred = _get_credential(db, user.id)
    if not cred:
        return {"connected": False}
    return {
        "connected": True,
        "masked": f"••••••••{cred.key_last4}",
        "last4": cred.key_last4,
        "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
    }


@router.put("/openrouter")
async def save_key(request: SaveKeyRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    key = request.api_key.strip()
    if not key or len(key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API key")
    # Validate the key against OpenRouter before saving
    try:
        await list_models(key)
    except OpenRouterError as e:
        raise HTTPException(status_code=400, detail=f"OpenRouter rejected this key: {e}")
    encrypted = crypto_service.encrypt(key)
    cred = _get_credential(db, user.id)
    if cred:
        cred.encrypted_key = encrypted
        cred.key_last4 = key[-4:]
    else:
        cred = ApiCredential(
            user_id=user.id, provider=PROVIDER,
            encrypted_key=encrypted, key_last4=key[-4:],
        )
        db.add(cred)
    db.commit()
    return {"connected": True, "masked": f"••••••••{key[-4:]}", "last4": key[-4:]}


@router.delete("/openrouter")
async def delete_key(user=Depends(get_current_user), db: Session = Depends(get_db)):
    cred = _get_credential(db, user.id)
    if cred:
        db.delete(cred)
        db.commit()
    return {"connected": False}
