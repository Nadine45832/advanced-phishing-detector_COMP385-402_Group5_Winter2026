from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from database import get_db
from auth import get_current_user
from models import ReportedEmail, User, UserRole

import datetime


router = APIRouter(tags=["stats"])


@router.get("/stats")
def get_stats(
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.admin:
        if user_id is not None and user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own stats",
            )
        user_id = current_user.id

    now = datetime.datetime.utcnow()
    day30 = now - datetime.timedelta(days=30)

    q = db.query(ReportedEmail).filter(ReportedEmail.reported_at >= day30)
    if user_id:
        q = q.filter(ReportedEmail.user_id == user_id)

    pie_rows = q.with_entities(
        ReportedEmail.is_safe,
        func.count(ReportedEmail.id).label("count"),
    ).group_by(ReportedEmail.is_safe).all()

    pie = {"phishing": 0, "safe": 0}
    for is_safe, count in pie_rows:
        pie["safe" if is_safe else "phishing"] = count

    day7 = now - datetime.timedelta(days=7)
    q = db.query(ReportedEmail).filter(ReportedEmail.reported_at >= day7)
    if user_id:
        q = q.filter(ReportedEmail.user_id == user_id)
    bar_phishing_rows = (
        q.filter(ReportedEmail.is_safe == False)
        .with_entities(
            func.date(ReportedEmail.reported_at).label("day"),
            func.count(ReportedEmail.id).label("count"),
        )
        .group_by(func.date(ReportedEmail.reported_at))
        .all()
    )

    phishing_by_day = {row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day): row.count
                       for row in bar_phishing_rows}
    bar_phishing = [
        {
            "date": (now - datetime.timedelta(days=i)).strftime("%Y-%m-%d"),
            "count": phishing_by_day.get((now - datetime.timedelta(days=i)).strftime("%Y-%m-%d"), 0),
        }
        for i in range(6, -1, -1)
    ]

    q = db.query(ReportedEmail).filter(ReportedEmail.reported_at >= day7)
    if user_id:
        q = q.filter(ReportedEmail.user_id == user_id)
    bar_incorrect_rows = (
        q.filter(
            ReportedEmail.proba > 0.5,
            ReportedEmail.is_safe == True,
        )
        .with_entities(
            func.date(ReportedEmail.reported_at).label("day"),
            func.count(ReportedEmail.id).label("count"),
        )
        .group_by(func.date(ReportedEmail.reported_at))
        .all()
    )
    incorrect_by_day = {row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day): row.count
                        for row in bar_incorrect_rows}
    bar_incorrect = [
        {
            "date": (now - datetime.timedelta(days=i)).strftime("%Y-%m-%d"),
            "count": incorrect_by_day.get((now - datetime.timedelta(days=i)).strftime("%Y-%m-%d"), 0),
        }
        for i in range(6, -1, -1)
    ]

    return {
        "pie": pie,
        "bar_phishing": bar_phishing,
        "bar_incorrect": bar_incorrect,
    }
