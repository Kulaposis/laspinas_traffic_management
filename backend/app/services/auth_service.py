from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from ..models.user import User
from ..schemas.user_schema import UserCreate
from ..auth import get_password_hash, authenticate_user, create_access_token
from datetime import timedelta, datetime

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
        firebase_uid = firebase_data.get('uid')
        email = firebase_data.get('email')
        
        if not firebase_uid or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Firebase UID and email are required"
            )
        
        # Check if user exists by Firebase UID or email
        user = self.db.query(User).filter(
            (User.firebase_uid == firebase_uid) | (User.email == email)
        ).first()
        
        if user:
            # Update existing user
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
            
            user = User(
                firebase_uid=firebase_uid,
                email=email,
                username=username,
                full_name=firebase_data.get('full_name', email.split('@')[0]),
                photo_url=firebase_data.get('photo_url'),
                email_verified=firebase_data.get('email_verified', False),
                hashed_password=None,  # No password for Firebase users
                role='citizen',  # Default role
                is_active=True
            )
            self.db.add(user)
        
        self.db.commit()
        self.db.refresh(user)
        
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
