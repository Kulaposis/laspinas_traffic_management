"""
WSGI configuration for Leapcell deployment
"""
import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app directly from main
from app.main import app

# This provides the WSGI application object
application = app
