#!/bin/bash
# Docker Database Restore Script for Traffic Management System

set -e

# Configuration
CONTAINER_NAME="traffic_backend"
DB_PATH_IN_CONTAINER="/app/data/traffic_management.db"
BACKUP_DIR="./backups"

echo "🔄 Starting database restore to Docker container..."

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Error: Container '$CONTAINER_NAME' is not running"
    echo "   Please start the container first with: docker-compose up -d"
    exit 1
fi

# List available backups
echo "📁 Available backups:"
if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR/*.db 2>/dev/null)" ]; then
    echo "❌ No backup files found in $BACKUP_DIR"
    exit 1
fi

ls -la "$BACKUP_DIR"/*.db | nl

# Get backup file from user
echo ""
read -p "Enter backup file number to restore: " BACKUP_NUM

# Validate input
if ! [[ "$BACKUP_NUM" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: Please enter a valid number"
    exit 1
fi

BACKUP_FILE=$(ls "$BACKUP_DIR"/*.db | sed -n "${BACKUP_NUM}p")

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: Invalid backup file selection"
    exit 1
fi

echo "📦 Restoring from: $BACKUP_FILE"

# Create data directory in container if it doesn't exist
docker exec "$CONTAINER_NAME" mkdir -p "$(dirname "$DB_PATH_IN_CONTAINER")"

# Copy backup to container
docker cp "$BACKUP_FILE" "$CONTAINER_NAME:$DB_PATH_IN_CONTAINER"

# Set proper permissions
docker exec "$CONTAINER_NAME" chown appuser:appuser "$DB_PATH_IN_CONTAINER"

# Verify restore
if docker exec "$CONTAINER_NAME" test -f "$DB_PATH_IN_CONTAINER"; then
    RESTORED_SIZE=$(docker exec "$CONTAINER_NAME" stat -c%s "$DB_PATH_IN_CONTAINER" 2>/dev/null || echo "unknown")
    echo "✅ Database restored successfully!"
    echo "   File: $DB_PATH_IN_CONTAINER"
    echo "   Size: $RESTORED_SIZE bytes"
    echo ""
    echo "🔄 Restarting container to apply changes..."
    docker restart "$CONTAINER_NAME"
    echo "🎉 Database restore completed!"
else
    echo "❌ Error: Database file was not restored"
    exit 1
fi
