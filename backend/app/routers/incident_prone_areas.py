from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import List, Optional
import time
import math
from datetime import datetime, timezone

from ..db import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.traffic import IncidentProneArea, IncidentProneAreaType
from ..schemas.incident_prone_schema import (
    IncidentProneArea as IncidentProneAreaSchema,
    IncidentProneAreaCreate,
    IncidentProneAreaUpdate,
    IncidentProneAreaList,
    IncidentProneAreaStats,
    ScrapingRequest,
    ScrapingResult
)
from ..services.incident_scraper_service import incident_scraper_service

router = APIRouter(prefix="/incident-prone-areas", tags=["Incident Prone Areas"])

@router.get("/", response_model=IncidentProneAreaList)
async def get_incident_prone_areas(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    area_type: Optional[IncidentProneAreaType] = None,
    severity_level: Optional[str] = Query(None, pattern="^(low|medium|high|critical)$"),
    barangay: Optional[str] = None,
    is_active: bool = Query(True),
    is_verified: Optional[bool] = None,
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    max_risk_score: Optional[float] = Query(None, ge=0, le=100),
    lat_min: Optional[float] = Query(None, ge=-90, le=90),
    lat_max: Optional[float] = Query(None, ge=-90, le=90),
    lng_min: Optional[float] = Query(None, ge=-180, le=180),
    lng_max: Optional[float] = Query(None, ge=-180, le=180),
    db: Session = Depends(get_db)
):
    """Get incident prone areas with filtering and pagination"""
    try:
        query = db.query(IncidentProneArea)
        
        # Apply filters
        if area_type:
            query = query.filter(IncidentProneArea.area_type == area_type)
        
        if severity_level:
            query = query.filter(IncidentProneArea.severity_level == severity_level)
        
        if barangay:
            query = query.filter(IncidentProneArea.barangay.ilike(f"%{barangay}%"))
        
        if is_active is not None:
            query = query.filter(IncidentProneArea.is_active == is_active)
        
        if is_verified is not None:
            query = query.filter(IncidentProneArea.is_verified == is_verified)
        
        if min_risk_score is not None:
            query = query.filter(IncidentProneArea.risk_score >= min_risk_score)
        
        if max_risk_score is not None:
            query = query.filter(IncidentProneArea.risk_score <= max_risk_score)
        
        # Geographic bounds filtering
        if lat_min is not None:
            query = query.filter(IncidentProneArea.latitude >= lat_min)
        if lat_max is not None:
            query = query.filter(IncidentProneArea.latitude <= lat_max)
        if lng_min is not None:
            query = query.filter(IncidentProneArea.longitude >= lng_min)
        if lng_max is not None:
            query = query.filter(IncidentProneArea.longitude <= lng_max)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * per_page
        areas = query.order_by(IncidentProneArea.risk_score.desc()).offset(offset).limit(per_page).all()
        
        return IncidentProneAreaList(
            areas=areas,
            total=total,
            page=page,
            per_page=per_page
        )
    except Exception as e:
        # Return empty list instead of 500 error
        return IncidentProneAreaList(
            areas=[],
            total=0,
            page=page,
            per_page=per_page
        )

