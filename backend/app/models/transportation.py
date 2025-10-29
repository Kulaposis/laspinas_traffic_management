from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, JSON, Numeric
from sqlalchemy.sql import func
from ..db import Base
import enum

class TransportType(enum.Enum):
    JEEPNEY = "JEEPNEY"
    BUS = "BUS"
    TRICYCLE = "TRICYCLE"
    FX = "FX"
    UV_EXPRESS = "UV_EXPRESS"
    TAXI = "TAXI"
    MOTORCYCLE_TAXI = "MOTORCYCLE_TAXI"

class VehicleStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    IN_TERMINAL = "IN_TERMINAL"
    ON_ROUTE = "ON_ROUTE"
    BREAKDOWN = "BREAKDOWN"
    MAINTENANCE = "MAINTENANCE"

class RouteStatus(enum.Enum):
    OPERATIONAL = "OPERATIONAL"
    SUSPENDED = "SUSPENDED"
    PARTIAL = "PARTIAL"
    REROUTED = "REROUTED"

class PublicTransportRoute(Base):
    __tablename__ = "public_transport_routes"

    id = Column(Integer, primary_key=True, index=True)
    route_name = Column(String(255), nullable=False)
    route_code = Column(String(50), unique=True, index=True, nullable=False)
    transport_type = Column(Enum(TransportType, name='transporttype', create_type=False), nullable=False)
    origin = Column(String(255), nullable=False)
    destination = Column(String(255), nullable=False)
    route_coordinates = Column(JSON, nullable=False)  # Array of [lat, lng] waypoints
    stops = Column(JSON, nullable=False)  # Array of stop objects with name, lat, lng
    distance_km = Column(Float, nullable=False)
    estimated_duration_minutes = Column(Integer, nullable=False)
    fare_amount = Column(Numeric(10, 2), nullable=False)
    operating_hours_start = Column(String(5), nullable=False)  # HH:MM
    operating_hours_end = Column(String(5), nullable=False)    # HH:MM
    frequency_minutes = Column(Integer, default=15, nullable=False)  # Average frequency
    status = Column(Enum(RouteStatus, name='routestatus', create_type=False), default=RouteStatus.OPERATIONAL, nullable=False)
    is_airconditioned = Column(Boolean, default=False, nullable=False)
    wheelchair_accessible = Column(Boolean, default=False, nullable=False)
    operator_name = Column(String(255), nullable=True)
    operator_contact = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class PublicTransportVehicle(Base):
    __tablename__ = "public_transport_vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(50), unique=True, index=True, nullable=False)
    plate_number = Column(String(20), nullable=False)
    transport_type = Column(Enum(TransportType, name='transporttype', create_type=False), nullable=False)
    route_id = Column(Integer, nullable=True)  # Can be null if not assigned to route
    driver_name = Column(String(255), nullable=True)
    driver_contact = Column(String(20), nullable=True)
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    status = Column(Enum(VehicleStatus, name='vehiclestatus', create_type=False), default=VehicleStatus.INACTIVE, nullable=False)
    passenger_capacity = Column(Integer, nullable=False)
    current_passenger_count = Column(Integer, default=0, nullable=False)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    next_eta_minutes = Column(Integer, nullable=True)  # ETA to next stop
    is_gps_enabled = Column(Boolean, default=False, nullable=False)
    fuel_level_percent = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TransportStop(Base):
    __tablename__ = "transport_stops"

    id = Column(Integer, primary_key=True, index=True)
    stop_name = Column(String(255), nullable=False)
    stop_code = Column(String(20), unique=True, index=True, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(500), nullable=True)
    stop_type = Column(String(50), default="regular", nullable=False)  # regular, terminal, interchange
    has_shelter = Column(Boolean, default=False, nullable=False)
    has_seating = Column(Boolean, default=False, nullable=False)
    accessibility_features = Column(JSON, nullable=True)  # Array of accessibility features
    nearby_landmarks = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TransportETA(Base):
    __tablename__ = "transport_eta"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, nullable=False)
    stop_id = Column(Integer, nullable=False)
    vehicle_id = Column(Integer, nullable=True)
    estimated_arrival = Column(DateTime(timezone=True), nullable=False)
    confidence_level = Column(Float, default=0.8, nullable=False)  # 0-1 scale
    passenger_load = Column(String(20), nullable=True)  # light, moderate, heavy, full
    delay_minutes = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class TransportDisruption(Base):
    __tablename__ = "transport_disruptions"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, nullable=True)
    transport_type = Column(Enum(TransportType, name='transporttype', create_type=False), nullable=False)
    disruption_type = Column(String(50), nullable=False)  # strike, accident, road_closure, weather
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    affected_routes = Column(JSON, nullable=True)  # Array of route IDs
    alternative_routes = Column(JSON, nullable=True)  # Array of alternative route suggestions
    start_time = Column(DateTime(timezone=True), nullable=False)
    estimated_end_time = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    severity = Column(String(20), default="medium", nullable=False)  # low, medium, high
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
