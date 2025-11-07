from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import text
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.user_schema import UserCreate, UserResponse, Token, FirebaseSync
from ..services.auth_service import AuthService
from ..services.activity_logger import get_activity_logger
from ..auth import get_current_user
from ..models.user import User, UserRole
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
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """Login user and return access token. Rate limited to 5 attempts per minute."""
    # Rate limiting is handled by middleware in main.py
    auth_service = AuthService(db)
    activity_logger = get_activity_logger(db)
    
    # Get client info
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    
    try:
        result = auth_service.login_user(form_data.username, form_data.password)
        
        # Log successful login
        try:
            activity_logger.log_login_success(
                user=result["user"],
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            # Log error but don't fail login if logging fails
            logger.error(f"Failed to log login success: {log_error}")
        
        return {
            "access_token": result["access_token"],
            "token_type": result["token_type"]
        }
    except HTTPException as e:
        # Log failed login
        try:
            activity_logger.log_login_failure(
                username=form_data.username,
                reason=e.detail,
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            # Log error but don't fail the exception if logging fails
            logger.error(f"Failed to log login failure: {log_error}")
        raise e
    except Exception as e:
        # Catch any unexpected errors to prevent 500
        logger.error(f"Unexpected error during login: {str(e)}", exc_info=True)
        
        # Log failed login
        try:
            activity_logger.log_login_failure(
                username=form_data.username,
                reason=f"Internal server error: {str(e)}",
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            logger.error(f"Failed to log login failure: {log_error}")
        
        # Return a proper 401 error instead of 500
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
        
        user_role = result["user"].role
        if hasattr(user_role, "value"):
            role_value = user_role.value
        elif isinstance(user_role, str):
            role_value = user_role
        else:
            role_value = UserRole.CITIZEN.value

        return {
            "access_token": result["access_token"],
            "token_type": result["token_type"],
            "user": {
                "id": result["user"].id,
                "email": result["user"].email,
                "full_name": result["user"].full_name,
                "username": result["user"].username,
                "role": role_value,
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

@router.get("/debug/firebase-sync")
def debug_firebase_sync(db: Session = Depends(get_db)):
    """
    Debug endpoint to test Firebase sync functionality
    """
    try:
        # Test database connection (SQLAlchemy 2.0)
        db_check = db.scalar(text("SELECT 1"))
        db_status = "connected" if db_check == 1 else f"unexpected_result:{db_check}"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    # Check if Firebase Admin is available
    firebase_status = "not_available"
    try:
        from ..services.auth_service import firebase_admin, firebase_auth
        if firebase_admin and firebase_auth:
            firebase_status = "available"
    except Exception as e:
        firebase_status = f"error: {str(e)}"
    
    # Check user table schema
    try:
        from ..models.user import User
        user_columns = User.__table__.columns.keys()
        schema_status = "ok"
    except Exception as e:
        schema_status = f"error: {str(e)}"
        user_columns = []
    
    return {
        "database": db_status,
        "db_check": 1 if db_status == "connected" else None,
        "firebase_admin": firebase_status,
        "user_schema": schema_status,
        "user_columns": user_columns,
        "required_columns": ["firebase_uid", "photo_url", "email_verified"],
        "missing_columns": [col for col in ["firebase_uid", "photo_url", "email_verified"] if col not in user_columns]
    }
