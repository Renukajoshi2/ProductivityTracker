from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
import bcrypt
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from .config import settings
from .db import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise cred_exc
    except JWTError:
        raise cred_exc

    from bson import ObjectId

    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("active", True):
        raise cred_exc
    user["id"] = str(user["_id"])
    return user


def require_lead(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("admin", "lead"):
        raise HTTPException(status_code=403, detail="Lead/admin access required")
    return user
