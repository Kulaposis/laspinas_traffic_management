# 🎨 Component Showcase

## Visual Guide to All New Components

---

## 1. 🗺️ TrafficMonitoringMobile (Main Page)

**File**: `src/pages/TrafficMonitoringMobile.jsx`

### Layout Structure
```
┌─────────────────────────────────────┐
│  🔍 [Search Bar]            🌙 ⚙️  │ ← Top floating elements
├─────────────────────────────────────┤
│                                     │
│                                     │
│         🗺️ FULL SCREEN MAP         │
│         (TomTom + Incidents)        │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  ➕                           📍    │ ← Floating action buttons
│  Report                    Locate   │
└─────────────────────────────────────┘
   ╔═══════════════════════════════╗
   ║  📊 Traffic Info (Draggable) ║   ← Bottom sheet
   ╚═══════════════════════════════╝
```

### Key Features
- Full-screen map as background
- All UI elements float above map
- Touch-optimized interactions
- Smooth animations

---

## 2. 📊 BottomSheet

**File**: `src/components/BottomSheet.jsx`

### Three Positions

#### Collapsed (Peek)
```
┌─────────────────────────────┐
│         ─────               │ ← Drag handle
│  Traffic: 🟢 Light          │
│  3 Active Incidents         │
└─────────────────────────────┘
```

#### Half Expanded
```
┌─────────────────────────────┐
│         ─────               │
│  Traffic Conditions         │
│  ┌───┐ ┌───┐ ┌───┐        │
│  │45%│ │ 3 │ │15m│        │
│  └───┘ └───┘ └───┘        │
│  Recent Incidents:          │
│  • Accident on Main St      │
│  • Roadwork on 2nd Ave      │
│  [Start Monitoring]         │
└─────────────────────────────┘
```

#### Full Expanded
```
┌─────────────────────────────┐
│         ─────               │
│  Traffic Conditions         │
│  ┌───────────────────────┐ │
│  │  Detailed Stats       │ │
│  │  Route Information    │ │
│  │  All Incidents        │ │
│  │  Traffic Trends       │ │
│  │  Recommendations      │ │
│  │                       │ │
│  └───────────────────────┘ │
│  [Start Monitoring]         │
└─────────────────────────────┘
```

### Interactions
- **Swipe up**: Expand to next position
- **Swipe down**: Collapse to previous position
- **Tap handle**: Cycle through positions
- **Tap backdrop**: Close when full

---

## 3. 🔍 FloatingSearchBar

**File**: `src/components/FloatingSearchBar.jsx`

### Default State
```
┌─────────────────────────────────┐
│ 🔍 Search location or address  │
└─────────────────────────────────┘
```

### Focused State
```
┌─────────────────────────────────┐
│ 🔍 Las Piñas              ✕    │ ← Clear button
└─────────────────────────────────┘
  ┌───────────────────────────────┐
  │ 📍 Use current location       │
  ├───────────────────────────────┤
  │ RECENT                        │
  │ 🕐 Las Piñas City Hall        │
  │ 🕐 SM Southmall               │
  ├───────────────────────────────┤
  │ SUGGESTIONS                   │
  │ 📍 Las Piñas - Manila         │
  │ 📍 Las Piñas City Center      │
  └───────────────────────────────┘
```

### Features
- Rounded, translucent design
- Autocomplete suggestions
- Recent searches
- Current location option
- Smooth dropdown animation

---

## 4. 🎯 FloatingActionButton

**File**: `src/components/FloatingActionButton.jsx`

### Variations

#### Locate Me (Bottom-Right)
```
        ┌───┐
        │ 📍│  ← White, circular
        └───┘
```

#### Report Incident (Bottom-Left)
```
┌───┐
│ ➕│  ← Red, circular, pulsing
└───┘
```

### Sizes
- **Small**: 48px diameter
- **Medium**: 56px diameter (default)
- **Large**: 64px diameter

### Colors
- Blue: Primary actions
- Red: Alert/report actions
- Green: Success actions
- White: Navigation actions
- Orange: Warning actions

