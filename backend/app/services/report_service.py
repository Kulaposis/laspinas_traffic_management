from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException, status
from ..models.report import Report, ReportStatus
from ..models.user import User
from ..schemas.report_schema import ReportCreate, ReportUpdate
from ..utils.role_helpers import get_role_value

class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def create_report(self, report_data: ReportCreate, user: User) -> Report:
        """Create a new traffic report."""
        db_report = Report(
            title=report_data.title,
            description=report_data.description,
            report_type=report_data.report_type,
            latitude=report_data.latitude,
            longitude=report_data.longitude,
            address=report_data.address,
            image_url=report_data.image_url,
            reporter_id=user.id
        )
        
        self.db.add(db_report)
        self.db.commit()
        self.db.refresh(db_report)
        
        return db_report

    def get_reports(self, skip: int = 0, limit: int = 100, status: Optional[ReportStatus] = None) -> List[Report]:
        """Get list of reports with optional filtering."""
        query = self.db.query(Report)
        
        if status:
            query = query.filter(Report.status == status)
        
        return query.offset(skip).limit(limit).all()

    def get_report_by_id(self, report_id: int) -> Report:
        """Get a specific report by ID."""
        report = self.db.query(Report).filter(Report.id == report_id).first()
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report not found"
            )
        
        return report

    def update_report(self, report_id: int, report_data: ReportUpdate, user: User) -> Report:
        """Update a report (only reporter or staff can update)."""
        report = self.get_report_by_id(report_id)
        
        # Check permissions
        if report.reporter_id != user.id and get_role_value(user.role) not in ['lgu_staff', 'admin']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to update this report"
            )
        
        # Update fields
        update_data = report_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(report, field, value)
        
        self.db.commit()
        self.db.refresh(report)
        
        return report

    def delete_report(self, report_id: int, user: User) -> bool:
        """Delete a report (only reporter or admin can delete)."""
        report = self.get_report_by_id(report_id)
        
        # Check permissions
        if report.reporter_id != user.id and get_role_value(user.role) != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to delete this report"
            )
        
        self.db.delete(report)
        self.db.commit()
        
        return True

    def get_reports_by_location(self, latitude: float, longitude: float, radius_km: float = 5.0) -> List[Report]:
        """Get reports within a specific radius of a location."""
        # Simple distance calculation (for more precise calculation, use PostGIS)
        lat_range = radius_km / 111.0  # Approximate degrees per km
        lon_range = radius_km / (111.0 * abs(latitude))
        
        return self.db.query(Report).filter(
            Report.latitude.between(latitude - lat_range, latitude + lat_range),
            Report.longitude.between(longitude - lon_range, longitude + lon_range)
        ).all()
