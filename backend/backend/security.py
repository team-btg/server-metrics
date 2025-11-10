import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext

# Prefer PyJWT; fallback to python-jose if PyJWT isn't available
try:
    import jwt  # PyJWT
    _JWT_BACKEND = "pyjwt"
except Exception:
    from jose import jwt  # type: ignore  # python-jose
    _JWT_BACKEND = "python-jose"

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES"))  # 24h default

# Add a password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def decode_jwt(token: str, verify_exp: bool = True) -> dict:
    """Unified decoder returning the full claims dict.
    For PyJWT, options is supported; for python-jose, options is ignored.
    """
    options = {"verify_exp": verify_exp} if _JWT_BACKEND == "pyjwt" else None
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options=options)


def verify_access_token(token: str) -> str:
    """Returns subject (server_id) if valid, raises jwt exceptions otherwise."""
    decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return decoded.get("sub")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)
