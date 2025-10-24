# 🚀 Deploy Traffic Management System to Leapcell

Complete guide to deploy your traffic management backend and frontend to Leapcell PaaS.

## 📋 What I've Set Up For You

### Backend Configuration
- ✅ **Leapcell Config** (`leapcell-config.yaml`) - Deployment configuration
- ✅ **Production Dockerfile** (`Dockerfile.leapcell`) - Optimized for production
- ✅ **Deployment Scripts** (`deploy-to-leapcell.ps1`) - Automated deployment
- ✅ **PostgreSQL Support** - Database migration and configuration
- ✅ **Environment Variables** - Secure configuration management
- ✅ **Package.json** - Modern deployment with npm scripts

### Frontend Configuration
- ✅ **Updated Environment** - Ready for Leapcell backend URLs

## 🛠️ Step-by-Step Deployment

### 1. Web-Based Deployment (Recommended)

Since the CLI is not available via npm, use Leapcell's web interface:

**Step 1: Go to Leapcell**
- Visit https://leapcell.io
- Sign up or login with your GitHub account

**Step 2: Connect GitHub Repository**
- Click "Get Started With GitHub"
- Connect your repository: `https://github.com/Kulaposis/laspinas_traffic_management`
- Select the `backend` directory as the project root

**Step 3: Configure Build Settings**
```
Runtime: Python 3.11
Framework: FastAPI
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port 8000
Port: 8000
```

**Step 4: Add Environment Variables**
Copy these from `backend/.env.example`:
```
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend-domain.leapcell.dev
SECRET_KEY=your-super-secret-key-change-this-in-production
```

**Step 5: Deploy!**
- Click "Deploy" and wait for the build to complete
- Your backend will be available at: `https://your-service-name.leapcell.dev`

### 2. Alternative: CLI Method (if available later)

If Leapcell releases a CLI tool, you can use:

```bash
# Install CLI (when available)
npm install -g @leapcell/cli

# Login and deploy
leapcell login
leapcell deploy --config backend/leapcell-config.yaml
```

### 3. Database Setup

Leapcell will automatically create a PostgreSQL database for you. The connection details will be available in your Leapcell dashboard after deployment.

### 4. Update Frontend Configuration

After deployment, you'll get a URL like: `https://your-service-name.leapcell.dev`

Update your frontend `.env` file:

```env
# Replace with your actual Leapcell backend URL
VITE_API_URL=https://your-service-name.leapcell.dev
VITE_API_BASE_URL=https://your-service-name.leapcell.dev
VITE_WS_URL=wss://your-service-name.leapcell.dev
```

### 5. Deploy Frontend

Deploy your React frontend using the same process:

1. Go to Leapcell.io
2. Click "New Project" or "Get Started With GitHub"
3. Select the `frontend` directory as project root
4. Configure for React/Vite:
   ```
   Runtime: Node.js
   Framework: Vite/React
   Build Command: npm install && npm run build
   Start Command: npm run preview
   Port: 4173
   ```
5. Add environment variables for Firebase, TomTom, etc.
6. Deploy!

Your complete traffic management system will be live at:
- **Backend API**: `https://your-backend-service.leapcell.dev`
- **Frontend App**: `https://your-frontend-service.leapcell.dev`
- **Database**: Managed PostgreSQL (auto-created)

## 🗄️ Database Management

### Automatic Setup
- PostgreSQL database is created automatically
- Tables are created via SQLAlchemy models
- Connection string is configured in `.env`

### Manual Database Access

```bash
# Connect to database shell
leapcell service shell leapcell_db

# Run migrations (if needed)
alembic upgrade head
```

## 🌐 Features Available After Deployment

### Backend API
- ✅ **FastAPI Framework** - Full REST API support
- ✅ **WebSocket Support** - Real-time traffic updates
- ✅ **Authentication** - Google OAuth integration
- ✅ **File Uploads** - Emergency photo moderation
- ✅ **Background Tasks** - Weather updates, traffic monitoring
- ✅ **CORS Configured** - Frontend integration ready

### Database
- ✅ **PostgreSQL 15** - Managed with auto-scaling
- ✅ **Auto-backups** - Data protection
- ✅ **Connection Pooling** - High performance

### Monitoring & Logs
- ✅ **Real-time Logs** - `leapcell logs --follow`
- ✅ **Health Checks** - Automatic monitoring
- ✅ **Metrics Dashboard** - Performance insights

## 🚀 Scaling Your Application

### Free Tier (Perfect for Development)
- 20 projects free
- Up to 3 vCPUs per project
- 1 PostgreSQL database
- Global CDN included

### Plus Plan ($5.90/month)
- 100 projects
- 6 vCPUs per project
- Persistent servers
- Priority support

### Pro Plan ($29.90/month)
- Team collaboration
- Priority CI/CD
- Dedicated support

## 🔧 Environment Variables Reference

### Required Variables
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend.leapcell.dev
SECRET_KEY=your-super-secret-key
```

### Optional Variables
```env
LOG_LEVEL=INFO
WEATHER_UPDATE_INTERVAL=300
TOMTOM_API_KEY=your_key
OPENWEATHER_API_KEY=your_key
FIREBASE_PROJECT_ID=your_project
```

## 🔍 Testing Your Deployment

### Health Check
```bash
curl https://your-service-name.leapcell.dev/health
```

### API Test
```bash
curl https://your-service-name.leapcell.dev/
```

### Database Test
```bash
# Check database connection in logs
leapcell logs --service leapcell_db
```

## 🆘 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check database service status
leapcell service info leapcell_db

# Restart database service
leapcell service restart leapcell_db
```

**2. Build Failed**
```bash
# Check build logs
leapcell logs --build

# Rebuild with verbose output
leapcell deploy --verbose
```

**3. CORS Errors**
```bash
# Update CORS origins in Leapcell dashboard
# Or update CORS_ORIGINS in your .env file
```

**4. Import Errors**
```bash
# Check Python path and dependencies
leapcell service shell
pip list
```

### Getting Help
- **Leapcell Discord**: Join their community
- **Documentation**: [docs.leapcell.io](https://docs.leapcell.io)
- **Logs**: `leapcell logs --follow`

## 📈 Production Optimization

### Performance Tips
1. **Enable Gunicorn** for production workloads
2. **Configure connection pooling** for database
3. **Set up monitoring alerts** in Leapcell dashboard
4. **Use CDN** for static assets

### Security Checklist
- [ ] Strong SECRET_KEY in production
- [ ] HTTPS only (automatic with Leapcell)
- [ ] Regular database backups
- [ ] Monitor access logs
- [ ] Update dependencies regularly

## 🎯 What's Next?

1. **Deploy Frontend** - Use similar process for React app
2. **Set Custom Domain** - Professional URLs via Leapcell
3. **Configure Monitoring** - Set up alerts and notifications
4. **Scale Resources** - Upgrade plan as traffic grows
5. **Team Collaboration** - Add team members to dashboard

## 📚 Resources

- **Leapcell Documentation**: https://docs.leapcell.io
- **FastAPI Documentation**: https://fastapi.tiangolo.com
- **PostgreSQL Documentation**: https://postgresql.org/docs

---

**Ready to deploy?** Run the deployment script and your traffic management system will be live in minutes! 🌟
