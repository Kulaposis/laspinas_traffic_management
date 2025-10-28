#!/bin/bash
# Docker Database Backup Script for Traffic Management System

set -e

# Configuration
CONTAINER_NAME="traffic_backend"
DB_PATH_IN_CONTAINER="/app/data/traffic_management.db"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="traffic_management_backup_${TIMESTAMP}.db"

echo "🔄 Starting database backup from Docker container..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Error: Container '$CONTAINER_NAME' is not running"
    echo "   Please start the container first with: docker-compose up -d"
    exit 1
fi

# Check if database exists in container
if ! docker exec "$CONTAINER_NAME" test -f "$DB_PATH_IN_CONTAINER"; then
    echo "❌ Error: Database file not found in container at $DB_PATH_IN_CONTAINER"
    echo "   The database might not be initialized yet"
    exit 1
fi

# Create backup
echo "📦 Creating backup: $BACKUP_FILENAME"
docker cp "$CONTAINER_NAME:$DB_PATH_IN_CONTAINER" "$BACKUP_DIR/$BACKUP_FILENAME"

# Verify backup
if [ -f "$BACKUP_DIR/$BACKUP_FILENAME" ]; then
    BACKUP_SIZE=$(stat -c%s "$BACKUP_DIR/$BACKUP_FILENAME" 2>/dev/null || stat -f%z "$BACKUP_DIR/$BACKUP_FILENAME" 2>/dev/null)
    echo "✅ Backup created successfully!"
    echo "   File: $BACKUP_DIR/$BACKUP_FILENAME"
    echo "   Size: $BACKUP_SIZE bytes"
else
    echo "❌ Error: Backup file was not created"
    exit 1
fi

echo "🎉 Database backup completed!"
