from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from models import User
from sqlalchemy.orm import Session
from schemas import LoginRequest, TokenResponse, UserResponse
from auth import verify_password, create_access_token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.from_orm(user))