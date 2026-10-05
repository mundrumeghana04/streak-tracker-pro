-- Streak Tracker Pro - Supabase Database Schema
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

CREATE TABLE IF NOT EXISTS streak_reminders (
    id TEXT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    endpoint TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    priority TEXT,
    goal_type TEXT DEFAULT 'unlimited',
    target_days INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    last_completed TEXT,
    reminder_enabled BOOLEAN DEFAULT true,
    reminder_time TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    subscription JSONB NOT NULL,
    last_reminder_sent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for fast querying during scheduler execution
CREATE INDEX IF NOT EXISTS idx_streak_reminders_enabled ON streak_reminders (reminder_enabled);
CREATE INDEX IF NOT EXISTS idx_streak_reminders_task_id ON streak_reminders (task_id);
CREATE INDEX IF NOT EXISTS idx_streak_reminders_endpoint ON streak_reminders (endpoint);

-- Enable Row Level Security (RLS)
ALTER TABLE streak_reminders ENABLE ROW LEVEL SECURITY;

-- Allow Netlify Functions using SERVICE ROLE KEY to perform all operations
CREATE POLICY "Service role full access on streak_reminders"
    ON streak_reminders
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ====================================================================
-- StreakUp v1.3: One-Time Task Reminders (Separate Table)
-- ====================================================================

CREATE TABLE IF NOT EXISTS task_reminders (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reminder_date TEXT NOT NULL,
    reminder_time TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    subscription JSONB NOT NULL,
    notification_sent BOOLEAN DEFAULT false,
    reminder_sent BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for fast querying during scheduler execution
CREATE INDEX IF NOT EXISTS idx_task_reminders_notif_sent ON task_reminders (notification_sent);
CREATE INDEX IF NOT EXISTS idx_task_reminders_sent ON task_reminders (reminder_sent);
CREATE INDEX IF NOT EXISTS idx_task_reminders_endpoint ON task_reminders (endpoint);
CREATE INDEX IF NOT EXISTS idx_task_reminders_date_time ON task_reminders (reminder_date, reminder_time);

-- Enable Row Level Security (RLS)
ALTER TABLE task_reminders ENABLE ROW LEVEL SECURITY;

-- Allow Netlify Functions using SERVICE ROLE KEY to perform all operations
CREATE POLICY "Service role full access on task_reminders"
    ON task_reminders
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

