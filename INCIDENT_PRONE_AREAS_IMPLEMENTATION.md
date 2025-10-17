# Incident Prone Areas Implementation

## Overview
This document outlines the comprehensive implementation of incident/accident prone areas webscraping and integration into the Las Piñas City Traffic Management System.

## Features Implemented

### 🗄️ Database Layer
- **New Model**: `IncidentProneArea` with comprehensive fields:
  - Geographic data (lat/lng, radius, affected roads, barangay)
  - Statistical data (incident count, peak hours, common types)
  - Risk assessment (risk score, severity level)
  - Data source tracking (source, URL, verification status)
- **Migration**: Database table created with all required indexes

### 🕷️ Web Scraping Service
- **Comprehensive Scraper**: `IncidentScraperService` that:
  - Scrapes from multiple sources (government, social media, news)
  - Includes predefined Las Piñas incident prone areas based on research
  - Enriches data with risk scoring and geographic classification
  - Handles data validation and source tracking

### 🚀 API Endpoints
Complete REST API for incident prone areas management:
- `GET /incident-prone-areas/` - List with filtering and pagination
- `GET /incident-prone-areas/{id}` - Get specific area
- `GET /incident-prone-areas/nearby/search` - Find nearby areas
- `GET /incident-prone-areas/stats/overview` - Statistics dashboard
- `POST /incident-prone-areas/` - Create new area (Admin/LGU Staff)
- `PUT /incident-prone-areas/{id}` - Update area
- `DELETE /incident-prone-areas/{id}` - Delete area (Admin only)
- `POST /incident-prone-areas/scrape` - Trigger web scraping
- `POST /incident-prone-areas/{id}/verify` - Verify area data

### 🎨 Frontend Integration
- **Traffic Monitoring Enhancement**:
  - New "🚨 Incident Areas" view mode
  - Interactive map markers with detailed popups
  - Sidebar list with prioritized areas
  - Risk-based color coding and icons
  - Click handlers for detailed area information

### 📊 Data Visualization
- **Map Markers**: Color-coded by area type and risk level
- **Detailed Popups**: Show all relevant area information
- **Sidebar List**: Sorted by priority (risk score, severity)
- **Statistics Cards**: Show count and high-risk areas

## Las Piñas Incident Prone Areas Data

Based on comprehensive research, the system includes the following incident prone areas:

### 🚗 Accident Prone Areas
1. **Alabang-Zapote Road**
   - Type: Accident Prone
   - Risk Score: 85/100
   - Description: Major thoroughfare with heavy traffic and frequent accidents
   - Peak Hours: 07:00-09:00, 17:00-19:00

2. **C-5 Road (Las Piñas Section)**
   - Type: Accident Prone  
   - Risk Score: 90/100
   - Description: High-speed road with frequent vehicular accidents
   - Peak Hours: 06:00-09:00, 16:00-20:00

### 🚨 Crime Hotspots
1. **Barangay Talon 1**
   - Type: Crime Hotspot
   - Risk Score: 65/100
   - Description: Historical crime-prone area with improving safety measures
   - Peak Hours: 20:00-02:00

2. **Barangay Almanza Uno**
   - Type: Crime Hotspot
   - Risk Score: 60/100
   - Description: Previously identified crime-prone area
   - Peak Hours: 22:00-04:00

### 🌊 Flood Prone Areas
1. **Quirino Avenue**
   - Type: Flood Prone
   - Risk Score: 75/100
   - Description: Flood-prone area contributing to vehicular accidents during heavy rains

2. **Naga Road**
   - Type: Flood Prone
   - Risk Score: 55/100
   - Description: Residential area prone to flooding during heavy rainfall

3. **Tramo Line to Casimiro-Camella Subdivision**
   - Type: Flood Prone
   - Risk Score: 50/100
   - Description: Subdivision entrance area prone to flooding

4. **Tiongquiao Road to CAA**
   - Type: Flood Prone
   - Risk Score: 52/100
   - Description: Commercial area intersection prone to flooding

### 🚦 Traffic Congestion Areas
1. **Alabang-Zapote Bridge**
   - Type: Traffic Congestion
   - Description: Bridge area with frequent traffic bottlenecks

2. **BF Homes Main Gate**
   - Type: Traffic Congestion
   - Description: Subdivision entrance with regular congestion

3. **Perpetual Help Medical Center Area**
   - Type: Traffic Congestion
   - Description: Hospital area with frequent ambulance traffic

## Usage Instructions

