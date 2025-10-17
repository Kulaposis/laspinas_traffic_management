import requests
import json

# Test the emergency endpoints
base_url = "http://localhost:8000"

def test_emergency_endpoints():
    print("Testing Emergency API endpoints...")
    
    # Test basic health check
    try:
        response = requests.get(f"{base_url}/health")
        print(f"Health check: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return
    
    # Test emergency endpoints that should work without authentication
    endpoints_to_test = [
        "/emergency/my-reports",
        "/emergency/",
        "/emergency/active"
    ]
    
    for endpoint in endpoints_to_test:
        try:
            print(f"\nTesting {endpoint}...")
            response = requests.get(f"{base_url}{endpoint}")
            print(f"Status: {response.status_code}")
            if response.status_code != 200:
                print(f"Error response: {response.text[:200]}...")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    test_emergency_endpoints()
