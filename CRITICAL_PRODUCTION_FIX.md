# CRITICAL: Production Firebase Sync Fix

## Current Status

### ✅ Localhost
- Firebase sync: **WORKING**
- Users saved to Supabase: **YES** (4 users visible)
- Database migration: **APPLIED**

### ❌ Production
- Firebase sync: **500 ERROR**
- Users saved to Supabase: **NO**
- Database migration: **NOT APPLIED**

---

## The Problem

Production Supabase database still has the old unique constraint on `firebase_uid` that doesn't allow multiple NULL values. When a new Firebase user tries to sync, it fails because:

1. Existing users have `firebase_uid = NULL`
2. Database tries to insert another NULL
3. Unique constraint violation → 500 error

---

## THE FIX (Run This NOW)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

### Step 2: Run This SQL

```sql
-- CRITICAL FIX: Allow multiple NULL values for firebase_uid
BEGIN;

-- Drop the old constraint that blocks NULL values
DROP INDEX IF EXISTS ix_users_firebase_uid CASCADE;
DROP INDEX IF EXISTS users_firebase_uid_key CASCADE;

-- Check if there's a unique constraint on the column
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'users'::regclass 
    AND conname LIKE '%firebase_uid%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;
END $$;

-- Create partial unique index (only enforces uniqueness for non-NULL values)
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;

-- Verify it was created correctly
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users' 
  AND indexname = 'ix_users_firebase_uid';

COMMIT;
```

### Step 3: Verify the Fix

You should see output like:
```
indexname: ix_users_firebase_uid
indexdef: CREATE UNIQUE INDEX ix_users_firebase_uid ON public.users USING btree (firebase_uid) WHERE (firebase_uid IS NOT NULL)
```

The key part is: **WHERE (firebase_uid IS NOT NULL)**

This means:
- ✅ Multiple users can have `firebase_uid = NULL`
- ✅ Firebase UIDs must be unique when they exist
- ✅ No more 500 errors!

---

## Step 4: Test Production

After running the SQL:

1. Go to your production site
2. Click "Sign in with Google"
3. Complete authentication
4. Should see: ✅ **Login successful!**

Check Supabase users table - you should see the new user with:
- `email`: Your Google email
- `firebase_uid`: Your Firebase UID (not NULL)
- `hashed_password`: EMPTY (Firebase users don't need passwords)

---

## Why This Happens

### Database Schema Difference

**Localhost Database:**
```sql
-- Has partial unique index (allows NULL)
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;
```

**Production Database (BEFORE FIX):**
```sql
-- Has full unique constraint (blocks multiple NULL)
ALTER TABLE users ADD CONSTRAINT users_firebase_uid_key UNIQUE (firebase_uid);
-- OR
CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid);
```

### The Difference

| Constraint Type | Multiple NULL Values | Unique Non-NULL Values |
|----------------|---------------------|----------------------|
| Full Unique | ❌ Blocked | ✅ Enforced |
| Partial Unique (WHERE NOT NULL) | ✅ Allowed | ✅ Enforced |

---

## Additional Checks

### Check Current Constraint

Run this to see what constraint exists:
```sql
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'users'::regclass
  AND conname LIKE '%firebase%';
```

### Check Current Index

```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users'
  AND indexname LIKE '%firebase%';
```

---

## After the Fix

### Expected Behavior

1. **New Firebase Users**
   - Sign in with Google
   - User created in Supabase with `firebase_uid`
   - JWT token returned
   - Login successful

2. **Existing Users (NULL firebase_uid)**
   - Can still login with username/password
   - Can link Firebase account later
   - Multiple users can have NULL `firebase_uid`

3. **No More Errors**
   - ❌ 500 Internal Server Error
   - ❌ "duplicate key value violates unique constraint"
   - ✅ Firebase sync works smoothly

---

## Troubleshooting

### If Still Getting 500 Error

1. **Check Backend Logs** (Leapcell Dashboard)
   ```
   Look for: "duplicate key" or "unique constraint"
   ```

2. **Verify Index Was Created**
   ```sql
   \d users  -- Shows table structure
   ```

3. **Check for Multiple Constraints**
   ```sql
   SELECT * FROM pg_constraint 
   WHERE conrelid = 'users'::regclass;
   ```

### If Index Creation Fails

```sql
-- Force drop everything related to firebase_uid
DROP INDEX IF EXISTS ix_users_firebase_uid CASCADE;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_firebase_uid_key CASCADE;

-- Then create the partial index
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;
```

---

## Summary

✅ **Run the SQL in Supabase** (Step 2)
✅ **Verify the index** (Step 3)
✅ **Test Firebase login** (Step 4)
✅ **Check users table** for new entries

This is a **ONE-TIME FIX**. Once applied, Firebase sync will work permanently in production! 🎉

---

## Quick Test Command

After applying the fix, test with curl:
```bash
curl -X POST https://laspinastrafficmanagement-adenj8873-0xfe2ns0.apn.leapcell.dev/auth/firebase-sync \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test123",
    "email": "test@example.com",
    "full_name": "Test User",
    "firebase_token": "dummy_token"
  }'
```

Should return: `200 OK` with access token (not 500 error)
