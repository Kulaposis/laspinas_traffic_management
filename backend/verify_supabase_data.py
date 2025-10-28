#!/usr/bin/env python3
"""
Verification script to check what data exists in Supabase
"""

import sys
import os
from datetime import datetime

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models.no_parking_zone import NoParkingZone
from app.models.traffic import (
    IncidentProneArea,
    TrafficMonitoring,
    RoadIncident,
    RouteAlternative
)

def verify_data():
    """Verify all data in Supabase"""
    print("🔍 Verifying Supabase Data")
    print("="*60)
    
    db = SessionLocal()
    
    try:
        # Check No Parking Zones
        print("\n🚫 No Parking Zones:")
        no_parking_count = db.query(NoParkingZone).count()
        print(f"   Total: {no_parking_count}")
        
        if no_parking_count > 0:
            sample = db.query(NoParkingZone).limit(3).all()
            print("   Sample records:")
            for zone in sample:
                print(f"   - {zone.name} ({zone.zone_type})")
        
        # Check Incident Prone Areas
        print("\n⚠️  Incident Prone Areas:")
        incident_count = db.query(IncidentProneArea).count()
        print(f"   Total: {incident_count}")
        
        if incident_count > 0:
            sample = db.query(IncidentProneArea).limit(3).all()
            print("   Sample records:")
            for area in sample:
                print(f"   - {area.area_name} ({area.area_type.value if hasattr(area.area_type, 'value') else area.area_type})")
        
        # Check Traffic Monitoring
        print("\n🚦 Traffic Monitoring:")
        traffic_count = db.query(TrafficMonitoring).count()
        print(f"   Total: {traffic_count}")
        
        if traffic_count > 0:
            sample = db.query(TrafficMonitoring).limit(3).all()
            print("   Sample records:")
            for traffic in sample:
                print(f"   - {traffic.road_name} ({traffic.traffic_status.value if hasattr(traffic.traffic_status, 'value') else traffic.traffic_status})")
        
        # Check Road Incidents
        print("\n🚨 Road Incidents:")
        incident_count = db.query(RoadIncident).count()
        print(f"   Total: {incident_count}")
        
        if incident_count > 0:
            sample = db.query(RoadIncident).filter(RoadIncident.is_active == True).limit(3).all()
            print("   Active incidents:")
            for incident in sample:
                print(f"   - {incident.title} ({incident.severity})")
        
        # Check Route Alternatives
        print("\n🗺️  Route Alternatives:")
        route_count = db.query(RouteAlternative).count()
        print(f"   Total: {route_count}")
        
        if route_count > 0:
            sample = db.query(RouteAlternative).limit(3).all()
            print("   Sample routes:")
            for route in sample:
                print(f"   - {route.route_name} ({route.distance_km}km, {route.estimated_duration_minutes}min)")
        
        # Summary
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        total = no_parking_count + incident_count + traffic_count + incident_count + route_count
        print(f"✅ Total Records: {total}")
        print("="*60)
        
        if total == 0:
            print("\n⚠️  No data found! Run populate_supabase.py to populate the database.")
        else:
            print("\n✅ Database contains data!")
        
    except Exception as e:
        print(f"\n❌ Error verifying data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify_data()
