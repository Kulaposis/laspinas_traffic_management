# Supabase Data Population Guide

This guide explains how to populate your Supabase database with all existing data from the Las Piñas Traffic Management System.

## 📋 Overview

The system includes the following data types:

1. **No Parking Zones** (65 zones)
   - Fire stations, hospitals, schools
   - Government buildings, churches, markets
   - Major intersections and bridges
   - Bus stops and road restrictions

2. **Incident Prone Areas** (12+ areas)
   - Accident-prone zones
   - Crime hotspots
   - Flood-prone areas
   - Traffic congestion zones
   - Road hazards

3. **Traffic Monitoring Data**
   - Real-time traffic from TomTom API
   - Road segments with traffic status
   - Vehicle counts and congestion levels

4. **Road Incidents**
   - Active incidents (accidents, road work, flooding)
   - Severity levels and impact radius
   - Affected roads and clearance times

5. **Route Alternatives**
   - Alternative routes between locations
   - Distance, duration, and traffic conditions

## 🚀 Quick Start

### Prerequisites

1. **Supabase Database Setup**
   ```bash
   # Make sure your .env file has the correct DATABASE_URL
   DATABASE_URL=postgresql://user:password@db.xxx.supabase.co:5432/postgres?sslmode=require
   ```

2. **Install Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

### Step 1: Verify Database Connection

```bash
python verify_supabase_data.py
```

This will check if you can connect to Supabase and show existing data counts.

### Step 2: Populate All Data

```bash
python populate_supabase.py
```

This script will:
- ✅ Create all necessary tables
- ✅ Populate no parking zones (65 zones)
- ✅ Populate incident prone areas (12+ areas)
- ✅ Fetch and populate real-time traffic data
- ✅ Add sample road incidents
- ✅ Add sample route alternatives

### Step 3: Verify Population

```bash
python verify_supabase_data.py
```

Check that all data was populated successfully.

## 📊 Data Sources

### No Parking Zones
- **Source**: `las_pinas_no_parking_zones.json` or `scrape_no_parking_zones.py`
- **Count**: 65 zones
- **Categories**:
  - Fire station vicinities (with extended zones)
  - Hospital areas
  - School zones
  - Government buildings
  - Churches and religious sites
  - Public markets
  - Major bridges and intersections
  - Bus stops
  - Major road segments

### Incident Prone Areas
- **Source**: `app/services/incident_scraper_service.py`
- **Count**: 12+ areas
- **Types**:
  - **Accident Prone**: Alabang-Zapote Road, C-5 Road
  - **Crime Hotspots**: Barangay Talon 1, Almanza Uno
  - **Flood Prone**: Quirino Avenue, Naga Road, Tramo Line areas
  - **Traffic Congestion**: Major intersections and commercial areas

### Traffic Monitoring
- **Source**: TomTom Traffic API (`app/services/real_traffic_service.py`)
- **Real-time data**: Current traffic conditions on major roads
- **Updates**: Automatically refreshed

## 🔧 Manual Population (Individual Tables)

If you want to populate specific tables only:

### No Parking Zones Only
```python
from populate_supabase import SupabaseDataPopulator

populator = SupabaseDataPopulator()
populator.create_tables()
populator.populate_no_parking_zones()
populator.close()
```

### Incident Prone Areas Only
```python
import asyncio
from populate_supabase import SupabaseDataPopulator

async def populate_incidents():
    populator = SupabaseDataPopulator()
    populator.create_tables()
    await populator.populate_incident_prone_areas()
    populator.close()

asyncio.run(populate_incidents())
```

### Traffic Monitoring Only
```python
import asyncio
from populate_supabase import SupabaseDataPopulator

async def populate_traffic():
    populator = SupabaseDataPopulator()
    populator.create_tables()
    await populator.populate_traffic_monitoring()
    populator.close()

asyncio.run(populate_traffic())
```

