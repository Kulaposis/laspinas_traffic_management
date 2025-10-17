from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..models.report import ReportType, ReportStatus

class ReportBase(BaseModel):
    title: str
    description: Optional[str] = None
    report_type: ReportType
    latitude: float
    longitude: float
    address: Optional[str] = None
    image_url: Optional[str] = None

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    report_type: Optional[ReportType] = None
    status: Optional[ReportStatus] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    image_url: Optional[str] = None

class ReportResponse(ReportBase):
    id: int
    status: ReportStatus
    reporter_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
