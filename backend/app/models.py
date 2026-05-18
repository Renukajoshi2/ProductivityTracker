from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "lead", "member"]
TaskStatus = Literal["open", "in_progress", "blocked", "done"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    name: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    active: bool = True
    ooo: bool = False


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role = "member"


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class ChatIn(BaseModel):
    message: str


class ChatOut(BaseModel):
    reply: str


class BlockerCommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TaskOut(BaseModel):
    id: str
    title: str
    owner_id: str
    owner_name: Optional[str] = None
    status: TaskStatus
    progress_pct: int = 0
    first_seen: datetime
    completed_at: Optional[datetime] = None
