"""
Real-time Traffic Service using TomTom API with fallback to traffic generator
"""

import httpx
import asyncio
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models.traffic import TrafficMonitoring, TrafficStatus, RoadType
from ..websocket import manager
from .traffic_generator_service import traffic_generator

logger = logging.getLogger(__name__)

class RealTrafficService:
    def __init__(self):
        import os
        
        # TomTom API configuration
        self.tomtom_api_key = os.getenv("TOMTOM_API_KEY", "nawcMJzWJ4arsNUPa9E7i0MSp0ZwJZ0y")
        self.tomtom_base_url = "https://api.tomtom.com/traffic/services/4"
        
        # HERE API configuration
        self.here_api_key = os.getenv("HERE_API_KEY") or os.getenv("VITE_HERE_API_KEY")
        self.here_base_url = "https://data.traffic.hereapi.com/v7"
        self.here_legacy_url = "https://traffic.ls.hereapi.com/traffic/6.3"
        
        self.timeout = 30.0
        self.max_retries = 3
        
        # Las Piñas City monitoring points covering all 20 barangays
        self.monitoring_points = [
            # Almanza Uno
            {"name": "Alabang-Zapote Road (Almanza Uno)", "lat": 14.4504, "lng": 121.0170, "type": RoadType.HIGHWAY, "barangay": "Almanza Uno"},
            {"name": "Almanza Road", "lat": 14.4350, "lng": 121.0100, "type": RoadType.MAIN_ROAD, "barangay": "Almanza Uno"},
            {"name": "BF Almanza Bridge", "lat": 14.4320, "lng": 121.0080, "type": RoadType.BRIDGE, "barangay": "Almanza Uno"},
            
            # Almanza Dos
            {"name": "Alabang-Zapote Road (Almanza Dos)", "lat": 14.4480, "lng": 121.0150, "type": RoadType.HIGHWAY, "barangay": "Almanza Dos"},
            {"name": "Almanza Dos Road", "lat": 14.4420, "lng": 121.0120, "type": RoadType.MAIN_ROAD, "barangay": "Almanza Dos"},
            
            # B.F. International Village
            {"name": "BF International Road", "lat": 14.4400, "lng": 121.0200, "type": RoadType.MAIN_ROAD, "barangay": "B.F. International Village"},
            {"name": "BF Resort Drive", "lat": 14.4380, "lng": 121.0180, "type": RoadType.RESIDENTIAL, "barangay": "B.F. International Village"},
            
            # CAA
            {"name": "CAA Road", "lat": 14.4450, "lng": 121.0250, "type": RoadType.MAIN_ROAD, "barangay": "CAA"},
            {"name": "CAA-BF Road", "lat": 14.4430, "lng": 121.0220, "type": RoadType.SIDE_STREET, "barangay": "CAA"},
            
            # Daniel Fajardo
            {"name": "Daniel Fajardo Road", "lat": 14.4600, "lng": 121.0150, "type": RoadType.MAIN_ROAD, "barangay": "Daniel Fajardo"},
            {"name": "C-5 Road Extension", "lat": 14.4620, "lng": 121.0130, "type": RoadType.HIGHWAY, "barangay": "Daniel Fajardo"},
            
            # Elias Aldana
            {"name": "Elias Aldana Road", "lat": 14.4550, "lng": 121.0180, "type": RoadType.MAIN_ROAD, "barangay": "Elias Aldana"},
            {"name": "Real Street", "lat": 14.4530, "lng": 121.0160, "type": RoadType.SIDE_STREET, "barangay": "Elias Aldana"},
            
            # Ilaya
            {"name": "Ilaya Road", "lat": 14.4380, "lng": 121.0220, "type": RoadType.MAIN_ROAD, "barangay": "Ilaya"},
            {"name": "Niog Road", "lat": 14.4360, "lng": 121.0200, "type": RoadType.SIDE_STREET, "barangay": "Ilaya"},
            
            # Manuyo Uno
            {"name": "Manuyo Uno Road", "lat": 14.4520, "lng": 121.0130, "type": RoadType.MAIN_ROAD, "barangay": "Manuyo Uno"},
            {"name": "Manuyo Bridge", "lat": 14.4500, "lng": 121.0110, "type": RoadType.BRIDGE, "barangay": "Manuyo Uno"},
            
            # Manuyo Dos
            {"name": "Manuyo Dos Road", "lat": 14.4480, "lng": 121.0100, "type": RoadType.MAIN_ROAD, "barangay": "Manuyo Dos"},
            {"name": "Manuyo Dos Street", "lat": 14.4460, "lng": 121.0080, "type": RoadType.RESIDENTIAL, "barangay": "Manuyo Dos"},
            
            # Pamplona Uno
            {"name": "Pamplona Uno Road", "lat": 14.4470, "lng": 121.0280, "type": RoadType.MAIN_ROAD, "barangay": "Pamplona Uno"},
            {"name": "Pamplona Bridge", "lat": 14.4450, "lng": 121.0260, "type": RoadType.BRIDGE, "barangay": "Pamplona Uno"},
            
            # Pamplona Dos
            {"name": "Pamplona Dos Road", "lat": 14.4430, "lng": 121.0300, "type": RoadType.MAIN_ROAD, "barangay": "Pamplona Dos"},
            {"name": "Pamplona Dos Street", "lat": 14.4410, "lng": 121.0320, "type": RoadType.RESIDENTIAL, "barangay": "Pamplona Dos"},
            
            # Pamplona Tres
            {"name": "Pamplona Tres Road", "lat": 14.4390, "lng": 121.0340, "type": RoadType.MAIN_ROAD, "barangay": "Pamplona Tres"},
            {"name": "Pamplona Tres Street", "lat": 14.4370, "lng": 121.0360, "type": RoadType.RESIDENTIAL, "barangay": "Pamplona Tres"},
            
            # Pilar
            {"name": "Pilar Road", "lat": 14.4350, "lng": 121.0380, "type": RoadType.MAIN_ROAD, "barangay": "Pilar"},
            {"name": "Pilar Village Road", "lat": 14.4330, "lng": 121.0400, "type": RoadType.RESIDENTIAL, "barangay": "Pilar"},
            
            # Pulang Lupa Uno
            {"name": "Pulang Lupa Uno Road", "lat": 14.4310, "lng": 121.0420, "type": RoadType.MAIN_ROAD, "barangay": "Pulang Lupa Uno"},
            {"name": "Pulang Lupa Bridge", "lat": 14.4290, "lng": 121.0440, "type": RoadType.BRIDGE, "barangay": "Pulang Lupa Uno"},
            
            # Pulang Lupa Dos
            {"name": "Pulang Lupa Dos Road", "lat": 14.4270, "lng": 121.0460, "type": RoadType.MAIN_ROAD, "barangay": "Pulang Lupa Dos"},
            {"name": "Pulang Lupa Dos Street", "lat": 14.4250, "lng": 121.0480, "type": RoadType.RESIDENTIAL, "barangay": "Pulang Lupa Dos"},
            
            # Talon Uno
            {"name": "Talon Uno Road", "lat": 14.4520, "lng": 121.0130, "type": RoadType.MAIN_ROAD, "barangay": "Talon Uno"},
            {"name": "Talon Road", "lat": 14.4500, "lng": 121.0110, "type": RoadType.RESIDENTIAL, "barangay": "Talon Uno"},
            
            # Talon Dos
            {"name": "Talon Dos Road", "lat": 14.4480, "lng": 121.0090, "type": RoadType.MAIN_ROAD, "barangay": "Talon Dos"},
            {"name": "Talon Dos Street", "lat": 14.4460, "lng": 121.0070, "type": RoadType.RESIDENTIAL, "barangay": "Talon Dos"},
            
            # Talon Tres
            {"name": "Talon Tres Road", "lat": 14.4440, "lng": 121.0050, "type": RoadType.MAIN_ROAD, "barangay": "Talon Tres"},
            {"name": "Talon Tres Street", "lat": 14.4420, "lng": 121.0030, "type": RoadType.RESIDENTIAL, "barangay": "Talon Tres"},
            
            # Talon Kuatro
            {"name": "Talon Kuatro Road", "lat": 14.4400, "lng": 121.0010, "type": RoadType.MAIN_ROAD, "barangay": "Talon Kuatro"},
            {"name": "Talon Kuatro Street", "lat": 14.4380, "lng": 120.9990, "type": RoadType.RESIDENTIAL, "barangay": "Talon Kuatro"},
            
            # Talon Singko
            {"name": "Talon Singko Road", "lat": 14.4360, "lng": 120.9970, "type": RoadType.MAIN_ROAD, "barangay": "Talon Singko"},
            {"name": "Talon Singko Street", "lat": 14.4340, "lng": 120.9950, "type": RoadType.RESIDENTIAL, "barangay": "Talon Singko"},
            
            # Zapote
            {"name": "Zapote Road", "lat": 14.4320, "lng": 120.9930, "type": RoadType.MAIN_ROAD, "barangay": "Zapote"},
            {"name": "Zapote Bridge", "lat": 14.4300, "lng": 120.9910, "type": RoadType.BRIDGE, "barangay": "Zapote"},
            {"name": "Westservice Road", "lat": 14.4280, "lng": 120.9890, "type": RoadType.HIGHWAY, "barangay": "Zapote"}
        ]
        
        # API availability tracking
        self.tomtom_available = True
        self.here_available = True if self.here_api_key else False
        self.last_api_check = None
        self.tomtom_consecutive_failures = 0
        self.here_consecutive_failures = 0
        self.max_consecutive_failures = 5
    
    async def check_api_availability(self) -> bool:
        """Check if APIs (TomTom and HERE) are available"""
        tomtom_ok = False
        here_ok = False
        
        # Check TomTom API
        try:
            params = {
                "key": self.tomtom_api_key,
                "point": "14.4504,121.0170",  # Las Piñas coordinates
                "radius": 1000
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.tomtom_base_url}/flowSegmentData/absolute/10/json",
                    params=params
                )
                
                if response.status_code == 200:
                    self.tomtom_available = True
                    self.tomtom_consecutive_failures = 0
                    tomtom_ok = True
                    logger.info("TomTom API is available")
                else:
                    logger.warning(f"TomTom API returned status {response.status_code}")
                    
        except Exception as e:
            logger.error(f"TomTom API health check failed: {str(e)}")
            self.tomtom_consecutive_failures += 1
            
            if self.tomtom_consecutive_failures >= self.max_consecutive_failures:
                self.tomtom_available = False
                logger.warning("TomTom API marked as unavailable after consecutive failures")
        
        # Check HERE API if key is configured
        if self.here_api_key:
            try:
                # Use HERE Traffic Flow API v7
                params = {
                    "apiKey": self.here_api_key,
                    "locationReferencing": "shape",
                    "in": "circle:14.4504,121.0170;r=1000"  # Las Piñas coordinates, 1km radius
                }
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        f"{self.here_base_url}/flow",
                        params=params
                    )
                    
                    if response.status_code == 200:
                        self.here_available = True
                        self.here_consecutive_failures = 0
                        here_ok = True
                        logger.info("HERE API is available")
                    else:
                        logger.warning(f"HERE API returned status {response.status_code}")
                        
            except Exception as e:
                logger.error(f"HERE API health check failed: {str(e)}")
                self.here_consecutive_failures += 1
                
                if self.here_consecutive_failures >= self.max_consecutive_failures:
                    self.here_available = False
                    logger.warning("HERE API marked as unavailable after consecutive failures")
        
        return tomtom_ok or here_ok
    
    async def fetch_traffic_data_from_tomtom(self, lat: float, lng: float) -> Optional[Dict]:
        """Fetch real traffic data from TomTom API"""
        try:
            params = {
                "key": self.tomtom_api_key,
                "point": f"{lat},{lng}",
                "radius": 1000,
                "unit": "KMPH"
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.tomtom_base_url}/flowSegmentData/absolute/10/json",
                    params=params
                )
                response.raise_for_status()
                data = response.json()
                
                logger.debug(f"TomTom API response for {lat},{lng}: {data}")
                return data
                
        except httpx.HTTPStatusError as e:
            logger.error(f"TomTom API HTTP error: {e.response.status_code} - {e.response.text}")
            self.tomtom_consecutive_failures += 1
            if self.tomtom_consecutive_failures >= self.max_consecutive_failures:
                self.tomtom_available = False
            return None
        except httpx.TimeoutException:
            logger.error("TomTom API request timed out")
            self.tomtom_consecutive_failures += 1
            return None
        except Exception as e:
            logger.error(f"Error fetching traffic data from TomTom: {str(e)}")
            self.tomtom_consecutive_failures += 1
            return None
    
    async def fetch_traffic_data_from_here(self, lat: float, lng: float) -> Optional[Dict]:
        """Fetch real traffic data from HERE API"""
        if not self.here_api_key:
            return None
            
        try:
            # Use HERE Traffic Flow API v7
            params = {
                "apiKey": self.here_api_key,
                "locationReferencing": "shape",
                "in": f"circle:{lat},{lng};r=1000"  # 1km radius
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.here_base_url}/flow",
                    params=params
                )
                response.raise_for_status()
                data = response.json()
                
                logger.debug(f"HERE API response for {lat},{lng}: {data}")
                return data
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HERE API HTTP error: {e.response.status_code} - {e.response.text}")
            self.here_consecutive_failures += 1
            if self.here_consecutive_failures >= self.max_consecutive_failures:
                self.here_available = False
            return None
        except httpx.TimeoutException:
            logger.error("HERE API request timed out")
            self.here_consecutive_failures += 1
            return None
        except Exception as e:
            logger.error(f"Error fetching traffic data from HERE: {str(e)}")
            self.here_consecutive_failures += 1
            return None
    
    def parse_tomtom_response(self, api_data: Dict, road_info: Dict) -> Dict:
        """Parse TomTom API response into our traffic model format"""
        try:
            flow_segment_data = api_data.get("flowSegmentData", {})
            
            current_speed = flow_segment_data.get("currentSpeed", 0)
            free_flow_speed = flow_segment_data.get("freeFlowSpeed", 0)
            confidence = flow_segment_data.get("confidence", 0)
            
            # Calculate congestion percentage
            if free_flow_speed > 0 and current_speed > 0:
                congestion_pct = max(0, (1 - (current_speed / free_flow_speed)) * 100)
            else:
                # Fallback calculation based on speed alone
                if current_speed < 10:
                    congestion_pct = 80
                elif current_speed < 20:
                    congestion_pct = 60
                elif current_speed < 30:
                    congestion_pct = 40
                elif current_speed < 40:
                    congestion_pct = 20
                else:
                    congestion_pct = 10
            
            # Determine traffic status based on congestion
            if congestion_pct < 20:
                status = TrafficStatus.FREE_FLOW
            elif congestion_pct < 40:
                status = TrafficStatus.LIGHT
            elif congestion_pct < 60:
                status = TrafficStatus.MODERATE
            elif congestion_pct < 80:
                status = TrafficStatus.HEAVY
            else:
                status = TrafficStatus.STANDSTILL
            
            # Estimate vehicle count based on congestion and road type
            base_vehicle_count = {
                RoadType.HIGHWAY: 100,
                RoadType.MAIN_ROAD: 50,
                RoadType.SIDE_STREET: 20,
                RoadType.RESIDENTIAL: 10,
                RoadType.BRIDGE: 30
            }.get(road_info["type"], 20)
            
            vehicle_count = int(base_vehicle_count * (congestion_pct / 100))
            
            # Calculate travel time based on speed and road length
            road_length = flow_segment_data.get("length", 1.0)  # km
            if current_speed > 0:
                travel_time = (road_length / current_speed) * 60  # minutes
            else:
                travel_time = road_length * 2  # fallback: 2 min per km
            
            return {
                "traffic_status": status,
                "congestion_percentage": round(congestion_pct, 1),
                "average_speed_kmh": current_speed,
                "vehicle_count": vehicle_count,
                "estimated_travel_time": round(travel_time, 1),
                "road_segment_length": road_length,
                "confidence_score": confidence,
                "data_source": "tomtom_api"
            }
            
        except Exception as e:
            logger.error(f"Error parsing TomTom response: {str(e)}")
            return self.get_fallback_data(road_info)
    
    def parse_here_response(self, api_data: Dict, road_info: Dict) -> Dict:
        """Parse HERE API response into our traffic model format"""
        try:
            # HERE API v7 response structure
            results = api_data.get("results", [])
            if not results:
                return self.get_fallback_data(road_info)
            
            # Get the first result (closest to our point)
            result = results[0]
            location = result.get("location", {})
            current_flow = result.get("currentFlow", {})
            
            # Extract speed information
            speed = current_flow.get("speed", {})
            current_speed = speed.get("value", 0)  # m/s, convert to km/h
            free_flow_speed = speed.get("freeFlow", {}).get("value", 0)  # m/s
            
            # Convert from m/s to km/h
            current_speed_kmh = current_speed * 3.6 if current_speed > 0 else 0
            free_flow_speed_kmh = free_flow_speed * 3.6 if free_flow_speed > 0 else 0
            
            # Get jam factor (0-10, where 10 is heavy congestion)
            jam_factor = current_flow.get("jamFactor", 0)
            
            # Calculate congestion percentage from jam factor (0-10 scale to 0-100%)
            congestion_pct = (jam_factor / 10.0) * 100 if jam_factor > 0 else 0
            
            # If we have speed data, use it for more accurate congestion calculation
            if free_flow_speed_kmh > 0 and current_speed_kmh > 0:
                congestion_pct = max(0, (1 - (current_speed_kmh / free_flow_speed_kmh)) * 100)
            
            # Determine traffic status based on congestion
            if congestion_pct < 20:
                status = TrafficStatus.FREE_FLOW
            elif congestion_pct < 40:
                status = TrafficStatus.LIGHT
            elif congestion_pct < 60:
                status = TrafficStatus.MODERATE
            elif congestion_pct < 80:
                status = TrafficStatus.HEAVY
            else:
                status = TrafficStatus.STANDSTILL
            
            # Estimate vehicle count based on congestion and road type
            base_vehicle_count = {
                RoadType.HIGHWAY: 100,
                RoadType.MAIN_ROAD: 50,
                RoadType.SIDE_STREET: 20,
                RoadType.RESIDENTIAL: 10,
                RoadType.BRIDGE: 30
            }.get(road_info["type"], 20)
            
            vehicle_count = int(base_vehicle_count * (congestion_pct / 100))
            
            # Get road length from shape or estimate
            shape = location.get("shape", {})
            road_length = shape.get("length", 1.0) / 1000.0 if shape.get("length") else 1.0  # Convert m to km
            
            # Calculate travel time
            if current_speed_kmh > 0:
                travel_time = (road_length / current_speed_kmh) * 60  # minutes
            else:
                travel_time = road_length * 2  # fallback: 2 min per km
            
            # Confidence from jam factor reliability
            confidence = current_flow.get("confidence", 0.8)
            
            return {
                "traffic_status": status,
                "congestion_percentage": round(congestion_pct, 1),
                "average_speed_kmh": round(current_speed_kmh, 2),
                "vehicle_count": vehicle_count,
                "estimated_travel_time": round(travel_time, 1),
                "road_segment_length": round(road_length, 2),
                "confidence_score": confidence,
                "data_source": "here_api"
            }
            
        except Exception as e:
            logger.error(f"Error parsing HERE response: {str(e)}")
            return self.get_fallback_data(road_info)
    
    def get_fallback_data(self, road_info: Dict) -> Dict:
        """Generate fallback traffic data when API fails"""
        logger.warning(f"Using fallback data for {road_info['name']}")
        
        # Use traffic generator logic for fallback
        time_multiplier = traffic_generator.get_time_based_traffic_multiplier()
        status, congestion_pct, avg_speed = traffic_generator.generate_traffic_status(
            road_info["type"], time_multiplier
        )
        
        return {
            "traffic_status": status,
            "congestion_percentage": congestion_pct,
            "average_speed_kmh": avg_speed,
            "vehicle_count": int(congestion_pct * 1.2),
            "estimated_travel_time": 5.0,
            "road_segment_length": 1.0,
            "confidence_score": 0.5,
            "data_source": "fallback_generator"
        }
    
    def _normalize_road_type(self, road_type_value):
        """Ensure road type is always a RoadType enum (accepts enum or string)."""
        if isinstance(road_type_value, RoadType):
            return road_type_value
        if isinstance(road_type_value, str):
            normalized = road_type_value.strip().upper()
            try:
                return RoadType[normalized]
            except KeyError:
                logger.warning(f"Unknown road type '{road_type_value}', defaulting to MAIN_ROAD")
                return RoadType.MAIN_ROAD
        logger.warning(f"Unexpected road type value '{road_type_value}', defaulting to MAIN_ROAD")
        return RoadType.MAIN_ROAD

    async def update_traffic_record(self, db: Session, road_info: Dict, traffic_data: Dict):
        """Update or create traffic monitoring record"""
        try:
            road_type_enum = self._normalize_road_type(road_info.get("type"))

            # Check if record exists
            existing_traffic = db.query(TrafficMonitoring).filter(
                TrafficMonitoring.road_name == road_info["name"]
            ).first()
            
            if existing_traffic:
                # Update existing record
                existing_traffic.road_type = road_type_enum
                existing_traffic.traffic_status = traffic_data["traffic_status"]
                existing_traffic.congestion_percentage = traffic_data["congestion_percentage"]
                existing_traffic.average_speed_kmh = traffic_data["average_speed_kmh"]
                existing_traffic.vehicle_count = traffic_data["vehicle_count"]
                existing_traffic.estimated_travel_time = traffic_data["estimated_travel_time"]
                existing_traffic.road_segment_length = traffic_data["road_segment_length"]
                existing_traffic.barangay = road_info["barangay"]
                existing_traffic.data_source = traffic_data["data_source"]
                existing_traffic.confidence_score = traffic_data["confidence_score"]
                existing_traffic.last_updated = datetime.now(timezone.utc)
                    
            else:
                # Create new record
                new_traffic = TrafficMonitoring(
                    road_name=road_info["name"],
                    road_type=road_type_enum,
                    latitude=road_info["lat"],
                    longitude=road_info["lng"],
                    barangay=road_info["barangay"],
                    traffic_status=traffic_data["traffic_status"],
                    congestion_percentage=traffic_data["congestion_percentage"],
                    average_speed_kmh=traffic_data["average_speed_kmh"],
                    vehicle_count=traffic_data["vehicle_count"],
                    estimated_travel_time=traffic_data["estimated_travel_time"],
                    road_segment_length=traffic_data["road_segment_length"],
                    data_source=traffic_data["data_source"],
                    confidence_score=traffic_data["confidence_score"],
                    last_updated=datetime.now(timezone.utc)
                )
                    
                db.add(new_traffic)
            
            logger.info(f"Updated traffic data for {road_info['name']}: {traffic_data['data_source']} - Status: {traffic_data['traffic_status'].value}, Speed: {traffic_data['average_speed_kmh']}km/h")
            
        except Exception as e:
            logger.error(f"Error updating traffic record for {road_info['name']}: {str(e)}")
            raise
    
    async def update_traffic_data(self, db: Session):
        """Update traffic data using TomTom and HERE APIs with fallback to generator"""
        try:
            logger.info("Starting real-time traffic data update")
            
            # Check API availability periodically
            if (self.last_api_check is None or 
                (datetime.now() - self.last_api_check).seconds > 300):  # Check every 5 minutes
                await self.check_api_availability()
                self.last_api_check = datetime.now()
            
            successful_updates = 0
            failed_updates = 0
            
            for road_info in self.monitoring_points:
                try:
                    traffic_data = None
                    api_used = None
                    
                    # Try TomTom API first if available
                    if self.tomtom_available:
                        api_data = await self.fetch_traffic_data_from_tomtom(
                            road_info["lat"], road_info["lng"]
                        )
                        
                        if api_data and "flowSegmentData" in api_data:
                            traffic_data = self.parse_tomtom_response(api_data, road_info)
                            api_used = "tomtom"
                            successful_updates += 1
                    
                    # If TomTom failed or unavailable, try HERE API
                    if not traffic_data and self.here_available and self.here_api_key:
                        api_data = await self.fetch_traffic_data_from_here(
                            road_info["lat"], road_info["lng"]
                        )
                        
                        if api_data and "results" in api_data and len(api_data["results"]) > 0:
                            traffic_data = self.parse_here_response(api_data, road_info)
                            api_used = "here"
                            successful_updates += 1
                    
                    # If both APIs failed, use fallback
                    if not traffic_data:
                        traffic_data = self.get_fallback_data(road_info)
                        api_used = "fallback"
                        failed_updates += 1
                    
                    # Update database record
                    await self.update_traffic_record(db, road_info, traffic_data)
                    
                except Exception as e:
                    logger.error(f"Error processing {road_info['name']}: {str(e)}")
                    # Use fallback data for this road
                    traffic_data = self.get_fallback_data(road_info)
                    await self.update_traffic_record(db, road_info, traffic_data)
                    failed_updates += 1
            
            db.commit()
            
            # Broadcast heatmap update
            await self.broadcast_heatmap_update(db)
            
            logger.info(f"Traffic update completed: {successful_updates} from APIs (TomTom/HERE), {failed_updates} fallback")
            
        except Exception as e:
            logger.error(f"Error in traffic data update: {str(e)}")
            db.rollback()
            raise
    
    async def broadcast_heatmap_update(self, db: Session):
        """Broadcast traffic heatmap update via WebSocket"""
        try:
            # Get all traffic data
            traffic_data = db.query(TrafficMonitoring).all()
            
            heatmap_data = []
            for traffic in traffic_data:
                # Map traffic status to intensity
                intensity_map = {
                    TrafficStatus.FREE_FLOW: 0.2,
                    TrafficStatus.LIGHT: 0.4,
                    TrafficStatus.MODERATE: 0.6,
                    TrafficStatus.HEAVY: 0.8,
                    TrafficStatus.STANDSTILL: 1.0
                }
                
                intensity = intensity_map.get(traffic.traffic_status, 0.2)
                
                heatmap_data.append({
                    "lat": traffic.latitude,
                    "lng": traffic.longitude,
                    "intensity": intensity,
                    "road_name": traffic.road_name,
                    "status": traffic.traffic_status.value,
                    "barangay": traffic.barangay,
                    "vehicle_count": traffic.vehicle_count,
                    "congestion_percentage": traffic.congestion_percentage,
                    "data_source": getattr(traffic, 'data_source', 'unknown')
                })
            
            # Broadcast the update
            api_status = "available" if (self.tomtom_available or self.here_available) else "unavailable"
            await manager.send_traffic_heatmap_update({
                "heatmap_data": heatmap_data,
                "timestamp": datetime.now().isoformat(),
                "api_status": api_status,
                "api_providers": {
                    "tomtom": self.tomtom_available,
                    "here": self.here_available
                },
                "bounds": {
                    "lat_min": 14.4200,
                    "lat_max": 14.4700,
                    "lng_min": 120.9800,
                    "lng_max": 121.0500
                }
            })
            
            logger.info(f"Broadcasted traffic heatmap update for {len(heatmap_data)} locations")
            
        except Exception as e:
            logger.error(f"Error broadcasting heatmap update: {str(e)}")
    
    def get_api_status(self) -> Dict:
        """Get current API status information"""
        return {
            "tomtom_available": self.tomtom_available,
            "here_available": self.here_available,
            "tomtom_consecutive_failures": self.tomtom_consecutive_failures,
            "here_consecutive_failures": self.here_consecutive_failures,
            "last_check": self.last_api_check.isoformat() if self.last_api_check else None,
            "providers": {
                "tomtom": {
                    "available": self.tomtom_available,
                    "failures": self.tomtom_consecutive_failures
                },
                "here": {
                    "available": self.here_available,
                    "configured": bool(self.here_api_key),
                    "failures": self.here_consecutive_failures
                }
            }
        }

# Global instance
real_traffic_service = RealTrafficService()
