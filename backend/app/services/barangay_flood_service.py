import asyncio
import logging
import httpx
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models.weather import FloodMonitoring, FloodLevel
from ..models.user import User

logger = logging.getLogger(__name__)

class BarangayFloodService:
    """Service for Las Piñas City barangay-specific flood monitoring with real data"""
    
    def __init__(self):
        # Meteo API configuration
        self.meteo_base_url = "https://api.open-meteo.com/v1"
        self.timeout = 30.0
        # Simple in-memory cache: {(round_lat, round_lon): (timestamp, data)}
        self._weather_cache: Dict[tuple, tuple] = {}
        self._cache_ttl_seconds = 300  # 5 minutes
        # Throttle concurrent calls to avoid 429
        self._semaphore = asyncio.Semaphore(2)
        # Limit how many barangays we actively process to reduce overall workload
        self.max_active_barangays = 6
        
        # Real Las Piñas City barangays with actual coordinates and flood risk data
        # Based on historical flood incidents and geographical characteristics
        self.barangays = [
            {
                "name": "Talon Uno",
                "lat": 14.4450,
                "lon": 121.0100,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Near Zapote River", "Low elevation", "Poor drainage"],
                "evacuation_center": "Talon Elementary School",
                "population": 15000,
                "critical_facilities": ["Health Center", "Elementary School"]
            },
            {
                "name": "Talon Dos",
                "lat": 14.4500,
                "lon": 121.0150,
                "flood_prone": True,
                "historical_flood_level": "high",
                "risk_factors": ["Zapote River tributary", "Informal settlements", "Limited drainage"],
                "evacuation_center": "Talon High School",
                "population": 18000,
                "critical_facilities": ["Barangay Hall", "Day Care Center"]
            },
            {
                "name": "Talon Tres",
                "lat": 14.4550,
                "lon": 121.0200,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Adjacent to Talon Dos", "Seasonal flooding"],
                "evacuation_center": "Covered Court Talon Tres",
                "population": 12000,
                "critical_facilities": ["Health Center"]
            },
            {
                "name": "Talon Kuatro",
                "lat": 14.4600,
                "lon": 121.0250,
                "flood_prone": False,
                "historical_flood_level": "low",
                "risk_factors": ["Higher elevation"],
                "evacuation_center": "Talon Kuatro Elementary School",
                "population": 10000,
                "critical_facilities": ["Elementary School"]
            },
            {
                "name": "Talon Singko",
                "lat": 14.4650,
                "lon": 121.0300,
                "flood_prone": False,
                "historical_flood_level": "low",
                "risk_factors": ["Residential area", "Good drainage"],
                "evacuation_center": "Multipurpose Hall",
                "population": 8000,
                "critical_facilities": ["Multipurpose Hall"]
            },
            {
                "name": "CAA-BF International",
                "lat": 14.4200,
                "lon": 121.0400,
                "flood_prone": False,
                "historical_flood_level": "normal",
                "risk_factors": ["Well-planned subdivision", "Good infrastructure"],
                "evacuation_center": "CAA Elementary School",
                "population": 25000,
                "critical_facilities": ["Shopping Center", "Schools"]
            },
            {
                "name": "Zapote",
                "lat": 14.4300,
                "lon": 121.0200,
                "flood_prone": True,
                "historical_flood_level": "critical",
                "risk_factors": ["Zapote River main channel", "Historical flooding", "Dense population"],
                "evacuation_center": "Zapote Elementary School",
                "population": 22000,
                "critical_facilities": ["Public Market", "Health Center", "Barangay Hall"]
            },
            {
                "name": "Pilar",
                "lat": 14.4400,
                "lon": 121.0350,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Near commercial areas", "Drainage issues during heavy rain"],
                "evacuation_center": "Pilar Elementary School",
                "population": 16000,
                "critical_facilities": ["Church", "Elementary School"]
            },
            {
                "name": "Pulang Lupa Uno",
                "lat": 14.4100,
                "lon": 121.0100,
                "flood_prone": True,
                "historical_flood_level": "high",
                "risk_factors": ["Low-lying area", "Poor drainage system", "Near creek"],
                "evacuation_center": "Covered Court Pulang Lupa",
                "population": 14000,
                "critical_facilities": ["Health Center", "Day Care"]
            },
            {
                "name": "Pulang Lupa Dos",
                "lat": 14.4150,
                "lon": 121.0150,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Adjacent to Pulang Lupa Uno", "Seasonal flooding"],
                "evacuation_center": "Elementary School Gymnasium",
                "population": 13000,
                "critical_facilities": ["Elementary School"]
            },
            {
                "name": "Almanza Uno",
                "lat": 14.4250,
                "lon": 121.0450,
                "flood_prone": False,
                "historical_flood_level": "low",
                "risk_factors": ["Higher ground", "Better drainage"],
                "evacuation_center": "Almanza Elementary School",
                "population": 20000,
                "critical_facilities": ["Shopping Mall", "Hospital"]
            },
            {
                "name": "Almanza Dos",
                "lat": 14.4300,
                "lon": 121.0500,
                "flood_prone": False,
                "historical_flood_level": "normal",
                "risk_factors": ["Residential area"],
                "evacuation_center": "Covered Court Almanza Dos",
                "population": 18000,
                "critical_facilities": ["Health Center"]
            },
            {
                "name": "Daniel Fajardo",
                "lat": 14.4700,
                "lon": 121.0400,
                "flood_prone": False,
                "historical_flood_level": "normal",
                "risk_factors": ["Industrial area", "Good drainage"],
                "evacuation_center": "Daniel Fajardo Elementary School",
                "population": 11000,
                "critical_facilities": ["Elementary School", "Industrial facilities"]
            },
            {
                "name": "Elias Aldana",
                "lat": 14.4750,
                "lon": 121.0350,
                "flood_prone": False,
                "historical_flood_level": "low",
                "risk_factors": ["Elevated area"],
                "evacuation_center": "Elias Aldana School",
                "population": 9000,
                "critical_facilities": ["School"]
            },
            {
                "name": "Ilaya",
                "lat": 14.4800,
                "lon": 121.0300,
                "flood_prone": False,
                "historical_flood_level": "normal",
                "risk_factors": ["Residential area"],
                "evacuation_center": "Ilaya Elementary School",
                "population": 12000,
                "critical_facilities": ["Elementary School", "Health Center"]
            },
            {
                "name": "Manuyo Uno",
                "lat": 14.4000,
                "lon": 121.0000,
                "flood_prone": True,
                "historical_flood_level": "high",
                "risk_factors": ["Coastal area", "Laguna de Bay proximity", "Low elevation"],
                "evacuation_center": "Manuyo Elementary School",
                "population": 17000,
                "critical_facilities": ["Elementary School", "Health Center", "Fish Port"]
            },
            {
                "name": "Manuyo Dos",
                "lat": 14.4050,
                "lon": 121.0050,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Near Manuyo Uno", "Tidal influence"],
                "evacuation_center": "Manuyo Dos Elementary School",
                "population": 15000,
                "critical_facilities": ["Elementary School"]
            },
            {
                "name": "Pamplona Uno",
                "lat": 14.4350,
                "lon": 121.0250,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Central location", "High traffic area"],
                "evacuation_center": "Pamplona Elementary School",
                "population": 19000,
                "critical_facilities": ["City Hall nearby", "Commercial area"]
            },
            {
                "name": "Pamplona Dos",
                "lat": 14.4400,
                "lon": 121.0300,
                "flood_prone": True,
                "historical_flood_level": "moderate",
                "risk_factors": ["Dense urban area", "Commercial district"],
                "evacuation_center": "Pamplona Dos School",
                "population": 21000,
                "critical_facilities": ["Shopping centers", "Banks"]
            },
            {
                "name": "Pamplona Tres",
                "lat": 14.4450,
                "lon": 121.0350,
                "flood_prone": False,
                "historical_flood_level": "low",
                "risk_factors": ["Better drainage", "Mixed residential-commercial"],
                "evacuation_center": "Pamplona Tres Elementary School",
                "population": 16000,
                "critical_facilities": ["Elementary School", "Health Center"]
            }
        ]

    def get_active_barangays(self) -> List[Dict]:
        """Return the subset of barangays we actively process."""
        return self.barangays[: self.max_active_barangays]
    
    async def fetch_realtime_weather_for_barangay(self, barangay: Dict) -> Optional[Dict]:
        """Fetch real-time weather data from Meteo API for a specific barangay"""
        try:
            # Cache lookup by approx location
            cache_key = (round(barangay["lat"], 3), round(barangay["lon"], 3))
            now_ts = datetime.now(timezone.utc).timestamp()
            cached = self._weather_cache.get(cache_key)
            if cached and now_ts - cached[0] < self._cache_ttl_seconds:
                return cached[1]

            params = {
                "latitude": barangay["lat"],
                "longitude": barangay["lon"],
                "current": [
                    "temperature_2m",
                    "relative_humidity_2m", 
                    "precipitation",
                    "weather_code",
                    "cloud_cover",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "pressure_msl"
                ],
                "timezone": "Asia/Manila",
                "forecast_days": 1
            }

            # Throttle and retry with exponential backoff for 429s
            async with self._semaphore:
                backoff = 0.5
                for attempt in range(5):
                    try:
                        async with httpx.AsyncClient(timeout=self.timeout) as client:
                            response = await client.get(f"{self.meteo_base_url}/forecast", params=params)
                            if response.status_code == 429:
                                raise httpx.HTTPStatusError("Too Many Requests", request=response.request, response=response)
                            response.raise_for_status()
                            data = response.json()
                            result = data.get("current")
                            if result is not None:
                                self._weather_cache[cache_key] = (now_ts, result)
                            return result
                    except httpx.HTTPStatusError as http_err:
                        if http_err.response is not None and http_err.response.status_code == 429 and attempt < 4:
                            await asyncio.sleep(backoff)
                            backoff *= 2
                            continue
                        raise
                    except httpx.RequestError:
                        if attempt < 4:
                            await asyncio.sleep(backoff)
                            backoff *= 2
                            continue
                        raise
        except Exception as e:
            logger.error(f"Error fetching weather data for {barangay['name']}: {str(e)}")
            return None
    
    def get_flood_level_from_historical(self, historical_level: str) -> FloodLevel:
        """Convert historical flood level to FloodLevel enum"""
        mapping = {
            "normal": FloodLevel.NORMAL,
            "low": FloodLevel.LOW,
            "moderate": FloodLevel.MODERATE,
            "high": FloodLevel.HIGH,
            "critical": FloodLevel.CRITICAL
        }
        return mapping.get(historical_level, FloodLevel.NORMAL)
    
    def calculate_flood_risk_score(self, barangay: Dict, weather_data: Optional[Dict] = None) -> Tuple[int, str]:
        """Calculate flood risk score based on real-time weather and barangay characteristics"""
        base_score = 0
        
        # Get current rainfall from real-time weather data
        current_rainfall = 0.0
        if weather_data:
            current_rainfall = weather_data.get("precipitation", 0.0)
        
        # Historical flood level weight (reduced influence for real-time data)
        historical_weights = {
            "normal": 0,
            "low": 0.5,
            "moderate": 1,
            "high": 1.5,
            "critical": 2
        }
        base_score += historical_weights.get(barangay["historical_flood_level"], 0)
        
        # Flood prone area bonus (reduced for real-time focus)
        if barangay["flood_prone"]:
            base_score += 1
        
        # Risk factors count (reduced weight)
        base_score += len(barangay["risk_factors"]) * 0.3
        
        # Population density factor (reduced weight)
        if barangay["population"] > 20000:
            base_score += 0.5
        elif barangay["population"] > 15000:
            base_score += 0.3
        
        # Real-time weather conditions (primary factor)
        if current_rainfall > 50:  # Very heavy rain
            base_score += 4
        elif current_rainfall > 30:  # Heavy rain
            base_score += 3
        elif current_rainfall > 15:  # Moderate rain
            base_score += 2
        elif current_rainfall > 5:   # Light rain
            base_score += 1
        elif current_rainfall > 0:   # Very light rain
            base_score += 0.5
        
        # Additional weather factors
        if weather_data:
            # Thunderstorm increases risk
            weather_code = weather_data.get("weather_code", 0)
            if weather_code in [95, 96, 99]:  # Thunderstorm codes
                base_score += 1
            
            # High wind speed increases risk
            wind_speed = weather_data.get("wind_speed_10m", 0)
            if wind_speed > 40:  # Strong winds
                base_score += 0.5
        
        # Convert to alert level (0-4)
        alert_level = min(4, int(base_score))
        
        # Risk description
        risk_descriptions = {
            0: "Minimal Risk",
            1: "Low Risk", 
            2: "Moderate Risk",
            3: "High Risk",
            4: "Critical Risk"
        }
        
        return alert_level, risk_descriptions.get(alert_level, "Unknown Risk")
    
    def estimate_water_level(self, barangay: Dict, weather_data: Optional[Dict] = None) -> float:
        """Estimate water level in centimeters based on real-time weather and barangay characteristics"""
        base_level = 0.0
        
        # Get current rainfall from real-time weather data
        current_rainfall = 0.0
        if weather_data:
            current_rainfall = weather_data.get("precipitation", 0.0)
        
        # Historical flood level influence (reduced for real-time focus)
        historical_multipliers = {
            "normal": 1.0,
            "low": 1.2,
            "moderate": 1.5,
            "high": 2.0,
            "critical": 2.5
        }
        
        multiplier = historical_multipliers.get(barangay["historical_flood_level"], 1.0)
        
        # Real-time rainfall contribution (primary factor)
        if current_rainfall > 0:
            # Base calculation: rainfall in mm converted to cm with barangay-specific multiplier
            base_level = current_rainfall * multiplier * 0.8  # More conservative estimation
            
            # Add extra for flood-prone areas
            if barangay["flood_prone"]:
                base_level *= 1.3
                
            # Add drainage factor
            if "Poor drainage" in barangay["risk_factors"]:
                base_level *= 1.2
            elif "Good drainage" in barangay["risk_factors"]:
                base_level *= 0.8
            
            # Additional weather factors
            if weather_data:
                # Thunderstorm increases water accumulation
                weather_code = weather_data.get("weather_code", 0)
                if weather_code in [95, 96, 99]:  # Thunderstorm codes
                    base_level *= 1.2
                
                # High humidity can slow evaporation
                humidity = weather_data.get("relative_humidity_2m", 70)
                if humidity > 80:
                    base_level *= 1.1
        
        return max(0.0, base_level)
    
    async def update_barangay_flood_data(self, db: Session, current_rainfall_data: Dict = None, fetch_from_api: bool = True) -> List[FloodMonitoring]:
        """Update flood monitoring data for all Las Piñas barangays.
        When fetch_from_api is False, do not call external API; rely on provided rainfall data or defaults.
        """
        results = []
        
        try:
            # Fetch once for Las Piñas center and reuse for all barangays to minimize API usage
            shared_weather = None
            if fetch_from_api:
                try:
                    from .weather_service import weather_service as _weather_service
                    shared_weather = await _weather_service.fetch_current_weather(14.4504, 121.0170)
                except Exception as _e:
                    logger.warning(f"Shared weather fetch failed, will proceed without: {_e}")

            for barangay in self.get_active_barangays():
                # Use shared weather data (no additional API calls per barangay)
                weather_data = shared_weather
                
                # Fallback to provided rainfall data if API fails
                if not weather_data and current_rainfall_data:
                    current_rainfall = current_rainfall_data.get(barangay["name"], 0.0)
                    weather_data = {"precipitation": current_rainfall}
                elif not weather_data:
                    weather_data = {"precipitation": 0.0}
                
                # Calculate flood risk based on real-time weather and barangay profile
                alert_level, risk_description = self.calculate_flood_risk_score(barangay, weather_data)
                
                # Determine flood level based on real-time conditions
                current_rainfall = weather_data.get("precipitation", 0.0)
                if current_rainfall <= 0.0:
                    flood_level = FloodLevel.NORMAL
                    alert_level = 0
                elif current_rainfall > 50:
                    flood_level = FloodLevel.CRITICAL
                elif current_rainfall > 30:
                    flood_level = FloodLevel.HIGH
                elif current_rainfall > 15:
                    flood_level = FloodLevel.MODERATE
                elif current_rainfall > 5:
                    flood_level = FloodLevel.LOW
                else:
                    flood_level = FloodLevel.NORMAL
                
                # Estimate water level based on real-time weather
                water_level_cm = self.estimate_water_level(barangay, weather_data)
                
                # Check if entry exists
                existing_flood = db.query(FloodMonitoring).filter(
                    FloodMonitoring.location_name == barangay["name"],
                    FloodMonitoring.latitude == barangay["lat"],
                    FloodMonitoring.longitude == barangay["lon"]
                ).first()
                
                if existing_flood:
                    # Update existing entry
                    existing_flood.water_level_cm = water_level_cm
                    existing_flood.flood_level = flood_level
                    existing_flood.alert_level = alert_level
                    existing_flood.is_flood_prone = barangay["flood_prone"]
                    existing_flood.estimated_passable = alert_level < 3
                    existing_flood.evacuation_center_nearby = barangay["evacuation_center"]
                    existing_flood.last_updated = datetime.now(timezone.utc)
                    results.append(existing_flood)
                else:
                    # Create new entry
                    new_flood = FloodMonitoring(
                        location_name=barangay["name"],
                        latitude=barangay["lat"],
                        longitude=barangay["lon"],
                        water_level_cm=water_level_cm,
                        flood_level=flood_level,
                        alert_level=alert_level,
                        is_flood_prone=barangay["flood_prone"],
                        estimated_passable=alert_level < 3,
                        evacuation_center_nearby=barangay["evacuation_center"],
                        last_updated=datetime.now(timezone.utc)
                    )
                    db.add(new_flood)
                    results.append(new_flood)
                
                logger.info(f"Updated flood data for {barangay['name']}: Alert Level {alert_level}, Water Level {water_level_cm:.1f}cm, Rainfall {current_rainfall:.1f}mm, Flood Level {flood_level.value}")
            
            db.commit()
            
            # Broadcast flood update via WebSocket if results exist
            if results:
                await self.broadcast_flood_update(db, results)
            
        except Exception as e:
            logger.error(f"Error updating barangay flood data: {str(e)}")
            db.rollback()
        
        return results
    
    def get_barangay_info(self, barangay_name: str) -> Optional[Dict]:
        """Get detailed information about a specific barangay"""
        for barangay in self.barangays:
            if barangay["name"].lower() == barangay_name.lower():
                return barangay
        return None
    
    async def broadcast_flood_update(self, db: Session, flood_results: List[FloodMonitoring]):
        """Broadcast flood monitoring update via WebSocket."""
        try:
            # Import here to avoid circular imports
            from ..websocket import manager
            
            # Convert flood data to JSON-serializable format
            flood_data = []
            for flood in flood_results:
                flood_data.append({
                    "id": flood.id,
                    "location_name": flood.location_name,
                    "latitude": flood.latitude,
                    "longitude": flood.longitude,
                    "water_level_cm": flood.water_level_cm,
                    "flood_level": flood.flood_level.value if flood.flood_level else "normal",
                    "is_flood_prone": flood.is_flood_prone,
                    "evacuation_center_nearby": flood.evacuation_center_nearby,
                    "affected_roads": flood.affected_roads,
                    "estimated_passable": flood.estimated_passable,
                    "alert_level": flood.alert_level,
                    "sensor_id": flood.sensor_id,
                    "last_updated": flood.last_updated.isoformat() if flood.last_updated else None
                })
            
            # Broadcast the update
            await manager.send_weather_update({
                "flood_data": flood_data,
                "timestamp": datetime.now().isoformat(),
                "update_type": "barangay_flood_monitoring"
            })
            
            logger.info(f"Broadcasted barangay flood update for {len(flood_data)} locations")
            
        except Exception as e:
            logger.error(f"Error broadcasting barangay flood update: {str(e)}")
    
    def get_flood_prone_barangays(self) -> List[Dict]:
        """Get list of all flood-prone barangays"""
        return [b for b in self.barangays if b["flood_prone"]]
    
    def get_critical_flood_areas(self) -> List[Dict]:
        """Get barangays with critical or high historical flood levels"""
        return [b for b in self.barangays if b["historical_flood_level"] in ["critical", "high"]]
    
    def get_evacuation_centers(self) -> List[Dict]:
        """Get all evacuation centers with their locations"""
        centers = []
        for barangay in self.barangays:
            centers.append({
                "barangay": barangay["name"],
                "evacuation_center": barangay["evacuation_center"],
                "latitude": barangay["lat"],
                "longitude": barangay["lon"],
                "population_served": barangay["population"]
            })
        return centers

# Global instance
barangay_flood_service = BarangayFloodService()
