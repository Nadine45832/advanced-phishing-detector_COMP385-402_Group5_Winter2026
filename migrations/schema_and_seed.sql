
DO $$ BEGIN
    CREATE TYPE userrole AS ENUM ('admin', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
 

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL       PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          userrole     NOT NULL DEFAULT 'viewer',
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL
);
 
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);
 
INSERT INTO users (username, password_hash, role, first_name, last_name)
VALUES (
    'admin',
    '$2b$12$2BcDgZny3k.XwM.P7n8/oe6sxFBa.09c5Id8ADGtJ6cEgoVSkviEa',
    'admin',
    'Admin',
    'User'
)
ON CONFLICT (username) DO NOTHING;