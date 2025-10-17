"""
Smart Routing Service for Traffic Management System.
Provides intelligent route suggestions based on real-time traffic conditions,
similar to Google Maps functionality.
"""

import math
import random
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..models.traffic import TrafficMonitoring, TrafficStatus, RoadIncident, RouteAlternative
from .osrm_routing_service import OSRMRoutingService
from ..models.weather import WeatherData


class SmartRoutingService:
    def __init__(self):
        self.route_cache = {}
        self.cache_duration = 180  # 3 minutes cache for routes
        self.osrm_service = OSRMRoutingService()
        
        # Las Piñas real road network with accurate GPS coordinates
        self.las_pinas_network = {
            "major_roads": {
                "Alabang-Zapote Road": {
                    "coordinates": [
                        [14.4328, 121.0102], [14.4350, 121.0120], [14.4380, 121.0140], 
                        [14.4420, 121.0160], [14.4450, 121.0175], [14.4480, 121.0190]
                    ],
                    "type": "highway",
                    "capacity": "high",
                    "alternatives": ["CAA Road", "Westservice Road"]
                },
                "Westservice Road": {
                    "coordinates": [
                        [14.4400, 121.0200], [14.4420, 121.0215], [14.4440, 121.0230], 
                        [14.4470, 121.0240], [14.4500, 121.0250]
                    ],
                    "type": "highway", 
                    "capacity": "high",
                    "alternatives": ["C-5 Extension", "Almanza Road"]
                },
                "C-5 Extension": {
                    "coordinates": [
                        [14.4600, 121.0150], [14.4620, 121.0160], [14.4650, 121.0165], 
                        [14.4680, 121.0175], [14.4700, 121.0180]
                    ],
                    "type": "highway",
                    "capacity": "medium",
                    "alternatives": ["Real Street", "Westservice Road"]
                },
                "Almanza Road": {
                    "coordinates": [
                        [14.4350, 121.0100], [14.4370, 121.0110], [14.4400, 121.0120], 
                        [14.4425, 121.0125], [14.4450, 121.0130]
                    ],
                    "type": "main_road",
                    "capacity": "medium",
                    "alternatives": ["Niog Road", "Talon Road"]
                },
                "CAA Road": {
                    "coordinates": [
                        [14.4450, 121.0250], [14.4470, 121.0260], [14.4500, 121.0270], 
                        [14.4525, 121.0275], [14.4550, 121.0280]
                    ],
                    "type": "main_road",
                    "capacity": "medium",
                    "alternatives": ["Pamplona Road", "Real Street"]
                },
                "Real Street": {
                    "coordinates": [
                        [14.4520, 121.0140], [14.4540, 121.0150], [14.4560, 121.0160], 
                        [14.4580, 121.0165], [14.4600, 121.0170]
                    ],
                    "type": "main_road",
                    "capacity": "medium",
                    "alternatives": ["C-5 Extension", "Niog Road"]
                },
                "Niog Road": {
                    "coordinates": [
                        [14.4380, 121.0200], [14.4400, 121.0210], [14.4420, 121.0220], 
                        [14.4440, 121.0225], [14.4460, 121.0230]
                    ],
                    "type": "local_road",
                    "capacity": "low",
                    "alternatives": ["Almanza Road", "Talon Road"]
                }
            },
            "landmarks": {
                "SM Southmall": {
                    "coordinates": [14.433348864026852, 121.0105438052383],
                    "type": "shopping_mall",
                    "address": "Alabang-Zapote Road, Pilar Village, Almanza Uno, Las Piñas"
                },
                "Las Piñas City Hall": {
                    "coordinates": [14.4464, 121.0121],
                    "type": "government",
                    "address": "Rizal Avenue, Las Piñas City"
                },
                "BF Homes Las Piñas": {
                    "coordinates": [14.4504, 121.0170],
                    "type": "residential",
                    "address": "BF Homes, Las Piñas City"
                },
                "Perpetual Help Medical Center Las Piñas": {
                    "coordinates": [14.451834519987528, 120.98532866926787],
                    "type": "hospital",
                    "address": "Alabang-Zapote Road, Las Piñas City"
                },
                "Festival Mall Alabang": {
                    "coordinates": [14.4186, 121.0391],
                    "type": "shopping_mall",
                    "address": "Corporate Avenue, Alabang, Muntinlupa"
                }
            },
            "intersections": {
                "Alabang-Zapote x Westservice": [14.4450, 121.0185],
                "CAA x Almanza": [14.4400, 121.0175],
                "C-5 x Real Street": [14.4650, 121.0165],
                "Westservice x Niog": [14.4425, 121.0225],
                "SM Southmall Junction": [14.433348864026852, 121.0105438052383]
            }
        }
    
    def _detect_landmark(self, lat: float, lng: float, threshold: float = 0.003) -> Optional[Dict]:
        """Detect if coordinates are close to a known landmark and return exact landmark data."""
        for landmark_name, landmark_data in self.las_pinas_network["landmarks"].items():
            landmark_coords = landmark_data["coordinates"]
            distance = self._calculate_distance(lat, lng, landmark_coords[0], landmark_coords[1])
            
            # If within threshold (approximately 200m), use exact landmark coordinates
            if distance <= threshold:
                return {
                    "name": landmark_name,
                    "exact_coordinates": landmark_coords,
                    "type": landmark_data["type"],
                    "address": landmark_data["address"],
                    "distance_from_input": distance
                }
        return None
    
    async def get_smart_route_suggestions(self, origin_lat: float, origin_lng: float,
                                        destination_lat: float, destination_lng: float,
                                        db: Session, avoid_traffic: bool = True) -> Dict:
        """Get smart route suggestions based on real-time traffic conditions using OSRM for accurate routes."""
        
        # Detect landmarks and use exact coordinates
        origin_landmark = self._detect_landmark(origin_lat, origin_lng)
        destination_landmark = self._detect_landmark(destination_lat, destination_lng)
        
        # Use exact landmark coordinates if detected
        actual_origin_lat = origin_landmark["exact_coordinates"][0] if origin_landmark else origin_lat
        actual_origin_lng = origin_landmark["exact_coordinates"][1] if origin_landmark else origin_lng
        actual_dest_lat = destination_landmark["exact_coordinates"][0] if destination_landmark else destination_lat
        actual_dest_lng = destination_landmark["exact_coordinates"][1] if destination_landmark else destination_lng
        
        cache_key = f"route_{actual_origin_lat}_{actual_origin_lng}_{actual_dest_lat}_{actual_dest_lng}_{avoid_traffic}"
        current_time = datetime.now()
        
        # Check cache
        if cache_key in self.route_cache:
            cached_time, cached_data = self.route_cache[cache_key]
            if (current_time - cached_time).seconds < self.cache_duration:
                return cached_data
        
        # Get current traffic conditions
        traffic_data = db.query(TrafficMonitoring).all()
        active_incidents = db.query(RoadIncident).filter(RoadIncident.is_active == True).all()
        
        try:
            # Get accurate routes from OSRM using corrected landmark coordinates
            osrm_routes = await self.osrm_service.get_route(
                actual_origin_lat, actual_origin_lng, actual_dest_lat, actual_dest_lng,
                profile="driving",
                alternatives=True,
                steps=True
            )
            
            # Enhance OSRM routes with traffic data
            routes = []
            for route in osrm_routes.get("routes", []):
                enhanced_route = self._enhance_route_with_traffic(route, traffic_data, active_incidents)
                routes.append(enhanced_route)
                
        except Exception as e:
            print(f"OSRM routing failed, falling back to basic routing: {e}")
            # Fallback to original route generation using corrected coordinates
            routes = self._generate_route_options(
                actual_origin_lat, actual_origin_lng, actual_dest_lat, actual_dest_lng,
                traffic_data, active_incidents, avoid_traffic
            )
        
        # If no routes generated, create fallback using corrected coordinates
        if not routes:
            routes = self._generate_route_options(
                actual_origin_lat, actual_origin_lng, actual_dest_lat, actual_dest_lng,
                traffic_data, active_incidents, avoid_traffic
            )
        
        # Calculate route metrics for non-OSRM routes
        for route in routes:
            if not route.get('osrm_data'):  # Only calculate for fallback routes
                route.update(self._calculate_route_metrics(route, traffic_data, active_incidents))
        
        # Sort routes by total time (fastest first)
        routes.sort(key=lambda x: x['estimated_duration_minutes'])
        
        # Generate result with landmark information
        result = {
            "timestamp": current_time.isoformat(),
            "origin": {
                "lat": actual_origin_lat, 
                "lng": actual_origin_lng,
                "landmark": origin_landmark["name"] if origin_landmark else None,
                "address": origin_landmark["address"] if origin_landmark else None
            },
            "destination": {
                "lat": actual_dest_lat, 
                "lng": actual_dest_lng,
                "landmark": destination_landmark["name"] if destination_landmark else None,
                "address": destination_landmark["address"] if destination_landmark else None
            },
            "routes": routes,
            "recommended_route": routes[0] if routes else None,
            "traffic_summary": self._get_traffic_summary(traffic_data, active_incidents),
            "routing_strategy": "fastest" if avoid_traffic else "shortest",
            "routing_source": "osrm" if routes and routes[0].get('osrm_data') else "fallback",
            "landmark_corrections": {
                "origin_corrected": origin_landmark is not None,
                "destination_corrected": destination_landmark is not None,
                "corrections_applied": origin_landmark is not None or destination_landmark is not None
            },
            "next_update": (current_time + timedelta(minutes=3)).isoformat()
        }
        
        # Cache the result
        self.route_cache[cache_key] = (current_time, result)
        
        return result
    
    def _enhance_route_with_traffic(self, osrm_route: Dict, traffic_data: List, active_incidents: List) -> Dict:
        """Enhance OSRM route with traffic and incident data."""
        
        route_coordinates = osrm_route.get("route_coordinates", [])
        
        # Assess traffic conditions along the route
        traffic_conditions = self._assess_route_traffic(route_coordinates, traffic_data)
        
        # Calculate traffic delays
        traffic_delays = self._calculate_traffic_delays(route_coordinates, traffic_data)
        
        # Count incidents on route
        incidents_count = sum(1 for incident in active_incidents 
                            if self._incident_affects_route(incident, route_coordinates))
        
        # Update route data with traffic information
        enhanced_route = osrm_route.copy()
        enhanced_route.update({
            "traffic_conditions": traffic_conditions,
            "traffic_delays": traffic_delays,
            "incidents_on_route": incidents_count,
            "estimated_duration_minutes": enhanced_route.get("estimated_duration_minutes", 0) + traffic_delays
        })
        
        return enhanced_route
    
    def _calculate_traffic_delays(self, route_coordinates: List[List[float]], traffic_data: List) -> int:
        """Calculate additional delays due to traffic conditions."""
        
        if not route_coordinates or not traffic_data:
            return 0
        
        total_delays = 0
        
        for traffic in traffic_data:
            # Check if traffic point affects route
            for coord in route_coordinates:
                distance = self._calculate_distance(
                    coord[0], coord[1], traffic.latitude, traffic.longitude
                )
                
                # If traffic point is within 500m of route
                if distance <= 0.5:
                    # Add delays based on traffic status
                    if traffic.traffic_status == TrafficStatus.HEAVY:
                        total_delays += 3  # 3 minutes delay
                    elif traffic.traffic_status == TrafficStatus.STANDSTILL:
                        total_delays += 8  # 8 minutes delay
                    elif traffic.traffic_status == TrafficStatus.MODERATE:
                        total_delays += 1  # 1 minute delay
                    break  # Don't double-count the same traffic point
        
        return min(total_delays, 30)  # Cap at 30 minutes
    
    def _generate_route_options(self, origin_lat: float, origin_lng: float,
                              destination_lat: float, destination_lng: float,
                              traffic_data: List, active_incidents: List,
                              avoid_traffic: bool) -> List[Dict]:
        """Generate multiple route options based on current conditions."""
        
        routes = []
        base_distance = self._calculate_distance(origin_lat, origin_lng, destination_lat, destination_lng)
        
        # Route 1: Direct/Fastest Route
        direct_route = self._create_direct_route(
            origin_lat, origin_lng, destination_lat, destination_lng, 
            base_distance, traffic_data, "fastest"
        )
        routes.append(direct_route)
        
        # Route 2: Alternative Route (avoiding heavy traffic)
        if avoid_traffic and self._has_heavy_traffic(traffic_data):
            alt_route = self._create_alternative_route(
                origin_lat, origin_lng, destination_lat, destination_lng,
                base_distance, traffic_data, active_incidents
            )
            routes.append(alt_route)
        
        # Route 3: Scenic/Less Traffic Route
        scenic_route = self._create_scenic_route(
            origin_lat, origin_lng, destination_lat, destination_lng,
            base_distance, traffic_data
        )
        routes.append(scenic_route)
        
        return routes
    
    def _create_direct_route(self, origin_lat: float, origin_lng: float,
                           destination_lat: float, destination_lng: float,
                           base_distance: float, traffic_data: List, 
                           route_type: str) -> Dict:
        """Create the most direct route option."""
        
        # Find best major road for this route
        best_road = self._find_best_major_road(origin_lat, origin_lng, destination_lat, destination_lng)
        
        # Calculate route through major roads
        route_coordinates = self._generate_route_coordinates(
            origin_lat, origin_lng, destination_lat, destination_lng, best_road
        )
        
        # Estimate base travel time (assuming 30 km/h average in city)
        base_time = (base_distance / 30) * 60  # minutes
        
        return {
            "route_id": f"direct_{int(datetime.now().timestamp())}",
            "route_name": f"Via {best_road}" if best_road else "Direct Route",
            "route_type": "direct",
            "route_coordinates": route_coordinates,
            "distance_km": round(base_distance, 2),
            "estimated_duration_minutes": int(base_time),
            "traffic_conditions": self._assess_route_traffic(route_coordinates, traffic_data),
            "major_roads": [best_road] if best_road else ["Local roads"],
            "traffic_delays": 0,
            "incidents_on_route": 0,
            "route_quality": "primary",
            "advantages": ["Most direct path", "Familiar route"],
            "disadvantages": [],
            "confidence_level": "high"
        }
    
    def _create_alternative_route(self, origin_lat: float, origin_lng: float,
                                destination_lat: float, destination_lng: float,
                                base_distance: float, traffic_data: List,
                                active_incidents: List) -> Dict:
        """Create an alternative route avoiding heavy traffic."""
        
        # Find alternative roads
        alternative_roads = self._find_alternative_roads(traffic_data, active_incidents)
        
        # Generate alternative path
        route_coordinates = self._generate_alternative_coordinates(
            origin_lat, origin_lng, destination_lat, destination_lng, alternative_roads
        )
        
        # Calculate distance (usually 10-20% longer)
        alt_distance = base_distance * random.uniform(1.1, 1.2)
        
        # Calculate time with traffic avoidance benefits
        base_time = (alt_distance / 35) * 60  # Slightly faster due to less traffic
        
        incidents_avoided = len([i for i in active_incidents if self._incident_affects_route(i, route_coordinates)])
        
        return {
            "route_id": f"alternative_{int(datetime.now().timestamp())}",
            "route_name": f"Via {alternative_roads[0]}" if alternative_roads else "Alternative Route",
            "route_type": "alternative",
            "route_coordinates": route_coordinates,
            "distance_km": round(alt_distance, 2),
            "estimated_duration_minutes": int(base_time),
            "traffic_conditions": "light",
            "major_roads": alternative_roads,
            "traffic_delays": 0,
            "incidents_on_route": 0,
            "route_quality": "alternative",
            "advantages": [
                "Avoids heavy traffic",
                f"Bypasses {incidents_avoided} incidents" if incidents_avoided > 0 else "Clearer roads",
                "Less congested"
            ],
            "disadvantages": ["Slightly longer distance"],
            "confidence_level": "medium"
        }
    
    def _create_scenic_route(self, origin_lat: float, origin_lng: float,
                           destination_lat: float, destination_lng: float,
                           base_distance: float, traffic_data: List) -> Dict:
        """Create a scenic route with minimal traffic stress."""
        
        scenic_roads = ["Real Street", "Talon Road", "Pamplona Road"]
        
        route_coordinates = self._generate_scenic_coordinates(
            origin_lat, origin_lng, destination_lat, destination_lng, scenic_roads
        )
        
        # Usually longer but more pleasant
        scenic_distance = base_distance * random.uniform(1.15, 1.3)
        base_time = (scenic_distance / 25) * 60  # Slower but steady
        
        return {
            "route_id": f"scenic_{int(datetime.now().timestamp())}",
            "route_name": "Scenic Route",
            "route_type": "scenic",
            "route_coordinates": route_coordinates,
            "distance_km": round(scenic_distance, 2),
            "estimated_duration_minutes": int(base_time),
            "traffic_conditions": "light",
            "major_roads": scenic_roads[:2],
            "traffic_delays": 0,
            "incidents_on_route": 0,
            "route_quality": "scenic",
            "advantages": [
                "Peaceful drive",
                "Less stressful",
                "Avoid major highways",
                "Residential areas"
            ],
            "disadvantages": ["Longer distance", "More turns"],
            "confidence_level": "medium"
        }
    
    def _calculate_route_metrics(self, route: Dict, traffic_data: List, 
                               active_incidents: List) -> Dict:
        """Calculate detailed metrics for a route."""
        
        # Assess traffic impact
        traffic_impact = self._calculate_traffic_impact(route["route_coordinates"], traffic_data)
        incident_impact = self._calculate_incident_impact(route["route_coordinates"], active_incidents)
        
        # Adjust time based on traffic
        base_time = route["estimated_duration_minutes"]
        traffic_delay = traffic_impact["delay_minutes"]
        incident_delay = incident_impact["delay_minutes"]
        
        total_time = base_time + traffic_delay + incident_delay
        
        # Calculate savings compared to worst-case scenario
        worst_case_time = base_time * 1.5  # 50% longer in worst traffic
        time_savings = max(0, worst_case_time - total_time)
        
        return {
            "adjusted_duration_minutes": int(total_time),
            "traffic_delays": traffic_delay,
            "incident_delays": incident_delay,
            "incidents_on_route": incident_impact["incident_count"],
            "traffic_conditions": traffic_impact["overall_condition"],
            "estimated_savings_minutes": int(time_savings),
            "reliability_score": self._calculate_reliability_score(traffic_impact, incident_impact),
            "real_time_updates": True
        }
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula."""
        R = 6371  # Earth's radius in kilometers
        
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        
        a = (math.sin(dlat/2) * math.sin(dlat/2) + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
             math.sin(dlng/2) * math.sin(dlng/2))
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        
        return distance
    
    def _find_best_major_road(self, origin_lat: float, origin_lng: float,
                            destination_lat: float, destination_lng: float) -> Optional[str]:
        """Find the best major road for the route."""
        
        min_distance = float('inf')
        best_road = None
        
        for road_name, road_info in self.las_pinas_network["major_roads"].items():
            # Calculate distance to road (use closest point on the road)
            road_coords = road_info["coordinates"]
            road_distance = min([
                self._calculate_distance(origin_lat, origin_lng, coord[0], coord[1])
                for coord in road_coords
            ])
            
            if road_distance < min_distance:
                min_distance = road_distance
                best_road = road_name
        
        return best_road
    
    def _generate_route_coordinates(self, origin_lat: float, origin_lng: float,
                                  destination_lat: float, destination_lng: float,
                                  major_road: Optional[str]) -> List[List[float]]:
        """Generate realistic route coordinates that follow road networks."""
        
        # Start with origin
        coordinates = [[origin_lat, origin_lng]]
        
        # Find nearest road entry point
        if major_road and major_road in self.las_pinas_network["major_roads"]:
            road_coords = self.las_pinas_network["major_roads"][major_road]["coordinates"]
            
            # Find closest entry point to origin
            min_dist = float('inf')
            best_entry_idx = 0
            for i, road_coord in enumerate(road_coords):
                dist = self._calculate_distance(origin_lat, origin_lng, road_coord[0], road_coord[1])
                if dist < min_dist:
                    min_dist = dist
                    best_entry_idx = i
            
            # Add intermediate point to road if needed
            if min_dist > 0.001:  # If more than ~100m away
                entry_point = road_coords[best_entry_idx]
                # Create connecting segment
                mid_lat = (origin_lat + entry_point[0]) / 2
                mid_lng = (origin_lng + entry_point[1]) / 2
                coordinates.append([mid_lat, mid_lng])
            
            # Add road coordinates starting from best entry point
            for i in range(best_entry_idx, len(road_coords)):
                coordinates.append(road_coords[i])
            
            # Find best exit point to destination
            min_dist = float('inf')
            best_exit_idx = len(road_coords) - 1
            for i, road_coord in enumerate(road_coords):
                dist = self._calculate_distance(destination_lat, destination_lng, road_coord[0], road_coord[1])
                if dist < min_dist:
                    min_dist = dist
                    best_exit_idx = i
            
            # Add exit connection if needed
            if min_dist > 0.001:
                exit_point = road_coords[best_exit_idx]
                mid_lat = (destination_lat + exit_point[0]) / 2
                mid_lng = (destination_lng + exit_point[1]) / 2
                coordinates.append([mid_lat, mid_lng])
        else:
            # No major road available, create a more realistic path
            # Add intermediate waypoints for more natural routing
            waypoint_count = max(2, int(self._calculate_distance(origin_lat, origin_lng, destination_lat, destination_lng) * 5))
            waypoint_count = min(waypoint_count, 8)  # Cap at 8 waypoints
            
            for i in range(1, waypoint_count):
                ratio = i / waypoint_count
                # Add some randomness to avoid straight lines
                lat_offset = (random.random() - 0.5) * 0.002  # ~200m variation
                lng_offset = (random.random() - 0.5) * 0.002
                
                waypoint_lat = origin_lat + (destination_lat - origin_lat) * ratio + lat_offset
                waypoint_lng = origin_lng + (destination_lng - origin_lng) * ratio + lng_offset
                
                coordinates.append([waypoint_lat, waypoint_lng])
        
        # Always end with destination
        coordinates.append([destination_lat, destination_lng])
        
        return coordinates
    
    def _has_heavy_traffic(self, traffic_data: List) -> bool:
        """Check if there's significant heavy traffic."""
        if not traffic_data:
            return False
        
        heavy_traffic_count = len([t for t in traffic_data 
                                 if t.traffic_status in [TrafficStatus.HEAVY, TrafficStatus.STANDSTILL]])
        
        return heavy_traffic_count > len(traffic_data) * 0.3  # More than 30% heavy traffic
    
    def _find_alternative_roads(self, traffic_data: List, active_incidents: List) -> List[str]:
        """Find alternative roads with better traffic conditions."""
        
        # Analyze traffic on major roads
        road_conditions = {}
        for traffic in traffic_data:
            road_name = traffic.road_name
            if road_name not in road_conditions:
                road_conditions[road_name] = []
            road_conditions[road_name].append(traffic.traffic_status)
        
        # Find roads with better conditions
        good_roads = []
        for road_name, conditions in road_conditions.items():
            avg_condition = sum([self._traffic_status_to_score(status) for status in conditions]) / len(conditions)
            if avg_condition >= 60:  # Good traffic score
                good_roads.append(road_name)
        
        # Fallback to predefined alternatives
        if not good_roads:
            good_roads = ["CAA Road", "Real Street", "Niog Road"]
        
        return good_roads[:3]  # Return top 3
    
    def _traffic_status_to_score(self, status: TrafficStatus) -> int:
        """Convert traffic status to numeric score."""
        scores = {
            TrafficStatus.FREE_FLOW: 100,
            TrafficStatus.LIGHT: 80,
            TrafficStatus.MODERATE: 60,
            TrafficStatus.HEAVY: 30,
            TrafficStatus.STANDSTILL: 0
        }
        return scores.get(status, 50)
    
    def _generate_alternative_coordinates(self, origin_lat: float, origin_lng: float,
                                        destination_lat: float, destination_lng: float,
                                        alternative_roads: List[str]) -> List[List[float]]:
        """Generate coordinates for alternative route that avoids main traffic."""
        
        coordinates = [[origin_lat, origin_lng]]
        
        # Create a route that uses alternative roads intelligently
        if alternative_roads:
            # Use the best alternative road available
            primary_alt_road = alternative_roads[0]
            if primary_alt_road in self.las_pinas_network["major_roads"]:
                road_coords = self.las_pinas_network["major_roads"][primary_alt_road]["coordinates"]
                
                # Find best connection points
                origin_distances = [(i, self._calculate_distance(origin_lat, origin_lng, coord[0], coord[1])) 
                                  for i, coord in enumerate(road_coords)]
                dest_distances = [(i, self._calculate_distance(destination_lat, destination_lng, coord[0], coord[1])) 
                                for i, coord in enumerate(road_coords)]
                
                # Get closest points
                closest_to_origin = min(origin_distances, key=lambda x: x[1])
                closest_to_dest = min(dest_distances, key=lambda x: x[1])
                
                start_idx = closest_to_origin[0]
                end_idx = closest_to_dest[0]
                
                # Ensure we traverse the road in the right direction
                if start_idx > end_idx:
                    start_idx, end_idx = end_idx, start_idx
                
                # Add connection to road
                if closest_to_origin[1] > 0.0005:  # If more than ~50m away
                    entry_point = road_coords[start_idx]
                    mid_lat = (origin_lat + entry_point[0]) / 2
                    mid_lng = (origin_lng + entry_point[1]) / 2
                    coordinates.append([mid_lat, mid_lng])
                
                # Add the road segment
                for i in range(start_idx, end_idx + 1):
                    coordinates.append(road_coords[i])
                
                # Add connection from road to destination
                if closest_to_dest[1] > 0.0005:  # If more than ~50m away
                    exit_point = road_coords[end_idx]
                    mid_lat = (destination_lat + exit_point[0]) / 2
                    mid_lng = (destination_lng + exit_point[1]) / 2
                    coordinates.append([mid_lat, mid_lng])
        else:
            # No alternative roads available, create a detour route
            # Calculate a route that goes around potential traffic areas
            mid_lat = (origin_lat + destination_lat) / 2
            mid_lng = (origin_lng + destination_lng) / 2
            
            # Add detour waypoints
            detour_offset = 0.005  # ~500m detour
            coordinates.append([mid_lat + detour_offset, mid_lng])
            coordinates.append([mid_lat, mid_lng + detour_offset])
            coordinates.append([mid_lat - detour_offset, mid_lng])
        
        coordinates.append([destination_lat, destination_lng])
        return coordinates
    
    def _generate_scenic_coordinates(self, origin_lat: float, origin_lng: float,
                                   destination_lat: float, destination_lng: float,
                                   scenic_roads: List[str]) -> List[List[float]]:
        """Generate coordinates for scenic route."""
        
        coordinates = [[origin_lat, origin_lng]]
        
        # Add scenic waypoints
        scenic_waypoints = [
            [14.4550, 121.0180],  # Real Street area
            [14.4520, 121.0130],  # Talon Road area
            [14.4470, 121.0280]   # Pamplona area
        ]
        
        coordinates.extend(scenic_waypoints)
        coordinates.append([destination_lat, destination_lng])
        
        return coordinates
    
    def _assess_route_traffic(self, route_coordinates: List[List[float]], 
                            traffic_data: List) -> str:
        """Assess overall traffic conditions for a route."""
        
        if not traffic_data:
            return "unknown"
        
        # Find traffic data points near the route
        relevant_traffic = []
        for traffic in traffic_data:
            for coord in route_coordinates:
                distance = self._calculate_distance(coord[0], coord[1], traffic.latitude, traffic.longitude)
                if distance < 0.5:  # Within 500m of route
                    relevant_traffic.append(traffic)
                    break
        
        if not relevant_traffic:
            return "light"
        
        # Calculate average traffic score
        total_score = sum([self._traffic_status_to_score(t.traffic_status) for t in relevant_traffic])
        avg_score = total_score / len(relevant_traffic)
        
        if avg_score >= 80:
            return "light"
        elif avg_score >= 60:
            return "moderate"
        elif avg_score >= 30:
            return "heavy"
        else:
            return "standstill"
    
    def _calculate_traffic_impact(self, route_coordinates: List[List[float]], 
                                traffic_data: List) -> Dict:
        """Calculate traffic impact on route."""
        
        if not traffic_data:
            return {"delay_minutes": 0, "overall_condition": "light"}
        
        total_delay = 0
        condition_scores = []
        
        for traffic in traffic_data:
            # Check if traffic point affects route
            for coord in route_coordinates:
                distance = self._calculate_distance(coord[0], coord[1], traffic.latitude, traffic.longitude)
                if distance < 0.3:  # Within 300m
                    # Add delay based on traffic condition
                    if traffic.traffic_status == TrafficStatus.HEAVY:
                        total_delay += 3
                    elif traffic.traffic_status == TrafficStatus.STANDSTILL:
                        total_delay += 8
                    elif traffic.traffic_status == TrafficStatus.MODERATE:
                        total_delay += 1
                    
                    condition_scores.append(self._traffic_status_to_score(traffic.traffic_status))
                    break
        
        avg_condition = "light"
        if condition_scores:
            avg_score = sum(condition_scores) / len(condition_scores)
            if avg_score < 30:
                avg_condition = "standstill"
            elif avg_score < 60:
                avg_condition = "heavy"
            elif avg_score < 80:
                avg_condition = "moderate"
        
        return {
            "delay_minutes": total_delay,
            "overall_condition": avg_condition
        }
    
    def _calculate_incident_impact(self, route_coordinates: List[List[float]], 
                                 active_incidents: List) -> Dict:
        """Calculate incident impact on route."""
        
        incident_count = 0
        total_delay = 0
        
        for incident in active_incidents:
            for coord in route_coordinates:
                distance = self._calculate_distance(coord[0], coord[1], incident.latitude, incident.longitude)
                if distance < 0.2:  # Within 200m
                    incident_count += 1
                    # Add delay based on incident severity
                    if incident.severity == "critical":
                        total_delay += 15
                    elif incident.severity == "high":
                        total_delay += 8
                    elif incident.severity == "medium":
                        total_delay += 3
                    break
        
        return {
            "incident_count": incident_count,
            "delay_minutes": total_delay
        }
    
    def _incident_affects_route(self, incident, route_coordinates: List[List[float]]) -> bool:
        """Check if an incident affects the route."""
        for coord in route_coordinates:
            distance = self._calculate_distance(coord[0], coord[1], incident.latitude, incident.longitude)
            if distance < 0.2:  # Within 200m
                return True
        return False
    
    def _calculate_reliability_score(self, traffic_impact: Dict, incident_impact: Dict) -> float:
        """Calculate route reliability score (0-100)."""
        
        base_score = 100
        
        # Deduct for traffic delays
        base_score -= min(traffic_impact["delay_minutes"] * 2, 30)
        
        # Deduct for incidents
        base_score -= min(incident_impact["incident_count"] * 10, 40)
        
        # Condition penalty
        if traffic_impact["overall_condition"] == "heavy":
            base_score -= 15
        elif traffic_impact["overall_condition"] == "standstill":
            base_score -= 25
        
        return max(0, base_score)
    
    def _get_traffic_summary(self, traffic_data: List, active_incidents: List) -> Dict:
        """Get overall traffic summary for the area."""
        
        if not traffic_data:
            return {
                "overall_condition": "unknown",
                "total_monitored_points": 0,
                "incidents": 0,
                "advisory": "No traffic data available"
            }
        
        # Calculate overall metrics
        total_points = len(traffic_data)
        free_flow = len([t for t in traffic_data if t.traffic_status == TrafficStatus.FREE_FLOW])
        heavy_traffic = len([t for t in traffic_data if t.traffic_status in [TrafficStatus.HEAVY, TrafficStatus.STANDSTILL]])
        
        overall_score = (free_flow / total_points) * 100
        
        if overall_score >= 70:
            condition = "good"
            advisory = "Traffic is flowing well"
        elif overall_score >= 50:
            condition = "moderate"
            advisory = "Some congestion expected"
        else:
            condition = "heavy"
            advisory = "Significant delays possible"
        
        return {
            "overall_condition": condition,
            "total_monitored_points": total_points,
            "free_flowing_percentage": round((free_flow / total_points) * 100, 1),
            "incidents": len(active_incidents),
            "advisory": advisory
        }

# Global instance
smart_routing_service = SmartRoutingService()
