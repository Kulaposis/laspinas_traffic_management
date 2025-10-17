from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..auth import get_current_user
from ..models.user import User
from ..models.parking import Parking
from ..models.no_parking_zone import NoParkingZone
from ..schemas.parking_schema import ParkingCreate, ParkingUpdate, ParkingResponse
from ..schemas.no_parking_zone_schema import (
    NoParkingZoneCreate, 
    NoParkingZoneUpdate, 
    NoParkingZoneResponse
)
from ..services.parking_service import ParkingService

router = APIRouter(prefix="/parking", tags=["parking"])


@router.post("/areas", response_model=ParkingResponse)
async def create_parking_area(
    parking_data: ParkingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new parking area"""
    parking_service = ParkingService(db)
    return parking_service.create_parking(parking_data)


@router.get("/areas", response_model=List[ParkingResponse])
async def get_parking_areas(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    available_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Get all parking areas"""
    parking_service = ParkingService(db)
    
    if available_only:
        return parking_service.get_available_parkings()
    else:
        return parking_service.get_parkings(skip=skip, limit=limit)


@router.get("/areas/{parking_id}", response_model=ParkingResponse)
async def get_parking_area(
    parking_id: int,
    db: Session = Depends(get_db)
):
    """Get parking area by ID"""
    parking_service = ParkingService(db)
    parking = parking_service.get_parking(parking_id)
    
    if not parking:
        raise HTTPException(status_code=404, detail="Parking area not found")
    
    return parking


@router.put("/areas/{parking_id}", response_model=ParkingResponse)
async def update_parking_area(
    parking_id: int,
    parking_data: ParkingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update parking area"""
    parking_service = ParkingService(db)
    parking = parking_service.update_parking(parking_id, parking_data)
    
    if not parking:
        raise HTTPException(status_code=404, detail="Parking area not found")
    
    return parking


@router.delete("/areas/{parking_id}")
async def delete_parking_area(
    parking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete parking area"""
    parking_service = ParkingService(db)
    success = parking_service.delete_parking(parking_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Parking area not found")
    
    return {"message": "Parking area deleted successfully"}


# No Parking Zones Endpoints
@router.post("/no-parking-zones", response_model=NoParkingZoneResponse)
async def create_no_parking_zone(
    zone_data: NoParkingZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new no parking zone"""
    parking_service = ParkingService(db)
    return parking_service.create_no_parking_zone(zone_data)


@router.get("/no-parking-zones", response_model=List[NoParkingZoneResponse])
async def get_no_parking_zones(
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=2000),
    zone_type: Optional[str] = Query(None),
    restriction_reason: Optional[str] = Query(None),
    strict_only: bool = Query(False),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lng_min: Optional[float] = Query(None),
    lng_max: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """Get no parking zones with optional filters"""
    parking_service = ParkingService(db)
    
    # Filter by area if coordinates provided
    if all([lat_min, lat_max, lng_min, lng_max]):
        return parking_service.get_no_parking_zones_in_area(lat_min, lat_max, lng_min, lng_max)
    
    # Filter by zone type
    if zone_type:
        return parking_service.get_no_parking_zones_by_type(zone_type)
    
    # Filter by restriction reason
    if restriction_reason:
        return parking_service.get_no_parking_zones_by_reason(restriction_reason)
    
    # Filter strict zones only
    if strict_only:
        return parking_service.get_strict_no_parking_zones()
    
    # Default: get all zones
    return parking_service.get_no_parking_zones(skip=skip, limit=limit)


@router.get("/no-parking-zones/{zone_id}", response_model=NoParkingZoneResponse)
async def get_no_parking_zone(
    zone_id: int,
    db: Session = Depends(get_db)
):
    """Get no parking zone by ID"""
    parking_service = ParkingService(db)
    zone = parking_service.get_no_parking_zone(zone_id)
    
    if not zone:
        raise HTTPException(status_code=404, detail="No parking zone not found")
    
    return zone


@router.put("/no-parking-zones/{zone_id}", response_model=NoParkingZoneResponse)
async def update_no_parking_zone(
    zone_id: int,
    zone_data: NoParkingZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update no parking zone"""
    parking_service = ParkingService(db)
    zone = parking_service.update_no_parking_zone(zone_id, zone_data)
    
    if not zone:
        raise HTTPException(status_code=404, detail="No parking zone not found")
    
    return zone


@router.delete("/no-parking-zones/{zone_id}")
async def delete_no_parking_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete no parking zone"""
    parking_service = ParkingService(db)
    success = parking_service.delete_no_parking_zone(zone_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="No parking zone not found")
    
    return {"message": "No parking zone deleted successfully"}


# Statistics and Analytics
@router.get("/statistics")
async def get_parking_statistics(db: Session = Depends(get_db)):
    """Get parking and no parking zones statistics"""
    parking_service = ParkingService(db)
    return parking_service.get_combined_parking_overview()


@router.get("/areas/statistics")
async def get_parking_areas_statistics(db: Session = Depends(get_db)):
    """Get parking areas statistics"""
    parking_service = ParkingService(db)
    return parking_service.get_parking_statistics()


@router.get("/no-parking-zones/statistics")
async def get_no_parking_zones_statistics(db: Session = Depends(get_db)):
    """Get no parking zones statistics"""
    parking_service = ParkingService(db)
    return parking_service.get_no_parking_statistics()


# Data Import
@router.post("/no-parking-zones/import")
async def import_no_parking_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import no parking zones from scraped JSON data"""
    parking_service = ParkingService(db)
    
    # Import from the JSON file generated by the scraper
    json_file_path = "las_pinas_no_parking_zones.json"
    result = parking_service.import_no_parking_zones_from_json(json_file_path)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


# Map Data Endpoints
@router.get("/map-data")
async def get_parking_map_data(
    include_parking: bool = Query(True),
    include_no_parking: bool = Query(True),
    lat_min: Optional[float] = Query(None),
    lat_max: Optional[float] = Query(None),
    lng_min: Optional[float] = Query(None),
    lng_max: Optional[float] = Query(None),
    db: Session = Depends(get_db)
):
    """Get map data for parking areas and no parking zones"""
    parking_service = ParkingService(db)
    
    result = {}
    
    if include_parking:
        if all([lat_min, lat_max, lng_min, lng_max]):
            # TODO: Add area filtering for parking areas
            result["parking_areas"] = parking_service.get_parkings(limit=500)
        else:
            result["parking_areas"] = parking_service.get_parkings(limit=500)
    
    if include_no_parking:
        if all([lat_min, lat_max, lng_min, lng_max]):
            result["no_parking_zones"] = parking_service.get_no_parking_zones_in_area(
                lat_min, lat_max, lng_min, lng_max
            )
        else:
            result["no_parking_zones"] = parking_service.get_no_parking_zones(limit=1000)
    
    return result
