import requests
import json

# Test the emergency endpoints with authentication
base_url = "http://localhost:8000"

def create_test_user_and_login():
    """Create a test user and get auth token"""
    # First, try to create a test user
    user_data = {
        "username": "testuser",
        "email": "test@example.com", 
        "password": "testpassword123",
        "full_name": "Test User",
        "phone": "1234567890",
        "role": "citizen"
    }
    
    try:
        # Try to register the user
        response = requests.post(f"{base_url}/auth/register", json=user_data)
        if response.status_code == 201:
            print("✓ Test user created successfully")
        elif response.status_code == 400 and "already registered" in response.text:
            print("- Test user already exists")
        else:
            print(f"User creation failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"User creation error: {e}")
    
    # Now try to login
    login_data = {
        "username": "testuser",
        "password": "testpassword123"
    }
    
    try:
        response = requests.post(f"{base_url}/auth/login", data=login_data)
        if response.status_code == 200:
            token_data = response.json()
            print("✓ Login successful")
            return token_data.get("access_token")
        else:
            print(f"Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Login error: {e}")
        return None

def test_emergency_endpoints_with_auth():
    print("Testing Emergency API endpoints with authentication...")
    
    # Get auth token
    token = create_test_user_and_login()
    if not token:
        print("❌ Cannot test endpoints without authentication")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test emergency endpoints
    endpoints_to_test = [
        "/emergency/my-reports",
        "/emergency/complaints"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            print(f"\nTesting {endpoint}...")
            response = requests.get(f"{base_url}{endpoint}", headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"✓ Success - returned {len(data) if isinstance(data, list) else 'data'}")
            else:
                print(f"Error response: {response.text[:200]}...")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_emergency_endpoints_with_auth()
