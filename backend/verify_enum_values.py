#!/usr/bin/env python3
"""
Verify that Python enum values match Supabase enum values
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Expected enum values from Python code
PYTHON_ENUMS = {
    'userrole': ['citizen', 'lgu_staff', 'traffic_enforcer', 'admin'],
    'weathercondition': ['clear', 'partly_cloudy', 'cloudy', 'light_rain', 'moderate_rain', 'heavy_rain', 'thunderstorm', 'fog'],
    'floodlevel': ['normal', 'low', 'moderate', 'high', 'critical'],
    'violationtype': ['speeding', 'illegal_parking', 'running_red_light', 'no_seatbelt', 'drunk_driving', 'reckless_driving', 'expired_license', 'no_helmet', 'other'],
    'violationstatus': ['issued', 'paid', 'contested', 'dismissed'],
}

def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found")
        return
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Get all enum types
        result = conn.execute(text("""
            SELECT t.typname as enum_name,
                   array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
            FROM pg_type t 
            JOIN pg_enum e ON t.oid = e.enumtypid  
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            GROUP BY t.typname
            ORDER BY t.typname;
        """))
        
        print("Comparing Python enums with Supabase enums:")
        print("=" * 80)
        
        mismatches = []
        for row in result:
            enum_name = row[0]
            db_values = row[1]
            
            if enum_name in PYTHON_ENUMS:
                python_values = PYTHON_ENUMS[enum_name]
                
                # Check if values match (case-insensitive)
                db_values_lower = [v.lower() for v in db_values]
                python_values_lower = [v.lower() for v in python_values]
                
                if set(db_values_lower) != set(python_values_lower):
                    mismatches.append(enum_name)
                    print(f"\nMISMATCH: {enum_name}")
                    print(f"  Database: {db_values}")
                    print(f"  Python:   {python_values}")
                else:
                    # Check case
                    if db_values != python_values:
                        print(f"\nCASE DIFFERENCE: {enum_name}")
                        print(f"  Database: {db_values}")
                        print(f"  Python:   {python_values}")
                    else:
                        print(f"\nOK: {enum_name}")
        
        print("\n" + "=" * 80)
        if mismatches:
            print(f"Found {len(mismatches)} mismatches")
        else:
            print("All checked enums match!")

if __name__ == "__main__":
    main()