@router.get("/{area_id}", response_model=IncidentProneAreaSchema)
async def get_incident_prone_area(
    area_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific incident prone area by ID"""
    
    area = db.query(IncidentProneArea).filter(IncidentProneArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Incident prone area not found")
    
    return area

@router.post("/", response_model=IncidentProneAreaSchema)
async def create_incident_prone_area(
    area_data: IncidentProneAreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new incident prone area (Admin/LGU Staff only)"""
    
    if current_user.role not in ["admin", "lgu_staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to create incident prone areas")
    
    # Check if area already exists
    existing_area = db.query(IncidentProneArea).filter(
        and_(
            IncidentProneArea.area_name == area_data.area_name,
            IncidentProneArea.area_type == area_data.area_type
        )
    ).first()
    
    if existing_area:
        raise HTTPException(status_code=400, detail="Incident prone area already exists")
    
    # Create new area
    area = IncidentProneArea(**area_data.dict())
    area.last_verified = datetime.now(timezone.utc)
    
    db.add(area)
    db.commit()
    db.refresh(area)
    
    return area

@router.put("/{area_id}", response_model=IncidentProneAreaSchema)
async def update_incident_prone_area(
    area_id: int,
    area_data: IncidentProneAreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an incident prone area (Admin/LGU Staff only)"""
    
    if current_user.role not in ["admin", "lgu_staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to update incident prone areas")
    
    area = db.query(IncidentProneArea).filter(IncidentProneArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Incident prone area not found")
    
    # Update fields
    for field, value in area_data.dict(exclude_unset=True).items():
        setattr(area, field, value)
    
    area.updated_at = datetime.now(timezone.utc)
    area.last_verified = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(area)
    
    return area

@router.delete("/{area_id}")
async def delete_incident_prone_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an incident prone area (Admin only)"""
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to delete incident prone areas")
    
    area = db.query(IncidentProneArea).filter(IncidentProneArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Incident prone area not found")
    
    db.delete(area)
    db.commit()
    
    return {"message": "Incident prone area deleted successfully"}

@router.get("/nearby/search")
async def get_nearby_incident_prone_areas(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, gt=0, le=50),
    area_types: Optional[List[IncidentProneAreaType]] = Query(None),
    min_risk_score: Optional[float] = Query(None, ge=0, le=100),
    db: Session = Depends(get_db)
):
    """Find incident prone areas near a specific location"""
    
    # Simple distance calculation (for more accuracy, use PostGIS)
    # This uses the Haversine formula approximation
    lat_diff = 111.0 * radius_km  # 1 degree ≈ 111 km
    lng_diff = 111.0 * radius_km / abs(math.cos(math.radians(latitude))) if latitude != 0 else 111.0 * radius_km
    
    query = db.query(IncidentProneArea).filter(
        and_(
            IncidentProneArea.latitude.between(latitude - lat_diff/111.0, latitude + lat_diff/111.0),
            IncidentProneArea.longitude.between(longitude - lng_diff/111.0, longitude + lng_diff/111.0),
            IncidentProneArea.is_active == True
        )
    )
    
    if area_types:
        query = query.filter(IncidentProneArea.area_type.in_(area_types))
    
    if min_risk_score is not None:
        query = query.filter(IncidentProneArea.risk_score >= min_risk_score)
    
    areas = query.order_by(IncidentProneArea.risk_score.desc()).all()
    
    return {"nearby_areas": areas, "total": len(areas)}

@router.get("/stats/overview", response_model=IncidentProneAreaStats)
async def get_incident_prone_areas_stats(
    db: Session = Depends(get_db)
):
    """Get statistics about incident prone areas"""
    
    total_areas = db.query(IncidentProneArea).filter(IncidentProneArea.is_active == True).count()
    
    # Count by type
    type_stats = {}
    for area_type in IncidentProneAreaType:
        count = db.query(IncidentProneArea).filter(
            and_(
                IncidentProneArea.area_type == area_type,
                IncidentProneArea.is_active == True
            )
        ).count()
        type_stats[area_type.value] = count
    
    # Count by severity
    severity_stats = {}
    for severity in ["low", "medium", "high", "critical"]:
        count = db.query(IncidentProneArea).filter(
            and_(
                IncidentProneArea.severity_level == severity,
                IncidentProneArea.is_active == True
            )
        ).count()
        severity_stats[severity] = count
    
    # High risk areas (risk score > 70)
    high_risk_areas = db.query(IncidentProneArea).filter(
        and_(
            IncidentProneArea.risk_score > 70,
            IncidentProneArea.is_active == True
        )
    ).count()
    
    # Verified areas
    verified_areas = db.query(IncidentProneArea).filter(
        and_(
            IncidentProneArea.is_verified == True,
            IncidentProneArea.is_active == True
        )
    ).count()
    
    # Last updated
    last_updated_area = db.query(IncidentProneArea).order_by(
        IncidentProneArea.updated_at.desc()
    ).first()
    
    return IncidentProneAreaStats(
        total_areas=total_areas,
        by_type=type_stats,
        by_severity=severity_stats,
        high_risk_areas=high_risk_areas,
        verified_areas=verified_areas,
        last_updated=last_updated_area.updated_at if last_updated_area else None
    )

@router.post("/scrape", response_model=ScrapingResult)
async def scrape_incident_data(
    request: ScrapingRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Scrape incident prone areas data from various sources (Admin/LGU Staff only)"""
    
    if current_user.role not in ["admin", "lgu_staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to scrape incident data")
    
    start_time = time.time()
    errors = []
    new_areas = 0
    updated_areas = 0
    total_scraped = 0
    
    try:
        # Perform scraping
        scraped_data = await incident_scraper_service.perform_full_scraping()
        total_scraped = len(scraped_data)
        
        # Save to database
        for area_data in scraped_data:
            try:
                # Check if area already exists
                existing_area = db.query(IncidentProneArea).filter(
                    and_(
                        IncidentProneArea.area_name == area_data['area_name'],
                        IncidentProneArea.area_type == area_data['area_type']
                    )
                ).first()
                
                if existing_area and request.update_existing:
                    # Update existing area
                    for key, value in area_data.items():
                        if hasattr(existing_area, key):
                            setattr(existing_area, key, value)
                    existing_area.updated_at = datetime.now(timezone.utc)
                    if request.verify_data:
                        existing_area.is_verified = True
                        existing_area.last_verified = datetime.now(timezone.utc)
                    updated_areas += 1
                    
                elif not existing_area:
                    # Create new area
                    new_area = IncidentProneArea(**area_data)
                    if request.verify_data:
                        new_area.is_verified = True
                        new_area.last_verified = datetime.now(timezone.utc)
                    db.add(new_area)
                    new_areas += 1
                    
            except Exception as e:
                errors.append(f"Error processing {area_data.get('area_name', 'Unknown')}: {str(e)}")
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        errors.append(f"General scraping error: {str(e)}")
    
    duration = time.time() - start_time
    
    return ScrapingResult(
        success=len(errors) == 0,
        total_scraped=total_scraped,
        new_areas=new_areas,
        updated_areas=updated_areas,
        errors=errors,
        duration_seconds=duration
    )

@router.post("/{area_id}/verify")
async def verify_incident_prone_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify an incident prone area (Admin/LGU Staff only)"""
    
    if current_user.role not in ["admin", "lgu_staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to verify incident prone areas")
    
    area = db.query(IncidentProneArea).filter(IncidentProneArea.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Incident prone area not found")
    
    area.is_verified = True
    area.last_verified = datetime.now(timezone.utc)
    area.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(area)
    
    return {"message": "Incident prone area verified successfully", "area": area}
