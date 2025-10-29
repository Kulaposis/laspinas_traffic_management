from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class ReportType(enum.Enum):
    ACCIDENT = "ACCIDENT"
    TRAFFIC_JAM = "TRAFFIC_JAM"
    ROAD_CLOSURE = "ROAD_CLOSURE"
    FLOODING = "FLOODING"
    BROKEN_TRAFFIC_LIGHT = "BROKEN_TRAFFIC_LIGHT"
    ILLEGAL_PARKING = "ILLEGAL_PARKING"
    OTHER = "OTHER"

class ReportStatus(enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(Enum(ReportType, name='reporttype', create_type=False), nullable=False)
    status = Column(Enum(ReportStatus, name='reportstatus', create_type=False), default=ReportStatus.PENDING, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reporter = relationship("User", back_populates="reports")
