from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re
from urllib.parse import urlparse
import joblib
from shared.clean_text import clean_text, transform_email_text
import pandas as pd
from database import get_db, engine
from models import Base, User
from sqlalchemy.orm import Session
from schemas import LoginRequest, TokenResponse, UserResponse
from auth import verify_password, create_access_token
from feedback import router as feedback_router
from users import router as users_router

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


#Simple heuristics
URGENT_PATTERNS = [
    r"\burgent\b", r"\bimmediately\b", r"\bact now\b", r"\bverify\b",
    r"\bsuspended\b", r"\baccount\b", r"\bpassword\b", r"\blogin\b",
    r"\bsecurity alert\b", r"\bclick\b"
]
SHORTENER_DOMAINS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd"}


def looks_like_ip_url(url: str) -> bool:
    return bool(re.match(r"^https?://\d+\.\d+\.\d+\.\d+(/|$)", url.strip(), re.I))


def get_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        return (parsed.netloc or "").lower()
    except Exception:
        return ""


def score_email(subject: str, from_addr: str, body: str, links: List[LinkItem]) -> Dict[str, Any]:
    reasons: List[str] = []
    score = 0.15 

    text_all = f"{subject}\n{from_addr}\n{body}".lower()

    # Urgent language
    urgent_hits = sum(1 for p in URGENT_PATTERNS if re.search(p, text_all, re.I))
    if urgent_hits >= 2:
        score += 0.25
        reasons.append("Urgent/pressure language detected")
    elif urgent_hits == 1:
        score += 0.12
        reasons.append("Contains urgency/login-related wording")

    # Suspicious urls
    if links:
        score += 0.10
        reasons.append(f"Contains {len(links)} link(s)")

    suspicious_link_count = 0
    for lk in links:
        href = lk.href or ""
        domain = get_domain(href)

        if looks_like_ip_url(href):
            suspicious_link_count += 1
            reasons.append("Link uses IP address (common phishing pattern)")

        if "xn--" in domain:
            suspicious_link_count += 1
            reasons.append("Link domain uses punycode (possible lookalike domain)")

        if domain in SHORTENER_DOMAINS:
            suspicious_link_count += 1
            reasons.append("Shortened URL detected")

        if lk.suspiciousFlags:
            suspicious_link_count += 1
            reasons.append(f"Link flagged: {', '.join(lk.suspiciousFlags)}")

    if suspicious_link_count >= 2:
        score += 0.35
    elif suspicious_link_count == 1:
        score += 0.20

    score = max(0.01, min(score, 0.99))

    # Risk thresholds
    if score >= 0.80:
        risk = "high"
    elif score >= 0.50:
        risk = "medium"
    else:
        risk = "low"

    deduped = []
    for r in reasons:
        if r not in deduped:
            deduped.append(r)

    return {
        "phishing_probability": float(score),
        "risk_level": risk,
        "reasons": deduped[:6],
        "action": "warn" if risk in ("medium", "high") else "none"
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    result = score_email(req.subject, req.from_, req.bodyText, req.links)
    return result


# Load model with error handling
try:
    model = joblib.load("data/phishing_model.pkl")
    model_available = True
except (FileNotFoundError, Exception) as e:
    print(f"Warning: Could not load model: {e}")
    model = None
    model_available = False


@app.post("/predict-model", response_model=PredictResponse)
def predict_model(req: PredictRequest):
    if not model_available or model is None:
        return {
            "phishing_probability": 0.0,
            "risk_level": "low",
            "reasons": ["Model not available (using fallback)"],
            "action": "none"
        }

    try:
        raw_text = req.bodyText
        text, features = transform_email_text(clean_text(raw_text))

        row = {
            "clean_text": text,
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


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.from_orm(user))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_available": model_available
    }
