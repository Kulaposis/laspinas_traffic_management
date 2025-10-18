from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..db import get_db
from ..schemas.user_schema import UserCreate, UserResponse, Token
from ..services.auth_service import AuthService
from ..services.activity_logger import get_activity_logger
from ..auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])

class FirebaseUserCreate(BaseModel):
    uid: str
    email: EmailStr
    display_name: str
    email_verified: bool = False

@router.post("/sync-firebase-user", response_model=Token)
def sync_firebase_user(
    firebase_user: FirebaseUserCreate,
    db: Session = Depends(get_db)
):
    """Sync Firebase user with backend database and return access token."""
    auth_service = AuthService(db)

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == firebase_user.email).first()

    if existing_user:
        # User exists, just return token
        access_token = auth_service.create_access_token_for_user(existing_user)
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    # Determine user role - check if this should be an admin user
    user_role = "citizen"  # Default role

    # Check if no admin exists and this is the first Firebase user, or if email matches known admin patterns
    existing_admin = db.query(User).filter(User.role.in_(["admin", "lgu_staff"])).first()
    admin_emails = ["admin@example.com", "admin@traffic.com"]  # Add known admin emails

    if not existing_admin and (firebase_user.email in admin_emails or "admin" in firebase_user.email.lower()):
        user_role = "admin"
    elif "staff" in firebase_user.email.lower() or "lgu" in firebase_user.email.lower():
        user_role = "lgu_staff"

    # Generate unique username for Firebase user
    base_username = firebase_user.email.split('@')[0]
    username = base_username
    counter = 1

    # Ensure username is unique
    while db.query(User).filter(User.username == username).first():
        username = f"{base_username}_{counter}"
        counter += 1

    # Create new user
    user_data = UserCreate(
        email=firebase_user.email,
        username=username,
        full_name=firebase_user.display_name,
        password="firebase_user",  # Dummy password for Firebase users
        role=user_role
    )

    user = auth_service.register_user(user_data)

    # Create access token
    access_token = auth_service.create_access_token_for_user(user)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    auth_service = AuthService(db)
    user = auth_service.register_user(user_data)
    return user

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Login user and return access token."""
    auth_service = AuthService(db)
    activity_logger = get_activity_logger(db)
    
    # Get client info
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    
    try:
        result = auth_service.login_user(form_data.username, form_data.password)
        
        # Log successful login
        activity_logger.log_login_success(
            user=result["user"],
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            "access_token": result["access_token"],
            "token_type": result["token_type"]
        }
    except HTTPException as e:
        # Log failed login
        activity_logger.log_login_failure(
            username=form_data.username,
            reason=e.detail,
            ip_address=ip_address,
            user_agent=user_agent
        )
        raise e

@router.post("/logout")
def logout(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout user (log the activity)."""
    activity_logger = get_activity_logger(db)
    
    # Get client info
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    
    # Log logout
    activity_logger.log_logout(
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    return {"message": "Logged out successfully"}
