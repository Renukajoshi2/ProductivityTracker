from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from ..db import get_db
from ..models import PasswordChange, TokenOut, UserOut
from ..security import (
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await get_db().users.find_one({"email": form.username.lower()})
    if not user or not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_token(str(user["_id"]), user["role"])
    return TokenOut(
        access_token=token, role=user["role"], name=user["name"]
    )


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        active=user.get("active", True),
    )


@router.post("/password")
async def change_password(
    body: PasswordChange, user: dict = Depends(get_current_user)
):
    if not verify_password(body.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    from bson import ObjectId

    await get_db().users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    return {"ok": True}
