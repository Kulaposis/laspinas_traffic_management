#!/usr/bin/env python3
"""
Script to run database migrations for emergency photo and moderation features
"""

import subprocess
import sys
import os
from pathlib import Path

def run_migration():
    """Run alembic migration"""
    try:
        print("🔄 Running database migration...")
        
        # Change to backend directory
        backend_dir = Path(__file__).parent
        os.chdir(backend_dir)
        
        # Run alembic upgrade
        result = subprocess.run(['alembic', 'upgrade', 'head'], 
                              capture_output=True, text=True, check=True)
        
        print("✅ Database migration completed successfully!")
        print(result.stdout)
        
        return True
        
    except subprocess.CalledProcessError as e:
        print("❌ Migration failed!")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        return False

def check_database():
    """Check if database tables exist"""
    try:
        from app.db import engine
        from sqlalchemy import text
        
        print("\n🔍 Checking database tables...")
        
        with engine.connect() as connection:
            # Check if emergencies table has new columns
            result = connection.execute(text("PRAGMA table_info(emergencies)"))
            columns = [row[1] for row in result.fetchall()]
            
            required_columns = [
                'photo_urls', 'is_verified', 'verification_status', 
                'verified_by', 'verified_at', 'verification_notes', 
                'moderation_priority'
            ]
            
            missing_columns = [col for col in required_columns if col not in columns]
            
            if missing_columns:
                print(f"❌ Missing columns: {missing_columns}")
                print("🔄 Migration may be needed")
                return False
            else:
                print("✅ All required columns exist")
                return True
                
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return False

def main():
    """Main function"""
    print("🛠️  Emergency Photo & Moderation Database Setup")
    print("=" * 50)
    
    # Check current database state
    db_ok = check_database()
    
    if not db_ok:
        print("\n🔄 Running migration to add missing columns...")
        migration_ok = run_migration()
        
        if migration_ok:
            print("\n✅ Checking database again...")
            check_database()
        else:
            print("\n❌ Migration failed. Please check the error messages above.")
            sys.exit(1)
    else:
        print("\n✅ Database is already up to date!")
    
    print("\n🎉 Database setup completed successfully!")
    print("\n📋 Next steps:")
    print("   1. Start the backend server: uvicorn app.main:app --reload")
    print("   2. Test emergency reporting with photos")
    print("   3. Access admin moderation interface")

if __name__ == "__main__":
    main()
