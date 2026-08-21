"""Session-based auth dependency. Resolves the current user server-side; never trusts client user_id."""
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.auth_service import AuthService


def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not authorization:
        if token:
            authorization = f"Bearer {token}"
        else:
            raise HTTPException(status_code=401, detail="Not authenticated")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    user = AuthService.get_user_by_token(db, parts[1])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user
