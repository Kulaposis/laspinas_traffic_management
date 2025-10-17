from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status
from ..models.notification import Notification
from ..models.user import User
from ..schemas.notification_schema import NotificationCreate, NotificationUpdate

class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    def create_notification(self, notification_data: NotificationCreate) -> Notification:
        """Create a new notification."""
        db_notification = Notification(
            title=notification_data.title,
            message=notification_data.message,
            notification_type=notification_data.notification_type,
            priority=notification_data.priority,
            user_id=notification_data.user_id,
            is_broadcast=notification_data.is_broadcast,
            latitude=notification_data.latitude,
            longitude=notification_data.longitude
        )
        
        self.db.add(db_notification)
        self.db.commit()
        self.db.refresh(db_notification)
        
        return db_notification

    def create_broadcast_notification(self, notification_data: NotificationCreate) -> Notification:
        """Create a broadcast notification for all users."""
        notification_data.is_broadcast = True
        notification_data.user_id = None
        
        return self.create_notification(notification_data)

    def get_user_notifications(self, user_id: int, skip: int = 0, limit: int = 50, unread_only: bool = False) -> List[Notification]:
        """Get notifications for a specific user."""
        query = self.db.query(Notification).filter(
            (Notification.user_id == user_id) | (Notification.is_broadcast == True)
        )
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    def get_notification_by_id(self, notification_id: int) -> Notification:
        """Get a specific notification by ID."""
        notification = self.db.query(Notification).filter(Notification.id == notification_id).first()
        
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found"
            )
        
        return notification

    def mark_as_read(self, notification_id: int, user: User) -> Notification:
        """Mark a notification as read."""
        notification = self.get_notification_by_id(notification_id)
        
        # Check if user has access to this notification
        if notification.user_id and notification.user_id != user.id and not notification.is_broadcast:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this notification"
            )
        
        notification.is_read = True
        from datetime import datetime
        notification.read_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(notification)
        
        return notification

    def mark_all_as_read(self, user: User) -> bool:
        """Mark all notifications as read for a user."""
        from datetime import datetime
        
        # Update user-specific notifications
        self.db.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.utcnow()
        })
        
        # Update broadcast notifications
        self.db.query(Notification).filter(
            Notification.is_broadcast == True,
            Notification.is_read == False
        ).update({
            "is_read": True,
            "read_at": datetime.utcnow()
        })
        
        self.db.commit()
        return True

    def get_unread_count(self, user_id: int) -> int:
        """Get count of unread notifications for a user."""
        return self.db.query(Notification).filter(
            (Notification.user_id == user_id) | (Notification.is_broadcast == True),
            Notification.is_read == False
        ).count()

    def delete_notification(self, notification_id: int, user: User) -> bool:
        """Delete a notification (admin only)."""
        if user.role.value != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can delete notifications"
            )
        
        notification = self.get_notification_by_id(notification_id)
        self.db.delete(notification)
        self.db.commit()
        
        return True
