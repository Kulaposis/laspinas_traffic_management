#!/usr/bin/env python3
"""
Simple backend restart script with CORS fixes
"""

import subprocess
import sys
import os
import time

def kill_existing_servers():
    """Kill any existing FastAPI servers on port 8000"""
    try:
        # Kill any existing processes on port 8000
        subprocess.run(["taskkill", "/f", "/im", "python.exe"], capture_output=True)
        time.sleep(2)
    except Exception as e:
        print(f"Note: {e}")

def start_backend():
    """Start the backend server with proper CORS configuration"""
    print("🚀 Starting Traffic Management Backend...")
    print("📍 Backend will run on: http://localhost:8000")
    print("🌐 Frontend should connect from: http://localhost:5173")
    print("-" * 50)
    
    # Change to backend directory
    os.chdir("backend")
    
    # Start the server
    try:
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "backend.app.main:app", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ], check=True)
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")

def main():
    print("🔧 Emergency Center CORS Fix")
    print("=" * 50)
    
    # Kill existing servers
    kill_existing_servers()
    
    # Start backend
    start_backend()

if __name__ == "__main__":
    main()
