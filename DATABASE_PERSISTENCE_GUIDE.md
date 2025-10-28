# 🗄️ Database Persistence Guide for Traffic Management System

## 🚨 **CRITICAL ISSUE IDENTIFIED**

Your current deployment has a **MAJOR DATABASE PERSISTENCE PROBLEM**:

- ❌ SQLite database is created **INSIDE** Docker container
- ❌ When container restarts/redeploys, **ALL DATA IS LOST**
- ❌ No persistent storage configured

## 🔧 **IMMEDIATE SOLUTIONS**

### **Option 1: Fix SQLite with Docker Volumes (Quick Fix)**

#### **Step 1: Use the New Docker Compose Configuration**

```bash
# Use the new SQLite-persistent configuration
docker-compose -f docker-compose.sqlite.yml up -d
```

#### **Step 2: Backup Your Current Data (If Any)**

```bash
# If you have existing data, backup it first
cd backend
python backup_database.py backup --db-path ./traffic_management.db
```

#### **Step 3: Migrate to Persistent Storage**

```bash
# Stop current containers
docker-compose down

# Start with persistent volumes
docker-compose -f docker-compose.sqlite.yml up -d

# If you had data, restore it
python backup_database.py restore --backup-file traffic_management_backup_YYYYMMDD_HHMMSS.db
```

### **Option 2: Migrate to PostgreSQL (Recommended for Production)**

#### **Why PostgreSQL for Production?**

- ✅ **Better Performance**: Handles concurrent users better
- ✅ **ACID Compliance**: Better data integrity
- ✅ **Scalability**: Can handle larger datasets
- ✅ **Backup Tools**: Built-in backup/restore utilities
- ✅ **Cloud Support**: Better cloud database services

#### **Migration Steps**

1. **Export SQLite Data**
```bash
cd backend
python backup_database.py backup --db-path ./traffic_management.db
```

2. **Update Environment Variables**
```bash
# Set PostgreSQL connection
export DATABASE_URL="postgresql://traffic_user:traffic_password@db:5432/traffic_management"
```

3. **Use PostgreSQL Docker Compose**
```bash
# Use the existing docker-compose.yml (already configured for PostgreSQL)
docker-compose up -d
```

4. **Run Database Migrations**
```bash
# The app will automatically create tables on startup
# Or run manually:
docker exec traffic_backend python -c "from app.db import Base, engine; Base.metadata.create_all(bind=engine)"
```

## 📋 **Database Backup & Restore Commands**

### **SQLite Backup/Restore**

```bash
# Backup
cd backend
python backup_database.py backup

# List backups
python backup_database.py list

# Restore
python backup_database.py restore --backup-file traffic_management_backup_20241201_143022.db
```

### **Docker Container Backup/Restore**

```bash
# Backup from running container
./backend/docker_backup.sh

# Restore to container
./backend/docker_restore.sh
```

## 🚀 **Deployment Configurations**

### **For Development (SQLite)**
```yaml
# Use: docker-compose -f docker-compose.sqlite.yml up -d
services:
  backend:
    volumes:
      - sqlite_data:/app/data  # Persistent SQLite storage
```

### **For Production (PostgreSQL)**
```yaml
# Use: docker-compose up -d
services:
  db:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Persistent PostgreSQL storage
```

## 🔍 **Verification Steps**

### **Check Database Persistence**

1. **Create Test Data**
```bash
# Add some test data through your API
curl -X POST http://localhost:8000/traffic/reports \
  -H "Content-Type: application/json" \
  -d '{"location": "Test Location", "description": "Test Report"}'
```

2. **Restart Container**
```bash
docker-compose restart backend
```

3. **Verify Data Persists**
```bash
# Check if data still exists
curl http://localhost:8000/traffic/reports
```

### **Check Volume Mounting**

```bash
# List Docker volumes
docker volume ls

# Inspect volume
docker volume inspect traffic_management_sqlite_data
```

## ⚠️ **Important Notes**

### **SQLite Limitations in Production**

- ❌ **Single Writer**: Only one process can write at a time
- ❌ **No Network Access**: Can't be accessed from outside container
- ❌ **Limited Concurrency**: Poor performance with multiple users
- ❌ **No Built-in Replication**: Hard to scale

### **PostgreSQL Advantages**

- ✅ **Multiple Writers**: Handles concurrent access
- ✅ **Network Access**: Can be accessed from multiple containers
- ✅ **High Concurrency**: Excellent performance with many users
- ✅ **Replication**: Built-in master-slave replication
- ✅ **Cloud Ready**: Works with AWS RDS, Google Cloud SQL, etc.

## 🎯 **Recommended Action Plan**

### **Immediate (Today)**
1. ✅ **Backup current data** (if any)
2. ✅ **Switch to persistent SQLite** using `docker-compose.sqlite.yml`
3. ✅ **Test data persistence** by restarting containers

### **Short Term (This Week)**
1. 🔄 **Migrate to PostgreSQL** for better production performance
2. 🔄 **Set up automated backups** using cron jobs
3. 🔄 **Test failover scenarios**

### **Long Term (Next Month)**
1. 📋 **Set up cloud database** (AWS RDS, Google Cloud SQL)
2. 📋 **Implement database monitoring**
3. 📋 **Set up automated disaster recovery**

## 🆘 **Emergency Recovery**

If you've already lost data:

1. **Check for any backups**:
```bash
find . -name "*.db" -type f
find . -name "*backup*" -type f
```

2. **Check Docker volumes**:
```bash
docker volume ls
docker run --rm -v traffic_management_sqlite_data:/data alpine ls -la /data
```

3. **Restore from backup** (if available):
```bash
python backup_database.py restore --backup-file [backup_filename]
```

## 📞 **Need Help?**

If you encounter issues:

1. **Check container logs**: `docker logs traffic_backend`
2. **Verify volume mounting**: `docker inspect traffic_backend`
3. **Test database connection**: `docker exec traffic_backend python -c "from app.db import engine; print(engine.execute('SELECT 1').fetchone())"`

---

**Remember**: Always backup your data before making changes! 🛡️
