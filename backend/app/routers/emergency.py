from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, UploadFile, File, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import json
import logging
import uuid
import base64
import os
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
from ..services.notification_service import NotificationService
from ..models.notification import NotificationType, NotificationPriority
from ..utils.role_helpers import is_authorized, normalize_role, get_role_value

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emergency", tags=["emergency"])

# Helper utilities to normalize Emergency rows to the response schema
def _normalize_photo_urls(value):
    if value is None:
        return []
    parsed = value
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except (json.JSONDecodeError, TypeError, ValueError):
            return [parsed] if parsed.strip() else []
    if isinstance(parsed, dict):
        return [v for v in parsed.values() if isinstance(v, str) and v.strip()]
    if isinstance(parsed, list):
        return [str(v) for v in parsed if isinstance(v, str) and v.strip()]
    return []

def _to_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def _to_int(value):
    try:
        if value is None:
            return None
        i = int(value)
        return i if i >= 0 else None
    except (TypeError, ValueError):
        return None

def _to_response(emergency: Emergency) -> EmergencyResponse:
    # Status
    try:
        if isinstance(emergency.status, EmergencyStatus):
            status_value = emergency.status.value
        else:
            cand = str(emergency.status or "").strip().upper()
            status_value = EmergencyStatus[cand].value if cand in EmergencyStatus.__members__ else EmergencyStatus.REPORTED.value
    except Exception:
        status_value = EmergencyStatus.REPORTED.value
    # Type
    try:
        if isinstance(emergency.emergency_type, EmergencyType):
            type_value = emergency.emergency_type.value
        else:
            cand = str(emergency.emergency_type or "").strip().upper()
            type_value = EmergencyType[cand].value if cand in EmergencyType.__members__ else (EmergencyType.OTHER.value if hasattr(EmergencyType, "OTHER") else list(EmergencyType)[0].value)
    except Exception:
        type_value = EmergencyType.OTHER.value if hasattr(EmergencyType, "OTHER") else list(EmergencyType)[0].value
    # Severity
    try:
        severity_value = str(emergency.severity).strip().lower()
    except Exception:
        severity_value = "medium"
    if severity_value not in {"low", "medium", "high", "critical"}:
        severity_value = "medium"
    data = {
        "id": emergency.id,
        "emergency_number": emergency.emergency_number or f"EM-{emergency.id}",
        "emergency_type": type_value,
        "title": emergency.title or type_value.replace("_", " ").title(),
        "description": emergency.description or "",
        "status": status_value,
        "severity": severity_value,
        "latitude": _to_float(emergency.latitude, 0.0),
        "longitude": _to_float(emergency.longitude, 0.0),
        "address": emergency.address or "",
        "reporter_id": emergency.reporter_id,
        "reporter_name": emergency.reporter_name,
        "reporter_phone": emergency.reporter_phone,
        "assigned_responder": emergency.assigned_responder,
        "estimated_response_time": _to_int(emergency.estimated_response_time),
        "actual_response_time": _to_int(emergency.actual_response_time),
        "resolution_notes": emergency.resolution_notes,
        "requires_traffic_control": bool(emergency.requires_traffic_control) if emergency.requires_traffic_control is not None else False,
        "photo_urls": _normalize_photo_urls(emergency.photo_urls),
        "is_verified": bool(emergency.is_verified),
        "verification_status": (emergency.verification_status or "pending").strip().lower(),
        "verified_by": emergency.verified_by,
        "verified_at": emergency.verified_at,
        "verification_notes": emergency.verification_notes,
        "moderation_priority": (emergency.moderation_priority or "normal").strip().lower(),
        "created_at": emergency.created_at or datetime.utcnow(),
        "updated_at": emergency.updated_at,
        "resolved_at": emergency.resolved_at,
    }
    return EmergencyResponse.model_validate(data)

def _to_moderation_response(emergency: Emergency) -> EmergencyModerationResponse:
    """Build EmergencyModerationResponse safely from ORM."""
    # Reuse normalization
    normalized = _to_response(emergency)
    return EmergencyModerationResponse.model_validate({
        "id": normalized.id,
        "emergency_number": normalized.emergency_number,
        "emergency_type": normalized.emergency_type,
        "title": normalized.title,
        "description": normalized.description,
        "severity": normalized.severity,
        "photo_urls": normalized.photo_urls,
        "verification_status": normalized.verification_status,
        "moderation_priority": normalized.moderation_priority,
        "is_verified": normalized.is_verified,
        "verified_by": normalized.verified_by,
        "verified_at": normalized.verified_at,
        "verification_notes": normalized.verification_notes,
        "reporter_name": emergency.reporter_name,
        "reporter_phone": emergency.reporter_phone,
        "created_at": normalized.created_at,
    })

