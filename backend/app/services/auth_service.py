from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from ..models.user import User, UserRole
from ..schemas.user_schema import UserCreate
from ..auth import get_password_hash, authenticate_user, create_access_token
from datetime import timedelta, datetime
from sqlalchemy.exc import IntegrityError
import logging

# Optional Firebase Admin SDK (used for verifying ID tokens)
try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials
    import os
    
    if not firebase_admin._apps:
        # Check if Firebase credentials are available
        cred_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
        if cred_path and os.path.exists(cred_path):
            # Initialize with service account credentials
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            logging.getLogger(__name__).info("Firebase Admin SDK initialized with service account credentials")
        else:
            # No credentials available - disable Firebase Admin
            logging.getLogger(__name__).warning("Firebase credentials not found - Firebase Admin SDK disabled")
            firebase_admin = None
            firebase_auth = None
except Exception as _firebase_err:  # noqa: F841
    # Do not fail if Firebase Admin is not available; we'll skip verification
    firebase_admin = None
    firebase_auth = None
    logging.getLogger(__name__).warning(f"Firebase Admin SDK initialization failed: {_firebase_err}")

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def register_user(self, user_data: UserCreate) -> User:
        """Register a new user."""
        # Check if user already exists
        existing_user = self.db.query(User).filter(
            (User.email == user_data.email) | 
            (User.username == user_data.username)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email or username already exists"
            )
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            phone_number=user_data.phone_number,
            role=user_data.role
        )
        
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        
        return db_user

    def login_user(self, username: str, password: str) -> dict:
        """Authenticate user and return access token."""
        user = authenticate_user(self.db, username, password)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inactive user"
            )
        
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

    def sync_firebase_user(self, firebase_data: dict) -> dict:
        """
        Sync Firebase user with backend database.
        Creates or updates user and returns access token.
        """
        # If a Firebase ID token is provided, verify it server-side when possible
        provided_token = firebase_data.get('firebase_token') or firebase_data.get('idToken')
        if provided_token:
            if firebase_auth:
                # Firebase Admin SDK is available - verify the token
                try:
                    decoded = firebase_auth.verify_id_token(provided_token)
                    # Trust claims from verified token
                    firebase_data['uid'] = decoded.get('uid')
                    firebase_data['email'] = decoded.get('email') or firebase_data.get('email')
                    firebase_data['email_verified'] = decoded.get('email_verified', firebase_data.get('email_verified', False))
                    logging.getLogger(__name__).info(f"Firebase token verified for UID: {firebase_data['uid']}")
                except Exception as verify_err:
                    logging.getLogger(__name__).error(f"Firebase token verification failed: {verify_err}")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid Firebase ID token: {verify_err}"
                    )
            else:
                # Firebase Admin SDK not available - trust client-provided data
                logging.getLogger(__name__).warning("Firebase Admin SDK not available - proceeding without server-side token verification (client-side verification assumed)")
        else:
            logging.getLogger(__name__).warning("No Firebase token provided - proceeding with client-provided data only")

        firebase_uid = firebase_data.get('uid')
        email = firebase_data.get('email')
        
        if not firebase_uid or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Firebase UID and email are required"
            )
        
        # Check if user exists by Firebase UID or email
        user_by_uid = self.db.query(User).filter(User.firebase_uid == firebase_uid).first()
        user_by_email = self.db.query(User).filter(User.email == email).first()

        try:
            if user_by_uid and user_by_email and user_by_uid.id != user_by_email.id:
                logging.getLogger(__name__).warning(f"Firebase UID conflict: UID {firebase_uid} belongs to {user_by_uid.email} but email {email} belongs to different user")
                user_by_uid.firebase_uid = None
                self.db.flush()
                user = user_by_email
            else:
                user = user_by_uid or user_by_email

            if user:
                # Update existing user
                logging.getLogger(__name__).info(f"Updating existing user: {user.email} (ID: {user.id})")
                user.firebase_uid = firebase_uid
                user.email = email
                user.full_name = firebase_data.get('full_name', user.full_name)
                user.photo_url = firebase_data.get('photo_url')
                user.email_verified = firebase_data.get('email_verified', False)
                user.updated_at = datetime.utcnow()
            else:
                # Create new user from Firebase data
                username = email.split('@')[0]  # Generate username from email
                
                # Ensure username is unique
                base_username = username
                counter = 1
                while self.db.query(User).filter(User.username == username).first():
                    username = f"{base_username}{counter}"
                    counter += 1
                
                logging.getLogger(__name__).info(f"Creating new user: {email} with username: {username}")
                user = User(
                    firebase_uid=firebase_uid,
                    email=email,
                    username=username,
                    full_name=firebase_data.get('full_name', email.split('@')[0]),
                    photo_url=firebase_data.get('photo_url'),
                    email_verified=firebase_data.get('email_verified', False),
                    hashed_password="",  # No password for Firebase users
                    role=UserRole.CITIZEN,  # Default role
                    is_active=True
                )
                self.db.add(user)
            
            self.db.commit()
            self.db.refresh(user)
            logging.getLogger(__name__).info(f"User sync successful: {user.email} (ID: {user.id}, Firebase UID: {user.firebase_uid})")
        except IntegrityError as db_err:
            self.db.rollback()
            logging.getLogger(__name__).error(f"Integrity error during user sync: {db_err}", exc_info=True)
            # Check if it's a duplicate key error
            error_msg = str(db_err)
            if "firebase_uid" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This Firebase account is already linked to another user"
                )
            elif "email" in error_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Account conflict or constraint violation while syncing Firebase user"
                )
        except Exception as db_err:
            self.db.rollback()
            logging.getLogger(__name__).error(f"Database error during user sync: {db_err}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(db_err)}"
            )
        
        # Generate access token
        access_token_expires = timedelta(minutes=30)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }
