from sqlalchemy import Column, Integer, String, DateTime, Float, Enum, Boolean, Text, ForeignKey, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db import Base
import enum

class RewardType(enum.Enum):
    POINTS = "points"
    BADGE = "badge"
    CERTIFICATE = "certificate"
    DISCOUNT = "discount"
    CASH = "cash"
    GIFT = "gift"

class ActionType(enum.Enum):
    REPORT_VIOLATION = "report_violation"
    REPORT_INCIDENT = "report_incident"
    VERIFIED_REPORT = "verified_report"
    COMPLAINT_RESOLVED = "complaint_resolved"
    SUGGESTION_IMPLEMENTED = "suggestion_implemented"
    SAFE_DRIVING = "safe_driving"
    COMMUNITY_SERVICE = "community_service"
    REFERRAL = "referral"

class BadgeLevel(enum.Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"

class RedemptionStatus(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REDEEMED = "redeemed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"

class UserRewards(Base):
    __tablename__ = "user_rewards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_points = Column(Integer, default=0, nullable=False)
    lifetime_points = Column(Integer, default=0, nullable=False)
    current_level = Column(Integer, default=1, nullable=False)
    points_to_next_level = Column(Integer, default=100, nullable=False)
    badges_earned = Column(Integer, default=0, nullable=False)
    reports_submitted = Column(Integer, default=0, nullable=False)
    verified_reports = Column(Integer, default=0, nullable=False)
    accuracy_rating = Column(Float, default=0.0, nullable=False)  # 0-5 scale
    consecutive_days = Column(Integer, default=0, nullable=False)
    last_activity = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", backref="rewards")

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_type = Column(Enum(ActionType), nullable=False)
    points_earned = Column(Integer, default=0, nullable=False)
    points_deducted = Column(Integer, default=0, nullable=False)
    description = Column(String(255), nullable=False)
    reference_id = Column(Integer, nullable=True)  # ID of related report/complaint/etc.
    reference_type = Column(String(50), nullable=True)  # report, violation, complaint, etc.
    multiplier = Column(Float, default=1.0, nullable=False)
    bonus_reason = Column(String(255), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="reward_transactions")
    verifier = relationship("User", foreign_keys=[verified_by], backref="verified_transactions")

class Badge(Base):
    __tablename__ = "badges"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    badge_level = Column(Enum(BadgeLevel), nullable=False)
    icon_url = Column(String(500), nullable=True)
    requirements = Column(Text, nullable=False)  # JSON describing requirements
    points_required = Column(Integer, nullable=True)
    reports_required = Column(Integer, nullable=True)
    accuracy_required = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_limited_time = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_id = Column(Integer, ForeignKey("badges.id"), nullable=False)
    earned_at = Column(DateTime(timezone=True), server_default=func.now())
    is_featured = Column(Boolean, default=False, nullable=False)
    progress_percentage = Column(Float, default=100.0, nullable=False)

    # Relationships
    user = relationship("User", backref="user_badges")
    badge = relationship("Badge", backref="user_badges")

class RewardCatalog(Base):
    __tablename__ = "reward_catalog"

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    reward_type = Column(Enum(RewardType), nullable=False)
    points_cost = Column(Integer, nullable=False)
    cash_value = Column(Numeric(10, 2), nullable=True)
    discount_percentage = Column(Float, nullable=True)
    partner_business = Column(String(255), nullable=True)
    category = Column(String(100), nullable=False)
    image_url = Column(String(500), nullable=True)
    terms_conditions = Column(Text, nullable=True)
    stock_quantity = Column(Integer, nullable=True)
    max_per_user = Column(Integer, default=1, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class RewardRedemption(Base):
    __tablename__ = "reward_redemptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    catalog_item_id = Column(Integer, ForeignKey("reward_catalog.id"), nullable=False)
    redemption_code = Column(String(50), unique=True, index=True, nullable=False)
    points_used = Column(Integer, nullable=False)
    status = Column(Enum(RedemptionStatus), default=RedemptionStatus.PENDING, nullable=False)
    delivery_address = Column(Text, nullable=True)
    delivery_phone = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="redemptions")
    catalog_item = relationship("RewardCatalog", backref="redemptions")
    processor = relationship("User", foreign_keys=[processed_by], backref="processed_redemptions")
