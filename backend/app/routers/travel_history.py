from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, extract
from datetime import datetime, timedelta
from typing import List, Optional
from ..db import get_db
from ..models import TravelSession, FavoriteRoute, User
from ..schemas.travel_history import (
    TravelSessionCreate, TravelSessionResponse, FavoriteRouteCreate,
    FavoriteRouteResponse, TravelStatsResponse, FrequentLocationResponse
)
from ..auth import get_current_user

router = APIRouter()

@router.post("/sessions", response_model=TravelSessionResponse)
async def create_travel_session(
    session_data: TravelSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new travel session"""
    db_session = TravelSession(
        user_id=current_user.id,
        origin_name=session_data.origin_name,
        origin_lat=session_data.origin_lat,
        origin_lng=session_data.origin_lng,
        destination_name=session_data.destination_name,
        destination_lat=session_data.destination_lat,
        destination_lng=session_data.destination_lng,
        route_data=session_data.route_data,
        duration_minutes=session_data.duration_minutes,
        distance_km=session_data.distance_km,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        travel_mode=session_data.travel_mode,
        traffic_conditions=session_data.traffic_conditions,
        notes=session_data.notes
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions", response_model=List[TravelSessionResponse])
async def get_travel_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's travel history with optional filtering"""
    query = db.query(TravelSession).filter(TravelSession.user_id == current_user.id)

    if start_date:
        query = query.filter(TravelSession.start_time >= start_date)
    if end_date:
        query = query.filter(TravelSession.start_time <= end_date)

    sessions = query.order_by(desc(TravelSession.start_time)).offset(offset).limit(limit).all()
    return sessions

@router.get("/frequent-locations", response_model=List[FrequentLocationResponse])
async def get_frequent_locations(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's most frequently visited locations"""
    # Get destination locations with visit counts
    destinations = db.query(
        TravelSession.destination_name,
        TravelSession.destination_lat,
        TravelSession.destination_lng,
        func.count(TravelSession.id).label('visit_count')
    ).filter(
        TravelSession.user_id == current_user.id,
        TravelSession.destination_name.isnot(None)
    ).group_by(
        TravelSession.destination_name,
        TravelSession.destination_lat,
        TravelSession.destination_lng
    ).order_by(desc('visit_count')).limit(limit).all()

    # Get origin locations with visit counts
    origins = db.query(
        TravelSession.origin_name,
        TravelSession.origin_lat,
        TravelSession.origin_lng,
        func.count(TravelSession.id).label('visit_count')
    ).filter(
        TravelSession.user_id == current_user.id,
        TravelSession.origin_name.isnot(None)
    ).group_by(
        TravelSession.origin_name,
        TravelSession.origin_lat,
        TravelSession.origin_lng
    ).order_by(desc('visit_count')).limit(limit).all()

    # Combine and deduplicate
    location_map = {}
    for dest in destinations:
        key = (dest.destination_name, dest.destination_lat, dest.destination_lng)
        if key not in location_map or dest.visit_count > location_map[key]['count']:
            location_map[key] = {
                'name': dest.destination_name,
                'lat': dest.destination_lat,
                'lng': dest.destination_lng,
                'count': dest.visit_count,
                'type': 'destination'
            }

    for origin in origins:
        key = (origin.origin_name, origin.origin_lat, origin.origin_lng)
        if key not in location_map or origin.visit_count > location_map[key]['count']:
            location_map[key] = {
                'name': origin.origin_name,
                'lat': origin.origin_lat,
                'lng': origin.origin_lng,
                'count': origin.visit_count,
                'type': 'origin'
            }

    # Convert to response format
    locations = list(location_map.values())
    locations.sort(key=lambda x: x['count'], reverse=True)

    return locations[:limit]

@router.get("/stats", response_model=TravelStatsResponse)
async def get_travel_stats(
    timeframe: str = Query('month', regex='^(day|week|month|year)$'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get travel statistics for the user"""
    now = datetime.utcnow()

    # Calculate date range based on timeframe
    if timeframe == 'day':
        start_date = now - timedelta(days=1)
    elif timeframe == 'week':
        start_date = now - timedelta(weeks=1)
    elif timeframe == 'month':
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)

    # Get sessions in timeframe
    sessions = db.query(TravelSession).filter(
        TravelSession.user_id == current_user.id,
        TravelSession.start_time >= start_date
    ).all()

    if not sessions:
        return {
            "total_trips": 0,
            "total_distance_km": 0,
            "total_time_minutes": 0,
            "average_speed_kmh": 0,
            "most_frequent_destination": None,
            "travel_patterns": []
        }

    # Calculate stats
    total_distance = sum(s.distance_km or 0 for s in sessions)
    total_time = sum(s.duration_minutes or 0 for s in sessions)
    average_speed = (total_distance / total_time * 60) if total_time > 0 else 0

    # Find most frequent destination
    dest_counts = {}
    for session in sessions:
        if session.destination_name:
            dest_counts[session.destination_name] = dest_counts.get(session.destination_name, 0) + 1

    most_frequent = max(dest_counts.items(), key=lambda x: x[1]) if dest_counts else None

    # Analyze patterns (simplified)
    patterns = []

    return {
        "total_trips": len(sessions),
        "total_distance_km": round(total_distance, 2),
        "total_time_minutes": round(total_time, 2),
        "average_speed_kmh": round(average_speed, 2),
        "most_frequent_destination": {
            "name": most_frequent[0],
            "count": most_frequent[1]
        } if most_frequent else None,
        "travel_patterns": patterns
    }

@router.post("/favorites", response_model=FavoriteRouteResponse)
async def create_favorite_route(
    route_data: FavoriteRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a favorite route"""
    db_favorite = FavoriteRoute(
        user_id=current_user.id,
        name=route_data.name,
        origin_name=route_data.origin_name,
        origin_lat=route_data.origin_lat,
        origin_lng=route_data.origin_lng,
        destination_name=route_data.destination_name,
        destination_lat=route_data.destination_lat,
        destination_lng=route_data.destination_lng,
        route_summary=route_data.route_summary,
        is_default=route_data.is_default
    )
    db.add(db_favorite)
    db.commit()
    db.refresh(db_favorite)
    return db_favorite

@router.get("/favorites", response_model=List[FavoriteRouteResponse])
async def get_favorite_routes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's favorite routes"""
    favorites = db.query(FavoriteRoute).filter(
        FavoriteRoute.user_id == current_user.id
    ).order_by(desc(FavoriteRoute.created_at)).all()
    return favorites

@router.delete("/sessions/{session_id}")
async def delete_travel_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a travel session"""
    session = db.query(TravelSession).filter(
        TravelSession.id == session_id,
        TravelSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Travel session not found")

    db.delete(session)
    db.commit()
    return {"message": "Travel session deleted successfully"}
