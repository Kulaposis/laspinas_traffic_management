from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..auth import get_current_active_user
from ..models.user import User
from ..schemas.notification_schema import NotificationCreate, NotificationResponse
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(
    notification_data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new notification (staff/admin only)."""
    if current_user.role.value not in ['lgu_staff', 'admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to create notifications"
        )
    
    notification_service = NotificationService(db)
    notification = notification_service.create_notification(notification_data)
    return notification

@router.post("/broadcast", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_broadcast_notification(
    notification_data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a broadcast notification for all users (admin only)."""
    if current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create broadcast notifications"
        )
    
    notification_service = NotificationService(db)
    notification = notification_service.create_broadcast_notification(notification_data)
    return notification

@router.get("/", response_model=List[NotificationResponse])
def get_my_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = Query(False, description="Show only unread notifications"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get notifications for the current user."""
    notification_service = NotificationService(db)
    notifications = notification_service.get_user_notifications(
        current_user.id, skip=skip, limit=limit, unread_only=unread_only
    )
    return notifications

@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get count of unread notifications."""
    notification_service = NotificationService(db)
    count = notification_service.get_unread_count(current_user.id)
    return {"unread_count": count}

@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a notification as read."""
    notification_service = NotificationService(db)
    notification = notification_service.mark_as_read(notification_id, current_user)
    return notification

@router.put("/mark-all-read")
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark all notifications as read for the current user."""
    notification_service = NotificationService(db)
    notification_service.mark_all_as_read(current_user)
    return {"message": "All notifications marked as read"}

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a notification (admin only)."""
    notification_service = NotificationService(db)
    notification_service.delete_notification(notification_id, current_user)
    return {"message": "Notification deleted successfully"}
