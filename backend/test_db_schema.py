#!/usr/bin/env python3
"""
Test script to verify database schema and fix any issues
"""

import sqlite3
import os
from pathlib import Path

def test_database_schema():
    """Test and fix database schema issues"""
    try:
        # Get database path
        db_path = Path(__file__).parent / "traffic_management.db"
        
        print(f"🔍 Testing database schema in {db_path}")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check current schema
        cursor.execute("PRAGMA table_info(traffic_monitoring)")
        columns = cursor.fetchall()
        
        print(f"📋 Current traffic_monitoring columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Check if required fields exist
        column_names = [col[1] for col in columns]
        required_fields = ['barangay', 'data_source', 'confidence_score']
        
        missing_fields = [field for field in required_fields if field not in column_names]
        
        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}")
            
            # Add missing fields
            for field in missing_fields:
                if field == 'barangay':
                    cursor.execute("ALTER TABLE traffic_monitoring ADD COLUMN barangay TEXT NOT NULL DEFAULT 'Unknown'")
                elif field == 'data_source':
                    cursor.execute("ALTER TABLE traffic_monitoring ADD COLUMN data_source TEXT NOT NULL DEFAULT 'tomtom_api'")
                elif field == 'confidence_score':
                    cursor.execute("ALTER TABLE traffic_monitoring ADD COLUMN confidence_score REAL NOT NULL DEFAULT 1.0")
                
                print(f"  ✅ Added {field} field")
            
            conn.commit()
        else:
            print(f"✅ All required fields exist")
        
        # Test a simple query
        cursor.execute("SELECT COUNT(*) FROM traffic_monitoring")
        count = cursor.fetchone()[0]
        print(f"📊 Total records in traffic_monitoring: {count}")
        
        # Test querying with new fields
        cursor.execute("SELECT id, road_name, barangay, data_source, confidence_score FROM traffic_monitoring LIMIT 3")
        sample_records = cursor.fetchall()
        
        print(f"📋 Sample records:")
        for record in sample_records:
            print(f"  - ID: {record[0]}, Road: {record[1]}, Barangay: {record[2]}, Source: {record[3]}, Confidence: {record[4]}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error testing database: {e}")
        return False

def main():
    """Main function"""
    print("🛠️  Database Schema Test")
    print("=" * 50)
    
    success = test_database_schema()
    
    if success:
        print("\n✅ Database schema test completed successfully!")
    else:
        print("\n❌ Database schema test failed!")

if __name__ == "__main__":
    main()
