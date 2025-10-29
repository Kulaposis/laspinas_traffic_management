-- CRITICAL: Run this in Supabase SQL Editor BEFORE testing production
-- This fixes the firebase_uid unique constraint issue

BEGIN;

-- Drop old unique constraint
DROP INDEX IF EXISTS ix_users_firebase_uid;
DROP INDEX IF EXISTS users_firebase_uid_key;

-- Create partial unique index (allows multiple NULL values)
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;

-- Verify it was created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
  AND indexname = 'ix_users_firebase_uid';

COMMIT;

-- You should see output like:
-- indexname: ix_users_firebase_uid
-- indexdef: CREATE UNIQUE INDEX ix_users_firebase_uid ON public.users USING btree (firebase_uid) WHERE (firebase_uid IS NOT NULL)
