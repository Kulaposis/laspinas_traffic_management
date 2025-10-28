"""
WSGI configuration for Leapcell deployment
"""
import os
import sys

# Add the backend directory to Python path
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)

# Import the FastAPI app directly from main
from app.main import app

# This provides the WSGI application object
application = app
