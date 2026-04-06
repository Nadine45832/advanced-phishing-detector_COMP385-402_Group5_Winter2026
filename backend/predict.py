from typing import List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import joblib
from shared.clean_text import clean_text, transform_email_text
import pandas as pd

from database import get_db
from auth import get_current_user
from models import ReportedEmail, User


class LinkItem(BaseModel):
    href: str = ""
    text: str = ""
    suspiciousFlags: List[str] = Field(default_factory=list)


class PredictRequest(BaseModel):
    subject: str = ""
    from_: str = Field(default="", alias="from")
    bodyText: str = ""
    links: List[LinkItem] = Field(default_factory=list)


class PredictResponse(BaseModel):
    phishing_probability: float
    risk_level: str
    reasons: List[str]
    action: str


# Load model with error handling
try:
    model = joblib.load("data/phishing_model.pkl")
    model_available = True
except (FileNotFoundError, Exception) as e:
    print(f"Warning: Could not load model: {e}")
    model = None
    model_available = False


router = APIRouter(tags=["predict"])


@router.post("/predict-model", response_model=PredictResponse)
def predict_model(
    req: PredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not model_available or model is None:
        return {
            "phishing_probability": 0.0,
            "risk_level": "low",
            "reasons": ["Model not available (using fallback)"],
            "action": "none"
        }

    reported_email = (
        db.query(ReportedEmail)
        .filter(
            ReportedEmail.user_id == current_user.id,
            ReportedEmail.sender == req.from_,
            ReportedEmail.title == req.subject,
        )
        .first()
    )

    try:
        raw_text = req.bodyText
        text, features = transform_email_text(clean_text(raw_text))

        row = {
            "clean_email_text": text,
            **features
        }
        df = pd.DataFrame([row])
        proba = model.predict_proba(df)[0][1]

        # Convert probability to risk level
        if proba >= 0.80:
            risk = "high"
        elif proba >= 0.50:
            risk = "medium"
        else:
            risk = "low"

        if not reported_email:
            reported_email = ReportedEmail(
                title=req.subject,
                sender=req.from_,
                user_id=current_user.id,
                proba=float(proba),
                is_detected=risk in ("high", "medium"),
                is_safe=risk == "low",
            )
            db.add(reported_email)
            db.flush()

        return {
            "phishing_probability": float(proba),
            "risk_level": risk,
            "reasons": [f"Model prediction: {(proba * 100):.1f}% phishing probability"],
            "action": "warn" if risk in ("medium", "high") else "none"
        }
    except Exception as e:
        print(f"Model prediction error: {e}")
        return {
            "phishing_probability": 0.0,
            "risk_level": "low",
            "reasons": [f"Prediction failed: {str(e)}"],
            "action": "none"
        }