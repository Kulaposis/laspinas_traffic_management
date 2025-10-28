#!/usr/bin/env python3
"""
Launcher script to start the server from the root directory
"""
import os
import sys
import subprocess

def main():
    # Change to backend directory
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    os.chdir(backend_dir)
    
    # Start the server
    print(f"Starting server from: {os.getcwd()}")
    subprocess.run([
        sys.executable, '-m', 'uvicorn', 
        'app.main:app', 
        '--host', '0.0.0.0', 
        '--port', '8000'
    ])

if __name__ == "__main__":
    main()