# Debug endpoint to check user role
@router.get("/debug/check-role")
def debug_check_role(current_user: User = Depends(get_current_user)):
    """Debug endpoint to check current user's role."""
    role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": str(current_user.role),
        "role_value": role_value,
        "role_upper": role_value.upper(),
        "is_admin_check": role_value.upper() == "ADMIN",
        "is_lgu_staff_check": role_value.upper() == "LGU_STAFF",
        "is_authorized_admin": is_authorized(current_user.role, ["admin", "lgu_staff"]),
        "role_type": str(type(current_user.role))
    }

# Emergency Endpoints
@router.get("/", response_model=List[EmergencyResponse])
def get_emergencies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    emergency_type: Optional[EmergencyType] = None,
    status_filter: Optional[EmergencyStatus] = Query(None, alias="status", description="Filter by emergency status"),
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergencies with filtering options. All authenticated users can view emergencies for safety awareness."""
    # Allow all authenticated users (including citizens) to view emergencies for safety
    # Note: parameter renamed from 'status' to 'status_filter' to avoid shadowing FastAPI's 'status' module
    try:
        query = db.query(Emergency)
        if emergency_type:
            query = query.filter(Emergency.emergency_type == emergency_type)
        if status_filter:
            query = query.filter(Emergency.status == status_filter)
        if severity:
            query = query.filter(Emergency.severity == severity)
        rows = query.order_by(Emergency.created_at.desc()).offset(skip).limit(limit).all()
        normalized = []
        for e in rows:
            try:
                normalized.append(_to_response(e))
            except Exception as ve:
                logger.exception("Failed to serialize emergency %s: %s", getattr(e, "id", None), ve, exc_info=True)
                continue
        return normalized
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch emergencies: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch emergencies: {exc}")

@router.get("/active", response_model=List[EmergencyResponse])
def get_active_emergencies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all active emergencies. Citizens can view for safety awareness, authorized personnel get full access."""
    # Allow all authenticated users (including citizens) to view active emergencies for safety
    # No role check - all authenticated users can access this endpoint
    logger.info(f"get_active_emergencies called by user {current_user.id} with role {current_user.role}")
    try:
        rows = db.query(Emergency).filter(
            Emergency.status.in_([EmergencyStatus.REPORTED, EmergencyStatus.DISPATCHED, EmergencyStatus.IN_PROGRESS])
        ).order_by(Emergency.created_at.desc()).all()
        normalized = []
        for e in rows:
            try:
                normalized.append(_to_response(e))
            except Exception as ve:
                logger.exception("Failed to serialize active emergency %s: %s", getattr(e, "id", None), ve, exc_info=True)
                continue
        return normalized
    except Exception as exc:
        logger.exception("Failed to fetch active emergencies: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch active emergencies: {exc}")

