# Navigation System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Traffic Monitoring Page                       │
│                                                                   │
│  ┌──────────────────┐          ┌──────────────────────────┐    │
│  │ Smart Routing    │          │    Map View              │    │
│  │ Component        │──────────│                          │    │
│  │                  │  Routes  │  • TomTom/OSM Tiles     │    │
│  │ • Search Origin  │          │  • Route Polylines       │    │
│  │ • Search Dest    │          │  • User Location         │    │
│  │ • Get Routes     │          │  • Markers               │    │
│  │ • Select Route   │          │                          │    │
│  └──────────────────┘          └──────────────────────────┘    │
│           │                                    │                 │
│           │                                    │                 │
│           ▼                                    ▼                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Enhanced Navigation Mode Component                │  │
│  │                                                            │  │
│  │  • GPS Tracking                                           │  │
│  │  • Voice Guidance                                         │  │
│  │  • Progress Monitoring                                    │  │
│  │  • Off-Route Detection                                    │  │
│  │  • UI Rendering                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced Routing Service                      │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Primary    │    │  Secondary   │    │   Tertiary   │     │
│  │              │    │              │    │              │     │
│  │   TomTom     │───▶│   Backend    │───▶│     OSRM     │     │
│  │   Routing    │    │   Routing    │    │   (Fallback) │     │
│  │     API      │    │     API      │    │              │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                   │
│  Features:                                                       │
│  • Route Calculation                                            │
│  • Turn-by-Turn Instructions                                    │
│  • Navigation Session Management                                │
│  • Progress Tracking                                            │
│  • Distance Calculations                                        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Route Request Flow

```
User Input (Origin + Destination)
        │
        ▼
Smart Routing Component
        │
        ▼
Enhanced Routing Service
        │
        ├──► Try TomTom API
        │    │
        │    ├──✅ Success → Return Detailed Route
        │    │
        │    └──❌ Fail → Try Backend API
        │         │
        │         ├──✅ Success → Return Route
        │         │
        │         └──❌ Fail → Try OSRM
        │              │
        │              └──✅ Success → Return Basic Route
        │
        ▼
Route Data with Turn-by-Turn Instructions
        │
        ▼
Display in Smart Routing Component
```

### 2. Navigation Flow

```
User Clicks "Start Navigation"
        │
        ▼
Enhanced Navigation Mode Component
        │
        ├──► Start GPS Tracking
        │    └──► Watch Position (High Accuracy)
        │
        ├──► Initialize Voice Synthesis
        │
        ├──► Start Navigation Session
        │    └──► Enhanced Routing Service
        │         └──► Track Progress
        │
        ▼
GPS Position Update Every Second
        │
        ├──► Update User Location on Map
        │
        ├──► Calculate Progress
        │    │
        │    ├──► Find Closest Point on Route
        │    ├──► Find Next Maneuver
        │    ├──► Calculate Remaining Distance/Time
        │    └──► Check if Off Route
        │
        ├──► Voice Announcements
        │    │
        │    ├──► At 100m: "In 100 meters, turn right"
        │    ├──► At 30m: "Now, turn right"
        │    └──► At maneuver: Play instruction
        │
        ├──► Update UI
        │    │
        │    ├──► Large Maneuver Display
        │    ├──► Distance to Next Turn
        │    ├──► Remaining Time
        │    └──► ETA
        │
        └──► Check for Off-Route
             │
             └──► If off route (>50m)
                  └──► Show Recalculation Prompt
                       │
                       ├──► User accepts
                       │    └──► Recalculate from current location
                       │
                       └──► User dismisses
                            └──► Continue with original route
```

### 3. Turn-by-Turn Instruction Processing

```
TomTom Route Response
        │
        ▼
Extract Instructions from Route Legs
        │
        ├──► Instruction 1: TURN_LEFT
        │    └──► Transform to: turn-left
        │         └──► Icon: ↰
        │         └──► Voice: "Turn left"
        │
        ├──► Instruction 2: STRAIGHT
        │    └──► Transform to: straight
        │         └──► Icon: ↑
        │         └──► Voice: "Continue straight"
        │
        ├──► Instruction 3: ENTER_ROUNDABOUT
        │    └──► Transform to: roundabout-enter
        │         └──► Icon: ↻
        │         └──► Voice: "Enter the roundabout"
        │
        └──► Instruction N: ARRIVE
             └──► Transform to: arrive
                  └──► Icon: 🏁
                  └──► Voice: "You have arrived"
        │
        ▼
Store as Steps Array in Route Object
        │
        ▼
Use During Navigation for:
  • Visual display of next turn
  • Voice announcements
  • Progress tracking
  • Arrival detection
```

## Component Hierarchy

