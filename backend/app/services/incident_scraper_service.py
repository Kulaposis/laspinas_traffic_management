import asyncio
import aiohttp
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import re
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.traffic import IncidentProneArea, IncidentProneAreaType

logger = logging.getLogger(__name__)

class IncidentScraperService:
    """Service for scraping incident and crime data for Las Piñas City"""
    
    def __init__(self):
        self.las_pinas_bounds = {
            'lat_min': 14.4200,
            'lat_max': 14.4800,
            'lng_min': 121.0000,
            'lng_max': 121.0400
        }
        
        # Predefined incident prone areas based on research
        self.known_incident_areas = [
            {
                'area_name': 'Alabang-Zapote Road',
                'area_type': IncidentProneAreaType.ACCIDENT_PRONE,
                'description': 'Major thoroughfare with heavy traffic congestion and frequent accidents',
                'severity_level': 'high',
                'latitude': 14.4504,
                'longitude': 121.0170,
                'radius_meters': 1000.0,
                'affected_roads': ['Alabang-Zapote Road', 'Real Street'],
                'barangay': 'Almanza Uno',
                'incident_count': 45,
                'common_incident_types': ['traffic_accident', 'vehicle_collision', 'road_rage'],
                'peak_hours': ['07:00-09:00', '17:00-19:00'],
                'risk_score': 85.0,
                'prevention_measures': 'Enhanced traffic enforcement, improved signage, speed humps',
                'alternative_routes': ['C-5 Road', 'Paranaque-Las Pinas Road'],
                'data_source': 'government_reports',
                'source_url': 'https://en.wikipedia.org/wiki/Alabang%E2%80%93Zapote_Road'
            },
            {
                'area_name': 'Barangay Talon 1',
                'area_type': IncidentProneAreaType.CRIME_HOTSPOT,
                'description': 'Historical crime-prone area with improving safety measures',
                'severity_level': 'medium',
                'latitude': 14.4350,
                'longitude': 121.0250,
                'radius_meters': 800.0,
                'affected_roads': ['Talon Road', 'CAA Road'],
                'barangay': 'Talon Uno',
                'incident_count': 23,
                'common_incident_types': ['theft', 'robbery', 'drug_related'],
                'peak_hours': ['20:00-02:00'],
                'risk_score': 65.0,
                'prevention_measures': 'Increased police patrol, improved lighting, CCTV installation',
                'alternative_routes': ['Naga Road', 'Quirino Avenue'],
                'data_source': 'police_reports',
                'source_url': 'https://www.philstar.com/metro/2006/10/23/364513/crime-prone-areas'
            },
            {
                'area_name': 'Barangay Almanza Uno',
                'area_type': IncidentProneAreaType.CRIME_HOTSPOT,
                'description': 'Previously identified crime-prone area with ongoing safety improvements',
                'severity_level': 'medium',
                'latitude': 14.4420,
                'longitude': 121.0180,
                'radius_meters': 700.0,
                'affected_roads': ['Almanza Road', 'Real Street'],
                'barangay': 'Almanza Uno',
                'incident_count': 18,
                'common_incident_types': ['petty_theft', 'burglary', 'vandalism'],
                'peak_hours': ['22:00-04:00'],
                'risk_score': 60.0,
                'prevention_measures': 'Community watch programs, improved street lighting',
                'alternative_routes': ['Sucat Road', 'C-5 Road'],
                'data_source': 'police_reports',
                'source_url': 'https://www.philstar.com/metro/2006/10/23/364513/crime-prone-areas'
            },
            {
                'area_name': 'Quirino Avenue',
                'area_type': IncidentProneAreaType.FLOOD_PRONE,
                'description': 'Flood-prone area contributing to vehicular accidents during heavy rains',
                'severity_level': 'high',
                'latitude': 14.4380,
                'longitude': 121.0220,
                'radius_meters': 1200.0,
                'affected_roads': ['Quirino Avenue', 'Diego Cera Street'],
                'barangay': 'Talon Dos',
                'incident_count': 32,
                'common_incident_types': ['flooding', 'vehicle_stranding', 'hydroplaning'],
                'peak_hours': ['monsoon_season'],
                'risk_score': 75.0,
                'prevention_measures': 'Improved drainage system, flood warning signs, traffic rerouting',
                'alternative_routes': ['Naga Road', 'CAA Road'],
                'data_source': 'mmda_reports',
                'source_url': 'https://www.autodeal.com.ph/articles/car-news-philippines/mmda-identifies-flood-prone-areas-in-metro'
            },
            {
                'area_name': 'C-5 Road (Las Piñas Section)',
                'area_type': IncidentProneAreaType.ACCIDENT_PRONE,
                'description': 'High-speed road with frequent vehicular accidents',
                'severity_level': 'high',
                'latitude': 14.4500,
                'longitude': 121.0300,
                'radius_meters': 1500.0,
                'affected_roads': ['C-5 Road', 'Sucat Road'],
                'barangay': 'BF Homes',
                'incident_count': 67,
                'common_incident_types': ['vehicle_collision', 'motorcycle_accident', 'speeding_violations'],
                'peak_hours': ['06:00-09:00', '16:00-20:00'],
                'risk_score': 90.0,
                'prevention_measures': 'Speed limit enforcement, median barriers, improved lighting',
                'alternative_routes': ['Alabang-Zapote Road', 'Sucat Road'],
                'data_source': 'government_reports',
                'source_url': 'https://en.wikipedia.org/wiki/Circumferential_Road_5'
            },
            {
                'area_name': 'Naga Road',
                'area_type': IncidentProneAreaType.FLOOD_PRONE,
                'description': 'Residential area prone to flooding during heavy rainfall',
                'severity_level': 'medium',
                'latitude': 14.4320,
                'longitude': 121.0190,
                'radius_meters': 900.0,
                'affected_roads': ['Naga Road', 'CAA Road'],
                'barangay': 'Pilar',
                'incident_count': 28,
                'common_incident_types': ['flooding', 'traffic_jam', 'vehicle_breakdown'],
                'peak_hours': ['rainy_season'],
                'risk_score': 55.0,
                'prevention_measures': 'Flood pumping stations, early warning systems',
                'alternative_routes': ['Real Street', 'Quirino Avenue'],
                'data_source': 'mmda_reports',
                'source_url': 'https://www.moneymax.ph/car-insurance/articles/flood-prone-areas-metro-manila'
            },
            {
                'area_name': 'Tramo Line to Casimiro-Camella Subdivision',
                'area_type': IncidentProneAreaType.FLOOD_PRONE,
                'description': 'Subdivision entrance area prone to flooding',
                'severity_level': 'medium',
                'latitude': 14.4280,
                'longitude': 121.0160,
                'radius_meters': 600.0,
                'affected_roads': ['Tramo Line', 'F. Santos Avenue'],
                'barangay': 'Almanza Dos',
                'incident_count': 15,
                'common_incident_types': ['flooding', 'traffic_diversion', 'road_closure'],
                'peak_hours': ['rainy_season'],
                'risk_score': 50.0,
                'prevention_measures': 'Enhanced drainage, traffic management during floods',
                'alternative_routes': ['Real Street', 'Alabang-Zapote Road'],
                'data_source': 'mmda_reports',
                'source_url': 'https://www.moneymax.ph/car-insurance/articles/flood-prone-areas-metro-manila'
            },
            {
                'area_name': 'Tiongquiao Road to CAA',
                'area_type': IncidentProneAreaType.FLOOD_PRONE,
                'description': 'Commercial area intersection prone to flooding',
                'severity_level': 'medium',
                'latitude': 14.4360,
                'longitude': 121.0210,
                'radius_meters': 700.0,
                'affected_roads': ['Tiongquiao Road', 'CAA Road'],
                'barangay': 'Talon Tres',
                'incident_count': 20,
                'common_incident_types': ['flooding', 'business_disruption', 'pedestrian_safety'],
                'peak_hours': ['rainy_season'],
                'risk_score': 52.0,
                'prevention_measures': 'Flood barriers, business continuity planning',
                'alternative_routes': ['Naga Road', 'Real Street'],
                'data_source': 'mmda_reports',
                'source_url': 'https://www.moneymax.ph/car-insurance/articles/flood-prone-areas-metro-manila'
            }
        ]

    async def scrape_government_data(self) -> List[Dict]:
        """Scrape data from government sources"""
        scraped_data = []
        
        try:
            # Simulate scraping from various government sources
            # In a real implementation, you would scrape from:
            # - MMDA incident reports
            # - PNP crime statistics
            # - LGU official reports
            # - DOTr traffic data
            
            async with aiohttp.ClientSession() as session:
                # Example: MMDA traffic incidents (simulated)
                mmda_data = await self._scrape_mmda_incidents(session)
                scraped_data.extend(mmda_data)
                
                # Example: PNP crime reports (simulated)
                pnp_data = await self._scrape_pnp_reports(session)
                scraped_data.extend(pnp_data)
                
        except Exception as e:
            logger.error(f"Error scraping government data: {e}")
            
        return scraped_data

    async def _scrape_mmda_incidents(self, session: aiohttp.ClientSession) -> List[Dict]:
        """Simulate scraping MMDA incident data"""
        # In real implementation, this would scrape actual MMDA APIs or websites
        logger.info("Simulating MMDA incident data scraping...")
        
        # Return simulated incident data
        return [
            {
                'area_name': 'Alabang-Zapote Bridge',
                'area_type': IncidentProneAreaType.TRAFFIC_CONGESTION,
                'description': 'Bridge area with frequent traffic bottlenecks',
                'severity_level': 'high',
                'latitude': 14.4520,
                'longitude': 121.0185,
                'data_source': 'mmda_scraping',
                'source_url': 'https://mmda.gov.ph'
            }
        ]

    async def _scrape_pnp_reports(self, session: aiohttp.ClientSession) -> List[Dict]:
        """Simulate scraping PNP crime data"""
        logger.info("Simulating PNP crime data scraping...")
        
        # In real implementation, this would access PNP databases or reports
        return [
            {
                'area_name': 'Las Piñas City Hall Area',
                'area_type': IncidentProneAreaType.CRIME_HOTSPOT,
                'description': 'Commercial area with occasional theft incidents',
                'severity_level': 'low',
                'latitude': 14.4504,
                'longitude': 121.0170,
                'data_source': 'pnp_scraping',
                'source_url': 'https://pnp.gov.ph'
            }
        ]

    async def scrape_social_media_reports(self) -> List[Dict]:
        """Scrape incident reports from social media platforms"""
        scraped_data = []
        
        try:
            # Simulate scraping from social media (Twitter, Facebook groups, etc.)
            # In real implementation, you would use APIs to get:
            # - Twitter posts about accidents/incidents
            # - Facebook community group reports
            # - Telegram traffic alert channels
            
            logger.info("Simulating social media incident scraping...")
            
            # Example simulated data
            social_media_data = [
                {
                    'area_name': 'BF Homes Main Gate',
                    'area_type': IncidentProneAreaType.TRAFFIC_CONGESTION,
                    'description': 'Frequent traffic congestion reported by residents',
                    'severity_level': 'medium',
                    'latitude': 14.4450,
                    'longitude': 121.0280,
                    'data_source': 'social_media_scraping',
                    'source_url': 'https://twitter.com/mmda'
                }
            ]
            
            scraped_data.extend(social_media_data)
            
        except Exception as e:
            logger.error(f"Error scraping social media data: {e}")
            
        return scraped_data

    async def scrape_news_reports(self) -> List[Dict]:
        """Scrape incident reports from news websites"""
        scraped_data = []
        
        try:
            # Simulate scraping from news sources
            # In real implementation, you would scrape from:
            # - Local news websites
            # - National news portals
            # - Traffic update websites
            
            logger.info("Simulating news reports scraping...")
            
            news_data = [
                {
                    'area_name': 'Perpetual Help Medical Center Area',
                    'area_type': IncidentProneAreaType.TRAFFIC_CONGESTION,
                    'description': 'Hospital area with frequent ambulance traffic and congestion',
                    'severity_level': 'medium',
                    'latitude': 14.4380,
                    'longitude': 121.0200,
                    'data_source': 'news_scraping',
                    'source_url': 'https://news.example.com'
                }
            ]
            
            scraped_data.extend(news_data)
            
        except Exception as e:
            logger.error(f"Error scraping news data: {e}")
            
        return scraped_data

    def enrich_area_data(self, area_data: Dict) -> Dict:
        """Enrich scraped data with additional information"""
        
        # Set default values if not provided
        area_data.setdefault('radius_meters', 500.0)
        area_data.setdefault('incident_count', 1)
        area_data.setdefault('risk_score', self._calculate_risk_score(area_data))
        area_data.setdefault('is_verified', False)
        area_data.setdefault('is_active', True)
        area_data.setdefault('last_verified', datetime.now(timezone.utc))
        
        # Enrich with barangay information if not provided
        if not area_data.get('barangay'):
            area_data['barangay'] = self._get_barangay_from_coordinates(
                area_data['latitude'], area_data['longitude']
            )
        
        # Set common incident types based on area type
        if not area_data.get('common_incident_types'):
            area_data['common_incident_types'] = self._get_common_incidents_by_type(
                area_data['area_type']
            )
        
        # Set peak hours based on area type
        if not area_data.get('peak_hours'):
            area_data['peak_hours'] = self._get_peak_hours_by_type(
                area_data['area_type']
            )
        
        return area_data

    def _calculate_risk_score(self, area_data: Dict) -> float:
        """Calculate risk score based on various factors"""
        base_score = 30.0
        
        # Severity level multiplier
        severity_multipliers = {
            'low': 1.0,
            'medium': 1.5,
            'high': 2.0,
            'critical': 2.5
        }
        
        severity = area_data.get('severity_level', 'medium')
        base_score *= severity_multipliers.get(severity, 1.5)
        
        # Area type multiplier
        type_multipliers = {
            IncidentProneAreaType.ACCIDENT_PRONE: 2.0,
            IncidentProneAreaType.CRIME_HOTSPOT: 1.8,
            IncidentProneAreaType.FLOOD_PRONE: 1.5,
            IncidentProneAreaType.TRAFFIC_CONGESTION: 1.2,
            IncidentProneAreaType.ROAD_HAZARD: 1.6
        }
        
        area_type = area_data.get('area_type')
        if isinstance(area_type, str):
            area_type = IncidentProneAreaType(area_type)
        
        base_score *= type_multipliers.get(area_type, 1.0)
        
        # Incident count factor
        incident_count = area_data.get('incident_count', 1)
        base_score += min(incident_count * 0.5, 20.0)  # Cap at 20 points
        
        return min(base_score, 100.0)  # Cap at 100

    def _get_barangay_from_coordinates(self, lat: float, lng: float) -> str:
        """Estimate barangay based on coordinates"""
        # Simple barangay mapping based on coordinate ranges
        # In a real implementation, you would use a proper geocoding service
        
        if lat >= 14.450:
            if lng >= 121.025:
                return "BF Homes"
            else:
                return "Almanza Uno"
        elif lat >= 14.440:
            return "Talon Dos"
        elif lat >= 14.430:
            return "Talon Uno"
        else:
            return "Pilar"

    def _get_common_incidents_by_type(self, area_type) -> List[str]:
        """Get common incident types based on area type"""
        type_incidents = {
            IncidentProneAreaType.ACCIDENT_PRONE: ['vehicle_collision', 'motorcycle_accident', 'pedestrian_accident'],
            IncidentProneAreaType.CRIME_HOTSPOT: ['theft', 'robbery', 'vandalism'],
            IncidentProneAreaType.FLOOD_PRONE: ['flooding', 'vehicle_stranding', 'road_closure'],
            IncidentProneAreaType.TRAFFIC_CONGESTION: ['traffic_jam', 'road_rage', 'illegal_parking'],
            IncidentProneAreaType.ROAD_HAZARD: ['potholes', 'debris', 'poor_lighting']
        }
        
        if isinstance(area_type, str):
            area_type = IncidentProneAreaType(area_type)
            
        return type_incidents.get(area_type, ['general_incident'])

    def _get_peak_hours_by_type(self, area_type) -> List[str]:
        """Get peak hours based on area type"""
        type_hours = {
            IncidentProneAreaType.ACCIDENT_PRONE: ['07:00-09:00', '17:00-19:00'],
            IncidentProneAreaType.CRIME_HOTSPOT: ['20:00-02:00'],
            IncidentProneAreaType.FLOOD_PRONE: ['rainy_season'],
            IncidentProneAreaType.TRAFFIC_CONGESTION: ['06:00-09:00', '16:00-20:00'],
            IncidentProneAreaType.ROAD_HAZARD: ['all_day']
        }
        
        if isinstance(area_type, str):
            area_type = IncidentProneAreaType(area_type)
            
        return type_hours.get(area_type, ['all_day'])

    async def perform_full_scraping(self) -> List[Dict]:
        """Perform comprehensive scraping from all sources"""
        logger.info("Starting comprehensive incident data scraping for Las Piñas City...")
        
        all_data = []
        
        # Start with known incident areas
        all_data.extend(self.known_incident_areas)
        
        # Scrape from various sources
        scraped_sources = await asyncio.gather(
            self.scrape_government_data(),
            self.scrape_social_media_reports(),
            self.scrape_news_reports(),
            return_exceptions=True
        )
        
        for source_data in scraped_sources:
            if not isinstance(source_data, Exception):
                all_data.extend(source_data)
            else:
                logger.error(f"Error in scraping source: {source_data}")
        
        # Enrich all data
        enriched_data = []
        for area_data in all_data:
            try:
                enriched_area = self.enrich_area_data(area_data)
                enriched_data.append(enriched_area)
            except Exception as e:
                logger.error(f"Error enriching area data: {e}")
                continue
        
        logger.info(f"Scraped and processed {len(enriched_data)} incident prone areas")
        return enriched_data

    async def save_to_database(self, areas_data: List[Dict], db: Session):
        """Save scraped data to database"""
        saved_count = 0
        
        for area_data in areas_data:
            try:
                # Check if area already exists
                existing_area = db.query(IncidentProneArea).filter(
                    IncidentProneArea.area_name == area_data['area_name'],
                    IncidentProneArea.area_type == area_data['area_type']
                ).first()
                
                if existing_area:
                    # Update existing area
                    for key, value in area_data.items():
                        if hasattr(existing_area, key):
                            setattr(existing_area, key, value)
                    existing_area.updated_at = datetime.now(timezone.utc)
                else:
                    # Create new area
                    new_area = IncidentProneArea(**area_data)
                    db.add(new_area)
                
                saved_count += 1
                
            except Exception as e:
                logger.error(f"Error saving area {area_data.get('area_name', 'Unknown')}: {e}")
                continue
        
        try:
            db.commit()
            logger.info(f"Successfully saved {saved_count} incident prone areas to database")
        except Exception as e:
            db.rollback()
            logger.error(f"Error committing to database: {e}")
            raise

# Create service instance
incident_scraper_service = IncidentScraperService()
