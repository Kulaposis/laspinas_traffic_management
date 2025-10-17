from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import get_db
from ..auth import get_current_active_user
from ..models.user import User
from ..models.violation import ViolationStatus
from ..schemas.violation_schema import ViolationCreate, ViolationUpdate, ViolationResponse
from ..services.violation_service import ViolationService

router = APIRouter(prefix="/violations", tags=["violations"])

@router.post("/", response_model=ViolationResponse, status_code=status.HTTP_201_CREATED)
def create_violation(
    violation_data: ViolationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new traffic violation (enforcers only)."""
    violation_service = ViolationService(db)
    violation = violation_service.create_violation(violation_data, current_user)
    return violation

@router.get("/", response_model=List[ViolationResponse])
def get_violations(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[ViolationStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of violations."""
    violation_service = ViolationService(db)
    violations = violation_service.get_violations(skip=skip, limit=limit, status=status_filter)
    return violations

@router.get("/number/{violation_number}", response_model=ViolationResponse)
def get_violation_by_number(
    violation_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a violation by its violation number."""
    violation_service = ViolationService(db)
    violation = violation_service.get_violation_by_number(violation_number)
    return violation

@router.get("/license/{driver_license}", response_model=List[ViolationResponse])
def get_violations_by_license(
    driver_license: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get violations by driver license."""
    violation_service = ViolationService(db)
    violations = violation_service.get_violations_by_license(driver_license)
    return violations

@router.get("/plate/{vehicle_plate}", response_model=List[ViolationResponse])
def get_violations_by_plate(
    vehicle_plate: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get violations by vehicle plate."""
    violation_service = ViolationService(db)
    violations = violation_service.get_violations_by_plate(vehicle_plate)
    return violations

@router.get("/{violation_id}", response_model=ViolationResponse)
def get_violation(
    violation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific violation by ID."""
    violation_service = ViolationService(db)
    violation = violation_service.get_violation_by_id(violation_id)
    return violation

@router.put("/{violation_id}", response_model=ViolationResponse)
def update_violation(
    violation_id: int,
    violation_data: ViolationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a violation."""
    violation_service = ViolationService(db)
    violation = violation_service.update_violation(violation_id, violation_data, current_user)
    return violation
