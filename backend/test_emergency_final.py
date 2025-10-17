import requests
import json

# Test the emergency endpoints with existing users
base_url = "http://localhost:8000"

def test_login(username, password):
    """Test login with existing user"""
    login_data = {
        "username": username,
        "password": password
    }
    
    try:
        response = requests.post(f"{base_url}/auth/login", data=login_data)
        if response.status_code == 200:
            token_data = response.json()
            print(f"✓ Login successful for {username}")
            return token_data.get("access_token")
        else:
            print(f"Login failed for {username}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error for {username}: {e}")
        return None

def test_emergency_endpoints():
    print("Testing Emergency API endpoints...")
    
    # Try different users
    users_to_try = [
        ("admin", "admin123"),
        ("admin", "password"),
        ("citizen1", "password"),
        ("citizen1", "citizen123"),
    ]
    
    token = None
    for username, password in users_to_try:
        token = test_login(username, password)
        if token:
            break
    
    if not token:
        print("❌ Cannot test endpoints without authentication")
        print("Let's try to test without auth first to see the exact error...")
        
        # Test without auth to see the actual error
        try:
            response = requests.get(f"{base_url}/emergency/my-reports")
            print(f"No-auth test: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"No-auth test error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test emergency endpoints
    endpoints_to_test = [
        ("/emergency/my-reports", "GET"),
        ("/emergency/complaints", "GET"),
    ]
    
    for endpoint, method in endpoints_to_test:
        try:
            print(f"\nTesting {method} {endpoint}...")
            if method == "GET":
                response = requests.get(f"{base_url}{endpoint}", headers=headers)
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Success - returned {len(data) if isinstance(data, list) else 'data'}")
                if isinstance(data, list) and len(data) == 0:
                    print("  (Empty list - no data yet, which is normal)")
            elif response.status_code == 403:
                print("  (403 Forbidden - user may not have required permissions)")
            else:
                print(f"Error response: {response.text[:300]}...")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_emergency_endpoints()
