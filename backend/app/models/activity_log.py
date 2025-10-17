import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .user import Base

class ActivityType(enum.Enum):
    # Authentication activities
    LOGIN = "login"
    LOGOUT = "logout"
    FAILED_LOGIN = "failed_login"
    PASSWORD_CHANGE = "password_change"
    
    # Emergency activities
    EMERGENCY_CREATED = "emergency_created"
    EMERGENCY_UPDATED = "emergency_updated"
    EMERGENCY_RESOLVED = "emergency_resolved"
    COMPLAINT_CREATED = "complaint_created"
    COMPLAINT_UPDATED = "complaint_updated"
    
    # Traffic activities
    TRAFFIC_REPORT_CREATED = "traffic_report_created"
    TRAFFIC_REPORT_UPDATED = "traffic_report_updated"
    VIOLATION_REPORTED = "violation_reported"
    VIOLATION_UPDATED = "violation_updated"
    
    # Parking activities
    PARKING_SPOT_CREATED = "parking_spot_created"
    PARKING_SPOT_UPDATED = "parking_spot_updated"
    PARKING_VIOLATION_REPORTED = "parking_violation_reported"
    
    # Report activities
    REPORT_CREATED = "report_created"
    REPORT_UPDATED = "report_updated"
    REPORT_VERIFIED = "report_verified"
    REPORT_REJECTED = "report_rejected"
    
    # Notification activities
    NOTIFICATION_SENT = "notification_sent"
    NOTIFICATION_READ = "notification_read"
    
    # Weather activities
    WEATHER_ALERT_CREATED = "weather_alert_created"
    WEATHER_DATA_UPDATED = "weather_data_updated"
    
    # System activities
    DATA_EXPORT = "data_export"
    SETTINGS_CHANGED = "settings_changed"
    USER_ROLE_CHANGED = "user_role_changed"
    
    # File activities
    FILE_UPLOADED = "file_uploaded"
    FILE_DOWNLOADED = "file_downloaded"
    
    # API activities
    API_ACCESS = "api_access"
    BULK_OPERATION = "bulk_operation"

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for system activities
    activity_type = Column(String(50), nullable=False)  # ActivityType enum value
    activity_description = Column(Text, nullable=False)
    
    # Context information
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True)
    
    # Location information
    latitude = Column(String(20), nullable=True)
    longitude = Column(String(20), nullable=True)
    location_description = Column(Text, nullable=True)
    
    # Additional metadata
    extra_data = Column(JSON, nullable=True)  # Store additional context data
    resource_type = Column(String(50), nullable=True)  # e.g., "emergency", "report", "user"
    resource_id = Column(Integer, nullable=True)  # ID of the affected resource
    
    # Success/failure tracking
    is_successful = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Performance tracking
    response_time_ms = Column(Integer, nullable=True)
    
    # Audit trail
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", backref="activity_logs")

    def __repr__(self):
        return f"<ActivityLog(id={self.id}, user_id={self.user_id}, type={self.activity_type}, created_at={self.created_at})>"

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_level = Column(String(20), nullable=False)  # INFO, WARNING, ERROR, CRITICAL
    service_name = Column(String(100), nullable=False)  # e.g., "weather_service", "notification_service"
    message = Column(Text, nullable=False)
    
    # Error details
    error_code = Column(String(50), nullable=True)
    stack_trace = Column(Text, nullable=True)
    
    # Context
    extra_data = Column(JSON, nullable=True)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<SystemLog(id={self.id}, level={self.log_level}, service={self.service_name}, created_at={self.created_at})>"

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)  # CREATE, UPDATE, DELETE, VIEW
    table_name = Column(String(100), nullable=False)
    record_id = Column(Integer, nullable=True)
    
    # Data changes
    old_values = Column(JSON, nullable=True)  # Previous values for updates
    new_values = Column(JSON, nullable=True)  # New values for creates/updates
    
    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Timing
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", backref="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action={self.action}, table={self.table_name}, created_at={self.created_at})>"
