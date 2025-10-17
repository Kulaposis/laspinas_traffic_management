#!/usr/bin/env python3
"""
Simple CORS test server for Emergency Center
This is a minimal server to test CORS configuration
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

# Create FastAPI app
app = FastAPI(title="Emergency CORS Test Server")

# Add CORS middleware with the most permissive settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"]
)

@app.get("/")
def read_root():
    return {"message": "Emergency CORS Test Server", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "cors": "enabled"}

# Mock emergency endpoints
@app.get("/emergency/active")
def get_active_emergencies():
    return [
        {
            "id": 1,
            "title": "Test Emergency",
            "status": "active",
            "emergency_type": "accident",
            "severity": "medium",
            "created_at": "2024-01-01T00:00:00Z"
        }
    ]

@app.get("/emergency/")
def get_all_emergencies():
    return [
        {
            "id": 1,
            "title": "Test Emergency 1",
            "status": "resolved",
            "emergency_type": "accident",
            "severity": "medium"
        },
        {
            "id": 2,
            "title": "Test Emergency 2", 
            "status": "active",
            "emergency_type": "medical",
            "severity": "high"
        }
    ]

@app.get("/emergency/statistics")
def get_emergency_statistics(days: int = 30):
    return {
        "period_days": days,
        "emergency_statistics": {
            "total": 10,
            "resolved": 8,
            "active": 2,
            "resolution_rate": 80.0,
            "avg_response_time_minutes": 15.5
        },
        "complaint_statistics": {
            "total_complaints": 5,
            "total_suggestions": 3,
            "resolved": 6,
            "resolution_rate": 75.0
        }
    }

@app.get("/emergency/complaints")
def get_complaints(limit: int = 50):
    return [
        {
            "id": 1,
            "type": "complaint",
            "category": "illegal_parking",
            "title": "Test Complaint",
            "status": "pending"
        }
    ]

# Catch-all OPTIONS handler
@app.options("/{path:path}")
async def options_handler():
    return {"message": "OK"}

if __name__ == "__main__":
    print("🚀 Starting Emergency CORS Test Server...")
    print("📍 Server: http://localhost:8000")
    print("🧪 Test endpoints:")
    print("   - GET /health")
    print("   - GET /emergency/active")
    print("   - GET /emergency/")
    print("   - GET /emergency/statistics")
    print("   - GET /emergency/complaints")
    print("-" * 50)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
