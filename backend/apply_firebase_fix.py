#!/usr/bin/env python3
"""
Apply Firebase UID constraint fix to the database.
This script fixes the unique constraint on firebase_uid to allow multiple NULL values.
"""

import os
import sys
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def main():
    print("Applying Firebase UID constraint fix...")
    
    # Get database URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment")
        sys.exit(1)
    
    # Mask password in output
    masked_url = database_url[:30] + "..." if len(database_url) > 30 else database_url
    print(f"Database: {masked_url}")
    
    try:
        # Create engine
        engine = create_engine(database_url)
        
        with engine.begin() as conn:
            # Check current indexes
            inspector = inspect(conn)
            existing_indexes = {idx['name'] for idx in inspector.get_indexes('users')}
            print(f"Existing indexes on users table: {existing_indexes}")
            
            # Drop existing unique constraint/index if it exists
            if 'ix_users_firebase_uid' in existing_indexes:
                print("Dropping existing index ix_users_firebase_uid...")
                conn.execute(text("DROP INDEX IF EXISTS ix_users_firebase_uid"))
                print("Dropped")
            
            if 'users_firebase_uid_key' in existing_indexes:
                print("Dropping existing constraint users_firebase_uid_key...")
                conn.execute(text("DROP INDEX IF EXISTS users_firebase_uid_key"))
                print("Dropped")
            
            # Create partial unique index
            print("Creating partial unique index on firebase_uid...")
            conn.execute(text(
                "CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid) "
                "WHERE firebase_uid IS NOT NULL"
            ))
            print("Created partial unique index")
            
            # Verify the index
            print("\nVerifying index creation...")
            result = conn.execute(text(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE tablename = 'users' AND indexname = 'ix_users_firebase_uid'"
            ))
            
            for row in result:
                print(f"Index: {row[0]}")
                print(f"  Definition: {row[1]}")
        
        print("\nFirebase UID constraint fix applied successfully!")
        print("\nNext steps:")
        print("1. Restart the backend server")
        print("2. Test Firebase login again")
        
    except Exception as e:
        print(f"\nError applying fix: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
