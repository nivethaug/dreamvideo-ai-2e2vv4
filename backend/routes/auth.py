"""
Authentication routes — session-based, real DB users.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from core.auth import get_current_user
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    user = AuthService.register(db, request.email, request.password, request.name)
    if not user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    token = AuthService.create_session_token(db, user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    result = AuthService.login(db, request.email, request.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user, token = result
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            AuthService.logout(db, parts[1])
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name}
