from fastapi import FastAPI, Depends, WebSocket, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
import logging
import os
from .db import get_db, Base, engine
from .routers import auth, users, reports, violations, notifications, traffic, weather, emergency, footprints, parking, incident_prone_areas, logs, admin, travel_history
from .websocket import websocket_endpoint
from .services.scheduler import start_weather_scheduler, stop_weather_scheduler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await start_weather_scheduler()
    yield
    # Shutdown
    await stop_weather_scheduler()

app = FastAPI(
    title="Traffic Management System",
    description="A comprehensive traffic management system for LGU operations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration based on environment
cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
).split(",")

# In production, use configured origins or allow all for flexibility
if os.getenv("ENVIRONMENT") == "production":
    # If no specific origins are configured, allow all for deployment flexibility
    if not cors_origins:
        cors_origins = ["*"]
    allow_credentials = True
else:
    # Development: allow all origins for easier testing
    cors_origins = ["*"]
    allow_credentials = True

# CORS middleware - Comprehensive configuration for Emergency Center
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"]
)

# Add error handling middleware
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        # Add CORS headers to all responses
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, Cache-Control"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        # Add COOP headers to fix Cross-Origin-Opener-Policy issues
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        return response
    except Exception as exc:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, User-Agent, Cache-Control",
                "Access-Control-Allow-Credentials": "true",
                "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
                "Cross-Origin-Embedder-Policy": "unsafe-none",
                "Cross-Origin-Resource-Policy": "cross-origin"
            }
        )

# Add request logging middleware for debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(reports.router)
app.include_router(violations.router)
app.include_router(notifications.router)
app.include_router(traffic.router)
app.include_router(weather.router)
app.include_router(emergency.router)
app.include_router(footprints.router)
app.include_router(parking.router)
app.include_router(incident_prone_areas.router)
app.include_router(logs.router)
app.include_router(admin.router)
app.include_router(travel_history.router, prefix="/traffic")

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_route(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await websocket_endpoint(websocket, user_id, db)

@app.get("/")
def read_root():
    return {"message": "Traffic Management System API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Firebase sync endpoint is now handled by auth router

# Note: Global catch-all OPTIONS handlers removed.
# CORSMiddleware already handles preflight requests across all routes.

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
