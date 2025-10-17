from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ActivityTypeEnum(str, Enum):
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

class ActivityLogBase(BaseModel):
    activity_type: ActivityTypeEnum
    activity_description: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    session_id: Optional[str] = None
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    location_description: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    is_successful: bool = True
    error_message: Optional[str] = None
    response_time_ms: Optional[int] = None

class ActivityLogCreate(ActivityLogBase):
    user_id: Optional[int] = None

class ActivityLogResponse(ActivityLogBase):
    id: int
    user_id: Optional[int]
    created_at: datetime
    
    # User information (if available)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True

class SystemLogBase(BaseModel):
    log_level: str = Field(..., pattern="^(INFO|WARNING|ERROR|CRITICAL)$")
    service_name: str
    message: str
    error_code: Optional[str] = None
    stack_trace: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None

class SystemLogCreate(SystemLogBase):
    pass

class SystemLogResponse(SystemLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogBase(BaseModel):
    action: str = Field(..., pattern="^(CREATE|UPDATE|DELETE|VIEW)$")
    table_name: str
    record_id: Optional[int] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    user_id: int

class AuditLogResponse(AuditLogBase):
    id: int
    user_id: int
    created_at: datetime
    
    # User information
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None

    class Config:
        from_attributes = True

class LogsFilterRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    user_id: Optional[int] = None
    activity_types: Optional[List[ActivityTypeEnum]] = None
    resource_type: Optional[str] = None
    is_successful: Optional[bool] = None
    search_query: Optional[str] = None
    limit: int = Field(default=50, le=500)
    offset: int = Field(default=0, ge=0)

class LogsStatistics(BaseModel):
    total_activities: int
    successful_activities: int
    failed_activities: int
    unique_users: int
    most_active_users: List[Dict[str, Any]]
    activity_breakdown: Dict[str, int]
    hourly_activity: List[Dict[str, Any]]
    daily_activity: List[Dict[str, Any]]

class UserActivitySummary(BaseModel):
    user_id: int
    user_name: str
    user_email: str
    user_role: str
    total_activities: int
    last_activity: Optional[datetime]
    most_common_activities: List[Dict[str, Any]]
    login_count: int
    failed_login_count: int
