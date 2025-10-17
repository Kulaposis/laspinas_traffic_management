import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from ..db import SessionLocal
from .weather_service import weather_service
from .barangay_flood_service import barangay_flood_service
from .footprint_service import footprint_service
from .real_traffic_service import real_traffic_service
from ..websocket import manager

logger = logging.getLogger(__name__)

class DataScheduler:
    """Background scheduler for automatic data updates (weather, footprints, etc.)"""
    
    def __init__(self):
        self.is_running = False
        self.task: Optional[asyncio.Task] = None
        self.weather_interval = 900  # 15 minutes in seconds
        self.traffic_interval = 60  # 1 minute for real traffic API
        self.footprint_interval = 30  # 30 seconds for real-time feel
        self.daily_flood_interval = 24 * 60 * 60  # 24 hours
        self.last_weather_update = 0
        self.last_traffic_update = 0
        self.last_footprint_update = 0
        self.last_daily_flood_update = 0
    
    async def start(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.warning("Data scheduler is already running")
            return
            
        self.is_running = True
        self.task = asyncio.create_task(self._run_scheduler())
        logger.info("Data scheduler started")
    
    async def stop(self):
        """Stop the background scheduler"""
        if not self.is_running:
            return
            
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Data scheduler stopped")
    
    async def _run_scheduler(self):
        """Main scheduler loop"""
        while self.is_running:
            try:
                current_time = asyncio.get_event_loop().time()
                
                # Check if it's time to update weather data
                if current_time - self.last_weather_update >= self.weather_interval:
                    await self._update_weather_data()
                    self.last_weather_update = current_time
                
                # Check if it's time to update traffic data
                if current_time - self.last_traffic_update >= self.traffic_interval:
                    await self._update_traffic_data()
                    self.last_traffic_update = current_time
                
                # Check if it's time to update footprint data
                if current_time - self.last_footprint_update >= self.footprint_interval:
                    await self._update_footprint_data()
                    self.last_footprint_update = current_time

                # Ensure at least a daily refresh of barangay flood monitoring
                if current_time - self.last_daily_flood_update >= self.daily_flood_interval:
                    await self._refresh_daily_flood_data()
                    self.last_daily_flood_update = current_time

                # Sleep for a short time before checking again
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in data scheduler: {str(e)}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying
    
    async def _update_weather_data(self):
        """Update weather data using the weather service"""
        db: Session = SessionLocal()
        try:
            logger.info("Starting scheduled weather data update")
            
            # Update weather data for all monitoring areas
            weather_updates = await weather_service.update_all_weather_data(db)
            logger.info(f"Updated weather data for {len(weather_updates)} areas")
            
            # Update flood monitoring based on weather conditions
            flood_updates = await weather_service.update_flood_monitoring(db)
            logger.info(f"Updated flood monitoring for {len(flood_updates)} locations")
            
            logger.info("Scheduled weather data update completed successfully")
            
        except Exception as e:
            logger.error(f"Error updating weather data: {str(e)}")
        finally:
            db.close()
    
    async def _update_traffic_data(self):
        """Update traffic data using real TomTom API with fallback"""
        db: Session = SessionLocal()
        try:
            logger.info("Starting scheduled traffic data update")
            
            # Update traffic data using real API with fallback
            await real_traffic_service.update_traffic_data(db)
            logger.info("Scheduled traffic data update completed successfully")
            
        except Exception as e:
            logger.error(f"Error updating traffic data: {str(e)}")
        finally:
            db.close()
    
    async def _update_footprint_data(self):
        """Update footprint data and broadcast via WebSocket"""
        db: Session = SessionLocal()
        try:
            logger.debug("Starting scheduled footprint data update")
            
            # Update footprint data for all monitoring areas
            footprint_updates = await footprint_service.update_all_footprint_data(db)
            logger.debug(f"Updated footprint data for {len(footprint_updates)} areas")
            
            # Prepare data for WebSocket broadcast
            if footprint_updates:
                footprint_data = []
                for footprint in footprint_updates:
                    footprint_data.append({
                        "id": footprint.id,
                        "area_name": footprint.area_name,
                        "latitude": footprint.latitude,
                        "longitude": footprint.longitude,
                        "radius_meters": footprint.radius_meters,
                        "pedestrian_count": footprint.pedestrian_count,
                        "crowd_level": footprint.crowd_level.value,
                        "temperature_celsius": footprint.temperature_celsius,
                        "humidity_percent": footprint.humidity_percent,
                        "recorded_at": footprint.recorded_at.isoformat() if footprint.recorded_at else None
                    })
                
                # Broadcast footprint updates via WebSocket
                await manager.send_footprint_update({
                    "type": "real_time_update",
                    "areas": footprint_data,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_areas": len(footprint_data)
                })
            
            logger.debug("Scheduled footprint data update completed successfully")
            
        except Exception as e:
            logger.error(f"Error updating footprint data: {str(e)}")
        finally:
            db.close()

    async def _refresh_daily_flood_data(self):
        """Run a daily flood refresh to prevent stale flood statuses."""
        db: Session = SessionLocal()
        try:
            logger.info("Starting daily flood monitoring refresh")

            # Recalculate barangay flood data with no forced rainfall input.
            # This ensures locations revert if there is no ongoing rainfall.
            # Do not hit external API during daily refresh; just normalize/stabilize entries
            updates = await barangay_flood_service.update_barangay_flood_data(db, {}, fetch_from_api=False)
            logger.info(f"Daily flood monitoring refresh updated {len(updates)} barangay entries")

        except Exception as e:
            logger.error(f"Error during daily flood refresh: {str(e)}")
        finally:
            db.close()

# Global scheduler instance
data_scheduler = DataScheduler()

# Functions to control the scheduler
async def start_weather_scheduler():
    """Start the data scheduler (maintains function name for compatibility)"""
    await data_scheduler.start()

async def stop_weather_scheduler():
    """Stop the data scheduler (maintains function name for compatibility)"""
    await data_scheduler.stop()

def is_scheduler_running() -> bool:
    """Check if the scheduler is running"""
    return data_scheduler.is_running
