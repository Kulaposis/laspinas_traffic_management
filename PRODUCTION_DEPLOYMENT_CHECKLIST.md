# Production Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Changes Ready
All fixes have been applied to the codebase:

1. **Firebase Sync** ✅
   - `backend/app/services/auth_service.py` - Graceful Firebase Admin fallback
   - `backend/app/models/user.py` - Removed `unique=True` from `firebase_uid`
   - `frontend/src/services/authService.js` - Stores user data in localStorage

2. **Enum Values** ✅
   - All models updated to match Supabase enum values
   - `roadtype` and `trafficstatus` use lowercase
   - All other enums use UPPERCASE

3. **Database Configuration** ✅
   - All models use `create_type=False` for enums
   - Partial unique index for `firebase_uid`

## Database Migration Required

### ⚠️ CRITICAL: Run This SQL on Production Database

Before deploying, run this SQL in your Supabase SQL Editor:

```sql
-- Fix firebase_uid unique constraint
BEGIN;

-- Drop existing unique constraint if it exists
DROP INDEX IF EXISTS ix_users_firebase_uid;
DROP INDEX IF EXISTS users_firebase_uid_key;

-- Create partial unique index (allows multiple NULL values)
CREATE UNIQUE INDEX ix_users_firebase_uid 
ON users(firebase_uid) 
WHERE firebase_uid IS NOT NULL;

-- Verify
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
  AND indexname = 'ix_users_firebase_uid';

COMMIT;
```

## Deployment Steps

### 1. Apply Database Migration
```bash
# Run the SQL above in Supabase SQL Editor
# OR use the Python script:
cd backend
python apply_firebase_fix.py
```

### 2. Commit and Push Code
```bash
git add .
git commit -m "Fix: Firebase sync, WebSocket, enum values, and traffic data"
git push origin main
```

### 3. Verify Production Deployment
After deployment completes:

#### Test Firebase Login
1. Go to your production URL
2. Click "Sign in with Google"
3. Complete authentication
4. Should see:
   - ✅ User logged in successfully
   - ✅ No 500 errors
   - ✅ No 401 errors
   - ✅ User data stored
   - ✅ WebSocket connected (if applicable)

#### Test Traffic Data
1. Go to Traffic Intelligence dashboard
2. Should see:
   - ✅ Real traffic counts (not all zeros)
   - ✅ Traffic percentages
   - ✅ Smart Traffic Insights with data
   - ✅ Traffic heatmap on map

## Expected Behavior After Deployment

### Firebase Authentication Flow
1. User signs in with Google (Firebase)
2. Frontend sends data to `/auth/firebase-sync`
3. Backend creates/updates user in Supabase
4. Backend returns JWT token + user data
5. Frontend stores token and user data
6. WebSocket connects (if user has numeric ID)
7. User can access all features

### Traffic Data
- Updates every 60 seconds from TomTom API
- 46 monitoring points across Las Piñas City
- Real-time traffic status (free_flow, light, moderate, heavy, standstill)

## Rollback Plan

If issues occur after deployment:

### 1. Database Rollback
```sql
-- Revert to old unique constraint (if needed)
DROP INDEX IF EXISTS ix_users_firebase_uid;
ALTER TABLE users ADD CONSTRAINT users_firebase_uid_key UNIQUE (firebase_uid);
```

### 2. Code Rollback
```bash
git revert HEAD
git push origin main
```

## Post-Deployment Verification

### Check Backend Logs
Look for these success messages:
```
Firebase sync request received for UID: xxx
Firebase sync successful for user: xxx
Traffic update completed: 44 from API
```

### Check Frontend Console
Should NOT see:
- ❌ Firebase sync error: 500
- ❌ Firebase sync error: 401
- ❌ "User id is not numeric"
- ❌ "main_road is not among defined enum values"

Should see:
- ✅ Firebase sync successful
- ✅ User data stored
- ✅ Traffic data loaded

## Environment Variables

### Production Backend (.env)
```env
DATABASE_URL=postgresql://postgres.xgjferkrcsecctzlloqh:Davepogi123%40@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
SECRET_KEY=your-production-secret-key
ENVIRONMENT=production
```

### Optional (for Firebase Admin SDK)
```env
FIREBASE_CREDENTIALS_PATH=/path/to/firebase-service-account.json
```

## Files Changed in This Deployment

### Backend (13 files)
- `app/models/user.py` - Firebase UID constraint
- `app/services/auth_service.py` - Firebase Admin graceful fallback
- `app/models/traffic.py` - Enum values (lowercase)
- `app/models/weather.py` - Enum values (UPPERCASE)
- `app/models/violation.py` - Enum values (UPPERCASE)
- `app/models/transportation.py` - Enum values (UPPERCASE)
- `app/models/surveillance.py` - Enum values (UPPERCASE)
- `app/models/rewards.py` - Enum values (UPPERCASE)
- `app/models/report.py` - Enum values (UPPERCASE)
- `app/models/parking.py` - Enum values (UPPERCASE)
- `app/models/notification.py` - Enum values (UPPERCASE)
- `app/models/footprint.py` - Enum values (UPPERCASE)
- `app/models/events.py` - Enum values (UPPERCASE)

### Frontend (1 file)
- `src/services/authService.js` - Store user data after Firebase sync

## Success Criteria

✅ Firebase login works without errors
✅ Users created in Supabase with `firebase_uid`
✅ WebSocket connects successfully
✅ Traffic data displays (not all zeros)
✅ No enum value errors in logs
✅ No console errors in browser

## Support

If issues persist after deployment:
1. Check backend logs for specific errors
2. Check Supabase logs
3. Verify database migration was applied
4. Test API endpoints directly
5. Check CORS configuration

---

## 🚀 Ready to Deploy!

Once you've run the database migration SQL, you can safely push all code to production.
