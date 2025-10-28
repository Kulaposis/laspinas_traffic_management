from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.user_schema import UserCreate, UserResponse, Token, FirebaseSync
from ..services.auth_service import AuthService
from ..services.activity_logger import get_activity_logger
from ..auth import get_current_user
from ..models.user import User
import logging

logger = logging.getLogger(__name__)

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

@router.post("/firebase-sync", status_code=status.HTTP_200_OK)
def firebase_sync(firebase_data: FirebaseSync, db: Session = Depends(get_db)):
    """
    Sync Firebase user with backend database.
    Creates or updates user from Firebase authentication.
    """
    logger.info(f"Firebase sync request received for UID: {firebase_data.uid}, Email: {firebase_data.email}")
    
    auth_service = AuthService(db)
    
    try:
        # Convert Pydantic model to dict for service
        firebase_dict = firebase_data.dict()
        logger.info(f"Firebase data dict: {firebase_dict}")
        
        # Sync user and get token
        result = auth_service.sync_firebase_user(firebase_dict)
        logger.info(f"Firebase sync successful for user: {result['user'].email}")
        
        return {
            "access_token": result["access_token"],
            "token_type": result["token_type"],
            "user": {
                "id": result["user"].id,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "username": result["user"].username,
                "role": result["user"].role.value,
                "photo_url": result["user"].photo_url,
                "email_verified": result["user"].email_verified,
                "firebase_uid": result["user"].firebase_uid
            }
        }
    except HTTPException as e:
        logger.error(f"HTTPException in Firebase sync: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in Firebase sync: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Firebase sync failed: {str(e)}"
        )

@router.post("/firebase_sync", status_code=status.HTTP_200_OK)
def firebase_sync_alias(firebase_data: FirebaseSync, db: Session = Depends(get_db)):
    """
    Alias endpoint for compatibility: /auth/firebase_sync
    """
    return firebase_sync(firebase_data, db)

@router.get("/test")
def test_endpoint():
    return {"message": "Auth router is working"}
