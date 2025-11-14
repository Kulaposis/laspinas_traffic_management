from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from ..models.events import EmergencyType, EmergencyStatus

# Emergency Schemas
class EmergencyBase(BaseModel):
    emergency_type: EmergencyType
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    severity: str = Field("medium", pattern="^(low|medium|high|critical)$")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: Optional[str] = Field(None, max_length=500)

class EmergencyCreate(EmergencyBase):
    photo_urls: Optional[List[str]] = Field(None, description="List of photo URLs attached to the emergency report")
    reporter_phone: Optional[str] = Field(
        None,
        max_length=20,
        description="Optional contact number of the reporter for follow-up"
    )

class EmergencyUpdate(BaseModel):
    status: Optional[EmergencyStatus] = None
    severity: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    assigned_responder: Optional[str] = Field(None, max_length=255)
    estimated_response_time: Optional[int] = Field(None, gt=0)
    actual_response_time: Optional[int] = Field(None, gt=0)
    resolution_notes: Optional[str] = None
    requires_traffic_control: Optional[bool] = None

class EmergencyResponse(EmergencyBase):
    id: int
    emergency_number: str
    status: EmergencyStatus
    reporter_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    assigned_responder: Optional[str] = None
    estimated_response_time: Optional[int] = None
    actual_response_time: Optional[int] = None
    resolution_notes: Optional[str] = None
    requires_traffic_control: bool
    
    # Photo and moderation fields
    photo_urls: Optional[List[str]] = None
    is_verified: bool = False
    verification_status: str = "pending"
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    moderation_priority: str = "normal"
    
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Complaint & Suggestion Schemas
class ComplaintSuggestionBase(BaseModel):
    type: str = Field(..., pattern="^(complaint|suggestion)$")
    category: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    location_description: Optional[str] = Field(None, max_length=500)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    evidence_urls: Optional[str] = None  # JSON array of URLs

class ComplaintSuggestionCreate(ComplaintSuggestionBase):
    pass

class ComplaintSuggestionUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(submitted|reviewing|resolved|closed)$")
    priority: Optional[str] = Field(None, pattern="^(low|medium|high)$")
    assigned_department: Optional[str] = Field(None, max_length=100)
    response_message: Optional[str] = None

class ComplaintSuggestionResponse(ComplaintSuggestionBase):
    id: int
    reporter_id: Optional[int] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_phone: Optional[str] = None
    status: str
    priority: str
    assigned_department: Optional[str] = None
    response_message: Optional[str] = None
    response_date: Optional[datetime] = None
    is_anonymous: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Statistics Response Schema
class EmergencyStatistics(BaseModel):
    total: int
    resolved: int
    active: int
    resolution_rate: float
    avg_response_time_minutes: float

class ComplaintStatistics(BaseModel):
    total_complaints: int
    total_suggestions: int
    resolved: int
    resolution_rate: float

class EmergencyComplaintStatisticsResponse(BaseModel):
    period_days: int
    emergency_statistics: EmergencyStatistics
    complaint_statistics: ComplaintStatistics

# Content Moderation Schemas
class EmergencyModerationUpdate(BaseModel):
    verification_status: str = Field(..., pattern="^(pending|verified|rejected|flagged)$")
    verification_notes: Optional[str] = None
    moderation_priority: Optional[str] = Field(None, pattern="^(low|normal|high|urgent)$")

class EmergencyModerationResponse(BaseModel):
    id: int
    emergency_number: str
    emergency_type: EmergencyType
    title: str
    description: Optional[str] = None
    severity: str
    photo_urls: Optional[List[str]] = None
    verification_status: str
    moderation_priority: str
    is_verified: bool
    verified_by: Optional[int] = None
    verified_at: Optional[datetime] = None
    verification_notes: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_phone: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ModerationQueueResponse(BaseModel):
    total_pending: int
    high_priority: int
    flagged_reports: int
    pending_reports: List[EmergencyModerationResponse]
