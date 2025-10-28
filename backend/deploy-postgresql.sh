#!/bin/bash
# PostgreSQL Deployment Script for Leapcell

set -e

echo "🚀 Starting PostgreSQL deployment for Traffic Management System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    exit 1
fi

# Create backup of current SQLite data
echo "📦 Creating backup of current SQLite data..."
if [ -f "./traffic_management.db" ]; then
    python backup_database.py backup --db-path ./traffic_management.db
    echo "✅ SQLite backup created"
else
    echo "⚠️  No existing SQLite database found"
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Start PostgreSQL and backend
echo "🐘 Starting PostgreSQL database..."
docker-compose -f leapcell-postgresql.yml up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL connection..."
until docker exec traffic_postgres pg_isready -U traffic_user -d traffic_management; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Start backend
echo "🚀 Starting backend application..."
docker-compose -f leapcell-postgresql.yml up -d backend

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 5

# Check if backend is healthy
echo "🔍 Checking backend health..."
until curl -f http://localhost:8000/health > /dev/null 2>&1; do
    echo "   Waiting for backend..."
    sleep 2
done
echo "✅ Backend is ready"

# Migrate data from SQLite to PostgreSQL (if SQLite exists)
if [ -f "./traffic_management.db" ]; then
    echo "🔄 Migrating data from SQLite to PostgreSQL..."
    python migrate_to_postgresql.py --sqlite-path ./traffic_management.db --postgresql-url "postgresql://traffic_user:traffic_password@localhost:5432/traffic_management"
    
    if [ $? -eq 0 ]; then
        echo "✅ Data migration completed successfully"
    else
        echo "⚠️  Data migration failed, but deployment continues with empty database"
    fi
else
    echo "ℹ️  No SQLite data to migrate, starting with fresh PostgreSQL database"
fi

echo ""
echo "🎉 PostgreSQL deployment completed successfully!"
echo ""
echo "📊 Service Status:"
echo "   PostgreSQL: http://localhost:5432"
echo "   Backend API: http://localhost:8000"
echo "   Health Check: http://localhost:8000/health"
echo ""
echo "🔧 Management Commands:"
echo "   View logs: docker-compose -f leapcell-postgresql.yml logs -f"
echo "   Stop services: docker-compose -f leapcell-postgresql.yml down"
echo "   Restart: docker-compose -f leapcell-postgresql.yml restart"
echo ""
echo "📋 Next Steps:"
echo "   1. Test your API endpoints"
echo "   2. Update your frontend to use the new backend URL"
echo "   3. Deploy to Leapcell using the updated configuration"
