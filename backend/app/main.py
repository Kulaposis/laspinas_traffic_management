from fastapi import FastAPI, Depends, WebSocket, Request, HTTPException
from starlette.requests import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
import logging
import os
from datetime import datetime
from .db import get_db, Base, engine
from sqlalchemy import inspect, text
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded  # type: ignore
from .routers import auth, users, reports, violations, notifications, traffic, weather, emergency, footprints, parking, incident_prone_areas, logs, admin, travel_history
from .websocket import websocket_endpoint
from .services.scheduler import start_weather_scheduler, stop_weather_scheduler
from .models.user import User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Defer table creation to startup to avoid import-time crashes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        # Delay initial connect slightly when using remote pooled DBs
        import time, os
        if os.getenv("DATABASE_URL", "").find("leapcellpool.com") != -1:
            time.sleep(1.0)
        Base.metadata.create_all(bind=engine)
        # Ensure Firebase columns exist in production DBs where Alembic hasn't run
        try:
            with engine.begin() as conn:
                inspector = inspect(conn)
                user_columns = {c['name'] for c in inspector.get_columns('users')}
                # Add firebase_uid
                if 'firebase_uid' not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128)"))
                    logger.info("[startup-migration] Added users.firebase_uid")
                # Add photo_url
                if 'photo_url' not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN photo_url VARCHAR(512)"))
                    logger.info("[startup-migration] Added users.photo_url")
                # Add email_verified
                if 'email_verified' not in user_columns:
                    # Works for PostgreSQL/SQLite; default FALSE maps to 0 in SQLite
                    conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE"))
                    logger.info("[startup-migration] Added users.email_verified")

                # Ensure unique index on firebase_uid exists (only for non-NULL values)
                existing_indexes = {idx.get('name') for idx in inspector.get_indexes('users')}
                if 'ix_users_firebase_uid' not in existing_indexes:
                    try:
                        # Create partial unique index that only applies to non-NULL values
                        # This allows multiple NULL values while ensuring uniqueness for actual Firebase UIDs
                        conn.execute(text("CREATE UNIQUE INDEX ix_users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL"))
                        logger.info("[startup-migration] Created partial unique index ix_users_firebase_uid")
                    except Exception as idx_err:
                        logger.warning(f"[startup-migration] Could not create index: {idx_err}")
        except Exception as mig_err:
            logger.warning(f"Startup migration check failed (non-fatal): {mig_err}")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
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

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# Exception handler for rate limit exceeded
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded exceptions"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "error": "Too many requests"
        }
    )

# Apply rate limiting to login endpoint
from functools import wraps

def rate_limit_login(func):
    """Decorator to apply rate limiting to login endpoint."""
    @wraps(func)
    @limiter.limit("5/minute")
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper

# Function to apply rate limits after routers are included
def apply_rate_limits():
    """Apply rate limits to auth endpoints."""
    try:
        for route in auth.router.routes:
            if hasattr(route, 'path') and route.path == '/login' and hasattr(route, 'endpoint'):
                original_endpoint = route.endpoint
                route.endpoint = rate_limit_login(original_endpoint)
                logger.info("Rate limiting applied to /auth/login endpoint")
                break
    except Exception as e:
        logger.warning(f"Could not apply rate limiting: {e}")

# CORS configuration based on environment
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Default: allow known frontend origins
    cors_origins = [
        "https://laspinastrafficmanagement.vercel.app",
        "https://laspinastrafficmanagement-adenj8873-0xfe2ns0.apn.leapcell.dev",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# Always allow credentials for authentication
allow_credentials = True

# Track whether wildcard is allowed
allow_all_origins = "*" in cors_origins
allowed_origin_set = set(cors_origins) if not allow_all_origins else set()

if not allow_all_origins and "https://laspinastrafficmanagement.vercel.app" not in cors_origins:
    cors_origins.append("https://laspinastrafficmanagement.vercel.app")

# CORS middleware - Comprehensive configuration for Emergency Center
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "User-Agent", "Cache-Control"],
    expose_headers=["Content-Type", "Authorization"]
)

# Add error handling middleware
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        origin = request.headers.get("origin")
        response = await call_next(request)

        # Determine allowed origin for this request
        if allow_all_origins:
            allowed_origin = "*"
        elif origin and origin in allowed_origin_set:
            allowed_origin = origin
        else:
            allowed_origin = None

        if allowed_origin:
            response.headers["Access-Control-Allow-Origin"] = allowed_origin
            response.headers["Vary"] = response.headers.get("Vary", "") + (", Origin" if "Origin" not in response.headers.get("Vary", "") else "")

        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, User-Agent, Cache-Control"

        if allow_credentials and allowed_origin and allowed_origin != "*":
            response.headers["Access-Control-Allow-Credentials"] = "true"

        # Add COOP headers to fix Cross-Origin-Opener-Policy issues
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        return response
    except Exception as exc:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        # Don't expose internal error details to clients
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
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

# Add security headers middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
    
    # HSTS header (only for HTTPS)
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response

# Add request logging middleware for debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

# Include routers  
app.include_router(auth.router)
# Apply rate limiting to auth endpoints
apply_rate_limits()
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
# Note: Verify user before establishing WebSocket connection to avoid holding DB session
@app.websocket("/ws/{user_id}")
async def websocket_route(websocket: WebSocket, user_id: int):
    # Verify user exists before establishing WebSocket connection (don't hold DB session)
    db = None
    try:
        db = next(get_db())
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4001, reason="User not found")
            return
    except Exception as e:
        logger.error(f"Error verifying user for WebSocket: {e}")
        await websocket.close(code=4002, reason="Database error")
        return
    finally:
        if db:
            db.close()
    
    # Now establish WebSocket connection without holding DB session
    await websocket_endpoint(websocket, user_id, None)

@app.get("/")
def read_root():
    return {"message": "Traffic Management System API", "status": "running"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint that verifies database connection"""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

# Leapcell reverse proxy healthcheck path
@app.get("/kaithheathcheck")
def leapcell_healthcheck():
    return {"status": "ok"}

# Firebase sync endpoint is now handled by auth router

# Note: Global catch-all OPTIONS handlers removed.
# CORSMiddleware already handles preflight requests across all routes.

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
