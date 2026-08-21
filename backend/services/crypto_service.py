"""Server-side Fernet encryption for BYOK credentials. Key derived from SECRET_KEY."""
import base64
import hashlib
from cryptography.fernet import Fernet
from core.config import settings


def _fernet() -> Fernet:
    raw = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
