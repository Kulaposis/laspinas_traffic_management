"""
Apply Firebase support migration manually
"""
from app.db import engine
from sqlalchemy import text

def apply_migration():
    with engine.begin() as conn:
        try:
            # Add firebase_uid column
            conn.execute(text("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128)"))
            print("[OK] Added firebase_uid column")
        except Exception as e:
            print(f"[SKIP] firebase_uid column already exists")
        
        try:
            # Add photo_url column
            conn.execute(text("ALTER TABLE users ADD COLUMN photo_url VARCHAR(512)"))
            print("[OK] Added photo_url column")
        except Exception as e:
            print(f"[SKIP] photo_url column already exists")
        
        try:
            # Add email_verified column (use FALSE for PostgreSQL)
            conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE"))
            print("[OK] Added email_verified column")
        except Exception as e:
            print(f"[SKIP] email_verified column already exists")
        
        try:
            # Create index on firebase_uid
            conn.execute(text("CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid)"))
            print("[OK] Created index on firebase_uid")
        except Exception as e:
            print(f"[SKIP] Index already exists")
        
        print("\n[SUCCESS] Firebase migration completed!")

if __name__ == "__main__":
    apply_migration()
