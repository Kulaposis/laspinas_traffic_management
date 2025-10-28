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
from typing import Optional

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
    
    sessions = query.order_by(TravelSession.start_time.desc()).offset(offset).limit(limit).all()
    return sessions

@router.get("/frequent-locations", response_model=List[FrequentLocationResponse])
async def get_frequent_locations(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's most frequently visited locations"""
    # Get all sessions for the user
    sessions = db.query(TravelSession).filter(TravelSession.user_id == current_user.id).all()
    
    # Count destination occurrences
    location_counts = {}
    for session in sessions:
        if session.destination_name and session.destination_lat and session.destination_lng:
            key = f"{session.destination_lat},{session.destination_lng}"
            if key not in location_counts:
                location_counts[key] = {
                    "name": session.destination_name,
                    "lat": session.destination_lat,
                    "lng": session.destination_lng,
                    "count": 0
                }
            location_counts[key]["count"] += 1
    
    # Sort by count and return top locations
    frequent = sorted(location_counts.values(), key=lambda x: x["count"], reverse=True)[:limit]
    return frequent

@router.get("/stats", response_model=TravelStatsResponse)
async def get_travel_stats(
    timeframe: str = Query('month', regex='^(day|week|month|year)$'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get travel statistics for the user"""
    # Calculate date range based on timeframe
    now = datetime.utcnow()
    if timeframe == 'day':
        start_date = now - timedelta(days=1)
    elif timeframe == 'week':
        start_date = now - timedelta(days=7)
    elif timeframe == 'month':
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    sessions = db.query(TravelSession).filter(
        TravelSession.user_id == current_user.id,
        TravelSession.start_time >= start_date
    ).all()
    
    total_trips = len(sessions)
    total_distance = sum(s.distance_km or 0 for s in sessions)
    total_time = sum(s.duration_minutes or 0 for s in sessions)
    avg_speed = (total_distance / (total_time / 60)) if total_time > 0 else 0
    
    # Find most frequent destination
    dest_counts = {}
    for s in sessions:
        if s.destination_name:
            dest_counts[s.destination_name] = dest_counts.get(s.destination_name, 0) + 1
    
    most_frequent = max(dest_counts.items(), key=lambda x: x[1])[0] if dest_counts else None
    
    return {
        "total_trips": total_trips,
        "total_distance_km": round(total_distance, 2),
        "total_time_minutes": round(total_time, 2),
        "average_speed_kmh": round(avg_speed, 2),
        "most_frequent_destination": most_frequent,
        "travel_patterns": []
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
    ).order_by(FavoriteRoute.created_at.desc()).all()
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
