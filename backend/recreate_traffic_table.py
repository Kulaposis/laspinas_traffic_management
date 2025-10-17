#!/usr/bin/env python3
"""
Script to recreate the traffic_monitoring table with the correct schema
"""

import sqlite3
import os
from pathlib import Path

def recreate_traffic_table():
    """Recreate traffic_monitoring table with correct schema"""
    try:
        # Get database path
        db_path = Path(__file__).parent / "traffic_management.db"
        
        print(f"🔄 Recreating traffic_monitoring table in {db_path}")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Backup existing data
        cursor.execute("SELECT * FROM traffic_monitoring")
        existing_data = cursor.fetchall()
        
        print(f"📋 Backing up {len(existing_data)} existing records...")
        
        # Drop and recreate table
        cursor.execute("DROP TABLE IF EXISTS traffic_monitoring")
        
        # Create new table with correct schema
        create_table_sql = """
        CREATE TABLE traffic_monitoring (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            road_name VARCHAR(255) NOT NULL,
            road_type VARCHAR(11) NOT NULL,
            latitude FLOAT NOT NULL,
            longitude FLOAT NOT NULL,
            barangay TEXT NOT NULL DEFAULT 'Unknown',
            traffic_status VARCHAR(10) NOT NULL DEFAULT 'free_flow',
            average_speed_kmh FLOAT,
            vehicle_count INTEGER NOT NULL DEFAULT 0,
            congestion_percentage FLOAT NOT NULL DEFAULT 0.0,
            estimated_travel_time FLOAT,
            road_segment_length FLOAT,
            data_source TEXT NOT NULL DEFAULT 'tomtom_api',
            confidence_score REAL NOT NULL DEFAULT 1.0,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        cursor.execute(create_table_sql)
        print("✅ Created new traffic_monitoring table")
        
        # Restore data with new schema
        if existing_data:
            insert_sql = """
            INSERT INTO traffic_monitoring (
                id, road_name, road_type, latitude, longitude, barangay,
                traffic_status, average_speed_kmh, vehicle_count, congestion_percentage,
                estimated_travel_time, road_segment_length, data_source, confidence_score,
                last_updated, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            for record in existing_data:
                # Map old record to new schema
                new_record = list(record)
                
                # Ensure we have the right number of fields
                if len(new_record) < 16:
                    # Add missing fields with proper defaults
                    if len(new_record) == 5:  # After longitude
                        new_record.append('Unknown')  # barangay
                    if len(new_record) == 6:  # After barangay
                        new_record.append('free_flow')  # traffic_status (if missing)
                    if len(new_record) == 7:  # After traffic_status
                        new_record.append(None)  # average_speed_kmh
                    if len(new_record) == 8:  # After average_speed_kmh
                        new_record.append(0)  # vehicle_count
                    if len(new_record) == 9:  # After vehicle_count
                        new_record.append(0.0)  # congestion_percentage
                    if len(new_record) == 10:  # After congestion_percentage
                        new_record.append(None)  # estimated_travel_time
                    if len(new_record) == 11:  # After estimated_travel_time
                        new_record.append(None)  # road_segment_length
                    if len(new_record) == 12:  # After road_segment_length
                        new_record.append('tomtom_api')  # data_source
                    if len(new_record) == 13:  # After data_source
                        new_record.append(1.0)  # confidence_score
                    if len(new_record) == 14:  # After confidence_score
                        new_record.append(None)  # last_updated
                    if len(new_record) == 15:  # After last_updated
                        new_record.append(None)  # created_at
                
                # Ensure required fields are not None
                if new_record[9] is None:  # congestion_percentage
                    new_record[9] = 0.0
                if new_record[8] is None:  # vehicle_count
                    new_record[8] = 0
                
                cursor.execute(insert_sql, new_record)
            
            print(f"✅ Restored {len(existing_data)} records")
        
        # Commit changes
        conn.commit()
        
        # Verify the new table
        cursor.execute("PRAGMA table_info(traffic_monitoring)")
        columns = cursor.fetchall()
        
        print(f"\n📋 New table schema:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Test query
        cursor.execute("SELECT COUNT(*) FROM traffic_monitoring")
        count = cursor.fetchone()[0]
        print(f"📊 Total records: {count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error recreating table: {e}")
        return False

def main():
    """Main function"""
    print("🛠️  Traffic Monitoring Table Recreation")
    print("=" * 50)
    
    success = recreate_traffic_table()
    
    if success:
        print("\n✅ Table recreation completed successfully!")
        print("\n📋 Next steps:")
        print("   1. Start the backend server: uvicorn app.main:app --reload")
        print("   2. Test traffic monitoring endpoints")
    else:
        print("\n❌ Table recreation failed!")

if __name__ == "__main__":
    main()
