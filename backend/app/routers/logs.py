from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io

from ..db import get_db
from ..auth import get_current_user
from ..models import User, ActivityLog, SystemLog, AuditLog
from ..schemas.activity_log_schema import (
    ActivityLogResponse, SystemLogResponse, AuditLogResponse,
    LogsFilterRequest, LogsStatistics, UserActivitySummary,
    ActivityLogCreate, SystemLogCreate, AuditLogCreate
)

router = APIRouter(prefix="/logs", tags=["logs"])

def require_admin_or_staff(current_user: User = Depends(get_current_user)):
    """Require admin or staff role for logs access."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and LGU staff can access logs"
        )
    return current_user

@router.get("/activity")
async def get_activity_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    activity_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    is_successful: Optional[bool] = Query(None),
    search_query: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    format: Optional[str] = Query("list", description="Response format: 'list' or 'paginated'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get activity logs with filtering options."""
    query = db.query(ActivityLog).outerjoin(User, ActivityLog.user_id == User.id)
    
    # Apply filters
    if start_date:
        query = query.filter(ActivityLog.created_at >= start_date)
    if end_date:
        query = query.filter(ActivityLog.created_at <= end_date)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if activity_type:
        query = query.filter(ActivityLog.activity_type == activity_type)
    if resource_type:
        query = query.filter(ActivityLog.resource_type == resource_type)
    if is_successful is not None:
        query = query.filter(ActivityLog.is_successful == is_successful)
    if search_query:
        search_filter = or_(
            ActivityLog.activity_description.contains(search_query),
            User.username.contains(search_query),
            User.email.contains(search_query)
        )
        query = query.filter(search_filter)
    
    # Get total count for pagination
    total_count = query.count()
    
    # Order by most recent first
    query = query.order_by(desc(ActivityLog.created_at))
    
    # Apply pagination
    logs = query.offset(offset).limit(limit).all()
    
    # Format response with user information
    result = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "user_id": log.user_id,
            "activity_type": log.activity_type,
            "activity_description": log.activity_description,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "session_id": log.session_id,
            "latitude": log.latitude,
            "longitude": log.longitude,
            "location_description": log.location_description,
            "extra_data": log.extra_data,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "is_successful": log.is_successful,
            "error_message": log.error_message,
            "response_time_ms": log.response_time_ms,
            "created_at": log.created_at,
            "user_name": log.user.username if log.user else None,
            "user_email": log.user.email if log.user else None,
            "user_role": log.user.role.value if log.user else None
        }
        result.append(log_dict)
    
    # Return different formats based on the format parameter
    if format == "paginated":
        return {
            "logs": result,
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
    else:
        # Return direct list for backward compatibility (Emergency Center)
        return result

@router.get("/activity/export")
async def export_activity_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    activity_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    is_successful: Optional[bool] = Query(None),
    search_query: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Export activity logs as CSV."""
    query = db.query(ActivityLog).outerjoin(User, ActivityLog.user_id == User.id)
    
    # Apply filters (same as get_activity_logs)
    if start_date:
        query = query.filter(ActivityLog.created_at >= start_date)
    if end_date:
        query = query.filter(ActivityLog.created_at <= end_date)
    if user_id:
        query = query.filter(ActivityLog.user_id == user_id)
    if activity_type:
        query = query.filter(ActivityLog.activity_type == activity_type)
    if resource_type:
        query = query.filter(ActivityLog.resource_type == resource_type)
    if is_successful is not None:
        query = query.filter(ActivityLog.is_successful == is_successful)
    if search_query:
        search_filter = or_(
            ActivityLog.activity_description.contains(search_query),
            User.username.contains(search_query),
            User.email.contains(search_query)
        )
        query = query.filter(search_filter)
    
    # Order by most recent first
    query = query.order_by(desc(ActivityLog.created_at))
    
    # Get all logs (no pagination for export)
    logs = query.all()
    
    # Create CSV content
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'ID', 'User ID', 'User Email', 'User Role', 'Activity Type',
        'Activity Description', 'Resource Type', 'Resource ID',
        'Is Successful', 'Error Message', 'IP Address', 'User Agent',
        'Location', 'Response Time (ms)', 'Created At'
    ])
    
    # Write data
    for log in logs:
        writer.writerow([
            log.id,
            log.user_id,
            log.user.email if log.user else 'N/A',
            log.user.role.value if log.user else 'N/A',
            log.activity_type,
            log.activity_description or '',
            log.resource_type or '',
            log.resource_id or '',
            'Success' if log.is_successful else 'Failed',
            log.error_message or '',
            log.ip_address or '',
            log.user_agent or '',
            log.location_description or '',
            log.response_time_ms or '',
            log.created_at.isoformat() if log.created_at else ''
        ])
    
    # Create response
    output.seek(0)
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={"Content-Disposition": "attachment; filename=activity_logs.csv"}
    )
    
    return response

@router.get("/system", response_model=List[SystemLogResponse])
async def get_system_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    log_level: Optional[str] = Query(None),
    service_name: Optional[str] = Query(None),
    search_query: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get system logs with filtering options."""
    query = db.query(SystemLog)
    
    # Apply filters
    if start_date:
        query = query.filter(SystemLog.created_at >= start_date)
    if end_date:
        query = query.filter(SystemLog.created_at <= end_date)
    if log_level:
        query = query.filter(SystemLog.log_level == log_level)
    if service_name:
        query = query.filter(SystemLog.service_name == service_name)
    if search_query:
        search_filter = or_(
            SystemLog.message.contains(search_query),
            SystemLog.service_name.contains(search_query),
            SystemLog.error_code.contains(search_query)
        )
        query = query.filter(search_filter)
    
    # Order by most recent first
    query = query.order_by(desc(SystemLog.created_at))
    
    # Apply pagination
    logs = query.offset(offset).limit(limit).all()
    
    return logs

@router.get("/audit", response_model=List[AuditLogResponse])
async def get_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    search_query: Optional[str] = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get audit logs with filtering options."""
    query = db.query(AuditLog).outerjoin(User, AuditLog.user_id == User.id)
    
    # Apply filters
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if search_query:
        search_filter = or_(
            AuditLog.table_name.contains(search_query),
            User.username.contains(search_query),
            User.email.contains(search_query)
        )
        query = query.filter(search_filter)
    
    # Order by most recent first
    query = query.order_by(desc(AuditLog.created_at))
    
    # Apply pagination
    logs = query.offset(offset).limit(limit).all()
    
    # Format response with user information
    result = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "table_name": log.table_name,
            "record_id": log.record_id,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at,
            "user_name": log.user.username if log.user else None,
            "user_email": log.user.email if log.user else None,
            "user_role": log.user.role.value if log.user else None
        }
        result.append(AuditLogResponse(**log_dict))
    
    return result

@router.get("/statistics", response_model=LogsStatistics)
async def get_logs_statistics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get activity logs statistics."""
    # Default to last 30 days if no dates provided
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    base_query = db.query(ActivityLog).filter(
        and_(
            ActivityLog.created_at >= start_date,
            ActivityLog.created_at <= end_date
        )
    )
    
    # Total activities
    total_activities = base_query.count()
    
    # Success/failure breakdown
    successful_activities = base_query.filter(ActivityLog.is_successful == True).count()
    failed_activities = total_activities - successful_activities
    
    # Unique users
    unique_users = base_query.filter(ActivityLog.user_id.isnot(None)).distinct(ActivityLog.user_id).count()
    
    # Most active users
    most_active_users_query = (
        db.query(
            User.id,
            User.username,
            User.email,
            User.role,
            func.count(ActivityLog.id).label('activity_count')
        )
        .join(ActivityLog, User.id == ActivityLog.user_id)
        .filter(
            and_(
                ActivityLog.created_at >= start_date,
                ActivityLog.created_at <= end_date
            )
        )
        .group_by(User.id, User.username, User.email, User.role)
        .order_by(desc(func.count(ActivityLog.id)))
        .limit(10)
        .all()
    )
    
    most_active_users = [
        {
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "activity_count": user.activity_count
        }
        for user in most_active_users_query
    ]
    
    # Activity breakdown by type
    activity_breakdown_query = (
        base_query
        .with_entities(
            ActivityLog.activity_type,
            func.count(ActivityLog.id).label('count')
        )
        .group_by(ActivityLog.activity_type)
        .all()
    )
    
    activity_breakdown = {
        activity.activity_type: activity.count
        for activity in activity_breakdown_query
    }
    
    # Hourly activity (last 24 hours)
    hourly_start = datetime.utcnow() - timedelta(hours=24)
    hourly_activity_query = (
        db.query(
            func.strftime('%H', ActivityLog.created_at).label('hour'),
            func.count(ActivityLog.id).label('count')
        )
        .filter(ActivityLog.created_at >= hourly_start)
        .group_by(func.strftime('%H', ActivityLog.created_at))
        .all()
    )
    
    hourly_activity = [
        {"hour": int(hour.hour), "count": hour.count}
        for hour in hourly_activity_query
    ]
    
    # Daily activity (last 7 days)
    daily_start = datetime.utcnow() - timedelta(days=7)
    daily_activity_query = (
        db.query(
            func.date(ActivityLog.created_at).label('date'),
            func.count(ActivityLog.id).label('count')
        )
        .filter(ActivityLog.created_at >= daily_start)
        .group_by(func.date(ActivityLog.created_at))
        .all()
    )
    
    daily_activity = [
        {"date": str(day.date), "count": day.count}
        for day in daily_activity_query
    ]
    
    return LogsStatistics(
        total_activities=total_activities,
        successful_activities=successful_activities,
        failed_activities=failed_activities,
        unique_users=unique_users,
        most_active_users=most_active_users,
        activity_breakdown=activity_breakdown,
        hourly_activity=hourly_activity,
        daily_activity=daily_activity
    )

@router.get("/users/{user_id}/summary", response_model=UserActivitySummary)
async def get_user_activity_summary(
    user_id: int,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_staff)
):
    """Get activity summary for a specific user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Default to last 30 days if no dates provided
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=30)
    if not end_date:
        end_date = datetime.utcnow()
    
    base_query = db.query(ActivityLog).filter(
        and_(
            ActivityLog.user_id == user_id,
            ActivityLog.created_at >= start_date,
            ActivityLog.created_at <= end_date
        )
    )
    
    # Total activities
    total_activities = base_query.count()
    
    # Last activity
    last_activity_log = base_query.order_by(desc(ActivityLog.created_at)).first()
    last_activity = last_activity_log.created_at if last_activity_log else None
    
    # Most common activities
    most_common_query = (
        base_query
        .with_entities(
            ActivityLog.activity_type,
            func.count(ActivityLog.id).label('count')
        )
        .group_by(ActivityLog.activity_type)
        .order_by(desc(func.count(ActivityLog.id)))
        .limit(5)
        .all()
    )
    
    most_common_activities = [
        {"activity_type": activity.activity_type, "count": activity.count}
        for activity in most_common_query
    ]
    
    # Login counts
    login_count = base_query.filter(ActivityLog.activity_type == "login").count()
    failed_login_count = base_query.filter(ActivityLog.activity_type == "failed_login").count()
    
    return UserActivitySummary(
        user_id=user.id,
        user_name=user.username,
        user_email=user.email,
        user_role=user.role.value,
        total_activities=total_activities,
        last_activity=last_activity,
        most_common_activities=most_common_activities,
        login_count=login_count,
        failed_login_count=failed_login_count
    )

@router.post("/activity", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
async def create_activity_log(
    log_data: ActivityLogCreate,
    db: Session = Depends(get_db)
):
    """Create a new activity log entry."""
    activity_log = ActivityLog(**log_data.dict())
    db.add(activity_log)
    db.commit()
    db.refresh(activity_log)
    
    # Get user information if available
    user = db.query(User).filter(User.id == activity_log.user_id).first() if activity_log.user_id else None
    
    log_dict = {
        "id": activity_log.id,
        "user_id": activity_log.user_id,
        "activity_type": activity_log.activity_type,
        "activity_description": activity_log.activity_description,
        "ip_address": activity_log.ip_address,
        "user_agent": activity_log.user_agent,
        "session_id": activity_log.session_id,
        "latitude": activity_log.latitude,
        "longitude": activity_log.longitude,
        "location_description": activity_log.location_description,
        "extra_data": activity_log.extra_data,
        "resource_type": activity_log.resource_type,
        "resource_id": activity_log.resource_id,
        "is_successful": activity_log.is_successful,
        "error_message": activity_log.error_message,
        "response_time_ms": activity_log.response_time_ms,
        "created_at": activity_log.created_at,
        "user_name": user.username if user else None,
        "user_email": user.email if user else None,
        "user_role": user.role.value if user else None
    }
    
    return ActivityLogResponse(**log_dict)

@router.post("/system", response_model=SystemLogResponse, status_code=status.HTTP_201_CREATED)
async def create_system_log(
    log_data: SystemLogCreate,
    db: Session = Depends(get_db)
):
    """Create a new system log entry."""
    system_log = SystemLog(**log_data.dict())
    db.add(system_log)
    db.commit()
    db.refresh(system_log)
    
    return system_log

@router.post("/audit", response_model=AuditLogResponse, status_code=status.HTTP_201_CREATED)
async def create_audit_log(
    log_data: AuditLogCreate,
    db: Session = Depends(get_db)
):
    """Create a new audit log entry."""
    audit_log = AuditLog(**log_data.dict())
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    
    # Get user information
    user = db.query(User).filter(User.id == audit_log.user_id).first()
    
    log_dict = {
        "id": audit_log.id,
        "user_id": audit_log.user_id,
        "action": audit_log.action,
        "table_name": audit_log.table_name,
        "record_id": audit_log.record_id,
        "old_values": audit_log.old_values,
        "new_values": audit_log.new_values,
        "ip_address": audit_log.ip_address,
        "user_agent": audit_log.user_agent,
        "created_at": audit_log.created_at,
        "user_name": user.username if user else None,
        "user_email": user.email if user else None,
        "user_role": user.role.value if user else None
    }
    
    return AuditLogResponse(**log_dict)
