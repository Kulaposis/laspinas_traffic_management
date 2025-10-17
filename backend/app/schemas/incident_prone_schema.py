from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from ..models.traffic import IncidentProneAreaType

class IncidentProneAreaBase(BaseModel):
    area_name: str = Field(..., min_length=1, max_length=255)
    area_type: IncidentProneAreaType
    description: Optional[str] = None
    severity_level: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(default=500.0, gt=0)
    affected_roads: Optional[List[str]] = None
    barangay: Optional[str] = None
    incident_count: int = Field(default=0, ge=0)
    peak_hours: Optional[List[str]] = None
    common_incident_types: Optional[List[str]] = None
    risk_score: float = Field(default=0.0, ge=0, le=100)
    prevention_measures: Optional[str] = None
    alternative_routes: Optional[List[str]] = None
    data_source: str = Field(..., min_length=1, max_length=100)
    source_url: Optional[str] = None
    is_active: bool = Field(default=True)
    is_verified: bool = Field(default=False)

class IncidentProneAreaCreate(IncidentProneAreaBase):
    pass

class IncidentProneAreaUpdate(BaseModel):
    area_name: Optional[str] = Field(None, min_length=1, max_length=255)
    area_type: Optional[IncidentProneAreaType] = None
    description: Optional[str] = None
    severity_level: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_meters: Optional[float] = Field(None, gt=0)
    affected_roads: Optional[List[str]] = None
    barangay: Optional[str] = None
    incident_count: Optional[int] = Field(None, ge=0)
    peak_hours: Optional[List[str]] = None
    common_incident_types: Optional[List[str]] = None
    risk_score: Optional[float] = Field(None, ge=0, le=100)
    prevention_measures: Optional[str] = None
    alternative_routes: Optional[List[str]] = None
    data_source: Optional[str] = Field(None, min_length=1, max_length=100)
    source_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

class IncidentProneArea(IncidentProneAreaBase):
    id: int
    last_incident_date: Optional[datetime]
    last_verified: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class IncidentProneAreaList(BaseModel):
    areas: List[IncidentProneArea]
    total: int
    page: int
    per_page: int

class IncidentProneAreaStats(BaseModel):
    total_areas: int
    by_type: dict
    by_severity: dict
    high_risk_areas: int
    verified_areas: int
    last_updated: Optional[datetime]

class ScrapingRequest(BaseModel):
    sources: Optional[List[str]] = Field(default=["government", "social_media", "news"])
    update_existing: bool = Field(default=True)
    verify_data: bool = Field(default=False)

class ScrapingResult(BaseModel):
    success: bool
    total_scraped: int
    new_areas: int
    updated_areas: int
    errors: List[str]
    duration_seconds: float
