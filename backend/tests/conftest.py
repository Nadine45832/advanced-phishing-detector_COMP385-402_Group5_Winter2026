import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


TEST_DATABASE_URL = "sqlite:///./test.db"

import database


database.engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
database.SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=database.engine,
)

from database import get_db, SessionLocal
from models import Base, User, ReportedEmail, Feedback, UserRole
from app import app
from auth import hash_password, create_access_token


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=database.engine)
    Base.metadata.create_all(bind=database.engine)
    yield
    Base.metadata.drop_all(bind=database.engine)
    database.engine.dispose()

    db_file = Path("./test.db")
    if db_file.exists():
        db_file.unlink()


@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=database.engine)
    Base.metadata.create_all(bind=database.engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def normal_user(db_session):
    user = User(
        username="testuser",
        password_hash=hash_password("password123"),
        role=UserRole.user,
        first_name="Test",
        last_name="User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    user = User(
        username="admin",
        password_hash=hash_password("adminpass"),
        role=UserRole.admin,
        first_name="Admin",
        last_name="User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def normal_auth_headers(normal_user):
    token = create_access_token(
        {
            "sub": str(normal_user.id),
            "username": normal_user.username,
            "role": normal_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(admin_user):
    token = create_access_token(
        {
            "sub": str(admin_user.id),
            "username": admin_user.username,
            "role": admin_user.role.value,
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def reported_email_for_user(db_session, normal_user):
    email = ReportedEmail(
        title="Important Notice",
        sender="test@example.com",
        user_id=normal_user.id,
        proba=0.85,
        is_detected=True,
        is_safe=False,
    )
    db_session.add(email)
    db_session.commit()
    db_session.refresh(email)
    return email


@pytest.fixture
def feedback_for_user(db_session, reported_email_for_user):
    feedback = Feedback(
        reported_email_id=reported_email_for_user.id,
        content="Looks suspicious",
    )
    db_session.add(feedback)
    db_session.commit()
    db_session.refresh(feedback)
    return feedback