### With Badge
```
    ┌───┐
  3 │ 🔔│  ← Notification count
    └───┘
```

---

## 5. 🚨 IncidentReportModal

**File**: `src/components/IncidentReportModal.jsx`

### Step 1: Select Type
```
┌─────────────────────────────────┐
│  Report Incident           ✕    │
│  What happened?                 │
├─────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐   │
│  │ 🚗💥     │  │ 🚧       │   │
│  │ Accident │  │ Roadwork │   │
│  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐   │
│  │ 👮       │  │ 🌊       │   │
│  │ Police   │  │ Flood    │   │
│  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐   │
│  │ 🚗       │  │ ❓       │   │
│  │ Traffic  │  │ Other    │   │
│  └──────────┘  └──────────┘   │
└─────────────────────────────────┘
```

### Step 2: Add Details
```
┌─────────────────────────────────┐
│  Add Details               ✕    │
│  Tell us more about it          │
├─────────────────────────────────┤
│  Severity Level:                │
│  [Minor] [Moderate] [Severe]    │
│                                 │
│  Description (Optional):        │
│  ┌─────────────────────────┐   │
│  │ Add more details...     │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  Location:                      │
│  [14.4504] [121.0170]          │
│  📍 Use current location        │
│                                 │
│  Photo Evidence (Optional):     │
│  ┌─────────────────────────┐   │
│  │      📷                 │   │
│  │  Tap to add photo       │   │
│  └─────────────────────────┘   │
│                                 │
│  [Back]      [Submit Report]    │
└─────────────────────────────────┘
```

---

## 6. 📊 TrafficInfoCard

**File**: `src/components/TrafficInfoCard.jsx`

### Layout
```
┌─────────────────────────────────┐
│  Traffic Conditions             │
│  Las Piñas City      [Moderate] │
├─────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌───────┐│
│  │  45%  │ │   3   │ │  15   ││
│  │ 📊    │ │  ⚠️   │ │  ⏰   ││
│  │Congest│ │Incidnt│ │Minutes││
│  └───────┘ └───────┘ └───────┘│
├─────────────────────────────────┤
│  Suggested Route                │
│  ┌─────────────────────────┐   │
│  │ 5.2 km • 15 min         │   │
│  │ ⚠️ Heavy traffic ahead  │   │
│  └─────────────────────────┘   │
├─────────────────────────────────┤
│  Recent Incidents               │
│  🔴 Accident - Main St - 2m ago │
│  🟡 Roadwork - 2nd Ave - 5m ago │
│  🟢 Cleared - Oak Rd - 10m ago  │
├─────────────────────────────────┤
│     [🧭 Start Monitoring]       │
├─────────────────────────────────┤
│  Updated 2:30 PM                │
└─────────────────────────────────┘
```

---

## 7. 🔔 Toast Notifications

**File**: `src/components/Toast.jsx`

### Success Toast
```
┌─────────────────────────────┐
│ ✅ Report submitted!    ✕  │  ← Green background
└─────────────────────────────┘
```

### Error Toast
```
┌─────────────────────────────┐
│ ❌ Failed to load data  ✕  │  ← Red background
└─────────────────────────────┘
```

### Warning Toast
```
┌─────────────────────────────┐
│ ⚠️ GPS not available    ✕  │  ← Orange background
└─────────────────────────────┘
```

### Info Toast
```
┌─────────────────────────────┐
│ ℹ️ Monitoring started   ✕  │  ← Gray background
└─────────────────────────────┘
```

### Features
- Auto-dismiss after 3 seconds
- Stacking support (multiple toasts)
- Smooth slide-in animation
- Manual close button
- Position: Top-center

---

## 8. 🎨 Layer Controls Menu

### Collapsed
```
┌───┐
│ 🗺️│  ← Layers button
└───┘
```

### Expanded
```
┌───┐
│ 🗺️│
└───┘
  ┌─────────────────────┐
  │ Map Layers          │
  ├─────────────────────┤
  │ Traffic Heatmap  ☑️ │
  ├─────────────────────┤
  │ Map Style           │
  │ • Main              │
  │ • Night             │
  │ • Satellite         │
  └─────────────────────┘
```

