from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..models.notification import NotificationType, NotificationPriority

class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.MEDIUM
    is_broadcast: bool = False
    latitude: Optional[str] = None
    longitude: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: Optional[int] = None

class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    notification_type: Optional[NotificationType] = None
    priority: Optional[NotificationPriority] = None
    is_read: Optional[bool] = None

class NotificationResponse(NotificationBase):
    id: int
    user_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True
