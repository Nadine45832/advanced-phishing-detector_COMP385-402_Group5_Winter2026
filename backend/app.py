from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from feedback import router as feedback_router
from users import router as users_router
from predict import router as predict_router
from login import router as login_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Phishing Detector API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(feedback_router)
app.include_router(users_router)
app.include_router(predict_router)
app.include_router(login_router)


@app.get("/health")
def health():
    return {
        "status": "ok"
    }
