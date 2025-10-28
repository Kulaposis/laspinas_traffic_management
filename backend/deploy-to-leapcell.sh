#!/bin/bash
# Quick deployment script for Leapcell

set -e

echo "🚀 Deploying Traffic Management System to Leapcell..."

# Check if Leapcell CLI is installed
if ! command -v leapcell &> /dev/null; then
    echo "❌ Leapcell CLI not found. Please install it first:"
    echo "   npm install -g @leapcell/cli"
    echo "   or"
    echo "   pip install leapcell-cli"
    exit 1
fi

# Check if user is logged in
if ! leapcell whoami &> /dev/null; then
    echo "🔐 Please login to Leapcell first:"
    echo "   leapcell login"
    exit 1
fi

echo "✅ Leapcell CLI found and user is logged in"

# Check if leapcell.toml exists
if [ ! -f "leapcell.toml" ]; then
    echo "❌ leapcell.toml not found. Please run this script from the backend directory."
    exit 1
fi

echo "📋 Configuration file found"

# Deploy the application
echo "🚀 Deploying application..."
leapcell deploy --config leapcell.toml

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Check deployment status
echo "🔍 Checking deployment status..."
leapcell status

# Get deployment URL
echo "🌐 Getting deployment URL..."
DEPLOYMENT_URL=$(leapcell info | grep -o 'https://[^[:space:]]*' | head -1)

if [ -n "$DEPLOYMENT_URL" ]; then
    echo "✅ Deployment successful!"
    echo "🌐 Your application is available at: $DEPLOYMENT_URL"
    echo ""
    echo "🔍 Testing health endpoint..."
    curl -s "$DEPLOYMENT_URL/health" && echo "✅ Health check passed!"
    echo ""
    echo "📊 Testing traffic monitoring endpoint..."
    curl -s "$DEPLOYMENT_URL/traffic/monitoring" | head -c 100 && echo "..."
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Update your frontend to use: $DEPLOYMENT_URL"
    echo "   2. Set up your PostgreSQL database"
    echo "   3. Migrate your data to production"
    echo "   4. Configure your domain (optional)"
else
    echo "⚠️  Deployment completed but couldn't get URL"
    echo "   Run 'leapcell info' to get your deployment URL"
fi

echo ""
echo "🔧 Useful commands:"
echo "   leapcell logs --follow    # View logs"
echo "   leapcell status           # Check status"
echo "   leapcell env get          # View environment variables"
echo "   leapcell restart          # Restart application"