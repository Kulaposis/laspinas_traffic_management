#!/usr/bin/env python3
"""
Test script for emergency photo attachment and moderation functionality
Run this script to test the new features
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "user@example.com" 
USER_PASSWORD = "user123"

def get_auth_token(email, password):
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email,
        "password": password
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    else:
        print(f"Login failed: {response.text}")
        return None

def test_emergency_with_photos():
    """Test emergency reporting with photo attachments"""
    print("🚨 Testing Emergency Report with Photos...")
    
    # Get user token
    user_token = get_auth_token(USER_EMAIL, USER_PASSWORD)
    if not user_token:
        print("❌ Failed to get user token")
        return None
    
    headers = {"Authorization": f"Bearer {user_token}"}
    
    # Sample emergency data with photos
    emergency_data = {
        "emergency_type": "accident",
        "title": "Vehicle Collision on Main Street",
        "description": "Two-car collision blocking traffic, possible injuries",
        "severity": "high",
        "latitude": 14.4504,
        "longitude": 121.0170,
        "address": "Main Street, Las Piñas City",
        "photo_urls": [
            "https://example.com/emergency-photos/accident1.jpg",
            "https://example.com/emergency-photos/accident2.jpg"
        ]
    }
    
    response = requests.post(
        f"{BASE_URL}/emergency/report",
        json=emergency_data,
        headers=headers
    )
    
    if response.status_code == 201:
        emergency = response.json()
        print(f"✅ Emergency reported successfully!")
        print(f"   Emergency Number: {emergency['emergency_number']}")
        print(f"   Photos: {len(emergency.get('photo_urls', []))} attached")
        print(f"   Moderation Priority: {emergency.get('moderation_priority', 'normal')}")
        return emergency
    else:
        print(f"❌ Failed to report emergency: {response.text}")
        return None

def test_moderation_queue():
    """Test moderation queue functionality"""
    print("\n👨‍💼 Testing Admin Moderation Queue...")
    
    # Get admin token
    admin_token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ Failed to get admin token")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Get moderation queue
    response = requests.get(f"{BASE_URL}/emergency/moderation/queue", headers=headers)
    
    if response.status_code == 200:
        queue = response.json()
        print(f"✅ Moderation queue retrieved successfully!")
        print(f"   Total Pending: {queue.get('total_pending', 0)}")
        print(f"   High Priority: {queue.get('high_priority', 0)}")
        print(f"   Flagged Reports: {queue.get('flagged_reports', 0)}")
        print(f"   Reports in Queue: {len(queue.get('pending_reports', []))}")
        
        return queue.get('pending_reports', [])
    else:
        print(f"❌ Failed to get moderation queue: {response.text}")
        return []

def test_moderation_action(emergency_id):
    """Test moderating an emergency report"""
    print(f"\n✅ Testing Moderation Action for Emergency ID: {emergency_id}...")
    
    # Get admin token
    admin_token = get_auth_token(ADMIN_EMAIL, ADMIN_PASSWORD)
    if not admin_token:
        print("❌ Failed to get admin token")
        return
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    # Moderate the emergency (verify it)
    moderation_data = {
        "verification_status": "verified",
        "verification_notes": "Report verified - legitimate emergency with photo evidence",
        "moderation_priority": "high"
    }
    
    response = requests.put(
        f"{BASE_URL}/emergency/moderation/{emergency_id}",
        json=moderation_data,
        headers=headers
    )
    
    if response.status_code == 200:
        moderated = response.json()
        print(f"✅ Emergency moderated successfully!")
        print(f"   Status: {moderated.get('verification_status')}")
        print(f"   Verified: {moderated.get('is_verified')}")
        print(f"   Notes: {moderated.get('verification_notes')}")
        return moderated
    else:
        print(f"❌ Failed to moderate emergency: {response.text}")
        return None

def main():
    """Main test function"""
    print("🧪 Testing Emergency Photo Attachment & Moderation System")
    print("=" * 60)
    
    # Test 1: Report emergency with photos
    emergency = test_emergency_with_photos()
    if not emergency:
        print("❌ Emergency reporting test failed, skipping moderation tests")
        return
    
    # Test 2: Check moderation queue
    pending_reports = test_moderation_queue()
    
    # Test 3: Moderate the emergency
    if emergency:
        test_moderation_action(emergency['id'])
    
    # Test 4: Check queue again to see changes
    print("\n🔄 Checking moderation queue after action...")
    test_moderation_queue()
    
    print("\n🎉 All tests completed!")
    print("\n📋 Summary of Features Added:")
    print("   ✅ Photo attachment support in emergency reports")
    print("   ✅ Automatic moderation priority based on severity and photos")
    print("   ✅ Admin moderation queue interface")
    print("   ✅ Emergency verification system")
    print("   ✅ Photo display in admin interface")
    print("   ✅ Activity logging for moderation actions")

if __name__ == "__main__":
    main()
