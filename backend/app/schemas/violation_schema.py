from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from ..models.violation import ViolationType, ViolationStatus

class ViolationBase(BaseModel):
    violation_type: ViolationType
    description: Optional[str] = None
    fine_amount: Decimal
    driver_name: str
    driver_license: str
    vehicle_plate: str
    latitude: float
    longitude: float
    address: Optional[str] = None
    due_date: datetime

class ViolationCreate(ViolationBase):
    pass

class ViolationUpdate(BaseModel):
    violation_type: Optional[ViolationType] = None
    description: Optional[str] = None
    fine_amount: Optional[Decimal] = None
    status: Optional[ViolationStatus] = None
    driver_name: Optional[str] = None
    driver_license: Optional[str] = None
    vehicle_plate: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    due_date: Optional[datetime] = None

class ViolationResponse(ViolationBase):
    id: int
    violation_number: str
    status: ViolationStatus
    enforcer_id: int
    issued_at: datetime

    class Config:
        from_attributes = True
