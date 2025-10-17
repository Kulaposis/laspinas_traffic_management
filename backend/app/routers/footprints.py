from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from ..db import get_db
from ..models.footprint import Footprint, CrowdLevel
from ..models.user import User
from ..auth import get_current_user
from ..services.footprint_service import footprint_service
from ..schemas.footprint_schema import (
    FootprintCreate, FootprintResponse, FootprintUpdate
)

router = APIRouter(prefix="/footprints", tags=["footprints"])

# Real-time Footprint Monitoring Endpoints
@router.post("/realtime/update")
async def update_realtime_footprints(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger real-time footprint data update for all monitoring areas"""
    if current_user.role.value not in ["admin", "lgu_staff", "traffic_enforcer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can trigger footprint updates"
        )
    
    try:
        # Update footprint data in background
        background_tasks.add_task(footprint_service.update_all_footprint_data, db)
        
        return {
            "message": "Real-time footprint update initiated",
            "status": "success",
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate footprint update: {str(e)}"
        )

@router.get("/", response_model=List[FootprintResponse])
def get_footprints(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    crowd_level: Optional[CrowdLevel] = None,
    area_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get footprint monitoring data with filtering options."""
    query = db.query(Footprint)
    
    if crowd_level:
        query = query.filter(Footprint.crowd_level == crowd_level)
    if area_name:
        query = query.filter(Footprint.area_name.ilike(f"%{area_name}%"))
    
    footprints = query.order_by(Footprint.recorded_at.desc()).offset(skip).limit(limit).all()
    return footprints

@router.get("/heatmap")
def get_footprint_heatmap(
    lat_min: float = Query(..., description="Minimum latitude"),
    lat_max: float = Query(..., description="Maximum latitude"),
    lng_min: float = Query(..., description="Minimum longitude"),
    lng_max: float = Query(..., description="Maximum longitude"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get heatmap data for footprint visualization within specified bounds."""
    try:
        heatmap_data = footprint_service.get_footprint_heatmap_data(
            db, lat_min, lat_max, lng_min, lng_max
        )
        
        return {
            "heatmap_data": heatmap_data,
            "bounds": {
                "lat_min": lat_min,
                "lat_max": lat_max,
                "lng_min": lng_min,
                "lng_max": lng_max
            },
            "total_points": len(heatmap_data),
            "generated_at": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate heatmap data: {str(e)}"
        )

@router.get("/statistics")
def get_footprint_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overall footprint and crowd statistics."""
    try:
        statistics = footprint_service.get_crowd_statistics(db)
        return statistics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get footprint statistics: {str(e)}"
        )

@router.get("/areas")
def get_monitoring_areas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all footprint monitoring areas with current data."""
    try:
        footprints = db.query(Footprint).order_by(Footprint.recorded_at.desc()).all()
        
        # Group by area name to get latest data for each area
        areas_dict = {}
        for footprint in footprints:
            if footprint.area_name not in areas_dict:
                areas_dict[footprint.area_name] = footprint
        
        areas_list = list(areas_dict.values())
        
        return {
            "monitoring_areas": [
                {
                    "id": fp.id,
                    "area_name": fp.area_name,
                    "latitude": fp.latitude,
                    "longitude": fp.longitude,
                    "radius_meters": fp.radius_meters,
                    "pedestrian_count": fp.pedestrian_count,
                    "crowd_level": fp.crowd_level.value,
                    "temperature_celsius": fp.temperature_celsius,
                    "humidity_percent": fp.humidity_percent,
                    "recorded_at": fp.recorded_at,
                    "created_at": fp.created_at
                }
                for fp in areas_list
            ],
            "total_areas": len(areas_list),
            "last_updated": max([fp.recorded_at for fp in areas_list]) if areas_list else None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitoring areas: {str(e)}"
        )

@router.get("/areas/{area_id}", response_model=FootprintResponse)
def get_footprint_by_id(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific footprint area by ID."""
    footprint = db.query(Footprint).filter(Footprint.id == area_id).first()
    if not footprint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Footprint area not found"
        )
    return footprint

@router.post("/areas", response_model=FootprintResponse, status_code=status.HTTP_201_CREATED)
def create_footprint_area(
    footprint_data: FootprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new footprint monitoring area."""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin and LGU staff can create monitoring areas"
        )
    
    try:
        # Check for duplicate area name
        existing = db.query(Footprint).filter(
            Footprint.area_name == footprint_data.area_name
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Monitoring area with this name already exists"
            )
        
        footprint = Footprint(
            **footprint_data.dict(),
            recorded_at=datetime.utcnow()
        )
        
        db.add(footprint)
        db.commit()
        db.refresh(footprint)
        
        return footprint
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create footprint area: {str(e)}"
        )

@router.put("/areas/{area_id}", response_model=FootprintResponse)
def update_footprint_area(
    area_id: int,
    footprint_update: FootprintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update footprint monitoring area."""
    if current_user.role.value not in ["admin", "lgu_staff", "traffic_enforcer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only authorized personnel can update monitoring areas"
        )
    
    try:
        footprint = db.query(Footprint).filter(Footprint.id == area_id).first()
        if not footprint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Footprint area not found"
            )
        
        # Update fields that are provided
        update_data = footprint_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(footprint, field, value)
        
        # Update recorded_at timestamp
        footprint.recorded_at = datetime.utcnow()
        
        db.commit()
        db.refresh(footprint)
        
        return footprint
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update footprint area: {str(e)}"
        )

@router.delete("/areas/{area_id}")
def delete_footprint_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete footprint monitoring area."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete monitoring areas"
        )
    
    try:
        footprint = db.query(Footprint).filter(Footprint.id == area_id).first()
        if not footprint:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Footprint area not found"
            )
        
        db.delete(footprint)
        db.commit()
        
        return {"message": "Footprint area deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete footprint area: {str(e)}"
        )

@router.post("/initialize")
async def initialize_footprint_monitoring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initialize footprint monitoring areas with predefined locations."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can initialize monitoring areas"
        )
    
    try:
        footprints = await footprint_service.initialize_monitoring_areas(db)
        
        return {
            "message": "Footprint monitoring areas initialized successfully",
            "areas_created": len(footprints),
            "areas": [
                {
                    "id": fp.id,
                    "area_name": fp.area_name,
                    "latitude": fp.latitude,
                    "longitude": fp.longitude,
                    "pedestrian_count": fp.pedestrian_count,
                    "crowd_level": fp.crowd_level.value
                }
                for fp in footprints
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize monitoring areas: {str(e)}"
        )

@router.get("/crowd-levels")
def get_crowd_levels(db: Session = Depends(get_db)):
    """Get available crowd level options."""
    return {
        "crowd_levels": [
            {"value": level.value, "label": level.value.title()}
            for level in CrowdLevel
        ]
    }
