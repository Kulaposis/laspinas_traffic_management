#!/usr/bin/env python3
"""
Script to add barangay, data_source, and confidence_score fields to traffic_monitoring table
"""

import sqlite3
import os
from pathlib import Path

def add_traffic_fields():
    """Add missing fields to traffic_monitoring table"""
    try:
        # Get database path
        db_path = Path(__file__).parent / "traffic_management.db"
        
        print(f"🔄 Adding fields to traffic_monitoring table in {db_path}")
        
        # Connect to database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if fields already exist
        cursor.execute("PRAGMA table_info(traffic_monitoring)")
        columns = [row[1] for row in cursor.fetchall()]
        
        fields_to_add = [
            ("barangay", "TEXT NOT NULL DEFAULT 'Unknown'"),
            ("data_source", "TEXT NOT NULL DEFAULT 'tomtom_api'"),
            ("confidence_score", "REAL NOT NULL DEFAULT 1.0")
        ]
        
        for field_name, field_type in fields_to_add:
            if field_name not in columns:
                print(f"  ➕ Adding {field_name} field...")
                cursor.execute(f"ALTER TABLE traffic_monitoring ADD COLUMN {field_name} {field_type}")
            else:
                print(f"  ✅ {field_name} field already exists")
        
        # Commit changes
        conn.commit()
        
        # Verify the changes
        cursor.execute("PRAGMA table_info(traffic_monitoring)")
        new_columns = [row[1] for row in cursor.fetchall()]
        
        print(f"\n✅ Successfully updated traffic_monitoring table!")
        print(f"📋 Current columns: {new_columns}")
        
        # Update existing records with default barangay values
        print(f"\n🔄 Updating existing records with default barangay values...")
        
        # Get all existing records
        cursor.execute("SELECT id, road_name FROM traffic_monitoring WHERE barangay = 'Unknown' OR barangay IS NULL")
        records = cursor.fetchall()
        
        # Default barangay assignments based on road names
        barangay_mapping = {
            "Alabang-Zapote": "Almanza Uno",
            "Westservice": "Zapote", 
            "C-5": "Daniel Fajardo",
            "Almanza": "Almanza Uno",
            "CAA": "CAA",
            "Real": "Elias Aldana",
            "Niog": "Ilaya",
            "Talon": "Talon Uno",
            "Pamplona": "Pamplona Uno",
            "BF": "B.F. International Village"
        }
        
        updated_count = 0
        for record_id, road_name in records:
            # Try to match road name to barangay
            barangay = "Almanza Uno"  # Default
            for key, value in barangay_mapping.items():
                if key.lower() in road_name.lower():
                    barangay = value
                    break
            
            cursor.execute(
                "UPDATE traffic_monitoring SET barangay = ? WHERE id = ?",
                (barangay, record_id)
            )
            updated_count += 1
        
        conn.commit()
        print(f"✅ Updated {updated_count} existing records with barangay assignments")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error adding fields: {e}")
        return False

def main():
    """Main function"""
    print("🛠️  Traffic Monitoring Database Update")
    print("=" * 50)
    
    success = add_traffic_fields()
    
    if success:
        print("\n🎉 Database update completed successfully!")
        print("\n📋 Next steps:")
        print("   1. Start the backend server: uvicorn app.main:app --reload")
        print("   2. Test traffic monitoring endpoints")
        print("   3. Verify barangay filtering works")
    else:
        print("\n❌ Database update failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
