from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import logging
from ..db import get_db, SessionLocal
from ..models.weather import WeatherData, FloodMonitoring, WeatherAlert, WeatherCondition, FloodLevel
from ..models.user import User
from ..auth import get_current_user
from ..services.weather_service import weather_service
from ..services.barangay_flood_service import barangay_flood_service
from ..schemas.weather_schema import (
    WeatherDataCreate, WeatherDataResponse,
    FloodMonitoringCreate, FloodMonitoringResponse, FloodMonitoringUpdate,
    WeatherAlertCreate, WeatherAlertResponse, WeatherAlertUpdate
)

router = APIRouter(prefix="/weather", tags=["weather"])
logger = logging.getLogger(__name__)

# Real-time Weather Endpoints
@router.post("/realtime/update")
async def update_realtime_weather(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger real-time weather data update for all monitoring areas"""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. User role '{current_user.role.value}' not authorized. Only admins and LGU staff can trigger weather updates"
        )
    
    try:
        logger.info(f"Weather update triggered by user: {current_user.username} (role: {current_user.role.value})")

        # Background runner that manages its own DB session and schedules async tasks properly
        def trigger_weather_updates():
            import asyncio

            async def run_updates():
                session = SessionLocal()
                try:
                    await weather_service.update_all_weather_data(session)
                    await weather_service.update_flood_monitoring(session)
                finally:
                    session.close()

            asyncio.create_task(run_updates())

        # Schedule the trigger to run after response is sent
        background_tasks.add_task(trigger_weather_updates)

        logger.info("Weather update tasks scheduled in background")

        return {
            "message": "Real-time weather update initiated",
            "status": "success",
            "initiated_by": current_user.username,
            "user_role": current_user.role.value,
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        logger.error(f"Failed to initiate weather update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate weather update: {str(e)}"
        )

@router.post("/flood/realtime/update")
async def update_realtime_flood(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger real-time flood monitoring update with WebSocket broadcast"""
    if current_user.role.value not in ["admin", "lgu_staff", "traffic_enforcer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins, LGU staff, and traffic enforcers can trigger flood updates"
        )
    
    try:
        # Update flood data in background
        background_tasks.add_task(weather_service.update_flood_monitoring, db)
        
        return {
            "message": "Real-time flood monitoring update initiated",
            "status": "success",
            "initiated_by": current_user.username,
            "timestamp": datetime.utcnow()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger flood update: {str(e)}"
        )

@router.get("/realtime/current")
async def get_realtime_weather(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    area_name: Optional[str] = Query(None, description="Area name")
):
    """Get real-time weather data for specific coordinates"""
    try:
        weather_data = await weather_service.fetch_weather_for_coordinates(
            latitude, longitude, area_name
        )
        
        if not weather_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weather data not available for the specified coordinates"
            )
        
        return weather_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch real-time weather data: {str(e)}"
        )

