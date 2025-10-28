# Firebase-Backend User Sync Solution

## Problem

You're logged in with Firebase (Gmail authentication), but the backend database doesn't recognize you. This causes:
- ❌ 401 Unauthorized errors when saving travel history
- ❌ Backend API calls fail
- ❌ User data not stored in backend database
- ❌ No access to backend-dependent features

## Root Cause

**Firebase** and **Backend** are two separate authentication systems:
- **Firebase**: Handles Google login, stores users in Firebase Auth
- **Backend**: Has its own user database and JWT tokens
- **Problem**: They don't communicate with each other!

```
Firebase User (Gmail) ----X----> Backend Database
                     (not connected)
```

## Solution: Automatic User Sync

When a user logs in with Firebase, automatically create/update their account in the backend database and get a backend JWT token.

```
Firebase Login → Get Firebase Token → Send to Backend → 
Create/Update User in DB → Get Backend JWT → Use for API calls
```

## Frontend Changes (✅ Already Applied)

### 1. Updated AuthContext.js

Added automatic sync when Firebase user logs in:

```javascript
// Get Firebase ID token
const idToken = await firebaseUser.getIdToken();

// Sync with backend
const syncResponse = await authService.syncFirebaseUser({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  emailVerified: firebaseUser.emailVerified,
  idToken: idToken
});

// Store backend token for API calls
if (syncResponse.token) {
  localStorage.setItem('token', syncResponse.token);
}
```

### 2. Updated authService.js

Added `syncFirebaseUser` method:

```javascript
async syncFirebaseUser(firebaseData) {
  const response = await api.post('/auth/firebase-sync', {
    uid: firebaseData.uid,
    email: firebaseData.email,
    full_name: firebaseData.displayName,
    photo_url: firebaseData.photoURL,
    email_verified: firebaseData.emailVerified,
    firebase_token: firebaseData.idToken
  });

  return {
    user: response.data.user,
    token: response.data.access_token
  };
}
```

## Backend Implementation Required

You need to add this endpoint to your backend:

### Endpoint: `POST /auth/firebase-sync`

**File**: `backend/app/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from firebase_admin import auth as firebase_auth
import firebase_admin
from datetime import datetime, timedelta
from jose import jwt

# Initialize Firebase Admin (add to main.py or auth.py)
if not firebase_admin._apps:
    cred = firebase_admin.credentials.Certificate("path/to/firebase-credentials.json")
    firebase_admin.initialize_app(cred)

router = APIRouter()

@router.post("/firebase-sync")
async def sync_firebase_user(
    firebase_data: dict,
    db: Session = Depends(get_db)
):
    """
    Sync Firebase user with backend database
    Creates or updates user and returns backend JWT token
    """
    try:
        # Verify Firebase token
        decoded_token = firebase_auth.verify_id_token(firebase_data['firebase_token'])
        firebase_uid = decoded_token['uid']
        
        # Verify UID matches
        if firebase_uid != firebase_data['uid']:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")
        
        # Check if user exists in database
        user = db.query(User).filter(
            (User.firebase_uid == firebase_uid) | 
            (User.email == firebase_data['email'])
        ).first()
        
        if user:
            # Update existing user
            user.firebase_uid = firebase_uid
            user.email = firebase_data['email']
            user.full_name = firebase_data['full_name']
            user.photo_url = firebase_data.get('photo_url')
            user.email_verified = firebase_data.get('email_verified', False)
            user.updated_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                firebase_uid=firebase_uid,
                email=firebase_data['email'],
                full_name=firebase_data['full_name'],
                username=firebase_data['email'].split('@')[0],  # Generate username from email
                photo_url=firebase_data.get('photo_url'),
                email_verified=firebase_data.get('email_verified', False),
                role='citizen',  # Default role
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(user)
        
        db.commit()
        db.refresh(user)
        
        # Generate backend JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "user_id": user.id},
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "username": user.username,
                "role": user.role,
                "photo_url": user.photo_url,
                "email_verified": user.email_verified,
                "firebase_uid": user.firebase_uid
            }
        }
        
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
```

### Database Migration

Add `firebase_uid` column to users table:

**File**: `backend/alembic/versions/xxx_add_firebase_uid.py`

```python
"""add firebase_uid to users

Revision ID: xxx
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('users', sa.Column('firebase_uid', sa.String(128), nullable=True, unique=True))
    op.add_column('users', sa.Column('photo_url', sa.String(512), nullable=True))
    op.create_index('ix_users_firebase_uid', 'users', ['firebase_uid'])

def downgrade():
    op.drop_index('ix_users_firebase_uid')
    op.drop_column('users', 'photo_url')
    op.drop_column('users', 'firebase_uid')
```

