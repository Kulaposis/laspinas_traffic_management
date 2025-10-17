from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json
from ..db import get_db
from ..models.events import Emergency, EmergencyType, EmergencyStatus, ComplaintSuggestion
from ..models.user import User
from ..auth import get_current_user
from ..schemas.emergency_schema import (
    EmergencyCreate, EmergencyResponse, EmergencyUpdate,
    ComplaintSuggestionCreate, ComplaintSuggestionResponse, ComplaintSuggestionUpdate,
    EmergencyModerationUpdate, EmergencyModerationResponse, ModerationQueueResponse
)
from ..services.activity_logger import get_activity_logger
import uuid

router = APIRouter(prefix="/emergency", tags=["emergency"])

# Emergency Endpoints
@router.get("/", response_model=List[EmergencyResponse])
def get_emergencies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    emergency_type: Optional[EmergencyType] = None,
    status: Optional[EmergencyStatus] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergencies with filtering options."""
    if current_user.role.value not in ["traffic_enforcer", "admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can view emergencies"
        )
    
    query = db.query(Emergency)
    
    if emergency_type:
        query = query.filter(Emergency.emergency_type == emergency_type)
    if status:
        query = query.filter(Emergency.status == status)
    if severity:
        query = query.filter(Emergency.severity == severity)
    
    emergencies = query.order_by(Emergency.created_at.desc()).offset(skip).limit(limit).all()
    
    # Convert photo_urls from JSON string to list for each emergency
    for emergency in emergencies:
        if emergency.photo_urls:
            try:
                emergency.photo_urls = json.loads(emergency.photo_urls)
            except (json.JSONDecodeError, TypeError):
                emergency.photo_urls = []
        else:
            emergency.photo_urls = []
    
    return emergencies

@router.get("/active", response_model=List[EmergencyResponse])
def get_active_emergencies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active emergencies for emergency responders."""
    if current_user.role.value not in ["traffic_enforcer", "admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can view active emergencies"
        )
    
    active_emergencies = db.query(Emergency).filter(
        Emergency.status.in_([EmergencyStatus.REPORTED, EmergencyStatus.DISPATCHED, EmergencyStatus.IN_PROGRESS])
    ).order_by(Emergency.created_at.desc()).all()
    
    # Convert photo_urls from JSON string to list for each emergency
    for emergency in active_emergencies:
        if emergency.photo_urls:
            try:
                emergency.photo_urls = json.loads(emergency.photo_urls)
            except (json.JSONDecodeError, TypeError):
                emergency.photo_urls = []
        else:
            emergency.photo_urls = []
    
    return active_emergencies

@router.get("/my-reports", response_model=List[EmergencyResponse])
def get_my_emergency_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's emergency reports."""
    user_emergencies = db.query(Emergency).filter(
        Emergency.reporter_id == current_user.id
    ).order_by(Emergency.created_at.desc()).all()
    
    # Convert photo_urls from JSON string to list for each emergency
    for emergency in user_emergencies:
        if emergency.photo_urls:
            try:
                emergency.photo_urls = json.loads(emergency.photo_urls)
            except (json.JSONDecodeError, TypeError):
                emergency.photo_urls = []
        else:
            emergency.photo_urls = []
    
    return user_emergencies

