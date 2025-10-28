#!/usr/bin/env python3
"""
Database Backup Script for Traffic Management System
Backs up SQLite database to a timestamped file
"""

import os
import shutil
import sqlite3
import datetime
import argparse
from pathlib import Path

def backup_sqlite_database(db_path, backup_dir="backups"):
    """
    Backup SQLite database to a timestamped file
    
    Args:
        db_path (str): Path to the SQLite database file
        backup_dir (str): Directory to store backup files
    """
    
    # Create backup directory if it doesn't exist
    Path(backup_dir).mkdir(parents=True, exist_ok=True)
    
    # Generate timestamp for backup filename
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"traffic_management_backup_{timestamp}.db"
    backup_path = os.path.join(backup_dir, backup_filename)
    
    try:
        # Check if source database exists
        if not os.path.exists(db_path):
            print(f"❌ Error: Database file not found at {db_path}")
            return False
            
        # Create backup using SQLite's backup API for integrity
        source_conn = sqlite3.connect(db_path)
        backup_conn = sqlite3.connect(backup_path)
        
        # Use SQLite's backup API
        source_conn.backup(backup_conn)
        
        # Close connections
        source_conn.close()
        backup_conn.close()
        
        # Get file size for verification
        backup_size = os.path.getsize(backup_path)
        original_size = os.path.getsize(db_path)
        
        print(f"✅ Database backup created successfully!")
        print(f"   Source: {db_path} ({original_size:,} bytes)")
        print(f"   Backup: {backup_path} ({backup_size:,} bytes)")
        
        # Verify backup integrity
        if backup_size == original_size:
            print(f"✅ Backup integrity verified")
            return True
        else:
            print(f"❌ Warning: Backup size mismatch!")
            return False
            
    except Exception as e:
        print(f"❌ Error creating backup: {e}")
        return False

def restore_database(backup_path, target_path):
    """
    Restore SQLite database from backup
    
    Args:
        backup_path (str): Path to the backup file
        target_path (str): Path where to restore the database
    """
    
    try:
        # Check if backup file exists
        if not os.path.exists(backup_path):
            print(f"❌ Error: Backup file not found at {backup_path}")
            return False
            
        # Create target directory if it doesn't exist
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        
        # Copy backup to target location
        shutil.copy2(backup_path, target_path)
        
        # Verify restoration
        if os.path.exists(target_path):
            backup_size = os.path.getsize(backup_path)
            restored_size = os.path.getsize(target_path)
            
            if backup_size == restored_size:
                print(f"✅ Database restored successfully!")
                print(f"   From: {backup_path} ({backup_size:,} bytes)")
                print(f"   To: {target_path} ({restored_size:,} bytes)")
                return True
            else:
                print(f"❌ Error: Restored file size mismatch!")
                return False
        else:
            print(f"❌ Error: Failed to create restored database")
            return False
            
    except Exception as e:
        print(f"❌ Error restoring database: {e}")
        return False

def list_backups(backup_dir="backups"):
    """
    List available backup files
    
    Args:
        backup_dir (str): Directory containing backup files
    """
    
    if not os.path.exists(backup_dir):
        print(f"❌ Backup directory not found: {backup_dir}")
        return
        
    backup_files = [f for f in os.listdir(backup_dir) if f.endswith('.db')]
    
    if not backup_files:
        print(f"❌ No backup files found in {backup_dir}")
        return
        
    print(f"📁 Available backups in {backup_dir}:")
    for i, backup_file in enumerate(sorted(backup_files, reverse=True), 1):
        backup_path = os.path.join(backup_dir, backup_file)
        file_size = os.path.getsize(backup_path)
        file_time = datetime.datetime.fromtimestamp(os.path.getmtime(backup_path))
        print(f"   {i}. {backup_file}")
        print(f"      Size: {file_size:,} bytes")
        print(f"      Date: {file_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print()

def main():
    parser = argparse.ArgumentParser(description="Traffic Management Database Backup Tool")
    parser.add_argument("action", choices=["backup", "restore", "list"], 
                       help="Action to perform: backup, restore, or list")
    parser.add_argument("--db-path", default="./data/traffic_management.db",
                       help="Path to SQLite database (default: ./data/traffic_management.db)")
    parser.add_argument("--backup-dir", default="backups",
                       help="Backup directory (default: backups)")
    parser.add_argument("--backup-file", 
                       help="Backup file to restore (required for restore action)")
    
    args = parser.parse_args()
    
    if args.action == "backup":
        success = backup_sqlite_database(args.db_path, args.backup_dir)
        exit(0 if success else 1)
        
    elif args.action == "restore":
        if not args.backup_file:
            print("❌ Error: --backup-file is required for restore action")
            exit(1)
        backup_path = os.path.join(args.backup_dir, args.backup_file)
        success = restore_database(backup_path, args.db_path)
        exit(0 if success else 1)
        
    elif args.action == "list":
        list_backups(args.backup_dir)

if __name__ == "__main__":
    main()
