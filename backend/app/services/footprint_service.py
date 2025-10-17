import asyncio
import random
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from ..models.footprint import Footprint, CrowdLevel

logger = logging.getLogger(__name__)

class FootprintService:
    """Service for managing pedestrian footprint monitoring with real-time simulation"""
    
    def __init__(self):
        # Key pedestrian areas in Las Piñas City
        self.monitoring_areas = [
            {
                "name": "Alabang-Zapote Road (SM Southmall)",
                "lat": 14.4506,
                "lon": 121.0194,
                "radius": 200,
                "max_capacity": 2000,
                "area_type": "commercial",
                "peak_hours": [(7, 9), (17, 20)],
                "base_traffic": 150
            },
            {
                "name": "Marcos Alvarez Ave (Government Center)",
                "lat": 14.4634,
                "lon": 121.0186,
                "radius": 150,
                "max_capacity": 800,
                "area_type": "government",
                "peak_hours": [(8, 10), (12, 14), (16, 18)],
                "base_traffic": 80
            },
            {
                "name": "CAA Road (Las Piñas-Parañaque Bridge)",
                "lat": 14.4234,
                "lon": 120.9984,
                "radius": 100,
                "max_capacity": 1200,
                "area_type": "transport_hub",
                "peak_hours": [(6, 9), (17, 19)],
                "base_traffic": 200
            },
            {
                "name": "Real Street (Public Market)",
                "lat": 14.4441,
                "lon": 121.0127,
                "radius": 120,
                "max_capacity": 1500,
                "area_type": "market",
                "peak_hours": [(5, 9), (16, 19)],
                "base_traffic": 180
            },
            {
                "name": "Pilar Village (Residential)",
                "lat": 14.4389,
                "lon": 121.0089,
                "radius": 150,
                "max_capacity": 600,
                "area_type": "residential",
                "peak_hours": [(6, 8), (17, 19)],
                "base_traffic": 60
            },
            {
                "name": "BF Homes (Commercial Strip)",
                "lat": 14.4578,
                "lon": 121.0345,
                "radius": 180,
                "max_capacity": 1000,
                "area_type": "commercial",
                "peak_hours": [(10, 12), (18, 21)],
                "base_traffic": 120
            },
            {
                "name": "Moonwalk Village Center",
                "lat": 14.4312,
                "lon": 121.0043,
                "radius": 100,
                "max_capacity": 400,
                "area_type": "residential",
                "peak_hours": [(7, 9), (17, 19)],
                "base_traffic": 45
            },
            {
                "name": "Zapote River Walkway",
                "lat": 14.4445,
                "lon": 121.0098,
                "radius": 80,
                "max_capacity": 300,
                "area_type": "recreational",
                "peak_hours": [(5, 7), (17, 19)],
                "base_traffic": 30
            }
        ]
    
    def determine_crowd_level(self, pedestrian_count: int, max_capacity: int) -> CrowdLevel:
        """Determine crowd level based on pedestrian count and area capacity"""
        if max_capacity == 0:
            return CrowdLevel.LOW
            
        percentage = (pedestrian_count / max_capacity) * 100
        
        if percentage >= 85:
            return CrowdLevel.CRITICAL
        elif percentage >= 60:
            return CrowdLevel.HIGH
        elif percentage >= 30:
            return CrowdLevel.MEDIUM
        else:
            return CrowdLevel.LOW
    
    def is_peak_hour(self, area_data: dict, current_hour: int) -> bool:
        """Check if current hour falls within peak hours for the area"""
        for start_hour, end_hour in area_data["peak_hours"]:
            if start_hour <= current_hour <= end_hour:
                return True
        return False
    
    def calculate_realistic_pedestrian_count(self, area_data: dict) -> Tuple[int, float, float]:
        """Calculate realistic pedestrian count with weather factors"""
        current_time = datetime.now()
        current_hour = current_time.hour
        day_of_week = current_time.weekday()  # 0 = Monday, 6 = Sunday
        
        base_count = area_data["base_traffic"]
        
        # Time-based multiplier
        if self.is_peak_hour(area_data, current_hour):
            time_multiplier = random.uniform(2.5, 4.0)
        elif 6 <= current_hour <= 22:  # Daytime
            time_multiplier = random.uniform(1.2, 2.0)
        else:  # Nighttime
            time_multiplier = random.uniform(0.1, 0.5)
        
        # Day of week multiplier
        if day_of_week < 5:  # Weekday
            if area_data["area_type"] in ["commercial", "government"]:
                day_multiplier = random.uniform(1.0, 1.3)
            else:
                day_multiplier = random.uniform(0.8, 1.1)
        else:  # Weekend
            if area_data["area_type"] in ["commercial", "recreational", "market"]:
                day_multiplier = random.uniform(1.2, 1.8)
            else:
                day_multiplier = random.uniform(0.6, 0.9)
        
        # Area type specific adjustments
        type_adjustments = {
            "commercial": random.uniform(0.9, 1.3),
            "government": random.uniform(0.8, 1.1),
            "transport_hub": random.uniform(1.1, 1.4),
            "market": random.uniform(1.0, 1.5),
            "residential": random.uniform(0.7, 1.0),
            "recreational": random.uniform(0.8, 1.2)
        }
        
        type_multiplier = type_adjustments.get(area_data["area_type"], 1.0)
        
        # Weather simulation (random weather effects)
        weather_conditions = random.choice([
            ("clear", 1.0), ("cloudy", 0.95), ("light_rain", 0.7), 
            ("heavy_rain", 0.4), ("hot", 0.8), ("pleasant", 1.1)
        ])
        weather_type, weather_multiplier = weather_conditions
        
        # Calculate final count
        total_multiplier = time_multiplier * day_multiplier * type_multiplier * weather_multiplier
        pedestrian_count = int(base_count * total_multiplier)
        
        # Cap at max capacity with some overflow allowance
        max_allowed = int(area_data["max_capacity"] * 1.1)
        pedestrian_count = min(pedestrian_count, max_allowed)
        
        # Simulate temperature and humidity
        temperature = random.uniform(24, 35)  # Typical Philippine temperature
        humidity = random.uniform(60, 85)     # Typical humidity
        
        # Adjust for weather
        if weather_type == "hot":
            temperature += random.uniform(2, 5)
        elif weather_type in ["light_rain", "heavy_rain"]:
            temperature -= random.uniform(1, 3)
            humidity += random.uniform(5, 15)
        
        return pedestrian_count, temperature, humidity
    
    async def initialize_monitoring_areas(self, db: Session) -> List[Footprint]:
        """Initialize all monitoring areas in the database"""
        try:
            footprints = []
            
            for area_data in self.monitoring_areas:
                # Check if area already exists
                existing = db.query(Footprint).filter(
                    Footprint.area_name == area_data["name"]
                ).first()
                
                if not existing:
                    # Calculate initial pedestrian count
                    pedestrian_count, temp, humidity = self.calculate_realistic_pedestrian_count(area_data)
                    crowd_level = self.determine_crowd_level(pedestrian_count, area_data["max_capacity"])
                    
                    footprint = Footprint(
                        area_name=area_data["name"],
                        latitude=area_data["lat"],
                        longitude=area_data["lon"],
                        radius_meters=area_data["radius"],
                        pedestrian_count=pedestrian_count,
                        crowd_level=crowd_level,
                        temperature_celsius=temp,
                        humidity_percent=humidity,
                        recorded_at=datetime.now(timezone.utc)
                    )
                    
                    db.add(footprint)
                    footprints.append(footprint)
                else:
                    footprints.append(existing)
            
            db.commit()
            logger.info(f"Initialized {len(footprints)} footprint monitoring areas")
            return footprints
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error initializing monitoring areas: {str(e)}")
            raise
    
    async def update_all_footprint_data(self, db: Session) -> List[Footprint]:
        """Update all footprint monitoring areas with new data"""
        try:
            updated_footprints = []
            
            for area_data in self.monitoring_areas:
                # Get or create footprint record
                footprint = db.query(Footprint).filter(
                    Footprint.area_name == area_data["name"]
                ).first()
                
                if not footprint:
                    # Create new if doesn't exist
                    footprint = Footprint(
                        area_name=area_data["name"],
                        latitude=area_data["lat"],
                        longitude=area_data["lon"],
                        radius_meters=area_data["radius"]
                    )
                    db.add(footprint)
                
                # Calculate new pedestrian count
                pedestrian_count, temp, humidity = self.calculate_realistic_pedestrian_count(area_data)
                crowd_level = self.determine_crowd_level(pedestrian_count, area_data["max_capacity"])
                
                # Update footprint data
                footprint.pedestrian_count = pedestrian_count
                footprint.crowd_level = crowd_level
                footprint.temperature_celsius = temp
                footprint.humidity_percent = humidity
                footprint.recorded_at = datetime.now(timezone.utc)
                
                updated_footprints.append(footprint)
            
            db.commit()
            logger.info(f"Updated {len(updated_footprints)} footprint areas")
            return updated_footprints
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating footprint data: {str(e)}")
            raise
    
    def get_footprints_by_bounds(self, db: Session, lat_min: float, lat_max: float, 
                                lng_min: float, lng_max: float) -> List[Footprint]:
        """Get footprints within specified geographic bounds"""
        try:
            return db.query(Footprint).filter(
                and_(
                    Footprint.latitude >= lat_min,
                    Footprint.latitude <= lat_max,
                    Footprint.longitude >= lng_min,
                    Footprint.longitude <= lng_max
                )
            ).order_by(Footprint.recorded_at.desc()).all()
            
        except Exception as e:
            logger.error(f"Error getting footprints by bounds: {str(e)}")
            raise
    
    def get_footprint_heatmap_data(self, db: Session, lat_min: float, lat_max: float,
                                  lng_min: float, lng_max: float) -> List[Dict]:
        """Generate heatmap data for footprints"""
        try:
            footprints = self.get_footprints_by_bounds(db, lat_min, lat_max, lng_min, lng_max)
            
            heatmap_data = []
            for footprint in footprints:
                # Calculate intensity based on crowd level and pedestrian count
                max_area_capacity = next(
                    (area["max_capacity"] for area in self.monitoring_areas 
                     if area["name"] == footprint.area_name), 1000
                )
                
                intensity = min(1.0, footprint.pedestrian_count / max_area_capacity)
                
                heatmap_data.append({
                    "lat": footprint.latitude,
                    "lng": footprint.longitude,
                    "intensity": intensity,
                    "pedestrian_count": footprint.pedestrian_count,
                    "crowd_level": footprint.crowd_level.value,
                    "area_name": footprint.area_name,
                    "radius": footprint.radius_meters
                })
            
            return heatmap_data
            
        except Exception as e:
            logger.error(f"Error generating heatmap data: {str(e)}")
            raise
    
    def get_crowd_statistics(self, db: Session) -> Dict:
        """Get overall crowd statistics"""
        try:
            total_pedestrians = db.query(func.sum(Footprint.pedestrian_count)).scalar() or 0
            total_areas = db.query(func.count(Footprint.id)).scalar() or 0
            
            crowd_levels = db.query(
                Footprint.crowd_level,
                func.count(Footprint.id)
            ).group_by(Footprint.crowd_level).all()
            
            crowd_distribution = {level.value: 0 for level in CrowdLevel}
            for level, count in crowd_levels:
                crowd_distribution[level.value] = count
            
            # Get average temperature and humidity
            avg_temp = db.query(func.avg(Footprint.temperature_celsius)).scalar() or 0
            avg_humidity = db.query(func.avg(Footprint.humidity_percent)).scalar() or 0
            
            # Get most crowded areas
            most_crowded = db.query(Footprint).order_by(
                Footprint.pedestrian_count.desc()
            ).limit(5).all()
            
            return {
                "total_pedestrians": int(total_pedestrians),
                "total_monitoring_areas": total_areas,
                "crowd_distribution": crowd_distribution,
                "average_temperature": round(avg_temp, 1),
                "average_humidity": round(avg_humidity, 1),
                "most_crowded_areas": [
                    {
                        "area_name": fp.area_name,
                        "pedestrian_count": fp.pedestrian_count,
                        "crowd_level": fp.crowd_level.value,
                        "latitude": fp.latitude,
                        "longitude": fp.longitude
                    }
                    for fp in most_crowded
                ],
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting crowd statistics: {str(e)}")
            raise

# Create singleton instance
footprint_service = FootprintService()
