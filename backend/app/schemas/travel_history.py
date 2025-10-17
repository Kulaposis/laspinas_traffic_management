from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class TravelSessionBase(BaseModel):
    origin_name: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_name: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    route_data: Optional[Dict[str, Any]] = None
    duration_minutes: Optional[float] = None
    distance_km: Optional[float] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    travel_mode: str = "car"
    traffic_conditions: Optional[str] = None
    notes: Optional[str] = None

class TravelSessionCreate(TravelSessionBase):
    pass

class TravelSessionResponse(TravelSessionBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class FavoriteRouteBase(BaseModel):
    name: str
    origin_name: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_name: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    route_summary: Optional[Dict[str, Any]] = None
    is_default: bool = False

class FavoriteRouteCreate(FavoriteRouteBase):
    pass

class FavoriteRouteResponse(FavoriteRouteBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class FrequentLocationResponse(BaseModel):
    name: str
    lat: float
    lng: float
    count: int
    type: str

    class Config:
        from_attributes = True

class TravelStatsResponse(BaseModel):
    total_trips: int
    total_distance_km: float
    total_time_minutes: float
    average_speed_kmh: float
    most_frequent_destination: Optional[Dict[str, Any]] = None
    travel_patterns: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True
