"""
Script to populate parking areas in Las Piñas City
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models.parking import Parking, ParkingType, ParkingStatus

def populate_parking():
    db = SessionLocal()
    
    # Check if data exists
    if db.query(Parking).count() > 0:
        print("Parking data already exists. Skipping.")
        db.close()
        return
    
    parking_data = [
        # Malls
        {"name": "SM Southmall Parking", "description": "Multi-level parking at SM Southmall", "parking_type": ParkingType.GARAGE, "total_spaces": 1500, "available_spaces": 1200, "hourly_rate": 40.00, "latitude": 14.4504, "longitude": 121.0170, "address": "Alabang-Zapote Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "00:00", "operating_hours_end": "23:59"},
        {"name": "Robinsons Place Las Piñas", "description": "Covered parking at Robinsons", "parking_type": ParkingType.GARAGE, "total_spaces": 800, "available_spaces": 650, "hourly_rate": 40.00, "latitude": 14.4350, "longitude": 121.0100, "address": "Marcos Alvarez Ave, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "10:00", "operating_hours_end": "22:00"},
        {"name": "Vista Mall Las Piñas", "description": "Open parking at Vista Mall", "parking_type": ParkingType.LOT, "total_spaces": 600, "available_spaces": 480, "hourly_rate": 35.00, "latitude": 14.4420, "longitude": 121.0120, "address": "Alabang-Zapote Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "10:00", "operating_hours_end": "21:00"},
        
        # Government
        {"name": "Las Piñas City Hall", "description": "Public parking at City Hall", "parking_type": ParkingType.LOT, "total_spaces": 200, "available_spaces": 150, "hourly_rate": 0.00, "latitude": 14.4450, "longitude": 121.0250, "address": "Daniel Fajardo St, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": False, "operating_hours_start": "08:00", "operating_hours_end": "17:00"},
        {"name": "Sports Complex Parking", "description": "Parking for sports complex", "parking_type": ParkingType.LOT, "total_spaces": 300, "available_spaces": 250, "hourly_rate": 0.00, "latitude": 14.4380, "longitude": 121.0180, "address": "CAA Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": False, "operating_hours_start": "06:00", "operating_hours_end": "21:00"},
        
        # Churches
        {"name": "Bamboo Organ Church", "description": "Church parking", "parking_type": ParkingType.LOT, "total_spaces": 100, "available_spaces": 80, "hourly_rate": 0.00, "latitude": 14.4550, "longitude": 121.0180, "address": "Real Street, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": False, "operating_hours_start": "06:00", "operating_hours_end": "19:00"},
        
        # Markets
        {"name": "Public Market Parking", "description": "Market parking area", "parking_type": ParkingType.LOT, "total_spaces": 150, "available_spaces": 100, "hourly_rate": 20.00, "latitude": 14.4600, "longitude": 121.0150, "address": "Daniel Fajardo Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "05:00", "operating_hours_end": "20:00"},
        
        # Hospitals
        {"name": "Las Piñas Doctors Hospital", "description": "Hospital parking", "parking_type": ParkingType.GARAGE, "total_spaces": 250, "available_spaces": 200, "hourly_rate": 30.00, "latitude": 14.4480, "longitude": 121.0150, "address": "Alabang-Zapote Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "00:00", "operating_hours_end": "23:59"},
        
        # BF Homes
        {"name": "BF Homes Commercial Area", "description": "Street parking in BF commercial", "parking_type": ParkingType.STREET, "total_spaces": 80, "available_spaces": 60, "hourly_rate": 0.00, "latitude": 14.4400, "longitude": 121.0200, "address": "BF International Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": False, "operating_hours_start": "00:00", "operating_hours_end": "23:59"},
        {"name": "BF Resort Drive", "description": "Residential parking", "parking_type": ParkingType.STREET, "total_spaces": 50, "available_spaces": 40, "hourly_rate": 0.00, "latitude": 14.4380, "longitude": 121.0180, "address": "BF Resort Drive, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": False, "operating_hours_start": "00:00", "operating_hours_end": "23:59"},
        
        # Almanza
        {"name": "Almanza Uno Commercial", "description": "Commercial parking", "parking_type": ParkingType.LOT, "total_spaces": 100, "available_spaces": 75, "hourly_rate": 25.00, "latitude": 14.4320, "longitude": 121.0080, "address": "Almanza Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "08:00", "operating_hours_end": "22:00"},
        
        # Zapote
        {"name": "Zapote Public Parking", "description": "Public parking near Zapote", "parking_type": ParkingType.LOT, "total_spaces": 120, "available_spaces": 90, "hourly_rate": 20.00, "latitude": 14.4430, "longitude": 121.0220, "address": "Zapote Road, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "00:00", "operating_hours_end": "23:59"},
        
        # Talon
        {"name": "Talon Market Parking", "description": "Market area parking", "parking_type": ParkingType.LOT, "total_spaces": 80, "available_spaces": 60, "hourly_rate": 15.00, "latitude": 14.4460, "longitude": 121.0070, "address": "Talon Uno, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "05:00", "operating_hours_end": "20:00"},
        
        # Pamplona
        {"name": "Pamplona Commercial", "description": "Commercial district parking", "parking_type": ParkingType.LOT, "total_spaces": 90, "available_spaces": 70, "hourly_rate": 20.00, "latitude": 14.4520, "longitude": 121.0090, "address": "Pamplona Uno, Las Piñas", "status": ParkingStatus.AVAILABLE, "is_monitored": True, "operating_hours_start": "08:00", "operating_hours_end": "21:00"}
    ]
    
    try:
        print(f"Adding {len(parking_data)} parking areas...")
        for data in parking_data:
            parking = Parking(**data)
            db.add(parking)
        
        db.commit()
        print(f"Successfully added {len(parking_data)} parking areas!")
        print(f"Total spaces: {sum(p['total_spaces'] for p in parking_data)}")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    populate_parking()
