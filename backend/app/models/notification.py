from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class NotificationType(enum.Enum):
    TRAFFIC_ALERT = "traffic_alert"
    VIOLATION_UPDATE = "violation_update"
    REPORT_UPDATE = "report_update"
    SYSTEM_ANNOUNCEMENT = "system_announcement"
    WEATHER_ALERT = "weather_alert"
    EMERGENCY = "emergency"

class NotificationPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.MEDIUM, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null for broadcast messages
    is_read = Column(Boolean, default=False, nullable=False)
    is_broadcast = Column(Boolean, default=False, nullable=False)  # Send to all users
    latitude = Column(String(20), nullable=True)  # For location-based notifications
    longitude = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="notifications")
