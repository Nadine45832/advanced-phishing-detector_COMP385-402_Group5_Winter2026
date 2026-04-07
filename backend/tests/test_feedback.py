from auth import hash_password
from models import Feedback, ReportedEmail, User


def test_submit_feedback_creates_reported_email_and_feedback(client, normal_auth_headers):
    payload = {
        "email_subject": "Verify your account",
        "email_from": "phish@example.com",
        "risk_level": "high",
        "phishing_probability": 0.91,
        "user_label": "phishing",
        "comment": "100% phishing",
        "scanned_at": "2026-04-06T10:00:00"
    }

    response = client.post("/feedback", json=payload, headers=normal_auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert "feedback_id" in data
    assert "reported_email_id" in data


def test_submit_feedback_updates_existing_feedback(
    client, normal_auth_headers, reported_email_for_user, feedback_for_user
):
    payload = {
        "email_subject": "Important Notice",
        "email_from": "test@example.com",
        "risk_level": "medium",
        "phishing_probability": 0.72,
        "user_label": "safe",
        "comment": "This may be safe",
        "scanned_at": "2026-04-06T10:00:00"
    }

    response = client.post("/feedback", json=payload, headers=normal_auth_headers)

    assert response.status_code == 201
    data = response.json()
    assert data["feedback_id"] == feedback_for_user.id
    assert data["reported_email_id"] == reported_email_for_user.id


def test_get_feedbacks_for_normal_user_only_own_feedback(
    client, normal_auth_headers, feedback_for_user
):
    response = client.get("/feedback", headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "Looks suspicious"
    assert data[0]["email_subject"] == "Important Notice"


def test_get_feedbacks_admin_can_filter_by_user(
    client, db_session, admin_auth_headers, normal_user, reported_email_for_user, feedback_for_user
):
    response = client.get(f"/feedback?user_id={normal_user.id}", headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["user_id"] == normal_user.id


def test_delete_feedback_success(client, normal_auth_headers, feedback_for_user):
    response = client.delete(f"/feedback/{feedback_for_user.id}", headers=normal_auth_headers)

    assert response.status_code == 204
    assert response.text == ""


def test_delete_feedback_admin_can_delete_any_feedback(client, admin_auth_headers, feedback_for_user):
    response = client.delete(f"/feedback/{feedback_for_user.id}", headers=admin_auth_headers)

    assert response.status_code == 204
    assert response.text == ""


def test_delete_feedback_forbidden_for_other_user(client, db_session, normal_user, normal_auth_headers):
    other_user = User(
        username="otheruser",
        password_hash=hash_password("otherpassword"),
        role=normal_user.role,
        first_name="Other",
        last_name="User",
    )

    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    other_email = ReportedEmail(
        title="Other Notice",
        sender="other@example.com",
        user_id=other_user.id,
        proba=0.12,
        is_detected=False,
        is_safe=True,
    )
    db_session.add(other_email)
    db_session.commit()
    db_session.refresh(other_email)

    other_feedback = Feedback(
        reported_email_id=other_email.id,
        content="Other user feedback",
    )
    db_session.add(other_feedback)
    db_session.commit()
    db_session.refresh(other_feedback)

    response = client.delete(f"/feedback/{other_feedback.id}", headers=normal_auth_headers)

    assert response.status_code == 403
    assert response.json()["detail"] == "You can only delete your own feedback"


def test_delete_feedback_not_found(client, normal_auth_headers):
    response = client.delete("/feedback/9999", headers=normal_auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Feedback not found"


def test_feedback_requires_auth(client):
    payload = {
        "email_subject": "Verify your account",
        "email_from": "phish@example.com",
        "risk_level": "high",
        "phishing_probability": 0.91,
        "user_label": "phishing",
        "comment": "Definitely phishing"
    }

    response = client.post("/feedback", json=payload)

    assert response.status_code in (401, 403)
