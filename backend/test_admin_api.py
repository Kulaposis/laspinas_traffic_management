#!/usr/bin/env python3
"""
Test script for admin API functionality
"""

from app.db import get_db
from app.services.admin_service import AdminService

def test_admin_service():
    """Test the admin service functionality"""
    
    db = next(get_db())
    service = AdminService(db)
    
    print("Testing Admin Service...")
    
    # Test getting all settings
    settings = service.get_settings()
    print(f"✓ Found {len(settings)} total settings")
    
    # Test getting settings by category
    general_settings = service.get_settings(category="general")
    print(f"✓ Found {len(general_settings)} general settings")
    
    system_settings = service.get_settings(category="system")
    print(f"✓ Found {len(system_settings)} system settings")
    
    # Test getting a specific setting
    app_name_setting = service.get_setting_by_key("app_name")
    if app_name_setting:
        print(f"✓ App name setting: {app_name_setting.value}")
    else:
        print("✗ App name setting not found")
    
    # Test getting public settings
    public_settings = service.get_settings(is_public=True)
    print(f"✓ Found {len(public_settings)} public settings")
    
    print("\nSample settings:")
    for setting in settings[:10]:
        print(f"  {setting.key}: {setting.value} ({setting.category})")
    
    print("\n✓ Admin service tests completed successfully!")
    
    db.close()

if __name__ == "__main__":
    test_admin_service()
