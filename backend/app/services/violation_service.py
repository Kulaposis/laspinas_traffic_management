from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status
from ..models.violation import Violation, ViolationStatus
from ..models.user import User
from ..schemas.violation_schema import ViolationCreate, ViolationUpdate
import uuid
from datetime import datetime
from ..utils.role_helpers import get_role_value

class ViolationService:
    def __init__(self, db: Session):
        self.db = db

    def create_violation(self, violation_data: ViolationCreate, enforcer: User) -> Violation:
        """Create a new traffic violation (only enforcers can create)."""
        if get_role_value(enforcer.role) not in ['traffic_enforcer', 'admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only traffic enforcers can issue violations"
            )
        
        # Generate unique violation number
        violation_number = f"TV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        db_violation = Violation(
            violation_number=violation_number,
            violation_type=violation_data.violation_type,
            description=violation_data.description,
            fine_amount=violation_data.fine_amount,
            driver_name=violation_data.driver_name,
            driver_license=violation_data.driver_license,
            vehicle_plate=violation_data.vehicle_plate,
            latitude=violation_data.latitude,
            longitude=violation_data.longitude,
            address=violation_data.address,
            enforcer_id=enforcer.id,
            due_date=violation_data.due_date
        )
        
        self.db.add(db_violation)
        self.db.commit()
        self.db.refresh(db_violation)
        
        return db_violation

    def get_violations(self, skip: int = 0, limit: int = 100, status: Optional[ViolationStatus] = None) -> List[Violation]:
        """Get list of violations with optional filtering."""
        query = self.db.query(Violation)
        
        if status:
            query = query.filter(Violation.status == status)
        
        return query.offset(skip).limit(limit).all()

    def get_violation_by_id(self, violation_id: int) -> Violation:
        """Get a specific violation by ID."""
        violation = self.db.query(Violation).filter(Violation.id == violation_id).first()
        
        if not violation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Violation not found"
            )
        
        return violation

    def get_violation_by_number(self, violation_number: str) -> Violation:
        """Get a violation by its violation number."""
        violation = self.db.query(Violation).filter(Violation.violation_number == violation_number).first()
        
        if not violation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Violation not found"
            )
        
        return violation

    def update_violation(self, violation_id: int, violation_data: ViolationUpdate, user: User) -> Violation:
        """Update a violation (only enforcers and staff can update)."""
        violation = self.get_violation_by_id(violation_id)
        
        # Check permissions
        if get_role_value(user.role) not in ['traffic_enforcer', 'lgu_staff', 'admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to update violations"
            )
        
        # Update fields
        update_data = violation_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(violation, field, value)
        
        self.db.commit()
        self.db.refresh(violation)
        
        return violation

    def get_violations_by_license(self, driver_license: str) -> List[Violation]:
        """Get all violations for a specific driver license."""
        return self.db.query(Violation).filter(Violation.driver_license == driver_license).all()

    def get_violations_by_plate(self, vehicle_plate: str) -> List[Violation]:
        """Get all violations for a specific vehicle plate."""
        return self.db.query(Violation).filter(Violation.vehicle_plate == vehicle_plate).all()
