import sqlite3
import os
from passlib.context import CryptContext

def check_users():
    """Check existing users in the database"""
    
    db_path = 'traffic_management.db'
    if not os.path.exists(db_path):
        print(f"Database file {db_path} does not exist")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check users table structure
    print("Users table structure:")
    cursor.execute("PRAGMA table_info(users)")
    for row in cursor.fetchall():
        print(f"  {row[1]} {row[2]}")
    
    # Check existing users
    print("\nExisting users:")
    cursor.execute("SELECT id, username, email, full_name, role FROM users")
    users = cursor.fetchall()
    
    if users:
        for user in users:
            print(f"  ID: {user[0]}, Username: {user[1]}, Email: {user[2]}, Name: {user[3]}, Role: {user[4]}")
    else:
        print("  No users found")
    
    conn.close()

def create_admin_user():
    """Create an admin user for testing"""
    
    db_path = 'traffic_management.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create password context
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed_password = pwd_context.hash("admin123")
    
    try:
        # Insert admin user
        cursor.execute("""
            INSERT INTO users (username, email, hashed_password, full_name, phone, role, is_active, is_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("admin", "admin@test.com", hashed_password, "Admin User", "1234567890", "admin", 1, 1))
        
        conn.commit()
        print("✓ Admin user created successfully")
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
    
    conn.close()

if __name__ == "__main__":
    check_users()
    print("\n" + "="*50)
    create_admin_user()
    print("\n" + "="*50)
    check_users()
