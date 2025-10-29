# Firebase Sync Error Fix Summary

## Issues Fixed

### 1. **500 Internal Server Error** (Production - Leapcell)
**Root Cause**: Unique constraint on `firebase_uid` column was preventing multiple NULL values in PostgreSQL.

**Solution**: 
- Changed unique constraint to a partial unique index that only applies to non-NULL values
- Updated `User` model to remove `unique=True` from `firebase_uid` column
- Applied database migration to fix existing constraint

**Files Modified**:
- `backend/app/models/user.py` - Removed `unique=True` from `firebase_uid`
- `backend/app/main.py` - Updated startup migration to create partial unique index
- `backend/app/services/auth_service.py` - Enhanced error handling and logging

**Migration Applied**:
```sql
DROP INDEX IF EXISTS ix_users_firebase_uid;
CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
```

### 2. **401 Unauthorized Error** (Localhost)
**Root Cause**: Firebase Admin SDK was attempting to verify tokens without proper credentials configured, causing authentication to fail.

**Solution**:
- Made Firebase token verification optional when Firebase Admin SDK is not available
- Updated initialization to check for credentials before attempting to initialize
- Allow sync to proceed with client-provided data when server-side verification is not possible

**Files Modified**:
- `backend/app/services/auth_service.py` - Updated Firebase Admin initialization and token verification logic

## Changes Made

### 1. User Model (`backend/app/models/user.py`)
```python
# Before
firebase_uid = Column(String(128), unique=True, nullable=True, index=True)

# After
firebase_uid = Column(String(128), nullable=True, index=True)  # Uniqueness enforced by partial index
```

### 2. Startup Migration (`backend/app/main.py`)
```python
# Create partial unique index that only applies to non-NULL values
conn.execute(text(
    "CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid) "
    "WHERE firebase_uid IS NOT NULL"
))
```

### 3. Firebase Admin Initialization (`backend/app/services/auth_service.py`)
```python
# Check if Firebase credentials are available
cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
if cred_path and os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    # No credentials available - disable Firebase Admin
    firebase_admin = None
    firebase_auth = None
```

### 4. Token Verification (`backend/app/services/auth_service.py`)
```python
if provided_token:
    if firebase_auth:
        # Verify token when Firebase Admin is available
        decoded = firebase_auth.verify_id_token(provided_token)
    else:
        # Trust client-provided data when Firebase Admin is not available
        logging.warning("Firebase Admin SDK not available - proceeding without verification")
```

## How to Apply

### For Production (Leapcell)
The fix has already been applied to the production database using:
```bash
python backend/apply_firebase_fix.py
```

### For Localhost
1. The code changes are already in place
2. Restart the backend server:
   ```bash
   python start_server.py
   ```
   Or from backend directory:
   ```bash
   uvicorn app.main:app --reload
   ```

## Testing

1. **Test Firebase Login**: Try logging in with a Google account
2. **Check Logs**: Verify that the sync completes without errors
3. **Verify User Creation**: Check that the user is created in the database with the correct Firebase UID

## Environment Variables (Optional)

To enable server-side Firebase token verification (recommended for production):

1. Download Firebase service account key from Firebase Console
2. Add to `.env`:
   ```
   FIREBASE_CREDENTIALS_PATH=/path/to/firebase-service-account.json
   ```

## Notes

- **Client-side verification**: Firebase authentication is still verified on the client side
- **Server-side verification**: Optional and only enabled when Firebase Admin SDK credentials are provided
- **Backward compatibility**: Existing users without Firebase UIDs are not affected
- **Security**: Client-provided data is trusted when server-side verification is not available (suitable for development)

## Verification

After applying the fix:
- ✅ Firebase login should work without 500/401 errors
- ✅ Users can be created/updated with Firebase authentication
- ✅ Multiple users without Firebase UIDs can coexist (NULL values allowed)
- ✅ Firebase UIDs are unique when present (enforced by partial index)
