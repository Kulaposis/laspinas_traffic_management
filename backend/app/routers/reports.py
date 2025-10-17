from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db import get_db
from ..auth import get_current_active_user
from ..models.user import User
from ..models.report import ReportStatus
from ..schemas.report_schema import ReportCreate, ReportUpdate, ReportResponse
from ..services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report_data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new traffic report."""
    report_service = ReportService(db)
    report = report_service.create_report(report_data, current_user)
    return report

@router.get("/", response_model=List[ReportResponse])
def get_reports(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of reports."""
    report_service = ReportService(db)
    reports = report_service.get_reports(skip=skip, limit=limit, status=status_filter)
    return reports

@router.get("/nearby", response_model=List[ReportResponse])
def get_nearby_reports(
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get reports near a specific location."""
    report_service = ReportService(db)
    reports = report_service.get_reports_by_location(latitude, longitude, radius_km)
    return reports

@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific report by ID."""
    report_service = ReportService(db)
    report = report_service.get_report_by_id(report_id)
    return report

@router.put("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    report_data: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a report."""
    report_service = ReportService(db)
    report = report_service.update_report(report_id, report_data, current_user)
    return report

@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a report."""
    report_service = ReportService(db)
    report_service.delete_report(report_id, current_user)
    return {"message": "Report deleted successfully"}
