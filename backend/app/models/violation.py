from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class ViolationType(enum.Enum):
    SPEEDING = "SPEEDING"
    ILLEGAL_PARKING = "ILLEGAL_PARKING"
    RUNNING_RED_LIGHT = "RUNNING_RED_LIGHT"
    NO_SEATBELT = "NO_SEATBELT"
    DRUNK_DRIVING = "DRUNK_DRIVING"
    RECKLESS_DRIVING = "RECKLESS_DRIVING"
    EXPIRED_LICENSE = "EXPIRED_LICENSE"
    NO_HELMET = "NO_HELMET"
    OTHER = "OTHER"

class ViolationStatus(enum.Enum):
    ISSUED = "ISSUED"
    PAID = "PAID"
    CONTESTED = "CONTESTED"
    DISMISSED = "DISMISSED"

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_number = Column(String(50), unique=True, index=True, nullable=False)
    violation_type = Column(Enum(ViolationType, name='violationtype', create_type=False), nullable=False)
    description = Column(Text, nullable=True)
    fine_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(ViolationStatus, name='violationstatus', create_type=False), default=ViolationStatus.ISSUED, nullable=False)
    driver_name = Column(String(255), nullable=False)
    driver_license = Column(String(50), nullable=False)
    vehicle_plate = Column(String(20), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    enforcer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=False)

    # Relationships
    enforcer = relationship("User", back_populates="violations")