### Update User Model

**File**: `backend/app/models/user.py`

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String(128), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, index=True)
    username = Column(String(50), unique=True, index=True)
    full_name = Column(String(100))
    photo_url = Column(String(512), nullable=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for Firebase users
    role = Column(String(50), default='citizen')
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Firebase Admin Setup

1. **Get Firebase Service Account Key**:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `firebase-credentials.json` in `backend/` folder

2. **Install Firebase Admin SDK**:
   ```bash
   pip install firebase-admin
   ```

3. **Add to requirements.txt**:
   ```
   firebase-admin==6.2.0
   ```

4. **Initialize in main.py**:
   ```python
   import firebase_admin
   from firebase_admin import credentials
   
   # Initialize Firebase Admin
   if not firebase_admin._apps:
       cred = credentials.Certificate("firebase-credentials.json")
       firebase_admin.initialize_app(cred)
   ```

## How It Works

### User Flow

1. **User clicks "Sign in with Google"**
   ```
   Frontend → Firebase Auth → Google Login → Firebase Token
   ```

2. **Frontend gets Firebase user**
   ```javascript
   const firebaseUser = auth.currentUser;
   const idToken = await firebaseUser.getIdToken();
   ```

3. **Frontend syncs with backend**
   ```javascript
   POST /auth/firebase-sync
   {
     uid: "firebase-uid-123",
     email: "user@gmail.com",
     full_name: "John Doe",
     firebase_token: "eyJhbGc..."
   }
   ```

4. **Backend verifies and creates/updates user**
   ```python
   # Verify Firebase token
   decoded = firebase_auth.verify_id_token(token)
   
   # Create/update user in database
   user = User(firebase_uid=uid, email=email, ...)
   db.add(user)
   
   # Generate backend JWT
   token = create_access_token(user)
   ```

5. **Frontend stores backend token**
   ```javascript
   localStorage.setItem('access_token', token);
   ```

6. **All API calls now work!**
   ```javascript
   // API calls include backend token
   api.get('/traffic/sessions') // ✅ Works!
   ```

## Benefits

### ✅ Single Sign-On
- Users log in once with Google
- Automatically authenticated with backend
- Seamless experience

### ✅ Data Persistence
- User data stored in backend database
- Travel history saves successfully
- All backend features work

### ✅ Security
- Firebase handles authentication
- Backend verifies Firebase tokens
- Secure token exchange

### ✅ Flexibility
- Supports both Firebase and traditional login
- Users can use either method
- Unified user management

## Testing

### Test the Sync

1. **Log in with Google**:
   - Click "Sign in with Google"
   - Complete Google authentication

2. **Check Browser Console**:
   ```
   ✅ Firebase user logged in
   ✅ Syncing with backend...
   ✅ Backend token received
   ✅ User synced successfully
   ```

3. **Test API Call**:
   ```javascript
   // Try saving travel history
   await travelHistoryService.saveTravelSession({...});
   // Should work now! ✅
   ```

4. **Check Backend Database**:
   ```sql
   SELECT * FROM users WHERE firebase_uid = 'your-firebase-uid';
   -- Should see your user record
   ```

## Troubleshooting

### Issue: "Invalid Firebase token"
**Solution**: Make sure Firebase Admin SDK is initialized with correct credentials

### Issue: "User not found in database"
**Solution**: Check if `/auth/firebase-sync` endpoint exists and is working

### Issue: "Still getting 401 errors"
**Solution**: Verify backend token is stored in localStorage:
```javascript
console.log(localStorage.getItem('access_token'));
```

### Issue: "Firebase credentials not found"
**Solution**: Download service account key from Firebase Console and place in backend folder

## Summary

**Before**:
- ❌ Firebase and backend disconnected
- ❌ 401 errors on API calls
- ❌ Travel history not saving
- ❌ User data not in database

**After**:
- ✅ Automatic user sync
- ✅ Backend token generated
- ✅ All API calls work
- ✅ Data persists in database
- ✅ Seamless user experience

## Next Steps

1. ✅ **Frontend updated** (already done)
2. ⏳ **Add backend endpoint** (`/auth/firebase-sync`)
3. ⏳ **Add database migration** (firebase_uid column)
4. ⏳ **Setup Firebase Admin SDK**
5. ⏳ **Test the sync**

---

**Once the backend endpoint is implemented, Firebase users will automatically sync with your database and all features will work!** 🎉
