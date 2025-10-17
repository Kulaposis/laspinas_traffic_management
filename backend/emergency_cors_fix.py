#!/usr/bin/env python3
"""
Emergency CORS Fix Script
This script fixes CORS issues specifically for the Emergency Center functionality
"""

import sys
import os
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

# Add the app directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_cors_fixed_app():
    """Create FastAPI app with comprehensive CORS configuration"""
    
    # Import the original app
    from app.main import app as original_app
    
    # Clear existing middleware
    app = FastAPI(
        title="Traffic Management System - CORS Fixed",
        description="Emergency Center with CORS fixes applied",
        version="1.0.1"
    )
    
    # Add comprehensive CORS middleware FIRST
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins for development
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600,  # Cache preflight for 1 hour
    )
    
    # Add custom CORS headers middleware
    @app.middleware("http")
    async def add_cors_headers(request: Request, call_next):
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = JSONResponse({"message": "OK"})
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Max-Age"] = "3600"
            return response
        
        # Process the request
        response = await call_next(request)
        
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response
    
    # Copy routes from original app
    from app.routers import emergency, auth, users, reports, violations, notifications, traffic, weather, footprints, parking, incident_prone_areas, logs, admin
    
    # Include all routers
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(reports.router)
    app.include_router(violations.router)
    app.include_router(notifications.router)
    app.include_router(traffic.router)
    app.include_router(weather.router)
    app.include_router(emergency.router)  # Emergency router is key
    app.include_router(footprints.router)
    app.include_router(parking.router)
    app.include_router(incident_prone_areas.router)
    app.include_router(logs.router)
    app.include_router(admin.router)
    
    @app.get("/")
    def read_root():
        return {"message": "Traffic Management System API - CORS Fixed", "status": "running"}
    
    @app.get("/health")
    def health_check():
        return {"status": "healthy", "cors_fix": "applied"}
    
    # Catch-all OPTIONS handler
    @app.options("/{path:path}")
    async def options_handler():
        return {"message": "OK"}
    
    return app

def main():
    """Run the CORS-fixed server"""
    app = create_cors_fixed_app()
    
    logger.info("Starting Emergency Center with CORS fixes...")
    logger.info("Frontend should be able to connect to: http://localhost:8000")
    logger.info("Emergency endpoints available at: http://localhost:8000/emergency/")
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        reload=False,  # Disable reload for stability
        access_log=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
