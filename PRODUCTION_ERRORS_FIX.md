# Production Errors Fix Guide

## Current Errors

### 1. Firebase Sync 500 Error ❌
```
POST /auth/firebase-sync 500 (Internal Server Error)
```

### 2. CORS Error ❌
```
Access to XMLHttpRequest has been blocked by CORS policy
```

---

## Fix Steps

### Step 1: Apply Database Migration (CRITICAL)

**Go to Supabase Dashboard → SQL Editor**

Run this SQL:

```sql
BEGIN;

-- Drop old unique constraint
DROP INDEX IF EXISTS ix_users_firebase_uid;
DROP INDEX IF EXISTS users_firebase_uid_key;

-- Create partial unique index (allows multiple NULL values)
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;

COMMIT;
```

**Verify it worked:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
  AND indexname = 'ix_users_firebase_uid';
```

You should see:
```
indexname: ix_users_firebase_uid
indexdef: CREATE UNIQUE INDEX ix_users_firebase_uid ON public.users USING btree (firebase_uid) WHERE (firebase_uid IS NOT NULL)
```

---

### Step 2: Push CORS Fix

The CORS fix is already in the code. Just commit and push:

```bash
git add backend/app/main.py
git commit -m "Fix: Update CORS configuration for Vercel frontend"
git push origin main
```

---

### Step 3: Set Environment Variable (Optional)

In your Leapcell deployment settings, add:

```
CORS_ORIGINS=https://laspinastrafficmanagement.vercel.app,http://localhost:5173
```

Or leave it empty to allow all origins (for development).

---

### Step 4: Wait for Deployment

After pushing:
1. Wait for Leapcell to redeploy (usually 2-5 minutes)
2. Check deployment logs for success
3. Test Firebase login again

---

## Testing After Fix

### Test 1: Firebase Login
1. Go to https://laspinastrafficmanagement.vercel.app
2. Click "Sign in with Google"
3. Complete authentication
4. Should see: ✅ Login successful (no 500 error)

### Test 2: Check Browser Console
Should NOT see:
- ❌ Firebase sync error 500
- ❌ CORS policy error

Should see:
- ✅ Firebase sync successful
- ✅ User data stored

### Test 3: Check Network Tab
1. Open DevTools → Network
2. Look for `/auth/firebase-sync` request
3. Should return: **200 OK** (not 500)
4. Response should include: `access_token` and `user` data

---

## If Still Not Working

### Check Backend Logs (Leapcell)

Look for these errors:
```
ERROR: duplicate key value violates unique constraint
ERROR: firebase_uid
```

If you see these, the database migration wasn't applied correctly.

### Check CORS Headers

In Network tab, check Response Headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: *
```

If missing, CORS middleware isn't working.

### Manual CORS Test

Try this in browser console:
```javascript
fetch('https://laspinastrafficmanagement-adenj8873-0xfe2ns0.apn.leapcell.dev/health')
  .then(r => r.json())
  .then(console.log)
```

Should return: `{status: "healthy"}` without CORS error.

---

## Summary

✅ **Step 1**: Run SQL migration in Supabase (MOST IMPORTANT)
✅ **Step 2**: Push CORS fix to GitHub
✅ **Step 3**: Wait for deployment
✅ **Step 4**: Test Firebase login

The database migration is the critical step. Without it, Firebase sync will continue to fail with 500 errors.

---

## Quick Commands

```bash
# Commit and push CORS fix
git add backend/app/main.py backend/APPLY_THIS_IN_SUPABASE.sql PRODUCTION_ERRORS_FIX.md
git commit -m "Fix: CORS configuration and add database migration guide"
git push origin main
```

Then go to Supabase and run the SQL migration!