```
TrafficMonitoring.jsx
│
├──► Smart Routing Component
│    │
│    ├──► Origin Search Input
│    │    └──► Geocoding Service
│    │         └──► Location Suggestions
│    │
│    ├──► Destination Search Input
│    │    └──► Geocoding Service
│    │         └──► Location Suggestions
│    │
│    ├──► Route Options Display
│    │    └──► Route Cards
│    │         ├──► Time/Distance
│    │         ├──► Traffic Conditions
│    │         ├──► Advantages/Disadvantages
│    │         └──► "Start Navigation" Button
│    │
│    └──► Real-Time Traffic Status
│
├──► Enhanced Navigation Mode Component
│    │
│    ├──► Top Bar
│    │    ├──► Exit Button
│    │    ├──► ETA Display
│    │    ├──► Time/Distance Display
│    │    └──► Control Buttons (Voice, Center)
│    │
│    ├──► Large Maneuver Display
│    │    ├──► Maneuver Icon (Large)
│    │    ├──► Distance Display (e.g., "200m")
│    │    ├──► Instruction Text
│    │    └──► Street Name
│    │
│    ├──► Lane Guidance (when available)
│    │    └──► Lane Indicators
│    │
│    └──► Off-Route Prompt
│         ├──► Warning Message
│         ├──► Dismiss Button
│         └──► Recalculate Button
│
└──► Map with Layers
     │
     ├──► Base Map Layer (TomTom/OSM)
     ├──► Route Polyline
     ├──► User Location Marker (Blue Dot)
     ├──► Accuracy Circle
     ├──► Next Maneuver Marker
     └──► Destination Marker
```

## Service Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│           Enhanced Routing Service                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  getTomTomDetailedRoute()                               │
│    ├──► Calls TomTom API with:                          │
│    │    • Origin & Destination                          │
│    │    • Traffic: true                                 │
│    │    • Instructions: text                            │
│    │    • Max Alternatives: 2                           │
│    │                                                      │
│    └──► Returns: Raw TomTom Route                       │
│                                                           │
│  transformTomTomRoute()                                  │
│    ├──► Extract coordinates                             │
│    ├──► Extract turn-by-turn instructions              │
│    ├──► Map maneuver types                             │
│    ├──► Extract lane guidance                           │
│    ├──► Calculate route metrics                         │
│    │                                                      │
│    └──► Returns: Enhanced Route Object                  │
│                                                           │
│  startNavigationSession()                               │
│    ├──► Store route, origin, destination               │
│    ├──► Initialize progress tracking                    │
│    ├──► Set start time                                  │
│    │                                                      │
│    └──► Returns: Navigation Session                     │
│                                                           │
│  updateNavigationProgress()                             │
│    ├──► Find closest point on route                    │
│    ├──► Find next maneuver                             │
│    ├──► Calculate remaining distance/time              │
│    ├──► Detect if off route                            │
│    │                                                      │
│    └──► Returns: Progress Object                        │
│         • closestPoint: { index, distance, coords }     │
│         • nextStep: { instruction, distance, ... }      │
│         • remaining: { distance, time }                 │
│         • progress: percentage                          │
│                                                           │
│  Helper Methods:                                         │
│    ├──► findClosestPointOnRoute()                      │
│    ├──► findNextStep()                                  │
│    ├──► calculateRemaining()                            │
│    ├──► calculateDistance() (Haversine)                │
│    ├──► formatInstruction()                             │
│    ├──► formatDistance()                                │
│    └──► formatDuration()                                │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Voice Guidance System

