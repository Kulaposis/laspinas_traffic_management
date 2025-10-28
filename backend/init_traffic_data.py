"""
One-time script to initialize traffic data from TomTom API
Run this after deploying to populate the database
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.services.real_traffic_service import real_traffic_service

async def init_traffic_data():
    """Initialize traffic monitoring data"""
    db = SessionLocal()
    try:
        print("Fetching traffic data from TomTom API...")
        await real_traffic_service.update_traffic_data(db)
        print("✓ Traffic data initialized successfully!")
    except Exception as e:
        print(f"✗ Error initializing traffic data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(init_traffic_data())
