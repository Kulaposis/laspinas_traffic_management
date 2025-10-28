# 🚀 Leapcell Deployment Guide for Traffic Management System

## 📋 **PREREQUISITES**

Before deploying to Leapcell, ensure you have:

- ✅ **Leapcell CLI installed** and configured
- ✅ **PostgreSQL migration completed** (already done!)
- ✅ **Backend running locally** with PostgreSQL (already done!)
- ✅ **Git repository** with your code

## 🔧 **STEP 1: Prepare Your Repository**

### **1.1 Update .gitignore**
Make sure your `.gitignore` includes:
```gitignore
# Database files
*.db
*.db-journal
traffic_management.db*

# Environment files
.env
.env.local
.env.production

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
```

### **1.2 Commit Your Changes**
```bash
git add .
git commit -m "feat: migrate to PostgreSQL for Leapcell deployment"
git push origin main
```

## 🚀 **STEP 2: Configure Leapcell**

### **2.1 Update leapcell.toml**
Your `leapcell.toml` is already configured for PostgreSQL:

```toml
[build]
command = "pip install -r requirements.txt"

[deploy]
command = "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
port = 8000

[service]
name = "traffic-management-backend"
runtime = "python3.11"

[healthcheck]
path = "/health"
method = "GET"

[environment]
ENVIRONMENT = "production"
PYTHONPATH = "/app"
# PostgreSQL Database Configuration
DATABASE_URL = "postgresql://traffic_user:traffic_password@postgres:5432/traffic_management"
SECRET_KEY = "your-super-secret-jwt-key-here-change-in-production"
CORS_ORIGINS = "*"

[database]
type = "postgresql"
host = "postgres"
port = 5432
database = "traffic_management"
username = "traffic_user"
password = "traffic_password"
```

### **2.2 Create Production Environment File**
Create `backend/.env.production`:
```env
# Production Environment Variables
DATABASE_URL=postgresql://traffic_user:traffic_password@postgres:5432/traffic_management
SECRET_KEY=your-super-secret-jwt-key-here-change-in-production
ENVIRONMENT=production
CORS_ORIGINS=https://your-leapcell-domain.com,https://your-frontend-domain.com
```

## 🗄️ **STEP 3: Set Up PostgreSQL Database**

### **3.1 Option A: Use Leapcell Managed Database (Recommended)**

1. **Create PostgreSQL Service in Leapcell Dashboard**:
   - Go to your Leapcell project dashboard
   - Navigate to "Services" → "Add Service"
   - Select "PostgreSQL"
   - Configure:
     - **Database Name**: `traffic_management`
     - **Username**: `traffic_user`
     - **Password**: `your-secure-password`
     - **Version**: PostgreSQL 15

2. **Update leapcell.toml with Managed Database**:
   ```toml
   [environment]
   DATABASE_URL = "postgresql://traffic_user:your-secure-password@managed-postgres:5432/traffic_management"
   ```

### **3.2 Option B: Use External PostgreSQL Service**

If you prefer an external database service:

1. **Set up PostgreSQL on cloud provider**:
   - **AWS RDS**: Create PostgreSQL instance
   - **Google Cloud SQL**: Create PostgreSQL instance
   - **DigitalOcean**: Create managed database
   - **Supabase**: Free PostgreSQL hosting

2. **Update connection string**:
   ```toml
   [environment]
   DATABASE_URL = "postgresql://username:password@your-db-host:5432/traffic_management"
   ```

## 🚀 **STEP 4: Deploy to Leapcell**

### **4.1 Install Leapcell CLI (if not already installed)**
```bash
# Install Leapcell CLI
npm install -g @leapcell/cli

# Or using pip
pip install leapcell-cli
```

### **4.2 Login to Leapcell**
```bash
leapcell login
```

### **4.3 Initialize Project (if first time)**
```bash
cd backend
leapcell init
```

### **4.4 Deploy Your Application**
```bash
# Deploy with PostgreSQL configuration
leapcell deploy --config leapcell.toml

# Or deploy with specific environment
leapcell deploy --env production
```

## 🔍 **STEP 5: Verify Deployment**

### **5.1 Check Deployment Status**
```bash
leapcell status
```

### **5.2 Test Your API**
```bash
# Get your deployment URL
leapcell info

# Test health endpoint
curl https://your-app.leapcell.app/health

# Test traffic monitoring
curl https://your-app.leapcell.app/traffic/monitoring
```

