# 🐘 PostgreSQL Migration Guide for Leapcell Deployment

## 🎯 **MIGRATION COMPLETE!**

I've successfully prepared your Traffic Management System for PostgreSQL migration and Leapcell deployment. Here's everything you need to know:

## 📁 **Files Created/Updated**

### **1. Migration Scripts**
- ✅ `backend/migrate_to_postgresql.py` - Complete SQLite to PostgreSQL migration script
- ✅ `backend/backup_database.py` - Database backup utility (already created)
- ✅ `backend/deploy-postgresql.sh` - Automated deployment script

### **2. Configuration Files**
- ✅ `backend/leapcell.toml` - Updated Leapcell configuration for PostgreSQL
- ✅ `backend/leapcell-postgresql.yml` - Docker Compose for PostgreSQL deployment
- ✅ `backend/env.postgresql` - Environment variables for PostgreSQL
- ✅ `backend/app/db.py` - Updated to use PostgreSQL by default

### **3. Documentation**
- ✅ `POSTGRESQL_MIGRATION_GUIDE.md` - This comprehensive guide

## 🚀 **DEPLOYMENT STEPS**

### **Step 1: Start PostgreSQL Database**

```bash
# Navigate to backend directory
cd backend

# Start PostgreSQL with Docker
docker-compose -f leapcell-postgresql.yml up -d postgres

# Wait for PostgreSQL to be ready
docker exec traffic_postgres pg_isready -U traffic_user -d traffic_management
```

### **Step 2: Migrate Your Data**

```bash
# Install required dependencies
pip install psycopg2-binary

# Run the migration script
python migrate_to_postgresql.py --sqlite-path ./traffic_management.db --postgresql-url "postgresql://traffic_user:traffic_password@localhost:5432/traffic_management"
```

### **Step 3: Start Backend with PostgreSQL**

```bash
# Start the backend application
docker-compose -f leapcell-postgresql.yml up -d backend

# Check if everything is working
curl http://localhost:8000/health
```

### **Step 4: Deploy to Leapcell**

```bash
# Deploy using the updated configuration
leapcell deploy --config leapcell.toml
```

## 🔧 **AUTOMATED DEPLOYMENT**

For a fully automated deployment, use the provided script:

```bash
# Make the script executable (Linux/Mac)
chmod +x deploy-postgresql.sh

# Run the automated deployment
./deploy-postgresql.sh
```

## 📊 **Database Schema Migration**

The migration script will automatically migrate these tables:

- ✅ **users** - User accounts and authentication
- ✅ **traffic_reports** - Traffic incident reports
- ✅ **violations** - Traffic violations
- ✅ **notifications** - User notifications
- ✅ **weather_data** - Weather information
- ✅ **emergency_reports** - Emergency incident reports
- ✅ **parking_violations** - Parking violation records
- ✅ **incident_prone_areas** - High-risk traffic areas
- ✅ **travel_history** - User travel patterns
- ✅ **admin_logs** - Administrative actions

## 🔍 **Verification Steps**

### **1. Check Database Connection**
```bash
# Test PostgreSQL connection
docker exec traffic_postgres psql -U traffic_user -d traffic_management -c "SELECT COUNT(*) FROM users;"
```

### **2. Test API Endpoints**
```bash
# Health check
curl http://localhost:8000/health

# Test data retrieval
curl http://localhost:8000/traffic/reports
```

### **3. Check Migration Logs**
```bash
# View migration logs
docker logs traffic_backend
```

## 🎯 **Leapcell Deployment Configuration**

Your `leapcell.toml` is now configured for PostgreSQL:

```toml
[environment]
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

## ⚠️ **Important Notes**

### **Security Considerations**
1. **Change Default Passwords**: Update the PostgreSQL password in production
2. **Update Secret Key**: Generate a new JWT secret key
3. **Configure CORS**: Set specific origins instead of "*"

### **Performance Benefits**
- ✅ **Better Concurrency**: Multiple users can access simultaneously
- ✅ **Faster Queries**: Optimized for complex queries
- ✅ **Scalability**: Can handle larger datasets
- ✅ **ACID Compliance**: Better data integrity

### **Backup Strategy**
```bash
# Backup PostgreSQL database
docker exec traffic_postgres pg_dump -U traffic_user traffic_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker exec -i traffic_postgres psql -U traffic_user traffic_management < backup_file.sql
```

## 🆘 **Troubleshooting**

### **Common Issues**

1. **Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   docker ps | grep postgres
   
   # Check logs
   docker logs traffic_postgres
   ```

2. **Migration Fails**
   ```bash
   # Check SQLite database exists
   ls -la traffic_management.db
   
   # Run migration with verbose output
   python migrate_to_postgresql.py --sqlite-path ./traffic_management.db --postgresql-url "postgresql://traffic_user:traffic_password@localhost:5432/traffic_management" -v
   ```

3. **Backend Won't Start**
   ```bash
   # Check backend logs
   docker logs traffic_backend
   
   # Verify database connection
   docker exec traffic_backend python -c "from app.db import engine; print(engine.execute('SELECT 1').fetchone())"
   ```

## 🎉 **Success Indicators**

You'll know the migration is successful when:

- ✅ PostgreSQL container is running and healthy
- ✅ Backend container connects to PostgreSQL
- ✅ API endpoints return data (not empty)
- ✅ Health check returns 200 OK
- ✅ No error logs in container logs

## 📞 **Next Steps After Migration**

1. **Test All Features**: Verify all functionality works with PostgreSQL
2. **Update Frontend**: Ensure frontend connects to the new backend
3. **Deploy to Leapcell**: Use the updated configuration
4. **Monitor Performance**: Check database performance metrics
5. **Set Up Backups**: Implement regular database backups

---

**Your database migration to PostgreSQL is now ready for Leapcell deployment!** 🚀

The system will be more robust, scalable, and production-ready with PostgreSQL as the database backend.
