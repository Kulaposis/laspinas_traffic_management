"""
Script to populate parking areas in Las Piñas City
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models.parking import Parking, ParkingType, ParkingStatus
from datetime import datetime

def init_parking_areas():
    """Initialize parking areas for Las Piñas City"""
    db = SessionLocal()
    
    # Check if parking areas already exist
    existing_count = db.query(Parking).count()
    if existing_count > 0:
        print(f"Parking areas already exist ({existing_count} records). Skipping initialization.")
        db.close()
        return
    
    parking_areas = [
        # Shopping Centers & Malls
        {
            "name": "SM Southmall Parking",
            "description": "Multi-level parking facility at SM Southmall",
            "latitude": 14.4504,
            "longitude": 121.0170,
            "total_spaces": 1500,
            "available_spaces": 1200,
            "parking_type": ParkingType.GARAGE,
            "hourly_rate": 40.00,
            "status": ParkingStatus.AVAILABLE,
            "is_monitored": True,
            "operating_hours_start": "00:00",
            "operating_hours_end": "23:59",
            "address": "Alabang-Zapote Road, Las Piñas City"
        },
        {
            "name": "Robinsons Place Las Piñas Parking",
            "description": "Covered parking at Robinsons Place",
            "latitude": 14.4350,
            "longitude": 121.0100,
            "total_slots": 800,
            "available_slots": 650,
            "parking_type": "paid",
            "hourly_rate": 40.00,
            "is_covered": True,
            "has_security": True,
            "operating_hours": "10:00 AM - 10:00 PM",
            "address": "Marcos Alvarez Avenue, Las Piñas City"
        },
        {
            "name": "Vista Mall Las Piñas Parking",
            "description": "Open and covered parking at Vista Mall",
            "latitude": 14.4420,
            "longitude": 121.0120,
            "total_slots": 600,
            "available_slots": 480,
            "parking_type": "paid",
            "hourly_rate": 35.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "10:00 AM - 9:00 PM",
            "address": "Alabang-Zapote Road, Las Piñas City"
        },
        
        # Government Buildings
        {
            "name": "Las Piñas City Hall Parking",
            "description": "Public parking at City Hall",
            "latitude": 14.4450,
            "longitude": 121.0250,
            "total_slots": 200,
            "available_slots": 150,
            "parking_type": "free",
            "hourly_rate": 0.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "8:00 AM - 5:00 PM",
            "address": "Daniel Fajardo Street, Las Piñas City"
        },
        {
            "name": "Las Piñas Sports Complex Parking",
            "description": "Parking area for sports complex visitors",
            "latitude": 14.4380,
            "longitude": 121.0180,
            "total_slots": 300,
            "available_slots": 250,
            "parking_type": "free",
            "hourly_rate": 0.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "6:00 AM - 9:00 PM",
            "address": "CAA Road, Las Piñas City"
        },
        
        # Churches
        {
            "name": "Las Piñas Bamboo Organ Church Parking",
            "description": "Parking for church visitors",
            "latitude": 14.4550,
            "longitude": 121.0180,
            "total_slots": 100,
            "available_slots": 80,
            "parking_type": "free",
            "hourly_rate": 0.00,
            "is_covered": False,
            "has_security": False,
            "operating_hours": "6:00 AM - 7:00 PM",
            "address": "Real Street, Las Piñas City"
        },
        
        # Markets
        {
            "name": "Las Piñas Public Market Parking",
            "description": "Public parking near the market",
            "latitude": 14.4600,
            "longitude": 121.0150,
            "total_slots": 150,
            "available_slots": 100,
            "parking_type": "paid",
            "hourly_rate": 20.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "5:00 AM - 8:00 PM",
            "address": "Daniel Fajardo Road, Las Piñas City"
        },
        
        # Hospitals
        {
            "name": "Las Piñas Doctors Hospital Parking",
            "description": "Hospital parking for patients and visitors",
            "latitude": 14.4480,
            "longitude": 121.0150,
            "total_slots": 250,
            "available_slots": 200,
            "parking_type": "paid",
            "hourly_rate": 30.00,
            "is_covered": True,
            "has_security": True,
            "operating_hours": "24/7",
            "address": "Alabang-Zapote Road, Las Piñas City"
        },
        
        # BF Homes Area
        {
            "name": "BF Homes Commercial Area Parking",
            "description": "Street parking in BF Homes commercial district",
            "latitude": 14.4400,
            "longitude": 121.0200,
            "total_slots": 80,
            "available_slots": 60,
            "parking_type": "free",
            "hourly_rate": 0.00,
            "is_covered": False,
            "has_security": False,
            "operating_hours": "24/7",
            "address": "BF International Road, Las Piñas City"
        },
        {
            "name": "BF Resort Drive Parking",
            "description": "Residential area parking",
            "latitude": 14.4380,
            "longitude": 121.0180,
            "total_slots": 50,
            "available_slots": 40,
            "parking_type": "free",
            "hourly_rate": 0.00,
            "is_covered": False,
            "has_security": False,
            "operating_hours": "24/7",
            "address": "BF Resort Drive, Las Piñas City"
        },
        
        # Almanza Area
        {
            "name": "Almanza Uno Commercial Parking",
            "description": "Commercial area parking",
            "latitude": 14.4320,
            "longitude": 121.0080,
            "total_slots": 100,
            "available_slots": 75,
            "parking_type": "paid",
            "hourly_rate": 25.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "8:00 AM - 10:00 PM",
            "address": "Almanza Road, Las Piñas City"
        },
        
        # Zapote Area
        {
            "name": "Zapote Public Parking Area",
            "description": "Public parking near Zapote area",
            "latitude": 14.4430,
            "longitude": 121.0220,
            "total_slots": 120,
            "available_slots": 90,
            "parking_type": "paid",
            "hourly_rate": 20.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "24/7",
            "address": "Zapote Road, Las Piñas City"
        },
        
        # Talon Area
        {
            "name": "Talon Market Parking",
            "description": "Market area parking",
            "latitude": 14.4460,
            "longitude": 121.0070,
            "total_slots": 80,
            "available_slots": 60,
            "parking_type": "paid",
            "hourly_rate": 15.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "5:00 AM - 8:00 PM",
            "address": "Talon Uno, Las Piñas City"
        },
        
        # Pamplona Area
        {
            "name": "Pamplona Commercial Parking",
            "description": "Commercial district parking",
            "latitude": 14.4520,
            "longitude": 121.0090,
            "total_slots": 90,
            "available_slots": 70,
            "parking_type": "paid",
            "hourly_rate": 20.00,
            "is_covered": False,
            "has_security": True,
            "operating_hours": "8:00 AM - 9:00 PM",
            "address": "Pamplona Uno, Las Piñas City"
        }
    ]
    
    try:
        print(f"Adding {len(parking_areas)} parking areas to database...")
        
        for area_data in parking_areas:
            parking = Parking(**area_data)
            db.add(parking)
        
        db.commit()
        print(f"Successfully added {len(parking_areas)} parking areas!")
        
        # Display summary
        print("\nParking Areas Summary:")
        print(f"Total parking spaces: {sum(p['total_spaces'] for p in parking_areas)}")
        print(f"Monitored parking: {sum(1 for p in parking_areas if p['is_monitored'])}")
        print(f"24/7 parking: {sum(1 for p in parking_areas if p['operating_hours_start'] == '00:00' and p['operating_hours_end'] == '23:59')}")
        
    except Exception as e:
        print(f"Error adding parking areas: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_parking_areas()
