#!/usr/bin/env python3
"""
Seed script for incident prone areas in Las Piñas City
Run this script to populate the database with initial incident prone areas data
"""

import asyncio
import sys
import os

# Add the parent directory to the path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app.services.incident_scraper_service import incident_scraper_service
from datetime import datetime, timezone

async def seed_incident_prone_areas():
    """Seed the database with incident prone areas data"""
    print("🌱 Starting incident prone areas seeding...")
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Perform comprehensive scraping
        print("📡 Scraping incident prone areas data...")
        areas_data = await incident_scraper_service.perform_full_scraping()
        
        print(f"📊 Found {len(areas_data)} incident prone areas")
        
        # Save to database
        print("💾 Saving data to database...")
        await incident_scraper_service.save_to_database(areas_data, db)
        
        print("✅ Successfully seeded incident prone areas!")
        
        # Print summary
        print("\n📈 Seeding Summary:")
        print(f"   Total areas seeded: {len(areas_data)}")
        
        # Count by type
        type_counts = {}
        for area in areas_data:
            area_type = area['area_type']
            if hasattr(area_type, 'value'):
                type_key = area_type.value
            else:
                type_key = str(area_type)
            type_counts[type_key] = type_counts.get(type_key, 0) + 1
        
        for area_type, count in type_counts.items():
            print(f"   {area_type.replace('_', ' ').title()}: {count}")
        
        # Count by severity
        severity_counts = {}
        for area in areas_data:
            severity = area['severity_level']
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        print("\n🚨 By Severity Level:")
        for severity, count in severity_counts.items():
            print(f"   {severity.title()}: {count}")
        
        # High risk areas
        high_risk_count = sum(1 for area in areas_data if area['risk_score'] > 70)
        print(f"\n⚠️  High Risk Areas (>70 risk score): {high_risk_count}")
        
    except Exception as e:
        print(f"❌ Error seeding incident prone areas: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def main():
    """Main function to run the seeding script"""
    print("🚀 Las Piñas City Incident Prone Areas Seeder")
    print("=" * 50)
    
    try:
        asyncio.run(seed_incident_prone_areas())
        print("\n🎉 Seeding completed successfully!")
    except Exception as e:
        print(f"\n💥 Seeding failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
