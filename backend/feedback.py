from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from auth import get_current_user
from models import Feedback, ReportedEmail, User

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackRequest(BaseModel):
    email_subject: Optional[str] = None
    email_from: Optional[str] = None
    risk_level: Optional[str] = None
    phishing_probability: Optional[float] = None
    user_label: str  # "safe" | "phishing"
    comment: Optional[str] = None
    scanned_at: Optional[str] = None


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reported_email = (
        db.query(ReportedEmail)
        .filter(
            ReportedEmail.user_id == current_user.id,
            ReportedEmail.sender == body.email_from,
            ReportedEmail.title == body.email_subject,
        )
        .first()
    )

    if not reported_email:
        reported_email = ReportedEmail(
            title=body.email_subject,
            sender=body.email_from,
            user_id=current_user.id,
            is_detected=body.risk_level in ("high", "medium"),
            is_safe=body.user_label == "safe",
        )
        db.add(reported_email)
        db.flush()  # get the id without committing yet
    else:
        reported_email.is_safe = body.user_label == "safe"
        reported_email.is_detected = body.risk_level in ("high", "medium")

    feedback = Feedback(
        reported_email_id=reported_email.id,
        content=body.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)

    return {"feedback_id": feedback.id, "reported_email_id": reported_email.id}


class FeedbackResponse(BaseModel):
    id: int
    reported_email_id: int
    content: Optional[str]
    created_at: Optional[str]
    email_subject: Optional[str]
    email_sender: Optional[str]
    user_id: Optional[int]
    is_safe: Optional[bool]

    class Config:
        from_attributes = True


@router.get("", response_model=list[FeedbackResponse])
def get_feedbacks(
    user_id: Optional[int] = None,
    reported_email_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Feedback)
        .join(Feedback.reported_email)
    )

    if current_user.role == "admin":
        if user_id is not None:
            query = query.filter(ReportedEmail.user_id == user_id)
    else:
        query = query.filter(ReportedEmail.user_id == current_user.id)

    if reported_email_id is not None:
        query = query.filter(Feedback.reported_email_id == reported_email_id)

    feedbacks = query.order_by(Feedback.created_at.desc()).all()

    return [
        FeedbackResponse(
            id=f.id,
            reported_email_id=f.reported_email_id,
            content=f.content,
            created_at=f.created_at.isoformat() if f.created_at else None,
            email_subject=f.reported_email.title,
            email_sender=f.reported_email.sender,
            user_id=f.reported_email.user_id,
            is_safe=f.reported_email.is_safe,
        )
        for f in feedbacks
    ]