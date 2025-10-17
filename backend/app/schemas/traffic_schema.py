from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from ..models.traffic import TrafficStatus, RoadType

# Traffic Monitoring Schemas
class TrafficMonitoringBase(BaseModel):
    road_name: str = Field(..., min_length=1, max_length=255)
    road_type: RoadType
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    barangay: str = Field(..., min_length=1, max_length=100, description="Barangay in Las Piñas City")
    traffic_status: TrafficStatus = TrafficStatus.FREE_FLOW
    average_speed_kmh: Optional[float] = Field(None, ge=0)
    vehicle_count: int = Field(0, ge=0)
    congestion_percentage: float = Field(0.0, ge=0, le=100)
    estimated_travel_time: Optional[float] = Field(None, ge=0)
    road_segment_length: Optional[float] = Field(None, ge=0)
    data_source: str = Field("tomtom_api", max_length=50)
    confidence_score: float = Field(1.0, ge=0, le=1)

class TrafficMonitoringCreate(TrafficMonitoringBase):
    pass

class TrafficMonitoringUpdate(BaseModel):
    traffic_status: Optional[TrafficStatus] = None
    average_speed_kmh: Optional[float] = Field(None, ge=0)
    vehicle_count: Optional[int] = Field(None, ge=0)
    congestion_percentage: Optional[float] = Field(None, ge=0, le=100)
    estimated_travel_time: Optional[float] = Field(None, ge=0)

class TrafficMonitoringResponse(TrafficMonitoringBase):
    id: int
    last_updated: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Roadworks Scraping Schema
class RoadworksScrapingRequest(BaseModel):
    facebook_pages: Optional[List[str]] = Field(default=None, description="List of Facebook page URLs to scrape")
    
    class Config:
        # Allow empty request body
        extra = "forbid"

# Route Alternative Schemas
class RouteAlternativeBase(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    route_name: Optional[str] = Field(None, max_length=255)
    route_coordinates: List[List[float]] = Field(..., description="Array of [lat, lng] points")
    distance_km: float = Field(..., gt=0)
    estimated_duration_minutes: int = Field(..., gt=0)
    traffic_conditions: TrafficStatus
    is_recommended: bool = False
    road_segments: Optional[List[str]] = None

class RouteAlternativeCreate(RouteAlternativeBase):
    pass

class RouteAlternativeResponse(RouteAlternativeBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Road Incident Schemas
class RoadIncidentBase(BaseModel):
    incident_type: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)
    affected_roads: Optional[List[str]] = None
    estimated_clearance_time: Optional[datetime] = None
    impact_radius_meters: float = Field(500.0, gt=0)

class RoadIncidentCreate(RoadIncidentBase):
    pass

class RoadIncidentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    estimated_clearance_time: Optional[datetime] = None
    is_active: Optional[bool] = None

class RoadIncidentResponse(RoadIncidentBase):
    id: int
    is_active: bool
    reporter_source: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Heatmap Data Schema
class TrafficHeatmapPoint(BaseModel):
    lat: float
    lng: float
    intensity: float = Field(..., ge=0, le=1)
    road_name: str
    status: str
    barangay: Optional[str] = None
    vehicle_count: Optional[int] = None
    congestion_percentage: Optional[float] = None
    data_source: Optional[str] = None

class TrafficHeatmapResponse(BaseModel):
    heatmap_data: List[TrafficHeatmapPoint]

# Route Request Schema
class RouteRequest(BaseModel):
    origin_lat: float = Field(..., ge=-90, le=90)
    origin_lng: float = Field(..., ge=-180, le=180)
    destination_lat: float = Field(..., ge=-90, le=90)
    destination_lng: float = Field(..., ge=-180, le=180)
    avoid_traffic: bool = True
    route_preference: str = Field("fastest", pattern="^(fastest|shortest|eco)$")

class NearbyIncidentsResponse(BaseModel):
    incidents: List[RoadIncidentResponse]
    radius_km: float

# Traffic Pattern Schemas
class TrafficPatternPoint(BaseModel):
    timestamp: datetime
    road_name: str
    average_speed_kph: float = Field(..., ge=0)
    vehicle_count: int = Field(..., ge=0)
    congestion_level: str = Field(..., pattern="^(low|moderate|heavy)$")

class TrafficPatternResponse(BaseModel):
    roads: List[str]
    interval_minutes: Literal[15] = 15
    start_time: datetime
    end_time: datetime
    data: List[TrafficPatternPoint]