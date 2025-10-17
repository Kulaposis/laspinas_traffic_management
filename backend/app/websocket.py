from fastapi import WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
import json
import asyncio
from .db import get_db
from .models.user import User

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.user_connections: Dict[int, int] = {}  # user_id -> connection_id mapping

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        connection_id = id(websocket)
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id
        print(f"User {user_id} connected with connection {connection_id}")

    def disconnect(self, user_id: int):
        if user_id in self.user_connections:
            connection_id = self.user_connections[user_id]
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
            del self.user_connections[user_id]
            print(f"User {user_id} disconnected")

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.user_connections:
            connection_id = self.user_connections[user_id]
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                try:
                    await websocket.send_text(message)
                except:
                    # Connection is broken, remove it
                    self.disconnect(user_id)

    async def broadcast(self, message: str):
        disconnected_connections = []
        for connection_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message)
            except:
                # Connection is broken, mark for removal
                disconnected_connections.append(connection_id)
        
        # Remove broken connections
        for connection_id in disconnected_connections:
            # Find user_id for this connection
            user_id = None
            for uid, cid in self.user_connections.items():
                if cid == connection_id:
                    user_id = uid
                    break
            if user_id:
                self.disconnect(user_id)

    async def send_notification(self, notification_data: dict, user_id: int = None):
        """Send notification via WebSocket."""
        message = json.dumps({
            "type": "notification",
            "data": notification_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_traffic_alert(self, alert_data: dict, user_id: int = None):
        """Send traffic alert via WebSocket."""
        message = json.dumps({
            "type": "traffic_alert",
            "data": alert_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_report_update(self, report_data: dict, user_id: int = None):
        """Send report update via WebSocket."""
        message = json.dumps({
            "type": "report_update",
            "data": report_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_footprint_update(self, footprint_data: dict, user_id: int = None):
        """Send footprint update via WebSocket."""
        message = json.dumps({
            "type": "footprint_update",
            "data": footprint_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_weather_update(self, weather_data: dict, user_id: int = None):
        """Send weather update via WebSocket."""
        message = json.dumps({
            "type": "weather_update",
            "data": weather_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_traffic_heatmap_update(self, heatmap_data: dict, user_id: int = None):
        """Send real-time traffic heatmap update via WebSocket."""
        message = json.dumps({
            "type": "traffic_heatmap_update",
            "data": heatmap_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

    async def send_weather_update(self, weather_data: dict, user_id: int = None):
        """Send weather/flood update via WebSocket."""
        message = json.dumps({
            "type": "weather_update",
            "data": weather_data
        })
        
        if user_id:
            await self.send_personal_message(message, user_id)
        else:
            await self.broadcast(message)

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    """WebSocket endpoint for real-time communications."""
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        await websocket.close(code=4001, reason="User not found")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            
            # Parse incoming message
            try:
                message = json.loads(data)
                message_type = message.get("type")
                
                if message_type == "ping":
                    # Respond to ping to keep connection alive
                    await websocket.send_text(json.dumps({"type": "pong"}))
                
                elif message_type == "location_update":
                    # Handle location updates for real-time tracking
                    location_data = message.get("data", {})
                    # You can store location updates or broadcast to relevant users
                    print(f"Location update from user {user_id}: {location_data}")
                
            except json.JSONDecodeError:
                # Invalid JSON, ignore
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)
