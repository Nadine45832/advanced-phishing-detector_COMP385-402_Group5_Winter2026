from pydantic import BaseModel
from enum import Enum
from typing import Optional


class UserRole(str, Enum):
    admin = "admin"
    editor = "editor"
    user = "user"


class UserCreate(BaseModel):
    username: str
    password_hash: str
    role: UserRole = UserRole.user
    first_name: str
    last_name: str


class UserResponse(BaseModel):
    id: int
    username: str
    role: UserRole
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password_hash: Optional[str] = None
    role: Optional[UserRole] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
