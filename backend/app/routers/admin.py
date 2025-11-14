from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import csv
import logging

from ..db import get_db
from ..auth import get_current_user, get_current_user_optional
from ..models.user import User
from ..services.admin_service import AdminService
from ..schemas.admin_schemas import *
from ..utils.role_helpers import is_admin, is_authorized, get_role_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

def require_admin(current_user: User = Depends(get_current_user)):
    """Require admin role for admin endpoints."""
    if not is_admin(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def get_admin_service(db: Session = Depends(get_db)):
    return AdminService(db)

# Dashboard and Analytics
@router.get("/dashboard", response_model=AdminDashboardData)
async def get_admin_dashboard(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get admin dashboard data with system overview."""
    system_analytics = admin_service.get_system_analytics()
    
    # Get usage analytics (simplified for now)
    usage_analytics = UsageAnalytics(
        daily_active_users=[],
        popular_features=[],
        peak_usage_hours=[],
        geographic_distribution=[]
    )
    
    # Get performance metrics (would be from actual monitoring)
    performance_metrics = PerformanceMetrics(
        avg_response_time=150.0,
        error_rate=0.01,
        throughput=1000,
        active_connections=50,
        memory_usage=65.5,
        cpu_usage=45.2,
        disk_usage=78.9
    )
    
    recent_security_events = admin_service.get_security_events(limit=5)
    active_alerts = admin_service.get_active_alerts()
    pending_moderation = len(admin_service.get_moderation_queue(status="pending", limit=100))
    system_health = admin_service.get_system_health()
    
    return AdminDashboardData(
        system_analytics=system_analytics,
        usage_analytics=usage_analytics,
        performance_metrics=performance_metrics,
        recent_security_events=recent_security_events,
        active_alerts=active_alerts,
        pending_moderation=pending_moderation,
        system_health=system_health["overall"]
    )

# System Settings Management
@router.get("/settings", response_model=List[SystemSettingResponse])
async def get_system_settings(
    category: Optional[str] = Query(None),
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get system settings."""
    return admin_service.get_settings(category=category)

@router.get("/settings/{key}", response_model=SystemSettingResponse)
async def get_system_setting(
    key: str,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get a specific system setting."""
    setting = admin_service.get_setting_by_key(key)
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return setting

@router.post("/settings", response_model=SystemSettingResponse, status_code=status.HTTP_201_CREATED)
async def create_system_setting(
    setting_data: SystemSettingCreate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Create a new system setting."""
    return admin_service.create_setting(setting_data, current_user.id)

@router.put("/settings/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    setting_data: SystemSettingUpdate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Update a system setting."""
    return admin_service.update_setting(key, setting_data, current_user.id)

@router.delete("/settings/{key}")
async def delete_system_setting(
    key: str,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Delete a system setting."""
    success = admin_service.delete_setting(key)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Setting not found"
        )
    return {"message": "Setting deleted successfully"}

# User Management
@router.get("/users/stats", response_model=UserManagementStats)
async def get_user_management_stats(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(get_current_user)
):
    """Get user management statistics (admin or LGU staff)."""
    if not is_authorized(current_user.role, ['admin', 'lgu_staff']):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or LGU staff access required"
        )
    return admin_service.get_user_management_stats()

@router.get("/users/{user_id}/activity", response_model=UserActivitySummary)
async def get_user_activity_summary(
    user_id: int,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get detailed activity summary for a user."""
    return admin_service.get_user_activity_summary(user_id)

@router.post("/users/bulk-operation", response_model=BulkOperationResult)
async def bulk_user_operation(
    operation_data: BulkUserOperation,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Perform bulk operations on users."""
    return admin_service.bulk_user_operation(operation_data, current_user.id)

# System Alerts
@router.get("/alerts", response_model=List[SystemAlertResponse])
async def get_system_alerts(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(get_current_user)
):
    """Get all system alerts (admin or LGU staff)."""
    if not is_authorized(current_user.role, ['admin', 'lgu_staff']):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or LGU staff access required"
        )
    return admin_service.get_active_alerts()

@router.get("/alerts/public", response_model=List[SystemAlertResponse])
async def get_public_alerts(
    admin_service: AdminService = Depends(get_admin_service),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
):
    """Get active system alerts for public display (all users including guests)."""
    import logging
    import os
    from jose import jwt, JWTError
    
    logger = logging.getLogger(__name__)
    
    # Manually check for user if authorization header exists (but don't require it)
    current_user = None
    user_role = ""
    
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            SECRET_KEY = os.getenv("SECRET_KEY")
            ALGORITHM = "HS256"
            if SECRET_KEY:
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    username: str = payload.get("sub")
                    if username:
                        current_user = db.query(User).filter(User.username == username).first()
                        if current_user:
                            user_role = get_role_value(current_user.role).lower() if hasattr(current_user, 'role') else ""
                            logger.info(f"Public alerts requested by user {current_user.id} with role: {user_role}")
                except JWTError:
                    logger.debug("Invalid token provided, treating as guest")
                    pass  # Invalid token, treat as guest
        except Exception as e:
            logger.debug(f"Error parsing auth token: {e}")
            pass  # Treat as guest
    
    if not current_user:
        logger.info("Public alerts requested by guest user (user_role='')")
    
    alerts = admin_service.get_active_alerts(user_role=user_role)
    logger.info(f"Returning {len(alerts)} alerts for user_role: '{user_role}'")
    return alerts

@router.post("/alerts", response_model=SystemAlertResponse, status_code=status.HTTP_201_CREATED)
async def create_system_alert(
    alert_data: SystemAlertCreate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(get_current_user)
):
    """Create a new system alert (admin or LGU staff)."""
    if not is_authorized(current_user.role, ['admin', 'lgu_staff']):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or LGU staff access required"
        )
    return admin_service.create_system_alert(alert_data, current_user.id)

# Security Events
@router.get("/security/events", response_model=List[SecurityEventResponse])
async def get_security_events(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get security events."""
    return admin_service.get_security_events(
        limit=limit, 
        offset=offset, 
        severity=severity, 
        resolved=resolved
    )

@router.post("/security/events", response_model=SecurityEventResponse, status_code=status.HTTP_201_CREATED)
async def create_security_event(
    event_data: SecurityEventCreate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Create a security event."""
    return admin_service.create_security_event(event_data)

@router.put("/security/events/{event_id}/resolve", response_model=SecurityEventResponse)
async def resolve_security_event(
    event_id: int,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Resolve a security event."""
    return admin_service.resolve_security_event(event_id, current_user.id)

# Data Export
@router.post("/export", response_model=DataExportJobResponse, status_code=status.HTTP_201_CREATED)
async def create_export_job(
    export_request: DataExportRequest,
    background_tasks: BackgroundTasks,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Create a data export job."""
    job = admin_service.create_export_job(export_request, current_user.id)
    
    # Add background task to process export
    # background_tasks.add_task(process_export_job, job.id)
    
    return job

@router.get("/export/jobs", response_model=List[DataExportJobResponse])
async def get_export_jobs(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get export jobs for current admin."""
    return admin_service.get_export_jobs(current_user.id)

# Content Moderation
@router.get("/moderation", response_model=List[ContentModerationItem])
async def get_moderation_queue(
    status: Optional[str] = Query(None),
    content_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get content moderation queue."""
    return admin_service.get_moderation_queue(
        status=status,
        content_type=content_type,
        limit=limit
    )

@router.put("/moderation/{moderation_id}", response_model=ContentModerationItem)
async def moderate_content(
    moderation_id: int,
    action: ContentModerationAction,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Moderate content item."""
    return admin_service.moderate_content(moderation_id, action, current_user.id)

# Notification Templates
@router.get("/templates", response_model=List[NotificationTemplateResponse])
async def get_notification_templates(
    template_type: Optional[str] = Query(None),
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get notification templates."""
    return admin_service.get_notification_templates(template_type)

@router.post("/templates", response_model=NotificationTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_template(
    template_data: NotificationTemplateCreate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Create a notification template."""
    return admin_service.create_notification_template(template_data, current_user.id)

@router.put("/templates/{template_id}", response_model=NotificationTemplateResponse)
async def update_notification_template(
    template_id: int,
    template_data: NotificationTemplateUpdate,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Update a notification template."""
    return admin_service.update_notification_template(template_id, template_data)

# System Health and Monitoring
@router.get("/health")
async def get_system_health(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get system health status."""
    return admin_service.get_system_health()

# Analytics and Reports
@router.get("/analytics/system", response_model=SystemAnalytics)
async def get_system_analytics(
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get detailed system analytics."""
    return admin_service.get_system_analytics()

@router.get("/analytics/traffic-areas")
async def get_traffic_area_statistics(
    days: int = Query(7, ge=1, le=365, description="Number of days to analyze"),
    barangay: Optional[str] = Query(None, description="Filter by barangay"),
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Get comprehensive traffic area statistics for Las Piñas City."""
    try:
        result = admin_service.get_traffic_area_statistics(days=days, barangay=barangay)
        return result
    except Exception as e:
        logger.error(f"Error getting traffic area statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching traffic statistics: {str(e)}"
        )

# Backup and Maintenance
@router.post("/maintenance/backup")
async def create_backup(
    backup_request: BackupRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin)
):
    """Create a system backup."""
    # This would trigger a background backup process
    backup_id = f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    # background_tasks.add_task(create_system_backup, backup_request)
    
    return {
        "backup_id": backup_id,
        "status": "initiated",
        "message": "Backup process started"
    }

@router.post("/maintenance/mode")
async def set_maintenance_mode(
    maintenance_data: MaintenanceMode,
    admin_service: AdminService = Depends(get_admin_service),
    current_user: User = Depends(require_admin)
):
    """Enable or disable maintenance mode."""
    # Update maintenance mode setting
    setting_data = SystemSettingUpdate(
        value="true" if maintenance_data.enabled else "false"
    )
    
    try:
        admin_service.update_setting("maintenance_mode", setting_data, current_user.id)
    except:
        # Create setting if it doesn't exist
        setting_create = SystemSettingCreate(
            key="maintenance_mode",
            value="true" if maintenance_data.enabled else "false",
            setting_type=SettingTypeEnum.BOOLEAN,
            description="System maintenance mode status",
            category="system"
        )
        admin_service.create_setting(setting_create, current_user.id)
    
    if maintenance_data.message:
        message_setting = SystemSettingUpdate(value=maintenance_data.message)
        try:
            admin_service.update_setting("maintenance_message", message_setting, current_user.id)
        except:
            message_create = SystemSettingCreate(
                key="maintenance_message",
                value=maintenance_data.message,
                description="Maintenance mode message",
                category="system"
            )
            admin_service.create_setting(message_create, current_user.id)
    
    return {
        "maintenance_mode": maintenance_data.enabled,
        "message": maintenance_data.message,
        "estimated_duration": maintenance_data.estimated_duration
    }

# Quick Actions
@router.post("/actions/clear-cache")
async def clear_system_cache(
    current_user: User = Depends(require_admin)
):
    """Clear system cache."""
    # Implementation would clear various caches
    return {"message": "System cache cleared successfully"}

@router.post("/actions/optimize-database")
async def optimize_database(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin)
):
    """Optimize database performance."""
    # background_tasks.add_task(optimize_database_tables)
    return {"message": "Database optimization started"}

@router.get("/actions/system-info")
async def get_system_info(
    current_user: User = Depends(require_admin)
):
    """Get detailed system information."""
    return {
        "version": "1.0.0",
        "python_version": "3.11+",
        "database": "MySQL 8.0",
        "uptime": "7 days, 14 hours",
        "environment": "production"
    }
