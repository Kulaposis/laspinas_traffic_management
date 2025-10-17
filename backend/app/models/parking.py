from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Numeric
from sqlalchemy.sql import func
from ..db import Base
import enum

class ParkingType(enum.Enum):
    STREET = "street"
    LOT = "lot"
    GARAGE = "garage"
    PRIVATE = "private"
    RESERVED = "reserved"

class ParkingStatus(enum.Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    OUT_OF_ORDER = "out_of_order"

class Parking(Base):
    __tablename__ = "parking"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    parking_type = Column(Enum(ParkingType), nullable=False)
    total_spaces = Column(Integer, nullable=False)
    available_spaces = Column(Integer, nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    status = Column(Enum(ParkingStatus), default=ParkingStatus.AVAILABLE, nullable=False)
    is_monitored = Column(Boolean, default=False, nullable=False)  # Real-time monitoring
    operating_hours_start = Column(String(5), nullable=True)  # HH:MM format
    operating_hours_end = Column(String(5), nullable=True)    # HH:MM format
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
