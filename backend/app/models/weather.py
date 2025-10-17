from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text
from sqlalchemy.sql import func
from ..db import Base
import enum

class WeatherCondition(enum.Enum):
    CLEAR = "clear"
    PARTLY_CLOUDY = "partly_cloudy"
    CLOUDY = "cloudy"
    LIGHT_RAIN = "light_rain"
    MODERATE_RAIN = "moderate_rain"
    HEAVY_RAIN = "heavy_rain"
    THUNDERSTORM = "thunderstorm"
    FOG = "fog"

class FloodLevel(enum.Enum):
    NORMAL = "normal"
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"

class WeatherData(Base):
    __tablename__ = "weather_data"

    id = Column(Integer, primary_key=True, index=True)
    area_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    temperature_celsius = Column(Float, nullable=False)
    humidity_percent = Column(Float, nullable=False)
    wind_speed_kmh = Column(Float, nullable=True)
    wind_direction = Column(String(10), nullable=True)  # N, NE, E, SE, S, SW, W, NW
    rainfall_mm = Column(Float, default=0.0, nullable=False)
    weather_condition = Column(Enum(WeatherCondition), nullable=False)
    visibility_km = Column(Float, nullable=True)
    pressure_hpa = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    data_source = Column(String(50), default="weather_api", nullable=False)  # weather_api, sensor, manual

class FloodMonitoring(Base):
    __tablename__ = "flood_monitoring"

    id = Column(Integer, primary_key=True, index=True)
    location_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    water_level_cm = Column(Float, nullable=False)
    flood_level = Column(Enum(FloodLevel), default=FloodLevel.NORMAL, nullable=False)
    is_flood_prone = Column(Boolean, default=False, nullable=False)
    evacuation_center_nearby = Column(String(500), nullable=True)
    affected_roads = Column(Text, nullable=True)  # JSON array of road names
    estimated_passable = Column(Boolean, default=True, nullable=False)
    alert_level = Column(Integer, default=0, nullable=False)  # 0-4 scale
    sensor_id = Column(String(50), nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WeatherAlert(Base):
    __tablename__ = "weather_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(50), nullable=False)  # flood, rain, storm, heat_index
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)  # advisory, watch, warning, critical
    affected_areas = Column(Text, nullable=False)  # JSON array of area names
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, default=5.0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    traffic_impact = Column(Text, nullable=True)  # Expected traffic impact description
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
