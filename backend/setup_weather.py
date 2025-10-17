#!/usr/bin/env python3
"""
Setup script for real-time weather monitoring integration.
This script helps initialize the weather monitoring system.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the app directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.db import SessionLocal
from app.services.weather_service import weather_service

async def test_weather_api():
    """Test the weather API connection"""
    print("🌤️  Testing weather API connection...")
    
    # Test with Las Piñas coordinates
    weather_data = await weather_service.fetch_current_weather(14.4504, 121.0170)
    
    if weather_data:
        print("✅ Weather API connection successful!")
        print(f"   Temperature: {weather_data.get('temperature_2m', 'N/A')}°C")
        print(f"   Humidity: {weather_data.get('relative_humidity_2m', 'N/A')}%")
        print(f"   Wind Speed: {weather_data.get('wind_speed_10m', 'N/A')} km/h")
        return True
    else:
        print("❌ Weather API connection failed!")
        return False

async def populate_initial_data():
    """Populate initial weather data for all monitoring areas"""
    print("\n🔄 Populating initial weather data...")
    
    db = SessionLocal()
    try:
        weather_updates = await weather_service.update_all_weather_data(db)
        
        if weather_updates:
            print(f"✅ Successfully populated weather data for {len(weather_updates)} areas:")
            for update in weather_updates:
                print(f"   • {update.area_name}: {update.temperature_celsius}°C")
        else:
            print("❌ Failed to populate weather data")
            
    except Exception as e:
        print(f"❌ Error populating weather data: {str(e)}")
    finally:
        db.close()

async def setup_flood_monitoring():
    """Setup initial flood monitoring data"""
    print("\n🌊 Setting up flood monitoring...")
    
    db = SessionLocal()
    try:
        flood_updates = await weather_service.update_flood_monitoring(db)
        
        if flood_updates:
            print(f"✅ Successfully setup flood monitoring for {len(flood_updates)} locations")
        else:
            print("ℹ️  No flood monitoring data to update (normal if no weather data exists)")
            
    except Exception as e:
        print(f"❌ Error setting up flood monitoring: {str(e)}")
    finally:
        db.close()

def print_usage_instructions():
    """Print usage instructions"""
    print("\n" + "="*60)
    print("🎉 REAL-TIME WEATHER MONITORING SETUP COMPLETE!")
    print("="*60)
    print()
    print("📋 FEATURES ADDED:")
    print("   • Real-time weather data from Open-Meteo API")
    print("   • Automatic weather updates every 5 minutes")
    print("   • 7 monitoring areas around Las Piñas City")
    print("   • Intelligent flood risk assessment")
    print("   • Live status indicators in the UI")
    print("   • Manual refresh button for admins/operators")
    print()
    print("🚀 TO USE:")
    print("   1. Start the backend server: uvicorn app.main:app --reload")
    print("   2. Open the weather monitoring page in your app")
    print("   3. Click 'Update Live Data' to fetch real-time weather")
    print("   4. Weather data will auto-refresh every 2 minutes")
    print()
    print("🗺️  MONITORING AREAS:")
    for area in weather_service.monitoring_areas:
        print(f"   • {area['name']} ({area['lat']:.4f}, {area['lon']:.4f})")
    print()
    print("ℹ️  API INFO:")
    print("   • Provider: Open-Meteo (free, no API key required)")
    print("   • Update frequency: Every 5 minutes (automatic)")
    print("   • Data includes: temp, humidity, wind, rainfall, weather conditions")
    print("   • Covers: Philippines with high accuracy")
    print()

async def main():
    """Main setup function"""
    print("🌦️  REAL-TIME WEATHER MONITORING SETUP")
    print("="*50)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test API connection
    api_ok = await test_weather_api()
    if not api_ok:
        print("❌ Setup failed: Cannot connect to weather API")
        return False
    
    # Populate initial data
    await populate_initial_data()
    
    # Setup flood monitoring
    await setup_flood_monitoring()
    
    # Print usage instructions
    print_usage_instructions()
    
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Setup failed with error: {str(e)}")
        sys.exit(1)
