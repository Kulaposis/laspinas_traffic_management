#!/usr/bin/env python3
"""
Test Emergency CORS Endpoints
This script tests if the CORS fixes are working for emergency endpoints
"""

import requests
import json
import time

# Test configuration
BASE_URL = "http://localhost:8000"
FRONTEND_ORIGIN = "http://localhost:5173"

def test_cors_headers():
    """Test CORS headers on emergency endpoints"""
    
    print("🔍 Testing CORS Headers for Emergency Center...")
    print(f"Backend URL: {BASE_URL}")
    print(f"Frontend Origin: {FRONTEND_ORIGIN}")
    print("-" * 50)
    
    # Test endpoints that were failing in the console
    test_endpoints = [
        "/emergency/active",
        "/emergency/",
        "/emergency/statistics?days=30",
        "/emergency/complaints?limit=50",
        "/health"
    ]
    
    for endpoint in test_endpoints:
        print(f"\n📡 Testing: {endpoint}")
        
        try:
            # Test OPTIONS request (preflight)
            options_response = requests.options(
                f"{BASE_URL}{endpoint}",
                headers={
                    "Origin": FRONTEND_ORIGIN,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Authorization, Content-Type"
                },
                timeout=5
            )
            
            print(f"   OPTIONS Status: {options_response.status_code}")
            print(f"   CORS Headers: {dict(options_response.headers)}")
            
            # Test actual GET request
            get_response = requests.get(
                f"{BASE_URL}{endpoint}",
                headers={
                    "Origin": FRONTEND_ORIGIN,
                    "Content-Type": "application/json"
                },
                timeout=5
            )
            
            print(f"   GET Status: {get_response.status_code}")
            
            # Check for CORS headers
            cors_headers = {
                "Access-Control-Allow-Origin": get_response.headers.get("Access-Control-Allow-Origin"),
                "Access-Control-Allow-Methods": get_response.headers.get("Access-Control-Allow-Methods"),
                "Access-Control-Allow-Headers": get_response.headers.get("Access-Control-Allow-Headers"),
                "Access-Control-Allow-Credentials": get_response.headers.get("Access-Control-Allow-Credentials")
            }
            
            print(f"   CORS Headers: {cors_headers}")
            
            # Check if CORS is properly configured
            if cors_headers["Access-Control-Allow-Origin"] in ["*", FRONTEND_ORIGIN]:
                print("   ✅ CORS Origin: OK")
            else:
                print("   ❌ CORS Origin: MISSING")
            
            if get_response.status_code < 400:
                print("   ✅ Endpoint: ACCESSIBLE")
            else:
                print(f"   ❌ Endpoint: ERROR ({get_response.status_code})")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Connection Error: {e}")

def main():
    """Run CORS tests"""
    print("🚀 Emergency Center CORS Test")
    print("=" * 50)
    
    # Wait a moment for server to start
    print("⏳ Waiting for server to start...")
    time.sleep(2)
    
    # Test server availability
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend server is running")
            data = response.json()
            if data.get("cors_fix") == "applied":
                print("✅ CORS fixes are applied")
            else:
                print("⚠️  CORS fixes may not be applied")
        else:
            print(f"❌ Backend server error: {response.status_code}")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend: {e}")
        return
    
    # Run CORS tests
    test_cors_headers()
    
    print("\n" + "=" * 50)
    print("🎯 Test Complete!")
    print("If you see ✅ for CORS Origin and Endpoint, the fixes are working.")
    print("If you see ❌, there are still CORS issues to resolve.")

if __name__ == "__main__":
    main()
