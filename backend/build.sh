#!/bin/bash
set -e

echo "🚀 Building Traffic Management Backend..."

# Install Python dependencies
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
echo "✅ Build completed successfully!"

# Create a simple health check
echo "🏥 Setting up health check..."
python -c "import fastapi, uvicorn, sqlalchemy; print('All dependencies installed successfully')"

echo "🎯 Build process completed!"
