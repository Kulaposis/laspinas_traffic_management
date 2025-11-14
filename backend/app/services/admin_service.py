from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy import func, desc, and_, or_
from fastapi import HTTPException, status
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import os
import csv
import io
from ..models.admin_models import (
    SystemSetting, NotificationTemplate, SystemAlert, DataExportJob,
    SecurityEvent, SystemMetric, UserSession, ContentModerationQueue
)
from ..utils.role_helpers import get_role_value
from ..models.user import User
from ..models.report import Report
from ..models.violation import Violation
from ..schemas.admin_schemas import *

class AdminService:
    def __init__(self, db: Session):
        self.db = db

    # System Settings Management
    def get_settings(self, category: Optional[str] = None, is_public: Optional[bool] = None) -> List[SystemSetting]:
        query = self.db.query(SystemSetting)
        if category:
            query = query.filter(SystemSetting.category == category)
        if is_public is not None:
            query = query.filter(SystemSetting.is_public == is_public)
        return query.all()

    def get_setting_by_key(self, key: str) -> Optional[SystemSetting]:
        return self.db.query(SystemSetting).filter(SystemSetting.key == key).first()

    def create_setting(self, setting_data: SystemSettingCreate, user_id: int) -> SystemSetting:
        # Check if setting already exists
        existing = self.get_setting_by_key(setting_data.key)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Setting with key '{setting_data.key}' already exists"
            )

        setting = SystemSetting(
            **setting_data.dict(),
            updated_by=user_id
        )
        self.db.add(setting)
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def update_setting(self, key: str, setting_data: SystemSettingUpdate, user_id: int) -> SystemSetting:
        setting = self.get_setting_by_key(key)
        if not setting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Setting with key '{key}' not found"
            )

        update_data = setting_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(setting, field, value)
        
        setting.updated_by = user_id
        setting.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(setting)
        return setting

    def delete_setting(self, key: str) -> bool:
        setting = self.get_setting_by_key(key)
        if not setting:
            return False
        
        self.db.delete(setting)
        self.db.commit()
        return True

    # User Management
    def get_user_management_stats(self) -> UserManagementStats:
        total_users = self.db.query(User).count()
        active_users = self.db.query(User).filter(User.is_active == True).count()
        inactive_users = total_users - active_users

        # Users by role
        role_counts = self.db.query(
            User.role, func.count(User.id)
        ).group_by(User.role).all()
        users_by_role = {role.value: count for role, count in role_counts}

        # Recent registrations (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_registrations = self.db.query(User).filter(
            User.created_at >= week_ago
        ).count()

        # Recent logins (last 24 hours) - would need session tracking
        recent_logins = self.db.query(UserSession).filter(
            UserSession.last_activity >= datetime.utcnow() - timedelta(hours=24)
        ).count()

        return UserManagementStats(
            total_users=total_users,
            active_users=active_users,
            inactive_users=inactive_users,
            users_by_role=users_by_role,
            recent_registrations=recent_registrations,
            recent_logins=recent_logins
        )

    def get_user_activity_summary(self, user_id: int) -> UserActivitySummary:
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        # Get user statistics
        total_reports = self.db.query(Report).filter(Report.reporter_id == user_id).count()
        total_violations = self.db.query(Violation).filter(Violation.enforcer_id == user_id).count()
        
        # Account age
        account_age = (datetime.utcnow() - user.created_at).days

        # Last login (from sessions)
        last_session = self.db.query(UserSession).filter(
            UserSession.user_id == user_id
        ).order_by(desc(UserSession.last_activity)).first()

        return UserActivitySummary(
            user_id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=get_role_value(user.role),
            last_login=last_session.last_activity if last_session else None,
            total_reports=total_reports,
            total_violations=total_violations,
            account_age_days=account_age,
            is_active=user.is_active
        )

    def bulk_user_operation(self, operation_data: BulkUserOperation, admin_id: int) -> BulkOperationResult:
        users = self.db.query(User).filter(User.id.in_(operation_data.user_ids)).all()
        
        successful = 0
        errors = []
        
        for user in users:
            try:
                if operation_data.operation == "activate":
                    user.is_active = True
                elif operation_data.operation == "deactivate":
                    user.is_active = False
                elif operation_data.operation == "change_role":
                    new_role = operation_data.parameters.get("new_role")
                    if new_role:
                        user.role = new_role
                elif operation_data.operation == "delete":
                    self.db.delete(user)
                
                successful += 1
            except Exception as e:
                errors.append(f"User {user.id}: {str(e)}")

        self.db.commit()

        return BulkOperationResult(
            operation=operation_data.operation,
            total_items=len(operation_data.user_ids),
            successful=successful,
            failed=len(errors),
            errors=errors
        )

    # System Analytics
    def get_system_analytics(self) -> SystemAnalytics:
        total_users = self.db.query(User).count()
        
        # Active users today
        today = datetime.utcnow().date()
        active_users_today = self.db.query(UserSession).filter(
            func.date(UserSession.last_activity) == today
        ).distinct(UserSession.user_id).count()

        total_reports = self.db.query(Report).count()
        reports_today = self.db.query(Report).filter(
            func.date(Report.created_at) == today
        ).count()

        total_violations = self.db.query(Violation).count()
        violations_today = self.db.query(Violation).filter(
            func.date(Violation.issued_at) == today
        ).count()

        return SystemAnalytics(
            total_users=total_users,
            active_users_today=active_users_today,
            total_reports=total_reports,
            reports_today=reports_today,
            total_violations=total_violations,
            violations_today=violations_today,
            system_uptime="99.9%",  # Would be calculated from actual uptime monitoring
            api_requests_today=0,  # Would come from metrics
            error_rate=0.01
        )

    # Security Events
    def create_security_event(self, event_data: SecurityEventCreate) -> SecurityEvent:
        event = SecurityEvent(**event_data.dict())
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def get_security_events(self, 
                          limit: int = 50, 
                          offset: int = 0,
                          severity: Optional[str] = None,
                          resolved: Optional[bool] = None) -> List[SecurityEvent]:
        query = self.db.query(SecurityEvent)
        
        if severity:
            query = query.filter(SecurityEvent.severity == severity)
        if resolved is not None:
            query = query.filter(SecurityEvent.is_resolved == resolved)
            
        return query.order_by(desc(SecurityEvent.created_at)).offset(offset).limit(limit).all()

    def resolve_security_event(self, event_id: int, admin_id: int) -> SecurityEvent:
        event = self.db.query(SecurityEvent).filter(SecurityEvent.id == event_id).first()
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Security event not found"
            )
        
        event.is_resolved = True
        event.resolved_at = datetime.utcnow()
        event.resolved_by = admin_id
        
        self.db.commit()
        self.db.refresh(event)
        return event

    # System Alerts
    def create_system_alert(self, alert_data: SystemAlertCreate, admin_id: int) -> SystemAlert:
        alert = SystemAlert(**alert_data.dict(), created_by=admin_id)
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def get_active_alerts(self, user_role: Optional[str] = None) -> List[SystemAlert]:
        query = self.db.query(SystemAlert).filter(SystemAlert.is_active == True)
        
        now = datetime.utcnow()
        query = query.filter(
            or_(
                SystemAlert.start_date.is_(None),
                SystemAlert.start_date <= now
            )
        ).filter(
            or_(
                SystemAlert.end_date.is_(None),
                SystemAlert.end_date >= now
            )
        )
        
        if user_role:
            query = query.filter(
                or_(
                    SystemAlert.target_roles.is_(None),
                    SystemAlert.target_roles.contains([user_role])
                )
            )
        
        return query.order_by(desc(SystemAlert.created_at)).all()

    # Data Export
    def create_export_job(self, export_request: DataExportRequest, admin_id: int) -> DataExportJob:
        job_name = export_request.job_name or f"{export_request.export_type}_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        job = DataExportJob(
            job_name=job_name,
            export_type=export_request.export_type,
            parameters=export_request.parameters,
            created_by=admin_id
        )
        
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        
        # Start background job (would be implemented with Celery or similar)
        # self._process_export_job(job.id)
        
        return job

    def get_export_jobs(self, admin_id: int, limit: int = 20) -> List[DataExportJob]:
        return self.db.query(DataExportJob).filter(
            DataExportJob.created_by == admin_id
        ).order_by(desc(DataExportJob.created_at)).limit(limit).all()

    # Content Moderation
    def get_moderation_queue(self, 
                           status: Optional[str] = None,
                           content_type: Optional[str] = None,
                           limit: int = 50) -> List[ContentModerationQueue]:
        query = self.db.query(ContentModerationQueue)
        
        if status:
            query = query.filter(ContentModerationQueue.status == status)
        if content_type:
            query = query.filter(ContentModerationQueue.content_type == content_type)
            
        return query.order_by(desc(ContentModerationQueue.created_at)).limit(limit).all()

    def moderate_content(self, 
                        moderation_id: int, 
                        action: ContentModerationAction,
                        admin_id: int) -> ContentModerationQueue:
        item = self.db.query(ContentModerationQueue).filter(
            ContentModerationQueue.id == moderation_id
        ).first()
        
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Moderation item not found"
            )
        
        item.status = "approved" if action.action == "approve" else "rejected"
        item.reviewed_at = datetime.utcnow()
        item.reviewed_by = admin_id
        item.review_notes = action.review_notes
        
        self.db.commit()
        self.db.refresh(item)
        return item

    # Notification Templates
    def create_notification_template(self, template_data: NotificationTemplateCreate, admin_id: int) -> NotificationTemplate:
        template = NotificationTemplate(**template_data.dict(), created_by=admin_id)
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def get_notification_templates(self, template_type: Optional[str] = None) -> List[NotificationTemplate]:
        query = self.db.query(NotificationTemplate)
        if template_type:
            query = query.filter(NotificationTemplate.template_type == template_type)
        return query.filter(NotificationTemplate.is_active == True).all()

    def update_notification_template(self, 
                                   template_id: int, 
                                   template_data: NotificationTemplateUpdate) -> NotificationTemplate:
        template = self.db.query(NotificationTemplate).filter(
            NotificationTemplate.id == template_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )
        
        update_data = template_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)
        
        template.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(template)
        return template

    # System Health Checks
    def get_system_health(self) -> Dict[str, Any]:
        try:
            # Database connectivity (SQLAlchemy 2.0 requires text())
            self.db.execute(text("SELECT 1"))
            db_status = "healthy"
        except:
            db_status = "unhealthy"
        
        # Check critical services
        return {
            "database": db_status,
            "api": "healthy",
            "websocket": "healthy",
            "overall": "healthy" if db_status == "healthy" else "degraded"
        }
