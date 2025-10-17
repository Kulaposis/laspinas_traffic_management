#!/usr/bin/env python3

from backend.app.db import SessionLocal
from backend.app.models.traffic import TrafficMonitoring, RoadIncident, TrafficStatus, RoadType
from datetime import datetime, timezone
import random

def create_sample_data():
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(TrafficMonitoring).delete()
        db.query(RoadIncident).filter(RoadIncident.reporter_source == 'sample_data').delete()
        
        # Sample traffic monitoring points
        traffic_points = [
            {
                'road_name': 'Alabang-Zapote Road',
                'road_type': RoadType.MAIN_ROAD,
                'latitude': 14.4504,
                'longitude': 121.017,
                'traffic_status': TrafficStatus.HEAVY,
                'average_speed_kmh': 15.5,
                'vehicle_count': 120,
                'congestion_percentage': 85.0
            },
            {
                'road_name': 'C-5 Road',
                'road_type': RoadType.HIGHWAY,
                'latitude': 14.45,
                'longitude': 121.03,
                'traffic_status': TrafficStatus.MODERATE,
                'average_speed_kmh': 25.0,
                'vehicle_count': 95,
                'congestion_percentage': 60.0
            },
            {
                'road_name': 'Quirino Avenue',
                'road_type': RoadType.MAIN_ROAD,
                'latitude': 14.438,
                'longitude': 121.022,
                'traffic_status': TrafficStatus.LIGHT,
                'average_speed_kmh': 35.0,
                'vehicle_count': 45,
                'congestion_percentage': 30.0
            },
            {
                'road_name': 'Naga Road',
                'road_type': RoadType.SIDE_STREET,
                'latitude': 14.432,
                'longitude': 121.019,
                'traffic_status': TrafficStatus.FREE_FLOW,
                'average_speed_kmh': 45.0,
                'vehicle_count': 25,
                'congestion_percentage': 15.0
            },
            {
                'road_name': 'CAA Road',
                'road_type': RoadType.SIDE_STREET,
                'latitude': 14.436,
                'longitude': 121.021,
                'traffic_status': TrafficStatus.LIGHT,
                'average_speed_kmh': 30.0,
                'vehicle_count': 35,
                'congestion_percentage': 25.0
            },
            {
                'road_name': 'Real Street',
                'road_type': RoadType.RESIDENTIAL,
                'latitude': 14.442,
                'longitude': 121.018,
                'traffic_status': TrafficStatus.FREE_FLOW,
                'average_speed_kmh': 40.0,
                'vehicle_count': 20,
                'congestion_percentage': 10.0
            },
            {
                'road_name': 'Sucat Road',
                'road_type': RoadType.MAIN_ROAD,
                'latitude': 14.448,
                'longitude': 121.025,
                'traffic_status': TrafficStatus.MODERATE,
                'average_speed_kmh': 22.0,
                'vehicle_count': 75,
                'congestion_percentage': 55.0
            },
            {
                'road_name': 'Talon Road',
                'road_type': RoadType.SIDE_STREET,
                'latitude': 14.435,
                'longitude': 121.025,
                'traffic_status': TrafficStatus.LIGHT,
                'average_speed_kmh': 28.0,
                'vehicle_count': 40,
                'congestion_percentage': 35.0
            },
            {
                'road_name': 'BF Homes Boulevard',
                'road_type': RoadType.RESIDENTIAL,
                'latitude': 14.445,
                'longitude': 121.028,
                'traffic_status': TrafficStatus.HEAVY,
                'average_speed_kmh': 12.0,
                'vehicle_count': 85,
                'congestion_percentage': 80.0
            },
            {
                'road_name': 'Alabang-Zapote Bridge',
                'road_type': RoadType.BRIDGE,
                'latitude': 14.452,
                'longitude': 121.0185,
                'traffic_status': TrafficStatus.STANDSTILL,
                'average_speed_kmh': 5.0,
                'vehicle_count': 150,
                'congestion_percentage': 95.0
            }
        ]
        
        # Create traffic monitoring entries
        for point in traffic_points:
            traffic = TrafficMonitoring(**point)
            db.add(traffic)
        
        # Sample road incidents
        sample_incidents = [
            {
                'incident_type': 'accident',
                'title': 'Multi-vehicle collision on Alabang-Zapote Bridge',
                'description': 'Three-car collision blocking two lanes',
                'severity': 'high',
                'latitude': 14.452,
                'longitude': 121.0185,
                'reporter_source': 'sample_data',
                'is_active': True,
                'impact_radius_meters': 800.0
            },
            {
                'incident_type': 'road_work',
                'title': 'Ongoing road repairs on C-5 Road',
                'description': 'Lane closure for pothole repairs',
                'severity': 'medium',
                'latitude': 14.45,
                'longitude': 121.03,
                'reporter_source': 'sample_data',
                'is_active': True,
                'impact_radius_meters': 500.0
            },
            {
                'incident_type': 'flooding',
                'title': 'Flood-related traffic delays on Quirino Avenue',
                'description': 'Heavy rain causing flooding and slow traffic',
                'severity': 'medium',
                'latitude': 14.438,
                'longitude': 121.022,
                'reporter_source': 'sample_data',
                'is_active': True,
                'impact_radius_meters': 1000.0
            },
            {
                'incident_type': 'vehicle_breakdown',
                'title': 'Stalled vehicle on BF Homes Boulevard',
                'description': 'Broken down truck blocking right lane',
                'severity': 'low',
                'latitude': 14.445,
                'longitude': 121.028,
                'reporter_source': 'sample_data',
                'is_active': True,
                'impact_radius_meters': 300.0
            },
            {
                'incident_type': 'event',
                'title': 'Special event near Las Piñas City Hall',
                'description': 'Community event causing temporary road closures',
                'severity': 'low',
                'latitude': 14.4504,
                'longitude': 121.017,
                'reporter_source': 'sample_data',
                'is_active': True,
                'impact_radius_meters': 400.0
            }
        ]
        
        # Create incident entries
        for incident_data in sample_incidents:
            incident = RoadIncident(**incident_data)
            db.add(incident)
        
        db.commit()
        print(f"Created {len(traffic_points)} traffic monitoring points and {len(sample_incidents)} road incidents")
        
    except Exception as e:
        print(f"Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_sample_data()
