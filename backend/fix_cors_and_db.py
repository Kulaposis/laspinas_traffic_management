#!/usr/bin/env python3
"""
Script to fix CORS issues and ensure database is properly set up
"""

import os
import subprocess
import sys
from pathlib import Path

def check_backend_running():
    """Check if backend server is running"""
    try:
        import requests
        response = requests.get("http://localhost:8000/health", timeout=5)
        return response.status_code == 200
    except:
        return False

def run_database_migration():
    """Run database migration"""
    try:
        print("🔄 Running database migration...")
        backend_dir = Path(__file__).parent
        os.chdir(backend_dir)
        
        # Run alembic upgrade
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Database migration completed successfully!")
            return True
        else:
            print("⚠️  Migration had issues:")
            print(result.stdout)
            print(result.stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        return False

def check_emergency_endpoints():
    """Check if emergency endpoints are accessible"""
    try:
        import requests
        
        print("🔍 Checking emergency endpoints...")
        
        # Test basic health endpoint first
        health_response = requests.get("http://localhost:8000/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ Backend health check failed")
            return False
        
        print("✅ Backend health check passed")
        
        # Test emergency endpoints (these will fail without auth, but should return 401/403, not 500)
        endpoints_to_test = [
            "/emergency/",
            "/emergency/active", 
            "/emergency/statistics"
        ]
        
        for endpoint in endpoints_to_test:
            try:
                response = requests.get(f"http://localhost:8000{endpoint}", timeout=5)
                # We expect 401 (unauthorized) or 403 (forbidden), not 500 (server error)
                if response.status_code in [401, 403]:
                    print(f"✅ {endpoint} - Authentication required (expected)")
                elif response.status_code == 500:
                    print(f"❌ {endpoint} - Server error (needs fixing)")
                    print(f"   Response: {response.text}")
                else:
                    print(f"ℹ️  {endpoint} - Status: {response.status_code}")
            except Exception as e:
                print(f"❌ {endpoint} - Connection failed: {e}")
                
        return True
        
    except Exception as e:
        print(f"❌ Error checking endpoints: {e}")
        return False

def create_test_data():
    """Create some test data to verify everything works"""
    try:
        print("📊 Creating test data...")
        
        # Import here to avoid issues if modules aren't available
        from app.db import SessionLocal
        from app.models.user import User, UserRole
        from app.models.events import Emergency, EmergencyType, EmergencyStatus
        import uuid
        from datetime import datetime
        
        db = SessionLocal()
        
        # Check if admin user exists
        admin_user = db.query(User).filter(User.email == "admin@test.com").first()
        if not admin_user:
            print("Creating test admin user...")
            admin_user = User(
                username="testadmin",
                email="admin@test.com",
                full_name="Test Administrator",
                role=UserRole.ADMIN,
                hashed_password="$2b$12$test_hashed_password"  # This is just for testing
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print("✅ Test admin user created")
        
        # Check if test emergency exists
        test_emergency = db.query(Emergency).first()
        if not test_emergency:
            print("Creating test emergency...")
            emergency_number = f"EM{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
            test_emergency = Emergency(
                emergency_number=emergency_number,
                emergency_type=EmergencyType.ACCIDENT,
                title="Test Emergency Report",
                description="This is a test emergency for verification",
                severity="medium",
                latitude=14.4504,
                longitude=121.0170,
                address="Test Location, Las Piñas City",
                reporter_id=admin_user.id,
                status=EmergencyStatus.REPORTED,
                photo_urls="[]",  # Empty JSON array
                is_verified=False,
                verification_status="pending",
                moderation_priority="normal"
            )
            db.add(test_emergency)
            db.commit()
            print("✅ Test emergency created")
        
        db.close()
        print("✅ Test data setup completed")
        return True
        
    except Exception as e:
        print(f"❌ Error creating test data: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main function"""
    print("🛠️  CORS and Database Fix Script")
    print("=" * 40)
    
    # Check if backend is running
    if check_backend_running():
        print("✅ Backend server is running")
        
        # Test endpoints
        check_emergency_endpoints()
        
    else:
        print("❌ Backend server is not running")
        print("Please start the backend server with:")
        print("   cd backend")
        print("   uvicorn app.main:app --reload")
        print("\nThen run this script again to test the endpoints.")
        return
    
    # Run migration
    migration_ok = run_database_migration()
    
    # Create test data
    if migration_ok:
        create_test_data()
    
    print("\n🎉 Setup completed!")
    print("\n📋 Next steps:")
    print("   1. Restart the backend server to apply CORS changes")
    print("   2. Refresh the frontend page")
    print("   3. Check if CORS errors are resolved")
    print("\n🔧 If CORS errors persist:")
    print("   - Check that frontend is running on http://localhost:5173")
    print("   - Clear browser cache and cookies")
    print("   - Try opening in incognito/private mode")

if __name__ == "__main__":
    main()
