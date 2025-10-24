"""
WSGI configuration for Leapcell deployment
"""
import os
import sys

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app and wrap it for WSGI
from app import application

# This provides the WSGI application object
app = application
