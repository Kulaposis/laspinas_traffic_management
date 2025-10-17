from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from .user import Base

class TravelSession(Base):
    __tablename__ = "travel_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    origin_name = Column(String(255))
    origin_lat = Column(Float)
    origin_lng = Column(Float)
    destination_name = Column(String(255))
    destination_lat = Column(Float)
    destination_lng = Column(Float)
    route_data = Column(JSON)  # Store route coordinates and details
    duration_minutes = Column(Float)
    distance_km = Column(Float)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    travel_mode = Column(String(50), default='car')
    traffic_conditions = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="travel_sessions")

class FavoriteRoute(Base):
    __tablename__ = "favorite_routes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    origin_name = Column(String(255))
    origin_lat = Column(Float)
    origin_lng = Column(Float)
    destination_name = Column(String(255))
    destination_lat = Column(Float)
    destination_lng = Column(Float)
    route_summary = Column(JSON)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="favorite_routes")

# Note: User model relationships should be added to user.py to avoid circular imports
