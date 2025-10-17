from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from ..models.weather import WeatherCondition, FloodLevel

# Weather Data Schemas
class WeatherDataBase(BaseModel):
    area_name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    temperature_celsius: float = Field(..., ge=-50, le=60)
    humidity_percent: float = Field(..., ge=0, le=100)
    wind_speed_kmh: Optional[float] = Field(None, ge=0)
    wind_direction: Optional[str] = Field(None, pattern="^(N|NE|E|SE|S|SW|W|NW)$")
    rainfall_mm: float = Field(0.0, ge=0)
    weather_condition: WeatherCondition
    visibility_km: Optional[float] = Field(None, ge=0)
    pressure_hpa: Optional[float] = Field(None, ge=800, le=1200)
    data_source: str = Field("weather_api", max_length=50)

class WeatherDataCreate(WeatherDataBase):
    pass

class WeatherDataResponse(WeatherDataBase):
    id: int
    recorded_at: datetime

    class Config:
        from_attributes = True

# Flood Monitoring Schemas
class FloodMonitoringBase(BaseModel):
    location_name: str = Field(..., min_length=1, max_length=255)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    water_level_cm: float = Field(..., ge=0)
    flood_level: FloodLevel = FloodLevel.NORMAL
    is_flood_prone: bool = False
    evacuation_center_nearby: Optional[str] = Field(None, max_length=500)
    affected_roads: Optional[str] = None
    estimated_passable: bool = True
    alert_level: int = Field(0, ge=0, le=4)
    sensor_id: Optional[str] = Field(None, max_length=50)

class FloodMonitoringCreate(FloodMonitoringBase):
    pass

class FloodMonitoringUpdate(BaseModel):
    water_level_cm: Optional[float] = Field(None, ge=0)
    flood_level: Optional[FloodLevel] = None
    estimated_passable: Optional[bool] = None
    alert_level: Optional[int] = Field(None, ge=0, le=4)
    affected_roads: Optional[str] = None

class FloodMonitoringResponse(FloodMonitoringBase):
    id: int
    last_updated: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# Weather Alert Schemas
class WeatherAlertBase(BaseModel):
    alert_type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    severity: str = Field(..., pattern="^(advisory|watch|warning|critical)$")
    affected_areas: str = Field(..., description="JSON array of area names")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: float = Field(5.0, gt=0)
    expires_at: Optional[datetime] = None
    traffic_impact: Optional[str] = None

class WeatherAlertCreate(WeatherAlertBase):
    pass

class WeatherAlertUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    message: Optional[str] = None
    severity: Optional[str] = Field(None, pattern="^(advisory|watch|warning|critical)$")
    expires_at: Optional[datetime] = None
    traffic_impact: Optional[str] = None
    is_active: Optional[bool] = None

class WeatherAlertResponse(WeatherAlertBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Combined Advisory Schemas
class WeatherTrafficAdvisoryResponse(BaseModel):
    location: dict
    radius_km: float
    current_weather: Optional[WeatherDataResponse] = None
    weather_alerts: List[WeatherAlertResponse]
    flood_alerts: List[FloodMonitoringResponse]
    traffic_incidents: List[dict]  # From traffic incidents
    advisory_level: str

class WeatherHistoryResponse(BaseModel):
    area_name: str
    period_hours: int
    data_points: int
    weather_data: List[WeatherDataResponse]
