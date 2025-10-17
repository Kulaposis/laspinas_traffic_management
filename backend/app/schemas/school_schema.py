from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, time

class SchoolBase(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    contact_person: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    student_population: Optional[int] = None
    morning_dismissal_time: Optional[time] = None
    afternoon_dismissal_time: Optional[time] = None

class SchoolCreate(SchoolBase):
    pass

class SchoolUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    contact_person: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    student_population: Optional[int] = None
    morning_dismissal_time: Optional[time] = None
    afternoon_dismissal_time: Optional[time] = None
    is_active: Optional[bool] = None

class SchoolResponse(SchoolBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
