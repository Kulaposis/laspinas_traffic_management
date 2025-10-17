#!/usr/bin/env python3
"""
Script to populate sample traffic data for testing the real-time heatmap feature.
Run this script to add initial traffic monitoring data to the database.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models.traffic import TrafficMonitoring, TrafficStatus, RoadType
import random

def create_sample_traffic_data():
    """Create sample traffic monitoring data for Las Piñas City."""
    db = SessionLocal()
    
    try:
        # Sample roads in Las Piñas City
        sample_roads = [
            {"name": "Alabang-Zapote Road", "lat": 14.4504, "lng": 121.0170, "type": RoadType.HIGHWAY},
            {"name": "Westservice Road", "lat": 14.4400, "lng": 121.0200, "type": RoadType.HIGHWAY},
            {"name": "C-5 Road Extension", "lat": 14.4600, "lng": 121.0150, "type": RoadType.HIGHWAY},
            {"name": "Almanza Road", "lat": 14.4350, "lng": 121.0100, "type": RoadType.MAIN_ROAD},
            {"name": "CAA Road", "lat": 14.4450, "lng": 121.0250, "type": RoadType.MAIN_ROAD},
            {"name": "Real Street", "lat": 14.4550, "lng": 121.0180, "type": RoadType.SIDE_STREET},
            {"name": "Niog Road", "lat": 14.4380, "lng": 121.0220, "type": RoadType.SIDE_STREET},
            {"name": "Talon Road", "lat": 14.4520, "lng": 121.0130, "type": RoadType.RESIDENTIAL},
            {"name": "Pamplona Road", "lat": 14.4470, "lng": 121.0280, "type": RoadType.RESIDENTIAL},
            {"name": "BF Almanza Bridge", "lat": 14.4320, "lng": 121.0080, "type": RoadType.BRIDGE}
        ]
        
        # Clear existing data
        db.query(TrafficMonitoring).delete()
        
        # Create traffic monitoring entries
        for road in sample_roads:
            # Generate random traffic data
            traffic_statuses = [
                TrafficStatus.FREE_FLOW,
                TrafficStatus.LIGHT,
                TrafficStatus.MODERATE,
                TrafficStatus.HEAVY,
                TrafficStatus.STANDSTILL
            ]
            
            status = random.choice(traffic_statuses)
            
            # Generate realistic data based on status
            if status == TrafficStatus.FREE_FLOW:
                congestion = random.uniform(0, 20)
                speed = random.randint(40, 60)
                vehicle_count = random.randint(5, 15)
            elif status == TrafficStatus.LIGHT:
                congestion = random.uniform(20, 40)
                speed = random.randint(25, 40)
                vehicle_count = random.randint(15, 30)
            elif status == TrafficStatus.MODERATE:
                congestion = random.uniform(40, 60)
                speed = random.randint(15, 25)
                vehicle_count = random.randint(30, 50)
            elif status == TrafficStatus.HEAVY:
                congestion = random.uniform(60, 80)
                speed = random.randint(5, 15)
                vehicle_count = random.randint(50, 80)
            else:  # STANDSTILL
                congestion = random.uniform(80, 100)
                speed = random.randint(0, 5)
                vehicle_count = random.randint(80, 120)
            
            traffic_entry = TrafficMonitoring(
                road_name=road["name"],
                road_type=road["type"],
                latitude=road["lat"] + random.uniform(-0.001, 0.001),  # Slight variation
                longitude=road["lng"] + random.uniform(-0.001, 0.001),
                traffic_status=status,
                average_speed_kmh=speed,
                vehicle_count=vehicle_count,
                congestion_percentage=congestion,
                estimated_travel_time=random.randint(2, 15),
                road_segment_length=random.uniform(0.5, 3.0)
            )
            
            db.add(traffic_entry)
        
        db.commit()
        print(f"Successfully created {len(sample_roads)} traffic monitoring entries!")
        
        # Print summary
        print("\n--- Traffic Data Summary ---")
        for status in TrafficStatus:
            count = db.query(TrafficMonitoring).filter(TrafficMonitoring.traffic_status == status).count()
            print(f"{status.value}: {count} roads")
            
    except Exception as e:
        print(f"Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Creating sample traffic data...")
    create_sample_traffic_data()
    print("Done!")
