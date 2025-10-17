from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class ViolationType(enum.Enum):
    SPEEDING = "speeding"
    ILLEGAL_PARKING = "illegal_parking"
    RUNNING_RED_LIGHT = "running_red_light"
    NO_SEATBELT = "no_seatbelt"
    DRUNK_DRIVING = "drunk_driving"
    RECKLESS_DRIVING = "reckless_driving"
    EXPIRED_LICENSE = "expired_license"
    NO_HELMET = "no_helmet"
    OTHER = "other"

class ViolationStatus(enum.Enum):
    ISSUED = "issued"
    PAID = "paid"
    CONTESTED = "contested"
    DISMISSED = "dismissed"

class Violation(Base):
    __tablename__ = "violations"

    id = Column(Integer, primary_key=True, index=True)
    violation_number = Column(String(50), unique=True, index=True, nullable=False)
    violation_type = Column(Enum(ViolationType), nullable=False)
    description = Column(Text, nullable=True)
    fine_amount = Column(Numeric(10, 2), nullable=False)
    status = Column(Enum(ViolationStatus), default=ViolationStatus.ISSUED, nullable=False)
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
