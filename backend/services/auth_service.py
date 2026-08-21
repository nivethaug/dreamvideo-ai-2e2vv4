"""
Authentication service — real DB-backed sessions.
"""
import secrets
import datetime
import bcrypt
from sqlalchemy.orm import Session
from models.user import User, SessionToken


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except ValueError:
            return False

    @classmethod
    def create_user(cls, db: Session, email: str, password: str, name: str | None = None) -> User:
        user = User(email=email, password_hash=cls.hash_password(password), name=name)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def get_user_by_email(cls, db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    @classmethod
    def get_user_by_id(cls, db: Session, user_id: int) -> User | None:
        return db.query(User).filter(User.id == user_id).first()

    @classmethod
    def create_session_token(cls, db: Session, user_id: int) -> str:
        token = secrets.token_urlsafe(48)
        db.add(SessionToken(token=token, user_id=user_id))
        db.commit()
        return token

    @classmethod
    def login(cls, db: Session, email: str, password: str) -> tuple[User, str] | None:
        user = cls.get_user_by_email(db, email)
        if not user or not cls.verify_password(password, user.password_hash):
            return None
        return user, cls.create_session_token(db, user.id)

    @classmethod
    def register(cls, db: Session, email: str, password: str, name: str | None = None) -> User | None:
        if cls.get_user_by_email(db, email):
            return None
        return cls.create_user(db, email, password, name)

    @classmethod
    def get_user_by_token(cls, db: Session, token: str) -> User | None:
        st = db.query(SessionToken).filter(SessionToken.token == token).first()
        if not st:
            return None
        return cls.get_user_by_id(db, st.user_id)

    @classmethod
    def logout(cls, db: Session, token: str) -> None:
        db.query(SessionToken).filter(SessionToken.token == token).delete()
        db.commit()
