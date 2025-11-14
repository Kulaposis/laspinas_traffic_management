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
from ..models.traffic import TrafficMonitoring, TrafficStatus
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
        
        # Get all active alerts first, then filter by target_roles in Python
        # This is more reliable than complex JSON queries
        all_alerts = query.order_by(desc(SystemAlert.created_at)).all()
        
        # If user_role is None (admin dashboard), return all alerts without filtering
        if user_role is None:
            return all_alerts
        
        # Filter by target_roles for non-admin users
        # user_role can be empty string "" for guests, or a role name for logged-in users
        filtered_alerts = []
        user_role_lower = user_role.lower() if user_role else ""
        
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Filtering {len(all_alerts)} alerts for user_role: {user_role_lower}")
        
        for alert in all_alerts:
            # If no target_roles specified, show to everyone
            if not alert.target_roles or len(alert.target_roles) == 0:
                logger.debug(f"Alert {alert.id} has no target_roles - including")
                filtered_alerts.append(alert)
                continue
            
            # Convert target_roles to lowercase list for comparison
            target_roles_lower = [str(r).lower() for r in alert.target_roles]
            logger.debug(f"Alert {alert.id} target_roles: {target_roles_lower}, user_role: {user_role_lower}")
            
            # Check if 'all' is in target_roles - show to everyone
            if 'all' in target_roles_lower:
                logger.debug(f"Alert {alert.id} has 'all' in target_roles - including")
                filtered_alerts.append(alert)
                continue
            
            # If user_role is provided (not empty string), check if it matches
            if user_role_lower and user_role_lower != "":
                if user_role_lower in target_roles_lower:
                    logger.debug(f"Alert {alert.id} matches user_role {user_role_lower} - including")
                    filtered_alerts.append(alert)
            else:
                # For guests (empty string user_role), check if 'citizen' or 'all' is in target_roles
                if 'citizen' in target_roles_lower or 'all' in target_roles_lower:
                    logger.debug(f"Alert {alert.id} has 'citizen' or 'all' in target_roles - including for guest")
                    filtered_alerts.append(alert)
        
        logger.info(f"Filtered to {len(filtered_alerts)} alerts")
        return filtered_alerts

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

    # Traffic Area Statistics
    def get_traffic_area_statistics(self, days: int = 7, barangay: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive traffic area statistics for Las Piñas City."""
        from datetime import datetime, timedelta
        from collections import defaultdict
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Base query
        query = self.db.query(TrafficMonitoring).filter(
            TrafficMonitoring.last_updated >= start_date
        )
        
        if barangay:
            query = query.filter(TrafficMonitoring.barangay.ilike(f"%{barangay}%"))
        
        traffic_data = query.all()
        
        if not traffic_data:
            # Return empty structure if no data
            return {
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": days
                },
                "summary": {
                    "total_monitored_areas": 0,
                    "overall_avg_congestion": 0.0,
                    "total_vehicle_count": 0,
                    "most_congested_area": None
                },
                "by_barangay": [],
                "top_congested_roads": [],
                "peak_hours_analysis": {
                    "hourly_distribution": [],
                    "peak_hour": 0,
                    "peak_day": "Monday"
                },
                "geographic_data": [],
                "traffic_status_distribution": {}
            }
        
        # Aggregate by barangay
        barangay_stats = defaultdict(lambda: {
            "congestion_sum": 0.0,
            "vehicle_sum": 0,
            "speed_sum": 0.0,
            "speed_count": 0,
            "roads": set(),
            "count": 0
        })
        
        # Road statistics
        road_stats = defaultdict(lambda: {
            "congestion_sum": 0.0,
            "vehicle_sum": 0,
            "speed_sum": 0.0,
            "speed_count": 0,
            "count": 0,
            "barangay": "",
            "statuses": []
        })
        
        # Status distribution
        status_dist = defaultdict(int)
        
        # Geographic data
        geo_data = []
        
        for traffic in traffic_data:
            barangay_name = traffic.barangay
            road_name = traffic.road_name
            
            # Barangay aggregation
            barangay_stats[barangay_name]["congestion_sum"] += traffic.congestion_percentage or 0.0
            barangay_stats[barangay_name]["vehicle_sum"] += traffic.vehicle_count or 0
            barangay_stats[barangay_name]["roads"].add(road_name)
            barangay_stats[barangay_name]["count"] += 1
            if traffic.average_speed_kmh:
                barangay_stats[barangay_name]["speed_sum"] += traffic.average_speed_kmh
                barangay_stats[barangay_name]["speed_count"] += 1
            
            # Road aggregation
            road_stats[road_name]["congestion_sum"] += traffic.congestion_percentage or 0.0
            road_stats[road_name]["vehicle_sum"] += traffic.vehicle_count or 0
            road_stats[road_name]["barangay"] = barangay_name
            road_stats[road_name]["count"] += 1
            if traffic.average_speed_kmh:
                road_stats[road_name]["speed_sum"] += traffic.average_speed_kmh
                road_stats[road_name]["speed_count"] += 1
            road_stats[road_name]["statuses"].append(traffic.traffic_status.value)
            
            # Status distribution
            status_dist[traffic.traffic_status.value] += 1
            
            # Geographic data
            geo_data.append({
                "latitude": traffic.latitude,
                "longitude": traffic.longitude,
                "intensity": (traffic.congestion_percentage or 0.0) / 100.0,
                "area_name": road_name,
                "congestion_percentage": traffic.congestion_percentage or 0.0
            })
        
        # Process barangay statistics
        barangay_list = []
        for barangay_name, stats in barangay_stats.items():
            count = stats["count"]
            avg_congestion = stats["congestion_sum"] / count if count > 0 else 0.0
            avg_speed = stats["speed_sum"] / stats["speed_count"] if stats["speed_count"] > 0 else None
            
            # Determine status
            if avg_congestion >= 80:
                status = "CRITICAL"
            elif avg_congestion >= 60:
                status = "HIGH"
            elif avg_congestion >= 40:
                status = "MEDIUM"
            else:
                status = "LOW"
            
            barangay_list.append({
                "barangay": barangay_name,
                "avg_congestion": round(avg_congestion, 2),
                "total_vehicles": stats["vehicle_sum"],
                "road_count": len(stats["roads"]),
                "status": status,
                "trend": "stable",  # Would need historical data for actual trend
                "avg_speed_kmh": round(avg_speed, 2) if avg_speed else None
            })
        
        # Sort by congestion
        barangay_list.sort(key=lambda x: x["avg_congestion"], reverse=True)
        
        # Process road statistics
        road_list = []
        for road_name, stats in road_stats.items():
            count = stats["count"]
            avg_congestion = stats["congestion_sum"] / count if count > 0 else 0.0
            avg_speed = stats["speed_sum"] / stats["speed_count"] if stats["speed_count"] > 0 else 0.0
            
            # Get most common status
            most_common_status = max(set(stats["statuses"]), key=stats["statuses"].count) if stats["statuses"] else "FREE_FLOW"
            
            # Estimate peak hours (would need time-based data for accuracy)
            peak_hours = ["07:00-09:00", "17:00-19:00"]  # Default peak hours
            
            road_list.append({
                "road_name": road_name,
                "barangay": stats["barangay"],
                "congestion_percentage": round(avg_congestion, 2),
                "avg_speed_kmh": round(avg_speed, 2),
                "peak_hours": peak_hours,
                "vehicle_count": stats["vehicle_sum"],
                "traffic_status": most_common_status
            })
        
        # Sort roads by congestion
        road_list.sort(key=lambda x: x["congestion_percentage"], reverse=True)
        top_roads = road_list[:10]  # Top 10
        
        # Calculate summary
        total_congestion = sum(b["avg_congestion"] for b in barangay_list)
        overall_avg_congestion = total_congestion / len(barangay_list) if barangay_list else 0.0
        total_vehicles = sum(b["total_vehicles"] for b in barangay_list)
        most_congested = barangay_list[0]["barangay"] if barangay_list else None
        
        # Peak hours analysis (simplified - would need time-based aggregation)
        hourly_dist = [{"hour": i, "avg_congestion": 0.0} for i in range(24)]
        peak_hour = 8  # Default
        peak_day = "Monday"  # Default
        
        return {
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days
            },
            "summary": {
                "total_monitored_areas": len(set(t.road_name for t in traffic_data)),
                "overall_avg_congestion": round(overall_avg_congestion, 2),
                "total_vehicle_count": total_vehicles,
                "most_congested_area": most_congested
            },
            "by_barangay": barangay_list,
            "top_congested_roads": top_roads,
            "peak_hours_analysis": {
                "hourly_distribution": hourly_dist,
                "peak_hour": peak_hour,
                "peak_day": peak_day
            },
            "geographic_data": geo_data,
            "traffic_status_distribution": dict(status_dist)
        }