@router.get("/realtime/status")
def get_realtime_status(db: Session = Depends(get_db)):
    """Get status of real-time weather monitoring"""
    try:
        # Get latest weather data timestamp
        latest_weather = db.query(WeatherData).filter(
            WeatherData.data_source.like("%api%")
        ).order_by(WeatherData.recorded_at.desc()).first()
        
        # Count active monitoring areas
        total_areas = len(weather_service.monitoring_areas)
        recent_updates = db.query(WeatherData).filter(
            WeatherData.recorded_at >= datetime.utcnow() - timedelta(hours=1),
            WeatherData.data_source.like("%api%")
        ).count()
        
        # Get barangay flood status
        active_barangays = [b["name"] for b in barangay_flood_service.get_active_barangays()]
        barangay_flood_count = db.query(FloodMonitoring).filter(
            FloodMonitoring.location_name.in_(active_barangays)
        ).count()
        
        return {
            "status": "active" if recent_updates > 0 else "inactive",
            "monitoring_areas": total_areas,
            "recent_updates": recent_updates,
            "last_update": latest_weather.recorded_at if latest_weather else None,
            "api_source": "Open-Meteo",
            "update_frequency": "On-demand and scheduled",
            "barangay_monitoring": {
                "total_barangays": len(barangay_flood_service.get_active_barangays()),
                "flood_monitoring_points": barangay_flood_count,
                "flood_prone_barangays": len([b for b in barangay_flood_service.get_active_barangays() if b["flood_prone"]])
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get realtime status: {str(e)}"
        )

# Barangay Flood Monitoring Endpoints
@router.get("/barangay/flood-prone")
def get_flood_prone_barangays():
    """Get list of flood-prone barangays in Las Piñas City"""
    try:
        flood_prone = barangay_flood_service.get_flood_prone_barangays()
        return {
            "total_count": len(flood_prone),
            "barangays": flood_prone
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get flood-prone barangays: {str(e)}"
        )

@router.get("/barangay/critical-areas")
def get_critical_flood_areas():
    """Get barangays with critical or high flood risk"""
    try:
        critical_areas = barangay_flood_service.get_critical_flood_areas()
        return {
            "total_count": len(critical_areas),
            "critical_areas": critical_areas
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get critical flood areas: {str(e)}"
        )

@router.get("/barangay/evacuation-centers")
def get_evacuation_centers():
    """Get all evacuation centers in Las Piñas City"""
    try:
        centers = barangay_flood_service.get_evacuation_centers()
        return {
            "total_count": len(centers),
            "evacuation_centers": centers
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get evacuation centers: {str(e)}"
        )

@router.get("/barangay/{barangay_name}")
def get_barangay_info(barangay_name: str):
    """Get detailed information about a specific barangay"""
    try:
        info = barangay_flood_service.get_barangay_info(barangay_name)
        if not info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Barangay '{barangay_name}' not found"
            )
        return info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get barangay info: {str(e)}"
        )

