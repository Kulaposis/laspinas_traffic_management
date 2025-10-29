-- Fix Firebase UID unique constraint to allow multiple NULL values
-- This script should be run on the production database

-- Drop the existing unique constraint/index if it exists
DROP INDEX IF EXISTS ix_users_firebase_uid;
DROP INDEX IF EXISTS users_firebase_uid_key;

-- Create a partial unique index that only applies to non-NULL values
-- This allows multiple NULL values while ensuring uniqueness for actual Firebase UIDs
CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;

-- Verify the index was created
SELECT 
    indexname, 
    indexdef 
FROM 
    pg_indexes 
WHERE 
    tablename = 'users' 
    AND indexname = 'ix_users_firebase_uid';
