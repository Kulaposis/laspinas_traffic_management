from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime
import logging

from ..models.activity_log import ActivityLog, ActivityType
from ..models.user import User
from ..utils.role_helpers import get_role_value

logger = logging.getLogger(__name__)

class ActivityLogger:
    """Service for logging user activities and system events."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def log_activity(
        self,
        activity_type: ActivityType,
        description: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        latitude: Optional[str] = None,
        longitude: Optional[str] = None,
        location_description: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        is_successful: bool = True,
        error_message: Optional[str] = None,
        response_time_ms: Optional[int] = None
    ) -> Optional[ActivityLog]:
        """Log a user activity."""
        try:
            activity_log = ActivityLog(
                user_id=user_id,
                activity_type=activity_type.value,
                activity_description=description,
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                latitude=latitude,
                longitude=longitude,
                location_description=location_description,
                extra_data=extra_data,
                resource_type=resource_type,
                resource_id=resource_id,
                is_successful=is_successful,
                error_message=error_message,
                response_time_ms=response_time_ms
            )
            
            self.db.add(activity_log)
            self.db.commit()
            self.db.refresh(activity_log)
            
            return activity_log
            
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
            self.db.rollback()
            return None
    
    def log_login_success(self, user: User, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log successful login."""
        return self.log_activity(
            activity_type=ActivityType.LOGIN,
            description=f"User {user.username} logged in successfully",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            extra_data={
                "user_role": get_role_value(user.role),
                "login_time": datetime.utcnow().isoformat()
            }
        )
    
    def log_login_failure(self, username: str, reason: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log failed login attempt."""
        return self.log_activity(
            activity_type=ActivityType.FAILED_LOGIN,
            description=f"Failed login attempt for user '{username}': {reason}",
            ip_address=ip_address,
            user_agent=user_agent,
            is_successful=False,
            error_message=reason,
            extra_data={
                "attempted_username": username,
                "failure_reason": reason
            }
        )
    
    def log_logout(self, user: User, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log user logout."""
        return self.log_activity(
            activity_type=ActivityType.LOGOUT,
            description=f"User {user.username} logged out",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def log_password_change(self, user: User, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log password change."""
        return self.log_activity(
            activity_type=ActivityType.PASSWORD_CHANGE,
            description=f"User {user.username} changed their password",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            extra_data={
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_emergency_created(self, user: User, emergency_id: int, emergency_type: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log emergency creation."""
        return self.log_activity(
            activity_type=ActivityType.EMERGENCY_CREATED,
            description=f"Emergency report created by {user.username}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="emergency",
            resource_id=emergency_id,
            extra_data={
                "emergency_type": emergency_type,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_emergency_updated(self, user: User, emergency_id: int, status_change: str = None, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log emergency update."""
        description = f"Emergency #{emergency_id} updated by {user.username}"
        if status_change:
            description += f" - status changed to {status_change}"
            
        return self.log_activity(
            activity_type=ActivityType.EMERGENCY_UPDATED,
            description=description,
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="emergency",
            resource_id=emergency_id,
            extra_data={
                "status_change": status_change,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_emergency_resolved(self, user: User, emergency_id: int, resolution_notes: str = None, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log emergency resolution."""
        return self.log_activity(
            activity_type=ActivityType.EMERGENCY_RESOLVED,
            description=f"Emergency #{emergency_id} resolved by {user.username}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="emergency",
            resource_id=emergency_id,
            extra_data={
                "resolution_notes": resolution_notes,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_emergency_moderated(self, user: User, emergency_id: int, verification_status: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log emergency moderation action."""
        return self.log_activity(
            activity_type=ActivityType.EMERGENCY_UPDATED,
            description=f"Emergency #{emergency_id} moderated by {user.username} - status: {verification_status}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="emergency",
            resource_id=emergency_id,
            extra_data={
                "verification_status": verification_status,
                "moderation_action": True,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_complaint_created(self, user: User, complaint_id: int, category: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log complaint creation."""
        return self.log_activity(
            activity_type=ActivityType.COMPLAINT_CREATED,
            description=f"Complaint submitted by {user.username}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="complaint",
            resource_id=complaint_id,
            extra_data={
                "category": category,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_report_created(self, user: User, report_id: int, report_type: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log report creation."""
        return self.log_activity(
            activity_type=ActivityType.REPORT_CREATED,
            description=f"Report created by {user.username}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="report",
            resource_id=report_id,
            extra_data={
                "report_type": report_type,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_violation_reported(self, user: User, violation_id: int, violation_type: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log violation report."""
        return self.log_activity(
            activity_type=ActivityType.VIOLATION_REPORTED,
            description=f"Violation reported by {user.username}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="violation",
            resource_id=violation_id,
            extra_data={
                "violation_type": violation_type,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_notification_sent(self, recipient_count: int, notification_type: str, sender_user_id: int = None, ip_address: str = None) -> Optional[ActivityLog]:
        """Log notification sending."""
        return self.log_activity(
            activity_type=ActivityType.NOTIFICATION_SENT,
            description=f"Notification sent to {recipient_count} recipients",
            user_id=sender_user_id,
            ip_address=ip_address,
            resource_type="notification",
            extra_data={
                "notification_type": notification_type,
                "recipient_count": recipient_count
            }
        )
    
    def log_data_export(self, user: User, export_type: str, record_count: int, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log data export."""
        return self.log_activity(
            activity_type=ActivityType.DATA_EXPORT,
            description=f"Data exported by {user.username} - {export_type} ({record_count} records)",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            extra_data={
                "export_type": export_type,
                "record_count": record_count,
                "user_role": get_role_value(user.role)
            }
        )
    
    def log_user_role_changed(self, admin_user: User, target_user_id: int, old_role: str, new_role: str, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log user role change."""
        return self.log_activity(
            activity_type=ActivityType.USER_ROLE_CHANGED,
            description=f"User role changed by {admin_user.username}: {old_role} → {new_role}",
            user_id=admin_user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource_type="user",
            resource_id=target_user_id,
            extra_data={
                "old_role": old_role,
                "new_role": new_role,
                "admin_user": admin_user.username,
                "target_user_id": target_user_id
            }
        )
    
    def log_api_access(self, user: User, endpoint: str, method: str, response_code: int, response_time_ms: int = None, ip_address: str = None, user_agent: str = None) -> Optional[ActivityLog]:
        """Log API access."""
        is_successful = 200 <= response_code < 400
        
        return self.log_activity(
            activity_type=ActivityType.API_ACCESS,
            description=f"API access: {method} {endpoint} - {response_code}",
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            is_successful=is_successful,
            response_time_ms=response_time_ms,
            extra_data={
                "endpoint": endpoint,
                "method": method,
                "response_code": response_code,
                "user_role": get_role_value(user.role)
            }
        )

def get_activity_logger(db: Session) -> ActivityLogger:
    """Factory function to create ActivityLogger instance."""
    return ActivityLogger(db)