@router.get("/my-reports", response_model=List[EmergencyResponse])
def get_my_emergency_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's emergency reports."""
    try:
        user_emergencies = db.query(Emergency).filter(
            Emergency.reporter_id == current_user.id
        ).order_by(Emergency.created_at.desc()).all()
        
        # Sanitize and normalize fields to avoid serialization errors
        normalized: List[EmergencyResponse] = []
        for emergency in user_emergencies:
            def to_float(value, default=None):
                try:
                    return float(value)
                except (TypeError, ValueError):
                    return default
            
            def to_int(value):
                try:
                    if value is None:
                        return None
                    int_value = int(value)
                    return int_value if int_value >= 0 else None
                except (TypeError, ValueError):
                    return None
            
            # Normalize photo_urls - ensure a list of strings
            def normalize_photo_urls(value):
                # Accept DB text, list, dict, or single string; always return list[str]
                parsed = value
                if parsed is None:
                    return []
                # If it's a JSON string, try to parse
                if isinstance(parsed, str):
                    try:
                        maybe = json.loads(parsed)
                        parsed = maybe
                    except (json.JSONDecodeError, TypeError, ValueError):
                        # Treat a plain string as a single URL
                        return [parsed] if parsed.strip() else []
                # If it's a dict, take string values
                if isinstance(parsed, dict):
                    return [v for v in parsed.values() if isinstance(v, str) and v.strip()]
                # If it's a list, filter to non-empty strings
                if isinstance(parsed, list):
                    return [str(v) for v in parsed if isinstance(v, str) and v.strip()]
                # Anything else -> empty list
                return []
            
            emergency.photo_urls = normalize_photo_urls(emergency.photo_urls)
            
            # Normalize status to EmergencyStatus enum
            try:
                if isinstance(emergency.status, str):
                    status_key = emergency.status.strip().upper()
                    if status_key in EmergencyStatus.__members__:
                        emergency.status = EmergencyStatus[status_key]
                    else:
                        emergency.status = EmergencyStatus.REPORTED
            except Exception:
                emergency.status = EmergencyStatus.REPORTED
            
            # Normalize emergency_type to EmergencyType enum
            try:
                if isinstance(emergency.emergency_type, str):
                    type_key = emergency.emergency_type.strip().upper()
                    if type_key in EmergencyType.__members__:
                        emergency.emergency_type = EmergencyType[type_key]
                    else:
                        emergency.emergency_type = EmergencyType.OTHER if hasattr(EmergencyType, "OTHER") else list(EmergencyType)[0]
            except Exception:
                # Fallback to a safe default if mapping fails
                emergency.emergency_type = EmergencyType.OTHER if hasattr(EmergencyType, "OTHER") else list(EmergencyType)[0]
            
            # Normalize severity to expected lowercase pattern
            try:
                if emergency.severity:
                    emergency.severity = str(emergency.severity).strip().lower()
                else:
                    emergency.severity = "medium"
                if emergency.severity not in {"low", "medium", "high", "critical"}:
                    emergency.severity = "medium"
            except Exception:
                emergency.severity = "medium"
            
            # Ensure requires_traffic_control is boolean
            if emergency.requires_traffic_control is None:
                emergency.requires_traffic_control = False
            else:
                emergency.requires_traffic_control = bool(emergency.requires_traffic_control)
            
            # Prepare serializable payload
            status_value = emergency.status.value if isinstance(emergency.status, EmergencyStatus) else str(emergency.status or EmergencyStatus.REPORTED.value).strip().upper()
            if status_value not in EmergencyStatus.__members__:
                status_value = EmergencyStatus.REPORTED.value
            else:
                status_value = EmergencyStatus[status_value].value
            
            type_value = emergency.emergency_type.value if isinstance(emergency.emergency_type, EmergencyType) else str(emergency.emergency_type or "").strip().upper()
            if type_value in EmergencyType.__members__:
                type_value = EmergencyType[type_value].value
            else:
                type_value = EmergencyType.OTHER.value if hasattr(EmergencyType, "OTHER") else list(EmergencyType)[0].value
            
            emergency_dict = {
                "id": emergency.id,
                "emergency_number": emergency.emergency_number or f"EM-{emergency.id}",
                "emergency_type": type_value,
                "title": emergency.title or type_value.replace("_", " ").title(),
                "description": emergency.description or "",
                "status": status_value,
                "severity": emergency.severity,
                "latitude": to_float(emergency.latitude, 0.0),
                "longitude": to_float(emergency.longitude, 0.0),
                "address": emergency.address or "",
                "reporter_id": emergency.reporter_id,
                "reporter_name": emergency.reporter_name,
                "reporter_phone": emergency.reporter_phone,
                "assigned_responder": emergency.assigned_responder,
                "estimated_response_time": to_int(emergency.estimated_response_time),
                "actual_response_time": to_int(emergency.actual_response_time),
                "resolution_notes": emergency.resolution_notes,
                "requires_traffic_control": emergency.requires_traffic_control,
                "photo_urls": emergency.photo_urls,
                "is_verified": bool(emergency.is_verified),
                "verification_status": (emergency.verification_status or "pending").strip().lower(),
                "verified_by": emergency.verified_by,
                "verified_at": emergency.verified_at,
                "verification_notes": emergency.verification_notes,
                "moderation_priority": (emergency.moderation_priority or "normal").strip().lower(),
                "created_at": emergency.created_at or datetime.utcnow(),
                "updated_at": emergency.updated_at,
                "resolved_at": emergency.resolved_at,
            }
            
            # Validate using schema to catch issues early
            try:
                response_model = EmergencyResponse.model_validate(emergency_dict)
            except Exception as validation_error:
                logger.exception(
                    "EmergencyResponse validation failed for emergency_id=%s owned by user %s: %s",
                    emergency.id,
                    current_user.id,
                    validation_error,
                    exc_info=True
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to serialize emergency report {emergency.id}: {validation_error}"
                )
            
            normalized.append(response_model)
        
        return normalized
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch emergency reports for user %s", current_user.id, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch emergency reports: {exc}"
        )