## 📝 Database Schema

### No Parking Zones Table
```sql
CREATE TABLE no_parking_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    zone_type VARCHAR(50) NOT NULL,
    restriction_reason VARCHAR(100) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 20,
    is_strict BOOLEAN NOT NULL DEFAULT TRUE,
    fine_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.0,
    enforcement_hours VARCHAR(20) NOT NULL DEFAULT '24/7',
    address VARCHAR(500) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Incident Prone Areas Table
```sql
CREATE TABLE incident_prone_areas (
    id SERIAL PRIMARY KEY,
    area_name VARCHAR(255) NOT NULL,
    area_type VARCHAR(50) NOT NULL,
    description TEXT,
    severity_level VARCHAR(20) NOT NULL DEFAULT 'medium',
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    radius_meters FLOAT NOT NULL DEFAULT 500.0,
    affected_roads JSON,
    barangay VARCHAR(100),
    incident_count INTEGER DEFAULT 0,
    last_incident_date TIMESTAMP WITH TIME ZONE,
    peak_hours JSON,
    common_incident_types JSON,
    risk_score FLOAT DEFAULT 0.0,
    prevention_measures TEXT,
    alternative_routes JSON,
    data_source VARCHAR(100) NOT NULL,
    source_url VARCHAR(500),
    last_verified TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);
```

## 🔄 Updating Data

### Update Traffic Data (Real-time)
```bash
python init_traffic_data.py
```

### Re-populate All Data (Fresh Start)
```bash
# Clear existing data first (optional)
# Then run:
python populate_supabase.py
```

### Update Specific Data
```python
# Use the individual population methods shown above
```

## 🐛 Troubleshooting

### Connection Issues
```bash
# Check your DATABASE_URL
echo $DATABASE_URL

# Test connection
python -c "from app.db import engine; print(engine.connect())"
```

### Missing Tables
```bash
# Run Alembic migrations
alembic upgrade head

# Or create tables directly
python -c "from app.db import Base, engine; Base.metadata.create_all(bind=engine)"
```

### Duplicate Data
The population script checks for existing records before inserting. If you see "Skipping existing..." messages, that's normal.

### Missing JSON File
If `las_pinas_no_parking_zones.json` is missing, the script will automatically generate data from the scraper.

## 📈 Expected Results

After running `populate_supabase.py`, you should see:

```
📊 POPULATION SUMMARY
============================================================
🚫 No Parking Zones:        65
⚠️  Incident Prone Areas:    12
🚦 Traffic Monitoring:       20+
🚨 Road Incidents:           3
🗺️  Route Alternatives:      2
============================================================
✅ Total Records Populated:  100+
============================================================
```

## 🔐 Security Notes

- Never commit your `.env` file with real credentials
- Use environment variables for sensitive data
- Supabase connections use SSL by default
- Keep your Supabase API keys secure

## 📚 Related Files

- `populate_supabase.py` - Main population script
- `verify_supabase_data.py` - Verification script
- `scrape_no_parking_zones.py` - No parking zones scraper
- `seed_incident_prone_areas.py` - Incident areas seeder
- `init_traffic_data.py` - Traffic data initializer
- `las_pinas_no_parking_zones.json` - No parking zones data

## 🆘 Support

If you encounter issues:

1. Check the error messages in the console
2. Verify your DATABASE_URL is correct
3. Ensure all dependencies are installed
4. Check Supabase dashboard for connection issues
5. Review the logs for specific error details

## ✅ Verification Checklist

- [ ] Database connection successful
- [ ] All tables created
- [ ] No parking zones populated (65)
- [ ] Incident prone areas populated (12+)
- [ ] Traffic monitoring data fetched
- [ ] Road incidents added
- [ ] Route alternatives added
- [ ] Data visible in Supabase dashboard
- [ ] API endpoints returning data

---

**Last Updated**: October 28, 2025
**Version**: 1.0.0
