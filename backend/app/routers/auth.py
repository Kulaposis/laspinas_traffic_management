from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.user_schema import UserCreate, UserResponse, Token
from ..services.auth_service import AuthService
from ..services.activity_logger import get_activity_logger
from ..auth import get_current_user
from ..models.user import User

router = APIRouter(prefix="/auth", tags=["authentication"])

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
