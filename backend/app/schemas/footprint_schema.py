from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..models.footprint import CrowdLevel

class FootprintBase(BaseModel):
    area_name: str
    latitude: float
    longitude: float
    radius_meters: float = 100.0
    pedestrian_count: int = 0
    crowd_level: CrowdLevel = CrowdLevel.LOW
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None

class FootprintCreate(FootprintBase):
    pass

class FootprintUpdate(BaseModel):
    area_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[float] = None
    pedestrian_count: Optional[int] = None
    crowd_level: Optional[CrowdLevel] = None
    temperature_celsius: Optional[float] = None
    humidity_percent: Optional[float] = None

class FootprintResponse(FootprintBase):
    id: int
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
