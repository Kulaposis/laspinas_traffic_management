from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, Numeric
from sqlalchemy.sql import func
from ..db import Base

class NoParkingZone(Base):
    __tablename__ = "no_parking_zones"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    zone_type = Column(String(50), nullable=False)  # restricted, road_restriction, bus_stop
    restriction_reason = Column(String(100), nullable=False)  # fire_station, hospital, school, etc.
    radius_meters = Column(Integer, nullable=False, default=20)
    is_strict = Column(Boolean, default=True, nullable=False)  # Strict enforcement
    fine_amount = Column(Numeric(10, 2), nullable=False, default=1000.0)
    enforcement_hours = Column(String(20), nullable=False, default="24/7")  # e.g., "6:00-22:00" or "24/7"
    address = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
