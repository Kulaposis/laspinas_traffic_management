# Traffic Management Backend - Leapcell Deployment

This guide explains how to deploy your Traffic Management System backend to Leapcell.

## Prerequisites

1. **Node.js** installed for the Leapcell CLI
2. **Leapcell Account** - Sign up at [leapcell.io](https://leapcell.io)
3. **GitHub Account** for easy deployment

## Quick Start

### 1. Install Leapcell CLI

```bash
npm install -g @leapcell/cli
```

### 2. Login to Leapcell

```bash
leapcell login
```

This will open your browser for authentication.

### 3. Deploy to Leapcell

#### Option A: Using PowerShell Script (Windows)

```powershell
# Navigate to backend directory
cd backend

# Run deployment script
.\deploy-to-leapcell.ps1
```

#### Option B: Manual Deployment

```bash
# Create PostgreSQL database
leapcell service create postgres --name leapcell_db --version 15

# Get database connection URL
leapcell service info leapcell_db --format json

# Copy the connection URL and update .env file
# Then deploy
leapcell deploy --config leapcell-config.yaml
```

### 4. Configure Environment Variables

Create a `.env` file in the backend directory (copy from `.env.example`):

```env
DATABASE_URL=postgresql://username:password@hostname:5432/database_name
ENVIRONMENT=production
CORS_ORIGINS=https://your-frontend-domain.leapcell.dev
SECRET_KEY=your-super-secret-key-change-this-in-production
```

### 5. Update Your Frontend

Update your frontend's `env.example` file:

```env
# Replace with your Leapcell backend URL
VITE_API_URL=https://your-service-name.leapcell.dev
VITE_API_BASE_URL=https://your-service-name.leapcell.dev
VITE_WS_URL=wss://your-service-name.leapcell.dev
```

## Features Supported

- ✅ **FastAPI Framework** - Full support for your Python backend
- ✅ **PostgreSQL Database** - Managed database with auto-scaling
- ✅ **WebSocket Support** - Real-time traffic updates
- ✅ **Global CDN** - Fast worldwide delivery
- ✅ **Custom Domains** - Professional URLs
- ✅ **SSL Certificates** - Automatic HTTPS
- ✅ **Environment Variables** - Secure configuration
- ✅ **Health Checks** - Automatic monitoring
- ✅ **Logs & Metrics** - Real-time monitoring

## Database Migration

Your database schema will be automatically created using SQLAlchemy. If you need to run migrations:

```bash
# Connect to your database
leapcell service shell leapcell_db

# Run migrations inside the container
alembic upgrade head
```

## Monitoring Your Service

```bash
# View service information
leapcell service info

# View logs
leapcell logs

# View metrics
leapcell metrics
```

## Scaling

Leapcell automatically scales your service based on traffic. For high-traffic scenarios:

1. Go to your Leapcell dashboard
2. Select your service
3. Adjust resource allocation in settings
4. Or upgrade to a paid plan for persistent servers

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify `DATABASE_URL` in your `.env` file
   - Check if PostgreSQL service is running: `leapcell service info leapcell_db`

2. **CORS Issues**
   - Update `CORS_ORIGINS` in your `.env` file with your frontend domain
   - Add your frontend URL to Leapcell CORS settings

3. **Build Failures**
   - Ensure all dependencies are in `requirements.txt`
   - Check logs: `leapcell logs --follow`

### Getting Help

- **Leapcell Documentation**: [docs.leapcell.io](https://docs.leapcell.io)
- **Leapcell Discord**: Join their community for support
- **GitHub Issues**: Report bugs or request features

## Production Checklist

- [ ] Set strong `SECRET_KEY` in production
- [ ] Configure proper CORS origins
- [ ] Set up monitoring alerts
- [ ] Test all API endpoints
- [ ] Configure custom domain (optional)
- [ ] Set up database backups
- [ ] Update frontend environment variables

## Pricing

- **Free Tier**: 20 projects, perfect for development
- **Plus Plan**: $5.90/month for growing projects
- **Pro Plan**: $29.90/month for teams

Start free and upgrade as your traffic management system grows!

---

**Next Steps**: After deployment, update your frontend configuration and test the full system integration.
