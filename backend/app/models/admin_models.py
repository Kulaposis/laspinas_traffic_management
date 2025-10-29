from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Enum, ForeignKey, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class SettingType(enum.Enum):
    STRING = "string"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    JSON = "json"
    FLOAT = "float"

class SystemSetting(Base):
    """System configuration settings"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    setting_type = Column(Enum(SettingType, name='settingtype', create_type=False), default=SettingType.STRING)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="general")
    is_public = Column(Boolean, default=False)  # Whether setting can be viewed by non-admins
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationship
    updater = relationship("User", foreign_keys=[updated_by])

class NotificationTemplate(Base):
    """Email/SMS notification templates"""
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    template_type = Column(String(50), nullable=False)  # email, sms, push
    subject = Column(String(500), nullable=True)  # For email templates
    content = Column(Text, nullable=False)
    variables = Column(JSON, nullable=True)  # Available template variables
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationship
    creator = relationship("User", foreign_keys=[created_by])

class SystemAlert(Base):
    """System-wide alerts and announcements"""
    __tablename__ = "system_alerts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    alert_type = Column(String(50), nullable=False)  # info, warning, error, maintenance
    target_roles = Column(JSON, nullable=True)  # Which user roles should see this
    is_active = Column(Boolean, default=True)
    is_dismissible = Column(Boolean, default=True)
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationship
    creator = relationship("User", foreign_keys=[created_by])

class DataExportJob(Base):
    """Track data export jobs"""
    __tablename__ = "data_export_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_name = Column(String(255), nullable=False)
    export_type = Column(String(100), nullable=False)  # users, reports, violations, etc.
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    parameters = Column(JSON, nullable=True)  # Export parameters/filters
    progress = Column(Integer, default=0)  # 0-100
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationship
    creator = relationship("User", foreign_keys=[created_by])

class SecurityEvent(Base):
    """Security-related events and alerts"""
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False)  # failed_login, suspicious_activity, etc.
    severity = Column(String(20), default="low")  # low, medium, high, critical
    source_ip = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    description = Column(Text, nullable=False)
    event_metadata = Column(JSON, nullable=True)  # Additional event data
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

class SystemMetric(Base):
    """System performance and usage metrics"""
    __tablename__ = "system_metrics"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(255), nullable=False)
    metric_value = Column(Float, nullable=False)
    metric_type = Column(String(50), nullable=False)  # counter, gauge, histogram
    tags = Column(JSON, nullable=True)  # Additional metric tags
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class UserSession(Base):
    """Track user sessions for security monitoring"""
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    # Relationship
    user = relationship("User", back_populates="sessions")

class ContentModerationQueue(Base):
    """Queue for content that needs moderation"""
    __tablename__ = "content_moderation_queue"

    id = Column(Integer, primary_key=True, index=True)
    content_type = Column(String(50), nullable=False)  # report, image, comment
    content_id = Column(Integer, nullable=False)
    reason = Column(String(255), nullable=False)  # Why it needs moderation
    status = Column(String(50), default="pending")  # pending, approved, rejected
    priority = Column(String(20), default="normal")  # low, normal, high, urgent
    content_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)

    # Relationship
    reviewer = relationship("User", foreign_keys=[reviewed_by])
