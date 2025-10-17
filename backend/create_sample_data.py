#!/usr/bin/env python3
"""
Create sample data for the traffic management system
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.db import SessionLocal, engine
from app.models import *
from datetime import datetime, timedelta
import random

def create_sample_traffic_data():
    db = SessionLocal()
    try:
        # Las Piñas City major roads and intersections
        traffic_points = [
            # Alabang-Zapote Road
            {"road_name": "Alabang-Zapote Road (near Festival Mall)", "latitude": 14.4194, "longitude": 121.0433, "road_type": "main_road"},
            {"road_name": "Alabang-Zapote Road (near Southmall)", "latitude": 14.4589, "longitude": 121.0367, "road_type": "main_road"},
            {"road_name": "Alabang-Zapote Road (Pulang Lupa)", "latitude": 14.4756, "longitude": 121.0289, "road_type": "main_road"},
            
            # Marcos Alvarez Avenue
            {"road_name": "Marcos Alvarez Avenue (Talon)", "latitude": 14.4983, "longitude": 121.0067, "road_type": "main_road"},
            {"road_name": "Marcos Alvarez Avenue (near City Hall)", "latitude": 14.4547, "longitude": 121.0178, "road_type": "main_road"},
            
            # CAA Road
            {"road_name": "CAA Road (near Robinsons)", "latitude": 14.4478, "longitude": 121.0311, "road_type": "main_road"},
            {"road_name": "CAA Road (Pilar Village)", "latitude": 14.4333, "longitude": 121.0378, "road_type": "residential"},
            
            # Real Street
            {"road_name": "Real Street (Pamplona)", "latitude": 14.4667, "longitude": 121.0456, "road_type": "side_street"},
            {"road_name": "Real Street (near Public Market)", "latitude": 14.4578, "longitude": 121.0489, "road_type": "side_street"},
            
            # Daang Hari Road
            {"road_name": "Daang Hari Road (Almanza)", "latitude": 14.4122, "longitude": 121.0256, "road_type": "highway"},
            {"road_name": "Daang Hari Road (BF Homes)", "latitude": 14.4344, "longitude": 121.0089, "road_type": "highway"},
            
            # CAVITEX
            {"road_name": "CAVITEX (Las Piñas Exit)", "latitude": 14.4456, "longitude": 121.0022, "road_type": "highway"},
            
            # Local streets
            {"road_name": "Elias Aldana Street", "latitude": 14.4611, "longitude": 121.0244, "road_type": "residential"},
            {"road_name": "Bamboo Street (Moonwalk)", "latitude": 14.4389, "longitude": 121.0556, "road_type": "residential"},
            {"road_name": "Admiral Street (BF Homes)", "latitude": 14.4278, "longitude": 121.0111, "road_type": "residential"},
        ]
        
        # Create traffic monitoring entries
        for point in traffic_points:
            # Generate realistic traffic conditions based on time and road type
            now = datetime.utcnow()
            hour = now.hour
            
            # Simulate rush hour traffic (7-9 AM, 5-7 PM Philippine time = 23-1, 9-11 UTC)
            if hour in [23, 0, 1, 9, 10, 11]:  # Rush hours
                if point["road_type"] == "highway":
                    traffic_status = random.choice(["moderate", "heavy", "heavy"])
                    congestion = random.randint(60, 90)
                    speed = random.randint(15, 30)
                elif point["road_type"] == "main_road":
                    traffic_status = random.choice(["light", "moderate", "heavy"])
                    congestion = random.randint(40, 75)
                    speed = random.randint(20, 40)
                else:
                    traffic_status = random.choice(["free_flow", "light", "moderate"])
                    congestion = random.randint(20, 50)
                    speed = random.randint(25, 45)
            else:  # Off-peak hours
                if point["road_type"] == "highway":
                    traffic_status = random.choice(["free_flow", "light"])
                    congestion = random.randint(10, 35)
                    speed = random.randint(50, 80)
                elif point["road_type"] == "main_road":
                    traffic_status = random.choice(["free_flow", "light"])
                    congestion = random.randint(15, 40)
                    speed = random.randint(35, 60)
                else:
                    traffic_status = "free_flow"
                    congestion = random.randint(5, 25)
                    speed = random.randint(30, 50)
            
            # Check if entry already exists
            existing = db.query(TrafficMonitoring).filter(
                TrafficMonitoring.road_name == point["road_name"]
            ).first()
            
            if existing:
                # Update existing entry
                existing.traffic_status = traffic_status
                existing.average_speed_kmh = speed
                existing.vehicle_count = random.randint(5, 50)
                existing.congestion_percentage = congestion
                existing.estimated_travel_time = random.randint(2, 15)
                existing.last_updated = now
            else:
                # Create new entry
                traffic = TrafficMonitoring(
                    road_name=point["road_name"],
                    road_type=point["road_type"],
                    latitude=point["latitude"],
                    longitude=point["longitude"],
                    traffic_status=traffic_status,
                    average_speed_kmh=speed,
                    vehicle_count=random.randint(5, 50),
                    congestion_percentage=congestion,
                    estimated_travel_time=random.randint(2, 15),
                    road_segment_length=random.uniform(0.5, 3.0)
                )
                db.add(traffic)
        
        # Create some road incidents
        incidents = [
            {
                "incident_type": "accident",
                "title": "Minor Vehicle Collision",
                "description": "Two-vehicle minor collision, one lane blocked",
                "severity": "medium",
                "latitude": 14.4194,
                "longitude": 121.0433,
                "address": "Alabang-Zapote Road near Festival Mall",
                "reporter_source": "traffic_enforcer_1"
            },
            {
                "incident_type": "road_work",
                "title": "Road Maintenance",
                "description": "Scheduled road repair, expect delays",
                "severity": "low",
                "latitude": 14.4547,
                "longitude": 121.0178,
                "address": "Marcos Alvarez Avenue near City Hall",
                "reporter_source": "system"
            },
            {
                "incident_type": "flooding",
                "title": "Minor Flooding",
                "description": "Water accumulation after rain, passable with caution",
                "severity": "medium",
                "latitude": 14.4389,
                "longitude": 121.0556,
                "address": "Bamboo Street, Moonwalk Subdivision",
                "reporter_source": "citizen_report"
            }
        ]
        
        for incident_data in incidents:
            existing_incident = db.query(RoadIncident).filter(
                RoadIncident.title == incident_data["title"]
            ).first()
            
            if not existing_incident:
                incident = RoadIncident(**incident_data)
                db.add(incident)
        
        db.commit()
        print("✅ Sample traffic data created successfully!")
        print(f"📊 Created {len(traffic_points)} traffic monitoring points")
        print(f"🚨 Created {len(incidents)} road incidents")
        
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        db.rollback()
    finally:
        db.close()

def create_sample_weather_data():
    db = SessionLocal()
    try:
        # Las Piñas weather stations
        weather_stations = [
            {"area_name": "Las Piñas City Center", "latitude": 14.4504, "longitude": 121.0170},
            {"area_name": "BF Homes Las Piñas", "latitude": 14.4278, "longitude": 121.0111},
            {"area_name": "Moonwalk Subdivision", "latitude": 14.4389, "longitude": 121.0556},
            {"area_name": "Talon Las Piñas", "latitude": 14.4983, "longitude": 121.0067},
            {"area_name": "Almanza Las Piñas", "latitude": 14.4122, "longitude": 121.0256},
        ]
        
        for station in weather_stations:
            # Generate realistic weather data for Metro Manila
            temp = random.uniform(24, 35)  # Typical Manila temperature
            humidity = random.uniform(60, 90)  # High humidity
            wind_speed = random.uniform(5, 25)
            rainfall = random.uniform(0, 5) if random.random() < 0.3 else 0  # 30% chance of rain
            
            weather_condition = "clear"
            if rainfall > 2:
                weather_condition = "heavy_rain"
            elif rainfall > 0.5:
                weather_condition = "light_rain"
            elif humidity > 85:
                weather_condition = "cloudy"
            elif temp > 32:
                weather_condition = "clear"
            
            # Check if data already exists for this area
            existing = db.query(WeatherData).filter(
                WeatherData.area_name == station["area_name"]
            ).order_by(WeatherData.recorded_at.desc()).first()
            
            # Only create if no recent data (within last hour)
            if not existing or (datetime.utcnow() - existing.recorded_at).seconds > 3600:
                weather = WeatherData(
                    area_name=station["area_name"],
                    latitude=station["latitude"],
                    longitude=station["longitude"],
                    temperature_celsius=temp,
                    humidity_percent=humidity,
                    wind_speed_kmh=wind_speed,
                    wind_direction=random.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
                    rainfall_mm=rainfall,
                    weather_condition=weather_condition,
                    visibility_km=random.uniform(5, 15),
                    pressure_hpa=random.uniform(1005, 1020)
                )
                db.add(weather)
        
        # Create weather alert if conditions warrant
        if any(s for s in weather_stations if rainfall > 3):
            alert = WeatherAlert(
                alert_type="rain",
                title="Heavy Rain Advisory",
                message="Heavy rainfall expected in some areas. Exercise caution while driving.",
                severity="watch",
                affected_areas='["Las Piñas City"]',
                latitude=14.4504,
                longitude=121.0170,
                radius_km=10.0,
                traffic_impact="Possible flooding in low-lying areas. Reduced visibility and slower traffic expected."
            )
            db.add(alert)
        
        db.commit()
        print("✅ Sample weather data created successfully!")
        
    except Exception as e:
        print(f"❌ Error creating weather data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Creating sample data for Las Piñas Traffic Management System...")
    
    # Create all database tables
    Base.metadata.create_all(bind=engine)
    print("📋 Database tables ready")
    
    # Create sample data
    create_sample_traffic_data()
    create_sample_weather_data()
    
    print("\n🎉 Sample data creation complete!")
    print("\nYou can now:")
    print("1. View real-time traffic data in the Traffic Monitor")
    print("2. See weather conditions in Weather & Flood monitoring")
    print("3. Check road incidents on the map")
    print("4. Test the emergency reporting system")