---

## 9. 🌙 Dark Mode Toggle

### Light Mode Active
```
┌───┐
│ 🌙│  ← Moon icon
└───┘
```

### Dark Mode Active
```
┌───┐
│ ☀️│  ← Sun icon
└───┘
```

### Dark Mode Colors
- Background: Dark gray (#111827)
- Cards: Darker gray (#1f2937)
- Text: Light gray (#f9fafb)
- Accents: Lighter blue (#60a5fa)

---

## 🎯 Interaction Patterns

### Touch Gestures
```
Tap         → Select/activate
Long press  → Show tooltip
Swipe up    → Expand bottom sheet
Swipe down  → Collapse bottom sheet
Pinch       → Zoom map
Pan         → Move map
```

### Button States
```
Default  → Normal appearance
Hover    → Slightly darker (desktop)
Active   → Pressed effect (scale down)
Disabled → Grayed out, no interaction
```

### Animations
```
Fade in     → 300ms ease-out
Slide up    → 400ms cubic-bezier
Scale       → 200ms ease-in-out
Bounce      → 600ms ease-out
Pulse       → 2s infinite
```

---

## 📱 Responsive Breakpoints

### Mobile (< 640px)
```
┌─────────────┐
│   [Search]  │
│             │
│     Map     │
│             │
│ [+]    [📍] │
│ ┌─────────┐ │
│ │ Bottom  │ │
│ │ Sheet   │ │
│ └─────────┘ │
└─────────────┘
```

### Tablet (640px - 1024px)
```
┌───────────────────┐
│    [Search Bar]   │
│                   │
│       Map         │
│                   │
│  [+]        [📍]  │
│  ┌─────────────┐  │
│  │ Bottom Sheet│  │
│  └─────────────┘  │
└───────────────────┘
```

### Desktop (> 1024px)
```
┌─────────────────────────┐
│     [Search Bar]        │
│                         │
│         Map             │
│                         │
│   [+]           [📍]    │
│   ┌───────────────────┐ │
│   │  Bottom Sheet     │ │
│   └───────────────────┘ │
└─────────────────────────┘
```

---

## 🎨 Color System

### Primary Colors
```
Blue:   #3b82f6 ████ (Primary actions)
Red:    #ef4444 ████ (Alerts, errors)
Green:  #10b981 ████ (Success)
Orange: #f59e0b ████ (Warnings)
Gray:   #6b7280 ████ (Neutral)
```

### Semantic Colors
```
Success:  #10b981 ████
Warning:  #f59e0b ████
Error:    #ef4444 ████
Info:     #3b82f6 ████
```

### Traffic Severity
```
Low:      #10b981 ████ (Green)
Medium:   #f59e0b ████ (Orange)
High:     #ef4444 ████ (Red)
Critical: #7f1d1d ████ (Dark Red)
```

---

## 🔤 Typography Scale

```
Heading 1:  36px  Bold     Page titles
Heading 2:  30px  Bold     Section headers
Heading 3:  24px  Semibold Subsections
Heading 4:  20px  Semibold Card titles
Body:       16px  Regular  Main text
Small:      14px  Regular  Secondary text
Tiny:       12px  Regular  Captions, labels
```

---

## 📐 Spacing System

```
xs:  4px   ▪
sm:  8px   ▪▪
md:  16px  ▪▪▪▪
lg:  24px  ▪▪▪▪▪▪
xl:  32px  ▪▪▪▪▪▪▪▪
2xl: 48px  ▪▪▪▪▪▪▪▪▪▪▪▪
```

---

## 🎭 Shadow Levels

```
sm:  Subtle shadow for cards
md:  Standard shadow for buttons
lg:  Elevated shadow for modals
xl:  Floating shadow for FABs
```

---

This visual guide shows how each component looks and behaves. Use it as a reference when customizing or extending the UI!

**Need more details?** Check the component files for full implementation.

