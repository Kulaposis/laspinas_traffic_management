# Emergency Photo Attachment & Content Moderation Implementation

## Overview
This implementation adds photo attachment functionality to emergency reports and creates a comprehensive content moderation system for administrators to verify the authenticity of emergency reports.

## Features Added

### 1. Photo Attachment for Emergency Reports
- **Frontend**: Added photo upload step in emergency reporting wizard
- **Backend**: Extended Emergency model to support photo URLs
- **Validation**: Maximum 3 photos, 5MB per photo limit
- **UI/UX**: Drag-and-drop interface with preview functionality

### 2. Content Moderation System
- **Admin Interface**: Dedicated moderation dashboard for reviewing reports
- **Verification Status**: pending, verified, rejected, flagged
- **Priority System**: Automatic priority assignment based on severity and photo presence
- **Photo Review**: Full-size photo viewing in moderation interface

### 3. Database Schema Changes
- Added photo attachment fields to Emergency model
- Added verification and moderation tracking fields
- Created proper relationships and indexes

## Technical Implementation

### Backend Changes

#### 1. Database Schema (Migration: `add_emergency_photo_moderation.py`)
```sql
-- New fields added to emergencies table
ALTER TABLE emergencies ADD COLUMN photo_urls TEXT; -- JSON array of photo URLs
ALTER TABLE emergencies ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE emergencies ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE emergencies ADD COLUMN verified_by INTEGER REFERENCES users(id);
ALTER TABLE emergencies ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE emergencies ADD COLUMN verification_notes TEXT;
ALTER TABLE emergencies ADD COLUMN moderation_priority VARCHAR(20) DEFAULT 'normal';
```

#### 2. Model Updates (`backend/app/models/events.py`)
- Extended Emergency model with photo and moderation fields
- Added relationships to User model for verification tracking

#### 3. API Endpoints (`backend/app/routers/emergency.py`)
- **POST** `/emergency/report` - Enhanced to handle photo URLs
- **GET** `/emergency/moderation/queue` - Admin moderation queue
- **PUT** `/emergency/moderation/{emergency_id}` - Moderate specific report

#### 4. Schemas (`backend/app/schemas/emergency_schema.py`)
- Added photo_urls support in EmergencyCreate and EmergencyResponse
- New moderation schemas: EmergencyModerationUpdate, ModerationQueueResponse

### Frontend Changes

#### 1. Enhanced Emergency Form (`frontend/src/pages/EmergencyCenter.jsx`)
- Added Step 4: Photo Upload with drag-and-drop interface
- Photo preview with removal functionality
- Updated progress tracking (5 steps instead of 4)
- Photo validation and guidelines

#### 2. Admin Moderation Interface (`frontend/src/pages/EmergencyModeration.jsx`)
- Statistics dashboard showing pending, high-priority, and flagged reports
- Filtering by priority and verification status
- Detailed report review modal with photo display
- One-click moderation actions (verify, reject, flag)

#### 3. Service Layer (`frontend/src/services/emergencyService.js`)
- Added moderation API calls
- Enhanced emergency reporting to handle photos

## Key Features

### Photo Upload Process
1. **User Selection**: Users can upload up to 3 photos during emergency reporting
2. **Client Validation**: File size (5MB max) and type validation
3. **Preview Interface**: Thumbnail previews with removal option
4. **Server Simulation**: Photos are simulated as uploaded (in real implementation, would use cloud storage)

### Moderation Workflow
1. **Automatic Prioritization**: Reports with photos get higher priority
2. **Queue Management**: Admins see pending reports sorted by priority
3. **Photo Review**: Full photo display for evidence verification
4. **Status Tracking**: Complete audit trail of moderation actions

### Priority Assignment Logic
```javascript
// Automatic priority assignment
let priority = "normal";
if (severity === "high" || severity === "critical") {
    priority = "high";
}
if (hasPhotos) {
    priority = priority === "normal" ? "high" : "urgent";
}
```

## Security Considerations

### Photo Handling
- File type validation (images only)
- File size limits to prevent abuse
- Simulated URLs (in production, would use secure cloud storage)

### Access Control
- Only admins and LGU staff can access moderation interface
- Proper authentication required for all moderation actions
- Activity logging for audit trails

## UI/UX Improvements

### Emergency Form Enhancements
- **Visual Design**: Modern, step-by-step wizard interface
- **Photo Upload**: Intuitive drag-and-drop with visual feedback
- **Progress Tracking**: Clear step indicators and completion status
- **Mobile Responsive**: Fully responsive design for all devices

### Admin Interface Features
- **Dashboard**: Statistics cards showing key metrics
- **Filtering**: Easy filtering by priority and status
- **Photo Gallery**: Clean photo display with error handling
- **Action Buttons**: Clear, color-coded moderation actions

## Testing

### Test Script (`backend/test_emergency_moderation.py`)
Comprehensive test script that validates:
- Emergency reporting with photos
- Moderation queue functionality
- Moderation actions
- Status updates

### Usage
```bash
cd backend
python test_emergency_moderation.py
```

## Database Migration

To apply the database changes:
```bash
cd backend
alembic upgrade head
```

## Configuration

### Environment Variables
No additional environment variables required for basic functionality.

For production deployment with real photo storage:
- `PHOTO_STORAGE_PROVIDER` (aws_s3, cloudinary, etc.)
- `PHOTO_STORAGE_BUCKET`
- `PHOTO_STORAGE_ACCESS_KEY`
- `PHOTO_STORAGE_SECRET_KEY`

## Future Enhancements

### Planned Features
1. **Real Cloud Storage**: Integration with AWS S3 or Cloudinary
2. **Image Processing**: Automatic resizing and optimization
3. **AI Content Moderation**: Automated initial screening
4. **Bulk Actions**: Mass moderation capabilities
5. **Mobile App**: Native mobile photo capture
6. **Geolocation Validation**: Cross-reference photo metadata with reported location

### Scalability Considerations
- Photo storage optimization for large volumes
- Caching strategies for moderation queue
- Background processing for large photo uploads
- CDN integration for fast photo delivery

## API Documentation

### New Endpoints

#### POST /emergency/report
Enhanced to accept photo_urls array:
```json
{
  "emergency_type": "accident",
  "title": "Vehicle Collision",
  "description": "Two-car accident with injuries",
  "severity": "high",
  "latitude": 14.4504,
  "longitude": 121.0170,
  "photo_urls": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ]
}
```

#### GET /emergency/moderation/queue
Returns moderation queue with statistics:
```json
{
  "total_pending": 5,
  "high_priority": 2,
  "flagged_reports": 1,
  "pending_reports": [...]
}
```

#### PUT /emergency/moderation/{emergency_id}
Moderate a specific report:
```json
{
  "verification_status": "verified",
  "verification_notes": "Report verified with photo evidence",
  "moderation_priority": "high"
}
```

## Conclusion

This implementation provides a complete photo attachment and content moderation system for emergency reports, enabling:

1. **Better Emergency Response**: Photos help responders understand situations
2. **Content Verification**: Admins can verify report authenticity
3. **Fraud Prevention**: Systematic review process prevents false reports
4. **Audit Trail**: Complete tracking of all moderation actions
5. **User Experience**: Intuitive interfaces for both reporters and moderators

The system is designed to be scalable, secure, and user-friendly while maintaining the critical functionality needed for emergency response systems.
