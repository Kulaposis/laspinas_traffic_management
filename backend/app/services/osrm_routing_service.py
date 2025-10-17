"""
OSRM Routing Service for accurate road-following routes.
Provides Google Maps-like route accuracy using OpenStreetMap data.
"""

import asyncio
import json
import logging
import math
from typing import Dict, List, Optional, Tuple
import requests
import polyline
from datetime import datetime

logger = logging.getLogger(__name__)

class OSRMRoutingService:
    def __init__(self):
        # Public OSRM demo server (for development)
        # In production, you should use your own OSRM instance
        self.osrm_base_url = "https://router.project-osrm.org"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'TrafficManagementSystem/1.0'
        })
        
        # Cache for route results
        self.route_cache = {}
        self.cache_duration = 300  # 5 minutes
        
    async def get_route(self, 
                       origin_lat: float, 
                       origin_lng: float, 
                       destination_lat: float, 
                       destination_lng: float,
                       profile: str = "driving",
                       alternatives: bool = True,
                       steps: bool = True,
                       geometries: str = "polyline") -> Dict:
        """
        Get route from OSRM with detailed geometry following actual roads.
        
        Args:
            origin_lat: Starting latitude
            origin_lng: Starting longitude
            destination_lat: Ending latitude
            destination_lng: Ending longitude
            profile: Routing profile (driving, walking, cycling)
            alternatives: Whether to return alternative routes
            steps: Whether to include turn-by-turn instructions
            geometries: Format for route geometry (polyline, geojson)
        """
        
        cache_key = f"{origin_lat}_{origin_lng}_{destination_lat}_{destination_lng}_{profile}"
        cached_result = self._get_cached_route(cache_key)
        if cached_result:
            return cached_result
            
        try:
            # Construct OSRM URL
            coordinates = f"{origin_lng},{origin_lat};{destination_lng},{destination_lat}"
            url = f"{self.osrm_base_url}/route/v1/{profile}/{coordinates}"
            
            params = {
                "alternatives": "true" if alternatives else "false",
                "steps": "true" if steps else "false", 
                "geometries": geometries,
                "overview": "full",
                "annotations": "true"
            }
            
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("code") != "Ok":
                raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
            
            # Process the routes
            processed_routes = self._process_osrm_routes(data)
            
            # Cache the result
            self._cache_route(cache_key, processed_routes)
            
            return processed_routes
            
        except requests.exceptions.RequestException as e:
            logger.error(f"OSRM request failed: {e}")
            # Fallback to simple straight line route
            return self._create_fallback_route(origin_lat, origin_lng, destination_lat, destination_lng)
        except Exception as e:
            logger.error(f"OSRM routing error: {e}")
            return self._create_fallback_route(origin_lat, origin_lng, destination_lat, destination_lng)
    
    def _process_osrm_routes(self, osrm_data: Dict) -> Dict:
        """Process OSRM response into our format."""
        
        routes = []
        
        for i, route in enumerate(osrm_data.get("routes", [])):
            # Decode polyline geometry to get detailed coordinates
            geometry = route.get("geometry", "")
            if geometry:
                coordinates = polyline.decode(geometry)
                # OSRM polyline.decode returns [(lat, lng), ...] - already in correct format
                route_coordinates = [[lat, lng] for lat, lng in coordinates]
            else:
                # Fallback if no geometry
                route_coordinates = []
            
            # Extract route information
            duration = route.get("duration", 0) / 60  # Convert to minutes
            distance = route.get("distance", 0) / 1000  # Convert to km
            
            # Extract steps for turn-by-turn directions
            steps = []
            if route.get("legs"):
                for leg in route["legs"]:
                    if leg.get("steps"):
                        for step in leg["steps"]:
                            step_data = {
                                "instruction": step.get("maneuver", {}).get("instruction", ""),
                                "name": step.get("name", ""),
                                "distance": step.get("distance", 0),
                                "duration": step.get("duration", 0),
                                "location": step.get("maneuver", {}).get("location", [])
                            }
                            steps.append(step_data)
            
            processed_route = {
                "route_id": f"osrm_route_{i}",
                "route_name": f"Route {i + 1}" if i > 0 else "Recommended Route",
                "route_type": "direct" if i == 0 else "alternative",
                "route_coordinates": route_coordinates,
                "distance_km": round(distance, 2),
                "estimated_duration_minutes": round(duration),
                "traffic_conditions": "unknown",  # Will be updated with traffic data
                "traffic_delays": 0,
                "incidents_on_route": 0,
                "route_quality": "primary" if i == 0 else "alternative",
                "confidence_level": "high",
                "advantages": self._determine_route_advantages(route, i),
                "disadvantages": self._determine_route_disadvantages(route, i),
                "steps": steps,
                "osrm_data": route  # Keep original data for reference
            }
            
            routes.append(processed_route)
        
        return {
            "routes": routes,
            "recommended_route": routes[0] if routes else None,
            "total_routes": len(routes),
            "source": "osrm",
            "generated_at": datetime.now().isoformat()
        }
    
    def _determine_route_advantages(self, route: Dict, index: int) -> List[str]:
        """Determine advantages of a route based on OSRM data."""
        advantages = []
        
        if index == 0:
            advantages.append("Fastest route")
            advantages.append("Most direct path")
        
        duration = route.get("duration", 0) / 60
        distance = route.get("distance", 0) / 1000
        
        if duration < 30:
            advantages.append("Quick journey")
        
        if distance < 10:
            advantages.append("Short distance")
        
        # Analyze road types from steps
        if route.get("legs"):
            highway_segments = 0
            total_segments = 0
            
            for leg in route["legs"]:
                if leg.get("steps"):
                    for step in leg["steps"]:
                        total_segments += 1
                        road_name = step.get("name", "").lower()
                        if any(keyword in road_name for keyword in ["highway", "expressway", "avenue"]):
                            highway_segments += 1
            
            if total_segments > 0 and highway_segments / total_segments > 0.5:
                advantages.append("Uses major roads")
        
        return advantages
    
    def _determine_route_disadvantages(self, route: Dict, index: int) -> List[str]:
        """Determine disadvantages of a route based on OSRM data."""
        disadvantages = []
        
        if index > 0:
            disadvantages.append("Alternative route")
        
        # Count turns from steps
        if route.get("legs"):
            turn_count = 0
            for leg in route["legs"]:
                if leg.get("steps"):
                    for step in leg["steps"]:
                        maneuver_type = step.get("maneuver", {}).get("type", "")
                        if maneuver_type in ["turn", "ramp", "merge"]:
                            turn_count += 1
            
            if turn_count > 10:
                disadvantages.append("Many turns required")
            elif turn_count > 5:
                disadvantages.append("Several turns")
        
        duration = route.get("duration", 0) / 60
        if duration > 45:
            disadvantages.append("Longer travel time")
        
        return disadvantages
    
    def _create_fallback_route(self, origin_lat: float, origin_lng: float, 
                             destination_lat: float, destination_lng: float) -> Dict:
        """Create a fallback straight-line route when OSRM fails."""
        
        # Calculate straight-line distance
        distance_km = self._calculate_distance(origin_lat, origin_lng, destination_lat, destination_lng)
        
        # Estimate duration (assuming 40 km/h average speed in city)
        duration_minutes = (distance_km / 40) * 60
        
        # Create simple straight line with intermediate points for better visualization
        coordinates = self._interpolate_coordinates(
            origin_lat, origin_lng, destination_lat, destination_lng, num_points=10
        )
        
        fallback_route = {
            "route_id": "fallback_route",
            "route_name": "Direct Route (Estimated)",
            "route_type": "direct",
            "route_coordinates": coordinates,
            "distance_km": round(distance_km, 2),
            "estimated_duration_minutes": round(duration_minutes),
            "traffic_conditions": "unknown",
            "traffic_delays": 0,
            "incidents_on_route": 0,
            "route_quality": "backup",
            "confidence_level": "low",
            "advantages": ["Direct path"],
            "disadvantages": ["Estimated route only", "May not follow roads"],
            "steps": [],
            "osrm_data": None
        }
        
        return {
            "routes": [fallback_route],
            "recommended_route": fallback_route,
            "total_routes": 1,
            "source": "fallback",
            "generated_at": datetime.now().isoformat()
        }
    
    def _interpolate_coordinates(self, lat1: float, lng1: float, lat2: float, lng2: float, 
                               num_points: int = 10) -> List[List[float]]:
        """Create interpolated points between two coordinates for smoother visualization."""
        coordinates = []
        
        for i in range(num_points + 1):
            ratio = i / num_points
            lat = lat1 + (lat2 - lat1) * ratio
            lng = lng1 + (lng2 - lng1) * ratio
            coordinates.append([lat, lng])
        
        return coordinates
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate great circle distance between two points in kilometers."""
        
        # Convert latitude and longitude from degrees to radians
        lat1, lng1, lat2, lng2 = map(math.radians, [lat1, lng1, lat2, lng2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        
        return c * r
    
    def _get_cached_route(self, cache_key: str) -> Optional[Dict]:
        """Get cached route if still valid."""
        if cache_key in self.route_cache:
            cached_data = self.route_cache[cache_key]
            if datetime.now().timestamp() - cached_data["timestamp"] < self.cache_duration:
                return cached_data["data"]
            else:
                # Remove expired cache entry
                del self.route_cache[cache_key]
        return None
    
    def _cache_route(self, cache_key: str, data: Dict):
        """Cache route data."""
        self.route_cache[cache_key] = {
            "data": data,
            "timestamp": datetime.now().timestamp()
        }
        
        # Clean up old cache entries (keep only last 100)
        if len(self.route_cache) > 100:
            oldest_key = min(self.route_cache.keys(), 
                           key=lambda k: self.route_cache[k]["timestamp"])
            del self.route_cache[oldest_key]
    
    async def get_multiple_routes(self, waypoints: List[Tuple[float, float]], 
                                profile: str = "driving") -> Dict:
        """Get routes for multiple waypoints."""
        
        if len(waypoints) < 2:
            raise ValueError("At least 2 waypoints required")
        
        try:
            # Format coordinates for OSRM
            coordinates_str = ";".join([f"{lng},{lat}" for lat, lng in waypoints])
            url = f"{self.osrm_base_url}/route/v1/{profile}/{coordinates_str}"
            
            params = {
                "alternatives": "false",  # Don't need alternatives for multi-waypoint
                "steps": "true",
                "geometries": "polyline",
                "overview": "full"
            }
            
            response = self.session.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("code") != "Ok":
                raise Exception(f"OSRM error: {data.get('message', 'Unknown error')}")
            
            return self._process_osrm_routes(data)
            
        except Exception as e:
            logger.error(f"Multi-waypoint routing error: {e}")
            # Create fallback multi-segment route
            return self._create_multi_waypoint_fallback(waypoints)
    
    def _create_multi_waypoint_fallback(self, waypoints: List[Tuple[float, float]]) -> Dict:
        """Create fallback route for multiple waypoints."""
        
        all_coordinates = []
        total_distance = 0
        total_duration = 0
        
        for i in range(len(waypoints) - 1):
            lat1, lng1 = waypoints[i]
            lat2, lng2 = waypoints[i + 1]
            
            # Add interpolated points between waypoints
            segment_coords = self._interpolate_coordinates(lat1, lng1, lat2, lng2, 5)
            
            # Remove duplicate points at segment boundaries
            if i > 0:
                segment_coords = segment_coords[1:]
            
            all_coordinates.extend(segment_coords)
            
            # Calculate segment distance and duration
            segment_distance = self._calculate_distance(lat1, lng1, lat2, lng2)
            segment_duration = (segment_distance / 40) * 60  # 40 km/h average
            
            total_distance += segment_distance
            total_duration += segment_duration
        
        fallback_route = {
            "route_id": "multi_waypoint_fallback",
            "route_name": f"Multi-stop Route ({len(waypoints)} stops)",
            "route_type": "multi_waypoint",
            "route_coordinates": all_coordinates,
            "distance_km": round(total_distance, 2),
            "estimated_duration_minutes": round(total_duration),
            "traffic_conditions": "unknown",
            "traffic_delays": 0,
            "incidents_on_route": 0,
            "route_quality": "backup",
            "confidence_level": "low",
            "advantages": ["Covers all waypoints"],
            "disadvantages": ["Estimated route", "May not follow roads"],
            "steps": [],
            "osrm_data": None
        }
        
        return {
            "routes": [fallback_route],
            "recommended_route": fallback_route,
            "total_routes": 1,
            "source": "multi_waypoint_fallback",
            "generated_at": datetime.now().isoformat()
        }
    
    def clear_cache(self):
        """Clear the route cache."""
        self.route_cache.clear()
    
    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        return {
            "cache_size": len(self.route_cache),
            "cache_duration": self.cache_duration,
            "oldest_entry": min([data["timestamp"] for data in self.route_cache.values()]) if self.route_cache else None,
            "newest_entry": max([data["timestamp"] for data in self.route_cache.values()]) if self.route_cache else None
        }
