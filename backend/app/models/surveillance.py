from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class CameraType(enum.Enum):
    TRAFFIC = "traffic"
    SECURITY = "security"
    SPEED = "speed"
    INTERSECTION = "intersection"
    PEDESTRIAN = "pedestrian"
    PARKING = "parking"

class CameraStatus(enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ERROR = "error"

class RecordingQuality(enum.Enum):
    SD = "sd"
    HD = "hd"
    FULL_HD = "full_hd"
    FOUR_K = "4k"

class CCTVCamera(Base):
    __tablename__ = "cctv_cameras"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String(50), unique=True, index=True, nullable=False)
    camera_name = Column(String(255), nullable=False)
    camera_type = Column(Enum(CameraType, name='cameratype', create_type=False), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    rtsp_url = Column(String(500), nullable=True)
    web_url = Column(String(500), nullable=True)
    status = Column(Enum(CameraStatus, name='camerastatus', create_type=False), default=CameraStatus.OFFLINE, nullable=False)
    is_ptz = Column(Boolean, default=False, nullable=False)  # Pan-Tilt-Zoom capability
    has_night_vision = Column(Boolean, default=False, nullable=False)
    has_audio = Column(Boolean, default=False, nullable=False)
    recording_quality = Column(Enum(RecordingQuality, name='recordingquality', create_type=False), default=RecordingQuality.HD, nullable=False)
    viewing_angle_degrees = Column(Integer, default=90, nullable=False)
    coverage_radius_meters = Column(Float, default=100.0, nullable=False)
    installation_date = Column(DateTime(timezone=True), nullable=True)
    last_maintenance = Column(DateTime(timezone=True), nullable=True)
    operator_contact = Column(String(100), nullable=True)
    is_ai_enabled = Column(Boolean, default=False, nullable=False)  # AI detection capabilities
    detection_features = Column(JSON, nullable=True)  # Array of AI features: license_plate, face, vehicle_count
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class CameraIncident(Base):
    __tablename__ = "camera_incidents"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cctv_cameras.id"), nullable=False)
    incident_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="medium", nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    video_filename = Column(String(255), nullable=True)
    screenshot_filename = Column(String(255), nullable=True)
    ai_confidence = Column(Float, nullable=True)  # 0-1 for AI-detected incidents
    is_verified = Column(Boolean, default=False, nullable=False)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    tags = Column(JSON, nullable=True)  # Array of tags for categorization
    license_plates = Column(JSON, nullable=True)  # Array of detected license plates
    vehicle_count = Column(Integer, nullable=True)
    people_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    camera = relationship("CCTVCamera", backref="incidents")
    verifier = relationship("User", backref="verified_incidents")

class VehicleDetection(Base):
    __tablename__ = "vehicle_detections"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cctv_cameras.id"), nullable=False)
    detection_timestamp = Column(DateTime(timezone=True), nullable=False)
    vehicle_type = Column(String(50), nullable=False)  # car, truck, motorcycle, bus, etc.
    license_plate = Column(String(20), nullable=True)
    confidence_score = Column(Float, nullable=False)  # AI confidence 0-1
    bounding_box = Column(JSON, nullable=True)  # x, y, width, height
    speed_kmh = Column(Float, nullable=True)
    direction = Column(String(20), nullable=True)  # north, south, east, west
    color = Column(String(30), nullable=True)
    make_model = Column(String(100), nullable=True)
    is_violation = Column(Boolean, default=False, nullable=False)
    violation_type = Column(String(100), nullable=True)
    image_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    camera = relationship("CCTVCamera", backref="vehicle_detections")

class TrafficAnalytics(Base):
    __tablename__ = "traffic_analytics"

    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cctv_cameras.id"), nullable=True)
    analysis_period_start = Column(DateTime(timezone=True), nullable=False)
    analysis_period_end = Column(DateTime(timezone=True), nullable=False)
    total_vehicles = Column(Integer, default=0, nullable=False)
    average_speed = Column(Float, nullable=True)
    vehicle_breakdown = Column(JSON, nullable=True)  # Count by vehicle type
    peak_hour_traffic = Column(JSON, nullable=True)  # Hourly breakdown
    violations_detected = Column(Integer, default=0, nullable=False)
    congestion_level = Column(String(20), nullable=True)  # low, medium, high
    weather_condition = Column(String(50), nullable=True)
    special_events = Column(Text, nullable=True)  # Notes about events affecting traffic
    data_quality_score = Column(Float, default=1.0, nullable=False)  # 0-1 scale
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    camera = relationship("CCTVCamera", backref="analytics")