```
┌─────────────────────────────────────────────────────────┐
│              Voice Guidance Flow                         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  GPS Update                                              │
│    │                                                      │
│    ▼                                                      │
│  Calculate Distance to Next Maneuver                    │
│    │                                                      │
│    ├──► Distance > 100m                                 │
│    │    └──► No announcement                            │
│    │                                                      │
│    ├──► Distance: 50-100m (First time)                 │
│    │    └──► Announce: "In [distance], [instruction]"  │
│    │         Example: "In 80 meters, turn right"       │
│    │                                                      │
│    ├──► Distance: 20-50m (First time)                  │
│    │    └──► Announce: "In [distance], [instruction]"  │
│    │         Example: "In 30 meters, turn right"       │
│    │                                                      │
│    └──► Distance < 20m (First time)                    │
│         └──► Announce: "Now, [instruction]"            │
│              Example: "Now, turn right onto Main St"   │
│                                                           │
│  Speech Synthesis                                        │
│    ├──► Create SpeechSynthesisUtterance                │
│    ├──► Set language: en-US                            │
│    ├──► Set rate: 1.0 (normal speed)                   │
│    ├──► Set pitch: 1.0                                  │
│    ├──► Set volume: 1.0                                 │
│    │                                                      │
│    └──► window.speechSynthesis.speak()                 │
│                                                           │
│  Track Announced Steps                                   │
│    └──► Prevent duplicate announcements                │
│         • Store last announced step                     │
│         • Mark as announced: near (100m) or now (30m)  │
│         • Clear when passing maneuver                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Route Object Structure

```javascript
{
  route_id: "tomtom_1234567890_0",
  route_name: "Fastest Route",
  route_type: "fastest",
  route_quality: "primary",
  
  // Metrics
  distance_km: 5.2,
  estimated_duration_minutes: 15,
  traffic_delay_minutes: 2,
  
  // Coordinates (array of [lat, lng])
  route_coordinates: [
    [14.4504, 121.0170],
    [14.4510, 121.0175],
    // ... more points
  ],
  
  // Turn-by-turn instructions
  steps: [
    {
      index: 0,
      instruction: "Head north on Alabang-Zapote Road",
      maneuver_type: "depart",
      distance_meters: 0,
      travel_time_seconds: 0,
      street_name: "Alabang-Zapote Road",
      location: [14.4504, 121.0170],
      turn_angle_degrees: 0,
      lane_info: null
    },
    {
      index: 50,
      instruction: "Turn right onto C-5 Extension",
      maneuver_type: "turn-right",
      distance_meters: 500,
      travel_time_seconds: 60,
      street_name: "C-5 Extension",
      location: [14.4550, 121.0180],
      turn_angle_degrees: 90,
      lane_info: [
        { directions: ['right'], is_recommended: true },
        { directions: ['straight'], is_recommended: false }
      ]
    },
    // ... more steps
  ],
  
  // Traffic info
  traffic_conditions: "light",
  has_tolls: false,
  has_highways: true,
  has_ferries: false,
  
  // Metadata
  confidence_level: "high",
  data_source: "tomtom",
  real_time_traffic: true,
  
  // Bounds for map display
  bounds: {
    southwest: [14.4200, 120.9800],
    northeast: [14.4700, 121.0500]
  }
}
```

## State Management

### Navigation State

```javascript
{
  // User Location
  userLocation: {
    lat: 14.4504,
    lng: 121.0170,
    accuracy: 10,  // meters
    speed: 15,     // m/s
    timestamp: 1678901234567
  },
  
  // User Heading (device orientation)
  userHeading: 45,  // degrees (0-360)
  
  // Navigation Progress
  navigationProgress: {
    closestPoint: {
      index: 50,
      distance: 5,  // meters from route
      coordinates: [14.4550, 121.0180]
    },
    nextStep: {
      index: 75,
      instruction: "Turn right onto Main St",
      maneuver_type: "turn-right",
      street_name: "Main Street",
      location: [14.4600, 121.0190]
    },
    remaining: {
      distance_meters: 3200,
      distance_km: 3.2,
      time_minutes: 8,
      time_seconds: 480
    },
    progress: 40  // percentage
  },
  
  // Navigation Status
  isNavigating: true,
  isOffRoute: false,
  showRecalculatePrompt: false,
  
  // UI Controls
  voiceEnabled: true,
  mapCentering: true,
  showLaneGuidance: false,
  
  // Timing
  arrivalTime: "2:45 PM",
  lastAnnouncedStep: "75_near"
}
```

## API Response Examples

### TomTom Routing API Response

```json
{
  "routes": [
    {
      "summary": {
        "lengthInMeters": 5200,
        "travelTimeInSeconds": 900,
        "trafficDelayInSeconds": 120,
        "departureTime": "2024-01-15T14:30:00Z",
        "arrivalTime": "2024-01-15T14:45:00Z"
      },
      "legs": [
        {
          "summary": {
            "lengthInMeters": 5200,
            "travelTimeInSeconds": 900
          },
          "points": [
            { "latitude": 14.4504, "longitude": 121.0170 },
            { "latitude": 14.4510, "longitude": 121.0175 }
            // ... more points
          ],
          "instructions": [
            {
              "message": "Head north on Alabang-Zapote Road",
              "instructionType": "DEPART",
              "street": "Alabang-Zapote Road",
              "routeOffsetInMeters": 0,
              "travelTimeInSeconds": 0,
              "point": {
                "latitude": 14.4504,
                "longitude": 121.0170
              }
            },
            {
              "message": "Turn right onto C-5 Extension",
              "instructionType": "TURN_RIGHT",
              "street": "C-5 Extension",
              "routeOffsetInMeters": 500,
              "travelTimeInSeconds": 60,
              "turnAngleInDegrees": 90,
              "point": {
                "latitude": 14.4550,
                "longitude": 121.0180
              },
              "lanes": [
                {
                  "directions": ["RIGHT"],
                  "isRecommended": true
                },
                {
                  "directions": ["STRAIGHT"],
                  "isRecommended": false
                }
              ]
            }
            // ... more instructions
          ]
        }
      ]
    }
  ]
}
```

## Summary

This architecture provides:

1. **Modular Design**: Clear separation of concerns
2. **Fallback Mechanisms**: Multiple routing sources
3. **Real-Time Updates**: GPS tracking and progress monitoring
4. **Rich UI**: Google Maps/Waze-style interface
5. **Voice Guidance**: Natural spoken instructions
6. **Error Handling**: Graceful degradation
7. **Performance**: Efficient state management and updates
8. **Scalability**: Easy to extend with new features

The system is production-ready and provides a professional navigation experience! 🚗✨

