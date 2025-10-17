from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class NoParkingZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    zone_type: str  # restricted, road_restriction, bus_stop
    restriction_reason: str  # fire_station, hospital, school, etc.
    radius_meters: int = 20
    is_strict: bool = True
    fine_amount: Decimal = Decimal('1000.0')
    enforcement_hours: str = "24/7"
    address: str

class NoParkingZoneCreate(NoParkingZoneBase):
    pass

class NoParkingZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone_type: Optional[str] = None
    restriction_reason: Optional[str] = None
    radius_meters: Optional[int] = None
    is_strict: Optional[bool] = None
    fine_amount: Optional[Decimal] = None
    enforcement_hours: Optional[str] = None
    address: Optional[str] = None

class NoParkingZoneResponse(NoParkingZoneBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
