import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://appuser:apppassword@db:5432/appdb"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def migrate_user_role_enum(target_engine):
    if target_engine.dialect.name != "postgresql":
        return

    with target_engine.begin() as connection:
        viewer_exists = connection.execute(text("""
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'userrole' AND enum_value.enumlabel = 'viewer'
            LIMIT 1
        """)).first()
        user_exists = connection.execute(text("""
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'userrole' AND enum_value.enumlabel = 'user'
            LIMIT 1
        """)).first()

        if viewer_exists and not user_exists:
            connection.execute(text("ALTER TYPE userrole RENAME VALUE 'viewer' TO 'user'"))

        connection.execute(text("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'"))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
