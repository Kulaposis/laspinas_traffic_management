from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class EventType(enum.Enum):
    FIESTA = "fiesta"
    FESTIVAL = "festival"
    PARADE = "parade"
    RALLY = "rally"
    SPORTS_EVENT = "sports_event"
    CONCERT = "concert"
    GRADUATION = "graduation"
    CONSTRUCTION = "construction"
    ROAD_REPAIR = "road_repair"
    MARKET_DAY = "market_day"
    OTHER = "other"

class EventStatus(enum.Enum):
    PLANNED = "planned"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class EmergencyType(enum.Enum):
    ACCIDENT = "accident"
    MEDICAL = "medical"
    FIRE = "fire"
    CRIME = "crime"
    ROAD_HAZARD = "road_hazard"
    VEHICLE_BREAKDOWN = "vehicle_breakdown"
    OTHER = "other"

class EmergencyStatus(enum.Enum):
    REPORTED = "reported"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(EventType), nullable=False)
    status = Column(Enum(EventStatus), default=EventStatus.PLANNED, nullable=False)
    venue_name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    expected_attendees = Column(Integer, nullable=True)
    organizer_name = Column(String(255), nullable=True)
    organizer_contact = Column(String(100), nullable=True)
    traffic_impact = Column(Text, nullable=True)  # Expected traffic impact description
    road_closures = Column(Text, nullable=True)  # JSON array of roads to be closed
    alternative_routes = Column(Text, nullable=True)  # JSON array of suggested routes
    is_public = Column(Boolean, default=True, nullable=False)
    requires_permits = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(Integer, primary_key=True, index=True)
    emergency_number = Column(String(20), unique=True, index=True, nullable=False)
    emergency_type = Column(Enum(EmergencyType), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(EmergencyStatus), default=EmergencyStatus.REPORTED, nullable=False)
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high, critical
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_name = Column(String(255), nullable=True)  # For anonymous reports
    reporter_phone = Column(String(20), nullable=True)
    assigned_responder = Column(String(255), nullable=True)
    estimated_response_time = Column(Integer, nullable=True)  # minutes
    actual_response_time = Column(Integer, nullable=True)  # minutes
    resolution_notes = Column(Text, nullable=True)
    requires_traffic_control = Column(Boolean, default=False, nullable=False)
    
    # Photo attachment and moderation fields
    photo_urls = Column(Text, nullable=True)  # JSON array of uploaded photo URLs
    is_verified = Column(Boolean, default=False, nullable=False)  # Whether the report has been verified by admin
    verification_status = Column(String(20), default="pending", nullable=False)  # pending, verified, rejected, flagged
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who verified the report
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_notes = Column(Text, nullable=True)
    moderation_priority = Column(String(20), default="normal", nullable=False)  # low, normal, high, urgent
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    reporter = relationship("User", backref="emergency_reports", foreign_keys=[reporter_id])
    verifier = relationship("User", foreign_keys=[verified_by])

class ComplaintSuggestion(Base):
    __tablename__ = "complaints_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False)  # complaint, suggestion
    category = Column(String(100), nullable=False)  # illegal_parking, reckless_driving, infrastructure, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    location_description = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    evidence_urls = Column(Text, nullable=True)  # JSON array of image/video URLs
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_name = Column(String(255), nullable=True)  # For anonymous reports
    reporter_email = Column(String(255), nullable=True)
    reporter_phone = Column(String(20), nullable=True)
    status = Column(String(20), default="submitted", nullable=False)  # submitted, reviewing, resolved, closed
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    assigned_department = Column(String(100), nullable=True)
    response_message = Column(Text, nullable=True)
    response_date = Column(DateTime(timezone=True), nullable=True)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reporter = relationship("User", backref="complaints_suggestions")
