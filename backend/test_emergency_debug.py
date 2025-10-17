#!/usr/bin/env python3
"""
Debug script to test emergency endpoint with authentication
"""
import requests
import json

# Test configuration
BASE_URL = "http://localhost:8000"

def test_login():
    """Test login and get token"""
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
        print(f"Login Response Status: {response.status_code}")
        print(f"Login Response Headers: {dict(response.headers)}")
        print(f"Login Response Content: {response.text}")
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        else:
            print(f"Login failed: {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_emergency_report_with_token(token):
    """Test emergency report with authentication token"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    emergency_data = {
        "emergency_type": "accident",
        "title": "Test Emergency",
        "description": "Test emergency report for debugging",
        "severity": "medium",
        "latitude": 14.3800,
        "longitude": 120.9185,
        "address": "Test Address",
        "photo_urls": []
    }
    
    try:
        print(f"\nTesting emergency report with token...")
        print(f"Headers: {headers}")
        print(f"Data: {json.dumps(emergency_data, indent=2)}")
        
        response = requests.post(
            f"{BASE_URL}/emergency/report",
            headers=headers,
            json=emergency_data
        )
        
        print(f"Emergency Report Response Status: {response.status_code}")
        print(f"Emergency Report Response Headers: {dict(response.headers)}")
        print(f"Emergency Report Response Content: {response.text}")
        
        return response.status_code == 201
        
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return False
    except Exception as e:
        print(f"Emergency report error: {e}")
        return False

def test_emergency_report_without_token():
    """Test emergency report without authentication token"""
    headers = {
        "Content-Type": "application/json"
    }
    
    emergency_data = {
        "emergency_type": "accident",
        "title": "Test Emergency",
        "description": "Test emergency report without auth",
        "severity": "medium",
        "latitude": 14.3800,
        "longitude": 120.9185
    }
    
    try:
        print(f"\nTesting emergency report without token...")
        response = requests.post(
            f"{BASE_URL}/emergency/report",
            headers=headers,
            json=emergency_data
        )
        
        print(f"No Auth Response Status: {response.status_code}")
        print(f"No Auth Response Content: {response.text}")
        
    except Exception as e:
        print(f"No auth test error: {e}")

def test_cors_preflight():
    """Test CORS preflight request"""
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization,Content-Type"
    }
    
    try:
        print(f"\nTesting CORS preflight...")
        response = requests.options(f"{BASE_URL}/emergency/report", headers=headers)
        
        print(f"CORS Preflight Status: {response.status_code}")
        print(f"CORS Preflight Headers: {dict(response.headers)}")
        print(f"CORS Preflight Content: {response.text}")
        
    except Exception as e:
        print(f"CORS preflight error: {e}")

def main():
    print("=== Emergency Endpoint Debug Test ===")
    
    # Test 1: CORS preflight
    test_cors_preflight()
    
    # Test 2: Without authentication
    test_emergency_report_without_token()
    
    # Test 3: With authentication
    token = test_login()
    if token:
        success = test_emergency_report_with_token(token)
        if success:
            print("\n✅ Emergency report with authentication: SUCCESS")
        else:
            print("\n❌ Emergency report with authentication: FAILED")
    else:
        print("\n❌ Could not get authentication token")
    
    print("\n=== Debug Test Complete ===")

if __name__ == "__main__":
    main()
