#!/bin/bash
# Bash script to populate all data to Supabase
# Run this script to populate no parking zones, incident prone areas, and all other data

echo "🚀 Las Piñas Traffic Management - Supabase Data Population"
echo "============================================================"
echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    echo "✅ Activating virtual environment..."
    source venv/bin/activate
else
    echo "⚠️  Virtual environment not found. Using global Python..."
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create a .env file with your DATABASE_URL"
    echo "   Example: DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:5432/postgres"
    exit 1
fi

echo "📋 Step 1: Verifying database connection..."
python verify_supabase_data.py

if [ $? -ne 0 ]; then
    echo "❌ Database connection failed! Check your .env file."
    exit 1
fi

echo ""
echo "📊 Step 2: Populating all data..."
python populate_supabase.py

if [ $? -ne 0 ]; then
    echo "❌ Data population failed!"
    exit 1
fi

echo ""
echo "🔍 Step 3: Verifying populated data..."
python verify_supabase_data.py

echo ""
echo "✅ Data population completed!"
echo "============================================================"
