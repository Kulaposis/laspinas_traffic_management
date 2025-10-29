# Enum Type Fix Summary

## Problem
The backend was getting 500 Internal Server Error when trying to sync Firebase users because SQLAlchemy was attempting to create enum types that already exist in the Supabase database.

## Root Cause
- Supabase database has pre-existing PostgreSQL enum types (e.g., `userrole`, `weathercondition`, etc.)
- SQLAlchemy models were trying to create these enum types again, causing conflicts
- The `create_type=True` default behavior in SQLAlchemy's `Enum()` was the issue

## Solution
Updated all model files to use `create_type=False` parameter in Enum column definitions, telling SQLAlchemy to use the existing PostgreSQL enum types instead of trying to create new ones.

### Before
```python
role = Column(Enum(UserRole), default=UserRole.CITIZEN, nullable=False)
```

### After
```python
role = Column(Enum(UserRole, name='userrole', create_type=False), default=UserRole.CITIZEN, nullable=False)
```

## Files Modified
The following model files were updated:

1. `app/models/user.py` - UserRole enum
2. `app/models/events.py` - EventType, EventStatus, EmergencyType, EmergencyStatus
3. `app/models/footprint.py` - CrowdLevel
4. `app/models/notification.py` - NotificationType, NotificationPriority
5. `app/models/parking.py` - ParkingType, ParkingStatus
6. `app/models/report.py` - ReportType, ReportStatus
7. `app/models/rewards.py` - RewardType, ActionType, BadgeLevel, RedemptionStatus
8. `app/models/surveillance.py` - CameraType, CameraStatus, RecordingQuality
9. `app/models/traffic.py` - TrafficStatus, RoadType, IncidentProneAreaType
10. `app/models/transportation.py` - TransportType, VehicleStatus, RouteStatus
11. `app/models/violation.py` - ViolationType, ViolationStatus
12. `app/models/weather.py` - WeatherCondition, FloodLevel

## Enum Mappings
| Python Enum Class | PostgreSQL Type Name |
|-------------------|---------------------|
| UserRole | userrole |
| WeatherCondition | weathercondition |
| FloodLevel | floodlevel |
| ViolationType | violationtype |
| ViolationStatus | violationstatus |
| TransportType | transporttype |
| VehicleStatus | vehiclestatus |
| RouteStatus | routestatus |
| TrafficStatus | trafficstatus |
| RoadType | roadtype |
| IncidentProneAreaType | incidentproneareatype |
| CameraType | cameratype |
| CameraStatus | camerastatus |
| RecordingQuality | recordingquality |
| RewardType | rewardtype |
| ActionType | actiontype |
| BadgeLevel | badgelevel |
| RedemptionStatus | redemptionstatus |
| ReportType | reporttype |
| ReportStatus | reportstatus |
| ParkingType | parkingtype |
| ParkingStatus | parkingstatus |
| NotificationType | notificationtype |
| NotificationPriority | notificationpriority |
| CrowdLevel | crowdlevel |
| EventType | eventtype |
| EventStatus | eventstatus |
| EmergencyType | emergencytype |
| EmergencyStatus | emergencystatus |
| SettingType | settingtype |

## Enum Value Case Notes
- **userrole**: Uses lowercase values (citizen, lgu_staff, traffic_enforcer, admin) - MATCHES database ✓
- **Most other enums**: Database uses UPPERCASE values, Python uses lowercase
  - This works because PostgreSQL enum comparisons are case-sensitive but SQLAlchemy handles the conversion
  - Example: Python `"accident_prone"` maps to database `"ACCIDENT_PRONE"`

## Testing
After applying the fix:
1. Restart the backend server
2. Test Firebase login
3. Verify user creation/update works
4. Check that no enum-related errors appear in logs

## Scripts Created
1. `check_supabase_enums.py` - Lists all enum types in the database
2. `fix_all_enums.py` - Automatically fixes enum definitions in model files
3. `verify_enum_values.py` - Compares Python enum values with database enum values

## Next Steps
1. Restart the backend server:
   ```bash
   python start_server.py
   ```
   Or:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Test Firebase authentication

3. Monitor logs for any remaining enum-related issues
