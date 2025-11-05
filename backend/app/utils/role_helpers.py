"""
Helper functions for role checking and normalization
"""

from typing import Union
from ..models.user import UserRole

def normalize_role(role: Union[UserRole, str]) -> str:
    """Normalize role to lowercase string for frontend compatibility."""
    if isinstance(role, UserRole):
        return role.value.lower()
    elif isinstance(role, str):
        return role.lower()
    return str(role).lower()

def get_role_value(role: Union[UserRole, str]) -> str:
    """Get role value as string, handling both enum and string."""
    if isinstance(role, UserRole):
        return role.value
    return str(role)

def is_admin(role: Union[UserRole, str]) -> bool:
    """Check if role is admin (case-insensitive)."""
    role_value = get_role_value(role)
    return role_value.upper() == "ADMIN"

def is_authorized(role: Union[UserRole, str], allowed_roles: list) -> bool:
    """Check if role is in allowed_roles list (case-insensitive)."""
    role_value = get_role_value(role).upper()
    allowed_upper = []
    for r in allowed_roles:
        if isinstance(r, str):
            allowed_upper.append(r.upper())
        elif isinstance(r, UserRole):
            allowed_upper.append(r.value.upper())
        else:
            allowed_upper.append(str(r).upper())
    result = role_value in allowed_upper
    return result

def check_role_access(role: Union[UserRole, str], allowed_roles: list) -> tuple[bool, str]:
    """
    Check if role has access and return (has_access, role_value).
    More explicit version for debugging.
    """
    role_value = get_role_value(role)
    role_upper = role_value.upper()
    allowed_upper = [r.upper() if isinstance(r, str) else (r.value.upper() if isinstance(r, UserRole) else str(r).upper()) for r in allowed_roles]
    has_access = role_upper in allowed_upper
    return has_access, role_value

