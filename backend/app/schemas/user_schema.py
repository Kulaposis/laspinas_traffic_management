from pydantic import BaseModel, EmailStr, field_serializer
from typing import Optional
from datetime import datetime
from ..models.user import UserRole
from ..utils.role_helpers import normalize_role

class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    phone_number: Optional[str] = None
    role: UserRole = UserRole.CITIZEN

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_serializer('role')
    def serialize_role(self, role: UserRole, _info):
        """Serialize role to lowercase for frontend compatibility."""
        return normalize_role(role)

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str  # Can be username or email
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class FirebaseSync(BaseModel):
    uid: str
    email: EmailStr
    full_name: Optional[str] = None
    photo_url: Optional[str] = None
    email_verified: Optional[bool] = False
    firebase_token: Optional[str] = None
