#!/usr/bin/env python3
"""
Test script for Emergency Moderation API
"""
import requests
import json
from datetime import datetime

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_USER_CREDENTIALS = {
    "username": "admin",
    "password": "admin123"
}

def test_moderation_api():
    print("🧪 Testing Emergency Moderation API")
    print("=" * 50)
    
    # Step 1: Login to get authentication token
    print("1. Logging in...")
    try:
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            data=TEST_USER_CREDENTIALS
        )
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            access_token = token_data.get("access_token")
            print(f"✅ Login successful! Token: {access_token[:20]}...")
            
            headers = {"Authorization": f"Bearer {access_token}"}
        else:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error during login: {e}")
        return
    
    # Step 2: Test moderation queue endpoint
    print("\n2. Testing moderation queue...")
    try:
        queue_response = requests.get(
            f"{BASE_URL}/emergency/moderation/queue",
            headers=headers
        )
        
        if queue_response.status_code == 200:
            queue_data = queue_response.json()
            print(f"✅ Moderation queue retrieved successfully!")
            print(f"   Total pending: {queue_data.get('total_pending', 0)}")
            print(f"   High priority: {queue_data.get('high_priority', 0)}")
            print(f"   Flagged reports: {queue_data.get('flagged_reports', 0)}")
            print(f"   Reports in queue: {len(queue_data.get('pending_reports', []))}")
            
            # Display first report if available
            if queue_data.get('pending_reports'):
                first_report = queue_data['pending_reports'][0]
                print(f"\n   First report:")
                print(f"   - ID: {first_report.get('id')}")
                print(f"   - Title: {first_report.get('title')}")
                print(f"   - Status: {first_report.get('verification_status')}")
                print(f"   - Priority: {first_report.get('moderation_priority')}")
                
                # Step 3: Test moderation action
                print("\n3. Testing moderation action...")
                report_id = first_report.get('id')
                moderation_data = {
                    "verification_status": "verified",
                    "verification_notes": "Test verification - report looks legitimate"
                }
                
                try:
                    moderate_response = requests.put(
                        f"{BASE_URL}/emergency/moderation/{report_id}",
                        json=moderation_data,
                        headers=headers
                    )
                    
                    if moderate_response.status_code == 200:
                        print(f"✅ Moderation successful!")
                        moderated_report = moderate_response.json()
                        print(f"   - New status: {moderated_report.get('verification_status')}")
                        print(f"   - Verified: {moderated_report.get('is_verified')}")
                        print(f"   - Notes: {moderated_report.get('verification_notes')}")
                    else:
                        print(f"❌ Moderation failed: {moderate_response.status_code}")
                        print(f"   Error: {moderate_response.text}")
                        
                except requests.exceptions.RequestException as e:
                    print(f"❌ Connection error during moderation: {e}")
            
        else:
            print(f"❌ Moderation queue failed: {queue_response.status_code}")
            print(f"   Error: {queue_response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error during queue check: {e}")
    
    print("\n🏁 Test completed!")

if __name__ == "__main__":
    test_moderation_api()
