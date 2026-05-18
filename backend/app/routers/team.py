from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from ..db import get_db
from ..models import UserCreate, UserOut
from ..security import get_current_user, hash_password, require_lead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(_: dict = Depends(get_current_user)):
    users = await get_db().users.find({}).to_list(length=500)
    return [
        UserOut(
            id=str(u["_id"]),
            name=u["name"],
            email=u["email"],
            role=u["role"],
            active=u.get("active", True),
            ooo=u.get("ooo", False),
        )
        for u in users
    ]


@router.post("", response_model=UserOut)
async def create_user(body: UserCreate, _: dict = Depends(require_lead)):
    db = get_db()
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already exists")
    doc = {
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "active": True,
    }
    res = await db.users.insert_one(doc)
    return UserOut(
        id=str(res.inserted_id),
        name=body.name,
        email=body.email,
        role=body.role,
        active=True,
    )


@router.put("/{user_id}/active")
async def set_active(
    user_id: str, active: bool, _: dict = Depends(require_lead)
):
    await get_db().users.update_one(
        {"_id": ObjectId(user_id)}, {"$set": {"active": active}}
    )
    return {"ok": True}


@router.put("/{user_id}/ooo")
async def set_ooo(
    user_id: str, ooo: bool, _: dict = Depends(get_current_user)
):
    await get_db().users.update_one(
        {"_id": ObjectId(user_id)}, {"$set": {"ooo": ooo}}
    )
    return {"ok": True}

