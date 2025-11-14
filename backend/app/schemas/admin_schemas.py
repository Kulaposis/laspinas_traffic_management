from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

# System Settings Schemas
class SettingTypeEnum(str, Enum):
    STRING = "string"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    JSON = "json"
    FLOAT = "float"

class SystemSettingBase(BaseModel):
    key: str
    value: Optional[str] = None
    setting_type: SettingTypeEnum = SettingTypeEnum.STRING
    description: Optional[str] = None
    category: str = "general"
    is_public: bool = False

class SystemSettingCreate(SystemSettingBase):
    pass

class SystemSettingUpdate(BaseModel):
    value: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None

class SystemSettingResponse(SystemSettingBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True

# Notification Template Schemas
class NotificationTemplateBase(BaseModel):
    name: str
    template_type: str  # email, sms, push
    subject: Optional[str] = None
    content: str
    variables: Optional[Dict[str, Any]] = None
    is_active: bool = True

class NotificationTemplateCreate(NotificationTemplateBase):
    pass

class NotificationTemplateUpdate(BaseModel):
    name: Optional[str] = None
    template_type: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class NotificationTemplateResponse(NotificationTemplateBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None

    class Config:
        from_attributes = True

# System Alert Schemas
class SystemAlertBase(BaseModel):
    title: str
    message: str
    alert_type: str  # info, warning, error, maintenance
    target_roles: Optional[List[str]] = None
    is_active: bool = True
    is_dismissible: bool = True
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class SystemAlertCreate(SystemAlertBase):
    pass

class SystemAlertUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    alert_type: Optional[str] = None
    target_roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_dismissible: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class SystemAlertResponse(SystemAlertBase):
    id: int
    created_at: datetime
    created_by: int

    class Config:
        from_attributes = True

# Data Export Schemas
class DataExportRequest(BaseModel):
    export_type: str  # users, reports, violations, etc.
    parameters: Optional[Dict[str, Any]] = None
    job_name: Optional[str] = None

class DataExportJobResponse(BaseModel):
    id: int
    job_name: str
    export_type: str
    status: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    parameters: Optional[Dict[str, Any]] = None
    progress: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    created_by: int

    class Config:
        from_attributes = True

# Security Event Schemas
class SecurityEventCreate(BaseModel):
    event_type: str
    severity: str = "low"
    source_ip: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[int] = None
    description: str
    event_metadata: Optional[Dict[str, Any]] = None

class SecurityEventUpdate(BaseModel):
    is_resolved: Optional[bool] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None

class SecurityEventResponse(BaseModel):
    id: int
    event_type: str
    severity: str
    source_ip: Optional[str] = None
    user_agent: Optional[str] = None
    user_id: Optional[int] = None
    description: str
    event_metadata: Optional[Dict[str, Any]] = None
    is_resolved: bool
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# User Management Schemas
class UserManagementStats(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    users_by_role: Dict[str, int]
    recent_registrations: int
    recent_logins: int

class BulkUserOperation(BaseModel):
    operation: str  # activate, deactivate, change_role, delete
    user_ids: List[int]
    parameters: Optional[Dict[str, Any]] = None

class UserActivitySummary(BaseModel):
    user_id: int
    username: str
    email: str
    full_name: str
    role: str
    last_login: Optional[datetime] = None
    total_reports: int = 0
    total_violations: int = 0
    account_age_days: int = 0
    is_active: bool = True

# System Analytics Schemas
class SystemAnalytics(BaseModel):
    total_users: int
    active_users_today: int
    total_reports: int
    reports_today: int
    total_violations: int
    violations_today: int
    system_uptime: str
    database_size: Optional[str] = None
    api_requests_today: int = 0
    error_rate: float = 0.0

class UsageAnalytics(BaseModel):
    daily_active_users: List[Dict[str, Any]]
    popular_features: List[Dict[str, Any]]
    peak_usage_hours: List[Dict[str, Any]]
    geographic_distribution: List[Dict[str, Any]]

class PerformanceMetrics(BaseModel):
    avg_response_time: float
    error_rate: float
    throughput: int
    active_connections: int
    memory_usage: float
    cpu_usage: float
    disk_usage: float

# Content Moderation Schemas
class ContentModerationItem(BaseModel):
    id: int
    content_type: str
    content_id: int
    reason: str
    status: str
    priority: str
    content_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    review_notes: Optional[str] = None

    class Config:
        from_attributes = True

class ContentModerationAction(BaseModel):
    action: str  # approve, reject
    review_notes: Optional[str] = None

# Backup and Maintenance Schemas
class BackupRequest(BaseModel):
    backup_type: str  # full, incremental
    include_files: bool = True
    description: Optional[str] = None

class BackupResponse(BaseModel):
    id: str
    backup_type: str
    status: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

class MaintenanceMode(BaseModel):
    enabled: bool
    message: Optional[str] = None
    estimated_duration: Optional[int] = None  # minutes

# API Response Schemas
class AdminDashboardData(BaseModel):
    system_analytics: SystemAnalytics
    usage_analytics: UsageAnalytics
    performance_metrics: PerformanceMetrics
    recent_security_events: List[SecurityEventResponse]
    active_alerts: List[SystemAlertResponse]
    pending_moderation: int
    system_health: str

class BulkOperationResult(BaseModel):
    operation: str
    total_items: int
    successful: int
    failed: int
    errors: List[str] = []

# Filter and Search Schemas
class AdminFilterRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    category: Optional[str] = None
    search_query: Optional[str] = None
    limit: int = 50
    offset: int = 0

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    pages: int
    has_next: bool
    has_prev: bool

# Traffic Area Statistics Schemas
class BarangayStatistics(BaseModel):
    barangay: str
    avg_congestion: float
    total_vehicles: int
    road_count: int
    status: str  # LOW, MEDIUM, HIGH, CRITICAL
    trend: str  # increasing, decreasing, stable
    avg_speed_kmh: Optional[float] = None

class RoadStatistics(BaseModel):
    road_name: str
    barangay: str
    congestion_percentage: float
    avg_speed_kmh: float
    peak_hours: List[str]
    vehicle_count: int
    traffic_status: str

class PeakHoursAnalysis(BaseModel):
    hourly_distribution: List[Dict[str, Any]]
    peak_hour: int
    peak_day: str

class GeographicDataPoint(BaseModel):
    latitude: float
    longitude: float
    intensity: float
    area_name: str
    congestion_percentage: float

class TrafficAreaStatisticsResponse(BaseModel):
    period: Dict[str, Any]
    summary: Dict[str, Any]
    by_barangay: List[BarangayStatistics]
    top_congested_roads: List[RoadStatistics]
    peak_hours_analysis: PeakHoursAnalysis
    geographic_data: List[GeographicDataPoint]
    traffic_status_distribution: Dict[str, int]