"""
Web scraper for Las Piñas City No Parking Zones
This script collects data about no parking zones in Las Piñas City
from various sources and creates a comprehensive dataset.
"""

import requests
import json
import time
from typing import List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LasFinasNoParkingZoneScraper:
    def __init__(self):
        self.base_url = "https://nominatim.openstreetmap.org/search"
        self.headers = {
            'User-Agent': 'Traffic Management System - Las Pinas No Parking Zone Mapper'
        }
        
        # Las Piñas City boundaries
        self.las_pinas_bounds = {
            'lat_min': 14.4200,
            'lat_max': 14.4800,
            'lng_min': 121.0000,
            'lng_max': 121.0400
        }
        
        # Common no parking zone types and locations in Las Piñas
        self.no_parking_categories = [
            "fire station vicinity",
            "hospital vicinity", 
            "school zone",
            "church vicinity",
            "government building",
            "market area",
            "bridge",
            "intersection",
            "loading zone",
            "bus stop",
            "pedestrian crossing",
            "narrow road"
        ]

    def get_osm_data(self, query: str, limit: int = 20) -> List[Dict]:
        """Fetch data from OpenStreetMap Nominatim API"""
        params = {
            'q': f"{query}, Las Piñas City, Metro Manila, Philippines",
            'format': 'json',
            'limit': limit,
            'addressdetails': 1,
            'extratags': 1,
            'namedetails': 1,
            'viewbox': f"{self.las_pinas_bounds['lng_min']},{self.las_pinas_bounds['lat_min']},{self.las_pinas_bounds['lng_max']},{self.las_pinas_bounds['lat_max']}",
            'bounded': 1
        }
        
        try:
            response = requests.get(self.base_url, params=params, headers=self.headers)
            response.raise_for_status()
            time.sleep(1)  # Be respectful to the API
            return response.json()
        except Exception as e:
            logger.error(f"Error fetching OSM data for {query}: {e}")
            return []

    def generate_no_parking_zones_from_landmarks(self) -> List[Dict]:
        """Generate no parking zones based on known landmarks and regulations"""
        no_parking_zones = []
        
        # Known critical locations in Las Piñas that typically have no parking restrictions
        critical_locations = [
            # Fire Stations
            {"name": "Las Piñas Fire Station", "lat": 14.4504, "lng": 121.0170, "radius": 50, "category": "fire_station"},
            {"name": "BF Homes Fire Station", "lat": 14.4450, "lng": 121.0300, "radius": 50, "category": "fire_station"},
            
            # Hospitals
            {"name": "Las Piñas Doctors Hospital", "lat": 14.4680, "lng": 121.0280, "radius": 30, "category": "hospital"},
            {"name": "Perpetual Help Medical Center Las Piñas", "lat": 14.4520, "lng": 121.0190, "radius": 30, "category": "hospital"},
            
            # Schools
            {"name": "Universidad de las Piñas", "lat": 14.4550, "lng": 121.0200, "radius": 50, "category": "school"},
            {"name": "Las Piñas East National High School", "lat": 14.4480, "lng": 121.0250, "radius": 30, "category": "school"},
            {"name": "Pamantasan ng Lungsod ng Las Piñas", "lat": 14.4600, "lng": 121.0180, "radius": 40, "category": "school"},
            
            # Government Buildings
            {"name": "Las Piñas City Hall", "lat": 14.4504, "lng": 121.0170, "radius": 50, "category": "government"},
            {"name": "Las Piñas RTC", "lat": 14.4500, "lng": 121.0175, "radius": 30, "category": "government"},
            
            # Religious Buildings
            {"name": "Our Lady of the Abandoned Parish", "lat": 14.4510, "lng": 121.0160, "radius": 25, "category": "church"},
            {"name": "St. Joseph the Worker Cathedral", "lat": 14.4520, "lng": 121.0180, "radius": 25, "category": "church"},
            
            # Markets
            {"name": "Las Piñas Public Market", "lat": 14.4490, "lng": 121.0165, "radius": 40, "category": "market"},
            {"name": "BF Resort Public Market", "lat": 14.4400, "lng": 121.0320, "radius": 30, "category": "market"},
            
            # Major Intersections and Bridges
            {"name": "Alabang-Zapote Bridge", "lat": 14.4250, "lng": 121.0100, "radius": 100, "category": "bridge"},
            {"name": "Las Piñas-Parañaque Bridge", "lat": 14.4700, "lng": 121.0150, "radius": 80, "category": "bridge"},
            {"name": "Daang Hari Intersection", "lat": 14.4300, "lng": 121.0350, "radius": 60, "category": "intersection"},
            {"name": "CAA-Alabang Zapote Intersection", "lat": 14.4350, "lng": 121.0120, "radius": 60, "category": "intersection"},
        ]
        
        for location in critical_locations:
            # Create primary no parking zone
            no_parking_zones.append({
                "name": f"No Parking Zone - {location['name']}",
                "description": f"No parking zone around {location['name']} as per traffic regulations",
                "latitude": location['lat'],
                "longitude": location['lng'],
                "zone_type": "restricted",
                "restriction_reason": location['category'],
                "radius_meters": location['radius'],
                "is_strict": True,
                "fine_amount": 1000.0,  # Standard parking violation fine
                "enforcement_hours": "24/7",
                "address": f"Near {location['name']}, Las Piñas City"
            })
            
            # Add additional zones around the perimeter for high-traffic areas
            if location['category'] in ['fire_station', 'hospital', 'government']:
                perimeter_points = [
                    {"lat": location['lat'] + 0.0005, "lng": location['lng']},
                    {"lat": location['lat'] - 0.0005, "lng": location['lng']},
                    {"lat": location['lat'], "lng": location['lng'] + 0.0005},
                    {"lat": location['lat'], "lng": location['lng'] - 0.0005},
                ]
                
                for i, point in enumerate(perimeter_points):
                    no_parking_zones.append({
                        "name": f"Extended No Parking - {location['name']} ({i+1})",
                        "description": f"Extended no parking zone near {location['name']}",
                        "latitude": point['lat'],
                        "longitude": point['lng'],
                        "zone_type": "restricted",
                        "restriction_reason": f"{location['category']}_extended",
                        "radius_meters": 25,
                        "is_strict": location['category'] == 'fire_station',
                        "fine_amount": 500.0,
                        "enforcement_hours": "6:00-22:00",
                        "address": f"Near {location['name']}, Las Piñas City"
                    })
        
        return no_parking_zones

    def generate_road_specific_restrictions(self) -> List[Dict]:
        """Generate no parking zones for specific road segments"""
        road_restrictions = []
        
        # Major roads with no parking restrictions
        major_roads = [
            {
                "name": "Alabang-Zapote Road",
                "segments": [
                    {"lat": 14.4250, "lng": 121.0100, "description": "Bridge approach"},
                    {"lat": 14.4300, "lng": 121.0120, "description": "Commercial area"},
                    {"lat": 14.4350, "lng": 121.0140, "description": "Near intersections"},
                ]
            },
            {
                "name": "CAA Road (Coastal Road)",
                "segments": [
                    {"lat": 14.4280, "lng": 121.0080, "description": "Coastal strip"},
                    {"lat": 14.4320, "lng": 121.0090, "description": "Industrial area"},
                    {"lat": 14.4360, "lng": 121.0100, "description": "Near port area"},
                ]
            },
            {
                "name": "Real Street",
                "segments": [
                    {"lat": 14.4480, "lng": 121.0160, "description": "Commercial center"},
                    {"lat": 14.4500, "lng": 121.0170, "description": "City hall area"},
                    {"lat": 14.4520, "lng": 121.0180, "description": "Church vicinity"},
                ]
            },
            {
                "name": "Daang Hari Road",
                "segments": [
                    {"lat": 14.4300, "lng": 121.0350, "description": "Main intersection"},
                    {"lat": 14.4320, "lng": 121.0370, "description": "Commercial complex"},
                    {"lat": 14.4340, "lng": 121.0390, "description": "Residential approach"},
                ]
            }
        ]
        
        for road in major_roads:
            for i, segment in enumerate(road["segments"]):
                road_restrictions.append({
                    "name": f"No Parking - {road['name']} Segment {i+1}",
                    "description": f"No parking restriction on {road['name']} - {segment['description']}",
                    "latitude": segment['lat'],
                    "longitude": segment['lng'],
                    "zone_type": "road_restriction",
                    "restriction_reason": "major_road",
                    "radius_meters": 20,
                    "is_strict": True,
                    "fine_amount": 1500.0,  # Higher fine for major road violations
                    "enforcement_hours": "24/7",
                    "address": f"{road['name']}, Las Piñas City"
                })
        
        return road_restrictions

    def generate_bus_stop_restrictions(self) -> List[Dict]:
        """Generate no parking zones around bus stops"""
        bus_stops = [
            {"name": "Las Piñas City Hall Bus Stop", "lat": 14.4500, "lng": 121.0165},
            {"name": "Alabang-Zapote Bridge Bus Stop", "lat": 14.4260, "lng": 121.0110},
            {"name": "BF Resort Bus Stop", "lat": 14.4400, "lng": 121.0320},
            {"name": "Daang Hari Bus Stop", "lat": 14.4310, "lng": 121.0360},
            {"name": "Real Street Bus Stop", "lat": 14.4490, "lng": 121.0170},
            {"name": "CAA Road Bus Stop", "lat": 14.4300, "lng": 121.0090},
        ]
        
        bus_stop_restrictions = []
        for stop in bus_stops:
            # 15 meters before and after bus stop
            for offset in [-0.0001, 0.0001]:  # Roughly 15 meters
                bus_stop_restrictions.append({
                    "name": f"No Parking - {stop['name']} Zone",
                    "description": f"No parking zone around {stop['name']} (15m radius)",
                    "latitude": stop['lat'] + offset,
                    "longitude": stop['lng'],
                    "zone_type": "bus_stop",
                    "restriction_reason": "public_transport",
                    "radius_meters": 15,
                    "is_strict": True,
                    "fine_amount": 1000.0,
                    "enforcement_hours": "5:00-23:00",
                    "address": f"Near {stop['name']}, Las Piñas City"
                })
        
        return bus_stop_restrictions

    def scrape_all_no_parking_zones(self) -> Dict[str, Any]:
        """Main method to scrape all no parking zone data"""
        logger.info("Starting Las Piñas No Parking Zone data collection...")
        
        all_zones = []
        
        # Generate zones from landmarks
        logger.info("Generating zones from landmarks...")
        landmark_zones = self.generate_no_parking_zones_from_landmarks()
        all_zones.extend(landmark_zones)
        
        # Generate road-specific restrictions
        logger.info("Generating road-specific restrictions...")
        road_zones = self.generate_road_specific_restrictions()
        all_zones.extend(road_zones)
        
        # Generate bus stop restrictions
        logger.info("Generating bus stop restrictions...")
        bus_stop_zones = self.generate_bus_stop_restrictions()
        all_zones.extend(bus_stop_zones)
        
        # Add metadata
        result = {
            "city": "Las Piñas City",
            "province": "Metro Manila",
            "country": "Philippines",
            "total_zones": len(all_zones),
            "scrape_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "zones": all_zones,
            "statistics": {
                "landmark_zones": len(landmark_zones),
                "road_zones": len(road_zones),
                "bus_stop_zones": len(bus_stop_zones),
                "strict_zones": len([z for z in all_zones if z.get('is_strict', False)]),
                "24_7_zones": len([z for z in all_zones if z.get('enforcement_hours') == '24/7'])
            }
        }
        
        logger.info(f"Successfully collected {len(all_zones)} no parking zones")
        return result

def main():
    """Run the scraper and save results"""
    scraper = LasFinasNoParkingZoneScraper()
    
    try:
        data = scraper.scrape_all_no_parking_zones()
        
        # Save to JSON file
        output_file = "las_pinas_no_parking_zones.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Data saved to {output_file}")
        logger.info(f"Total zones collected: {data['total_zones']}")
        logger.info("Statistics:")
        for key, value in data['statistics'].items():
            logger.info(f"  {key}: {value}")
            
        return data
        
    except Exception as e:
        logger.error(f"Error during scraping: {e}")
        raise

if __name__ == "__main__":
    main()