### For Citizens
1. **View Incident Areas**: Click "🚨 Incident Areas" in Traffic Monitoring
2. **Get Area Info**: Click any marker on the map for detailed information
3. **Safety Measures**: View prevention measures and alternative routes
4. **Risk Assessment**: See color-coded risk levels and severity

### For LGU Staff
1. **Monitor Areas**: View comprehensive statistics and trends
2. **Verify Data**: Mark areas as verified after field validation
3. **Add New Areas**: Create new incident prone areas manually
4. **Update Information**: Modify area details and risk assessments

### For Admins
1. **Data Management**: Full CRUD operations on incident prone areas
2. **Web Scraping**: Trigger automated data collection from various sources
3. **Data Verification**: Manage verification status of scraped data
4. **Analytics**: Access comprehensive statistics and reporting

## Technical Details

### Risk Scoring Algorithm
The system calculates risk scores based on:
- **Severity Level**: Low (1x), Medium (1.5x), High (2x), Critical (2.5x)
- **Area Type**: Accident Prone (2x), Crime Hotspot (1.8x), Flood Prone (1.5x)
- **Incident Count**: +0.5 points per incident (capped at 20)
- **Final Score**: Capped at 100 points

### Color Coding System
- **Red (Critical)**: Risk Score 80-100
- **Orange (High)**: Risk Score 60-79
- **Yellow (Medium)**: Risk Score 40-59
- **Green (Low)**: Risk Score 0-39

### Data Sources
1. **Government Reports**: Official MMDA and PNP data
2. **Social Media**: Twitter, Facebook community groups
3. **News Reports**: Local and national news websites
4. **Manual Entry**: LGU staff and verified reports

## Security & Permissions

### Access Control
- **Citizens**: View-only access to verified incident prone areas
- **LGU Staff**: Can create, update, and verify areas
- **Traffic Enforcers**: Can view and add incident reports
- **Admin**: Full access to all features and data management

### Data Verification
- All scraped data requires verification before being marked as "verified"
- LGU Staff can verify areas based on field validation
- Unverified areas are still displayed but marked accordingly

## Installation & Setup

### Database Migration
```bash
cd backend
alembic upgrade head
```

### Seed Initial Data
```bash
cd backend
python seed_incident_prone_areas.py
```

### Install Dependencies
```bash
pip install aiohttp beautifulsoup4
```

## API Usage Examples

### Get Nearby Incident Prone Areas
```javascript
const nearbyAreas = await incidentProneService.getNearbyIncidentProneAreas(
  14.4504, // latitude
  121.0170, // longitude
  5, // radius in km
  { min_risk_score: 60 } // filters
);
```

### Get Statistics
```javascript
const stats = await incidentProneService.getIncidentProneAreasStats();
console.log(`Total areas: ${stats.total_areas}`);
console.log(`High risk areas: ${stats.high_risk_areas}`);
```

### Trigger Web Scraping
```javascript
const result = await incidentProneService.scrapeIncidentData({
  sources: ['government', 'social_media', 'news'],
  update_existing: true,
  verify_data: false
});
```

## Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live incident updates
2. **Machine Learning**: Predictive risk scoring based on historical data
3. **Mobile Notifications**: Push notifications for high-risk area alerts
4. **Crowd-sourced Data**: Citizen reporting integration
5. **Heat Maps**: Incident density visualization
6. **Route Planning**: Integration with navigation to avoid high-risk areas

### Data Source Expansion
1. **CCTV Integration**: Automated incident detection from surveillance
2. **IoT Sensors**: Real-time environmental data (flooding, traffic)
3. **Mobile Apps**: Integration with popular navigation apps
4. **Emergency Services**: Direct integration with police and fire departments

## Support & Maintenance

### Regular Tasks
1. **Data Verification**: Weekly review of scraped data
2. **Risk Score Updates**: Monthly recalculation based on new incidents
3. **Source Monitoring**: Ensure web scraping sources remain accessible
4. **Performance Optimization**: Monitor API response times and database performance

### Troubleshooting
1. **Scraping Failures**: Check source URLs and network connectivity
2. **Data Inconsistencies**: Verify data source integrity
3. **Performance Issues**: Monitor database indexes and query performance
4. **Access Issues**: Verify user permissions and authentication

## Conclusion

The Incident Prone Areas system provides a comprehensive solution for identifying, monitoring, and managing areas with higher risk of incidents in Las Piñas City. Through automated web scraping, manual data entry, and intelligent risk assessment, the system helps citizens make informed decisions about their travel routes while providing authorities with valuable insights for traffic management and public safety planning.

The integration with the existing traffic monitoring system creates a unified platform for comprehensive traffic management, enhancing the safety and efficiency of transportation in Las Piñas City.
