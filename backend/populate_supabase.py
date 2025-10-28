#!/usr/bin/env python3
"""
Comprehensive script to populate Supabase with all existing data:
- No Parking Zones
- Incident Prone Areas
- Traffic Monitoring Data
- Road Incidents
- Route Alternatives

Run this script after setting up Supabase to populate all tables
"""

import asyncio
import sys
import os
import json
from datetime import datetime, timezone
from typing import List, Dict

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal, engine, Base
from app.models.no_parking_zone import NoParkingZone
from app.models.traffic import (
    IncidentProneArea, 
    IncidentProneAreaType,
    TrafficMonitoring,
    RoadIncident,
    RouteAlternative,
    TrafficStatus,
    RoadType
)
from app.services.incident_scraper_service import incident_scraper_service
from app.services.real_traffic_service import real_traffic_service

class SupabaseDataPopulator:
    """Populates Supabase with all existing data"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.stats = {
            'no_parking_zones': 0,
            'incident_prone_areas': 0,
            'traffic_monitoring': 0,
            'road_incidents': 0,
            'route_alternatives': 0
        }
    
    def create_tables(self):
        """Create all tables if they don't exist"""
        print("📋 Creating database tables...")
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Tables created successfully")
        except Exception as e:
            print(f"⚠️  Warning creating tables: {e}")
    
    def populate_no_parking_zones(self):
        """Populate no parking zones from JSON file"""
        print("\n🚫 Populating No Parking Zones...")
        
        json_file = os.path.join(os.path.dirname(__file__), 'las_pinas_no_parking_zones.json')
        
        if not os.path.exists(json_file):
            print(f"⚠️  No parking zones JSON file not found: {json_file}")
            print("   Generating data from scraper...")
            self._generate_no_parking_zones()
            return
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            zones = data.get('zones', [])
            print(f"   Found {len(zones)} zones in JSON file")
            
            for zone_data in zones:
                try:
                    # Check if zone already exists
                    existing = self.db.query(NoParkingZone).filter(
                        NoParkingZone.name == zone_data['name'],
                        NoParkingZone.latitude == zone_data['latitude'],
                        NoParkingZone.longitude == zone_data['longitude']
                    ).first()
                    
                    if existing:
                        print(f"   ⏭️  Skipping existing zone: {zone_data['name']}")
                        continue
                    
                    # Create new zone
                    zone = NoParkingZone(
                        name=zone_data['name'],
                        description=zone_data.get('description', ''),
                        latitude=zone_data['latitude'],
                        longitude=zone_data['longitude'],
                        zone_type=zone_data.get('zone_type', 'restricted'),
                        restriction_reason=zone_data.get('restriction_reason', 'general'),
                        radius_meters=zone_data.get('radius_meters', 20),
                        is_strict=zone_data.get('is_strict', True),
                        fine_amount=zone_data.get('fine_amount', 1000.0),
                        enforcement_hours=zone_data.get('enforcement_hours', '24/7'),
                        address=zone_data.get('address', 'Las Piñas City')
                    )
                    
                    self.db.add(zone)
                    self.stats['no_parking_zones'] += 1
                    
                except Exception as e:
                    print(f"   ❌ Error adding zone {zone_data.get('name', 'Unknown')}: {e}")
                    continue
            
            self.db.commit()
            print(f"✅ Successfully populated {self.stats['no_parking_zones']} no parking zones")
            
        except Exception as e:
            print(f"❌ Error populating no parking zones: {e}")
            self.db.rollback()
    
    def _generate_no_parking_zones(self):
        """Generate no parking zones from scraper if JSON doesn't exist"""
        try:
            from scrape_no_parking_zones import LasFinasNoParkingZoneScraper
            
            scraper = LasFinasNoParkingZoneScraper()
            data = scraper.scrape_all_no_parking_zones()
            
            zones = data.get('zones', [])
            print(f"   Generated {len(zones)} zones from scraper")
            
            for zone_data in zones:
                try:
                    zone = NoParkingZone(
                        name=zone_data['name'],
                        description=zone_data.get('description', ''),
                        latitude=zone_data['latitude'],
                        longitude=zone_data['longitude'],
                        zone_type=zone_data.get('zone_type', 'restricted'),
                        restriction_reason=zone_data.get('restriction_reason', 'general'),
                        radius_meters=zone_data.get('radius_meters', 20),
                        is_strict=zone_data.get('is_strict', True),
                        fine_amount=zone_data.get('fine_amount', 1000.0),
                        enforcement_hours=zone_data.get('enforcement_hours', '24/7'),
                        address=zone_data.get('address', 'Las Piñas City')
                    )
                    
                    self.db.add(zone)
                    self.stats['no_parking_zones'] += 1
                    
                except Exception as e:
                    print(f"   ❌ Error adding zone: {e}")
                    continue
            
            self.db.commit()
            print(f"✅ Successfully generated and populated {self.stats['no_parking_zones']} no parking zones")
            
        except Exception as e:
            print(f"❌ Error generating no parking zones: {e}")
            self.db.rollback()
    
    async def populate_incident_prone_areas(self):
        """Populate incident prone areas"""
        print("\n⚠️  Populating Incident Prone Areas...")
        
        try:
            # Perform comprehensive scraping
            areas_data = await incident_scraper_service.perform_full_scraping()
            print(f"   Found {len(areas_data)} incident prone areas")
            
            for area_data in areas_data:
                try:
                    # Check if area already exists
                    existing = self.db.query(IncidentProneArea).filter(
                        IncidentProneArea.area_name == area_data['area_name'],
                        IncidentProneArea.area_type == area_data['area_type']
                    ).first()
                    
                    if existing:
                        print(f"   ⏭️  Skipping existing area: {area_data['area_name']}")
                        continue
                    
                    # Create new area
                    area = IncidentProneArea(
                        area_name=area_data['area_name'],
                        area_type=area_data['area_type'],
                        description=area_data.get('description', ''),
                        severity_level=area_data.get('severity_level', 'medium'),
                        latitude=area_data['latitude'],
                        longitude=area_data['longitude'],
                        radius_meters=area_data.get('radius_meters', 500.0),
                        affected_roads=area_data.get('affected_roads', []),
                        barangay=area_data.get('barangay', ''),
                        incident_count=area_data.get('incident_count', 0),
                        last_incident_date=area_data.get('last_incident_date'),
                        peak_hours=area_data.get('peak_hours', []),
                        common_incident_types=area_data.get('common_incident_types', []),
                        risk_score=area_data.get('risk_score', 0.0),
                        prevention_measures=area_data.get('prevention_measures', ''),
                        alternative_routes=area_data.get('alternative_routes', []),
                        data_source=area_data.get('data_source', 'system'),
                        source_url=area_data.get('source_url', ''),
                        last_verified=area_data.get('last_verified', datetime.now(timezone.utc)),
                        is_active=area_data.get('is_active', True),
                        is_verified=area_data.get('is_verified', False)
                    )
                    
                    self.db.add(area)
                    self.stats['incident_prone_areas'] += 1
                    
                except Exception as e:
                    print(f"   ❌ Error adding area {area_data.get('area_name', 'Unknown')}: {e}")
                    continue
            
            self.db.commit()
            print(f"✅ Successfully populated {self.stats['incident_prone_areas']} incident prone areas")
            
        except Exception as e:
            print(f"❌ Error populating incident prone areas: {e}")
            self.db.rollback()
    
    async def populate_traffic_monitoring(self):
        """Populate traffic monitoring data from TomTom API"""
        print("\n🚦 Populating Traffic Monitoring Data...")
        
        try:
            # Fetch real-time traffic data from TomTom
            await real_traffic_service.update_traffic_data(self.db)
            
            # Count the records
            count = self.db.query(TrafficMonitoring).count()
            self.stats['traffic_monitoring'] = count
            
            print(f"✅ Successfully populated {count} traffic monitoring records")
            
        except Exception as e:
            print(f"❌ Error populating traffic monitoring data: {e}")
            self.db.rollback()
    
    def populate_sample_road_incidents(self):
        """Populate sample road incidents"""
        print("\n🚨 Populating Sample Road Incidents...")
        
        sample_incidents = [
            {
                'incident_type': 'road_work',
                'title': 'Road Repair on Alabang-Zapote Road',
                'description': 'Ongoing road repair causing lane closure',
                'severity': 'medium',
                'latitude': 14.4504,
                'longitude': 121.0170,
                'address': 'Alabang-Zapote Road, Las Piñas City',
                'affected_roads': ['Alabang-Zapote Road'],
                'is_active': True,
                'impact_radius_meters': 500.0,
                'reporter_source': 'system'
            },
            {
                'incident_type': 'accident',
                'title': 'Minor Vehicle Collision',
                'description': 'Two-vehicle collision causing traffic slowdown',
                'severity': 'high',
                'latitude': 14.4450,
                'longitude': 121.0280,
                'address': 'BF Homes, Las Piñas City',
                'affected_roads': ['Aguirre Avenue'],
                'is_active': True,
                'impact_radius_meters': 300.0,
                'reporter_source': 'citizen'
            },
            {
                'incident_type': 'flooding',
                'title': 'Flood Warning - Quirino Avenue',
                'description': 'Heavy rainfall causing flooding',
                'severity': 'critical',
                'latitude': 14.4380,
                'longitude': 121.0220,
                'address': 'Quirino Avenue, Las Piñas City',
                'affected_roads': ['Quirino Avenue', 'Diego Cera Street'],
                'is_active': True,
                'impact_radius_meters': 800.0,
                'reporter_source': 'system'
            }
        ]
        
        try:
            for incident_data in sample_incidents:
                try:
                    # Check if similar incident exists
                    existing = self.db.query(RoadIncident).filter(
                        RoadIncident.title == incident_data['title'],
                        RoadIncident.is_active == True
                    ).first()
                    
                    if existing:
                        print(f"   ⏭️  Skipping existing incident: {incident_data['title']}")
                        continue
                    
                    incident = RoadIncident(**incident_data)
                    self.db.add(incident)
                    self.stats['road_incidents'] += 1
                    
                except Exception as e:
                    print(f"   ❌ Error adding incident: {e}")
                    continue
            
            self.db.commit()
            print(f"✅ Successfully populated {self.stats['road_incidents']} road incidents")
            
        except Exception as e:
            print(f"❌ Error populating road incidents: {e}")
            self.db.rollback()
    
    def populate_sample_route_alternatives(self):
        """Populate sample route alternatives"""
        print("\n🗺️  Populating Sample Route Alternatives...")
        
        sample_routes = [
            {
                'origin_lat': 14.4504,
                'origin_lng': 121.0170,
                'destination_lat': 14.4450,
                'destination_lng': 121.0280,
                'route_name': 'Via Alabang-Zapote Road',
                'route_coordinates': [
                    [14.4504, 121.0170],
                    [14.4480, 121.0200],
                    [14.4450, 121.0280]
                ],
                'distance_km': 2.5,
                'estimated_duration_minutes': 8,
                'traffic_conditions': TrafficStatus.MODERATE,
                'is_recommended': True,
                'road_segments': ['Alabang-Zapote Road', 'Aguirre Avenue']
            },
            {
                'origin_lat': 14.4504,
                'origin_lng': 121.0170,
                'destination_lat': 14.4450,
                'destination_lng': 121.0280,
                'route_name': 'Via C-5 Road',
                'route_coordinates': [
                    [14.4504, 121.0170],
                    [14.4500, 121.0300],
                    [14.4450, 121.0280]
                ],
                'distance_km': 3.2,
                'estimated_duration_minutes': 10,
                'traffic_conditions': TrafficStatus.LIGHT,
                'is_recommended': False,
                'road_segments': ['Real Street', 'C-5 Road', 'Aguirre Avenue']
            }
        ]
        
        try:
            for route_data in sample_routes:
                try:
                    # Check if similar route exists
                    existing = self.db.query(RouteAlternative).filter(
                        RouteAlternative.route_name == route_data['route_name'],
                        RouteAlternative.origin_lat == route_data['origin_lat'],
                        RouteAlternative.destination_lat == route_data['destination_lat']
                    ).first()
                    
                    if existing:
                        print(f"   ⏭️  Skipping existing route: {route_data['route_name']}")
                        continue
                    
                    route = RouteAlternative(**route_data)
                    self.db.add(route)
                    self.stats['route_alternatives'] += 1
                    
                except Exception as e:
                    print(f"   ❌ Error adding route: {e}")
                    continue
            
            self.db.commit()
            print(f"✅ Successfully populated {self.stats['route_alternatives']} route alternatives")
            
        except Exception as e:
            print(f"❌ Error populating route alternatives: {e}")
            self.db.rollback()
    
    def print_summary(self):
        """Print population summary"""
        print("\n" + "="*60)
        print("📊 POPULATION SUMMARY")
        print("="*60)
        print(f"🚫 No Parking Zones:        {self.stats['no_parking_zones']}")
        print(f"⚠️  Incident Prone Areas:    {self.stats['incident_prone_areas']}")
        print(f"🚦 Traffic Monitoring:       {self.stats['traffic_monitoring']}")
        print(f"🚨 Road Incidents:           {self.stats['road_incidents']}")
        print(f"🗺️  Route Alternatives:      {self.stats['route_alternatives']}")
        print("="*60)
        total = sum(self.stats.values())
        print(f"✅ Total Records Populated:  {total}")
        print("="*60)
    
    def close(self):
        """Close database connection"""
        self.db.close()

async def main():
    """Main function to run the population script"""
    print("🚀 Supabase Data Population Script")
    print("="*60)
    print("📍 Target: Las Piñas City Traffic Management System")
    print("="*60)
    
    populator = SupabaseDataPopulator()
    
    try:
        # Create tables
        populator.create_tables()
        
        # Populate all data
        populator.populate_no_parking_zones()
        await populator.populate_incident_prone_areas()
        await populator.populate_traffic_monitoring()
        populator.populate_sample_road_incidents()
        populator.populate_sample_route_alternatives()
        
        # Print summary
        populator.print_summary()
        
        print("\n🎉 Data population completed successfully!")
        
    except Exception as e:
        print(f"\n💥 Fatal error during population: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        populator.close()

if __name__ == "__main__":
    asyncio.run(main())