@router.post("/barangay/update-flood-data")
async def update_barangay_flood_data(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update flood monitoring data for all barangays"""
    if current_user.role.value not in ["admin", "lgu_staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and LGU staff can update flood data"
        )
    
    try:
        # Update barangay flood data in background
        background_tasks.add_task(barangay_flood_service.update_barangay_flood_data, db, {})
        
        return {
            "message": "Barangay flood data update initiated",
            "status": "success",
            "timestamp": datetime.utcnow(),
            "barangays_updated": len(barangay_flood_service.barangays)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate barangay flood update: {str(e)}"
        )

@router.get("/test")
async def test_weather_service():
    """Test endpoint to check if weather service is working"""
    try:
        # Test fetching weather for Las Piñas
        weather_data = await weather_service.fetch_current_weather(14.4504, 121.0170)
        
        if weather_data:
            return {
                "status": "success",
                "message": "Weather service is working",
                "sample_data": {
                    "temperature": weather_data.get("temperature_2m"),
                    "humidity": weather_data.get("relative_humidity_2m"),
                    "precipitation": weather_data.get("precipitation"),
                    "weather_code": weather_data.get("weather_code")
                },
                "timestamp": datetime.utcnow()
            }
        else:
            return {
                "status": "error",
                "message": "Failed to fetch weather data from Open-Meteo API",
                "timestamp": datetime.utcnow()
            }
            
    except Exception as e:
        logger.error(f"Weather service test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Weather service test failed: {str(e)}"
        )

# Weather Data Endpoints
@router.get("/current", response_model=List[WeatherDataResponse])
def get_current_weather(
    area_name: Optional[str] = None,
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lng_min: Optional[float] = None,
    lng_max: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Get current weather data with optional filtering by area or coordinates."""
    query = db.query(WeatherData)
    
    if area_name:
        query = query.filter(WeatherData.area_name.ilike(f"%{area_name}%"))
    
    if all([lat_min, lat_max, lng_min, lng_max]):
        query = query.filter(
            WeatherData.latitude.between(lat_min, lat_max),
            WeatherData.longitude.between(lng_min, lng_max)
        )
    
    # Get latest weather data for each area (within last 2 hours)
    cutoff_time = datetime.utcnow() - timedelta(hours=2)
    return query.filter(
        WeatherData.recorded_at >= cutoff_time
    ).order_by(WeatherData.recorded_at.desc()).all()

@router.get("/history")
def get_weather_history(
    area_name: str = Query(..., description="Area name"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history (max 7 days)"),
    db: Session = Depends(get_db)
):
    """Get weather history for a specific area."""
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    weather_history = db.query(WeatherData).filter(
        WeatherData.area_name.ilike(f"%{area_name}%"),
        WeatherData.recorded_at >= start_time
    ).order_by(WeatherData.recorded_at.desc()).all()
    
    return {
        "area_name": area_name,
        "period_hours": hours,
        "data_points": len(weather_history),
        "weather_data": weather_history
    }

@router.post("/data", response_model=WeatherDataResponse, status_code=status.HTTP_201_CREATED)
def create_weather_data(
    weather_data: WeatherDataCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new weather data entry (for admin/system)."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create weather data"
        )
    
    weather = WeatherData(**weather_data.dict())
    db.add(weather)
    db.commit()
    db.refresh(weather)
    return weather

# Flood Monitoring Endpoints
@router.get("/flood", response_model=List[FloodMonitoringResponse])
def get_flood_monitoring(
    flood_level: Optional[FloodLevel] = None,
    is_flood_prone: Optional[bool] = None,
    alert_level: Optional[int] = Query(None, ge=0, le=4),
    db: Session = Depends(get_db)
):
    """Get flood monitoring data with filtering options."""
    query = db.query(FloodMonitoring)
    
    if flood_level:
        query = query.filter(FloodMonitoring.flood_level == flood_level)
    if is_flood_prone is not None:
        query = query.filter(FloodMonitoring.is_flood_prone == is_flood_prone)
    if alert_level is not None:
        query = query.filter(FloodMonitoring.alert_level == alert_level)
    
    return query.order_by(FloodMonitoring.last_updated.desc()).all()

@router.get("/flood/alerts")
def get_flood_alerts(
    active_only: bool = Query(True, description="Only show active alerts"),
    db: Session = Depends(get_db)
):
    """Get flood alerts and warnings."""
    flood_areas = db.query(FloodMonitoring).filter(
        FloodMonitoring.alert_level > 0
    ).all()
    
    weather_alerts = db.query(WeatherAlert).filter(
        WeatherAlert.alert_type == "flood",
        WeatherAlert.is_active == active_only
    ).all() if active_only else db.query(WeatherAlert).filter(
        WeatherAlert.alert_type == "flood"
    ).all()
    
    return {
        "flood_monitoring_alerts": flood_areas,
        "weather_alerts": weather_alerts,
        "total_alerts": len(flood_areas) + len(weather_alerts)
    }

@router.post("/flood", response_model=FloodMonitoringResponse, status_code=status.HTTP_201_CREATED)
def create_flood_monitoring(
    flood_data: FloodMonitoringCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new flood monitoring entry."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can create flood monitoring data"
        )
    
    flood = FloodMonitoring(**flood_data.dict())
    db.add(flood)
    db.commit()
    db.refresh(flood)
    return flood

@router.put("/flood/{flood_id}", response_model=FloodMonitoringResponse)
def update_flood_monitoring(
    flood_id: int,
    flood_update: FloodMonitoringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update flood monitoring data."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can update flood data"
        )
    
    flood = db.query(FloodMonitoring).filter(FloodMonitoring.id == flood_id).first()
    if not flood:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flood monitoring entry not found"
        )
    
    for field, value in flood_update.dict(exclude_unset=True).items():
        setattr(flood, field, value)
    
    db.commit()
    db.refresh(flood)
    return flood

# Weather Alerts Endpoints
@router.get("/alerts", response_model=List[WeatherAlertResponse])
def get_weather_alerts(
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
    is_active: bool = Query(True, description="Filter by active alerts"),
    db: Session = Depends(get_db)
):
    """Get weather alerts with filtering options."""
    query = db.query(WeatherAlert).filter(WeatherAlert.is_active == is_active)
    
    if alert_type:
        query = query.filter(WeatherAlert.alert_type == alert_type)
    if severity:
        query = query.filter(WeatherAlert.severity == severity)
    
    return query.order_by(WeatherAlert.created_at.desc()).all()

@router.get("/alerts/nearby")
def get_nearby_weather_alerts(
    latitude: float = Query(..., description="Current latitude"),
    longitude: float = Query(..., description="Current longitude"),
    radius_km: float = Query(10.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db)
):
    """Get weather alerts near a specific location."""
    # Simple proximity calculation
    lat_range = radius_km / 111.0
    lng_range = radius_km / (111.0 * abs(latitude))
    
    alerts = db.query(WeatherAlert).filter(
        WeatherAlert.is_active == True,
        WeatherAlert.latitude.between(latitude - lat_range, latitude + lat_range),
        WeatherAlert.longitude.between(longitude - lng_range, longitude + lng_range)
    ).all()
    
    return {"alerts": alerts, "radius_km": radius_km}

@router.post("/alerts", response_model=WeatherAlertResponse, status_code=status.HTTP_201_CREATED)
def create_weather_alert(
    alert_data: WeatherAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new weather alert (for admin only)."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create weather alerts"
        )
    
    alert = WeatherAlert(**alert_data.dict())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert

@router.put("/alerts/{alert_id}", response_model=WeatherAlertResponse)
def update_weather_alert(
    alert_id: int,
    alert_update: WeatherAlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update weather alert."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update weather alerts"
        )
    
    alert = db.query(WeatherAlert).filter(WeatherAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weather alert not found"
        )
    
    for field, value in alert_update.dict(exclude_unset=True).items():
        setattr(alert, field, value)
    
    db.commit()
    db.refresh(alert)
    return alert

@router.delete("/alerts/{alert_id}")
def deactivate_weather_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate a weather alert."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can deactivate weather alerts"
        )
    
    alert = db.query(WeatherAlert).filter(WeatherAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weather alert not found"
        )
    
    alert.is_active = False
    db.commit()
    return {"message": "Weather alert deactivated successfully"}

