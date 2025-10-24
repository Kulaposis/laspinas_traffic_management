#!/bin/bash

echo "🚀 Deploying Traffic Management Backend to Leapcell..."

# Check if leapcell CLI is installed
if ! command -v leapcell &> /dev/null; then
    echo "❌ Leapcell CLI not found. Please install it first:"
    echo "npm install -g @leapcell/cli"
    exit 1
fi

# Login to Leapcell (if not already logged in)
echo "🔐 Please login to Leapcell:"
leapcell login

# Create PostgreSQL database
echo "🗄️ Creating PostgreSQL database..."
leapcell service create postgres --name leapcell_db --version 15

# Get database connection details
DB_URL=$(leapcell service info leapcell_db --format json | jq -r '.connection_url')
echo "📝 Database URL: $DB_URL"

# Update .env file with database URL (create if doesn't exist)
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Replace database URL in .env
sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|g" .env

echo "🔧 Updated .env file with database connection"

# Deploy the service
echo "🚀 Deploying to Leapcell..."
echo "📋 Using corrected start command: python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
leapcell deploy --config leapcell-config.yaml

echo "✅ Deployment complete!"
echo "📋 Your backend will be available at: https://your-service-name.leapcell.dev"
echo "🔗 Update your frontend env.example with the new backend URL"

# Show service info
leapcell service info
