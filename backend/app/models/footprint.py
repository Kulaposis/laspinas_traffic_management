from sqlalchemy import Column, Integer, String, DateTime, Float, Enum
from sqlalchemy.sql import func
from ..db import Base
import enum

class CrowdLevel(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Footprint(Base):
    __tablename__ = "footprints"

    id = Column(Integer, primary_key=True, index=True)
    area_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_meters = Column(Float, default=100.0, nullable=False)  # Area coverage in meters
    pedestrian_count = Column(Integer, default=0, nullable=False)
    crowd_level = Column(Enum(CrowdLevel, name='crowdlevel', create_type=False), default=CrowdLevel.LOW, nullable=False)
    temperature_celsius = Column(Float, nullable=True)
    humidity_percent = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
