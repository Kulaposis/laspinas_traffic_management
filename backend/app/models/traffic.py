from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, JSON
from sqlalchemy.sql import func
from ..db import Base
import enum

class TrafficStatus(enum.Enum):
    FREE_FLOW = "free_flow"
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"
    STANDSTILL = "standstill"

class RoadType(enum.Enum):
    HIGHWAY = "highway"
    MAIN_ROAD = "main_road"
    SIDE_STREET = "side_street"
    RESIDENTIAL = "residential"
    BRIDGE = "bridge"

class TrafficMonitoring(Base):
    __tablename__ = "traffic_monitoring"

    id = Column(Integer, primary_key=True, index=True)
    road_name = Column(String(255), nullable=False)
    road_type = Column(Enum(RoadType, name='roadtype', create_type=False, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    barangay = Column(String(100), nullable=False)  # Barangay in Las Piñas City
    traffic_status = Column(Enum(TrafficStatus, name='trafficstatus', create_type=False, values_callable=lambda obj: [e.value for e in obj]), default=TrafficStatus.FREE_FLOW, nullable=False)
    average_speed_kmh = Column(Float, nullable=True)
    vehicle_count = Column(Integer, default=0, nullable=False)
    congestion_percentage = Column(Float, default=0.0, nullable=False)  # 0-100%
    estimated_travel_time = Column(Float, nullable=True)  # minutes
    road_segment_length = Column(Float, nullable=True)  # kilometers
    data_source = Column(String(50), default="tomtom_api", nullable=False)  # tomtom_api, fallback_generator, manual
    confidence_score = Column(Float, default=1.0, nullable=False)  # 0-1 confidence in data
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RouteAlternative(Base):
    __tablename__ = "route_alternatives"

    id = Column(Integer, primary_key=True, index=True)
    origin_lat = Column(Float, nullable=False)
    origin_lng = Column(Float, nullable=False)
    destination_lat = Column(Float, nullable=False)
    destination_lng = Column(Float, nullable=False)
    route_name = Column(String(255), nullable=True)
    route_coordinates = Column(JSON, nullable=False)  # Array of [lat, lng] points
    distance_km = Column(Float, nullable=False)
    estimated_duration_minutes = Column(Integer, nullable=False)
    traffic_conditions = Column(Enum(TrafficStatus, name='trafficstatus', create_type=False, values_callable=lambda obj: [e.value for e in obj]), nullable=False)
    is_recommended = Column(Boolean, default=False, nullable=False)
    road_segments = Column(JSON, nullable=True)  # Array of road names
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class RoadIncident(Base):
    __tablename__ = "road_incidents"

    id = Column(Integer, primary_key=True, index=True)
    incident_type = Column(String(100), nullable=False)  # accident, road_work, event, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    affected_roads = Column(JSON, nullable=True)  # Array of road names
    is_active = Column(Boolean, default=True, nullable=False)
    estimated_clearance_time = Column(DateTime(timezone=True), nullable=True)
    impact_radius_meters = Column(Float, default=500.0, nullable=False)
    reporter_source = Column(String(50), nullable=False)  # citizen, enforcer, system, cctv
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class IncidentProneAreaType(enum.Enum):
    ACCIDENT_PRONE = "ACCIDENT_PRONE"
    CRIME_HOTSPOT = "CRIME_HOTSPOT"
    FLOOD_PRONE = "FLOOD_PRONE"
    TRAFFIC_CONGESTION = "TRAFFIC_CONGESTION"
    ROAD_HAZARD = "ROAD_HAZARD"

class IncidentProneArea(Base):
    __tablename__ = "incident_prone_areas"

    id = Column(Integer, primary_key=True, index=True)
    area_name = Column(String(255), nullable=False)
    area_type = Column(Enum(IncidentProneAreaType, name='incidentproneareatype', create_type=False), nullable=False)
    description = Column(Text, nullable=True)
    severity_level = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    
    # Geographic data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=500.0, nullable=False)  # Area coverage radius
    affected_roads = Column(JSON, nullable=True)  # Array of road names
    barangay = Column(String(100), nullable=True)
    
    # Statistical data
    incident_count = Column(Integer, default=0, nullable=False)  # Historical incident count
    last_incident_date = Column(DateTime(timezone=True), nullable=True)
    peak_hours = Column(JSON, nullable=True)  # Array of peak incident hours
    common_incident_types = Column(JSON, nullable=True)  # Array of common incident types
    
    # Risk assessment
    risk_score = Column(Float, default=0.0, nullable=False)  # 0-100 risk assessment score
    prevention_measures = Column(Text, nullable=True)
    alternative_routes = Column(JSON, nullable=True)  # Suggested alternative routes
    
    # Data source tracking
    data_source = Column(String(100), nullable=False)  # webscraping, manual, government, etc.
    source_url = Column(String(500), nullable=True)
    last_verified = Column(DateTime(timezone=True), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())