#!/usr/bin/env python3
"""
Simple SQLite to PostgreSQL Migration Script
Dynamically migrates all tables with data
"""

import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

# Add the app directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.db import Base, engine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def get_sqlite_connection(db_path):
    """Get SQLite database connection"""
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"SQLite database not found at {db_path}")
    return sqlite3.connect(db_path)

def get_postgresql_connection(database_url):
    """Get PostgreSQL database connection"""
    try:
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        print(f"❌ Error connecting to PostgreSQL: {e}")
        raise

def migrate_table_dynamic(sqlite_conn, pg_conn, table_name):
    """Dynamically migrate table data from SQLite to PostgreSQL"""
    print(f"📦 Migrating table: {table_name}")
    
    try:
        # Get table schema from SQLite
        cursor = sqlite_conn.cursor()
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns_info = cursor.fetchall()
        
        if not columns_info:
            print(f"   ⚠️  Table {table_name} not found in SQLite")
            return True
            
        # Extract column names
        columns = [col[1] for col in columns_info]
        print(f"   📋 Columns: {columns}")
        
        # Get data from SQLite
        cursor.execute(f"SELECT * FROM {table_name}")
        rows = cursor.fetchall()
        
        if not rows:
            print(f"   ⚠️  No data found in {table_name}")
            return True
            
        print(f"   📊 Found {len(rows)} rows to migrate")
        
        # Prepare PostgreSQL cursor
        pg_cursor = pg_conn.cursor()
        
        # Create column list for INSERT
        column_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # Clear existing data (if any)
        try:
            pg_cursor.execute(f"DELETE FROM {table_name}")
        except Exception as e:
            print(f"   ⚠️  Could not clear existing data: {e}")
        
        # Insert data
        success_count = 0
        for row in rows:
            try:
                # Convert None values and handle data types
                processed_row = []
                for value in row:
                    if value is None:
                        processed_row.append(None)
                    elif isinstance(value, str):
                        # Handle JSON strings
                        if value.startswith('{') or value.startswith('['):
                            try:
                                processed_row.append(json.loads(value))
                            except:
                                processed_row.append(value)
                        else:
                            processed_row.append(value)
                    else:
                        processed_row.append(value)
                
                pg_cursor.execute(
                    f"INSERT INTO {table_name} ({column_list}) VALUES ({placeholders})",
                    tuple(processed_row)
                )
                success_count += 1
            except Exception as e:
                print(f"   ⚠️  Error inserting row: {e}")
                continue
        
        pg_conn.commit()
        print(f"   ✅ Successfully migrated {success_count}/{len(rows)} rows")
        return True
        
    except Exception as e:
        print(f"   ❌ Error migrating {table_name}: {e}")
        pg_conn.rollback()
        return False

def migrate_database(sqlite_path, postgresql_url):
    """Main migration function"""
    print("🚀 Starting SQLite to PostgreSQL migration...")
    print(f"   Source: {sqlite_path}")
    print(f"   Target: {postgresql_url}")
    print()
    
    # Connect to databases
    try:
        sqlite_conn = get_sqlite_connection(sqlite_path)
        pg_conn = get_postgresql_connection(postgresql_url)
        print("✅ Database connections established")
    except Exception as e:
        print(f"❌ Failed to connect to databases: {e}")
        return False
    
    # Create PostgreSQL tables using SQLAlchemy
    try:
        print("📋 Creating PostgreSQL tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ PostgreSQL tables created")
    except Exception as e:
        print(f"❌ Failed to create PostgreSQL tables: {e}")
        return False
    
    # Get all tables from SQLite
    cursor = sqlite_conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    # Filter out system tables
    system_tables = ['sqlite_sequence', 'alembic_version']
    tables_to_migrate = [t for t in tables if t not in system_tables]
    
    print(f"📋 Found {len(tables_to_migrate)} tables to migrate: {tables_to_migrate}")
    print()
    
    # Migrate each table
    success_count = 0
    total_tables = len(tables_to_migrate)
    
    for table_name in tables_to_migrate:
        if migrate_table_dynamic(sqlite_conn, pg_conn, table_name):
            success_count += 1
        print()
    
    # Close connections
    sqlite_conn.close()
    pg_conn.close()
    
    print(f"🎉 Migration completed!")
    print(f"   ✅ Successfully migrated: {success_count}/{total_tables} tables")
    
    if success_count == total_tables:
        print("   🎯 All tables migrated successfully!")
        return True
    else:
        print(f"   ⚠️  {total_tables - success_count} tables failed to migrate")
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate SQLite database to PostgreSQL")
    parser.add_argument("--sqlite-path", default="./traffic_management.db",
                       help="Path to SQLite database file")
    parser.add_argument("--postgresql-url", 
                       help="PostgreSQL connection URL (e.g., postgresql://user:pass@host:port/dbname)")
    
    args = parser.parse_args()
    
    # Get PostgreSQL URL
    postgresql_url = args.postgresql_url
    if not postgresql_url:
        postgresql_url = "postgresql://traffic_user:traffic_password@localhost:5432/traffic_management"
    
    if not postgresql_url.startswith("postgresql"):
        print("❌ Error: DATABASE_URL must be a PostgreSQL connection string")
        return False
    
    # Run migration
    return migrate_database(args.sqlite_path, postgresql_url)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
