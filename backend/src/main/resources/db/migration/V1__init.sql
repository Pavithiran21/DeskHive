-- DeskHive schema, version 1.
-- Instants (start_at, end_at, created_at, ...) are DATETIME(6) in UTC: the server runs at +00:00 and
-- Hibernate writes UTC. Opening hours are TIME values in the office's own time zone, and
-- bookings.booking_date is the office-local calendar day, so "one desk a day", the week view and the
-- occupancy report never have to convert zones again.
-- There is no money in DeskHive. Nothing is ever hard-deleted except offices, floors and spaces
-- (when nothing depends on them): a person who deletes their account is anonymised, never removed,
-- so their past bookings stay in the reports as "Former employee".

CREATE TABLE offices (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    name                VARCHAR(80)  NOT NULL,
    address             VARCHAR(200) NOT NULL,
    -- IANA zone such as "Asia/Kolkata". Read-only after creation: bookings were chosen in it.
    time_zone           VARCHAR(64)  NOT NULL,
    -- Booking rules (per office, changed by an Admin; changes apply to new bookings only).
    opens_at            TIME         NOT NULL DEFAULT '08:00:00',
    closes_at           TIME         NOT NULL DEFAULT '19:00:00',
    book_ahead_days     INT          NOT NULL DEFAULT 14,
    max_booking_minutes INT          NOT NULL DEFAULT 480,
    created_at          DATETIME(6)  NOT NULL,
    updated_at          DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_offices_name UNIQUE (name),
    CONSTRAINT chk_offices_hours CHECK (opens_at < closes_at),
    CONSTRAINT chk_offices_book_ahead CHECK (book_ahead_days BETWEEN 1 AND 60),
    CONSTRAINT chk_offices_max_booking CHECK (max_booking_minutes >= 30 AND max_booking_minutes % 30 = 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE floors (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    office_id  BIGINT      NOT NULL,
    name       VARCHAR(60) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_floors_office_name UNIQUE (office_id, name),
    CONSTRAINT fk_floors_office FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- A desk or a meeting room. Desk: area, row_label and seat_number place it on the seat map.
-- Room: name and capacity. The CHECKs keep each type's columns consistent.
CREATE TABLE spaces (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    floor_id    BIGINT      NOT NULL,
    type        VARCHAR(4)  NOT NULL,
    area        VARCHAR(60) NULL,
    row_label   CHAR(1)     NULL,
    seat_number INT         NULL,
    name        VARCHAR(80) NULL,
    capacity    INT         NULL,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    -- NULLs never collide in a MySQL UNIQUE index, so rooms (no row or number) are not affected.
    CONSTRAINT uq_spaces_seat UNIQUE (floor_id, row_label, seat_number),
    CONSTRAINT uq_spaces_room_name UNIQUE (floor_id, name),
    CONSTRAINT chk_spaces_type CHECK (type IN ('DESK', 'ROOM')),
    CONSTRAINT chk_spaces_desk CHECK (type <> 'DESK' OR (area IS NOT NULL AND row_label IS NOT NULL
        AND seat_number IS NOT NULL AND seat_number BETWEEN 1 AND 99 AND name IS NULL AND capacity IS NULL)),
    CONSTRAINT chk_spaces_room CHECK (type <> 'ROOM' OR (name IS NOT NULL AND capacity BETWEEN 1 AND 50
        AND area IS NULL AND row_label IS NULL AND seat_number IS NULL)),
    CONSTRAINT fk_spaces_floor FOREIGN KEY (floor_id) REFERENCES floors (id) ON DELETE RESTRICT,
    INDEX idx_spaces_floor_type (floor_id, type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Desk: DUAL_MONITOR, STANDING, WINDOW, ACCESSIBLE. Room: SCREEN, VIDEO_CALLS, WHITEBOARD, STEP_FREE.
CREATE TABLE space_features (
    space_id BIGINT      NOT NULL,
    feature  VARCHAR(20) NOT NULL,
    PRIMARY KEY (space_id, feature),
    CONSTRAINT chk_space_features CHECK (feature IN ('DUAL_MONITOR', 'STANDING', 'WINDOW', 'ACCESSIBLE',
        'SCREEN', 'VIDEO_CALLS', 'WHITEBOARD', 'STEP_FREE')),
    CONSTRAINT fk_space_features_space FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- status: ACTIVE (can log in), INVITED (invitation sent, no password yet), REMOVED (an Admin removed the
-- access: final), DELETED (the person deleted their own account: anonymised, hidden from People).
-- An invited row has no password_hash yet.
CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    name          VARCHAR(80)  NOT NULL,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(72)  NULL,
    role          VARCHAR(10)  NOT NULL,
    status        VARCHAR(10)  NOT NULL,
    -- Always set for an Employee; an Admin who was seeded before the first office has none yet.
    office_id     BIGINT       NULL,
    is_demo       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT chk_users_role CHECK (role IN ('EMPLOYEE', 'ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INVITED', 'REMOVED', 'DELETED')),
    CONSTRAINT chk_users_password CHECK (status <> 'ACTIVE' OR password_hash IS NOT NULL),
    CONSTRAINT fk_users_office FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE RESTRICT,
    INDEX idx_users_office_status (office_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- One row per invitation link. Only the SHA-256 of the token is stored. Resend revokes the old row and
-- adds a new one. A link works when it is unused, not revoked and not expired.
CREATE TABLE invitations (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    invited_by BIGINT      NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at    DATETIME(6) NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_invitations_hash UNIQUE (token_hash),
    CONSTRAINT fk_invitations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_invitations_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Only the SHA-256 of each token is stored, so a database leak can't be replayed as a login.
CREATE TABLE refresh_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_refresh_tokens_expires (expires_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE password_reset_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    used_at    DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_password_reset_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_password_reset_tokens_expires (expires_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- A reservation of one desk or room for one person. "Ended" is not a status: it is end_at < now.
-- space_label, floor_name, office_name, space_type and time_zone are snapshots, so a booking still reads correctly
-- in the reports after its space is deleted (space_id then becomes NULL).
-- Two bookings of one space must never overlap while CONFIRMED or CHECKED_IN. MySQL has no exclusion
-- constraint, so BookingService enforces it by locking the space row (see BACKEND.md).
CREATE TABLE bookings (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    space_id         BIGINT       NULL,
    space_label      VARCHAR(100) NOT NULL,
    floor_name       VARCHAR(60)  NOT NULL,
    office_name      VARCHAR(80)  NOT NULL,
    space_type       VARCHAR(4)   NOT NULL,
    office_id        BIGINT       NULL,
    time_zone        VARCHAR(64)  NOT NULL,
    user_id          BIGINT       NOT NULL,
    start_at         DATETIME(6)  NOT NULL,
    end_at           DATETIME(6)  NOT NULL,
    booking_date     DATE         NOT NULL,
    status           VARCHAR(16)  NOT NULL,
    checked_in_at    DATETIME(6)  NULL,
    cancelled_by     BIGINT       NULL,
    cancel_reason    VARCHAR(200) NULL,
    reminder_sent_at DATETIME(6)  NULL,
    created_at       DATETIME(6)  NOT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_bookings_times CHECK (end_at > start_at),
    CONSTRAINT chk_bookings_type CHECK (space_type IN ('DESK', 'ROOM')),
    CONSTRAINT chk_bookings_status CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'AUTO_RELEASED', 'CANCELLED')),
    CONSTRAINT fk_bookings_space FOREIGN KEY (space_id) REFERENCES spaces (id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_office FOREIGN KEY (office_id) REFERENCES offices (id) ON DELETE SET NULL,
    CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_bookings_space_time (space_id, start_at, end_at),
    INDEX idx_bookings_user_date (user_id, booking_date),
    INDEX idx_bookings_office_date (office_id, booking_date, status),
    INDEX idx_bookings_status_start (status, start_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- One summary row per job run: counts only, never an email address or a reason.
CREATE TABLE job_runs (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    run_id        VARCHAR(36) NOT NULL,
    job           VARCHAR(10) NOT NULL,
    trigger_type  VARCHAR(10) NOT NULL,
    status        VARCHAR(10) NOT NULL,
    as_of         DATETIME(6) NOT NULL,
    started_at    DATETIME(6) NOT NULL,
    finished_at   DATETIME(6) NULL,
    bookings_seen INT         NOT NULL DEFAULT 0,
    bookings_done INT         NOT NULL DEFAULT 0,
    skipped       INT         NOT NULL DEFAULT 0,
    email_failures INT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_job_runs_run_id UNIQUE (run_id),
    CONSTRAINT chk_job_runs_job CHECK (job IN ('RELEASE', 'REMINDER')),
    CONSTRAINT chk_job_runs_trigger CHECK (trigger_type IN ('SCHEDULE', 'API')),
    CONSTRAINT chk_job_runs_status CHECK (status IN ('RUNNING', 'FINISHED', 'FAILED'))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