@router.get("/nearby")
def get_nearby_emergencies(
    latitude: float = Query(..., description="Current latitude"),
    longitude: float = Query(..., description="Current longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergencies near a specific location."""
    if current_user.role.value not in ["traffic_enforcer", "admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can view nearby emergencies"
        )
    
    # Simple proximity calculation
    lat_range = radius_km / 111.0
    lng_range = radius_km / (111.0 * abs(latitude))
    
    emergencies = db.query(Emergency).filter(
        Emergency.latitude.between(latitude - lat_range, latitude + lat_range),
        Emergency.longitude.between(longitude - lng_range, longitude + lng_range),
        Emergency.status != EmergencyStatus.RESOLVED
    ).all()
    
    return {"emergencies": emergencies, "radius_km": radius_km}

@router.post("/report", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
def report_emergency(
    emergency_data: EmergencyCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Report a new emergency (Emergency Button functionality)."""
    try:
        # Generate unique emergency number
        emergency_number = f"EM{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
        
        # Prepare emergency data
        emergency_dict = emergency_data.dict()
        
        # Handle photo URLs - convert list to JSON string for storage
        if emergency_dict.get('photo_urls'):
            emergency_dict['photo_urls'] = json.dumps(emergency_dict['photo_urls'])
        else:
            emergency_dict['photo_urls'] = None
        
        # Set moderation priority based on severity and photos
        moderation_priority = "normal"
        if emergency_dict.get('severity') in ['high', 'critical']:
            moderation_priority = "high"
        if emergency_dict.get('photo_urls'):
            moderation_priority = "high" if moderation_priority == "normal" else "urgent"
        
        # Create emergency record
        emergency = Emergency(
            **emergency_dict,
            emergency_number=emergency_number,
            reporter_id=current_user.id,
            moderation_priority=moderation_priority
        )
        
        db.add(emergency)
        db.commit()
        db.refresh(emergency)
        
        # Log activity
        try:
            activity_logger = get_activity_logger(db)
            ip_address = request.client.host if request and request.client else None
            user_agent = request.headers.get("user-agent") if request else None
            
            activity_logger.log_emergency_created(
                user=current_user,
                emergency_id=emergency.id,
                emergency_type=emergency.emergency_type.value,
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            # Don't fail the entire request if logging fails
            print(f"Warning: Failed to log emergency creation: {log_error}")
        
        # Convert photo_urls back to list for response
        if emergency.photo_urls:
            try:
                emergency.photo_urls = json.loads(emergency.photo_urls)
            except (json.JSONDecodeError, TypeError):
                emergency.photo_urls = []
        else:
            emergency.photo_urls = []
        
        # TODO: Send notification to emergency responders
        # TODO: Integrate with emergency dispatch system
        
        return emergency
        
    except Exception as e:
        db.rollback()
        print(f"Error in report_emergency: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create emergency report: {str(e)}"
        )

@router.post("/report/anonymous", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
def report_emergency_anonymous(
    emergency_data: EmergencyCreate,
    reporter_name: Optional[str] = None,
    reporter_phone: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Report emergency anonymously (for non-registered users)."""
    try:
        emergency_number = f"EM{datetime.now().strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}"
        
        # Prepare emergency data
        emergency_dict = emergency_data.dict()
        
        # Handle photo URLs - convert list to JSON string for storage
        if emergency_dict.get('photo_urls'):
            emergency_dict['photo_urls'] = json.dumps(emergency_dict['photo_urls'])
        else:
            emergency_dict['photo_urls'] = None
        
        # Set moderation priority based on severity and photos
        moderation_priority = "normal"
        if emergency_dict.get('severity') in ['high', 'critical']:
            moderation_priority = "high"
        if emergency_dict.get('photo_urls'):
            moderation_priority = "high" if moderation_priority == "normal" else "urgent"
        
        emergency = Emergency(
            **emergency_dict,
            emergency_number=emergency_number,
            reporter_name=reporter_name,
            reporter_phone=reporter_phone,
            moderation_priority=moderation_priority
        )
        
        db.add(emergency)
        db.commit()
        db.refresh(emergency)
        
        # Convert photo_urls back to list for response
        if emergency.photo_urls:
            try:
                emergency.photo_urls = json.loads(emergency.photo_urls)
            except (json.JSONDecodeError, TypeError):
                emergency.photo_urls = []
        else:
            emergency.photo_urls = []
        
        return emergency
        
    except Exception as e:
        db.rollback()
        print(f"Error in report_emergency_anonymous: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create emergency report: {str(e)}"
        )

@router.put("/{emergency_id}", response_model=EmergencyResponse)
def update_emergency(
    emergency_id: int,
    emergency_update: EmergencyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update emergency status and information."""
    if current_user.role.value not in ["traffic_enforcer", "admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can update emergencies"
        )
    
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency not found"
        )
    
    for field, value in emergency_update.dict(exclude_unset=True).items():
        setattr(emergency, field, value)
    
    if emergency_update.status == EmergencyStatus.RESOLVED:
        emergency.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(emergency)
    return emergency

# Content Moderation Endpoints
@router.get("/moderation/queue", response_model=ModerationQueueResponse)
def get_moderation_queue(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    priority: Optional[str] = Query(None, description="Filter by priority: low, normal, high, urgent"),
    verification_status: Optional[str] = Query(None, description="Filter by status: pending, flagged"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergency reports pending moderation (Admin only)."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can access moderation queue"
        )
    
    query = db.query(Emergency).filter(
        Emergency.verification_status.in_(["pending", "flagged"])
    )
    
    if priority:
        query = query.filter(Emergency.moderation_priority == priority)
    if verification_status:
        query = query.filter(Emergency.verification_status == verification_status)
    
    # Get statistics
    total_pending = db.query(Emergency).filter(Emergency.verification_status == "pending").count()
    high_priority = db.query(Emergency).filter(
        Emergency.verification_status.in_(["pending", "flagged"]),
        Emergency.moderation_priority.in_(["high", "urgent"])
    ).count()
    flagged_reports = db.query(Emergency).filter(Emergency.verification_status == "flagged").count()
    
    # Get pending reports
    pending_reports = query.order_by(
        Emergency.moderation_priority.desc(),
        Emergency.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Convert photo_urls from JSON string to list for response
    for report in pending_reports:
        if report.photo_urls:
            try:
                report.photo_urls = json.loads(report.photo_urls)
            except (json.JSONDecodeError, TypeError):
                report.photo_urls = []
    
    return ModerationQueueResponse(
        total_pending=total_pending,
        high_priority=high_priority,
        flagged_reports=flagged_reports,
        pending_reports=pending_reports
    )

@router.put("/moderation/{emergency_id}", response_model=EmergencyModerationResponse)
def moderate_emergency_report(
    emergency_id: int,
    moderation_data: EmergencyModerationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Moderate an emergency report (Admin only)."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can moderate reports"
        )
    
    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency report not found"
        )
    
    # Update moderation fields
    emergency.verification_status = moderation_data.verification_status
    emergency.is_verified = moderation_data.verification_status == "verified"
    emergency.verified_by = current_user.id
    emergency.verified_at = datetime.utcnow()
    
    if moderation_data.verification_notes:
        emergency.verification_notes = moderation_data.verification_notes
    if moderation_data.moderation_priority:
        emergency.moderation_priority = moderation_data.moderation_priority
    
    db.commit()
    db.refresh(emergency)
    
    # Convert photo_urls from JSON string to list for response
    if emergency.photo_urls:
        try:
            emergency.photo_urls = json.loads(emergency.photo_urls)
        except (json.JSONDecodeError, TypeError):
            emergency.photo_urls = []
    
    # Log moderation activity
    activity_logger = get_activity_logger(db)
    activity_logger.log_emergency_moderated(
        user=current_user,
        emergency_id=emergency.id,
        verification_status=moderation_data.verification_status
    )
    
    return emergency

# Complaints & Suggestions Endpoints
@router.get("/complaints", response_model=List[ComplaintSuggestionResponse])
def get_complaints_suggestions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    type_filter: Optional[str] = Query(None, description="complaint or suggestion"),
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complaints and suggestions (E-Complaint & Suggestion Box)."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        # Citizens can only see their own complaints
        if current_user.role.value == "citizen":
            query = db.query(ComplaintSuggestion).filter(
                ComplaintSuggestion.reporter_id == current_user.id
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view complaints"
            )
    else:
        query = db.query(ComplaintSuggestion)
    
    if type_filter:
        query = query.filter(ComplaintSuggestion.type == type_filter)
    if category:
        query = query.filter(ComplaintSuggestion.category == category)
    if status:
        query = query.filter(ComplaintSuggestion.status == status)
    
    return query.order_by(ComplaintSuggestion.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/complaint", response_model=ComplaintSuggestionResponse, status_code=status.HTTP_201_CREATED)
def submit_complaint_suggestion(
    complaint_data: ComplaintSuggestionCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit a complaint or suggestion."""
    complaint = ComplaintSuggestion(
        **complaint_data.dict(),
        reporter_id=current_user.id
    )
    
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    
    # Log activity
    activity_logger = get_activity_logger(db)
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    
    activity_logger.log_complaint_created(
        user=current_user,
        complaint_id=complaint.id,
        category=complaint.category,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    # TODO: Award points for valid complaints/suggestions
    # TODO: Send notification to relevant department
    
    return complaint

@router.post("/complaint/anonymous", response_model=ComplaintSuggestionResponse, status_code=status.HTTP_201_CREATED)
def submit_complaint_anonymous(
    complaint_data: ComplaintSuggestionCreate,
    reporter_name: Optional[str] = None,
    reporter_email: Optional[str] = None,
    reporter_phone: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Submit complaint/suggestion anonymously."""
    complaint = ComplaintSuggestion(
        **complaint_data.dict(),
        reporter_name=reporter_name,
        reporter_email=reporter_email,
        reporter_phone=reporter_phone,
        is_anonymous=True
    )
    
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint

@router.put("/complaint/{complaint_id}", response_model=ComplaintSuggestionResponse)
def update_complaint_suggestion(
    complaint_id: int,
    complaint_update: ComplaintSuggestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update complaint/suggestion (for staff response)."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can update complaints"
        )
    
    complaint = db.query(ComplaintSuggestion).filter(ComplaintSuggestion.id == complaint_id).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Complaint/suggestion not found"
        )
    
    for field, value in complaint_update.dict(exclude_unset=True).items():
        setattr(complaint, field, value)
    
    if complaint_update.response_message:
        complaint.response_date = datetime.utcnow()
    
    db.commit()
    db.refresh(complaint)
    
    # TODO: Send notification to complainant
    # TODO: Award points if complaint was valid and resolved
    
    return complaint

@router.get("/statistics")
def get_emergency_statistics(
    days: int = Query(30, ge=1, le=365, description="Days to analyze"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergency and complaint statistics for dashboard."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff can view statistics"
        )
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Emergency statistics
    emergency_stats = db.query(Emergency).filter(Emergency.created_at >= start_date)
    total_emergencies = emergency_stats.count()
    resolved_emergencies = emergency_stats.filter(Emergency.status == EmergencyStatus.RESOLVED).count()
    active_emergencies = emergency_stats.filter(
        Emergency.status.in_([EmergencyStatus.REPORTED, EmergencyStatus.DISPATCHED, EmergencyStatus.IN_PROGRESS])
    ).count()
    
    # Complaint statistics
    complaint_stats = db.query(ComplaintSuggestion).filter(ComplaintSuggestion.created_at >= start_date)
    total_complaints = complaint_stats.filter(ComplaintSuggestion.type == "complaint").count()
    total_suggestions = complaint_stats.filter(ComplaintSuggestion.type == "suggestion").count()
    resolved_complaints = complaint_stats.filter(ComplaintSuggestion.status == "resolved").count()
    
    # Response time analysis
    avg_response_time = db.query(Emergency).filter(
        Emergency.actual_response_time.isnot(None),
        Emergency.created_at >= start_date
    ).all()
    
    avg_response_minutes = sum([e.actual_response_time for e in avg_response_time]) / len(avg_response_time) if avg_response_time else 0
    
    return {
        "period_days": days,
        "emergency_statistics": {
            "total": total_emergencies,
            "resolved": resolved_emergencies,
            "active": active_emergencies,
            "resolution_rate": (resolved_emergencies / total_emergencies * 100) if total_emergencies > 0 else 0,
            "avg_response_time_minutes": round(avg_response_minutes, 2)
        },
        "complaint_statistics": {
            "total_complaints": total_complaints,
            "total_suggestions": total_suggestions,
            "resolved": resolved_complaints,
            "resolution_rate": (resolved_complaints / (total_complaints + total_suggestions) * 100) if (total_complaints + total_suggestions) > 0 else 0
        }
    }
