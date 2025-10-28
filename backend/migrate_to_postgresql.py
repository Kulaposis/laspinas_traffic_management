#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script for Traffic Management System
Migrates data from SQLite to PostgreSQL database
"""

import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime
from pathlib import Path

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

def migrate_table_data(sqlite_conn, pg_conn, table_name, columns, data_types=None):
    """Migrate data from SQLite table to PostgreSQL table"""
    print(f"📦 Migrating table: {table_name}")
    
    try:
        # Get data from SQLite
        cursor = sqlite_conn.cursor()
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
        pg_cursor.execute(f"DELETE FROM {table_name}")
        
        # Insert data
        for row in rows:
            # Convert None values and handle data types
            processed_row = []
            for i, value in enumerate(row):
                if value is None:
                    processed_row.append(None)
                elif data_types and i < len(data_types):
                    # Handle specific data types
                    if data_types[i] == 'json' and isinstance(value, str):
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
        
        pg_conn.commit()
        print(f"   ✅ Successfully migrated {len(rows)} rows")
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
    
    # Define tables and their columns for migration based on actual SQLite schema
    tables_to_migrate = [
        {
            'name': 'users',
            'columns': ['id', 'email', 'hashed_password', 'full_name', 'phone_number', 'role', 'is_active', 'created_at', 'updated_at'],
            'data_types': ['int', 'str', 'str', 'str', 'str', 'str', 'bool', 'datetime', 'datetime']
        },
        {
            'name': 'reports',
            'columns': ['id', 'user_id', 'location', 'description', 'severity', 'status', 'latitude', 'longitude', 'created_at', 'updated_at'],
            'data_types': ['int', 'int', 'str', 'str', 'str', 'str', 'float', 'float', 'datetime', 'datetime']
        },
        {
            'name': 'violations',
            'columns': ['id', 'user_id', 'violation_type', 'description', 'location', 'latitude', 'longitude', 'status', 'created_at', 'updated_at'],
            'data_types': ['int', 'int', 'str', 'str', 'str', 'float', 'float', 'str', 'datetime', 'datetime']
        },
        {
            'name': 'notifications',
            'columns': ['id', 'user_id', 'title', 'message', 'type', 'is_read', 'created_at'],
            'data_types': ['int', 'int', 'str', 'str', 'str', 'bool', 'datetime']
        },
        {
            'name': 'weather_data',
            'columns': ['id', 'location', 'temperature', 'humidity', 'precipitation', 'wind_speed', 'description', 'created_at'],
            'data_types': ['int', 'str', 'float', 'float', 'float', 'float', 'str', 'datetime']
        },
        {
            'name': 'emergencies',
            'columns': ['id', 'user_id', 'emergency_type', 'description', 'location', 'latitude', 'longitude', 'status', 'priority', 'created_at', 'updated_at'],
            'data_types': ['int', 'int', 'str', 'str', 'str', 'float', 'float', 'str', 'str', 'datetime', 'datetime']
        },
        {
            'name': 'parking',
            'columns': ['id', 'user_id', 'vehicle_plate', 'violation_type', 'location', 'latitude', 'longitude', 'fine_amount', 'status', 'created_at', 'updated_at'],
            'data_types': ['int', 'int', 'str', 'str', 'str', 'float', 'float', 'float', 'str', 'datetime', 'datetime']
        },
        {
            'name': 'incident_prone_areas',
            'columns': ['id', 'name', 'description', 'latitude', 'longitude', 'incident_count', 'severity_level', 'created_at', 'updated_at'],
            'data_types': ['int', 'str', 'str', 'float', 'float', 'int', 'str', 'datetime', 'datetime']
        },
        {
            'name': 'travel_sessions',
            'columns': ['id', 'user_id', 'start_location', 'end_location', 'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude', 'distance', 'duration', 'created_at'],
            'data_types': ['int', 'int', 'str', 'str', 'float', 'float', 'float', 'float', 'float', 'float', 'datetime']
        },
        {
            'name': 'traffic_monitoring',
            'columns': ['id', 'location', 'traffic_level', 'speed', 'vehicle_count', 'latitude', 'longitude', 'created_at'],
            'data_types': ['int', 'str', 'str', 'float', 'int', 'float', 'float', 'datetime']
        },
        {
            'name': 'road_incidents',
            'columns': ['id', 'location', 'incident_type', 'description', 'severity', 'latitude', 'longitude', 'status', 'created_at', 'updated_at'],
            'data_types': ['int', 'str', 'str', 'str', 'str', 'float', 'float', 'str', 'datetime', 'datetime']
        },
        {
            'name': 'traffic_lines',
            'columns': ['id', 'name', 'description', 'start_latitude', 'start_longitude', 'end_latitude', 'end_longitude', 'created_at'],
            'data_types': ['int', 'str', 'str', 'float', 'float', 'float', 'float', 'datetime']
        }
    ]
    
    # Migrate each table
    success_count = 0
    total_tables = len(tables_to_migrate)
    
    for table_info in tables_to_migrate:
        table_name = table_info['name']
        columns = table_info['columns']
        data_types = table_info.get('data_types')
        
        # Check if table exists in SQLite
        cursor = sqlite_conn.cursor()
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        if not cursor.fetchone():
            print(f"   ⚠️  Table {table_name} not found in SQLite, skipping...")
            continue
        
        if migrate_table_data(sqlite_conn, pg_conn, table_name, columns, data_types):
            success_count += 1
    
    # Close connections
    sqlite_conn.close()
    pg_conn.close()
    
    print()
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
    parser.add_argument("--env-file", default=".env",
                       help="Environment file containing DATABASE_URL")
    
    args = parser.parse_args()
    
    # Get PostgreSQL URL
    postgresql_url = args.postgresql_url
    if not postgresql_url:
        # Try to get from environment file
        if os.path.exists(args.env_file):
            from dotenv import load_dotenv
            load_dotenv(args.env_file)
            postgresql_url = os.getenv("DATABASE_URL")
    
    if not postgresql_url:
        print("❌ Error: PostgreSQL URL not provided")
        print("   Use --postgresql-url or set DATABASE_URL in .env file")
        return False
    
    if not postgresql_url.startswith("postgresql"):
        print("❌ Error: DATABASE_URL must be a PostgreSQL connection string")
        return False
    
    # Run migration
    return migrate_database(args.sqlite_path, postgresql_url)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
