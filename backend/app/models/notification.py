from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class NotificationType(enum.Enum):
    TRAFFIC_ALERT = "TRAFFIC_ALERT"
    VIOLATION_UPDATE = "VIOLATION_UPDATE"
    REPORT_UPDATE = "REPORT_UPDATE"
    SYSTEM_ANNOUNCEMENT = "SYSTEM_ANNOUNCEMENT"
    WEATHER_ALERT = "WEATHER_ALERT"
    EMERGENCY = "EMERGENCY"

class NotificationPriority(enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType, name='notificationtype', create_type=False), nullable=False)
    priority = Column(Enum(NotificationPriority, name='notificationpriority', create_type=False), default=NotificationPriority.MEDIUM, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for broadcast messages
    is_read = Column(Boolean, default=False, nullable=False)
    is_broadcast = Column(Boolean, default=False, nullable=False)  # Send to all users
    latitude = Column(String(20), nullable=True)  # For location-based notifications
    longitude = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
