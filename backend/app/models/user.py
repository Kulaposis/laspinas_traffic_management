from sqlalchemy import Column, Integer, String, DateTime, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class UserRole(enum.Enum):
    CITIZEN = "citizen"
    LGU_STAFF = "lgu_staff"
    TRAFFIC_ENFORCER = "traffic_enforcer"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for Firebase users
    full_name = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=True)
    role = Column(Enum(UserRole, name='userrole', create_type=False, values_callable=lambda obj: [e.value for e in obj]), default=UserRole.CITIZEN, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    firebase_uid = Column(String(128), nullable=True, index=True)  # Firebase UID - uniqueness enforced by partial index
    photo_url = Column(String(512), nullable=True)  # Profile photo URL
    email_verified = Column(Boolean, default=False, nullable=False)  # Email verification status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reports = relationship("Report", back_populates="reporter")
    violations = relationship("Violation", back_populates="enforcer")
    notifications = relationship("Notification", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
    travel_sessions = relationship("TravelSession", back_populates="user")
    favorite_routes = relationship("FavoriteRoute", back_populates="user")