### **5.3 Check Logs**
```bash
leapcell logs --follow
```

## 🗄️ **STEP 6: Migrate Data to Production Database**

### **6.1 Export Data from Local PostgreSQL**
```bash
# Export your local data
docker exec traffic_postgres pg_dump -U traffic_user traffic_management > production_data.sql
```

### **6.2 Import Data to Production Database**
```bash
# Connect to your production database and import
psql -h your-production-host -U traffic_user -d traffic_management < production_data.sql
```

## 🔧 **STEP 7: Configure Frontend**

### **7.1 Update Frontend API URL**
Update your frontend configuration to point to your Leapcell deployment:

```javascript
// In your frontend .env file
REACT_APP_API_URL=https://your-app.leapcell.app
REACT_APP_WS_URL=wss://your-app.leapcell.app
```

### **7.2 Deploy Frontend**
Deploy your frontend to Vercel, Netlify, or your preferred hosting platform.

## 🛡️ **STEP 8: Security Configuration**

### **8.1 Update Secret Keys**
```bash
# Generate new secret key
openssl rand -hex 32

# Update in leapcell.toml
SECRET_KEY = "your-new-secure-secret-key"
```

### **8.2 Configure CORS**
```toml
[environment]
CORS_ORIGINS = "https://your-frontend-domain.com,https://your-admin-domain.com"
```

### **8.3 Database Security**
- Change default passwords
- Enable SSL connections
- Configure firewall rules
- Set up database backups

## 📊 **STEP 9: Monitoring and Maintenance**

### **9.1 Set Up Monitoring**
```bash
# Monitor application health
leapcell health

# Check resource usage
leapcell metrics
```

### **9.2 Database Backups**
```bash
# Create backup script
#!/bin/bash
pg_dump -h your-db-host -U traffic_user traffic_management > backup_$(date +%Y%m%d_%H%M%S).sql
```

### **9.3 Log Management**
```bash
# View application logs
leapcell logs --tail 100

# Export logs
leapcell logs --export > app_logs.txt
```

## 🚨 **TROUBLESHOOTING**

### **Common Issues and Solutions**

#### **1. Database Connection Failed**
```bash
# Check database status
leapcell logs | grep -i database

# Verify connection string
leapcell env get DATABASE_URL
```

#### **2. Application Won't Start**
```bash
# Check build logs
leapcell logs --build

# Verify dependencies
leapcell logs | grep -i error
```

#### **3. CORS Issues**
```bash
# Update CORS configuration
leapcell env set CORS_ORIGINS "https://your-frontend-domain.com"
```

#### **4. Database Migration Issues**
```bash
# Run migration manually
leapcell exec "python -c 'from app.db import Base, engine; Base.metadata.create_all(bind=engine)'"
```

## 📋 **DEPLOYMENT CHECKLIST**

- [ ] ✅ PostgreSQL migration completed locally
- [ ] ✅ Code committed to Git repository
- [ ] ✅ Leapcell CLI installed and configured
- [ ] ✅ leapcell.toml configured for PostgreSQL
- [ ] ✅ Production environment variables set
- [ ] ✅ PostgreSQL database created (managed or external)
- [ ] ✅ Application deployed to Leapcell
- [ ] ✅ Health check passing
- [ ] ✅ Data migrated to production database
- [ ] ✅ Frontend updated with new API URL
- [ ] ✅ Security configurations applied
- [ ] ✅ Monitoring set up

## 🎯 **NEXT STEPS AFTER DEPLOYMENT**

1. **Test All Features**: Verify all functionality works in production
2. **Set Up CI/CD**: Automate deployments with GitHub Actions
3. **Configure Domain**: Set up custom domain if needed
4. **Set Up Backups**: Implement automated database backups
5. **Monitor Performance**: Set up application performance monitoring
6. **Scale Resources**: Adjust resources based on usage

## 📞 **SUPPORT**

If you encounter issues:

1. **Check Leapcell Documentation**: https://docs.leapcell.com
2. **View Application Logs**: `leapcell logs --follow`
3. **Check Database Status**: Verify PostgreSQL connection
4. **Review Configuration**: Ensure all environment variables are correct

---

**Your Traffic Management System is now ready for production deployment on Leapcell!** 🚀

The PostgreSQL migration ensures your application is production-ready with better performance, scalability, and data integrity.
