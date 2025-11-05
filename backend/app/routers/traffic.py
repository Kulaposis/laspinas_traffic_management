from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from ..db import get_db
from ..models.traffic import TrafficMonitoring, RouteAlternative, RoadIncident, TrafficStatus, RoadType
from ..models.user import User
from ..auth import get_current_user
from ..websocket import manager
from ..schemas.traffic_schema import (
    TrafficMonitoringCreate, TrafficMonitoringResponse, TrafficMonitoringUpdate,
    RouteAlternativeCreate, RouteAlternativeResponse,
    RoadIncidentCreate, RoadIncidentResponse, RoadIncidentUpdate
)
from ..services.traffic_generator_service import traffic_generator
from ..services.real_traffic_service import real_traffic_service
from ..services.traffic_insights_service import traffic_insights_service
from ..services.smart_routing_service import smart_routing_service
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/traffic", tags=["traffic"])

# Real-time Traffic Update Endpoints
@router.post("/realtime/update")
async def update_realtime_traffic(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger real-time traffic data update from TomTom API with fallback"""
    from ..utils.role_helpers import is_authorized
    if not is_authorized(current_user.role, ["admin", "traffic_enforcer"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and traffic enforcers can trigger traffic updates"
        )
    
    try:
        logger.info(f"Traffic update triggered by user: {current_user.username} (role: {current_user.role.value})")
        
        # Update traffic data in background using real API with fallback
        background_tasks.add_task(real_traffic_service.update_traffic_data, db)
        
        logger.info("Traffic update task added to background queue")
        
        return {
            "message": "Real-time traffic update initiated",
            "status": "success",
            "initiated_by": current_user.username,
            "user_role": current_user.role.value,
            "timestamp": datetime.utcnow(),
            "api_provider": "tomtom_with_fallback"
        }
    except Exception as e:
        logger.error(f"Failed to initiate traffic update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate traffic update: {str(e)}"
        )

@router.get("/realtime/status")
def get_traffic_api_status():
    """Get current status of traffic API integration"""
    try:
        api_status = real_traffic_service.get_api_status()
        
        return {
            "api_provider": "tomtom",
            "api_available": api_status["api_available"],
            "consecutive_failures": api_status["consecutive_failures"],
            "last_check": api_status["last_check"],
            "fallback_enabled": True,
            "update_frequency": "1 minute",
            "monitoring_points": len(real_traffic_service.monitoring_points)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get traffic API status: {str(e)}"
        )

async def broadcast_heatmap_update(db: Session, bounds: dict = None):
    """Broadcast real-time heatmap updates to all connected clients."""
    try:
        # Use default Las Piñas bounds if none provided (covering all 20 barangays)
        if not bounds:
            bounds = {
                "lat_min": 14.4200,
                "lat_max": 14.4700,
                "lng_min": 120.9800,
                "lng_max": 121.0500
            }
        
        # Get current traffic data
        traffic_data = db.query(TrafficMonitoring).filter(
            TrafficMonitoring.latitude.between(bounds["lat_min"], bounds["lat_max"]),
            TrafficMonitoring.longitude.between(bounds["lng_min"], bounds["lng_max"])
        ).all()
        
        heatmap_data = []
        for traffic in traffic_data:
            intensity = 0.2  # Default for free flow
            if traffic.traffic_status == TrafficStatus.LIGHT:
                intensity = 0.4
            elif traffic.traffic_status == TrafficStatus.MODERATE:
                intensity = 0.6
            elif traffic.traffic_status == TrafficStatus.HEAVY:
                intensity = 0.8
            elif traffic.traffic_status == TrafficStatus.STANDSTILL:
                intensity = 1.0
                
            heatmap_data.append({
                "lat": traffic.latitude,
                "lng": traffic.longitude,
                "intensity": intensity,
                "road_name": traffic.road_name,
                "status": traffic.traffic_status.value,
                "barangay": traffic.barangay,
                "vehicle_count": traffic.vehicle_count,
                "congestion_percentage": traffic.congestion_percentage,
                "data_source": getattr(traffic, 'data_source', 'unknown')
            })
        
        # Broadcast the update
        await manager.send_traffic_heatmap_update({
            "heatmap_data": heatmap_data,
            "timestamp": datetime.now().isoformat(),
            "bounds": bounds
        })
        
    except Exception as e:
        print(f"Error broadcasting heatmap update: {e}")

# Traffic Monitoring Endpoints
@router.get("/monitoring", response_model=List[TrafficMonitoringResponse])
def get_traffic_monitoring(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    road_type: Optional[RoadType] = None,
    traffic_status: Optional[TrafficStatus] = None,
    barangay: Optional[str] = Query(None, description="Filter by barangay in Las Piñas City"),
    db: Session = Depends(get_db)
):
    """Get real-time traffic monitoring data with filtering options."""
    try:
        query = db.query(TrafficMonitoring)
        
        if road_type:
            query = query.filter(TrafficMonitoring.road_type == road_type)
        if traffic_status:
            query = query.filter(TrafficMonitoring.traffic_status == traffic_status)
        if barangay:
            query = query.filter(TrafficMonitoring.barangay.ilike(f"%{barangay}%"))
        
        return query.offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching traffic monitoring data: {str(e)}")
        # Return empty list instead of 500 error
        return []

@router.get("/monitoring/barangay/{barangay_name}")
def get_traffic_by_barangay(
    barangay_name: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """Get traffic monitoring data for a specific barangay in Las Piñas City."""
    traffic_data = db.query(TrafficMonitoring).filter(
        TrafficMonitoring.barangay.ilike(f"%{barangay_name}%")
    ).offset(skip).limit(limit).all()
    
    if not traffic_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No traffic data found for barangay: {barangay_name}"
        )
    
    return {
        "barangay": barangay_name,
        "traffic_data": traffic_data,
        "total_roads": len(traffic_data),
        "timestamp": datetime.utcnow()
    }

@router.get("/monitoring/barangays")
def get_all_barangays_with_traffic(
    db: Session = Depends(get_db)
):
    """Get list of all barangays in Las Piñas City with their traffic summary."""
    # Get unique barangays from traffic data
    barangays = db.query(TrafficMonitoring.barangay).distinct().all()
    barangay_list = [barangay[0] for barangay in barangays if barangay[0]]
    
    # Get traffic summary for each barangay
    barangay_summaries = []
    for barangay in barangay_list:
        traffic_data = db.query(TrafficMonitoring).filter(
            TrafficMonitoring.barangay == barangay
        ).all()
        
        # Calculate summary statistics
        total_roads = len(traffic_data)
        heavy_traffic = len([t for t in traffic_data if t.traffic_status in [TrafficStatus.HEAVY, TrafficStatus.STANDSTILL]])
        avg_congestion = sum(t.congestion_percentage for t in traffic_data) / total_roads if total_roads > 0 else 0
        
        barangay_summaries.append({
            "barangay": barangay,
            "total_roads": total_roads,
            "heavy_traffic_roads": heavy_traffic,
            "average_congestion": round(avg_congestion, 1),
            "last_updated": max(t.last_updated for t in traffic_data) if traffic_data else None
        })
    
    return {
        "barangays": barangay_summaries,
        "total_barangays": len(barangay_summaries),
        "timestamp": datetime.utcnow()
    }

@router.get("/monitoring/heatmap")
def get_traffic_heatmap(
    lat_min: float = Query(..., description="Minimum latitude"),
    lat_max: float = Query(..., description="Maximum latitude"),
    lng_min: float = Query(..., description="Minimum longitude"),
    lng_max: float = Query(..., description="Maximum longitude"),
    db: Session = Depends(get_db)
):
    """Get traffic data for heatmap visualization within specified bounds."""
    traffic_data = db.query(TrafficMonitoring).filter(
        TrafficMonitoring.latitude.between(lat_min, lat_max),
        TrafficMonitoring.longitude.between(lng_min, lng_max)
    ).all()
    
    heatmap_data = []
    for traffic in traffic_data:
        intensity = 0.2  # Default for free flow
        if traffic.traffic_status == TrafficStatus.LIGHT:
            intensity = 0.4
        elif traffic.traffic_status == TrafficStatus.MODERATE:
            intensity = 0.6
        elif traffic.traffic_status == TrafficStatus.HEAVY:
            intensity = 0.8
        elif traffic.traffic_status == TrafficStatus.STANDSTILL:
            intensity = 1.0
            
        heatmap_data.append({
            "lat": traffic.latitude,
            "lng": traffic.longitude,
            "intensity": intensity,
            "road_name": traffic.road_name,
            "status": traffic.traffic_status.value,
            "barangay": traffic.barangay,
            "vehicle_count": traffic.vehicle_count,
            "congestion_percentage": traffic.congestion_percentage,
            "data_source": getattr(traffic, 'data_source', 'unknown')
        })
    
    return {"heatmap_data": heatmap_data}

@router.post("/monitoring/heatmap/broadcast")
async def trigger_heatmap_broadcast(
    bounds: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger a heatmap broadcast for testing purposes."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can trigger broadcasts"
        )
    
    await broadcast_heatmap_update(db, bounds)
    return {"message": "Heatmap broadcast triggered successfully"}

@router.post("/monitoring", response_model=TrafficMonitoringResponse, status_code=status.HTTP_201_CREATED)
async def create_traffic_monitoring(
    traffic_data: TrafficMonitoringCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new traffic monitoring entry (for traffic enforcers/admin)."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can create traffic monitoring data"
        )
    
    traffic = TrafficMonitoring(**traffic_data.dict())
    db.add(traffic)
    db.commit()
    db.refresh(traffic)
    
    # Broadcast real-time heatmap update
    background_tasks.add_task(broadcast_heatmap_update, db)
    
    return traffic

@router.put("/monitoring/{traffic_id}", response_model=TrafficMonitoringResponse)
async def update_traffic_monitoring(
    traffic_id: int,
    traffic_update: TrafficMonitoringUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update traffic monitoring data."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can update traffic data"
        )
    
    traffic = db.query(TrafficMonitoring).filter(TrafficMonitoring.id == traffic_id).first()
    if not traffic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Traffic monitoring entry not found"
        )
    
    for field, value in traffic_update.dict(exclude_unset=True).items():
        setattr(traffic, field, value)
    
    db.commit()
    db.refresh(traffic)
    
    # Broadcast real-time heatmap update
    background_tasks.add_task(broadcast_heatmap_update, db)
    
    return traffic

# Route Alternatives Endpoints
@router.get("/routes", response_model=List[RouteAlternativeResponse])
def get_route_alternatives(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lng: float = Query(..., description="Origin longitude"),
    destination_lat: float = Query(..., description="Destination latitude"),
    destination_lng: float = Query(..., description="Destination longitude"),
    db: Session = Depends(get_db)
):
    """Get alternative routes between origin and destination."""
    # For now, return all routes (in production, this would filter by proximity)
    routes = db.query(RouteAlternative).filter(
        RouteAlternative.origin_lat.between(origin_lat - 0.01, origin_lat + 0.01),
        RouteAlternative.origin_lng.between(origin_lng - 0.01, origin_lng + 0.01),
        RouteAlternative.destination_lat.between(destination_lat - 0.01, destination_lat + 0.01),
        RouteAlternative.destination_lng.between(destination_lng - 0.01, destination_lng + 0.01)
    ).order_by(RouteAlternative.estimated_duration_minutes).all()
    
    return routes

@router.post("/routes", response_model=RouteAlternativeResponse, status_code=status.HTTP_201_CREATED)
def create_route_alternative(
    route_data: RouteAlternativeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new route alternative."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can create routes"
        )
    
    route = RouteAlternative(**route_data.dict())
    db.add(route)
    db.commit()
    db.refresh(route)
    return route

# Road Incidents Endpoints
@router.get("/incidents", response_model=List[RoadIncidentResponse])
def get_road_incidents(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    is_active: bool = Query(True, description="Filter by active incidents"),
    incident_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get road incidents with filtering options."""
    try:
        query = db.query(RoadIncident).filter(RoadIncident.is_active == is_active)
        
        if incident_type:
            query = query.filter(RoadIncident.incident_type == incident_type)
        
        return query.order_by(RoadIncident.created_at.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error fetching road incidents: {str(e)}")
        # Return empty list instead of 500 error
        return []

@router.get("/incidents/nearby")
def get_nearby_incidents(
    latitude: float = Query(..., description="Current latitude"),
    longitude: float = Query(..., description="Current longitude"),
    radius_km: float = Query(5.0, description="Search radius in kilometers"),
    db: Session = Depends(get_db)
):
    """Get incidents near a specific location."""
    # Simple proximity calculation (in production, use PostGIS or similar)
    lat_range = radius_km / 111.0  # Approximate km to degrees
    lng_range = radius_km / (111.0 * abs(latitude))  # Adjust for latitude
    
    incidents = db.query(RoadIncident).filter(
        RoadIncident.is_active == True,
        RoadIncident.latitude.between(latitude - lat_range, latitude + lat_range),
        RoadIncident.longitude.between(longitude - lng_range, longitude + lng_range)
    ).all()
    
    return {"incidents": incidents, "radius_km": radius_km}

@router.post("/incidents", response_model=RoadIncidentResponse, status_code=status.HTTP_201_CREATED)
def report_road_incident(
    incident_data: RoadIncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Report a new road incident."""
    incident = RoadIncident(**incident_data.dict())
    incident.reporter_source = f"{current_user.role.value}_{current_user.id}"
    
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident

@router.put("/incidents/{incident_id}", response_model=RoadIncidentResponse)
def update_road_incident(
    incident_id: int,
    incident_update: RoadIncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update road incident information."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can update incidents"
        )
    
    incident = db.query(RoadIncident).filter(RoadIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Road incident not found"
        )
    
    for field, value in incident_update.dict(exclude_unset=True).items():
        setattr(incident, field, value)
    
    db.commit()
    db.refresh(incident)
    return incident

@router.delete("/incidents/{incident_id}")
def deactivate_road_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deactivate/resolve a road incident."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can resolve incidents"
        )
    
    incident = db.query(RoadIncident).filter(RoadIncident.id == incident_id).first()
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Road incident not found"
        )
    
    incident.is_active = False
    db.commit()
    return {"message": "Road incident resolved successfully"}

# Traffic Simulation Endpoints (for development/demo purposes)
@router.post("/simulation/start")
async def start_traffic_simulation(
    update_interval: int = Query(15, ge=5, le=300, description="Update interval in seconds"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start the traffic simulation for demonstration purposes."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can control traffic simulation"
        )
    
    if traffic_generator.is_running:
        return {"message": "Traffic simulation is already running"}
    
    # Start simulation in background
    asyncio.create_task(traffic_generator.start_simulation(update_interval))
    
    return {"message": f"Traffic simulation started with {update_interval}s intervals"}

@router.post("/simulation/stop")
async def stop_traffic_simulation(
    current_user: User = Depends(get_current_user)
):
    """Stop the traffic simulation."""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can control traffic simulation"
        )
    
    traffic_generator.stop_simulation()
    return {"message": "Traffic simulation stopped"}

@router.get("/simulation/status")
async def get_simulation_status(
    current_user: User = Depends(get_current_user)
):
    """Get the current status of the traffic simulation."""
    if current_user.role.value not in ["admin", "traffic_enforcer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and traffic enforcers can view simulation status"
        )
    
    return {
        "is_running": traffic_generator.is_running,
        "roads_monitored": len(traffic_generator.las_pinas_roads),
        "status": "running" if traffic_generator.is_running else "stopped"
    }

# Import roadworks scraper service
from ..services.roadworks_scraper_service import scrape_and_save_roadworks
from ..schemas.traffic_schema import RoadworksScrapingRequest

@router.post("/roadworks/scrape")
async def scrape_roadworks(
    request: RoadworksScrapingRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Scrape ongoing roadworks in Las Piñas City and save to database"""
    if current_user.role.value not in ["admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can scrape roadworks data"
        )
    
    try:
        # Run scraping in background with optional Facebook pages
        result = await scrape_and_save_roadworks(request.facebook_pages)
        
        return {
            "message": "Roadworks scraping completed",
            "result": result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error scraping roadworks: {str(e)}"
        )

@router.get("/roadworks/active")
async def get_active_roadworks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """Get all active roadwork incidents"""
    try:
        roadworks = db.query(RoadIncident).filter(
            RoadIncident.incident_type == "road_work",
            RoadIncident.is_active == True
        ).order_by(RoadIncident.created_at.desc()).offset(skip).limit(limit).all()
        
        return roadworks
    except Exception as e:
        logger.error(f"Error fetching active roadworks: {str(e)}")
        # Return empty list instead of 500 error
        return []

@router.post("/roadworks/manual")
async def create_manual_roadwork(
    roadwork_data: RoadIncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually create a roadwork incident"""
    if current_user.role.value not in ["admin", "lgu_staff", "traffic_enforcer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins, LGU staff, and traffic enforcers can create roadwork incidents"
        )
    
    # Ensure it's marked as road work
    roadwork_data.incident_type = "road_work"
    
    db_incident = RoadIncident(**roadwork_data.dict())
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    
    return db_incident

# Real-time Traffic Insights Endpoints
@router.get("/insights/daily")
async def get_daily_traffic_insights(
    db: Session = Depends(get_db)
):
    """Get daily traffic insights with personalized messages and recommendations."""
    try:
        insights = traffic_insights_service.get_daily_traffic_insights(db)
        return insights
    except Exception as e:
        logger.error(f"Error generating traffic insights: {str(e)}")
        # Return default insights instead of 500 error
        return traffic_insights_service._get_default_insights()

# Traffic Pattern Endpoint (24h, 15-min intervals)
@router.get("/monitoring/patterns")
def get_las_pinas_traffic_patterns(
    db: Session = Depends(get_db)
):
    """Return 24-hour traffic patterns for major Las Piñas roads at 15-minute intervals.

    Roads: Alabang-Zapote Road, CAA Road, C-5 Extension, Almanza Road, West Service Road
    Fields: timestamp, road_name, average_speed_kph, vehicle_count, congestion_level
    """
    from datetime import datetime, timedelta
    from ..schemas.traffic_schema import TrafficPatternResponse, TrafficPatternPoint

    roads = [
        "Alabang-Zapote Road",
        "CAA Road",
        "C-5 Extension",
        "Almanza Road",
        "West Service Road",
    ]

    # Define base free-flow speed per road (kph) and capacity factors for realism
    base_speed = {
        "Alabang-Zapote Road": 45.0,
        "CAA Road": 50.0,
        "C-5 Extension": 60.0,
        "Almanza Road": 40.0,
        "West Service Road": 55.0,
    }
    capacity_factor = {
        "Alabang-Zapote Road": 1.0,
        "CAA Road": 0.8,
        "C-5 Extension": 1.1,
        "Almanza Road": 0.7,
        "West Service Road": 0.9,
    }

    # Use today's date 00:00 to 23:59 as range
    now = datetime.now()
    start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_time = start_time + timedelta(hours=24) - timedelta(minutes=1)

    interval_minutes = 15
    total_points = int(24 * 60 / interval_minutes)

    points: list[TrafficPatternPoint] = []

    def profile_factor(minute_of_day: int) -> float:
        """Traffic load factor 0..1 across the day for vehicle counts.
        - Light 00:00-05:00 -> ~0.15-0.25
        - Build 06:00-08:00 -> ~0.8-1.0 peak
        - Midday 10:00-15:00 -> ~0.45-0.6
        - Evening 16:00-19:00 -> ~0.9-1.0 peak
        - Night 21:00-23:59 -> ~0.2-0.35
        """
        h = minute_of_day // 60
        if 0 <= h < 5:
            return 0.2
        if 5 <= h < 6:
            return 0.35
        if 6 <= h < 9:
            return 0.9
        if 9 <= h < 10:
            return 0.6
        if 10 <= h < 16:
            return 0.5
        if 16 <= h < 19:
            return 0.95
        if 19 <= h < 21:
            return 0.55
        return 0.3

    def speed_adjustment(load: float) -> float:
        """Return speed multiplier based on load (higher load => lower speed)."""
        if load >= 0.9:
            return 0.45  # heavy
        if load >= 0.6:
            return 0.65  # moderate
        if load >= 0.35:
            return 0.8   # building/light
        return 0.95       # free/light

    def congestion_label(avg_speed: float, free_speed: float) -> str:
        ratio = avg_speed / max(free_speed, 1.0)
        if ratio < 0.55:
            return "heavy"
        if ratio < 0.8:
            return "moderate"
        return "low"

    for i in range(total_points):
        ts = start_time + timedelta(minutes=i * interval_minutes)
        minute_of_day = i * interval_minutes
        load = profile_factor(minute_of_day)

        for road in roads:
            free_speed = base_speed[road]
            multiplier = speed_adjustment(load)
            avg_speed = max(5.0, round(free_speed * multiplier, 1))

            # Vehicle count modeled by load and road capacity
            base_capacity = 1000  # baseline per 15 minutes across lanes
            veh = int(base_capacity * capacity_factor[road] * load)

            level = congestion_label(avg_speed, free_speed)

            points.append(TrafficPatternPoint(
                timestamp=ts,
                road_name=road,
                average_speed_kph=avg_speed,
                vehicle_count=veh,
                congestion_level=level,
            ))

    response = {
        "roads": roads,
        "interval_minutes": interval_minutes,
        "start_time": start_time,
        "end_time": end_time,
        "data": points,
    }
    return response

@router.get("/insights/trends")
async def get_traffic_trends(
    db: Session = Depends(get_db)
):
    """Get hourly traffic trends for the current day."""
    try:
        trends = traffic_insights_service.get_hourly_traffic_trends(db)
        return trends
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating traffic trends: {str(e)}"
        )

# Smart Routing Endpoints
@router.get("/routing/smart")
async def get_smart_route_suggestions(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lng: float = Query(..., description="Origin longitude"), 
    destination_lat: float = Query(..., description="Destination latitude"),
    destination_lng: float = Query(..., description="Destination longitude"),
    avoid_traffic: bool = Query(True, description="Avoid heavy traffic areas"),
    db: Session = Depends(get_db)
):
    """Get smart route suggestions with accurate road-following routes using OSRM."""
    try:
        route_suggestions = await smart_routing_service.get_smart_route_suggestions(
            origin_lat, origin_lng, destination_lat, destination_lng, db, avoid_traffic
        )
        return route_suggestions
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating route suggestions: {str(e)}"
        )

@router.post("/routing/save-route")
async def save_preferred_route(
    route_data: RouteAlternativeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a user's preferred route for future reference."""
    if current_user.role.value not in ["traffic_enforcer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only traffic enforcers and admins can save routes"
        )
    
    try:
        # Mark as recommended route
        route_data.is_recommended = True
        
        route = RouteAlternative(**route_data.dict())
        db.add(route)
        db.commit()
        db.refresh(route)
        
        return {
            "message": "Route saved successfully",
            "route_id": route.id,
            "route": route
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving route: {str(e)}"
        )

@router.get("/routing/recommended")
async def get_recommended_routes(
    origin_lat: float = Query(None, description="Origin latitude for filtering"),
    origin_lng: float = Query(None, description="Origin longitude for filtering"),
    limit: int = Query(10, le=50, description="Maximum number of routes to return"),
    db: Session = Depends(get_db)
):
    """Get recommended routes, optionally filtered by origin."""
    try:
        query = db.query(RouteAlternative).filter(RouteAlternative.is_recommended == True)
        
        if origin_lat is not None and origin_lng is not None:
            # Filter routes near the origin (within ~1km)
            lat_range = 0.01  # Approximately 1km
            lng_range = 0.01
            query = query.filter(
                and_(
                    RouteAlternative.origin_lat.between(origin_lat - lat_range, origin_lat + lat_range),
                    RouteAlternative.origin_lng.between(origin_lng - lng_range, origin_lng + lng_range)
                )
            )
        
        routes = query.order_by(RouteAlternative.updated_at.desc()).limit(limit).all()
        
        return {
            "recommended_routes": routes,
            "total_count": len(routes),
            "filtered_by_origin": origin_lat is not None and origin_lng is not None
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recommended routes: {str(e)}"
        )

# Geocoding Proxy Endpoints
@router.get("/geocode")
async def geocode_location(
    query: str = Query(..., description="Search query"),
    limit: int = Query(10, le=20, description="Maximum number of results"),
    country: str = Query("PH", description="Country code")
):
    """Geocode location search - proxy for Nominatim to avoid CORS issues."""
    import httpx
    
    try:
        params = {
            'q': query,
            'format': 'json',
            'limit': limit,
            'countrycodes': country.lower(),
            'addressdetails': '1',
            'extratags': '1',
            'namedetails': '1'
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                'https://nominatim.openstreetmap.org/search',
                params=params,
                headers={'User-Agent': 'LasPinasTrafficManagement/1.0'}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Transform to frontend format
                results = []
                for item in data:
                    results.append({
                        'id': f"{item['lat']}_{item['lon']}",
                        'name': item.get('display_name', ''),
                        'lat': float(item['lat']),
                        'lng': float(item['lon']),
                        'address': {
                            'street': item.get('address', {}).get('road', ''),
                            'city': item.get('address', {}).get('city', item.get('address', {}).get('town', '')),
                            'country': item.get('address', {}).get('country', 'Philippines'),
                            'full': item.get('display_name', '')
                        },
                        'type': 'general',
                        'provider': 'OpenStreetMap',
                        'confidence': 0.8
                    })
                return results
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Nominatim API error: {response.status_code}"
                )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Geocoding service timeout"
        )
    except Exception as e:
        logger.error(f"Geocoding search error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Geocoding search failed: {str(e)}"
        )

@router.get("/reverse-geocode")
async def reverse_geocode_location(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude")
):
    """Reverse geocode coordinates - proxy for Nominatim to avoid CORS issues."""
    import httpx
    
    try:
        params = {
            'lat': lat,
            'lon': lng,
            'format': 'json',
            'addressdetails': '1'
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                'https://nominatim.openstreetmap.org/reverse',
                params=params,
                headers={'User-Agent': 'LasPinasTrafficManagement/1.0'}
            )
            
            if response.status_code == 200:
                data = response.json()
                # Transform to frontend format
                return {
                    'id': f"{lat}_{lng}",
                    'name': data.get('display_name', ''),
                    'lat': float(data['lat']),
                    'lng': float(data['lon']),
                    'address': {
                        'street': data.get('address', {}).get('road', ''),
                        'city': data.get('address', {}).get('city', data.get('address', {}).get('town', '')),
                        'country': data.get('address', {}).get('country', 'Philippines'),
                        'full': data.get('display_name', '')
                    },
                    'type': 'general',
                    'provider': 'OpenStreetMap',
                    'confidence': 0.8
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Nominatim API error: {response.status_code}"
                )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Reverse geocoding service timeout"
        )
    except Exception as e:
        logger.error(f"Reverse geocoding error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reverse geocoding failed: {str(e)}"
        )

@router.get("/geocoding/search")
async def geocoding_search(
    q: str = Query(..., description="Search query"),
    limit: int = Query(5, le=20, description="Maximum number of results")
):
    """Proxy for Nominatim geocoding search to avoid CORS issues."""
    import httpx
    
    try:
        params = {
            'q': f"{q}, Las Piñas City, Philippines",
            'format': 'json',
            'limit': limit,
            'countrycodes': 'ph',
            'addressdetails': '1',
            'extratags': '1',
            'namedetails': '1'
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                'https://nominatim.openstreetmap.org/search',
                params=params,
                headers={'User-Agent': 'LasPinasTrafficManagement/1.0'}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Nominatim API error: {response.status_code}"
                )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Geocoding service timeout"
        )
    except Exception as e:
        logger.error(f"Geocoding search error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Geocoding search failed: {str(e)}"
        )

@router.get("/geocoding/reverse")
async def geocoding_reverse(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    """Proxy for Nominatim reverse geocoding to avoid CORS issues."""
    import httpx
    
    try:
        params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'addressdetails': '1'
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                'https://nominatim.openstreetmap.org/reverse',
                params=params,
                headers={'User-Agent': 'LasPinasTrafficManagement/1.0'}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Nominatim API error: {response.status_code}"
                )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Geocoding service timeout"
        )
    except Exception as e:
        logger.error(f"Reverse geocoding error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reverse geocoding failed: {str(e)}"
        )