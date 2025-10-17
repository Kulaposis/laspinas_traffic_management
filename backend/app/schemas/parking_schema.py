from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from ..models.parking import ParkingType, ParkingStatus

class ParkingBase(BaseModel):
    name: str
    description: Optional[str] = None
    parking_type: ParkingType
    total_spaces: int
    available_spaces: int
    hourly_rate: Optional[Decimal] = None
    latitude: float
    longitude: float
    address: str
    is_monitored: bool = False
    operating_hours_start: Optional[str] = None
    operating_hours_end: Optional[str] = None

class ParkingCreate(ParkingBase):
    pass

class ParkingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parking_type: Optional[ParkingType] = None
    total_spaces: Optional[int] = None
    available_spaces: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    status: Optional[ParkingStatus] = None
    is_monitored: Optional[bool] = None
    operating_hours_start: Optional[str] = None
    operating_hours_end: Optional[str] = None

class ParkingResponse(ParkingBase):
    id: int
    status: ParkingStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
