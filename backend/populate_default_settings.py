#!/usr/bin/env python3
"""
Script to populate default system settings for the admin interface
"""

from app.db import get_db
from app.models.admin_models import SystemSetting, SettingType
from app.models.user import User
from sqlalchemy.orm import Session
import json

def create_default_settings():
    """Create default system settings if they don't exist"""
    
    db = next(get_db())
    
    # Check if we have an admin user to associate settings with
    admin_user = db.query(User).filter(User.role == "admin").first()
    admin_id = admin_user.id if admin_user else None
    
    default_settings = [
        # General Settings
        {
            "key": "app_name",
            "value": "Traffic Management System",
            "setting_type": SettingType.STRING,
            "description": "The name of the application displayed to users",
            "category": "general",
            "is_public": True
        },
        {
            "key": "app_version",
            "value": "1.0.0",
            "setting_type": SettingType.STRING,
            "description": "Current application version",
            "category": "general",
            "is_public": True
        },
        {
            "key": "max_file_upload_size",
            "value": "10485760",  # 10MB in bytes
            "setting_type": SettingType.INTEGER,
            "description": "Maximum file upload size in bytes",
            "category": "general",
            "is_public": False
        },
        {
            "key": "enable_user_registration",
            "value": "true",
            "setting_type": SettingType.BOOLEAN,
            "description": "Allow new users to register accounts",
            "category": "general",
            "is_public": False
        },
        
        # System Settings
        {
            "key": "maintenance_mode",
            "value": "false",
            "setting_type": SettingType.BOOLEAN,
            "description": "Enable maintenance mode to restrict access",
            "category": "system",
            "is_public": True
        },
        {
            "key": "maintenance_message",
            "value": "System is under maintenance. Please check back later.",
            "setting_type": SettingType.STRING,
            "description": "Message displayed when maintenance mode is enabled",
            "category": "system",
            "is_public": True
        },
        {
            "key": "session_timeout",
            "value": "86400",  # 24 hours in seconds
            "setting_type": SettingType.INTEGER,
            "description": "User session timeout in seconds",
            "category": "system",
            "is_public": False
        },
        {
            "key": "api_rate_limit",
            "value": "1000",
            "setting_type": SettingType.INTEGER,
            "description": "API requests per hour per user",
            "category": "system",
            "is_public": False
        },
        
        # Email Settings
        {
            "key": "smtp_server",
            "value": "localhost",
            "setting_type": SettingType.STRING,
            "description": "SMTP server for sending emails",
            "category": "email",
            "is_public": False
        },
        {
            "key": "smtp_port",
            "value": "587",
            "setting_type": SettingType.INTEGER,
            "description": "SMTP server port",
            "category": "email",
            "is_public": False
        },
        {
            "key": "email_from_address",
            "value": "noreply@trafficmanagement.local",
            "setting_type": SettingType.STRING,
            "description": "Default from email address",
            "category": "email",
            "is_public": False
        },
        {
            "key": "email_enabled",
            "value": "false",
            "setting_type": SettingType.BOOLEAN,
            "description": "Enable email notifications",
            "category": "email",
            "is_public": False
        },
        
        # Notification Settings
        {
            "key": "push_notifications_enabled",
            "value": "true",
            "setting_type": SettingType.BOOLEAN,
            "description": "Enable push notifications for users",
            "category": "notifications",
            "is_public": False
        },
        {
            "key": "notification_retention_days",
            "value": "30",
            "setting_type": SettingType.INTEGER,
            "description": "Days to keep notifications before cleanup",
            "category": "notifications",
            "is_public": False
        },
        {
            "key": "emergency_alert_sound",
            "value": "true",
            "setting_type": SettingType.BOOLEAN,
            "description": "Play sound for emergency alerts",
            "category": "notifications",
            "is_public": True
        },
        
        # Security Settings
        {
            "key": "password_min_length",
            "value": "8",
            "setting_type": SettingType.INTEGER,
            "description": "Minimum password length requirement",
            "category": "security",
            "is_public": True
        },
        {
            "key": "require_password_complexity",
            "value": "true",
            "setting_type": SettingType.BOOLEAN,
            "description": "Require complex passwords (uppercase, lowercase, numbers, symbols)",
            "category": "security",
            "is_public": True
        },
        {
            "key": "max_login_attempts",
            "value": "5",
            "setting_type": SettingType.INTEGER,
            "description": "Maximum failed login attempts before account lockout",
            "category": "security",
            "is_public": False
        },
        {
            "key": "account_lockout_duration",
            "value": "900",  # 15 minutes in seconds
            "setting_type": SettingType.INTEGER,
            "description": "Account lockout duration in seconds",
            "category": "security",
            "is_public": False
        },
        {
            "key": "enable_two_factor_auth",
            "value": "false",
            "setting_type": SettingType.BOOLEAN,
            "description": "Enable two-factor authentication for users",
            "category": "security",
            "is_public": False
        },
        
        # Database Settings
        {
            "key": "database_backup_enabled",
            "value": "true",
            "setting_type": SettingType.BOOLEAN,
            "description": "Enable automatic database backups",
            "category": "database",
            "is_public": False
        },
        {
            "key": "backup_retention_days",
            "value": "7",
            "setting_type": SettingType.INTEGER,
            "description": "Days to keep database backups",
            "category": "database",
            "is_public": False
        },
        {
            "key": "database_connection_pool_size",
            "value": "20",
            "setting_type": SettingType.INTEGER,
            "description": "Database connection pool size",
            "category": "database",
            "is_public": False
        },
        
        # Traffic Management Specific Settings
        {
            "key": "traffic_data_refresh_interval",
            "value": "30",
            "setting_type": SettingType.INTEGER,
            "description": "Traffic data refresh interval in seconds",
            "category": "system",
            "is_public": False
        },
        {
            "key": "heatmap_update_frequency",
            "value": "60",
            "setting_type": SettingType.INTEGER,
            "description": "Heatmap update frequency in seconds",
            "category": "system",
            "is_public": False
        },
        {
            "key": "violation_photo_max_size",
            "value": "5242880",  # 5MB
            "setting_type": SettingType.INTEGER,
            "description": "Maximum size for violation photos in bytes",
            "category": "general",
            "is_public": False
        },
        {
            "key": "emergency_response_timeout",
            "value": "300",  # 5 minutes
            "setting_type": SettingType.INTEGER,
            "description": "Emergency response timeout in seconds",
            "category": "system",
            "is_public": False
        },
        
        # Feature Toggles
        {
            "key": "features_enabled",
            "value": json.dumps({
                "weather_integration": True,
                "traffic_predictions": True,
                "emergency_alerts": True,
                "violation_reporting": True,
                "parking_management": True,
                "public_transport": True
            }),
            "setting_type": SettingType.JSON,
            "description": "Feature toggle configuration",
            "category": "system",
            "is_public": False
        }
    ]
    
    created_count = 0
    updated_count = 0
    
    for setting_data in default_settings:
        existing = db.query(SystemSetting).filter(SystemSetting.key == setting_data["key"]).first()
        
        if existing:
            # Update description if it's different
            if existing.description != setting_data["description"]:
                existing.description = setting_data["description"]
                updated_count += 1
            print(f"Setting '{setting_data['key']}' already exists")
        else:
            # Create new setting
            new_setting = SystemSetting(
                key=setting_data["key"],
                value=setting_data["value"],
                setting_type=setting_data["setting_type"],
                description=setting_data["description"],
                category=setting_data["category"],
                is_public=setting_data["is_public"],
                updated_by=admin_id
            )
            db.add(new_setting)
            created_count += 1
            print(f"Created setting: {setting_data['key']}")
    
    try:
        db.commit()
        print(f"\nCompleted! Created {created_count} new settings, updated {updated_count} existing settings.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_default_settings()
