#!/bin/bash
# Setup environment for Leapcell deployment

set -e

echo "🔧 Setting up environment for Leapcell deployment..."

# Generate secure secret key
echo "🔐 Generating secure secret key..."
SECRET_KEY=$(openssl rand -hex 32)
echo "Generated SECRET_KEY: $SECRET_KEY"

# Create production environment file
echo "📝 Creating production environment file..."
cat > .env.production << EOF
# Production Environment Variables for Leapcell
DATABASE_URL=postgresql://traffic_user:traffic_password@postgres:5432/traffic_management
SECRET_KEY=$SECRET_KEY
ENVIRONMENT=production
CORS_ORIGINS=*
PYTHONPATH=/app
EOF

echo "✅ Created .env.production"

# Update leapcell.toml with generated secret key
echo "🔧 Updating leapcell.toml with generated secret key..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/your-super-secret-jwt-key-here-change-in-production/$SECRET_KEY/g" leapcell.toml
else
    # Linux
    sed -i "s/your-super-secret-jwt-key-here-change-in-production/$SECRET_KEY/g" leapcell.toml
fi

echo "✅ Updated leapcell.toml with secure secret key"

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << EOF
# Environment files
.env
.env.local
.env.production

# Database files
*.db
*.db-journal
traffic_management.db*

# Python cache
__pycache__/
*.pyc
*.pyo

# IDE files
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
*.tmp
*.temp
EOF
    echo "✅ Created .gitignore"
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Traffic Management System with PostgreSQL"
    echo "✅ Git repository initialized"
else
    echo "📦 Git repository already exists"
fi

echo ""
echo "🎉 Environment setup completed!"
echo ""
echo "📋 Next steps:"
echo "   1. Install Leapcell CLI: npm install -g @leapcell/cli"
echo "   2. Login to Leapcell: leapcell login"
echo "   3. Deploy: ./deploy-to-leapcell.sh"
echo ""
echo "🔧 Configuration files created:"
echo "   - .env.production (environment variables)"
echo "   - leapcell.toml (updated with secure secret key)"
echo "   - .gitignore (if not existed)"
echo ""
echo "⚠️  Remember to:"
echo "   - Set up your PostgreSQL database in Leapcell"
echo "   - Update CORS_ORIGINS with your frontend domain"
echo "   - Change database credentials for production"
