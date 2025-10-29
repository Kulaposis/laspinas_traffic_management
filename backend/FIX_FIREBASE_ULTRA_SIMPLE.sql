-- ULTRA SIMPLE VERSION
-- Run this single command in Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;
