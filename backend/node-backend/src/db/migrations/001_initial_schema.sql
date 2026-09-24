-- ============================================
-- AttendAI Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================
-- This migration creates all core tables for 
-- the AttendAI attendance system.
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS
-- ============================================
-- Stores all system users: students, teachers, admins.
-- Role is stored as a column since AttendAI has exactly
-- 3 fixed roles — no need for a separate roles table.

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        user_role NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on email for login lookups
CREATE INDEX idx_users_email ON users (email);

-- Index on role for role-based queries
CREATE INDEX idx_users_role ON users (role);


-- ============================================
-- 2. CLASSES
-- ============================================
-- Represents a course/class (e.g., "DBMS - Section A").
-- Multiple teachers can be assigned via class_teachers.

CREATE TABLE classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(150) NOT NULL,
    section     VARCHAR(20),
    semester    VARCHAR(20),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- ============================================
-- 3. CLASS_TEACHERS (Junction Table)
-- ============================================
-- Many-to-many: A class can have multiple teachers,
-- a teacher can teach multiple classes.

CREATE TABLE class_teachers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE (class_id, teacher_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_class_teachers_class ON class_teachers (class_id);
CREATE INDEX idx_class_teachers_teacher ON class_teachers (teacher_id);


-- ============================================
-- 4. ENROLLMENTS (Junction Table)
-- ============================================
-- Many-to-many: A student can be enrolled in multiple 
-- classes, a class can have multiple students.

CREATE TABLE enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate enrollment
    UNIQUE (class_id, student_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_enrollments_class ON enrollments (class_id);
CREATE INDEX idx_enrollments_student ON enrollments (student_id);


-- ============================================
-- 5. SESSIONS
-- ============================================
-- A session is one lecture occurrence within a class.
-- Status tracks the submit-then-lock workflow:
--   'draft'     → attendance can be edited by teacher
--   'submitted' → attendance is locked (only admin can edit)

CREATE TYPE session_status AS ENUM ('draft', 'submitted');

CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    start_time  TIME,
    end_time    TIME,
    status      session_status NOT NULL DEFAULT 'draft',
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying sessions by class
CREATE INDEX idx_sessions_class ON sessions (class_id);

-- Index for querying sessions by date
CREATE INDEX idx_sessions_date ON sessions (date);

-- Index for querying sessions by creator
CREATE INDEX idx_sessions_created_by ON sessions (created_by);


-- ============================================
-- 6. ATTENDANCE_RECORDS
-- ============================================
-- One record per student per session.
-- Created when the AI recognizes students or 
-- when a teacher manually marks attendance.

CREATE TABLE attendance_records (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_present  BOOLEAN NOT NULL DEFAULT false,
    marked_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One attendance record per student per session
    UNIQUE (session_id, student_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_attendance_session ON attendance_records (session_id);
CREATE INDEX idx_attendance_student ON attendance_records (student_id);


-- ============================================
-- 7. ATTENDANCE_SUBMISSIONS (Audit Trail)
-- ============================================
-- Created when a teacher submits/locks attendance.
-- Tracks who submitted and who later edited (admin).
-- One submission per session.

CREATE TABLE attendance_submissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE UNIQUE,
    submitted_by    UUID NOT NULL REFERENCES users(id),
    submitted_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_by       UUID REFERENCES users(id),
    edited_at       TIMESTAMP WITH TIME ZONE
);

-- Index for session lookups
CREATE INDEX idx_submissions_session ON attendance_submissions (session_id);


-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
-- Automatically updates the updated_at column
-- whenever a row is modified.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to classes
CREATE TRIGGER trigger_classes_updated_at
    BEFORE UPDATE ON classes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to sessions
CREATE TRIGGER trigger_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
