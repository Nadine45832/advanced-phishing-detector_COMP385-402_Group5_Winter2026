from pydantic import BaseModel
from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class UserCreate(BaseModel):
    username: str
    password_hash: str
    role: UserRole = UserRole.viewer
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


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
