"""
Service for generating realistic traffic data for demonstration purposes.
This would typically be replaced with real traffic monitoring systems.
"""

import random
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models.traffic import TrafficMonitoring, TrafficStatus, RoadType
from ..websocket import manager
from ..db import get_db

class TrafficGeneratorService:
    def __init__(self):
        self.is_running = False
        self.las_pinas_roads = [
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
        
    def get_time_based_traffic_multiplier(self):
        """Get traffic intensity multiplier based on time of day."""
        current_hour = datetime.now().hour
        
        # Rush hour patterns
        if 7 <= current_hour <= 9:  # Morning rush
            return 1.8
        elif 17 <= current_hour <= 19:  # Evening rush
            return 2.0
        elif 12 <= current_hour <= 13:  # Lunch rush
            return 1.3
        elif 22 <= current_hour or current_hour <= 5:  # Late night
            return 0.3
        else:  # Regular hours
            return 1.0
    
    def generate_traffic_status(self, road_type: RoadType, time_multiplier: float):
        """Generate realistic traffic status based on road type and time."""
        base_congestion = {
            RoadType.HIGHWAY: 0.6,
            RoadType.MAIN_ROAD: 0.4,
            RoadType.SIDE_STREET: 0.3,
            RoadType.RESIDENTIAL: 0.2,
            RoadType.BRIDGE: 0.5
        }.get(road_type, 0.3)
        
        # Apply time multiplier and add randomness
        congestion = min(1.0, base_congestion * time_multiplier * random.uniform(0.7, 1.3))
        
        # Determine status based on congestion level
        if congestion < 0.2:
            return TrafficStatus.FREE_FLOW, congestion * 100, random.randint(40, 60)
        elif congestion < 0.4:
            return TrafficStatus.LIGHT, congestion * 100, random.randint(25, 40)
        elif congestion < 0.6:
            return TrafficStatus.MODERATE, congestion * 100, random.randint(15, 25)
        elif congestion < 0.8:
            return TrafficStatus.HEAVY, congestion * 100, random.randint(5, 15)
        else:
            return TrafficStatus.STANDSTILL, congestion * 100, random.randint(0, 5)
    
    async def update_traffic_data(self, db: Session):
        """Update traffic data for all monitored roads."""
        try:
            time_multiplier = self.get_time_based_traffic_multiplier()
            
            for road_info in self.las_pinas_roads:
                # Check if road already exists
                existing_traffic = db.query(TrafficMonitoring).filter(
                    TrafficMonitoring.road_name == road_info["name"]
                ).first()
                
                status, congestion_pct, avg_speed = self.generate_traffic_status(
                    road_info["type"], time_multiplier
                )
                
                vehicle_count = int(congestion_pct * random.uniform(0.8, 1.2))
                
                if existing_traffic:
                    # Update existing record
                    existing_traffic.traffic_status = status
                    existing_traffic.congestion_percentage = congestion_pct
                    existing_traffic.average_speed_kmh = avg_speed
                    existing_traffic.vehicle_count = vehicle_count
                    existing_traffic.last_updated = datetime.now()
                else:
                    # Create new record
                    new_traffic = TrafficMonitoring(
                        road_name=road_info["name"],
                        road_type=road_info["type"],
                        latitude=road_info["lat"] + random.uniform(-0.002, 0.002),  # Add slight variation
                        longitude=road_info["lng"] + random.uniform(-0.002, 0.002),
                        traffic_status=status,
                        congestion_percentage=congestion_pct,
                        average_speed_kmh=avg_speed,
                        vehicle_count=vehicle_count,
                        estimated_travel_time=random.randint(2, 15),
                        road_segment_length=random.uniform(0.5, 3.0)
                    )
                    db.add(new_traffic)
            
            db.commit()
            
            # Broadcast heatmap update
            await self.broadcast_heatmap_update(db)
            
        except Exception as e:
            print(f"Error updating traffic data: {e}")
            db.rollback()
    
    async def broadcast_heatmap_update(self, db: Session):
        """Broadcast traffic heatmap update via WebSocket."""
        try:
            # Get all traffic data
            traffic_data = db.query(TrafficMonitoring).all()
            
            heatmap_data = []
            for traffic in traffic_data:
                intensity = 0.2  # Default for free flow
                if traffic.traffic_status == TrafficStatus.LIGHT:
                    intensity = 0.4
                elif traffic.traffic_status == TrafficStatus.MODERATE:
                    intensity = 0.6
                elif traffic.traffic_status == TrafficStatus.HEAVY:
                    intensity = 0.8
                elif traffic.traffic_status == TrafficStatus.STANDSTILL:
                    intensity = 1.0
                    
                heatmap_data.append({
                    "lat": traffic.latitude,
                    "lng": traffic.longitude,
                    "intensity": intensity,
                    "road_name": traffic.road_name,
                    "status": traffic.traffic_status.value,
                    "vehicle_count": traffic.vehicle_count,
                    "congestion_percentage": traffic.congestion_percentage
                })
            
            # Broadcast the update
            await manager.send_traffic_heatmap_update({
                "heatmap_data": heatmap_data,
                "timestamp": datetime.now().isoformat(),
                "bounds": {
                    "lat_min": 14.4200,
                    "lat_max": 14.4800,
                    "lng_min": 121.0000,
                    "lng_max": 121.0400
                }
            })
            
        except Exception as e:
            print(f"Error broadcasting heatmap update: {e}")
    
    async def start_simulation(self, update_interval: int = 15):
        """Start the traffic simulation with periodic updates."""
        self.is_running = True
        print(f"Starting traffic simulation with {update_interval}s intervals")
        
        while self.is_running:
            try:
                # Get database session
                db = next(get_db())
                await self.update_traffic_data(db)
                db.close()
                
                # Wait for next update
                await asyncio.sleep(update_interval)
                
            except Exception as e:
                print(f"Error in traffic simulation: {e}")
                await asyncio.sleep(5)  # Short delay before retry
    
    def stop_simulation(self):
        """Stop the traffic simulation."""
        self.is_running = False
        print("Traffic simulation stopped")

# Global instance
traffic_generator = TrafficGeneratorService()
