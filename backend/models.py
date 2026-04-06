from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, ForeignKey,
    create_engine, Enum
)
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)

    # Relationships
    reported_emails = relationship("ReportedEmail", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username!r}, role={self.role!r})>"


class ReportedEmail(Base):
    __tablename__ = "reported_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=True)
    content = Column(String, nullable=True)
    sender = Column(String, nullable=True)
    is_safe = Column(Boolean, default=False)
    is_detected = Column(Boolean, default=False)
    proba = Column(Float, default=0)
    reported_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    user = relationship("User", back_populates="reported_emails")
    feedbacks = relationship("Feedback", back_populates="reported_email")

    def __repr__(self):
        return f"<ReportedEmail(id={self.id}, sender={self.sender!r}, is_safe={self.is_safe})>"


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reported_email_id = Column(Integer, ForeignKey("reported_emails.id"), nullable=False)
    content = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    reported_email = relationship("ReportedEmail", back_populates="feedbacks")

    def __repr__(self):
        return f"<Feedback(id={self.id}, reported_email_id={self.reported_email_id})>"


def init_db(engine):
    """Create all tables in the target database."""
    Base.metadata.create_all(engine)