from datetime import datetime, timedelta
from models import ReportedEmail


def test_get_stats_empty(client, normal_auth_headers):
    response = client.get("/stats", headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert "pie" in data
    assert "bar_phishing" in data
    assert "bar_incorrect" in data
    assert data["pie"]["phishing"] == 0
    assert data["pie"]["safe"] == 0
    assert len(data["bar_phishing"]) == 7
    assert len(data["bar_incorrect"]) == 7


def test_get_stats_with_data(client, db_session, normal_user, normal_auth_headers):
    now = datetime.utcnow()

    records = [
        ReportedEmail(
            title="Phish 1",
            sender="a@test.com",
            user_id=normal_user.id,
            proba=0.9,
            is_detected=True,
            is_safe=False,
            reported_at=now - timedelta(days=1),
        ),
        ReportedEmail(
            title="Safe 1",
            sender="b@test.com",
            user_id=normal_user.id,
            proba=0.2,
            is_detected=False,
            is_safe=True,
            reported_at=now - timedelta(days=2),
        ),
        ReportedEmail(
            title="Incorrect 1",
            sender="c@test.com",
            user_id=normal_user.id,
            proba=0.8,
            is_detected=True,
            is_safe=True,
            reported_at=now - timedelta(days=3),
        ),
    ]

    db_session.add_all(records)
    db_session.commit()

    response = client.get("/stats", headers=normal_auth_headers)

    assert response.status_code == 200
    data = response.json()

    assert data["pie"]["phishing"] >= 1
    assert data["pie"]["safe"] >= 2
    assert len(data["bar_phishing"]) == 7
    assert len(data["bar_incorrect"]) == 7


def test_get_stats_filter_by_user(client, db_session, admin_user, normal_user, admin_auth_headers):
    now = datetime.utcnow()

    db_session.add_all([
        ReportedEmail(
            title="User1 Mail",
            sender="u1@test.com",
            user_id=normal_user.id,
            proba=0.95,
            is_detected=True,
            is_safe=False,
            reported_at=now - timedelta(days=1),
        ),
        ReportedEmail(
            title="Admin Mail",
            sender="admin@test.com",
            user_id=admin_user.id,
            proba=0.1,
            is_detected=False,
            is_safe=True,
            reported_at=now - timedelta(days=1),
        ),
    ])
    db_session.commit()

    response = client.get(f"/stats?user_id={normal_user.id}", headers=admin_auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert data["pie"]["phishing"] == 1
