
DROP TABLE IF EXISTS feedback        CASCADE;
DROP TABLE IF EXISTS link_click      CASCADE;
DROP TABLE IF EXISTS email_scan      CASCADE;
DROP TABLE IF EXISTS reported_emails CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

CREATE TABLE users (
    id            SERIAL          PRIMARY KEY,
    username      VARCHAR(255)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)    NOT NULL,
    role          VARCHAR(50)     NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE reported_emails (
    id          SERIAL          PRIMARY KEY,
    title       VARCHAR(255),
    content     TEXT,
    sender      VARCHAR(255),
    is_safe     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_detected BOOLEAN         NOT NULL DEFAULT FALSE,
    reported_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE email_scan (
    id          SERIAL          PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_phishing BOOLEAN         NOT NULL DEFAULT FALSE,
    score       DOUBLE PRECISION,
    read_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE link_click (
    id       SERIAL          PRIMARY KEY,
    user_id  INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    link     VARCHAR(2048),
    click_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE feedback (
    id                SERIAL          PRIMARY KEY,
    reported_email_id INTEGER         NOT NULL REFERENCES reported_emails(id) ON DELETE CASCADE,
    content           TEXT,
    created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Indexes for common foreign-key lookups
CREATE INDEX idx_reported_emails_user_id    ON reported_emails(user_id);
CREATE INDEX idx_email_scan_user_id         ON email_scan(user_id);
CREATE INDEX idx_link_click_user_id         ON link_click(user_id);
CREATE INDEX idx_feedback_reported_email_id ON feedback(reported_email_id);


INSERT INTO users (username, password_hash, role, created_at) VALUES
    ('alice',   '$2b$12$KIXa1vHXzQmDqL8v3OeXxeY5RfN1UoJkPlQwErTyUiOpAsBgCdEf', 'admin',   '2024-01-10 08:00:00+00'),
    ('bob',     '$2b$12$KIXa1vHXzQmDqL8v3OeXxuZ6SgO2VpKlRmRxFsUvWjQbCtDhEiFg', 'user',    '2024-02-15 09:30:00+00'),
    ('charlie', '$2b$12$KIXa1vHXzQmDqL8v3OeXxvA7ThP3WqLmSnSyGtVwXkRdUeIjFjGh', 'user',    '2024-03-20 14:00:00+00'),
    ('diana',   '$2b$12$KIXa1vHXzQmDqL8v3OeXxwB8UiQ4XrMnToTzHuWxYlSfVfJkGkHi', 'analyst', '2024-04-05 11:15:00+00'),
    ('eve',     '$2b$12$KIXa1vHXzQmDqL8v3OeXxxC9VjR5YsNoPuUaIvXyZmTgWgKlHlIj', 'user',    '2024-05-22 16:45:00+00');


INSERT INTO reported_emails (title, content, sender, is_safe, is_detected, reported_at, user_id) VALUES
    (
        'Verify your account',
        'Click the link below to verify your PayPal account or it will be suspended.',
        'security@paypa1-support.com',
        FALSE, TRUE, '2024-06-01 10:00:00+00', 1
    ),
    (
        'You have won a prize!',
        'Congratulations! You have been selected to receive a $1,000 gift card. Claim now.',
        'noreply@lucky-winner.net',
        FALSE, TRUE, '2024-06-03 13:22:00+00', 2
    ),
    (
        'Team meeting tomorrow',
        'Hi, just a reminder about our standup at 9 AM tomorrow. Please confirm attendance.',
        'manager@company.com',
        TRUE, FALSE, '2024-06-05 08:45:00+00', 3
    ),
    (
        'Invoice #4821 attached',
        'Please find your invoice attached. Payment is due within 30 days of receipt.',
        'billing@trusted-vendor.com',
        TRUE, FALSE, '2024-06-07 15:10:00+00', 4
    ),
    (
        'Urgent: password reset required',
        'Your password has been compromised. Reset it immediately using the link below.',
        'admin@micros0ft-reset.com',
        FALSE, TRUE, '2024-06-09 09:05:00+00', 5
    );

INSERT INTO email_scan (user_id, is_phishing, score, read_at) VALUES
    (1, TRUE,  0.97, '2024-06-01 10:05:00+00'),
    (2, TRUE,  0.88, '2024-06-03 13:30:00+00'),
    (3, FALSE, 0.12, '2024-06-05 08:50:00+00'),
    (4, FALSE, 0.05, '2024-06-07 15:15:00+00'),
    (5, TRUE,  0.93, '2024-06-09 09:10:00+00'),
    (1, FALSE, 0.10, '2024-06-10 11:00:00+00'),
    (2, TRUE,  0.79, '2024-06-11 14:20:00+00'),
    (3, TRUE,  0.85, '2024-06-12 16:35:00+00');

INSERT INTO link_click (user_id, link, click_at) VALUES
    (1, 'http://paypa1-support.com/verify?token=abc123',    '2024-06-01 10:08:00+00'),
    (2, 'http://lucky-winner.net/claim?id=99',              '2024-06-03 13:35:00+00'),
    (3, 'https://company.com/calendar',                     '2024-06-05 08:55:00+00'),
    (5, 'http://micros0ft-reset.com/reset?user=eve',        '2024-06-09 09:12:00+00'),
    (1, 'https://legitimate-site.com/docs',                 '2024-06-10 11:30:00+00'),
    (4, 'https://trusted-vendor.com/invoice/4821',          '2024-06-07 15:20:00+00'),
    (2, 'http://phishing-attempt.biz/login',                '2024-06-11 14:25:00+00');

INSERT INTO feedback (reported_email_id, content, created_at) VALUES
    (1, 'Confirmed phishing — spoofed PayPal domain using typosquatting.',           '2024-06-02 09:00:00+00'),
    (2, 'Classic prize scam. Sender domain was registered only 2 days ago.',         '2024-06-04 10:30:00+00'),
    (3, 'Legitimate internal communication. No action required.',                    '2024-06-06 08:00:00+00'),
    (4, 'Verified vendor. Invoice matches purchase order on file.',                   '2024-06-08 14:00:00+00'),
    (5, 'Phishing attempt abusing Microsoft branding. Domain has been flagged.',      '2024-06-10 08:30:00+00'),
    (1, 'Second review confirms malicious intent. Affected user has been notified.',  '2024-06-03 11:00:00+00');
