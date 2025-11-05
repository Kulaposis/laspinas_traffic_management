#!/usr/bin/env python3
"""
Script to create an admin account in Supabase database
Usage: python create_admin.py
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.db import SessionLocal
from app.models.user import User, UserRole
from app.auth import get_password_hash
import getpass

def create_admin_account():
    """Create an admin account interactively"""
    
    print("=" * 60)
    print("Admin Account Creation Script")
    print("=" * 60)
    print()
    
    # Get admin details
    email = input("Enter admin email: ").strip()
    if not email:
        print("❌ Email is required!")
        return False
    
    username = input("Enter admin username: ").strip()
    if not username:
        print("❌ Username is required!")
        return False
    
    full_name = input("Enter full name: ").strip()
    if not full_name:
        print("❌ Full name is required!")
        return False
    
    phone_number = input("Enter phone number (optional): ").strip() or None
    
    # Get password securely
    password = getpass.getpass("Enter password: ")
    if not password:
        print("❌ Password is required!")
        return False
    
    password_confirm = getpass.getpass("Confirm password: ")
    if password != password_confirm:
        print("❌ Passwords do not match!")
        return False
    
    if len(password) < 8:
        print("⚠️  Warning: Password is less than 8 characters")
        confirm = input("Continue anyway? (y/N): ").strip().lower()
        if confirm != 'y':
            return False
    
    # Create database session
    db: Session = SessionLocal()
    
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(
            (User.email == email) | (User.username == username)
        ).first()
        
        if existing_user:
            print(f"❌ User with email '{email}' or username '{username}' already exists!")
            if existing_user.role == UserRole.ADMIN:
                print(f"   User ID: {existing_user.id}")
                print(f"   Current role: {existing_user.role.value}")
                update = input("   Update this user to admin? (y/N): ").strip().lower()
                if update == 'y':
                    existing_user.role = UserRole.ADMIN
                    existing_user.hashed_password = get_password_hash(password)
                    existing_user.is_active = True
                    db.commit()
                    print(f"✅ User updated to admin successfully!")
                    print(f"   User ID: {existing_user.id}")
                    print(f"   Email: {existing_user.email}")
                    print(f"   Username: {existing_user.username}")
                    return True
            return False
        
        # Create new admin user
        hashed_password = get_password_hash(password)
        
        admin_user = User(
            email=email,
            username=username,
            hashed_password=hashed_password,
            full_name=full_name,
            phone_number=phone_number,
            role=UserRole.ADMIN,
            is_active=True,
            email_verified=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print()
        print("=" * 60)
        print("✅ Admin account created successfully!")
        print("=" * 60)
        print(f"   User ID: {admin_user.id}")
        print(f"   Email: {admin_user.email}")
        print(f"   Username: {admin_user.username}")
        print(f"   Full Name: {admin_user.full_name}")
        print(f"   Role: {admin_user.role.value}")
        print(f"   Status: {'Active' if admin_user.is_active else 'Inactive'}")
        print()
        print("You can now login with these credentials.")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating admin account: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    try:
        success = create_admin_account()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)



