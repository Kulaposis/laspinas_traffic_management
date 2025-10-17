import httpx
import asyncio
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session
from ..models.weather import WeatherData, WeatherCondition, FloodMonitoring, FloodLevel
from ..models.user import User
from .barangay_flood_service import barangay_flood_service

logger = logging.getLogger(__name__)

class WeatherService:
    """Service for real-time weather data integration with provider fallback"""
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1"
        self.timeout = 30.0
        
        # Limit to Las Piñas City only to reduce API requests
        self.monitoring_areas = [
            {"name": "Las Piñas City", "lat": 14.4504, "lon": 121.0170}
        ]
    
    async def _fetch_from_open_meteo(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch current weather data from Open-Meteo API with retry/backoff"""
        params = {
            "latitude": lat,
            "longitude": lon,
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

        backoff = 0.5
        for attempt in range(5):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(f"{self.base_url}/forecast", params=params)
                    if response.status_code == 429:
                        raise httpx.HTTPStatusError("Too Many Requests", request=response.request, response=response)
                    response.raise_for_status()
                    data = response.json()
                    current = data.get("current")
                    if current is not None:
                        current["data_provider"] = "open_meteo_api"
                    return current
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

        return None

    async def _fetch_from_metno(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch current weather from MET Norway Locationforecast (no API key required).
        Maps response to Open-Meteo-like keys used by the app.
        """
        try:
            url = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
            headers = {
                # MET requires an identifying User-Agent with contact/URL per guidelines
                "User-Agent": "thesis-traffic-management/1.0 https://example.local/contact"
            }
            params = {"lat": lat, "lon": lon}
            async with httpx.AsyncClient(timeout=self.timeout, headers=headers) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 429:
                    return None
                resp.raise_for_status()
                data = resp.json()
            ts = data.get("properties", {}).get("timeseries", [])
            if not ts:
                return None
            entry = ts[0].get("data", {})
            instant = entry.get("instant", {}).get("details", {})
            next1 = (entry.get("next_1_hours") or {}).get("details", {})
            summary = (entry.get("next_1_hours") or {}).get("summary", {})

            # Rough mapping to our expected keys
            temperature = instant.get("air_temperature")
            humidity = instant.get("relative_humidity")
            wind_speed = instant.get("wind_speed")
            wind_dir = instant.get("wind_from_direction")
            pressure = instant.get("air_pressure_at_sea_level")
            cloud = instant.get("cloud_area_fraction")
            precipitation = next1.get("precipitation_amount", 0.0)

            # Derive a coarse weather_code from symbol_code or precipitation/clouds
            symbol = summary.get("symbol_code", "")
            weather_code = 0
            if "thunder" in symbol:
                weather_code = 95
            elif precipitation and precipitation >= 15:
                weather_code = 82
            elif precipitation and precipitation >= 5:
                weather_code = 63
            elif precipitation and precipitation > 0:
                weather_code = 61
            elif cloud is not None and cloud >= 85:
                weather_code = 3
            elif cloud is not None and cloud >= 35:
                weather_code = 2
            else:
                weather_code = 0

            result = {
                "temperature_2m": temperature,
                "relative_humidity_2m": humidity,
                "precipitation": precipitation,
                "weather_code": weather_code,
                "cloud_cover": cloud,
                "wind_speed_10m": wind_speed,
                "wind_direction_10m": wind_dir,
                "pressure_msl": pressure,
                "data_provider": "metno_api"
            }
            return result
        except Exception as e:
            logger.warning(f"MET Norway fallback failed for {lat}, {lon}: {e}")
            return None

    async def fetch_current_weather(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch current weather, preferring Open-Meteo, with MET Norway fallback."""
        try:
            primary = await self._fetch_from_open_meteo(lat, lon)
            if primary:
                return primary
        except Exception as e:
            logger.warning(f"Open-Meteo failed for {lat}, {lon}, trying fallback: {e}")

        # Try fallback provider
        fallback = await self._fetch_from_metno(lat, lon)
        if fallback:
            return fallback

        logger.error(f"All weather providers failed for {lat}, {lon}")
        return None
    
    def _map_weather_code_to_condition(self, weather_code: int) -> WeatherCondition:
        """Map Open-Meteo weather codes to our WeatherCondition enum"""
        code_mapping = {
            0: WeatherCondition.CLEAR,          # Clear sky
            1: WeatherCondition.PARTLY_CLOUDY,  # Mainly clear
            2: WeatherCondition.PARTLY_CLOUDY,  # Partly cloudy
            3: WeatherCondition.CLOUDY,         # Overcast
            45: WeatherCondition.FOG,           # Fog
            48: WeatherCondition.FOG,           # Depositing rime fog
            51: WeatherCondition.LIGHT_RAIN,    # Light drizzle
            53: WeatherCondition.LIGHT_RAIN,    # Moderate drizzle
            55: WeatherCondition.MODERATE_RAIN, # Dense drizzle
            56: WeatherCondition.LIGHT_RAIN,    # Light freezing drizzle
            57: WeatherCondition.MODERATE_RAIN, # Dense freezing drizzle
            61: WeatherCondition.LIGHT_RAIN,    # Slight rain
            63: WeatherCondition.MODERATE_RAIN, # Moderate rain
            65: WeatherCondition.HEAVY_RAIN,    # Heavy rain
            66: WeatherCondition.LIGHT_RAIN,    # Light freezing rain
            67: WeatherCondition.HEAVY_RAIN,    # Heavy freezing rain
            71: WeatherCondition.LIGHT_RAIN,    # Slight snow fall
            73: WeatherCondition.MODERATE_RAIN, # Moderate snow fall
            75: WeatherCondition.HEAVY_RAIN,    # Heavy snow fall
            80: WeatherCondition.LIGHT_RAIN,    # Slight rain showers
            81: WeatherCondition.MODERATE_RAIN, # Moderate rain showers
            82: WeatherCondition.HEAVY_RAIN,    # Violent rain showers
            95: WeatherCondition.THUNDERSTORM,  # Thunderstorm
            96: WeatherCondition.THUNDERSTORM,  # Thunderstorm with slight hail
            99: WeatherCondition.THUNDERSTORM,  # Thunderstorm with heavy hail
        }
        return code_mapping.get(weather_code, WeatherCondition.CLEAR)
    
    def _get_wind_direction_text(self, degrees: float) -> str:
        """Convert wind direction degrees to text"""
        if degrees is None:
            return "N"
        
        directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        index = round(degrees / 45) % 8
        return directions[index]
    
    async def update_weather_data_for_area(self, area: Dict, db: Session) -> Optional[WeatherData]:
        """Fetch and store weather data for a specific area"""
        try:
            weather_data = await self.fetch_current_weather(area["lat"], area["lon"])
            if not weather_data:
                return None
            
            # Create WeatherData object
            weather_entry = WeatherData(
                area_name=area["name"],
                latitude=area["lat"],
                longitude=area["lon"],
                temperature_celsius=weather_data.get("temperature_2m", 25.0),
                humidity_percent=weather_data.get("relative_humidity_2m", 70.0),
                wind_speed_kmh=weather_data.get("wind_speed_10m", 0.0),
                wind_direction=self._get_wind_direction_text(weather_data.get("wind_direction_10m")),
                rainfall_mm=weather_data.get("precipitation", 0.0),
                weather_condition=self._map_weather_code_to_condition(weather_data.get("weather_code", 0)),
                visibility_km=None,  # Open-Meteo doesn't provide visibility
                pressure_hpa=weather_data.get("pressure_msl"),
                data_source=weather_data.get("data_provider", "open_meteo_api"),
                recorded_at=datetime.now(timezone.utc)
            )
            
            db.add(weather_entry)
            db.flush()  # Flush instead of commit to avoid session conflicts
            db.refresh(weather_entry)
            
            logger.info(f"Updated weather data for {area['name']}")
            return weather_entry
            
        except Exception as e:
            logger.error(f"Error updating weather data for {area['name']}: {str(e)}")
            db.rollback()
            return None
    
    async def update_all_weather_data(self, db: Session) -> List[WeatherData]:
        """Update weather data for all monitoring areas"""
        results = []
        
        try:
            # Process areas sequentially to avoid database session conflicts
            for area in self.monitoring_areas:
                try:
                    weather_entry = await self.update_weather_data_for_area(area, db)
                    if weather_entry:
                        results.append(weather_entry)
                except Exception as e:
                    logger.error(f"Failed to update weather for {area['name']}: {str(e)}")
                    continue
                    
            logger.info(f"Successfully updated weather data for {len(results)} out of {len(self.monitoring_areas)} areas")
            
            # Commit all changes at the end
            db.commit()
                    
        except Exception as e:
            logger.error(f"Error in bulk weather update: {str(e)}")
            db.rollback()
            raise
        
        return results
    
    async def fetch_weather_for_coordinates(self, lat: float, lon: float, area_name: str = None) -> Optional[Dict]:
        """Fetch weather data for specific coordinates (for API endpoints)"""
        try:
            weather_data = await self.fetch_current_weather(lat, lon)
            if not weather_data:
                return None
            
            return {
                "area_name": area_name or f"Location {lat:.4f}, {lon:.4f}",
                "latitude": lat,
                "longitude": lon,
                "temperature_celsius": weather_data.get("temperature_2m", 25.0),
                "humidity_percent": weather_data.get("relative_humidity_2m", 70.0),
                "wind_speed_kmh": weather_data.get("wind_speed_10m", 0.0),
                "wind_direction": self._get_wind_direction_text(weather_data.get("wind_direction_10m")),
                "rainfall_mm": weather_data.get("precipitation", 0.0),
                "weather_condition": self._map_weather_code_to_condition(weather_data.get("weather_code", 0)),
                "pressure_hpa": weather_data.get("pressure_msl"),
                "recorded_at": datetime.now(timezone.utc),
                "data_source": weather_data.get("data_provider", "open_meteo_api")
            }
            
        except Exception as e:
            logger.error(f"Error fetching weather for coordinates {lat}, {lon}: {str(e)}")
            return None
    
    def assess_flood_risk(self, weather_data: WeatherData) -> Tuple[FloodLevel, int]:
        """Assess flood risk based on weather conditions"""
        alert_level = 0
        flood_level = FloodLevel.NORMAL
        
        # Heavy rainfall increases flood risk
        if weather_data.rainfall_mm > 50:  # Very heavy rain
            alert_level = 4
            flood_level = FloodLevel.CRITICAL
        elif weather_data.rainfall_mm > 30:  # Heavy rain
            alert_level = 3
            flood_level = FloodLevel.HIGH
        elif weather_data.rainfall_mm > 15:  # Moderate rain
            alert_level = 2
            flood_level = FloodLevel.MODERATE
        elif weather_data.rainfall_mm > 5:   # Light rain
            alert_level = 1
            flood_level = FloodLevel.LOW
        
        # Wind and thunderstorms can exacerbate flooding
        if weather_data.weather_condition == WeatherCondition.THUNDERSTORM:
            alert_level = min(4, alert_level + 1)
            if flood_level == FloodLevel.NORMAL:
                flood_level = FloodLevel.LOW
        
        if weather_data.wind_speed_kmh and weather_data.wind_speed_kmh > 40:  # Strong winds
            alert_level = min(4, alert_level + 1)
        
        return flood_level, alert_level
    
    async def update_flood_monitoring(self, db: Session) -> List[FloodMonitoring]:
        """Update flood monitoring based on current weather conditions and barangay data"""
        results = []
        
        try:
            # Get recent weather data to build rainfall map
            from datetime import timedelta
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)
            recent_weather = db.query(WeatherData).filter(
                WeatherData.recorded_at >= cutoff_time
            ).all()
            
            # Build rainfall data map by area
            rainfall_data = {}
            for weather in recent_weather:
                # Find closest barangay for each weather station
                closest_barangay = self._find_closest_barangay(weather.latitude, weather.longitude)
                if closest_barangay:
                    rainfall_data[closest_barangay] = weather.rainfall_mm
            
            # Update barangay-specific flood data
            barangay_results = await barangay_flood_service.update_barangay_flood_data(db, rainfall_data)
            results.extend(barangay_results)
            
            # Update weather station flood data (original logic)
            for weather in recent_weather:
                try:
                    flood_level, alert_level = self.assess_flood_risk(weather)
                    
                    # Check if flood monitoring entry exists for this weather station
                    existing_flood = db.query(FloodMonitoring).filter(
                        FloodMonitoring.latitude == weather.latitude,
                        FloodMonitoring.longitude == weather.longitude,
                        FloodMonitoring.location_name == weather.area_name
                    ).first()
                    
                    if existing_flood:
                        # Update existing entry
                        existing_flood.flood_level = flood_level
                        existing_flood.alert_level = alert_level
                        existing_flood.last_updated = datetime.now(timezone.utc)
                        existing_flood.estimated_passable = alert_level < 3
                        existing_flood.water_level_cm = max(0, weather.rainfall_mm * 2)
                        results.append(existing_flood)
                    else:
                        # Create new flood monitoring entry for weather station
                        new_flood = FloodMonitoring(
                            location_name=weather.area_name,
                            latitude=weather.latitude,
                            longitude=weather.longitude,
                            water_level_cm=max(0, weather.rainfall_mm * 2),  # Rough estimation
                            flood_level=flood_level,
                            alert_level=alert_level,
                            estimated_passable=alert_level < 3,
                            last_updated=datetime.now(timezone.utc)
                        )
                        db.add(new_flood)
                        results.append(new_flood)
                    
                except Exception as e:
                    logger.error(f"Error updating flood monitoring for {weather.area_name}: {str(e)}")
            
            db.commit()
            logger.info(f"Successfully updated flood monitoring for {len(results)} locations")
            
            # Broadcast flood update via WebSocket
            await self.broadcast_flood_update(db, results)
            
        except Exception as e:
            logger.error(f"Error in flood monitoring update: {str(e)}")
            db.rollback()
        
        return results
    
    def _find_closest_barangay(self, lat: float, lon: float) -> Optional[str]:
        """Find the closest barangay to given coordinates"""
        min_distance = float('inf')
        closest_barangay = None
        
        for barangay in barangay_flood_service.barangays:
            # Simple distance calculation (Euclidean distance)
            distance = ((lat - barangay["lat"]) ** 2 + (lon - barangay["lon"]) ** 2) ** 0.5
            if distance < min_distance:
                min_distance = distance
                closest_barangay = barangay["name"]
        
        return closest_barangay
    
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
            
            # Get weather-related incidents (flooding type)
            from ..models.traffic import RoadIncident
            weather_incidents = db.query(RoadIncident).filter(
                RoadIncident.incident_type == "flooding",
                RoadIncident.is_active == True
            ).all()
            
            incident_data = []
            for incident in weather_incidents:
                incident_data.append({
                    "id": incident.id,
                    "incident_type": incident.incident_type,
                    "title": incident.title,
                    "description": incident.description,
                    "severity": incident.severity,
                    "latitude": incident.latitude,
                    "longitude": incident.longitude,
                    "is_active": incident.is_active,
                    "created_at": incident.created_at.isoformat() if incident.created_at else None
                })
            
            # Broadcast the update
            await manager.send_weather_update({
                "flood_data": flood_data,
                "weather_incidents": incident_data,
                "timestamp": datetime.now().isoformat(),
                "update_type": "flood_monitoring"
            })
            
            logger.info(f"Broadcasted flood update for {len(flood_data)} locations and {len(incident_data)} incidents")
            
        except Exception as e:
            logger.error(f"Error broadcasting flood update: {str(e)}")

# Global instance
weather_service = WeatherService()