@router.get("/nearby")
def get_nearby_emergencies(
    latitude: float = Query(..., description="Current latitude"),
    longitude: float = Query(..., description="Current longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get emergencies near a specific location. All users can view nearby emergencies for safety awareness."""
    # Allow all authenticated users (including citizens) to view nearby emergencies for safety
    
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

        contact_number = emergency_dict.get("reporter_phone")
        if contact_number:
            contact_number = str(contact_number).strip()
            if not contact_number:
                contact_number = None
            emergency_dict["reporter_phone"] = contact_number
        
        # Handle photo URLs - convert list to JSON string for storage
        # Accept both base64 data URLs and regular URLs
        if emergency_dict.get('photo_urls'):
            photo_urls = emergency_dict['photo_urls']
            # Filter out any empty or invalid URLs
            photo_urls = [url for url in photo_urls if url and isinstance(url, str)]
            if photo_urls:
                emergency_dict['photo_urls'] = json.dumps(photo_urls)
            else:
                emergency_dict['photo_urls'] = None
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
        
        # Send notification to all admin users
        try:
            notification_service = NotificationService(db)
            severity_priority_map = {
                'low': NotificationPriority.LOW,
                'medium': NotificationPriority.MEDIUM,
                'high': NotificationPriority.HIGH,
                'critical': NotificationPriority.URGENT
            }
            priority = severity_priority_map.get(emergency_dict.get('severity', 'medium').lower(), NotificationPriority.HIGH)
            
            # Create notification title and message
            emergency_type_display = emergency.emergency_type.value.replace('_', ' ').title()
            title = f"New Emergency Report: {emergency_type_display}"
            message = f"Emergency #{emergency.emergency_number} reported: {emergency.title or emergency_type_display}"
            if emergency.address:
                message += f" at {emergency.address}"
            if emergency.severity:
                message += f" (Severity: {emergency.severity.upper()})"
            
            notification_service.create_notification_for_admins(
                title=title,
                message=message,
                notification_type=NotificationType.EMERGENCY,
                priority=priority,
                latitude=str(emergency.latitude) if emergency.latitude else None,
                longitude=str(emergency.longitude) if emergency.longitude else None
            )
        except Exception as notif_error:
            # Don't fail the entire request if notification fails
            logger.warning(f"Failed to create admin notifications for emergency {emergency.id}: {notif_error}")
        
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

        body_contact = emergency_dict.pop("reporter_phone", None)
        if body_contact:
            body_contact = str(body_contact).strip()
        final_contact = body_contact or (reporter_phone.strip() if reporter_phone else None)
        
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
            reporter_phone=final_contact,
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
        
        # Send notification to all admin users
        try:
            notification_service = NotificationService(db)
            severity_priority_map = {
                'low': NotificationPriority.LOW,
                'medium': NotificationPriority.MEDIUM,
                'high': NotificationPriority.HIGH,
                'critical': NotificationPriority.URGENT
            }
            priority = severity_priority_map.get(emergency_dict.get('severity', 'medium').lower(), NotificationPriority.HIGH)
            
            # Create notification title and message
            emergency_type_display = emergency.emergency_type.value.replace('_', ' ').title()
            title = f"New Emergency Report: {emergency_type_display}"
            message = f"Emergency #{emergency.emergency_number} reported: {emergency.title or emergency_type_display}"
            if emergency.address:
                message += f" at {emergency.address}"
            if emergency.severity:
                message += f" (Severity: {emergency.severity.upper()})"
            if emergency.reporter_name:
                message += f" - Reported by: {emergency.reporter_name}"
            else:
                message += " - Anonymous report"
            
            notification_service.create_notification_for_admins(
                title=title,
                message=message,
                notification_type=NotificationType.EMERGENCY,
                priority=priority,
                latitude=str(emergency.latitude) if emergency.latitude else None,
                longitude=str(emergency.longitude) if emergency.longitude else None
            )
        except Exception as notif_error:
            # Don't fail the entire request if notification fails
            logger.warning(f"Failed to create admin notifications for emergency {emergency.id}: {notif_error}")
        
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
    if not is_authorized(current_user.role, ["traffic_enforcer", "admin", "lgu_staff"]):
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
    
    # When resolving, set resolved_at timestamp
    if emergency_update.status == EmergencyStatus.RESOLVED:
        emergency.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(emergency)
    # Normalize response to avoid response_model validation errors (e.g., photo_urls as JSON text)
    try:
        return _to_response(emergency)
    except Exception as exc:
        # Fallback: still return raw object if something unexpected occurs
        logger.exception("Failed to serialize updated emergency %s: %s", emergency_id, exc, exc_info=True)
        return emergency

# Content Moderation Endpoints
@router.api_route(
    "/moderation/{emergency_id}",
    methods=["PUT", "POST", "PATCH"],
    response_model=EmergencyModerationResponse
)
def moderate_emergency_report(
    emergency_id: int,
    moderation_data: EmergencyModerationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Moderate an emergency report (Admin only)."""
    try:
        # Case-insensitive role check
        role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        role_upper = role_value.upper()
        if role_upper not in ["ADMIN", "LGU_STAFF"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only admins can moderate reports. Your role: {role_value}"
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
        
        # Log moderation activity (non-blocking - don't fail the request if logging fails)
        try:
            activity_logger = get_activity_logger(db)
            activity_logger.log_emergency_moderated(
                user=current_user,
                emergency_id=emergency.id,
                verification_status=moderation_data.verification_status
            )
        except Exception as log_error:
            # Don't fail the entire request if logging fails
            logger.warning(f"Failed to log moderation activity for emergency {emergency_id}: {log_error}")
        
        # Return normalized moderation response
        try:
            return _to_moderation_response(emergency)
        except Exception as ve:
            logger.exception("Failed to serialize moderation response for emergency %s: %s", emergency_id, ve, exc_info=True)
            # Fallback: still return normalized general response (compatible superset)
            return _to_response(emergency)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moderating emergency report {emergency_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to moderate emergency report: {str(e)}"
        )

@router.options("/moderation/{emergency_id}", include_in_schema=False)
def moderation_options(emergency_id: int) -> Response:
    """Handle CORS preflight requests for moderation endpoint."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)

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
    try:
        # Debug logging
        role_value = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
        role_upper = role_value.upper()
        logger.info(f"Moderation queue access attempt - User ID: {current_user.id}, Username: {current_user.username}, Role: {current_user.role}, Role Value: {role_value}, Role Upper: {role_upper}")
        
        # Check authorization - handle both enum and string roles
        is_admin = role_upper in ["ADMIN", "LGU_STAFF"]
        logger.info(f"Authorization check - is_admin: {is_admin}, role_upper: {role_upper}")
        
        if not is_admin:
            logger.warning(f"Access denied for user {current_user.id} ({current_user.username}) with role {role_value}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only admins can access moderation queue. Your role: {role_value}"
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching moderation queue: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch moderation queue: {str(e)}"
        )

# Provide a harmless GET handler for /moderation/{emergency_id} AFTER the /moderation/queue
# declaration so that static route takes precedence. This avoids noisy 405s from stray GETs.
@router.get("/moderation/{emergency_id}", include_in_schema=False)
def moderation_noop_get_after_queue(
    emergency_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Complaints & Suggestions Endpoints
@router.get("/complaints", response_model=List[ComplaintSuggestionResponse])
def get_complaints_suggestions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    type_filter: Optional[str] = Query(None, description="complaint or suggestion"),
    category: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by complaint status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get complaints and suggestions (E-Complaint & Suggestion Box)."""
    # Note: parameter renamed from 'status' to 'status_filter' to avoid shadowing FastAPI's 'status' module
    # Debug logging for role checking
    user_role_raw = current_user.role
    user_role_value = get_role_value(current_user.role) if hasattr(current_user.role, 'value') else str(current_user.role)
    user_role_normalized = normalize_role(current_user.role)
    
    logger.info(f"get_complaints_suggestions - User ID: {current_user.id}, Role (raw): {user_role_raw}, Role (value): {user_role_value}, Role (normalized): {user_role_normalized}")
    
    # Staff (admin, lgu_staff) can see all complaints
    if is_authorized(current_user.role, ["admin", "lgu_staff"]):
        logger.info(f"User {current_user.id} authorized as staff - showing all complaints")
        query = db.query(ComplaintSuggestion)
    # Citizens can see their own complaints
    elif user_role_normalized == "citizen":
        logger.info(f"User {current_user.id} is citizen - showing own complaints only")
        query = db.query(ComplaintSuggestion).filter(
            ComplaintSuggestion.reporter_id == current_user.id
        )
    # Other roles (traffic_enforcer, etc.) can also see all complaints for operational purposes
    else:
        logger.info(f"User {current_user.id} has role {user_role_normalized} - showing all complaints (operational access)")
        query = db.query(ComplaintSuggestion)
    
    if type_filter:
        query = query.filter(ComplaintSuggestion.type == type_filter)
    if category:
        query = query.filter(ComplaintSuggestion.category == category)
    if status_filter:
        query = query.filter(ComplaintSuggestion.status == status_filter)
    
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
    if not is_authorized(current_user.role, ["admin", "lgu_staff"]):
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
    if not is_authorized(current_user.role, ["admin", "lgu_staff"]):
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
