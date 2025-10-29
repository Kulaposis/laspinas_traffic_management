#!/usr/bin/env python3
"""
Migrate existing traffic data enum values from lowercase to UPPERCASE
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found")
        return
    
    engine = create_engine(database_url)
    
    with engine.begin() as conn:
        print("=" * 80)
        print("Migrating traffic enum values to UPPERCASE...")
        print("=" * 80)
        
        # Check current data
        result = conn.execute(text("""
            SELECT COUNT(*) as total_records
            FROM traffic_monitoring
        """))
        total = result.fetchone()[0]
        print(f"\nTotal traffic records: {total}")
        
        if total == 0:
            print("No traffic data to migrate.")
            return
        
        # Update road_type values
        print("\nUpdating road_type values...")
        result = conn.execute(text("""
            UPDATE traffic_monitoring
            SET road_type = UPPER(road_type::text)::roadtype
            WHERE road_type::text IN ('highway', 'main_road', 'side_street', 'residential', 'bridge')
        """))
        updated_road_types = result.rowcount
        print(f"Updated {updated_road_types} road_type records")
        
        # Update traffic_status values
        print("\nUpdating traffic_status values...")
        result = conn.execute(text("""
            UPDATE traffic_monitoring
            SET traffic_status = UPPER(traffic_status::text)::trafficstatus
            WHERE traffic_status::text IN ('free_flow', 'light', 'moderate', 'heavy', 'standstill')
        """))
        updated_statuses = result.rowcount
        print(f"Updated {updated_statuses} traffic_status records")
        
        # Verify the changes
        print("\n" + "=" * 80)
        print("Verifying changes...")
        print("=" * 80)
        
        result = conn.execute(text("""
            SELECT 
                road_type,
                COUNT(*) as count
            FROM traffic_monitoring
            GROUP BY road_type
            ORDER BY road_type
        """))
        
        print("\nRoad Type Distribution:")
        for row in result:
            print(f"  {row[0]}: {row[1]} records")
        
        result = conn.execute(text("""
            SELECT 
                traffic_status,
                COUNT(*) as count
            FROM traffic_monitoring
            GROUP BY traffic_status
            ORDER BY traffic_status
        """))
        
        print("\nTraffic Status Distribution:")
        for row in result:
            print(f"  {row[0]}: {row[1]} records")
        
        print("\n" + "=" * 80)
        print("✓ Migration completed successfully!")
        print("=" * 80)

if __name__ == "__main__":
    main()