# Combined Weather + Traffic Advisory
@router.get("/advisory")
def get_weather_traffic_advisory(
    latitude: float = Query(..., description="Current latitude"),
    longitude: float = Query(..., description="Current longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db)
):
    """Get combined weather and traffic advisory for a location."""
    from ..models.traffic import RoadIncident
    
    # Get weather data
    lat_range = radius_km / 111.0
    lng_range = radius_km / (111.0 * abs(latitude))
    
    weather_data = db.query(WeatherData).filter(
        WeatherData.latitude.between(latitude - lat_range, latitude + lat_range),
        WeatherData.longitude.between(longitude - lng_range, longitude + lng_range),
        WeatherData.recorded_at >= datetime.utcnow() - timedelta(hours=2)
    ).order_by(WeatherData.recorded_at.desc()).first()
    
    # Get weather alerts
    weather_alerts = db.query(WeatherAlert).filter(
        WeatherAlert.is_active == True,
        WeatherAlert.latitude.between(latitude - lat_range, latitude + lat_range),
        WeatherAlert.longitude.between(longitude - lng_range, longitude + lng_range)
    ).all()
    
    # Get flood monitoring
    flood_alerts = db.query(FloodMonitoring).filter(
        FloodMonitoring.latitude.between(latitude - lat_range, latitude + lat_range),
        FloodMonitoring.longitude.between(longitude - lng_range, longitude + lng_range),
        FloodMonitoring.alert_level > 0
    ).all()
    
    # Get related traffic incidents
    traffic_incidents = db.query(RoadIncident).filter(
        RoadIncident.is_active == True,
        RoadIncident.latitude.between(latitude - lat_range, latitude + lat_range),
        RoadIncident.longitude.between(longitude - lng_range, longitude + lng_range)
    ).all()
    
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "current_weather": weather_data,
        "weather_alerts": weather_alerts,
        "flood_alerts": flood_alerts,
        "traffic_incidents": traffic_incidents,
        "advisory_level": "high" if (weather_alerts or flood_alerts) else "normal"
    }
