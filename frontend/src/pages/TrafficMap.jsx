import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, ScaleControl, ZoomControl, Polygon, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MiniDashboardSheet from '../components/MiniDashboardSheet';
import './TrafficMap.css';
import TrafficMapSidebar from '../components/TrafficMapSidebar';
import { MapSkeleton } from '../components/LoadingSkeleton';
import ErrorBoundary from '../components/ErrorBoundary';
import NavigationMarker from '../components/NavigationMarker';
import NavigationHUD from '../components/NavigationHUD';
import { useDeviceOrientation, useGeolocationHeading } from '../hooks/useDeviceOrientation';
// Map Layer Components
import {
  WeatherLayer,
  FloodLayer,
  ParkingLayer,
  IncidentLayer,
  EmergencyLayer,
  ReportLayer,
  TrafficMonitoringLayer
} from '../components/mapLayers';
// Map UI Components
import {
  SearchBar,
  NavigationPanel,
  RouteInfoPanel,
  SimulationPanel,
  // RouteAlternativesPanel, // REMOVED: Using Google Maps style instead
  EnhancedSearchPanel,
  EnhancedNavigationPanel,
  MapControls,
  MapMarkers,
  HistoryPanel,
  PlaceInfoPanel
} from '../components/mapUI';
import GoogleMapsStyleNavigation from '../components/GoogleMapsStyleNavigation';
// Custom Hooks
import { useMapData } from '../hooks/useMapData';
import { useLocationTracking } from '../hooks/useLocationTracking';
import useMapPreferences from '../hooks/useMapPreferences';
import { DarkModeProvider } from '../context/DarkModeContext';
// Utils
import { createCustomIcon, createNoParkingIcon, createNavigationIcon } from '../utils/mapIcons';
import { formatCoords, getTripPlaceName } from '../utils/mapHelpers';
// Tour helpers
import { isNewUser, markTourCompleted, saveTourProgress, getTourProgress, clearTourProgress } from '../utils/tourHelper';
import { getTrafficMapTourSteps, getSidebarToggleSteps } from '../utils/tourConfig';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import {
  Navigation,
  MapPin,
  Clock,
  Route,
  Search,
  Menu,
  X,
  Zap,
  Star,
  History,
  Heart,
  Settings,
  Layers,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  Car,
  Footprints,
  Bike,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Target,
  Info,
  Volume2,
  VolumeX,
  Share2,
  Cloud,
  Shuffle,
  BarChart3,
  Box
} from 'lucide-react';
import HeatmapLayer from '../components/HeatmapLayer';
import toast from 'react-hot-toast';
import TrafficFlowHeatmap from '../components/TrafficFlowHeatmap';
import RouteLayer from '../components/RouteLayer';
import TomTomTileLayer from '../components/TomTomTileLayer';
import TrafficFlowLayer from '../components/TrafficFlowLayer';
import SearchResultsLayer from '../components/SearchResultsLayer';
import SearchResultsSidebar from '../components/SearchResultsSidebar';
import enhancedRoutingService from '../services/enhancedRoutingService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';
import travelHistoryService from '../services/travelHistoryService';
import tomtomService from '../services/tomtomService';
import { useAuth } from '../context/AuthContext';
// Data layer services
import parkingService from '../services/parkingService';
import weatherService from '../services/weatherService';
import reportService from '../services/reportService';
import notificationService from '../services/notificationService';
import emergencyService from '../services/emergencyService';
import incidentProneService from '../services/incidentProneService';

// NEW: 5 Priority Features Services
import voiceNavigationService from '../services/voiceNavigationService';
import incidentReportingService from '../services/incidentReportingService';
import supabaseStorageService from '../services/supabaseStorageService';
import locationSharingService from '../services/locationSharingService';
import multiStopRoutingService from '../services/multiStopRoutingService';
import weatherAwareRoutingService from '../services/weatherAwareRoutingService';
import trafficService from '../services/trafficService';
import roadworksService from '../services/roadworksService';
import realTimeTrafficService from '../services/realTimeTrafficService';

// NEW: 5 Priority Features Components
import VoiceNavigationPanel from '../components/VoiceNavigationPanel';
import IncidentReportModal from '../components/IncidentReportModal';
import EmergencyReportsPanel from '../components/EmergencyReportsPanel';
import MultiStopPlanner from '../components/MultiStopPlanner';
import LocationSharePanel from '../components/LocationSharePanel';
import WeatherAlertBanner from '../components/WeatherAlertBanner';
import SmartRoutePanel from '../components/SmartRoutePanel';
import WeatherFloodAdvisory from '../components/WeatherFloodAdvisory';
import TrafficPredictionsPanel from '../components/TrafficPredictionsPanel';
import TrafficMonitoringPanel from '../components/TrafficMonitoringPanel';
import ActiveIncidentsPanel from '../components/ActiveIncidentsPanel';

// NEW state toggles for API-backed layers
// NOTE: set initial defaults to off; wire to API in future step
// These sit near top-level declarations for clarity
const initialParkingEnabled = false;
const initialWeatherEnabled = false;
const initialEmergencyEnabled = false;

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Filter traffic data to show recent data (last 24 hours)
 * Prioritizes today's data but includes recent data if today's data is unavailable
 */
const filterRecentTrafficData = (data) => {
  if (!Array.isArray(data)) return [];
  
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  // First, try to get today's data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayData = [];
  const recentData = [];
  
  data.forEach(item => {
    // Check various timestamp fields that might exist in the data
    const timestamp = item.created_at || item.timestamp || item.updated_at || item.last_updated || item.date;
    if (!timestamp) {
      // If no timestamp, include it (might be real-time data)
      recentData.push(item);
      return;
    }
    
    try {
      const itemDate = new Date(timestamp);
      
      // Validate the date is valid
      if (isNaN(itemDate.getTime())) {
        // Invalid date, but include it anyway (might be real-time data)
        recentData.push(item);
        return;
      }
      
      // Prioritize today's data
      if (itemDate >= today && itemDate < tomorrow) {
        todayData.push(item);
      } else if (itemDate >= last24Hours) {
        // Include data from last 24 hours as fallback
        recentData.push(item);
      }
    } catch (error) {
      console.warn('Invalid date in traffic data:', timestamp, error);
      // Include item anyway if date parsing fails (might be real-time data)
      recentData.push(item);
    }
  });
  
  // Return today's data if available, otherwise return recent data (last 24 hours)
  return todayData.length > 0 ? todayData : recentData;
};

// Major roads focus list for Las Piñas City heatmap overlay
const MAJOR_ROAD_KEYWORDS = [
  'alabang-zapote',
  'alabang zapote',
  'almazna',
  'almanza',
  'bf almanza',
  'bf international',
  'alabang dos',
  'pamplona',
  'zapote',
  'daang hari',
  'west service',
  'sm southmall',
  'las pinas city medical center',
  'mcx',
  'caa road',
  'molino',
  'casimiro',
  'sha subdiv',
  'quintos',
  'niog',
  'zapote bridge'
];

const PREDEFINED_ROAD_COORDINATES = {
  'alabang-zapote': [
    [14.4635, 120.9855],
    [14.4554, 120.9953],
    [14.4472, 121.0058],
    [14.4410, 121.0139],
    [14.4335, 121.0241]
  ],
  'almanza road': [
    [14.4444, 121.0102],
    [14.4388, 121.0169],
    [14.4346, 121.0225]
  ],
  'bf international': [
    [14.4489, 121.0272],
    [14.4526, 121.0316],
    [14.4564, 121.0352]
  ]
};

const clamp01 = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const deriveHeatIntensity = (record) => {
  const status = (record?.traffic_status || record?.status || '').toLowerCase();
  const statusIntensityMap = {
    free_flow: 0.1,
    freeflow: 0.1,
    light: 0.3,
    moderate: 0.6,
    heavy: 0.85,
    severe: 0.95,
    standstill: 1
  };

  if (typeof record?.congestion_percentage === 'number') {
    return clamp01(record.congestion_percentage / 100, 0.1, 1);
  }

  const currentSpeed = Number(record?.current_speed ?? record?.average_speed ?? record?.speed_kph ?? record?.speed);
  const freeFlowSpeed = Number(record?.free_flow_speed ?? record?.freeflow_speed ?? record?.typical_speed ?? record?.max_speed);
  if (Number.isFinite(currentSpeed) && Number.isFinite(freeFlowSpeed) && freeFlowSpeed > 0) {
    const ratio = currentSpeed / freeFlowSpeed;
    return clamp01(1 - ratio, 0.1, 0.95);
  }

  if (statusIntensityMap[status]) {
    return statusIntensityMap[status];
  }

  return 0.3; // default mild traffic
};

const isMajorRoad = (roadName = '') => {
  const lower = roadName.toLowerCase();
  return MAJOR_ROAD_KEYWORDS.some(keyword => lower.includes(keyword));
};

const jitterPoints = (lat, lng, intensity) => {
  return [[lat, lng, clamp01(intensity, 0.05, 1)]];
};

const trafficRecordsToHeatmapPoints = (records, { includeAll = false } = {}) => {
  if (!Array.isArray(records)) return [];
  const points = [];
  const seen = new Set();
  const predefinedAdded = new Set();

  records.forEach(record => {
    const roadName = record?.road_name || record?.roadName || '';
    if (!includeAll && !isMajorRoad(roadName)) return;

    const lat = Number(
      record?.latitude ??
        record?.lat ??
        record?.center_latitude ??
        record?.start_latitude ??
        record?.location?.lat
    );
    const lng = Number(
      record?.longitude ??
        record?.lng ??
        record?.center_longitude ??
        record?.start_longitude ??
        record?.location?.lng
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const intensity = clamp01(deriveHeatIntensity(record), 0.05, 1);
    if (intensity <= 0) return;

    const key = `${roadName}-${lat.toFixed(5)}-${lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const jittered = jitterPoints(lat, lng, intensity);
    jittered.forEach(pt => points.push(pt));

    const normalizedRoad = roadName.toLowerCase();
    if (!predefinedAdded.has(normalizedRoad)) {
      const predefinedEntry = Object.entries(PREDEFINED_ROAD_COORDINATES).find(
        ([keyword]) => normalizedRoad.includes(keyword)
      );
      if (predefinedEntry) {
        const [, coords] = predefinedEntry;
        coords.forEach((coord, idx) => {
          const [plat, plng] = coord;
          const predefinedKey = `${normalizedRoad}-pre-${idx}`;
          if (!seen.has(predefinedKey)) {
            seen.add(predefinedKey);
            points.push([plat, plng, Math.max(intensity, 0.12)]);
          }
        });
        predefinedAdded.add(normalizedRoad);
      }
    }
  });

  return points;
};

// ===== Rule-based Heatmap Utilities (time/location filters and critical area scoring) =====
const parseRecordDate = (record) => {
  const ts = record?.created_at || record?.timestamp || record?.updated_at || record?.last_updated || record?.date;
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d;
};

const isPeakHour = (date) => {
  const h = date.getHours();
  // Morning 7-10, Evening 16-20
  return (h >= 7 && h <= 10) || (h >= 16 && h <= 20);
};

const isNightHour = (date) => {
  const h = date.getHours();
  return h >= 21 || h <= 5;
};

const filterByTimeOption = (records, option) => {
  if (!Array.isArray(records) || records.length === 0) return [];
  const now = Date.now();
  const withinMs = {
    '1h': 1 * 60 * 60 * 1000,
    '3h': 3 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
  };
  if (option === 'today_peak' || option === 'night') {
    return records.filter((r) => {
      const d = parseRecordDate(r);
      if (!d) return true;
      if (option === 'today_peak') return isPeakHour(d);
      if (option === 'night') return isNightHour(d);
      return true;
    });
  }
  const win = withinMs[option] ?? withinMs['24h'];
  return records.filter((r) => {
    const d = parseRecordDate(r);
    if (!d) return true;
    return now - d.getTime() <= win;
  });
};

const toRad = (deg) => (deg * Math.PI) / 180;
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const filterByLocationOption = (records, option, params) => {
  if (!Array.isArray(records) || records.length === 0) return [];
  const mapBounds = params?.bounds;
  const center = params?.center;
  const radiusKm = params?.radiusKm ?? 2;
  if (option === 'view' && mapBounds) {
    const south = mapBounds.getSouth?.() ?? mapBounds.south ?? mapBounds.minLat ?? -90;
    const north = mapBounds.getNorth?.() ?? mapBounds.north ?? mapBounds.maxLat ?? 90;
    const west = mapBounds.getWest?.() ?? mapBounds.west ?? mapBounds.minLng ?? -180;
    const east = mapBounds.getEast?.() ?? mapBounds.east ?? mapBounds.maxLng ?? 180;
    return records.filter((r) => {
      const lat = Number(r?.latitude ?? r?.lat ?? r?.center_latitude ?? r?.start_latitude ?? r?.location?.lat);
      const lng = Number(r?.longitude ?? r?.lng ?? r?.center_longitude ?? r?.start_longitude ?? r?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return lat >= south && lat <= north && lng >= west && lng <= east;
    });
  }
  if (option === 'city' && params?.defaultBounds) {
    const b = params.defaultBounds;
    return records.filter((r) => {
      const lat = Number(r?.latitude ?? r?.lat ?? r?.center_latitude ?? r?.start_latitude ?? r?.location?.lat);
      const lng = Number(r?.longitude ?? r?.lng ?? r?.center_longitude ?? r?.start_longitude ?? r?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return lat >= b.lat_min && lat <= b.lat_max && lng >= b.lng_min && lng <= b.lng_max;
    });
  }
  if (option === 'radius' && center) {
    return records.filter((r) => {
      const lat = Number(r?.latitude ?? r?.lat ?? r?.center_latitude ?? r?.start_latitude ?? r?.location?.lat);
      const lng = Number(r?.longitude ?? r?.lng ?? r?.center_longitude ?? r?.start_longitude ?? r?.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return haversineKm(center[0], center[1], lat, lng) <= radiusKm;
    });
  }
  return records;
};

const computeCriticalScores = (records, thresholdPct = 70, minOccurrences = 2) => {
  const scores = new Map();
  (records || []).forEach((r) => {
    const road = (r?.road_name || r?.roadName || '').toLowerCase().trim();
    if (!road) return;
    const sev = String(r?.traffic_status || r?.status || '').toLowerCase();
    const pct = Number(r?.congestion_percentage);
    const heavyish = sev === 'heavy' || sev === 'severe' || sev === 'standstill' || (Number.isFinite(pct) && pct >= thresholdPct);
    if (!heavyish) return;
    const prev = scores.get(road) || 0;
    scores.set(road, prev + 1);
  });
  // Reduce to only critical (occurrences >= minOccurrences)
  const critical = new Map();
  scores.forEach((count, road) => {
    if (count >= minOccurrences) critical.set(road, count);
  });
  return critical;
};

const buildRuleHeatmapPoints = (records, { majorOnly = true, criticalScores }) => {
  if (!Array.isArray(records)) return [];
  const points = [];
  const seen = new Set();
  (records || []).forEach((record) => {
    const roadName = record?.road_name || record?.roadName || '';
    if (majorOnly && !isMajorRoad(roadName || '')) return;
    const lat = Number(
      record?.latitude ??
      record?.lat ??
      record?.center_latitude ??
      record?.start_latitude ??
      record?.location?.lat
    );
    const lng = Number(
      record?.longitude ??
      record?.lng ??
      record?.center_longitude ??
      record?.start_longitude ??
      record?.location?.lng
    );
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let intensity = clamp01(deriveHeatIntensity(record), 0.05, 1);
    // Boost intensity for critical roads
    const keyRoad = (roadName || '').toLowerCase().trim();
    if (keyRoad && criticalScores?.has(keyRoad)) {
      const boostFactor = Math.min(1.0, 0.75 + (criticalScores.get(keyRoad) * 0.08));
      intensity = clamp01(Math.max(intensity, boostFactor), 0.05, 1);
    }
    const key = `${roadName}-${lat.toFixed(5)}-${lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push([lat, lng, intensity]);
  });
  return points;
};
// ===== End rule utilities =====

// Categorize normalized intensity (0–1) to traffic colors.
// We treat intensity as a normalized jamFactor-style value where:
// 0–0.3  → free / green
// 0.3–0.6 → moderate / yellow
// 0.6–1.0 → heavy / red
const categorizeIntensity = (intensity) => {
  const v = Number.isFinite(intensity) ? clamp01(intensity, 0, 1) : 0;
  if (v < 0.3) return 'green';
  if (v < 0.6) return 'yellow';
  return 'red';
};

const filterPointsByCategories = (points, { showGreen, showYellow, showRed }) => {
  if (!Array.isArray(points) || points.length === 0) return [];
  return points.filter((p) => {
    const cat = categorizeIntensity(p[2]);
    return (cat === 'green' && showGreen) || (cat === 'yellow' && showYellow) || (cat === 'red' && showRed);
  });
};

const filterPointArrayByLocation = (points, option, params) => {
  if (!Array.isArray(points) || points.length === 0) return [];
  const mapBounds = params?.bounds;
  const center = params?.center;
  const radiusKm = params?.radiusKm ?? 2;
  if (option === 'view' && mapBounds) {
    const south = mapBounds.getSouth?.() ?? mapBounds.south ?? mapBounds.minLat ?? -90;
    const north = mapBounds.getNorth?.() ?? mapBounds.north ?? mapBounds.maxLat ?? 90;
    const west = mapBounds.getWest?.() ?? mapBounds.west ?? mapBounds.minLng ?? -180;
    const east = mapBounds.getEast?.() ?? mapBounds.east ?? mapBounds.maxLng ?? 180;
    return points.filter((p) => {
      const [lat, lng] = p;
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= south && lat <= north && lng >= west && lng <= east;
    });
  }
  if (option === 'city' && params?.defaultBounds) {
    const b = params.defaultBounds;
    return points.filter((p) => {
      const [lat, lng] = p;
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= b.lat_min && lat <= b.lat_max && lng >= b.lng_min && lng <= b.lng_max;
    });
  }
  if (option === 'radius' && center) {
    return points.filter((p) => {
      const [lat, lng] = p;
      return Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(center[0], center[1], lat, lng) <= radiusKm;
    });
  }
  return points;
};

const normalizeHeatmapPoint = (point) => {
  if (!point) return null;
  if (Array.isArray(point)) {
    const [lat, lng, intensity = 0.3] = point;
    const nLat = Number(lat);
    const nLng = Number(lng);
    const nIntensity = Number(intensity);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
    return [nLat, nLng, clamp01(Number.isFinite(nIntensity) ? nIntensity : 0.3, 0, 1)];
  }
  const lat = Number(point.lat ?? point.latitude ?? point.y);
  const lng = Number(point.lng ?? point.longitude ?? point.x);
  const intensity = Number(point.intensity ?? point.value ?? point.weight ?? point[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const normalizedIntensity = clamp01(Number.isFinite(intensity) ? intensity : 0.3, 0, 1);
  return [lat, lng, normalizedIntensity];
};

const TrafficMap = () => {
  const { user } = useAuth();
  const isGuest = !user;
  const navigate = useNavigate();
  const mapRef = useRef(null);
  
  // Map and navigation states
  const [mapCenter, setMapCenter] = useState([14.441781, 120.99996]); // Requested area center
  const [mapZoom, setMapZoom] = useState(13);
  // Requested bounds for heatmap clamping
  const defaultBounds = {
    lat_min: 14.425741,
    lat_max: 14.457820,
    lng_min: 120.970614,
    lng_max: 121.029305
  };
  // Data layer toggles
  const [parkingEnabled, setParkingEnabled] = useState(false);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  // const [emergencyEnabled, setEmergencyEnabled] = useState(false);
  const [reportsEnabled, setReportsEnabled] = useState(false);
  const [incidentProneEnabled, setIncidentProneEnabled] = useState(false);
  const [floodZonesEnabled, setFloodZonesEnabled] = useState(false);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [navigationStep, setNavigationStep] = useState(0);
  
  // Search and location states
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchResult, setSelectedSearchResult] = useState(null);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Enhanced search states
  const [searchMode, setSearchMode] = useState('destination'); // 'origin' or 'destination'
  const [originQuery, setOriginQuery] = useState(''); // Separate query for origin field
  const [destinationQuery, setDestinationQuery] = useState(''); // Separate query for destination field
  const [recentSearches, setRecentSearches] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Layout optimization states
  const [navigationPanelMinimized, setNavigationPanelMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchBarVisible, setSearchBarVisible] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [showSecondaryActions, setShowSecondaryActions] = useState(false);
  const [autoHideTimeout, setAutoHideTimeout] = useState(null);

  // Popular Las Piñas City locations for quick suggestions
  const lasPinasSuggestions = [
    { name: 'SM Southmall', lat: 14.4328, lng: 121.0105, category: 'Shopping', icon: '🛒' },
    { name: 'Las Piñas City Hall', lat: 14.4497, lng: 120.9826, category: 'Government', icon: '🏛️' },
    { name: 'Alabang-Zapote Road', lat: 14.4450, lng: 121.0200, category: 'Road', icon: '🛣️' },
    { name: 'Robinsons Place Las Piñas', lat: 14.4419, lng: 120.9978, category: 'Shopping', icon: '🛒' },
    { name: 'University of Perpetual Help System', lat: 14.4483, lng: 120.9856, category: 'Education', icon: '🎓' },
    { name: 'Zapote Market', lat: 14.4624, lng: 120.9649, category: 'Market', icon: '🏪' },
    { name: 'BF Homes Las Piñas', lat: 14.4389, lng: 121.0344, category: 'Residential', icon: '🏘️' },
    { name: 'Las Piñas City Medical Center', lat: 14.4370, lng: 121.0130, category: 'Healthcare', icon: '🏥' },
    { name: 'St. Joseph Parish Church', lat: 14.4380, lng: 121.0120, category: 'Religious', icon: '⛪' },
    { name: 'Evia Lifestyle Center', lat: 14.3760, lng: 121.0118, category: 'Shopping', icon: '🛒' },
    { name: 'Pillar Village', lat: 14.4350, lng: 121.0200, category: 'Residential', icon: '🏘️' },
    { name: 'Alabang', lat: 14.4195, lng: 121.0401, category: 'District', icon: '📍' }
  ];

  // Load recent searches on component mount
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prefer compact/minimized nav panel on desktop
  useEffect(() => {
    if (isNavigationActive && isDesktop) {
      setNavigationPanelMinimized(true);
    }
  }, [isNavigationActive, isDesktop]);

  // Load recent searches on component mount
  useEffect(() => {
    const saved = localStorage.getItem('trafficMapSearchHistory');
    if (saved) {
      const history = JSON.parse(saved);
      setRecentSearches(history.slice(0, 5)); // Show last 5 searches as recent
    }
  }, []);

  // Handle clicks outside search panel to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside the search panel
      if (
        searchPanelRef.current &&
        !searchPanelRef.current.contains(event.target) &&
        showSearchResults
      ) {
        // Also check if the click is not on an input field or button inside the search panel
        const target = event.target;
        const isInputClick = target.tagName === 'INPUT' || 
                            target.closest('input') ||
                            (target.closest('button') && target.closest('[class*="glass-effect"]'));
        
        if (!isInputClick) {
          setShowSearchResults(false);
          setShowSuggestions(false);
        }
      }
    };

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Resolve landmark coordinates once
  useEffect(() => {
    const resolveLandmarks = async () => {
      try {
        const names = [
          'SM Southmall Las Piñas',
          'Las Piñas City Hall',
          'Colours Las Piñas'
        ];
        const results = await Promise.all(names.map(async (name) => {
          try {
            const res = await enhancedGeocodingService.searchLocations(name, {
              limit: 1,
              countrySet: 'PH',
              center: { lat: 14.4504, lng: 121.0170 },
              radius: 15000
            });
            const best = Array.isArray(res) && res.length > 0 ? res[0] : null;
            return best ? { name, lat: best.lat, lng: best.lng } : null;
          } catch {
            return null;
          }
        }));
        const byName = {};
        results.filter(Boolean).forEach(r => { byName[r.name] = { lat: r.lat, lng: r.lng }; });
        setLandmarks(byName);
      } catch (e) {
        // Non-fatal; heatmap falls back to bounds-based generator
        setLandmarks(null);
      }
    };
    resolveLandmarks();
  }, []);

  // Auto-hide search bar when navigating
  useEffect(() => {
    if (isNavigationActive) {
      // Hide search bar after 2 seconds
      const timer = setTimeout(() => {
        setSearchBarVisible(false);
      }, 2000);
      
      // Minimize navigation panel after 3 seconds
      const navTimer = setTimeout(() => {
        setNavigationPanelMinimized(true);
      }, 3000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(navTimer);
      };
    } else {
      // Show search bar when not navigating
      setSearchBarVisible(true);
      setNavigationPanelMinimized(false);
    }
  }, [isNavigationActive]);

  // GPS and navigation tracking
  const [userLocation, setUserLocation] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);
  const [navigationProgress, setNavigationProgress] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [userHeading, setUserHeading] = useState(0); // Device heading for map rotation
  const [mapRotation, setMapRotation] = useState(0); // Map rotation angle
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(true); // Gyroscope enabled by default for navigation
  const [navigationIcon, setNavigationIcon] = useState('car'); // Selected navigation icon
  const [showIconSelector, setShowIconSelector] = useState(false); // Icon selector visibility
  const [currentSpeed, setCurrentSpeed] = useState(0); // Current speed from GPS
  const [distanceToNextTurn, setDistanceToNextTurn] = useState(null); // Distance to next turn
  const [navigationHUDMinimized, setNavigationHUDMinimized] = useState(false); // HUD minimized state

  // Route alternatives
  const [showRouteAlternatives, setShowRouteAlternatives] = useState(false);
  const [routeAlternatives, setRouteAlternatives] = useState([]);
  const [routeCriteria, setRouteCriteria] = useState('fastest'); // fastest, shortest, eco, avoidTolls
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  // Landmark locations resolved via geocoder
  const [landmarks, setLandmarks] = useState(null);
  
  // UI states
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showEmergencyReportsPanel, setShowEmergencyReportsPanel] = useState(false);
  const [myEmergencyReports, setMyEmergencyReports] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedParkingZone, setSelectedParkingZone] = useState(null);
  const [showStreetView, setShowStreetView] = useState(false);
  
  // Map preferences with localStorage persistence (heatmap, traffic layer, night mode)
  const {
    heatmapEnabled,
    setHeatmapEnabled,
    trafficLayerEnabled,
    setTrafficLayerEnabled,
    mapStyle,
    setMapStyle,
  } = useMapPreferences();
  
  // Store previous style for restoration (used during simulation/navigation)
  // Initialize from saved preference, but only track user-selected styles (not simulation styles)
  const [previousMapStyle, setPreviousMapStyle] = useState(() => {
    try {
      const stored = localStorage.getItem('traffic_map_preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        const savedStyle = parsed.mapStyle || 'main';
        // Only save user styles, not simulation styles
        return savedStyle !== 'light_driving' ? savedStyle : 'main';
      }
    } catch (error) {
      console.error('Error loading previous map style:', error);
    }
    return 'main';
  });
  
  const [trafficMonitorNewEnabled, setTrafficMonitorNewEnabled] = useState(false);
  // Removed 3D map overlay feature
  
  // Place Info Panel states
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showPlaceInfoPanel, setShowPlaceInfoPanel] = useState(false);
  
  // Directions Panel states
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [directionsPanelMinimized, setDirectionsPanelMinimized] = useState(false);
  
  // Travel history and personalization
  const [travelHistory, setTravelHistory] = useState([]);
  const [frequentLocations, setFrequentLocations] = useState([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState([]);
  const [travelStats, setTravelStats] = useState(null);
  
  // Traffic and heatmap data
  const [heatmapData, setHeatmapData] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [routeTrafficData, setRouteTrafficData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  // Rule-based heatmap controls
  const [ruleHeatmapEnabled, setRuleHeatmapEnabled] = useState(false);
  const [showRulePanel, setShowRulePanel] = useState(false);
  const [ruleTimeFilter, setRuleTimeFilter] = useState('24h'); // '1h' | '3h' | '24h' | 'today_peak' | 'night'
  const [ruleLocationFilter, setRuleLocationFilter] = useState('view'); // 'view' | 'city' | 'radius'
  const [ruleRadiusKm, setRuleRadiusKm] = useState(2);
  const [ruleMajorRoadsOnly, setRuleMajorRoadsOnly] = useState(true);
  const [ruleCriticalThreshold, setRuleCriticalThreshold] = useState(70); // congestion % or heavy/severe
  const [ruleMinOccurrences, setRuleMinOccurrences] = useState(2);
  const [ruleHeatmapOpacity, setRuleHeatmapOpacity] = useState(0.5);
  const [ruleShowGreen, setRuleShowGreen] = useState(true);
  const [ruleShowYellow, setRuleShowYellow] = useState(true);
  const [ruleShowRed, setRuleShowRed] = useState(true);
  // NEW: TomTom real-time traffic heatmap (Flow + Incidents)
  const [ttHeatmapEnabled, setTtHeatmapEnabled] = useState(false);
  const [ttHeatmapPoints, setTtHeatmapPoints] = useState([]);
  const [isLoadingTtHeatmap, setIsLoadingTtHeatmap] = useState(false);
  const [isScrapingIncidentProne, setIsScrapingIncidentProne] = useState(false);
  const [showGuestIntro, setShowGuestIntro] = useState(false);
  // Disable legacy sidebar heatmap; use floating HERE heatmap instead
  const legacyHeatmapDisabled = true;

  // Scrape incident-prone areas and refresh layer
  const handleScrapeIncidentProneAreas = async () => {
    try {
      if (isScrapingIncidentProne) return;
      setIsScrapingIncidentProne(true);
      toast.loading('Updating incident‑prone areas…', { id: 'scrape-ipa' });
      const request = {
        area: 'Las Piñas City',
        radius_km: 15,
        sources: ['dpwh', 'lgu', 'mmda', 'news', 'facebook'],
        keywords: ['accident', 'road work', 'hazard', 'traffic', 'prone', 'hotspot'],
        limit: 100
      };
      await incidentProneService.scrapeIncidentData(request).catch(() => ({}));
      // Force layer refresh
      if (!incidentProneEnabled) {
        setIncidentProneEnabled(true);
      } else {
        setIncidentProneEnabled(false);
        setTimeout(() => setIncidentProneEnabled(true), 10);
      }
      toast.success('Incident‑prone areas refreshed', { id: 'scrape-ipa' });
    } catch (_) {
      toast.error('Failed to update incident‑prone areas', { id: 'scrape-ipa' });
    } finally {
      setIsScrapingIncidentProne(false);
    }
  };

  // Guest intro overlay (first visit)
  useEffect(() => {
    try {
      if (isGuest) {
        const seen = localStorage.getItem('tm_guest_intro_seen');
        if (!seen) setShowGuestIntro(true);
      } else {
        setShowGuestIntro(false);
      }
    } catch (_) {}
  }, [isGuest]);

  const startGuestExplore = () => {
    try { localStorage.setItem('tm_guest_intro_seen', '1'); } catch (_) {}
    setShowGuestIntro(false);
  };

  // Use custom hook for map data
  const {
    parkingAreas,
    noParkingZones,
    nearbyWeatherAlerts,
    floodProneAreas,
    criticalFloodAreas,
    activeFloods,
    nearbyEmergencies,
    userReports,
    incidentProneAreas,
    tmIncidents,
    tmRoadworks,
    heatmapData: mapHeatmapData
  } = useMapData(mapCenter, {
    parkingEnabled,
    weatherEnabled,
    // emergencyEnabled,
    reportsEnabled,
    incidentProneEnabled,
    floodZonesEnabled,
    trafficMonitorNewEnabled
  });

  // Simulation states
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationSpeed, setSimulationSpeed] = useState(1); // 1x, 2x, 5x, 10x
  const [simulatedLocation, setSimulatedLocation] = useState(null);
  const [simulationStartTime, setSimulationStartTime] = useState(null);
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [simulationMinimized, setSimulationMinimized] = useState(false);
  const [currentSimulationIndex, setCurrentSimulationIndex] = useState(0);

  // Refs
  const searchTimeoutRef = useRef(null);
  const navigationTimeoutRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const simulationAnimationFrameRef = useRef(null);
  const simulationLastMapUpdateRef = useRef(0);
  const simulationLastProgressUpdateRef = useRef(0);
  const simulationPausedRef = useRef(false);
  const simulationSpeedRef = useRef(1);
  const searchPanelRef = useRef(null);
  const heatmapFetchStateRef = useRef({
    lastFetched: 0,
    inFlight: false,
    cache: [],
  });
  // NEW: Interval holder for TomTom heatmap refresh
  const ttHeatmapIntervalRef = useRef(null);
  // NEW: Fetch state for TomTom heatmap (debounce, cache)
  const ttHeatmapFetchStateRef = useRef({
    lastFetched: 0,
    inFlight: false,
    cache: [],
    lastTomTomIncidentsFetched: 0,
    tomtomIncidentsBackoffUntil: 0,
  });
  // NEW: Static bounds snapshot for HERE/TomTom heatmap (captured once)
  const ttStaticBoundsRef = useRef(null);
  // NEW: HERE specific state to avoid rate limits
  const hereFetchStateRef = useRef({
    backoffUntil: 0,           // epoch ms until when we should not call HERE
    lastIncidentsFetched: 0,   // epoch ms for incidents throttling
  });
  // NEW: Global refresh throttle for TomTom heatmap (10 minutes)
  const TT_MIN_REFRESH_MS = 600000;
  const roadGeocodeCacheRef = useRef(new Map());
  // Track last map event type to distinguish pan vs zoom
  const lastMapEventTypeRef = useRef(null);

  // NEW: 5 Priority Features States
  // Voice Navigation
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Incident Reporting
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);

  // Multi-Stop Planning
  const [multiStopMode, setMultiStopMode] = useState(false);
  const [stops, setStops] = useState([]);

  // Location Sharing
  const [isSharing, setIsSharing] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [showSharePanel, setShowSharePanel] = useState(false);

  // Weather Awareness
  const [weatherData, setWeatherData] = useState(null);
  const [weatherWarnings, setWeatherWarnings] = useState([]);
  const [showWeatherAlert, setShowWeatherAlert] = useState(true);

  // Smart Route Panel
  const [showSmartRoutePanel, setShowSmartRoutePanel] = useState(false);
  
  // Traffic Predictions Panel
  const [showPredictionsPanel, setShowPredictionsPanel] = useState(false);
  const [showTrafficMonitoringPanel, setShowTrafficMonitoringPanel] = useState(false);
  const [showActiveIncidentsPanel, setShowActiveIncidentsPanel] = useState(false);

  useEffect(() => {
    if (showIncidentModal) {
      setSearchBarVisible(false);
      setShowSearchResults(false);
      setShowSuggestions(false);
    } else if (!isNavigationActive) {
      setSearchBarVisible(true);
    }
  }, [showIncidentModal, isNavigationActive]);

  const getFallbackRoadCoordinate = useCallback(async (roadName) => {
    if (!roadName) return null;
    const cache = roadGeocodeCacheRef.current;
    if (cache.has(roadName)) {
      return cache.get(roadName);
    }

    try {
      const query = `${roadName}, Las Piñas City, Philippines`;
      const results = await enhancedGeocodingService.searchLocations(query, {
        limit: 1,
        countrySet: 'PH',
        radius: 10000,
        center: { lat: 14.4504, lng: 121.0170 }
      });

      let best = null;
      if (Array.isArray(results) && results.length > 0) {
        best = results[0];
      } else if (results?.results && Array.isArray(results.results) && results.results.length > 0) {
        best = results.results[0];
      }

      const coord = best && best.lat && best.lng ? { lat: best.lat, lng: best.lng } : null;
      cache.set(roadName, coord);
      return coord;
    } catch (error) {
      cache.set(roadName, null);
      return null;
    }
  }, []);

  const fetchMajorRoadHeatmap = useCallback(async () => {
    if (!heatmapEnabled) return;

    const fetchState = heatmapFetchStateRef.current;
    const now = Date.now();

    // Throttle consecutive requests (90s window) and reuse cache when available
    if (fetchState.inFlight) {
      return;
    }
    if (now - fetchState.lastFetched < 90000 && fetchState.cache.length > 0) {
      setHeatmapData(fetchState.cache);
      return;
    }

    fetchState.inFlight = true;

    try {
      const mapInstance = mapRef.current;
      const bounds = mapInstance?.getBounds?.();
      const requestBounds = bounds
        ? {
            minLat: bounds.getSouth(),
            maxLat: bounds.getNorth(),
            minLng: bounds.getWest(),
            maxLng: bounds.getEast()
          }
        : {
            minLat: defaultBounds.lat_min,
            maxLat: defaultBounds.lat_max,
            minLng: defaultBounds.lng_min,
            maxLng: defaultBounds.lng_max
          };

      const params = {
        ...requestBounds,
        lat_min: requestBounds.minLat,
        lat_max: requestBounds.maxLat,
        lng_min: requestBounds.minLng,
        lng_max: requestBounds.maxLng
      };

      let trafficRecords = [];
      try {
          trafficRecords = await trafficService.getTrafficMonitoring({
            limit: 300,
          });
      } catch (error) {
        try {
          trafficRecords = await trafficService.getRealtimeTrafficDirect(params);
        } catch (fallbackError) {
          trafficRecords = [];
        }
      }

      if (!Array.isArray(trafficRecords) || trafficRecords.length === 0) {
        try {
          trafficRecords = await trafficService.getRealtimeTrafficDirect(params);
        } catch (_) {
          trafficRecords = [];
        }
      }

      const missingRoads = new Set();
      trafficRecords.forEach(record => {
        const roadName = record?.road_name || record?.roadName || '';
        const lat = Number(
          record?.latitude ??
          record?.lat ??
          record?.center_latitude ??
          record?.start_latitude ??
          record?.location?.lat
        );
        const lng = Number(
          record?.longitude ??
          record?.lng ??
          record?.center_longitude ??
          record?.start_longitude ??
          record?.location?.lng
        );

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          if (roadName) {
            missingRoads.add(roadName);
          }
        }
      });

      if (missingRoads.size > 0) {
        const fallbackResults = await Promise.all(
          Array.from(missingRoads).map(async (road) => {
            const coord = await getFallbackRoadCoordinate(road);
            return [road, coord];
          })
        );
        const fallbackMap = new Map(
          fallbackResults.filter(([, coord]) => coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng))
        );

        trafficRecords = trafficRecords.map(record => {
          const roadName = record?.road_name || record?.roadName || '';
          const lat = Number(
            record?.latitude ??
            record?.lat ??
            record?.center_latitude ??
            record?.start_latitude ??
            record?.location?.lat
          );
          const lng = Number(
            record?.longitude ??
            record?.lng ??
            record?.center_longitude ??
            record?.start_longitude ??
            record?.location?.lng
          );
          if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && fallbackMap.has(roadName)) {
            const fallbackCoord = fallbackMap.get(roadName);
            return {
              ...record,
              latitude: fallbackCoord.lat,
              longitude: fallbackCoord.lng
            };
          }
          return record;
        });
      }

      // Apply rule-based filtering if enabled
      let recordsForHeatmap = trafficRecords;
      if (ruleHeatmapEnabled) {
        const mapInstanceForBounds = mapRef.current;
        const boundsForFilter = mapInstanceForBounds?.getBounds?.() || null;
        // Time filter
        recordsForHeatmap = filterByTimeOption(recordsForHeatmap, ruleTimeFilter);
        // Location filter
        recordsForHeatmap = filterByLocationOption(recordsForHeatmap, ruleLocationFilter, {
          bounds: boundsForFilter,
          center: mapCenter,
          radiusKm: ruleRadiusKm,
          defaultBounds
        });
      }

      let points;
      if (ruleHeatmapEnabled) {
        const criticalScores = computeCriticalScores(recordsForHeatmap, ruleCriticalThreshold, ruleMinOccurrences);
        points = buildRuleHeatmapPoints(recordsForHeatmap, {
          majorOnly: ruleMajorRoadsOnly,
          criticalScores
        });
        // If no points under rules, fallback to broader include
        if (points.length === 0 && recordsForHeatmap.length > 0) {
          const criticalScores2 = computeCriticalScores(recordsForHeatmap, Math.max(50, ruleCriticalThreshold - 20), Math.max(1, ruleMinOccurrences - 1));
          points = buildRuleHeatmapPoints(recordsForHeatmap, {
            majorOnly: false,
            criticalScores: criticalScores2
          });
        }
      } else {
        points = trafficRecordsToHeatmapPoints(recordsForHeatmap);
        if (points.length === 0 && recordsForHeatmap.length > 0) {
          points = trafficRecordsToHeatmapPoints(recordsForHeatmap, { includeAll: true });
        }
      }
      // Apply category filter (green/yellow/red) when rules are enabled
      if (ruleHeatmapEnabled) {
        points = filterPointsByCategories(points, {
          showGreen: ruleShowGreen,
          showYellow: ruleShowYellow,
          showRed: ruleShowRed
        });
      }

      if (points.length === 0 && fetchState.cache.length > 0) {
        fetchState.lastFetched = Date.now();
        setHeatmapData(fetchState.cache);
      } else {
        fetchState.cache = points;
        fetchState.lastFetched = Date.now();
        setHeatmapData(points);
      }
    } catch (error) {
      console.warn('Failed to load traffic heatmap data:', error?.message || error);
      if (heatmapFetchStateRef.current.cache.length > 0) {
        setHeatmapData(heatmapFetchStateRef.current.cache);
      }
    } finally {
      heatmapFetchStateRef.current.inFlight = false;
    }
  }, [
    heatmapEnabled,
    defaultBounds.lat_min,
    defaultBounds.lat_max,
    defaultBounds.lng_min,
    defaultBounds.lng_max,
    ruleHeatmapEnabled,
    ruleTimeFilter,
    ruleLocationFilter,
    ruleRadiusKm,
    ruleMajorRoadsOnly,
    ruleCriticalThreshold,
    ruleMinOccurrences,
    mapCenter,
    ruleShowGreen,
    ruleShowYellow,
    ruleShowRed
  ]);

  useEffect(() => {
    if (legacyHeatmapDisabled) return;
    if (!heatmapEnabled) {
      setHeatmapData([]);
      return;
    }
    fetchMajorRoadHeatmap();
    const interval = setInterval(fetchMajorRoadHeatmap, 120000);
    return () => clearInterval(interval);
  }, [heatmapEnabled, fetchMajorRoadHeatmap, legacyHeatmapDisabled]);

  useEffect(() => {
    if (legacyHeatmapDisabled) return;
    if (!heatmapEnabled) return;
    if (lastMapEventTypeRef.current === 'zoom') return;
    fetchMajorRoadHeatmap();
  }, [mapCenter, mapZoom, heatmapEnabled, fetchMajorRoadHeatmap, legacyHeatmapDisabled]);

  // ===== NEW: Real-time TomTom Traffic Heatmap (Flow + Incidents) =====
  // Map incident severity/type to heat intensity
  const deriveIncidentIntensity = useCallback((incident) => {
    const severity = String(incident?.severity || '').toLowerCase();
    const type = String(incident?.type || incident?.incident_type || '').toLowerCase();
    const baseBySeverity = {
      low: 0.35,
      medium: 0.55,
      high: 0.82,
      critical: 0.92
    };
    let intensity = baseBySeverity[severity] ?? 0.5;
    if (type.includes('jam') || type.includes('congestion') || type.includes('closure')) {
      intensity = Math.max(intensity, 0.8);
    } else if (type.includes('accident') || type.includes('crash')) {
      intensity = Math.max(intensity, 0.75);
    } else if (type.includes('roadwork') || type.includes('hazard')) {
      intensity = Math.max(intensity, 0.6);
    }
    return clamp01(intensity, 0.1, 1);
  }, []);

  // Convert flow records (flowSegmentData or monitoring) to heatmap points
  const flowToHeatmapPoints = useCallback((flowRecords = []) => {
    const points = [];
    const pushPoint = (lat, lng, intensity) => {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push([lat, lng, clamp01(intensity, 0.05, 1)]);
      }
    };
    flowRecords.forEach((rec) => {
      const fsd = rec?.flowSegmentData || rec?.data?.flowSegmentData;
      if (fsd) {
        const currentSpeed = Number(fsd.currentSpeed);
        const freeFlowSpeed = Number(fsd.freeFlowSpeed);
        let intensity = 0.3;
        if (Number.isFinite(currentSpeed) && Number.isFinite(freeFlowSpeed) && freeFlowSpeed > 0) {
          intensity = clamp01(1 - currentSpeed / freeFlowSpeed, 0.1, 0.98);
        }
        const coordsList = fsd?.coordinates?.coordinate;
        if (Array.isArray(coordsList) && coordsList.length) {
          coordsList.forEach(c => {
            const lat = Number(c.latitude ?? c.lat);
            const lng = Number(c.longitude ?? c.lng ?? c.lon);
            pushPoint(lat, lng, intensity);
          });
          return;
        }
        const lat = Number(rec.latitude ?? rec.lat);
        const lng = Number(rec.longitude ?? rec.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          pushPoint(lat, lng, intensity);
        }
        return;
      }
      const lat = Number(
        rec?.latitude ?? rec?.lat ?? rec?.center_latitude ?? rec?.start_latitude ?? rec?.location?.lat
      );
      const lng = Number(
        rec?.longitude ?? rec?.lng ?? rec?.center_longitude ?? rec?.start_longitude ?? rec?.location?.lng
      );
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const intensity = clamp01(deriveHeatIntensity(rec), 0.05, 1);
      pushPoint(lat, lng, intensity);
    });
    return points;
  }, []);

  // Convert incidents to heatmap points
  const incidentsToHeatmapPoints = useCallback((incidents = []) => {
    const points = [];
    incidents.forEach((i) => {
      const lat = Number(i.latitude ?? i.lat ?? i.location?.lat);
      const lng = Number(i.longitude ?? i.lng ?? i.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const intensity = deriveIncidentIntensity(i);
      const jitter = 0.00025;
      const jlat = lat + (Math.random() - 0.5) * jitter;
      const jlng = lng + (Math.random() - 0.5) * jitter;
      points.push([jlat, jlng, intensity]);
    });
    return points;
  }, [deriveIncidentIntensity]);

  // Aggregate nearby points to reduce overdraw and memory footprint
  const binHeatmapPoints = useCallback((points, bucketDegrees = 0.0001) => {
    if (!Array.isArray(points) || points.length === 0) return [];
    const buckets = new Map();
    const toKey = (lat, lng) => {
      const la = Math.round(lat / bucketDegrees);
      const ln = Math.round(lng / bucketDegrees);
      return `${la}_${ln}`;
    };
    for (const p of points) {
      const [lat, lng, intensity] = p;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // Drop very low intensity to keep map clean, but keep enough range for free-flow greens
      if (!Number.isFinite(intensity) || intensity < 0.08) continue;
      const key = toKey(lat, lng);
      const entry = buckets.get(key);
      if (!entry) {
        buckets.set(key, { lat, lng, intensityMax: intensity, intensitySum: intensity, count: 1 });
      } else {
        // Keep max to preserve hotspots, also track sum/count for optional averaging
        if (intensity > entry.intensityMax) entry.intensityMax = intensity;
        entry.intensitySum += intensity;
        entry.count += 1;
      }
    }
    // Use max intensity to keep edges crisp, with optional slight average weighting
    const out = [];
    buckets.forEach(({ lat, lng, intensityMax, intensitySum, count }) => {
      const avg = intensitySum / count;
      // Blend 80% max with 20% average
      const blended = clamp01(intensityMax * 0.8 + avg * 0.2, 0.05, 1);
      out.push([lat, lng, blended]);
    });
    // Hard cap: if still too many, sample uniformly
    const MAX_POINTS = 1500;
    if (out.length > MAX_POINTS) {
      const step = Math.ceil(out.length / MAX_POINTS);
      return out.filter((_, idx) => idx % step === 0);
    }
    return out;
  }, []);

  // Fetch TomTom Flow + Incidents and unify as heatmap points
  const fetchTomTomHeatmap = useCallback(async () => {
    // Simple debounce to avoid refetching too often on map move/zoom
    const now = Date.now();
    const fetchState = ttHeatmapFetchStateRef.current;
    if (fetchState.inFlight) return;
    if (now - fetchState.lastFetched < 2000) return;
    fetchState.inFlight = true;
    setIsLoadingTtHeatmap(true);
    try {
      const mapInstance = mapRef.current;
      // Capture static bounds once and reuse for all subsequent requests (pan/zoom safe)
      if (!ttStaticBoundsRef.current) {
        const b = mapInstance?.getBounds?.();
        ttStaticBoundsRef.current = b
          ? {
              minLat: b.getSouth(),
              maxLat: b.getNorth(),
              minLng: b.getWest(),
              maxLng: b.getEast()
            }
          : {
              minLat: defaultBounds.lat_min,
              maxLat: defaultBounds.lat_max,
              minLng: defaultBounds.lng_min,
              maxLng: defaultBounds.lng_max
            };
      }
      const requestBounds = ttStaticBoundsRef.current;

      // Decide base URL: use Vite proxy in dev to bypass CORS, direct in prod
      const isLocal = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)/.test(window.location.hostname);
      const tomtomBase = isLocal ? '/tomtom' : 'https://api.tomtom.com';
      const hereBase = isLocal ? '/here' : 'https://traffic.ls.hereapi.com';

      // ======== FIRST: Try backend-cached heatmap (reduces TomTom/HERE quota usage) ========
      try {
        const cached = await trafficService.getTrafficHeatmap({
          lat_min: requestBounds.minLat,
          lat_max: requestBounds.maxLat,
          lng_min: requestBounds.minLng,
          lng_max: requestBounds.maxLng,
          ttl_sec: 600 // request cache freshness up to 10 minutes if backend supports it
        });
        const cachedPoints = Array.isArray(cached?.heatmap_data) ? cached.heatmap_data : (Array.isArray(cached) ? cached : []);
        if (cachedPoints.length > 0) {
          fetchState.cache = cachedPoints;
          setTtHeatmapPoints(cachedPoints);
          setTtTrafficSource('CACHE');
          try { console.info('[Traffic] Using backend cached heatmap', { points: cachedPoints.length }); } catch (_) {}
          return;
        }
      } catch (_) {
        // ignore cache errors and continue
      }

      // ======== PRIMARY: HERE Traffic (Flow + Incidents) ========
      try {
        // Respect HERE rate-limit backoff
        const nowMs = Date.now();
        if (hereFetchStateRef.current.backoffUntil && nowMs < hereFetchStateRef.current.backoffUntil) {
          throw new Error('HERE_BACKOFF_ACTIVE');
        }
        const HERE_KEY = import.meta.env.VITE_HERE_API_KEY || import.meta.env.VITE_HERE_APIKEY;
        if (HERE_KEY) {
          // HERE v6.3 Flow & Incidents with bbox
          const hereBbox = `${requestBounds.minLat},${requestBounds.minLng};${requestBounds.maxLat},${requestBounds.maxLng}`;
          const hereFlowUrl = `${hereBase}/traffic/6.3/flow.json?apiKey=${encodeURIComponent(HERE_KEY)}&bbox=${hereBbox}&responseattributes=sh,fc`;
          const hereIncUrl = `${hereBase}/traffic/6.3/incidents.json?apiKey=${encodeURIComponent(HERE_KEY)}&bbox=${hereBbox}`;
          // Fetch sequentially to reduce QPS: flow first, incidents conditionally
          const flowRes = await fetch(hereFlowUrl).catch(() => null);
          let hereFlowPoints = [];
          if (flowRes && flowRes.ok) {
            const flowJson = await flowRes.json().catch(() => null);
            const rws = flowJson?.RWS || [];
            rws.forEach(rwObj => {
              const rwsArr = rwObj?.RW || [];
              rwsArr.forEach(r => {
                const fis = r?.FIS || [];
                fis.forEach(fisObj => {
                  const fiArr = fisObj?.FI || [];
                  fiArr.forEach(fi => {
                    const cfs = fi?.CF || [];
                    let currentSpeed = null;
                    let freeFlow = null;
                    let jamFactor = null;
                    cfs.forEach(cf => {
                      if (cf?.SU != null && cf?.FF != null) {
                        currentSpeed = Number(cf.SU);
                        freeFlow = Number(cf.FF);
                      }
                      if (cf?.JF != null) {
                        jamFactor = Number(cf.JF);
                      }
                    });
                    // Derive intensity primarily from HERE jamFactor (0–10),
                    // falling back to speed ratio when jamFactor is missing.
                    let intensity = 0.3;
                    if (Number.isFinite(jamFactor)) {
                      // Normalize jamFactor to 0–1 so it can drive the green/yellow/red palette.
                      intensity = clamp01(jamFactor / 10, 0.05, 1);
                    } else if (Number.isFinite(currentSpeed) && Number.isFinite(freeFlow) && freeFlow > 0) {
                      intensity = clamp01(1 - currentSpeed / freeFlow, 0.1, 0.95);
                    }
                    const scaled = clamp01(intensity, 0.05, 0.95);
                    const shapes = fi?.SHP || [];
                    shapes.forEach(s => {
                      const values = s?.value || [];
                      values.forEach(v => {
                        const pairs = String(v).trim().split(' ');
                        pairs.forEach(pair => {
                          const [latStr, lonStr] = pair.split(',') || [];
                          const lat = Number(latStr);
                          const lng = Number(lonStr);
                          if (Number.isFinite(lat) && Number.isFinite(lng)) {
                            hereFlowPoints.push([lat, lng, scaled]);
                          }
                        });
                      });
                    });
                  });
                });
              });
            });
          }
          let hereIncidentPoints = [];
          // Throttle incidents: fetch at most every 30 minutes
          const INCIDENT_TTL = 1800000;
          const canFetchIncidents = nowMs - (hereFetchStateRef.current.lastIncidentsFetched || 0) >= INCIDENT_TTL;
          if (canFetchIncidents) {
            // Small delay to avoid bursting QPS
            await new Promise(r => setTimeout(r, 300));
            const incRes = await fetch(hereIncUrl).catch(() => null);
            if (incRes) {
              if (incRes.ok) {
                const incJson = await incRes.json().catch(() => null);
                const items = incJson?.TRAFFICITEMS?.TRAFFICITEM || [];
                items.forEach(item => {
                  const intensity = clamp01(deriveIncidentIntensity({
                    type: item?.TRAFFICITEMTYPEDESC,
                    severity: item?.CRITICALITY
                  }) * 0.6, 0.05, 0.85);
                  const pl = item?.LOCATION?.POLYLINE || item?.POLYLINE || item?.GEOLOC?.POLYLINE;
                  const polylineArray = Array.isArray(pl) ? pl : [];
                  if (polylineArray.length > 0) {
                    polylineArray.forEach(p => {
                      const str = p?.value || p?.DESCRIPTION || p;
                      const coordsStr = Array.isArray(str) ? str[0] : str;
                      const pairs = String(coordsStr || '').trim().split(' ');
                      pairs.forEach(pair => {
                        const [latStr, lonStr] = pair.split(',') || [];
                        const lat = Number(latStr);
                        const lng = Number(lonStr);
                        if (Number.isFinite(lat) && Number.isFinite(lng)) {
                          hereIncidentPoints.push([lat, lng, intensity]);
                        }
                      });
                    });
                  } else {
                    const origin = item?.LOCATION?.GEOLOC?.ORIGIN;
                    const to = item?.LOCATION?.GEOLOC?.TO;
                    const candidates = [];
                    if (origin) candidates.push(origin);
                    if (to) candidates.push(to);
                    candidates.forEach(pt => {
                      const lat = Number(pt?.LATITUDE ?? pt?.latitude);
                      const lng = Number(pt?.LONGITUDE ?? pt?.longitude);
                      if (Number.isFinite(lat) && Number.isFinite(lng)) {
                        hereIncidentPoints.push([lat, lng, intensity]);
                      }
                    });
                  }
                });
                hereFetchStateRef.current.lastIncidentsFetched = nowMs;
              } else if (incRes.status === 429) {
                // Back off for 15 minutes on rate limit
                hereFetchStateRef.current.backoffUntil = nowMs + 15 * 60 * 1000;
              }
            }
          }
          const hereCombined = binHeatmapPoints([...hereFlowPoints, ...hereIncidentPoints]);
          if (hereCombined.length > 0) {
            fetchState.cache = hereCombined;
            setTtHeatmapPoints(hereCombined);
            return; // Use HERE data successfully; skip TomTom fallback
          }
        }
      } catch (_) {
        // Ignore and fallback to TomTom
      }

      // ======== FALLBACK: TomTom Traffic (existing logic) ========
      // Use user's TomTom API key directly (no backend)
      const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY;
      if (!TOMTOM_KEY) {
        setIsLoadingTtHeatmap(false);
        return;
      }

      // Fetch Flow by sampling a grid of points across current bounds (adaptive by zoom)
      // Use a fixed sampling density to keep requests stable regardless of zoom/pan
      const grid = 6;
      const rows = grid;
      const cols = grid;
      const latStep = (requestBounds.maxLat - requestBounds.minLat) / (rows + 1);
      const lngStep = (requestBounds.maxLng - requestBounds.minLng) / (cols + 1);
      const samplePoints = [];
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          samplePoints.push({
            lat: requestBounds.minLat + r * latStep,
            lng: requestBounds.minLng + c * lngStep
          });
        }
      }

      // Limit concurrent fetches to avoid rate limits
      const chunks = (arr, n) => arr.reduce((acc, _, i) => (i % n ? acc : [...acc, arr.slice(i, i + n)]), []);
      const sampleChunks = chunks(samplePoints, 6);

      const flowSegments = [];
      for (const chunk of sampleChunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (p) => {
            // TomTom Flow Segment Data v4 endpoint
            const url = `${tomtomBase}/traffic/services/4/flowSegmentData/absolute/10/json?key=${encodeURIComponent(TOMTOM_KEY)}&point=${p.lat},${p.lng}&unit=KMPH`;
            try {
              const res = await fetch(url);
              if (!res.ok) return null;
              const data = await res.json();
              return data?.flowSegmentData ? data : null;
            } catch {
              return null;
            }
          })
        );
        chunkResults.forEach((cr) => cr && flowSegments.push(cr));
        // Small delay between batches
        await new Promise((r) => setTimeout(r, 120));
      }

      // Build heatmap points from flow segments along the road geometry
      const flowPoints = [];
      flowSegments.forEach((seg) => {
        const fsd = seg.flowSegmentData;
        if (!fsd) return;
        const currentSpeed = Number(fsd.currentSpeed);
        const freeFlowSpeed = Number(fsd.freeFlowSpeed);
        let intensity = 0.3;
        if (Number.isFinite(currentSpeed) && Number.isFinite(freeFlowSpeed) && freeFlowSpeed > 0) {
          intensity = clamp01(1 - currentSpeed / freeFlowSpeed, 0.1, 0.98);
        }
        // Soften intensity to avoid over-saturated reds
        const scaledIntensity = clamp01(intensity * 0.6, 0.05, 0.85);
        const coordsList = fsd?.coordinates?.coordinate || [];
        // Densify by iterating over each coordinate on the segment (already snapped to road)
        coordsList.forEach((c) => {
          const lat = Number(c.latitude ?? c.lat);
          const lng = Number(c.longitude ?? c.lng ?? c.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            flowPoints.push([lat, lng, scaledIntensity]);
          }
        });
      });

      // Fetch Incidents for bbox
      // TomTom Incident Details v4 (s3 flavor) requires bbox as lat1,lon1,lat2,lon2
      const bbox = `${requestBounds.minLat},${requestBounds.minLng},${requestBounds.maxLat},${requestBounds.maxLng}`;
      const incidentsUrl = `${tomtomBase}/traffic/services/4/incidentDetails/s3/${bbox}/json?key=${encodeURIComponent(TOMTOM_KEY)}`;
      let incidentPoints = [];
      try {
        const nowMs = Date.now();
        // Respect TomTom incidents TTL/backoff (reduce 400/429 noise)
        const TOMTOM_INCIDENT_TTL = 10 * 60 * 1000; // 10 minutes
        const state = ttHeatmapFetchStateRef.current;
        if (state.tomtomIncidentsBackoffUntil && nowMs < state.tomtomIncidentsBackoffUntil) {
          // In backoff period; skip incidents
        } else if (nowMs - (state.lastTomTomIncidentsFetched || 0) >= TOMTOM_INCIDENT_TTL) {
          const resp = await fetch(incidentsUrl);
          if (resp.ok) {
            const json = await resp.json();
            const incidents = Array.isArray(json?.incidents) ? json.incidents : (Array.isArray(json?.result) ? json.result : []);
            incidents.forEach((i) => {
              const intensity = clamp01(deriveIncidentIntensity(i) * 0.6, 0.05, 0.85);
              const geom = i?.geometry;
              if (Array.isArray(geom) && geom.length) {
                geom.forEach((pt) => {
                  const lat = Number(pt?.latitude ?? pt?.lat);
                  const lng = Number(pt?.longitude ?? pt?.lon ?? pt?.lng);
                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    incidentPoints.push([lat, lng, intensity]);
                  }
                });
              } else {
                const lat = Number(i?.latitude ?? i?.lat);
                const lng = Number(i?.longitude ?? i?.lon ?? i?.lng);
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                  incidentPoints.push([lat, lng, intensity]);
                }
              }
            });
            state.lastTomTomIncidentsFetched = nowMs;
          } else {
            // On 400/429, back off further
            if (resp.status === 400 || resp.status === 429) {
              state.tomtomIncidentsBackoffUntil = nowMs + 20 * 60 * 1000; // 20 minutes
            }
          }
        }
      } catch {
        // ignore
      }

      // Aggregate and compact points
      const combined = binHeatmapPoints([...flowPoints, ...incidentPoints]);
      if (combined.length === 0 && fetchState.cache.length > 0) {
        setTtHeatmapPoints(fetchState.cache);
      } else {
        fetchState.cache = combined;
        setTtHeatmapPoints(combined);
      }
    } catch (_) {
      // keep previous points on failure
    } finally {
      ttHeatmapFetchStateRef.current.lastFetched = Date.now();
      ttHeatmapFetchStateRef.current.inFlight = false;
      setIsLoadingTtHeatmap(false);
    }
  }, [
    defaultBounds.lat_min,
    defaultBounds.lat_max,
    defaultBounds.lng_min,
    defaultBounds.lng_max,
    flowToHeatmapPoints,
    incidentsToHeatmapPoints,
    binHeatmapPoints
  ]);

  // Auto refresh loop (independent of toggle)
  useEffect(() => {
    // Initial fetch on mount
    fetchTomTomHeatmap();
    // Refresh every 10 minutes
    ttHeatmapIntervalRef.current = setInterval(fetchTomTomHeatmap, 600000);
    return () => {
      if (ttHeatmapIntervalRef.current) {
        clearInterval(ttHeatmapIntervalRef.current);
        ttHeatmapIntervalRef.current = null;
      }
    };
  }, []);

  // Disable re-fetch on pan/zoom (heatmap remains stable; timer handles refresh)
  useEffect(() => {
    // no-op: intentionally do not refetch on pan/zoom
  }, [mapCenter, mapZoom, ttHeatmapEnabled]);
  // ===== END NEW heatmap =====

  // Open/close traffic monitoring panel when toggle changes
  // But don't open if Active Incidents Panel is open
  useEffect(() => {
    if (trafficMonitorNewEnabled && !showActiveIncidentsPanel) {
      // Only open Traffic Monitoring Panel if Active Incidents Panel is not open
      setShowTrafficMonitoringPanel(true);
    } else if (!trafficMonitorNewEnabled) {
      setShowTrafficMonitoringPanel(false);
    } else if (showActiveIncidentsPanel) {
      // If Active Incidents Panel is open, ensure Traffic Monitoring Panel is closed
      setShowTrafficMonitoringPanel(false);
    }
  }, [trafficMonitorNewEnabled, showActiveIncidentsPanel]);

  // Auto-hide sidebar when Traffic Monitoring Panel is open
  useEffect(() => {
    if (showTrafficMonitoringPanel) {
      setShowSidePanel(false);
    }
  }, [showTrafficMonitoringPanel]);

  // Auto-hide sidebar when Traffic Predictions Panel is open
  useEffect(() => {
    if (showPredictionsPanel) {
      setShowSidePanel(false);
    }
  }, [showPredictionsPanel]);

  // Driver.js Tour - Initialize for new users (works for both logged-in and guest mode)
  useEffect(() => {
    // Wait a bit for the DOM to be fully rendered
    const timer = setTimeout(() => {
      // Check if user is new (hasn't completed tour)
      if (isNewUser()) {
        try {
          // Get tour steps
          const tourSteps = getTrafficMapTourSteps();
          
          // Convert string selectors to DOM elements and filter out invalid steps
          const validSteps = tourSteps.map(step => {
            if (typeof step.element === 'string') {
              const element = document.querySelector(step.element);
              if (element) {
                return { ...step, element };
              }
              return null;
            }
            return step.element ? step : null;
          }).filter(step => step !== null);

          if (validSteps.length === 0) {
            console.warn('No valid tour steps found');
            return;
          }

          console.log('Tour steps initialized:', validSteps.length);

          // Store driver instance reference and track current step
          let driverInstanceRef = null;
          let currentStepIndex = 0;
          let stepsRef = validSteps; // Reference to current steps array
          let isInsertingSteps = false; // Flag to prevent multiple step insertions
          let hasInsertedToggles = false; // Flag to track if toggles have been inserted
          
          // Helper to update step index when step changes
          const updateStepIndex = (element) => {
            const index = stepsRef.findIndex(s => {
              if (typeof s.element === 'string') {
                const el = document.querySelector(s.element);
                return el === element;
              }
              return s.element === element;
            });
            if (index >= 0) {
              currentStepIndex = index;
              console.log('Step index updated to:', currentStepIndex, 'of', stepsRef.length - 1);
            } else {
              console.warn('Could not find step index for element:', element);
            }
          };

          // Initialize Driver.js tour
          const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: validSteps,
            // Mobile-friendly configuration
            stagePadding: 10,
            stageRadius: 8,
            popoverOffset: 10,
            onHighlighted: (element, step, options) => {
              // Update our tracked index whenever a step is highlighted
              // Driver.js always provides the driver instance in options.driver
              const driverInstance = options?.driver;
              if (!driverInstance) {
                console.warn('No driver instance in onHighlighted');
                return;
              }
              
              const activeIndex = driverInstance.getActiveIndex?.();
              if (activeIndex !== undefined && activeIndex !== null) {
                currentStepIndex = activeIndex;
                console.log('Step highlighted - updated index to:', currentStepIndex, 'of', stepsRef.length - 1);
                
                // Save progress so user can continue if they accidentally close
                saveTourProgress(activeIndex, stepsRef.length);
              }
            },
            onDestroyStarted: (element, step, options) => {
              // Check if tour was completed or closed early
              // Driver.js always provides the driver instance in options.driver
              const driverInstance = options?.driver;
              if (!driverInstance) {
                console.warn('No driver instance in onDestroyStarted');
                markTourCompleted();
                setShowSidePanel(false);
                return;
              }
              
              const activeIndex = driverInstance.getActiveIndex?.() ?? currentStepIndex;
              const totalSteps = stepsRef.length;
              const isLastStep = activeIndex >= totalSteps - 1;
              
              console.log('Tour destroy started - step:', activeIndex, 'of', totalSteps - 1, 'isLastStep:', isLastStep);
              
              // Close sidebar immediately
              setShowSidePanel(false);
              
              // Force cleanup of tour elements
              const overlay = document.querySelector('.driver-overlay');
              const popover = document.querySelector('.driver-popover');
              const activeElement = document.querySelector('.driver-active-element');
              
              if (overlay) {
                overlay.style.display = 'none';
                overlay.remove();
              }
              if (popover) {
                popover.style.display = 'none';
                popover.remove();
              }
              if (activeElement) {
                activeElement.classList.remove('driver-active-element');
              }
              
              // Additional cleanup after a short delay
              setTimeout(() => {
                document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => {
                  el.remove();
                });
              }, 50);
              
              // If tour was closed early (not on last step), ask if user wants to restart
              if (!isLastStep) {
                setTimeout(() => {
                  // Create a custom notification
                  const notification = document.createElement('div');
                  notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 20px;
                    z-index: 99999;
                    max-width: 350px;
                    animation: slideIn 0.3s ease-out;
                    pointer-events: auto;
                  `;
                  
                  notification.innerHTML = `
                    <style>
                      @keyframes slideIn {
                        from { transform: translateX(400px); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                      }
                    </style>
                    <div style="display: flex; align-items: start; gap: 12px;">
                      <div style="font-size: 24px;">🗺️</div>
                      <div style="flex: 1;">
                        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">Tour Incomplete</h3>
                        <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                          You closed the tour at step ${activeIndex + 1} of ${totalSteps}. Would you like to continue where you left off?
                        </p>
                        <div style="display: flex; gap: 8px;">
                          <button id="continue-tour-btn" type="button" style="
                            flex: 1;
                            padding: 8px 16px;
                            background: linear-gradient(to right, #3b82f6, #2563eb);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 14px;
                            pointer-events: auto;
                            position: relative;
                            z-index: 1;
                          ">Continue Tour</button>
                          <button id="dismiss-tour-btn" type="button" style="
                            flex: 1;
                            padding: 8px 16px;
                            background: #f3f4f6;
                            color: #6b7280;
                            border: none;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 14px;
                            pointer-events: auto;
                            position: relative;
                            z-index: 1;
                          ">No, Thanks</button>
                        </div>
                      </div>
                      <button id="close-notification-btn" style="
                        background: none;
                        border: none;
                        font-size: 20px;
                        color: #9ca3af;
                        cursor: pointer;
                        padding: 0;
                        line-height: 1;
                      ">×</button>
                    </div>
                  `;
                  
                  document.body.appendChild(notification);
                  
                  // Use event delegation on the notification element for reliability
                  const handleNotificationClick = (e) => {
                    const target = e.target;
                    const buttonId = target.id;
                    
                    console.log('Notification click detected:', buttonId);
                    
                    // Handle continue button
                    if (buttonId === 'continue-tour-btn' || target.closest('#continue-tour-btn')) {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Continue Tour button clicked - reloading page');
                      notification.remove();
                      // Reload the page to restart the tour from saved progress
                      window.location.reload();
                      return;
                    }
                    
                    // Handle dismiss button
                    if (buttonId === 'dismiss-tour-btn' || target.closest('#dismiss-tour-btn')) {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Dismiss button clicked');
                      notification.remove();
                      clearTourProgress();
                      markTourCompleted();
                      return;
                    }
                    
                    // Handle close button
                    if (buttonId === 'close-notification-btn' || target.closest('#close-notification-btn')) {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Close button clicked');
                      notification.remove();
                      clearTourProgress();
                      markTourCompleted();
                      return;
                    }
                  };
                  
                  // Attach event listener using event delegation
                  notification.addEventListener('click', handleNotificationClick);
                  
                  // Also attach direct listeners as backup
                  setTimeout(() => {
                    const continueBtn = document.getElementById('continue-tour-btn');
                    const dismissBtn = document.getElementById('dismiss-tour-btn');
                    const closeBtn = document.getElementById('close-notification-btn');
                    
                    if (continueBtn) {
                      continueBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Continue Tour button clicked (direct listener)');
                        notification.remove();
                        window.location.reload();
                      });
                    }
                    
                    if (dismissBtn) {
                      dismissBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Dismiss button clicked (direct listener)');
                        notification.remove();
                        clearTourProgress();
                        markTourCompleted();
                      });
                    }
                    
                    if (closeBtn) {
                      closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Close button clicked (direct listener)');
                        notification.remove();
                        clearTourProgress();
                        markTourCompleted();
                      });
                    }
                  }, 10);
                  
                  // Auto-dismiss after 15 seconds
                  setTimeout(() => {
                    if (notification.parentNode) {
                      notification.remove();
                      clearTourProgress(); // Clear saved progress
                      markTourCompleted(); // Mark as completed if user didn't respond
                    }
                  }, 15000);
                }, 300); // Show notification after cleanup
              } else {
                // Tour was completed normally
                clearTourProgress(); // Clear saved progress
                markTourCompleted();
              }
            },
            onDestroyed: (element, step, options) => {
              // Tour finished - mark as completed (backup in case onDestroyStarted doesn't fire)
              console.log('Tour destroyed - marking as completed (backup)');
              markTourCompleted();
              
              // Close sidebar if it was opened for the tour
              setShowSidePanel(false);
              
              // Force cleanup of any remaining tour elements
              const cleanup = () => {
                document.querySelectorAll('.driver-overlay, .driver-popover, .driver-active-element').forEach(el => {
                  if (el.classList.contains('driver-active-element')) {
                    el.classList.remove('driver-active-element');
                  } else {
                    el.remove();
                  }
                });
              };
              
              // Immediate cleanup
              cleanup();
              
              // Delayed cleanup to catch any stragglers
              setTimeout(cleanup, 100);
            },
            onNextClick: (element, step, options) => {
              // IMPORTANT: When onNextClick is provided, we MUST call driver.moveNext() manually
              // The driver instance is passed in options.driver
              const driverInstance = options?.driver;
              
              if (!driverInstance) {
                console.error('No driver instance available in onNextClick! Options:', options);
                return;
              }
              
              // Get the current step index from Driver.js's internal state
              // Driver.js provides the active index through getActiveIndex()
              const driverActiveIndex = driverInstance.getActiveIndex?.() ?? currentStepIndex;
              
              // Update our tracked index to match Driver.js's state
              if (driverActiveIndex !== undefined && driverActiveIndex !== null) {
                currentStepIndex = driverActiveIndex;
              } else {
                // Fallback: Update step index based on current element (before moving)
                updateStepIndex(element);
              }
              
              console.log('Next button clicked, current step:', currentStepIndex, 'total steps:', stepsRef.length, 'driverInstance:', !!driverInstance, 'driverActiveIndex:', driverActiveIndex);
              
              // If we're already inserting steps, prevent any action
              if (isInsertingSteps) {
                console.log('Steps are being inserted, skipping navigation');
                return;
              }
              
              // Special handling for menu button step (index 1) - open sidebar and insert toggle steps
              // Only do this once
              if (currentStepIndex === 1 && !hasInsertedToggles) {
                isInsertingSteps = true; // Set flag to prevent multiple calls
                hasInsertedToggles = true; // Mark that we've inserted toggles
                console.log('Menu button step - opening sidebar and inserting toggle steps');
                setShowSidePanel(true);
                
                // Wait for sidebar to open, then insert toggle steps and advance
                setTimeout(() => {
                  // Get sidebar toggle steps (excluding User Reports)
                  const sidebarToggleSteps = getSidebarToggleSteps();
                  const toggleValidSteps = sidebarToggleSteps.map(s => {
                    if (typeof s.element === 'string') {
                      const el = document.querySelector(s.element);
                      return el ? { ...s, element: el } : null;
                    }
                    return s.element ? s : null;
                  }).filter(s => s !== null);
                  
                  // Get the remaining steps (search, insights, weather, emergency)
                  const remainingSteps = getTrafficMapTourSteps();
                  const remainingValidSteps = remainingSteps.map(s => {
                    if (typeof s.element === 'string') {
                      const el = document.querySelector(s.element);
                      return el ? { ...s, element: el } : null;
                    }
                    return s.element ? s : null;
                  }).filter(s => s !== null);
                  
                  // Build new steps: welcome, menu, sidebar toggles, then remaining steps
                  const newValidSteps = [
                    ...stepsRef.slice(0, 2), // Keep welcome and menu
                    ...toggleValidSteps, // Add sidebar toggle steps
                    ...remainingValidSteps.slice(2) // Add remaining steps (skip welcome and menu)
                  ];
                  
                  console.log('Inserted toggle steps. Total steps:', newValidSteps.length, 'Toggles:', toggleValidSteps.length);
                  console.log('Step structure:', newValidSteps.map((s, i) => `${i}: ${s.popover?.title || 'unknown'}`));
                  
                  // Check if we have valid toggle steps
                  if (toggleValidSteps.length === 0) {
                    console.warn('No toggle steps found, continuing normally');
                    isInsertingSteps = false; // Reset flag immediately
                    try {
                      driverInstance.moveNext();
                    } catch (error) {
                      console.error('Error moving next (no toggles):', error);
                    }
                    return;
                  }
                  
                  // Update steps reference first
                  stepsRef = newValidSteps;
                  
                  // Important: After setSteps(), Driver.js might reset its position
                  // We need to manually highlight step 1 first, then move to step 2
                  try {
                    // Update the steps
                    driverInstance.setSteps(newValidSteps);
                    console.log('Steps updated, new total:', newValidSteps.length);
                    
                    // Force a refresh - wait for Driver.js to fully process the new steps
                    setTimeout(() => {
                      // Check if we can access the current step
                      // Since we know we were on step 1, and we just updated steps,
                      // we should be able to move to step 2
                      try {
                        console.log('Attempting to navigate to step 2 (first toggle)');
                        
                        // Verify the first toggle element exists
                        const firstToggleEl = toggleValidSteps[0]?.element;
                        if (!firstToggleEl) {
                          console.error('First toggle element not found! Toggle steps:', toggleValidSteps.length);
                          isInsertingSteps = false; // Reset flag
                          return;
                        }
                        
                        console.log('First toggle element found, proceeding with navigation');
                        
                        // After setSteps(), Driver.js resets to step 0
                        // We need to directly drive to step 2 (first toggle)
                        console.log('Directly navigating to step 2 using drive(2)');
                        
                        // First, clear the current highlight to prevent overlapping popovers
                        try {
                          // Remove any existing driver elements
                          const existingPopover = document.querySelector('.driver-popover');
                          const existingOverlay = document.querySelector('.driver-overlay');
                          const existingHighlight = document.querySelector('.driver-active-element');
                          
                          if (existingPopover) {
                            existingPopover.style.display = 'none';
                            existingPopover.remove();
                          }
                          if (existingOverlay) {
                            existingOverlay.style.display = 'none';
                          }
                          if (existingHighlight) {
                            existingHighlight.classList.remove('driver-active-element');
                          }
                        } catch (e) {
                          console.warn('Error clearing existing driver elements:', e);
                        }
                        
                        // Small delay to ensure cleanup is complete
                        setTimeout(() => {
                          // Use drive() to go directly to step index 2
                          // Note: We use drive() instead of moveNext() because after setSteps(),
                          // Driver.js resets its position
                          driverInstance.drive(2);
                        }, 50);
                        
                        // Note: currentStepIndex will be updated automatically by onHighlighted callback
                        console.log('Navigation to step 2 initiated');
                        
                        // Reset flag after navigation completes (accounting for the cleanup delay)
                        setTimeout(() => {
                          isInsertingSteps = false;
                          console.log('Flag reset, navigation complete');
                        }, 150);
                      } catch (error) {
                        console.error('Error in navigation logic:', error);
                        isInsertingSteps = false; // Reset flag on error
                      }
                    }, 400); // Reduced timeout for faster transition
                  } catch (error) {
                    console.error('Error setting new steps:', error);
                    isInsertingSteps = false; // Reset flag on error
                  }
                }, 400); // Reduced timeout for faster response
                return; // Don't call moveNext() here, we'll do it after steps are inserted
              }
              
              // Close sidebar when moving from last toggle to search step
              const firstToggleIndex = 2;
              const numToggles = 5;
              const lastToggleIndex = firstToggleIndex + numToggles - 1; // Index 6 (last toggle)
              const searchStepIndex = lastToggleIndex + 1; // Index 7 (search, first step after toggles)
              
              // If we're on the last toggle (index 6), close sidebar before moving to search (index 7)
              if (currentStepIndex === lastToggleIndex) {
                console.log('Moving from last toggle to search - closing sidebar');
                setShowSidePanel(false);
                // Wait a bit for sidebar to close before moving to search
                setTimeout(() => {
                  try {
                    driverInstance.moveNext();
                  } catch (error) {
                    console.error('Error moving to search step:', error);
                  }
                }, 300);
                return;
              }
              
              // Check if this is the last step (currentStepIndex is 0-indexed, last is length - 1)
              const isLastStep = currentStepIndex >= stepsRef.length - 1;
              
              if (isLastStep) {
                console.log('Last step Done button clicked - marking as completed and destroying');
                markTourCompleted();
                // Destroy the tour
                setTimeout(() => {
                  driverInstance.destroy();
                }, 50);
              } else {
                // Advance to next step - REQUIRED for navigation to work when onNextClick is provided
                console.log('Moving to next step from index', currentStepIndex, 'to', currentStepIndex + 1);
                try {
                  driverInstance.moveNext();
                } catch (error) {
                  console.error('Error calling moveNext:', error);
                }
              }
            },
            onPreviousClick: (element, step, options) => {
              // Allow previous navigation
              const driverInstance = options?.driver;
              if (!driverInstance) {
                console.error('No driver instance available in onPreviousClick!');
                return;
              }
              updateStepIndex(element);
              
              if (driverInstance && currentStepIndex > 0) {
                console.log('Moving to previous step from index', currentStepIndex);
                try {
                  driverInstance.movePrevious();
                } catch (error) {
                  console.error('Error calling movePrevious:', error);
                }
              }
            },
            // Handle when a step is highlighted - track current step index
            onHighlighted: (element, step, options) => {
              // Track the current step by finding it in our stepsRef array
              // Update the index based on the highlighted element
              const newIndex = stepsRef.findIndex(s => {
                if (typeof s.element === 'string') {
                  const el = document.querySelector(s.element);
                  return el === element;
                }
                return s.element === element;
              });
              
              if (newIndex >= 0) {
                currentStepIndex = newIndex;
                console.log('Step highlighted - updated index to:', currentStepIndex, 'of', stepsRef.length - 1);
              } else {
                // If not found, try to update using the helper function
                updateStepIndex(element);
                console.log('Step highlighted - using helper, index:', currentStepIndex, 'of', stepsRef.length - 1);
              }
              
              // Ensure buttons are enabled after a short delay
              setTimeout(() => {
                const footer = document.querySelector('.driver-popover-footer');
                if (!footer) return;
                
                const nextButton = footer.querySelector('.driver-next-btn');
                const prevButton = footer.querySelector('.driver-prev-btn');
                const closeButton = footer.querySelector('.driver-close-btn');
                
                // Enable Next button
                if (nextButton) {
                  nextButton.style.pointerEvents = 'auto';
                  nextButton.style.cursor = 'pointer';
                  nextButton.disabled = false;
                  nextButton.removeAttribute('disabled');
                  // Remove any existing click handlers that might interfere
                  nextButton.onclick = null;
                }
                
                // Enable Previous button
                if (prevButton) {
                  prevButton.style.pointerEvents = 'auto';
                  prevButton.style.cursor = currentStepIndex === 0 ? 'not-allowed' : 'pointer';
                  if (currentStepIndex === 0) {
                    prevButton.disabled = true;
                  } else {
                    prevButton.disabled = false;
                    prevButton.removeAttribute('disabled');
                  }
                }
                
                // Enable Close button
                if (closeButton) {
                  closeButton.style.pointerEvents = 'auto';
                  closeButton.style.cursor = 'pointer';
                }
              }, 150);
              
              // Close sidebar when we reach the search step (first step after toggles)
              // The toggle steps are indices 2-6, search is index 7
              const firstToggleIndex = 2;
              const numToggles = 5;
              const searchStepIndex = firstToggleIndex + numToggles; // Index 7 (search step)
              
              // Close sidebar when we reach the search step (after all toggles are shown)
              if (currentStepIndex === searchStepIndex) {
                console.log('Reached search step - ensuring sidebar is closed');
                setShowSidePanel(false);
              }
            }
          });

          // Store reference for cleanup
          driverInstanceRef = driverObj;
          
          // Check if there's saved progress
          const savedProgress = getTourProgress();
          
          // Start the tour after a short delay to ensure all elements are rendered
          setTimeout(() => {
            if (savedProgress && savedProgress.stepIndex > 0) {
              // Resume from saved step
              console.log('Resuming tour from saved step:', savedProgress.stepIndex);
              driverObj.drive(savedProgress.stepIndex);
            } else {
              // Start from beginning
              driverObj.drive();
            }
          }, 1000);
        } catch (error) {
          console.warn('Failed to initialize tour:', error);
        }
      }
    }, 2000); // Wait 2 seconds for page to fully load

    return () => clearTimeout(timer);
  }, []); // Run only once on mount
  
  // Simulation Completion Modal
  const [showSimulationCompleteModal, setShowSimulationCompleteModal] = useState(false);
  const [simulationCompleteData, setSimulationCompleteData] = useState(null);

  // Load user's personalized data
  useEffect(() => {
    loadUserData();
  }, [user]);

  // Load traffic and heatmap data with 10-minute auto-refresh from TomTom API
  useEffect(() => {
    // REMOVED: Automatic traffic data loading
    // Traffic data now loads only when Insights panel is opened (see useEffect with isMiniOpen dependency)
    // This is for better API management - no unnecessary API calls when Insights is not being viewed
  }, [mapCenter, mapZoom, isSimulating]);

  // Load traffic data for selected route
  useEffect(() => {
    // Skip loading route traffic data during simulation to prevent infinite loops
    if (isSimulating) {
      return;
    }
    
    if (selectedRoute && selectedRoute.route_coordinates) {
      loadRouteTrafficData();
      const interval = setInterval(loadRouteTrafficData, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [selectedRoute, isSimulating]);

  // Auto-calculate route when directions panel opens with both locations set
  useEffect(() => {
    if (showDirectionsPanel && !isLoadingRoute && !isSimulating) {
      // Check if both origin and destination are set with valid coordinates
      if (selectedOrigin && selectedDestination && 
          selectedOrigin.lat && selectedOrigin.lng && 
          selectedDestination.lat && selectedDestination.lng) {
        // Only calculate if no route exists yet
        const hasRoutes = (routeAlternatives && routeAlternatives.length > 0) || 
                         (currentRoute && currentRoute.routes && currentRoute.routes.length > 0);
        
        if (!hasRoutes) {
          // Use a ref to track if we've already triggered calculation for this panel opening
          const timeoutId = setTimeout(() => {
            // Double-check conditions before calculating
            if (selectedOrigin && selectedDestination && 
                selectedOrigin.lat && selectedOrigin.lng && 
                selectedDestination.lat && selectedDestination.lng &&
                !isLoadingRoute && !isSimulating) {
              handleGetRoute({}, selectedOrigin, selectedDestination);
            }
          }, 300);
          return () => clearTimeout(timeoutId);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDirectionsPanel]);

  const loadUserData = async () => {
    if (!user) {
      // Guest mode: no user-specific data
      setTravelHistory([]);
      setFrequentLocations([]);
      setFavoriteRoutes([]);
      setTravelStats(null);
      setMyEmergencyReports([]);
      return;
    }

    try {
      // Load travel history and emergency reports with individual error handling
      const results = await Promise.allSettled([
        travelHistoryService.getTravelHistory({ limit: 20 }).catch(() => []),
        travelHistoryService.getFrequentLocations({ limit: 10 }).catch(() => []),
        travelHistoryService.getFavoriteRoutes().catch(() => []),
        travelHistoryService.getTravelStats().catch(() => null),
        emergencyService.getMyEmergencyReports().catch(() => [])
      ]);

      setTravelHistory(results[0].status === 'fulfilled' ? results[0].value : []);
      setFrequentLocations(results[1].status === 'fulfilled' ? results[1].value : []);
      setFavoriteRoutes(results[2].status === 'fulfilled' ? results[2].value : []);
      setTravelStats(results[3].status === 'fulfilled' ? results[3].value : null);
      
      // Handle emergency reports (can be array or object with emergencies property)
      const emergencyData = results[4].status === 'fulfilled' ? results[4].value : [];
      const emergencyList = Array.isArray(emergencyData) ? emergencyData : (emergencyData.emergencies || []);
      setMyEmergencyReports(emergencyList);
    } catch (error) {
      
      // Gracefully handle missing data - set empty defaults
      setTravelHistory([]);
      setFrequentLocations([]);
      setFavoriteRoutes([]);
      setTravelStats(null);
      setMyEmergencyReports([]);
    }
  };

  const loadTrafficData = async (triggerBackendUpdate = false) => {
    // Don't load traffic data during simulation to prevent loops
    if (isSimulating) {
      return;
    }
    
    setIsLoadingData(true);
    try {
      // Note: Backend update trigger requires admin authentication
      // Skip it for now and fetch directly from TomTom API instead
      // if (triggerBackendUpdate) {
      //   try {
      //     await trafficService.triggerTrafficUpdate();
      //     await new Promise(resolve => setTimeout(resolve, 2000));
      //   } catch (updateError) {
      //     console.warn('Backend traffic update trigger failed:', updateError);
      //   }
      // }
      
      // Fetch real traffic monitoring data from API
      const bounds = mapRef.current?.getBounds();
      let ne, sw;
      
      if (bounds) {
        ne = bounds.getNorthEast();
        sw = bounds.getSouthWest();
      }
      
      const params = {
        limit: 200, // Get up to 200 traffic monitoring records
      };
      
      // Add bounds filtering if available
      if (bounds) {
        params.lat_min = sw.lat;
        params.lat_max = ne.lat;
        params.lng_min = sw.lng;
        params.lng_max = ne.lng;
      }
      
      try {
        // Fetch traffic data directly from TomTom API (bypasses database)
        // This ensures we get the latest real-time data from TomTom
        let realTrafficData = [];
        
        try {
          // Try to fetch directly from TomTom API first (bypasses database)
          // This endpoint fetches fresh data from TomTom API in real-time
          const boundsForApi = bounds ? {
            minLat: sw.lat,
            maxLat: ne.lat,
            minLng: sw.lng,
            maxLng: ne.lng
          } : null;
          
          realTrafficData = await trafficService.getRealtimeTrafficDirect(boundsForApi);
          console.log('✅ Fetched traffic data directly from TomTom API:', realTrafficData?.length || 0, 'records');
        } catch (directApiError) {
          // If endpoint returns 404, server needs to be restarted to load the new endpoint
          // Only show warning once to avoid console spam
          if (directApiError.response?.status === 404) {
            if (!window._directApiWarningShown) {
              console.warn('⚠️ Direct TomTom API endpoint not found. Please restart the backend server to load the new endpoint.');
              console.warn('Falling back to database...');
              window._directApiWarningShown = true;
            }
          } else if (directApiError.message?.includes('timeout') || directApiError.code === 'ECONNABORTED') {
            // Timeout is expected when fetching many monitoring points - don't show as error
            if (!window._timeoutWarningShown) {
              console.warn('⏱️ Request timeout: Fetching data from many monitoring points. Falling back to database...');
              window._timeoutWarningShown = true;
            }
          } else {
            console.warn('Failed to fetch from TomTom API directly:', directApiError.message);
          }
          
          // Fallback to database if direct API call fails
          try {
            realTrafficData = await trafficService.getTrafficMonitoring(params);
            if (realTrafficData?.length > 0) {
              console.log('Fetched traffic data from database (fallback):', realTrafficData.length, 'records');
            }
          } catch (dbError) {
            console.error('Failed to fetch from database as well:', dbError);
            realTrafficData = [];
          }
        }
        
        if (realTrafficData && Array.isArray(realTrafficData) && realTrafficData.length > 0) {
          // Filter to show recent data (today's data preferred, last 24 hours as fallback)
          const filteredData = filterRecentTrafficData(realTrafficData);
          
          console.log('Filtered traffic data:', filteredData.length, 'records');
          
          if (filteredData.length > 0) {
            // Use filtered recent data - ensures we show current traffic conditions
            // The backend should be fetching data from TomTom Traffic Flow API regularly
            setTrafficData(filteredData);
          
            // Also generate heatmap data for visualization if needed
            // Try to get heatmap data for the heatmap layer
            try {
              if (bounds) {
                const ne = bounds.getNorthEast();
                const sw = bounds.getSouthWest();
                const heatmapResponse = await trafficService.getTrafficHeatmap({
                  lat_min: sw.lat,
                  lat_max: ne.lat,
                  lng_min: sw.lng,
                  lng_max: ne.lng
                });
                
                if (heatmapResponse && heatmapResponse.heatmap_data && Array.isArray(heatmapResponse.heatmap_data)) {
                  setHeatmapData(heatmapResponse.heatmap_data);
                } else {
                  // Generate heatmap from traffic data if heatmap endpoint doesn't return data
                  const heatmapFromTraffic = filteredData.map(item => {
                  const intensityFromStatus =
                    item.traffic_status === 'heavy' || item.traffic_status === 'severe' ? 0.8 :
                    item.traffic_status === 'moderate' ? 0.6 :
                    item.traffic_status === 'light' ? 0.4 : 0.2;
                  const pct = typeof item.congestion_percentage === 'number'
                    ? Math.max(0.2, Math.min(1, item.congestion_percentage / 100))
                    : null;
                  return [
                    item.latitude || item.lat,
                    item.longitude || item.lng,
                    pct ?? (item.intensity || intensityFromStatus)
                  ];
                  });
                  setHeatmapData(heatmapFromTraffic);
                }
              } else {
                // Generate heatmap from traffic data
                const heatmapFromTraffic = filteredData.map(item => {
                const intensityFromStatus =
                  item.traffic_status === 'heavy' || item.traffic_status === 'severe' ? 0.8 :
                  item.traffic_status === 'moderate' ? 0.6 :
                  item.traffic_status === 'light' ? 0.4 : 0.2;
                const pct = typeof item.congestion_percentage === 'number'
                  ? Math.max(0.2, Math.min(1, item.congestion_percentage / 100))
                  : null;
                return [
                  item.latitude || item.lat,
                  item.longitude || item.lng,
                  pct ?? (item.intensity || intensityFromStatus)
                ];
                });
                setHeatmapData(heatmapFromTraffic);
              }
            } catch (heatmapError) {
              console.warn('Failed to fetch heatmap data, using traffic data for heatmap:', heatmapError);
              // Generate heatmap from traffic data
              const heatmapFromTraffic = filteredData.map(item => {
              const intensityFromStatus =
                item.traffic_status === 'heavy' || item.traffic_status === 'severe' ? 0.8 :
                item.traffic_status === 'moderate' ? 0.6 :
                item.traffic_status === 'light' ? 0.4 : 0.2;
              const pct = typeof item.congestion_percentage === 'number'
                ? Math.max(0.2, Math.min(1, item.congestion_percentage / 100))
                : null;
              return [
                item.latitude || item.lat,
                item.longitude || item.lng,
                pct ?? (item.intensity || intensityFromStatus)
              ];
            });
            setHeatmapData(heatmapFromTraffic);
          }
          
            return; // Successfully loaded real traffic data
          } else {
            console.warn('No recent traffic data found after filtering. Total records:', realTrafficData.length);
          }
        } else {
          console.warn('No traffic data returned from API');
        }
      } catch (apiError) {
        console.error('Failed to fetch real traffic data:', apiError);
        // Fall through to clear data
      }
      
      // If we get here, no valid traffic data was found
      // Clear traffic data instead of showing stale data
      console.warn('No valid traffic data available. Clearing traffic data.');
      setHeatmapData([]);
      setTrafficData([]);
    } catch (error) {
      console.error('Error loading traffic data:', error);
      // Clear heatmap/traffic to avoid showing stale data
      setHeatmapData([]);
      setTrafficData([]);
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // REMOVED: Traffic data loading useEffect moved after isMiniOpen declaration
  // This useEffect will be re-added after isMiniOpen state is declared
  
  // Load traffic data for selected route
  useEffect(() => {
    // Skip loading route traffic data during simulation to prevent infinite loops
    if (isSimulating) {
      return;
    }
    
    if (selectedRoute && selectedRoute.route_coordinates) {
      loadRouteTrafficData();
      const interval = setInterval(loadRouteTrafficData, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [selectedRoute, isSimulating]);

  // Generate heatmap data that prioritizes major roads & landmarks with randomness
  const generateRoadBasedHeatmapData = (center) => {
    const points = [];
    const centerLat = center[0] || 14.4504;
    const centerLng = center[1] || 121.0170;
    const midLat = (defaultBounds.lat_min + defaultBounds.lat_max) / 2;

    const startLng = defaultBounds.lng_min + 0.002;
    const endLng = defaultBounds.lng_max - 0.002;

    const southmall = landmarks?.['SM Southmall Las Piñas'];
    const cityHall = landmarks?.['Las Piñas City Hall'];
    const colours = landmarks?.['Colours Las Piñas'];
    const hasPreciseCorridor = southmall && cityHall;

    // Helper: add randomized points along a road segment (with gaps and lateral jitter)
    const addSegment = (start, end, baseIntensity = 0.60, density = 36, width = 0.0012, gapChance = 0.2) => {
      for (let i = 0; i <= density; i++) {
        const t = i / density;
        if (Math.random() < gapChance) continue; // create gaps along the segment
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        // Lateral jitter (perpendicular-ish): small random offset in both lat/lng
        const latJ = (Math.random() - 0.5) * width;
        const lngJ = (Math.random() - 0.5) * width * 0.6;
        const intensity = Math.max(0.20, Math.min(0.85, baseIntensity + (Math.random() - 0.5) * 0.15));
        points.push([lat + latJ, lng + lngJ, intensity]);
      }
    };

    // 1) Main corridor: Alabang–Zapote Rd between City Hall and Southmall (precise if available)
    if (hasPreciseCorridor) {
      const west = cityHall.lng < southmall.lng ? cityHall : southmall;
      const east = cityHall.lng < southmall.lng ? southmall : cityHall;
      // Break into multiple short segments to allow randomness and slight curvature
      const segs = 6;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs;
        const t1 = (s + 1) / segs;
        const start = [
          west.lat + (east.lat - west.lat) * t0,
          west.lng + (east.lng - west.lng) * t0
        ];
        const end = [
          west.lat + (east.lat - west.lat) * t1,
          west.lng + (east.lng - west.lng) * t1
        ];
        addSegment(start, end, 0.65, 30 + Math.floor(Math.random() * 12), 0.0010, 0.24);
      }
      // Add two parallel slight offsets to mimic multiple lanes
      const offset = 0.0018;
      addSegment([west.lat + offset, west.lng], [east.lat + offset, east.lng], 0.55, 26, 0.0009, 0.28);
      addSegment([west.lat - offset, west.lng], [east.lat - offset, east.lng], 0.55, 26, 0.0009, 0.28);
    } else {
      // Fallback: gently sloped corridor across bounds
      const slopePerLng = Math.tan((6 * Math.PI) / 180);
      const baseLatAt = (lng) => midLat + slopePerLng * (lng - centerLng);
      const baseStart = [baseLatAt(startLng), startLng];
      const baseEnd = [baseLatAt(endLng), endLng];
      addSegment(baseStart, baseEnd, 0.65, 34, 0.0010, 0.24);
      addSegment([baseStart[0] + 0.0018, startLng], [baseEnd[0] + 0.0018, endLng], 0.55, 26, 0.0009, 0.28);
      addSegment([baseStart[0] - 0.0018, startLng], [baseEnd[0] - 0.0018, endLng], 0.55, 26, 0.0009, 0.28);
    }

    // 2) Secondary major road: Quirino Ave diagonal (approx across NE-SW of bounds)
    const qStart = [midLat + 0.004, startLng + 0.006];
    const qEnd = [midLat - 0.006, endLng - 0.004];
    addSegment(qStart, qEnd, 0.55, 28, 0.0009, 0.28);

    // 3) Secondary major road: CAA/Naga road (lower horizontal)
    const cLat = midLat - 0.010;
    addSegment([cLat, startLng + 0.003], [cLat, endLng - 0.003], 0.50, 24, 0.0009, 0.32);

    // 4) Landmark clusters (dense, round)
    const landmarkPoints = [southmall, cityHall, colours].filter(Boolean);
    landmarkPoints.forEach(({ lat, lng }) => {
      const clusterCount = 60 + Math.floor(Math.random() * 30);
      for (let i = 0; i < clusterCount; i++) {
        const r = Math.random() * 0.0012; // ~120m radius
        const a = Math.random() * Math.PI * 2;
        const pLat = lat + r * Math.cos(a);
        const pLng = lng + r * Math.sin(a);
        const intensity = 0.60 + Math.random() * 0.22;
        points.push([pLat, pLng, intensity]);
      }
    });

    // 5) Small random background points within bounds (light intensity)
    const backgroundCount = 110;
    for (let i = 0; i < backgroundCount; i++) {
      const pLat = defaultBounds.lat_min + Math.random() * (defaultBounds.lat_max - defaultBounds.lat_min);
      const pLng = defaultBounds.lng_min + Math.random() * (defaultBounds.lng_max - defaultBounds.lng_min);
      if (Math.random() < 0.7) continue; // sparser
      points.push([pLat, pLng, 0.18 + Math.random() * 0.18]);
    }

    // Global thinning to avoid overly dense heatmass
    const keepProb = 0.80;
    return points.filter(() => Math.random() < keepProb);
  };

  // Data loading is now handled by useMapData hook - all useEffect hooks removed

  // Load traffic data for the selected route
  const loadRouteTrafficData = async () => {
    // Don't load route traffic data during simulation to prevent loops
    if (isSimulating) {
      return;
    }
    
    if (!selectedRoute || !selectedRoute.route_coordinates) return;

    try {
      const trafficPromises = [];

      // Sample points along the route for traffic data
      const samplePoints = selectedRoute.route_coordinates.filter((_, index) =>
        index % Math.max(1, Math.floor(selectedRoute.route_coordinates.length / 10)) === 0
      );

      // TomTom traffic flow functionality removed - using mock data instead
      for (const [lat, lng] of samplePoints.slice(0, 5)) {
        trafficPromises.push(
          Promise.resolve({
            lat,
            lng,
            data: {
              flowSegmentData: {
                currentSpeed: 30 + Math.random() * 20,
                freeFlowSpeed: 50 + Math.random() * 10
              }
            }
          })
        );
      }

      const trafficResults = await Promise.all(trafficPromises);

      // Process traffic data to determine overall route traffic condition
      const validTrafficData = trafficResults.filter(result => result.data);

      if (validTrafficData.length > 0) {
        const avgCurrentSpeed = validTrafficData.reduce((sum, result) =>
          sum + (result.data.flowSegmentData?.currentSpeed || 0), 0) / validTrafficData.length;

        const avgFreeFlowSpeed = validTrafficData.reduce((sum, result) =>
          sum + (result.data.flowSegmentData?.freeFlowSpeed || 0), 0) / validTrafficData.length;

        const trafficRatio = avgFreeFlowSpeed > 0 ? avgCurrentSpeed / avgFreeFlowSpeed : 1;

        let trafficCondition = 'light';
        if (trafficRatio < 0.5) trafficCondition = 'heavy';
        else if (trafficRatio < 0.8) trafficCondition = 'moderate';

        setRouteTrafficData({
          condition: trafficCondition,
          ratio: trafficRatio,
          avgSpeed: avgCurrentSpeed,
          freeFlowSpeed: avgFreeFlowSpeed,
          samplePoints: validTrafficData.length
        });
      }
    } catch (error) {
      
    }
  };

  // Enhanced search functionality with auto-suggestions (Google Maps style)
  const handleSearch = useCallback(async (query, mode = searchMode) => {
    

    // Show Las Piñas suggestions when field is empty and focused
    if (!query || query.length < 1) {
      setSearchResults([]);
      setShowSearchResults(showSuggestions); // Show suggestions if field is focused
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true); // Show immediately for better UX

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Faster debounce for instant feel (200ms instead of 300ms)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        
        
        // Las Piñas City center coordinates for proximity search
        const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
        
        // Search for locations with enhanced algorithm - automatically shows all variations
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 20, // More results for comprehensive coverage
          countrySet: 'PH',
          center: lasPinasCenter, // Bias towards Las Piñas
          radius: 15000 // 15km radius around Las Piñas
        });

        // Results are already sorted and prioritized by the enhanced algorithm
        // No need for additional filtering as the algorithm handles it
        const allResults = results;

        // Filter and prioritize Las Piñas results (additional local prioritization)
        const lasPinasResults = allResults.filter(result => 
          result.isLocal || // Local database results
          result.address?.municipality?.toLowerCase().includes('las piñas') ||
          result.address?.municipality?.toLowerCase().includes('las pinas') ||
          result.address?.countrySubdivision?.toLowerCase().includes('las piñas') ||
          result.name?.toLowerCase().includes('las pinas') ||
          result.name?.toLowerCase().includes('las piñas')
        );

        const nearbyResults = allResults.filter(result => 
          !lasPinasResults.some(lp => lp.name === result.name) &&
          (result.address?.municipality?.toLowerCase().includes('parañaque') ||
           result.address?.municipality?.toLowerCase().includes('paranaque') ||
           result.address?.municipality?.toLowerCase().includes('muntinlupa') ||
           result.address?.municipality?.toLowerCase().includes('bacoor') ||
           result.address?.municipality?.toLowerCase().includes('cavite'))
        );

        // Add recent searches that match
        const matchingRecent = recentSearches.filter(recent =>
          recent.name.toLowerCase().includes(query.toLowerCase()) ||
          recent.address?.full?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 2);

        // Prioritize: Recent → Las Piñas → Nearby cities
        const combinedResults = [
          ...matchingRecent.map(recent => ({ ...recent, isRecent: true })),
          ...lasPinasResults.slice(0, 8).map(result => ({ ...result, isPriority: true })),
          ...nearbyResults.slice(0, 5)
        ].filter((result, index, self) =>
          index === self.findIndex(r => r.name === result.name)
        );

        
        setSearchResults(combinedResults);
      } catch (error) {
        
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200); // Faster response
  }, [recentSearches, searchMode]);

  // Get current location with reverse geocoding
  const getCurrentLocation = useCallback(async (mode = searchMode) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Try to reverse geocode to get actual place name
          try {
            const results = await enhancedGeocodingService.reverseGeocode(lat, lng);
            
            let location;
            if (results && results.length > 0) {
              // Use the first result with actual place information
              location = {
                lat,
                lng,
                name: results[0].name || results[0].address?.freeformAddress || `Location near ${results[0].address?.municipality || 'here'}`,
                address: results[0].address
              };
            } else {
              // Fallback if reverse geocoding fails
              location = {
                lat,
                lng,
                name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                address: { full: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` }
              };
            }
            
            setCurrentLocation(location);

            const prevOrigin = mode === 'origin' ? selectedOrigin : (selectedOrigin);
            const prevDestination = mode === 'destination' ? selectedDestination : (selectedDestination);

            if (mode === 'origin') {
              setSelectedOrigin(location);
              setOriginQuery(location.name);
              // If destination is already set, trigger route calculation
              if (prevDestination && location.lat && location.lng && prevDestination.lat && prevDestination.lng) {
                if (showDirectionsPanel) {
                  setTimeout(async () => {
                    await handleGetRoute({}, location, prevDestination);
                  }, 100);
                }
              }
            } else {
              setSelectedDestination(location);
              setDestinationQuery(location.name);
              // If origin is already set, trigger route calculation
              if (prevOrigin && location.lat && location.lng && prevOrigin.lat && prevOrigin.lng) {
                if (showDirectionsPanel) {
                  setTimeout(async () => {
                    await handleGetRoute({}, prevOrigin, location);
                  }, 100);
                }
              }
            }
            setShowSearchResults(false);
          } catch (error) {
            
            // Fallback location with coordinates
            const location = {
              lat,
              lng,
              name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
              address: { full: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` }
            };
            
            setCurrentLocation(location);
            const prevOrigin = mode === 'origin' ? selectedOrigin : (selectedOrigin);
            const prevDestination = mode === 'destination' ? selectedDestination : (selectedDestination);

            if (mode === 'origin') {
              setSelectedOrigin(location);
              setOriginQuery(location.name);
              // If destination is already set, trigger route calculation
              if (prevDestination && location.lat && location.lng && prevDestination.lat && prevDestination.lng) {
                if (showDirectionsPanel) {
                  setTimeout(async () => {
                    await handleGetRoute({}, location, prevDestination);
                  }, 100);
                }
              }
            } else {
              setSelectedDestination(location);
              setDestinationQuery(location.name);
              // If origin is already set, trigger route calculation
              if (prevOrigin && location.lat && location.lng && prevOrigin.lat && prevOrigin.lng) {
                if (showDirectionsPanel) {
                  setTimeout(async () => {
                    await handleGetRoute({}, prevOrigin, location);
                  }, 100);
                }
              }
            }
            setShowSearchResults(false);
          }
        },
        (error) => {
          
          alert('Unable to get your current location. Please search for a location manually.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }, [searchMode]);

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trafficMapSearchHistory');
    if (saved) {
      setSearchHistory(JSON.parse(saved));
    }
  }, []);

  // Save search to history
  const saveToHistory = useCallback((location) => {
    const newHistory = [location, ...searchHistory.filter(item => item.name !== location.name)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('trafficMapSearchHistory', JSON.stringify(newHistory));

    // Also update recent searches for immediate display
    setRecentSearches(prev => [location, ...prev.filter(item => item.name !== location.name)].slice(0, 5));
  }, [searchHistory]);

  // Handle search result selection
  const handleLocationSelect = (location) => {
    

    // Save to search history if it's a new search result (not recent)
    if (!location.isRecent) {
      saveToHistory(location);
    }

    // Set the selected location based on current mode
    if (searchMode === 'origin') {
      setSelectedOrigin(location);
      setOriginQuery(location.name || ''); // Set the query to show the selected location name
    } else {
      setSelectedDestination(location);
      setDestinationQuery(location.name || ''); // Set the query to show the selected location name
    }

    // Clear search results
    setShowSearchResults(false);
  };

  // Show place info panel when a place is selected from search
  const handleShowPlaceInfo = (location) => {
    // Extract and validate coordinates
    let lat = location.lat || location.latitude || location.position?.lat || location.position?.latitude;
    let lng = location.lng || location.longitude || location.position?.lng || location.position?.lon || location.position?.longitude;
    
    // Validate coordinates
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates for location:', location);
      lat = mapCenter[0];
      lng = mapCenter[1];
    } else {
      lat = parseFloat(lat);
      lng = parseFloat(lng);
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn('Coordinates out of valid range:', { lat, lng });
        lat = mapCenter[0];
        lng = mapCenter[1];
      }
    }
    
    // Ensure location has all required properties with validated coordinates
    const locationWithDefaults = {
      ...location,
      name: location.name || location.display_name || location.poi?.name || 'Unknown Location',
      lat: lat,
      lng: lng,
      address: location.address || {
        full: location.address?.freeformAddress || location.address?.full || location.name || 'Address not available',
        city: location.address?.municipality || location.address?.city || 'Las Piñas City',
        country: location.address?.country || 'Philippines'
      },
      type: location.type || location.category || 'Location',
      // Preserve position object for compatibility
      position: {
        lat: lat,
        lon: lng
      }
    };

    // Save to search history if it's a new search result
    if (!location.isRecent && !location.isSuggestion) {
      saveToHistory(locationWithDefaults);
    }
    
    // Set the place and show panel
    setSelectedPlace(locationWithDefaults);
    setShowPlaceInfoPanel(true);
    
    // Also set as selectedSearchResult to show pin on map with animation
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      const addressObj = typeof locationWithDefaults.address === 'string' 
        ? { full: locationWithDefaults.address, freeformAddress: locationWithDefaults.address }
        : (locationWithDefaults.address || { full: '', freeformAddress: '' });
      
      setSelectedSearchResult({
        name: locationWithDefaults.name,
        display_name: locationWithDefaults.name,
        address: addressObj,
        lat: lat,
        lng: lng,
        type: locationWithDefaults.type || 'general'
      });
    }
    
    // Close search results and other panels
    setShowSearchResults(false);
    setShowSuggestions(false);
    setShowDirectionsPanel(false);
    setShowSmartRoutePanel(false);
    
    // Center map on selected place with validated coordinates
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      setMapCenter([lat, lng]);
      setMapZoom(17); // Zoom in closer to show the place clearly
      
      // Also update map ref if available - use flyTo for smooth animation
      if (mapRef.current) {
        try {
          mapRef.current.flyTo([lat, lng], 17, {
            duration: 1.0,
            easeLinearity: 0.25
          });
        } catch (err) {
          // Silently fail if map is not ready
        }
      }
    }
  };

  // Handle place info panel actions
  const handlePlaceDirections = async () => {
    if (!selectedPlace) return;
    
    setIsLoadingRoute(true);
    setIsLoadingData(true);
    
    // Set as destination if not already set
    if (!selectedDestination || selectedDestination.name !== selectedPlace.name) {
      setSelectedDestination(selectedPlace);
      setDestinationQuery(selectedPlace.name || '');
    }
    
    // Close place info panel
    setShowPlaceInfoPanel(false);
    
    // Get GPS location automatically with better error handling
    const getGPSLocation = () => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by your browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Validate coordinates
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
              reject(new Error('Invalid GPS coordinates'));
              return;
            }
            
            try {
              const results = await enhancedGeocodingService.reverseGeocode(lat, lng);
              let location;
              if (results && results.length > 0) {
                location = {
                  lat,
                  lng,
                  name: results[0].name || results[0].address?.freeformAddress || `Location near ${results[0].address?.municipality || 'here'}`,
                  address: results[0].address
                };
              } else {
                location = {
                  lat,
                  lng,
                  name: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                  address: { full: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` }
                };
              }
              resolve(location);
            } catch (error) {
              // Even if reverse geocoding fails, use coordinates
              const location = {
                lat,
                lng,
                name: `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                address: { full: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` }
              };
              resolve(location);
            }
          },
          (error) => {
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
      });
    };

    try {
      // Ensure destination is properly set (validate it has coordinates)
      const destination = selectedPlace;
      if (!destination || !destination.lat || !destination.lng) {
        console.error('Invalid destination place:', destination);
        toast.error('Invalid destination. Please try again.');
        setIsLoadingRoute(false);
        setIsLoadingData(false);
        setShowDirectionsPanel(true);
        setDirectionsPanelMinimized(false);
        setNavigationPanelMinimized(false);
        return;
      }

      // Set destination in state (for UI display)
      setSelectedDestination(destination);
      setDestinationQuery(destination.name || '');

      // Get current location
      toast.loading('Getting your current location...', { id: 'get-location' });
      const origin = await getGPSLocation();
      
      // Set origin state (for UI display)
      setSelectedOrigin(origin);
      setOriginQuery(origin.name);
      toast.success('Location found!', { id: 'get-location' });
      
      // Calculate route (TomTom with Geoapify fallback is already built in)
      // Pass origin and destination directly to avoid state timing issues
      toast.loading('Calculating route...', { id: 'calculate-route' });
      
      // Call handleGetRoute with explicit origin and destination
      await handleGetRoute({}, origin, destination);
      
      // Wait for state to update (React state updates are async)
      // Use a small delay to ensure route data is in state before showing panel
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Show directions panel with calculated route
      // The panel will display the route once state is updated
      setShowDirectionsPanel(true);
      setDirectionsPanelMinimized(false);
      setNavigationPanelMinimized(false);
      toast.success('Route calculated!', { id: 'calculate-route' });
    } catch (error) {
      console.warn('Failed to get GPS location or calculate route:', error);
      
      // Show the directions panel even if GPS fails, so user can set origin manually
      setShowDirectionsPanel(true);
      setDirectionsPanelMinimized(false);
      setNavigationPanelMinimized(false);
      
      if (error.message && error.message.includes('Geolocation')) {
        toast.error('Unable to get your current location. Please set an origin manually in the directions panel.', { id: 'get-location' });
      } else {
        toast.error('Route calculation failed. Please try again or set origin manually.', { id: 'calculate-route' });
      }
    } finally {
      setIsLoadingRoute(false);
      setIsLoadingData(false);
    }
  };

  const handlePlaceStart = () => {
    if (!selectedPlace) return;
    if (!selectedDestination || selectedDestination.name !== selectedPlace.name) {
      setSelectedDestination(selectedPlace);
      setDestinationQuery(selectedPlace.name || '');
    }
    setShowPlaceInfoPanel(false);
    // Start navigation if route exists
    if (selectedRoute) {
      startNavigation();
    } else {
      handlePlaceDirections();
    }
  };

  const handlePlaceCall = () => {
    if (selectedPlace?.phone) {
      window.location.href = `tel:${selectedPlace.phone}`;
    }
  };

  const handlePlaceSave = () => {
    // Save to favorites
    if (selectedPlace && user) {
      saveToHistory(selectedPlace);
      toast.success('Place saved to favorites');
    } else if (!user) {
      setShowAuthPrompt(true);
    }
  };

  const handlePlaceShare = async () => {
    if (selectedPlace) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: selectedPlace.name,
            text: `Check out ${selectedPlace.name}`,
            url: window.location.href
          });
        } catch (error) {
          // Fallback: copy to clipboard
          const shareText = `${selectedPlace.name}\n${selectedPlace.address?.full || ''}\n${window.location.href}`;
          navigator.clipboard.writeText(shareText);
          toast.success('Link copied to clipboard');
        }
      } else {
        // Fallback: copy to clipboard
        const shareText = `${selectedPlace.name}\n${selectedPlace.address?.full || ''}\n${window.location.href}`;
        navigator.clipboard.writeText(shareText);
        toast.success('Link copied to clipboard');
      }
    }
  };

  // Direct handlers for EnhancedSearchPanel to avoid relying on parent's searchMode
  const handleOriginSelectDirect = async (location) => {
    if (location) {
      if (!location.isRecent) {
        saveToHistory(location);
      }
      const prevDestination = selectedDestination; // Capture current destination
      setSelectedOrigin(location);
      setOriginQuery(location.name || location.display_name || location.address?.full || location.address?.freeformAddress || '');
      
      // Clear search results when a location is selected
      setSearchResults([]);
      setSelectedSearchResult(null);
      
      // If destination is already set and both have valid coordinates, trigger route calculation
      if (prevDestination && location.lat && location.lng && prevDestination.lat && prevDestination.lng) {
        // Only auto-calculate if directions panel is open
        if (showDirectionsPanel) {
          // Use a small delay to ensure state is updated, but pass locations directly
          setTimeout(async () => {
            await handleGetRoute({}, location, prevDestination);
          }, 100);
        }
      }
    } else {
      // Clear origin and routes when location is cleared
      setSelectedOrigin(null);
      setOriginQuery('');
      // Clear routes when origin is cleared (route is invalid without origin)
      setCurrentRoute(null);
      setSelectedRoute(null);
      setRouteAlternatives([]);
    }
    setShowSearchResults(false);
  };

  const handleDestinationSelectDirect = async (location) => {
    if (location) {
      if (!location.isRecent) {
        saveToHistory(location);
      }
      const prevOrigin = selectedOrigin; // Capture current origin
      setSelectedDestination(location);
      setDestinationQuery(location.name || location.display_name || location.address?.full || location.address?.freeformAddress || '');
      
      // Clear search results when a location is selected
      setSearchResults([]);
      setSelectedSearchResult(null);
      
      // If origin is already set and both have valid coordinates, trigger route calculation
      if (prevOrigin && location.lat && location.lng && prevOrigin.lat && prevOrigin.lng) {
        // Only auto-calculate if directions panel is open
        if (showDirectionsPanel) {
          // Use a small delay to ensure state is updated, but pass locations directly
          setTimeout(async () => {
            await handleGetRoute({}, prevOrigin, location);
          }, 100);
        }
      }
    } else {
      // Clear destination and routes when location is cleared
      setSelectedDestination(null);
      setDestinationQuery('');
      // Clear routes when destination is cleared (route is invalid without destination)
      setCurrentRoute(null);
      setSelectedRoute(null);
      setRouteAlternatives([]);
    }
    setShowSearchResults(false);
  };

  // Swap origin and destination
  const swapLocations = async () => {
    const tempOrigin = selectedOrigin;
    const tempOriginQuery = originQuery;

    setSelectedOrigin(selectedDestination);
    setOriginQuery(destinationQuery);

    setSelectedDestination(tempOrigin);
    setDestinationQuery(tempOriginQuery);

    // Trigger route calculation after swap if both locations are valid
    setTimeout(async () => {
      const newOrigin = selectedDestination;
      const newDestination = tempOrigin;
      if (newOrigin && newDestination && 
          newOrigin.lat && newOrigin.lng && 
          newDestination.lat && newDestination.lng) {
        // Only auto-calculate if directions panel is open
        if (showDirectionsPanel) {
          await handleGetRoute({}, newOrigin, newDestination);
        }
      }
    }, 100);
  };

  // Clear selected locations
  const clearLocations = () => {
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setOriginQuery('');
    setDestinationQuery('');
    setCurrentRoute(null);
    setSelectedRoute(null);
    stopNavigation();
  };

  // Calculate and display route with alternatives
  const handleGetRoute = async (routeOptions = {}, overrideOrigin = null, overrideDestination = null) => {
    // Prevent route calculation during simulation to avoid API call loops
    if (isSimulating) {
      console.log('Route calculation blocked: simulation is active');
      return;
    }

    // Use override parameters if provided, otherwise use state
    const origin = overrideOrigin || selectedOrigin;
    const destination = overrideDestination || selectedDestination;

    if (!origin || !destination) {
      console.warn('Cannot calculate route: origin or destination missing', { origin, destination });
      return;
    }

    // Validate coordinates
    if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      console.warn('Invalid location coordinates:', { origin, destination });
      alert('Invalid location coordinates. Please select valid locations.');
      return;
    }

    setIsLoadingRoute(true);
    setIsLoadingData(true);
    
    try {
      const defaultOptions = {
        avoidTraffic: true,
        maxAlternatives: 3,
        ...routeOptions
      };

      // Calculate route using TomTom API (with Geoapify fallback built in)
      const routeData = await enhancedRoutingService.getDetailedRoute(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        defaultOptions
      );

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        // Validate route data structure and ensure duration/distance are present
        const validRoutes = routeData.routes.map(route => {
          // Ensure route has required properties
          if (!route.route_coordinates || !Array.isArray(route.route_coordinates) || route.route_coordinates.length < 2) {
            return null;
          }
          
          // Ensure duration and distance are set
          if (!route.estimated_duration_minutes && route.summary?.travelTimeInSeconds) {
            route.estimated_duration_minutes = route.summary.travelTimeInSeconds / 60;
          }
          if (!route.distance_km && route.summary?.lengthInMeters) {
            route.distance_km = route.summary.lengthInMeters / 1000;
          }
          
          return route;
        }).filter(route => route !== null);

        if (validRoutes.length === 0) {
          toast.error('No valid routes found. Please try different locations.');
          return;
        }

        const processedRouteData = { ...routeData, routes: validRoutes };
        setCurrentRoute(processedRouteData);

        // Store all route alternatives
        setRouteAlternatives(validRoutes);
        
        // If we got multiple routes, show route selection panel
        if (validRoutes.length > 1) {
          setShowRouteAlternatives(true);
          // Select the recommended route by default
          setSelectedRoute(processedRouteData.recommended_route || validRoutes[0]);
        } else {
          // Single route, select it directly
          setSelectedRoute(processedRouteData.recommended_route || validRoutes[0]);
          setShowRouteAlternatives(false);
        }

        // Center map on route
        if (validRoutes[0].bounds) {
          const southwest = validRoutes[0].bounds.southwest;
          const northeast = validRoutes[0].bounds.northeast;

          if (southwest && northeast && southwest[0] && southwest[1] && northeast[0] && northeast[1]) {
            setMapCenter([
              (southwest[0] + northeast[0]) / 2,
              (southwest[1] + northeast[1]) / 2
            ]);
            setMapZoom(12);
          }
        }
      } else {
        toast.error('No route found. Please check your locations and try again.');
      }
    } catch (error) {
      console.error('Route calculation error:', error);
      toast.error('Error calculating route. Please check your locations and try again.');
      throw error; // Re-throw to allow caller to handle
    } finally {
      setIsLoadingRoute(false);
      setIsLoadingData(false);
    }
  };

  // Select a specific route from alternatives
  const selectRoute = (route) => {
    setSelectedRoute(route);
    setShowRouteAlternatives(false);
    
    // Minimize directions panel when selecting a route option (don't close it)
    if (showDirectionsPanel) {
      setNavigationPanelMinimized(true);
    }
    
    // Center map on the selected route to ensure it's visible
    if (route && route.bounds) {
      const { southwest, northeast } = route.bounds;
      if (southwest && northeast && southwest[0] && southwest[1] && northeast[0] && northeast[1]) {
        setMapCenter([
          (southwest[0] + northeast[0]) / 2,
          (southwest[1] + northeast[1]) / 2
        ]);
        setMapZoom(12);
      }
    } else if (route && route.route_coordinates && Array.isArray(route.route_coordinates) && route.route_coordinates.length > 0) {
      // Fallback: use route coordinates to center map if bounds are not available
      const coords = route.route_coordinates;
      const lats = coords.map(coord => coord[0]).filter(lat => typeof lat === 'number' && !isNaN(lat));
      const lngs = coords.map(coord => coord[1]).filter(lng => typeof lng === 'number' && !isNaN(lng));
      if (lats.length > 0 && lngs.length > 0) {
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        setMapCenter([centerLat, centerLng]);
        setMapZoom(12);
      }
    }
  };

  // Get route with specific criteria
  const getRouteWithCriteria = (criteria) => {
    // Prevent route calculation during simulation to avoid API call loops
    if (isSimulating) {
      console.log('Route calculation with criteria blocked: simulation is active');
      return;
    }

    const routeOptions = {
      fastest: { maxAlternatives: 3 },
      shortest: { maxAlternatives: 3 },
      eco: { travelMode: 'car', maxAlternatives: 2 },
      avoidTolls: { avoidTolls: true, maxAlternatives: 2 }
    };

    handleGetRoute(routeOptions[criteria] || { maxAlternatives: 3 });
    setRouteCriteria(criteria);
  };

  // Start navigation with GPS tracking
  const startNavigation = async () => {
    if (!selectedRoute) return;

    setIsNavigationActive(true);
    setNavigationStep(0);
    setNavigationHUDMinimized(false);
    
    // Enable gyroscope for realistic navigation
    setGyroscopeEnabled(true);
    
    // Request device orientation permission if needed
    if (orientationSupported && !orientationPermission) {
      try {
        await requestOrientationPermission();
      } catch (error) {
        console.warn('Could not enable device orientation:', error);
      }
    }
    
    // Hide route alternatives panel when starting navigation
    setShowRouteAlternatives(false);
    
    // Close directions panel when starting navigation
    setShowDirectionsPanel(false);

    // Keep current map style during navigation (TomTom maps)
    // Removed automatic style switching to maintain user's preferred map style
    // if (mapStyle !== 'light_driving') {
    //   setPreviousMapStyle(mapStyle); // Save current style
    //   setMapStyle('light_driving'); // Switch to light driving theme
    // }

    // Start GPS tracking
    startLocationTracking();

    // Auto-zoom to route starting point (origin) with smooth animation - similar to Google Maps
    if (selectedOrigin && selectedOrigin.lat && selectedOrigin.lng) {
      setTimeout(() => {
        smoothZoomToLocation([selectedOrigin.lat, selectedOrigin.lng], 17);
      }, 300); // Small delay to allow UI to update first
    }

    // Update navigation progress based on real location
    updateNavigationProgress();
  };

  // Stop navigation and GPS tracking
  const stopNavigation = () => {
    setIsNavigationActive(false);
    setNavigationStep(0);
    setNavigationProgress(null);

    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }

    // Keep current map style (no need to restore since we don't change it)
    // Removed automatic style restoration
    // if (mapStyle === 'light_driving' && previousMapStyle !== 'light_driving') {
    //   setMapStyle(previousMapStyle);
    // }

    // Stop GPS tracking
    stopLocationTracking();
    
    // Stop simulation if active
    stopSimulation();

    // Clear all routes when navigation stops
    setSelectedRoute(null);
    setCurrentRoute(null);
    setRouteAlternatives([]);
    setShowRouteAlternatives(false);

    // Clear selected places (origin and destination)
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setSelectedPlace(null);
    setSelectedSearchResult(null);

    // Clear search bar and search history when navigation stops
    setOriginQuery('');
    setDestinationQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setRecentSearches([]);
  };

  // Fully clear current trip: stop navigation/simulation, close panels, clear inputs and routes
  const clearTrip = () => {
    // Stop any active guidance/simulation
    stopNavigation();
    stopSimulation();

    // Reset navigation/simulation UI state
    setIsNavigationActive(false);
    setNavigationStep(0);
    setNavigationPanelMinimized(true);
    setSimulatedLocation(null);
    setSimulationProgress(0);

    // Clear routes and alternatives
    setSelectedRoute(null);
    setCurrentRoute(null);
    setRouteAlternatives([]);
    setShowRouteAlternatives(false);

    // Clear input selections/queries
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setOriginQuery('');
    setDestinationQuery('');

    // Close any related panels
    setShowSmartRoutePanel(false);
  };

  // Use device orientation hook for realistic navigation
  const { 
    heading: deviceHeading, 
    tilt: deviceTilt,
    isSupported: orientationSupported,
    permissionGranted: orientationPermission,
    requestPermission: requestOrientationPermission
  } = useDeviceOrientation(gyroscopeEnabled && isNavigationActive);

  // Use geolocation heading as fallback
  const { 
    heading: gpsHeading, 
    speed: gpsSpeed 
  } = useGeolocationHeading(isNavigationActive);

  // Update heading from device orientation or GPS
  useEffect(() => {
    if (isNavigationActive) {
      // Prefer device orientation heading if available
      if (orientationSupported && orientationPermission && deviceHeading !== 0) {
        setUserHeading(deviceHeading);
        setMapRotation(deviceHeading);
      } 
      // Fallback to GPS heading
      else if (gpsHeading !== 0) {
        setUserHeading(gpsHeading);
        setMapRotation(gpsHeading);
      }
      
      // Update speed from GPS
      if (gpsSpeed > 0) {
        setCurrentSpeed(gpsSpeed);
      }
    }
  }, [deviceHeading, gpsHeading, gpsSpeed, isNavigationActive, orientationSupported, orientationPermission]);

  // Calculate distance to next turn
  useEffect(() => {
    if (isNavigationActive && userLocation && selectedRoute && selectedRoute.steps) {
      const currentStep = selectedRoute.steps[navigationStep];
      if (currentStep && currentStep.start_location) {
        // Calculate distance using Haversine formula
        const R = 6371e3; // Earth's radius in meters
        const lat1 = userLocation.lat * Math.PI / 180;
        const lat2 = currentStep.start_location[0] * Math.PI / 180;
        const deltaLat = (currentStep.start_location[0] - userLocation.lat) * Math.PI / 180;
        const deltaLng = (currentStep.start_location[1] - userLocation.lng) * Math.PI / 180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        setDistanceToNextTurn(distance);
      }
    }
  }, [userLocation, selectedRoute, navigationStep, isNavigationActive]);

  // Start GPS location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      
      return;
    }

    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          heading: position.coords.heading || null,
          speed: position.coords.speed || null
        };

        setUserLocation(location);
        setIsTrackingLocation(true);

        // Update speed
        if (location.speed !== null) {
          setCurrentSpeed(location.speed * 3.6); // Convert m/s to km/h
        }

        // Center map on user location if navigation is active with 3D perspective
        if (isNavigationActive && mapRef.current) {
          // Smooth pan to user location
          mapRef.current.panTo([location.lat, location.lng], {
            animate: true,
            duration: 0.5,
            easeLinearity: 0.25
          });
          
          // Set zoom for navigation view (closer zoom for better detail)
          if (mapRef.current.getZoom() < 17) {
            mapRef.current.setZoom(17);
          }
        }
      },
      (error) => {
        
        setIsTrackingLocation(false);

        // Fallback to simulation if GPS fails
        if (isNavigationActive) {
          simulateNavigationProgress();
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0 // Always get fresh location
      }
    );

    setLocationWatchId(watchId);
  };

  // Stop GPS location tracking
  const stopLocationTracking = () => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }
    setIsTrackingLocation(false);
    setUserLocation(null);
  };

  // Update navigation progress based on real GPS location
  const updateNavigationProgress = () => {
    if (!isNavigationActive || !userLocation || !selectedRoute) return;

    try {
      // Use the enhanced routing service to calculate progress
      const progress = enhancedRoutingService.updateNavigationProgress(
        userLocation.lat,
        userLocation.lng
      );

      if (progress) {
        setNavigationProgress(progress);

        // Update current step based on progress
        const newStep = progress.nextStep ? progress.nextStep.index : 0;
        if (newStep !== navigationStep) {
          setNavigationStep(newStep);
        }
      }
    } catch (error) {
      
    }

    // Continue updating every 5 seconds
    navigationTimeoutRef.current = setTimeout(updateNavigationProgress, 5000);
  };

  // Simulate navigation progress for demo (fallback)
  const simulateNavigationProgress = () => {
    if (selectedRoute.steps && navigationStep < selectedRoute.steps.length - 1) {
      navigationTimeoutRef.current = setTimeout(() => {
        setNavigationStep(prev => prev + 1);
        simulateNavigationProgress();
      }, 5000); // 5 seconds per step for demo
    } else {
      // Navigation complete - use stopNavigation to clear search and clean up
      stopNavigation();
    }
  };

  // Smooth zoom to location animation - similar to Google Maps
  const smoothZoomToLocation = (coordinates, zoomLevel) => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    if (map && map.getZoom) {
      // Use Leaflet's flyTo method for smooth animation
      map.flyTo(
        coordinates,
        zoomLevel,
        {
          animate: true,
          duration: 1.5, // Animation duration in seconds
          easeLinearity: 0.25 // Easing function for smooth animation
        }
      );
    }
  };

  // Save current route as favorite
  const saveAsFavorite = async () => {
    if (!selectedRoute || !selectedOrigin || !selectedDestination) return;

    try {
      if (!user) {
        alert('Sign in to save favorite routes.');
        navigate('/login');
        return;
      }
      await travelHistoryService.saveFavoriteRoute({
        name: `${selectedOrigin.name} to ${selectedDestination.name}`,
        origin: selectedOrigin,
        destination: selectedDestination,
        routeSummary: selectedRoute,
        isDefault: false
      });
      
      // Refresh favorites
      loadUserData();
    } catch (error) {
      
    }
  };

  // Start travel simulation
  const startSimulation = () => {
    if (!selectedRoute || !selectedRoute.route_coordinates || selectedRoute.route_coordinates.length < 2) {
      alert('Please select a valid route first');
      return;
    }

    setIsSimulating(true);
    setSimulationProgress(0);
    setSimulationPaused(false);
    setSimulationStartTime(new Date());
    
    // Close directions panel when starting simulation
    setShowDirectionsPanel(false);
    
    // Close all panels that should be hidden during simulation
    setShowPredictionsPanel(false);
    setShowIncidentModal(false);
    setIsMiniOpen(false); // Close Insights panel
    setShowWeatherAlert(false); // Hide weather alerts during simulation
    
    // Automatically switch to light driving map theme for simulation
    if (mapStyle !== 'light_driving') {
      setPreviousMapStyle(mapStyle); // Save current style
      setMapStyle('light_driving'); // Switch to light driving theme
    }
    
    // Set initial simulated location to origin
    const startCoords = selectedRoute.route_coordinates[0];
    setSimulatedLocation({
      lat: startCoords[0],
      lng: startCoords[1],
      timestamp: Date.now()
    });

    // Center map on starting point (use mapRef to avoid triggering useEffect during simulation)
    if (mapRef.current) {
      try {
        mapRef.current.setView([startCoords[0], startCoords[1]], 16, {
          animate: true
        });
      } catch (err) {
        // Fallback to state if map ref not ready
        setMapCenter([startCoords[0], startCoords[1]]);
        setMapZoom(16);
      }
    } else {
      setMapCenter([startCoords[0], startCoords[1]]);
      setMapZoom(16);
    }

    // Start simulation animation
    runSimulation();
  };

  // Update refs when state changes
  useEffect(() => {
    simulationPausedRef.current = simulationPaused;
  }, [simulationPaused]);

  useEffect(() => {
    simulationSpeedRef.current = simulationSpeed;
  }, [simulationSpeed]);

  // Complete simulation and save to history - MUST be defined before runSimulation
  const completeSimulation = useCallback(async () => {
    // Cancel animation frame
    if (simulationAnimationFrameRef.current) {
      cancelAnimationFrame(simulationAnimationFrameRef.current);
      simulationAnimationFrameRef.current = null;
    }
    
    // Clear interval if it exists (fallback)
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    const endTime = new Date();
    const currentRoute = selectedRoute;
    const currentStartTime = simulationStartTime;
    const currentOrigin = selectedOrigin;
    const currentDestination = selectedDestination;
    const currentUser = user;
    const durationMinutes = currentStartTime 
      ? (endTime - currentStartTime) / 1000 / 60 
      : currentRoute?.estimated_duration_minutes || 0;

    let saveSuccess = false;
    let saveError = null;
    let isAuthError = false;

    // Save to travel history (only if user is logged in)
    if (currentUser && currentOrigin && currentDestination && currentRoute) {
      try {
        await travelHistoryService.saveTravelSession({
          origin: {
            name: currentOrigin.name || 'Unknown Origin',
            lat: currentOrigin.lat,
            lng: currentOrigin.lng,
            address: currentOrigin.address || { full: '' }
          },
          destination: {
            name: currentDestination.name || 'Unknown Destination',
            lat: currentDestination.lat,
            lng: currentDestination.lng,
            address: currentDestination.address || { full: '' }
          },
          routeData: {
            route_id: currentRoute.route_id || 'simulated',
            route_name: currentRoute.route_name || 'Simulated Route',
            distance_km: currentRoute.distance_km || 0,
            estimated_duration_minutes: currentRoute.estimated_duration_minutes || 0
          },
          durationMinutes: durationMinutes,
          distanceKm: currentRoute.distance_km || 0,
          startTime: currentStartTime ? currentStartTime.toISOString() : new Date().toISOString(),
          endTime: endTime.toISOString(),
          travelMode: 'car',
          trafficConditions: currentRoute.traffic_conditions || 'light',
          notes: 'Simulated trip'
        });

        // Refresh travel history
        await loadUserData();
        saveSuccess = true;
      } catch (error) {
        saveError = error.message || 'Unknown error';
        // Check if it's an authentication error
        if (error.response?.status === 401) {
          isAuthError = true;
        }
      }
    }

    // Prepare modal data
    const modalData = {
      saveSuccess,
      saveError,
      isAuthError,
      isGuest: !currentUser,
      durationMinutes: Math.round(durationMinutes),
      distanceKm: currentRoute?.distance_km || 0,
      origin: currentOrigin?.name || 'Unknown Origin',
      destination: currentDestination?.name || 'Unknown Destination',
      trafficConditions: currentRoute?.traffic_conditions || 'light'
    };

    // Reset simulation state
    setIsSimulating(false);
    setSimulationProgress(100);
    setSimulationPaused(false);
    setSimulationMinimized(false);
    setCurrentSimulationIndex(0);
    
    // Restore previous map style when simulation completes (only if navigation is not active)
    if (!isNavigationActive && mapStyle === 'light_driving' && previousMapStyle !== 'light_driving') {
      setMapStyle(previousMapStyle);
    }
    
    // Show completion modal
    setSimulationCompleteData(modalData);
    setShowSimulationCompleteModal(true);
    
    // Keep simulated location at destination for a moment
    setTimeout(() => {
      setSimulatedLocation(null);
      setSimulationProgress(0);
    }, 3000);
  }, [selectedRoute, selectedOrigin, selectedDestination, simulationStartTime, user, isNavigationActive, mapStyle, previousMapStyle, loadUserData]);

  // Run simulation animation - Optimized with requestAnimationFrame
  const runSimulation = useCallback(() => {
    const route = selectedRoute;
    if (!route || !route.route_coordinates) return;

    const totalPoints = route.route_coordinates.length;
    let currentIndex = currentSimulationIndex;
    let lastFrameTime = performance.now();
    
    // Calculate base time step based on speed (faster = smaller time step)
    // Adjust speed multiplier: 1x = 100ms per point, 2x = 50ms, 5x = 20ms, 10x = 10ms
    const baseTimeStep = 100; // milliseconds per coordinate point
    
    // Throttle map updates to every 3 frames (reduce lag)
    const MAP_UPDATE_THROTTLE = 3;
    let frameCount = 0;
    
    // Throttle progress updates to reduce re-renders (update every 0.5%)
    const PROGRESS_UPDATE_THRESHOLD = 0.5;
    let lastProgress = 0;

    const animate = (currentTime) => {
      // Check paused state from ref (always current)
      if (simulationPausedRef.current) {
        lastFrameTime = currentTime;
        simulationAnimationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = currentTime - lastFrameTime;
      
      // Get current speed from ref (always current) and calculate time step
      const speed = simulationSpeedRef.current;
      const timeStep = baseTimeStep / speed;
      
      // Only advance if enough time has passed based on speed
      if (deltaTime >= timeStep) {
        currentIndex++;
        
        if (currentIndex >= totalPoints) {
          // Simulation complete - use ref to avoid dependency issues
          completeSimulation();
          return;
        }

        const coords = route.route_coordinates[currentIndex];
        const progress = (currentIndex / totalPoints) * 100;
        
        // Update state only if progress changed significantly (reduce re-renders)
        if (Math.abs(progress - lastProgress) >= PROGRESS_UPDATE_THRESHOLD || currentIndex === totalPoints - 1) {
          lastProgress = progress;
          
          // Batch state updates
          setCurrentSimulationIndex(currentIndex);
          setSimulationProgress(progress);
          setSimulatedLocation({
            lat: coords[0],
            lng: coords[1],
            timestamp: Date.now()
          });

          // Update navigation step based on progress (throttled)
          if (route.steps && frameCount % 5 === 0) {
            const stepIndex = Math.floor((currentIndex / totalPoints) * route.steps.length);
            setNavigationStep(Math.min(stepIndex, route.steps.length - 1));
          }
        }

        // Throttle map updates to reduce lag (only update every N frames)
        frameCount++;
        if (frameCount % MAP_UPDATE_THROTTLE === 0 && mapRef.current) {
          try {
            // Use panTo instead of setView for smoother updates
            mapRef.current.panTo([coords[0], coords[1]], {
              animate: false,
              duration: 0
            });
            simulationLastMapUpdateRef.current = currentTime;
          } catch (err) {
            // Silently fail if map is not ready
          }
        }

        lastFrameTime = currentTime - (deltaTime % timeStep); // Preserve remainder
      }

      simulationAnimationFrameRef.current = requestAnimationFrame(animate);
    };

    // Cancel any existing animation
    if (simulationAnimationFrameRef.current) {
      cancelAnimationFrame(simulationAnimationFrameRef.current);
    }
    
    // Also clear interval if it exists (fallback)
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    simulationAnimationFrameRef.current = requestAnimationFrame(animate);
  }, [selectedRoute, currentSimulationIndex, completeSimulation]);

  // Pause/Resume simulation
  const toggleSimulationPause = () => {
    setSimulationPaused(!simulationPaused);
  };

  // Stop simulation
  const stopSimulation = useCallback(() => {
    // Cancel animation frame
    if (simulationAnimationFrameRef.current) {
      cancelAnimationFrame(simulationAnimationFrameRef.current);
      simulationAnimationFrameRef.current = null;
    }
    
    // Clear interval if it exists (fallback)
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    
    setIsSimulating(false);
    setSimulationProgress(0);
    setSimulatedLocation(null);
    setSimulationPaused(false);
    setSimulationMinimized(false);
    setCurrentSimulationIndex(0);
    simulationLastMapUpdateRef.current = 0;
    simulationLastProgressUpdateRef.current = 0;
    
    // Clear route and selected places
    setSelectedRoute(null);
    setSelectedOrigin(null);
    setSelectedDestination(null);
    setCurrentRoute(null);
    setRouteAlternatives([]);
    
    // Clear search bar inputs
    setOriginQuery('');
    setDestinationQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setSelectedSearchResult(null);
    setShowSuggestions(false);
    
    // Close route-related panels
    setShowSmartRoutePanel(false);
    setShowDirectionsPanel(false);
    setShowRouteAlternatives(false);
    
    // Clear navigation step
    setNavigationStep(0);
    
    // Restore previous map style when simulation stops (only if navigation is not active)
    if (!isNavigationActive && mapStyle === 'light_driving' && previousMapStyle !== 'light_driving') {
      setMapStyle(previousMapStyle);
    }
  }, [isNavigationActive, mapStyle, previousMapStyle]);

  // Change simulation speed
  const changeSimulationSpeed = useCallback((speed) => {
    setSimulationSpeed(speed);
    
    // Restart simulation with new speed if currently running
    // The runSimulation will automatically use the new speed from state
    // due to the dependency array, so we just need to restart it
    if (isSimulating && !simulationPaused) {
      // Cancel current animation
      if (simulationAnimationFrameRef.current) {
        cancelAnimationFrame(simulationAnimationFrameRef.current);
        simulationAnimationFrameRef.current = null;
      }
      // Clear interval if exists (fallback)
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      // Restart with new speed - slight delay to ensure state is updated
      setTimeout(() => {
        runSimulation();
      }, 10);
    }
  }, [isSimulating, simulationPaused, runSimulation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel animation frame
      if (simulationAnimationFrameRef.current) {
        cancelAnimationFrame(simulationAnimationFrameRef.current);
        simulationAnimationFrameRef.current = null;
      }
      // Clear interval if exists (fallback)
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
    };
  }, []);

  // ============================================
  // NEW: 5 PRIORITY FEATURES FUNCTIONS
  // ============================================

  // 1. VOICE NAVIGATION FUNCTIONS
  // Initialize voice navigation when route starts
  useEffect(() => {
    if (isNavigationActive && selectedRoute && voiceNavigationService.isEnabled()) {
      voiceNavigationService.speak('Navigation started');
      
      if (selectedRoute.steps && selectedRoute.steps.length > 0) {
        const firstStep = selectedRoute.steps[0];
        voiceNavigationService.announceInstruction(
          firstStep.instruction,
          firstStep.distance
        );
      }
    }
  }, [isNavigationActive]);

  // Announce navigation steps
  useEffect(() => {
    if (isNavigationActive && selectedRoute && selectedRoute.steps) {
      const currentStep = selectedRoute.steps[navigationStep];
      if (currentStep && voiceNavigationService.isEnabled()) {
        voiceNavigationService.announceInstruction(
          currentStep.instruction,
          currentStep.distance
        );
      }
    }
  }, [navigationStep]);

  // 2. INCIDENT REPORTING FUNCTIONS
  // Load nearby incidents from backend API
  const loadNearbyIncidents = useCallback(async () => {
    if (!mapCenter) return;
    
    try {
      const response = await trafficService.getNearbyIncidents(
        { lat: mapCenter[0], lng: mapCenter[1] },
        5 // radius in km
      );
      
      // Transform backend response to match expected format
      const incidents = (response.incidents || []).map(incident => ({
        id: incident.id,
        type: incident.incident_type,
        description: incident.description || '',
        severity: incident.severity || 'medium',
        latitude: incident.latitude,
        longitude: incident.longitude,
        title: incident.title,
        timestamp: incident.created_at ? new Date(incident.created_at) : new Date(),
        location: { lat: incident.latitude, lng: incident.longitude }
      }));
      
      setNearbyIncidents(incidents);
    } catch (error) {
      console.error('Error loading nearby incidents:', error);
      // Don't set empty array on error, keep existing incidents
    }
  }, [mapCenter]);

  // Load incidents when map moves
  useEffect(() => {
    loadNearbyIncidents();
    const interval = setInterval(loadNearbyIncidents, 60000);
    return () => clearInterval(interval);
  }, [loadNearbyIncidents]);

  // 3. INCIDENT PRONE AREAS API CALL
  // Load incident prone areas when toggle is enabled (additional to useMapData hook)
  const loadIncidentProneAreas = useCallback(async () => {
    if (!incidentProneEnabled || !mapCenter) {
      return;
    }
    
    try {
      console.log('Loading incident prone areas for:', mapCenter);
      const areas = await incidentProneService.getNearbyIncidentProneAreas(
        mapCenter[0], 
        mapCenter[1], 
        15 // radius in km
      );
      
      // The service already handles the response format, but ensure it's an array
      const areasArray = Array.isArray(areas) ? areas : (areas?.nearby_areas || areas?.areas || []);
      console.log(`Loaded ${areasArray.length} incident prone areas from API`);
      
      // Note: The useMapData hook also loads this, but this ensures it's called when toggle changes
      // The data from useMapData hook will be used for display
    } catch (error) {
      console.error('Error loading incident prone areas:', error);
    }
  }, [incidentProneEnabled, mapCenter]);

  // Load incident prone areas when toggle is enabled or map center changes
  useEffect(() => {
    if (incidentProneEnabled) {
      loadIncidentProneAreas();
      // Refresh every 5 minutes
      const interval = setInterval(loadIncidentProneAreas, 300000);
      return () => clearInterval(interval);
    }
  }, [incidentProneEnabled, loadIncidentProneAreas]);

  // Handle incident report submission - saves to emergencies table
  const handleIncidentReport = async (incidentData) => {
    try {
      // Map incident types from modal format to EmergencyType enum values
      const incidentTypeMap = {
        'accident': 'ACCIDENT',
        'roadwork': 'ROAD_HAZARD',
        'police': 'CRIME',
        'flooding': 'ROAD_HAZARD', // Flooding is a road hazard
        'traffic_jam': 'OTHER',
        'other': 'OTHER'
      };

      // Map severity: backend expects "low", "medium", "high", "critical"
      // Modal provides "low", "medium", "high"
      const severityMap = {
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      };

      // Upload photo to Supabase Storage (with fallback to base64)
      let photoUrls = [];
      if (incidentData.photo) {
        try {
          
          // Upload to Supabase Storage
          const photoUrl = await supabaseStorageService.uploadPhoto(incidentData.photo, 'emergencies');
          photoUrls = [photoUrl];
          
        } catch (photoError) {
          
          
          // Fallback to base64 if Supabase upload fails
          try {
            
            const base64Photo = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(incidentData.photo);
            });
            photoUrls = [base64Photo];
            
          } catch (base64Error) {
            
            alert('⚠️ Photo processing failed, but report will still be submitted.');
          }
        }
      }

      // Also check if photos array is provided (for backward compatibility)
      if (incidentData.photos && Array.isArray(incidentData.photos)) {
        photoUrls = [...photoUrls, ...incidentData.photos.map(photo => photo.url || photo)];
      }

      // Prepare data for Emergency API (emergencies table)
      const emergencyData = {
        emergency_type: incidentTypeMap[incidentData.incident_type] || 'OTHER',
        title: incidentData.title || 'Incident Report',
        description: incidentData.description || null,
        severity: severityMap[incidentData.severity] || 'medium',
        latitude: parseFloat(incidentData.latitude),
        longitude: parseFloat(incidentData.longitude),
        address: incidentData.address || null,
        photo_urls: photoUrls,
        reporter_phone: incidentData.contact_number?.trim() || undefined
      };

      // Validate required fields
      if (!emergencyData.latitude || !emergencyData.longitude || !emergencyData.emergency_type) {
        alert('⚠️ Please provide location and incident type');
        return;
      }

      

      // Submit to Emergency API (saves to emergencies table)
      const response = await emergencyService.reportEmergency(emergencyData);
      
      // Reload nearby incidents to show the new one
      loadNearbyIncidents();
      
      // Also reload nearby emergencies if emergency layer is enabled
      // if (emergencyEnabled) {
      //   // This will trigger the emergency data refresh
      //   window.dispatchEvent(new Event('refresh-emergencies'));
      // }
      
      // Refresh user's emergency reports list
      if (user) {
        try {
          const reports = await emergencyService.getMyEmergencyReports();
          const reportsList = Array.isArray(reports) ? reports : (reports.emergencies || []);
          setMyEmergencyReports(reportsList);
        } catch (err) {
          console.error('Error refreshing emergency reports:', err);
        }
      }
    } catch (error) {
      
      const errorMessage = error.message || 'Failed to report incident. Please try again.';
      alert(`❌ ${errorMessage}`);
    }
  };


  // 3. MULTI-STOP ROUTE PLANNING FUNCTIONS
  // Toggle multi-stop mode
  const toggleMultiStopMode = () => {
    if (!multiStopMode) {
      setStops([
        selectedOrigin || { name: '', lat: null, lng: null },
        selectedDestination || { name: '', lat: null, lng: null }
      ]);
    }
    setMultiStopMode(!multiStopMode);
  };

  // Calculate multi-stop route
  const calculateMultiStopRoute = async (options = {}) => {
    try {
      setIsLoadingRoute(true);
      
      const multiStopRoute = await multiStopRoutingService.calculateMultiStopRoute(
        stops,
        options
      );
      
      setCurrentRoute({
        routes: [multiStopRoute],
        recommended_route: multiStopRoute
      });
      setSelectedRoute(multiStopRoute);
      
      if (multiStopRoute.bounds) {
        const { southwest, northeast } = multiStopRoute.bounds;
        setMapCenter([
          (southwest[0] + northeast[0]) / 2,
          (southwest[1] + northeast[1]) / 2
        ]);
      }
    } catch (error) {
      
      alert('Failed to calculate route');
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // 4. LOCATION SHARING FUNCTIONS
  // Start location sharing
  const startLocationSharing = async () => {
    try {
      const share = await locationSharingService.createShare({
        userId: user?.uid,
        userName: user?.displayName || 'Anonymous',
        origin: selectedOrigin,
        destination: selectedDestination,
        routeData: selectedRoute,
        expiresInMinutes: 120
      });
      
      setShareData(share);
      setIsSharing(true);
      
      alert(`✅ Location sharing started!\nShare code: ${share.shareCode}`);
    } catch (error) {
      
      alert('Failed to start location sharing');
    }
  };

  // Update shared location periodically
  useEffect(() => {
    if (!isSharing || !shareData || !userLocation) return;
    
    const updateInterval = setInterval(async () => {
      try {
        await locationSharingService.updateLocation(shareData.id, {
          lat: userLocation.lat,
          lng: userLocation.lng,
          eta: selectedRoute?.estimated_duration_minutes,
          distanceRemaining: selectedRoute?.distance_km
        });
      } catch (error) {
        
      }
    }, 10000);
    
    return () => clearInterval(updateInterval);
  }, [isSharing, shareData, userLocation, selectedRoute]);

  // 5. WEATHER-AWARE ROUTING FUNCTIONS
  // Get weather-aware route
  const getWeatherAwareRoute = async () => {
    // Prevent route calculation during simulation to avoid API call loops
    if (isSimulating) {
      console.log('Weather-aware route calculation blocked: simulation is active');
      return;
    }

    if (!selectedOrigin || !selectedDestination) return;
    
    try {
      setIsLoadingRoute(true);
      
      const weatherRoute = await weatherAwareRoutingService.getWeatherAwareRoute(
        selectedOrigin.lat,
        selectedOrigin.lng,
        selectedDestination.lat,
        selectedDestination.lng,
        { maxAlternatives: 3 }
      );
      
      setWeatherData(weatherRoute.weather);
      setWeatherWarnings(weatherRoute.weatherWarnings);
      setCurrentRoute({ routes: weatherRoute.routes });
      setSelectedRoute(weatherRoute.recommended_route);
      setRouteAlternatives(weatherRoute.routes);
      
      if (voiceNavigationService.isEnabled() && weatherRoute.weatherWarnings.length > 0) {
        weatherRoute.weatherWarnings.forEach(warning => {
          voiceNavigationService.announceTrafficAlert(warning.message);
        });
      }
    } catch (error) {
      
      // Only fallback to handleGetRoute if simulation is not active
      if (!isSimulating) {
        handleGetRoute();
      }
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // ============================================
  // END OF NEW FEATURES FUNCTIONS
  // ============================================

  // Map event handlers
  const MapEvents = () => {
    const map = useMap();
    
    useEffect(() => {
      // Store map reference
      mapRef.current = map;
      
      // Handle map clicks to close icon selector
      const handleMapClick = () => {
        if (showIconSelector) {
          setShowIconSelector(false);
        }
        // Don't close search results when clicking on map - let users interact with pins
        // Only close search suggestions dropdown, not the results panel
      };
      
      map.on('click', handleMapClick);
      
      return () => {
        map.off('click', handleMapClick);
      };
    }, [map, showIconSelector, showSearchResults]);
    
    useMapEvents({
      moveend: (e) => {
        const center = e.target.getCenter();
        setMapCenter([center.lat, center.lng]);
        lastMapEventTypeRef.current = 'move';
      },
      zoomend: (e) => {
        setMapZoom(e.target.getZoom());
        lastMapEventTypeRef.current = 'zoom';
      }
    });
    return null;
  };

  // Mini dashboard sheet state
  const [isMiniOpen, setIsMiniOpen] = useState(false);
  const [highlightedIncident, setHighlightedIncident] = useState(null); // { lat, lng, title, severity }

  // Auto-clear highlight after a few seconds
  useEffect(() => {
    if (!highlightedIncident) return;
    const timer = setTimeout(() => setHighlightedIncident(null), 8000);
    return () => clearTimeout(timer);
  }, [highlightedIncident]);

  // Load traffic data ONLY when Insights panel is opened (for better API management)
  // This must be after isMiniOpen declaration to avoid "Cannot access before initialization" error
  useEffect(() => {
    // Skip loading traffic data during simulation to prevent infinite loops
    if (isSimulating) {
      return;
    }
    
    // Only load data when Insights panel is opened
    if (!isMiniOpen) {
      return;
    }
    
    // Load data when Insights panel opens
    loadTrafficData(false);
    
    // Set up 10-minute interval to refresh traffic data from TomTom API
    // Only refresh while the Insights panel is open
    const interval = setInterval(() => {
      if (isMiniOpen) {
        // Fetch fresh data directly from TomTom API
        loadTrafficData(false);
      }
    }, 10 * 60 * 1000); // 10 minutes = 600,000 milliseconds
    
    return () => clearInterval(interval);
  }, [isMiniOpen, mapCenter, isSimulating]);

  // Current navigation step
  const currentStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep] : null;
  const nextStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep + 1] : null;
  // Memoized HERE heatmap points with rule-based filters (unconditional to preserve hook order)
  const ttFilteredHeatmapPoints = useMemo(() => {
    let pts = Array.isArray(ttHeatmapPoints) ? ttHeatmapPoints : [];
    pts = pts.map(normalizeHeatmapPoint).filter(Boolean);
    if (ruleHeatmapEnabled && pts.length > 0) {
      const bounds = mapRef.current?.getBounds?.() || null;
      pts = filterPointArrayByLocation(pts, ruleLocationFilter, {
        bounds,
        center: mapCenter,
        radiusKm: ruleRadiusKm,
        defaultBounds
      });
      pts = filterPointsByCategories(pts, {
        showGreen: ruleShowGreen,
        showYellow: ruleShowYellow,
        showRed: ruleShowRed
      });
      // Remap intensities to the selected category ranges for proper gradient display
      // First, collect all intensities for the selected categories to normalize them
      const selectedIntensities = pts.map(p => Number(p[2] ?? 0.0)).filter(i => Number.isFinite(i));
      
      if (selectedIntensities.length > 0) {
        const onlyGreen = ruleShowGreen && !ruleShowYellow && !ruleShowRed;
        const onlyYellow = !ruleShowGreen && ruleShowYellow && !ruleShowRed;
        const onlyRed = !ruleShowGreen && !ruleShowYellow && ruleShowRed;
        const greenAndYellow = ruleShowGreen && ruleShowYellow && !ruleShowRed;
        const yellowAndRed = !ruleShowGreen && ruleShowYellow && ruleShowRed;
        const greenAndRed = ruleShowGreen && !ruleShowYellow && ruleShowRed;
        
        // Find min/max for normalization when showing individual categories
        let minIntensity = Math.min(...selectedIntensities);
        let maxIntensity = Math.max(...selectedIntensities);
        
        // For individual categories, use category-specific ranges for better visibility
        if (onlyGreen) {
          minIntensity = 0.0;
          maxIntensity = 0.34;
        } else if (onlyYellow) {
          minIntensity = 0.34;
          maxIntensity = 0.80;
        } else if (onlyRed) {
          minIntensity = 0.80;
          maxIntensity = 1.0;
        }
        
        // Normalize range to ensure full visibility
        const range = maxIntensity - minIntensity;
        const minVisibleIntensity = 0.1; // Minimum intensity for visibility
        
        pts = pts.map((p) => {
          const [la, ln, it] = p;
          let intensity = Number(it ?? 0.0);
          if (!Number.isFinite(intensity)) intensity = 0.0;
          
          const cat = categorizeIntensity(intensity);
          let remappedIntensity = intensity;
          
          if (onlyGreen && cat === 'green') {
            // Map green range (0.0-0.34) to full range (0.1-1.0) for visibility
            if (range > 0) {
              remappedIntensity = minVisibleIntensity + ((intensity - minIntensity) / range) * (1.0 - minVisibleIntensity);
            } else {
              remappedIntensity = 0.5; // Default if all same value
            }
          } else if (onlyYellow && cat === 'yellow') {
            // Map yellow range (0.34-0.80) to full range (0.1-1.0) for visibility
            if (range > 0) {
              remappedIntensity = minVisibleIntensity + ((intensity - minIntensity) / range) * (1.0 - minVisibleIntensity);
            } else {
              remappedIntensity = 0.5; // Default if all same value
            }
          } else if (onlyRed && cat === 'red') {
            // Map red range (0.80-1.0) to full range (0.1-1.0) for visibility
            if (range > 0) {
              remappedIntensity = minVisibleIntensity + ((intensity - minIntensity) / range) * (1.0 - minVisibleIntensity);
            } else {
              remappedIntensity = 0.5; // Default if all same value
            }
          } else if (greenAndYellow) {
            if (cat === 'green') {
              // Map green (0.0-0.34) to (0.1-0.5)
              remappedIntensity = 0.1 + (intensity / 0.34) * 0.4;
            } else if (cat === 'yellow') {
              // Map yellow (0.34-0.80) to (0.5-1.0)
              remappedIntensity = 0.5 + ((intensity - 0.34) / (0.80 - 0.34)) * 0.5;
            }
          } else if (yellowAndRed) {
            if (cat === 'yellow') {
              // Map yellow (0.34-0.80) to (0.1-0.5)
              remappedIntensity = 0.1 + ((intensity - 0.34) / (0.80 - 0.34)) * 0.4;
            } else if (cat === 'red') {
              // Map red (0.80-1.0) to (0.5-1.0)
              remappedIntensity = 0.5 + ((intensity - 0.80) / (1.0 - 0.80)) * 0.5;
            }
          } else if (greenAndRed) {
            if (cat === 'green') {
              // Map green (0.0-0.34) to (0.1-0.5)
              remappedIntensity = 0.1 + (intensity / 0.34) * 0.4;
            } else if (cat === 'red') {
              // Map red (0.80-1.0) to (0.5-1.0)
              remappedIntensity = 0.5 + ((intensity - 0.80) / (1.0 - 0.80)) * 0.5;
            }
          }
          // For all three selected, keep original intensity (0.0-1.0) but ensure minimum
          if (!onlyGreen && !onlyYellow && !onlyRed && !greenAndYellow && !yellowAndRed && !greenAndRed) {
            remappedIntensity = Math.max(minVisibleIntensity, intensity);
          }
          
          return [la, ln, Math.max(0.0, Math.min(remappedIntensity, 1.0))];
        });
      }
    }
    return pts;
  }, [
    ttHeatmapPoints,
    ruleHeatmapEnabled,
    ruleLocationFilter,
    ruleRadiusKm,
    mapCenter,
    ruleShowGreen,
    ruleShowYellow,
    ruleShowRed
  ]);

  // Dynamic radius/blur for HERE/TomTom heatmap so it looks thinner and less "solid red"
  // on high zoom levels while staying visible when zoomed out.
  const heatmapRadius = useMemo(() => {
    if (mapZoom <= 11) return 30;      // far zoom – thicker corridors
    if (mapZoom <= 13) return 24;      // city-level view
    if (mapZoom <= 15) return 18;      // district-level
    return 14;                         // close zoom – thin lines / blobs
  }, [mapZoom]);

  const heatmapBlur = useMemo(() => {
    if (mapZoom <= 11) return 18;
    if (mapZoom <= 13) return 14;
    if (mapZoom <= 15) return 10;
    return 8;
  }, [mapZoom]);

  // Dynamic gradient based on selected traffic categories
  const heatmapGradient = useMemo(() => {
    // If rule-based heatmap is enabled, use filtered gradient
    if (ruleHeatmapEnabled) {
      const onlyGreen = ruleShowGreen && !ruleShowYellow && !ruleShowRed;
      const onlyYellow = !ruleShowGreen && ruleShowYellow && !ruleShowRed;
      const onlyRed = !ruleShowGreen && !ruleShowYellow && ruleShowRed;
      const greenAndYellow = ruleShowGreen && ruleShowYellow && !ruleShowRed;
      const yellowAndRed = !ruleShowGreen && ruleShowYellow && ruleShowRed;
      const greenAndRed = ruleShowGreen && !ruleShowYellow && ruleShowRed;
      
      if (onlyGreen) {
        // Only green: use green shades from light to dark
        return {
          0.0: '#86efac', // light green
          0.5: '#4ade80', // medium green
          1.0: '#22c55e'  // dark green
        };
      } else if (onlyYellow) {
        // Only yellow: use yellow shades from light to dark
        return {
          0.0: '#fef08a', // light yellow
          0.5: '#fde047', // medium yellow
          1.0: '#eab308'  // dark yellow
        };
      } else if (onlyRed) {
        // Only red: use red shades from light to dark
        return {
          0.0: '#fca5a5', // light red
          0.5: '#f87171', // medium red
          1.0: '#dc2626'  // dark red
        };
      } else if (greenAndYellow) {
        // Green to yellow transition
        return {
          0.0: '#22c55e', // green
          0.5: '#22c55e', // green
          0.51: '#eab308', // yellow
          1.0: '#eab308'  // yellow
        };
      } else if (yellowAndRed) {
        // Yellow to red transition
        return {
          0.0: '#eab308', // yellow
          0.5: '#eab308', // yellow
          0.51: '#f87171', // red
          1.0: '#dc2626'  // dark red
        };
      } else if (greenAndRed) {
        // Green to red transition (skip yellow)
        return {
          0.0: '#22c55e', // green
          0.5: '#22c55e', // green
          0.51: '#f87171', // red
          1.0: '#dc2626'  // dark red
        };
      }
      // All three selected: use full range
    }
    
    // Default: full color range (green -> yellow -> red).
    // Bias more of the range toward green/yellow so red only appears on the worst congestion.
    return {
      0.0: '#22c55e',   // free
      0.40: '#22c55e',  // stay green longer
      0.41: '#eab308',  // moderate starts a bit later
      0.70: '#eab308',
      0.71: '#fb923c',  // orange for heavy but not worst
      0.88: '#f97316',
      0.89: '#f87171',  // true heavy jam
      1.0: '#b91c1c'
    };
  }, [ruleHeatmapEnabled, ruleShowGreen, ruleShowYellow, ruleShowRed]);

  return (
    <DarkModeProvider mapStyle={mapStyle}>
    <ErrorBoundary>
      <div 
        className={`traffic-map-container fixed inset-0 w-full min-h-screen overflow-y-auto ${
          mapStyle === 'night' ? 'bg-gray-900' : 'bg-gray-900'
        }`}
        style={{ 
          zIndex: 9999, 
          touchAction: 'pan-y',
          height: '100dvh',
          minHeight: '-webkit-fill-available' // iOS Safari fallback
        }}
      >
      {/* Full Screen Backdrop - Covers everything including navbar */}
      <div className="absolute inset-0 bg-gray-900" style={{ zIndex: 0 }}></div>
      
      {/* Map Container */}
      <div 
        className="absolute inset-0 z-10"
        onClick={(e) => {
          // Close search results when clicking on map container (but not on search panel)
          if (showSearchResults && !searchPanelRef.current?.contains(e.target)) {
            setShowSearchResults(false);
            setShowSuggestions(false);
          }
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          minZoom={3}
          maxZoom={18}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1.0}
        >
          <MapEvents />
          
          {/* Tile Layer */}
          <TomTomTileLayer 
            style={mapStyle}
            onError={(error) => {
              
            }}
          />

          {/* Traffic Flow Layer - Updates every 10 minutes - Uses TomTom API */}
          <TrafficFlowLayer enabled={trafficLayerEnabled} />

          {/* Enhanced Traffic Flow Heatmap - Follows road geometry - DISABLED */}
          {/* <TrafficFlowHeatmap 
            enabled={heatmapEnabled} 
            mapCenter={mapCenter}
            mapBounds={mapRef.current?.getBounds()}
          /> */}

          {/* Legacy base heatmap removed (now using floating HERE heatmap only) */}

          {/* NEW: Real-time Traffic Heatmap (TomTom Flow + Incidents) with rule-based filters */}
          {ttHeatmapEnabled && ttFilteredHeatmapPoints.length > 0 && (
            <HeatmapLayer
              points={ttFilteredHeatmapPoints}
              options={{
                // Dynamic radius/blur tuned by zoom so corridors don't look like solid red slabs
                radius: heatmapRadius,
                blur: heatmapBlur,
                // Increase max so combined samples don't over-saturate
                max: 3.8,
                // Keep a stable base opacity regardless of zoom
                minOpacity: ruleHeatmapEnabled ? ruleHeatmapOpacity : 0.50,
                // Dynamic gradient based on selected traffic categories
                gradient: heatmapGradient,
              }}
            />
          )}

          {/* 3D Map Visualization removed */}

          {/* Map Markers - All markers rendered here */}
          <MapMarkers
            selectedOrigin={selectedOrigin}
            selectedDestination={selectedDestination}
            userLocation={userLocation}
            simulatedLocation={simulatedLocation}
            isSimulating={isSimulating}
            navigationIcon={navigationIcon}
            userHeading={userHeading}
            nearbyIncidents={nearbyIncidents}
            emergencyEnabled={false}
            highlightedIncident={highlightedIncident}
            user={user}
            simulationProgress={simulationProgress}
            simulationSpeed={simulationSpeed}
            gyroscopeEnabled={gyroscopeEnabled}
            isNavigating={isNavigationActive}
          />

          {/* Map Layer Components - All marker rendering is now handled by these components */}
          <WeatherLayer weatherAlerts={nearbyWeatherAlerts} enabled={weatherEnabled} />
          <FloodLayer 
            floodProneAreas={floodProneAreas}
            criticalFloodAreas={criticalFloodAreas}
            activeFloods={activeFloods}
            enabled={floodZonesEnabled}
          />
          <ParkingLayer noParkingZones={noParkingZones} enabled={parkingEnabled} />
          <ReportLayer reports={userReports} enabled={reportsEnabled} />
          <IncidentLayer 
            incidents={nearbyIncidents}
            incidentProneAreas={incidentProneAreas}
            enabled={incidentProneEnabled}
            user={user}
          />
          {/* <EmergencyLayer emergencies={nearbyEmergencies} enabled={emergencyEnabled} /> */}
          <TrafficMonitoringLayer 
            incidents={tmIncidents}
            roadworks={tmRoadworks}
            enabled={trafficMonitorNewEnabled}
          />

          {/* Route Display - Show all alternatives like Google Maps, but only selected route during navigation */}
          {selectedRoute && (
            <RouteLayer
              routes={routeAlternatives.length > 0 ? routeAlternatives : (currentRoute ? currentRoute.routes || [] : [])}
              selectedRoute={selectedRoute}
              showAllRoutes={!isNavigationActive && routeAlternatives.length > 1}
              onRouteClick={selectRoute}
              origin={selectedOrigin}
              destination={selectedDestination}
              simulationProgress={isSimulating ? currentSimulationIndex : null}
              totalPoints={selectedRoute.route_coordinates ? selectedRoute.route_coordinates.length : 0}
            />
          )}

          {/* Search Results Layer - Show pin for selected result or place */}
          {!isNavigationActive && (selectedSearchResult || (selectedPlace && selectedPlace.lat && selectedPlace.lng)) && (
            <SearchResultsLayer
              searchResults={searchResults}
              selectedResult={selectedSearchResult || (selectedPlace ? {
                name: selectedPlace.name,
                display_name: selectedPlace.name,
                address: {
                  full: selectedPlace.address,
                  freeformAddress: selectedPlace.address
                },
                lat: selectedPlace.lat,
                lng: selectedPlace.lng,
                type: selectedPlace.type || 'general'
              } : null)}
              onResultSelect={(result) => {
                setSelectedSearchResult(result);
                // Smoothly zoom in and center map on selected result
                if (result.lat && result.lng && mapRef.current) {
                  // Use flyTo for smooth animation
                  const targetZoom = 17; // Zoom in closer for better visibility
                  mapRef.current.flyTo([result.lat, result.lng], targetZoom, {
                    duration: 1.0,
                    easeLinearity: 0.25
                  });
                  // Update state to keep in sync
                  setMapCenter([result.lat, result.lng]);
                  setMapZoom(targetZoom);
                }
              }}
              onResultClick={(result) => {
                // Get the location name
                const locationName = result.name || result.display_name || result.address?.full || result.address?.freeformAddress || 'Unknown Location';
                
                // Update the search bar with the location name
                setDestinationQuery(locationName);
                
                // Smoothly zoom in and center map first, then show place info panel
                if (result.lat && result.lng && mapRef.current) {
                  const targetZoom = 17; // Zoom in closer for better visibility
                  mapRef.current.flyTo([result.lat, result.lng], targetZoom, {
                    duration: 1.0,
                    easeLinearity: 0.25
                  });
                  setMapCenter([result.lat, result.lng]);
                  setMapZoom(targetZoom);
                  // Set selected result to show pin with animation
                  setSelectedSearchResult(result);
                }
                // Show place info panel after a short delay to allow zoom animation
                setTimeout(() => {
                  setSelectedPlace({
                    name: locationName,
                    lat: result.lat,
                    lng: result.lng,
                    address: result.address?.full || result.address?.freeformAddress || '',
                    type: result.type || 'general'
                  });
                  setShowPlaceInfoPanel(true);
                }, 500);
              }}
            />
          )}

          <ScaleControl position="bottomleft" />
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      {/* Insights FAB - Enhanced - Hide when traffic monitoring panel is open, navigation is active, simulation is running, or active incidents panel is open */}
      {!showTrafficMonitoringPanel && !isNavigationActive && !isSimulating && !showActiveIncidentsPanel && (
        <div
          className={`absolute left-4 sm:left-6 z-50 transition-all duration-500 ease-out ${isMiniOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'}`}
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={() => {
              setIsMiniOpen(true);
              // Load traffic data when Insights is opened (for better API management)
              // Data will be loaded by the useEffect that watches isMiniOpen
            }}
            className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 px-4 py-2 text-sm sm:px-5 sm:py-3 sm:text-base font-semibold transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group"
          >
            <span className="relative z-10 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
              <span>Insights</span>
            </span>
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
          </button>
        </div>
      )}


      {/* NEW: Toggle for Real-time Traffic Heatmap - Hide when Active Incidents Panel is open */}
      {!showTrafficMonitoringPanel && !isSimulating && !showActiveIncidentsPanel && (
        <div className="absolute right-4 sm:right-6 top-32 sm:top-28 z-50 flex flex-col items-end gap-2">
          {/* Traffic Heatmap Toggle - Hidden during navigation */}
          {!isNavigationActive && !showRulePanel && (
            <>
              <button
                onClick={() => setTtHeatmapEnabled((v) => !v)}
                className={`min-w-[44px] min-h-[40px] px-4 py-2 rounded-full shadow-xl transition-all duration-300 ease-out flex items-center gap-2 ${
                  ttHeatmapEnabled
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700'
                    : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
                }`}
                title="Show Traffic Heatmap"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${ttHeatmapEnabled ? 'bg-red-300' : 'bg-gray-300'}`} />
                <span className="text-sm font-semibold">
                  {ttHeatmapEnabled ? 'Hide Traffic Heatmap' : 'Show Traffic Heatmap'}
                </span>
              </button>
              {ttHeatmapEnabled && (
                <div className="px-3 py-1 rounded-full bg-white/90 border border-gray-200 text-xs text-gray-700 shadow">
                  {isLoadingTtHeatmap ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                      Updating...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Live
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {/* Rule-based Heatmap Toggle and Panel - Hidden during navigation and when active incidents panel is open */}
          {!isNavigationActive && !showRulePanel && !showActiveIncidentsPanel && (
            <>
              <button
                onClick={() => {
                  const next = !ruleHeatmapEnabled;
                  setRuleHeatmapEnabled(next);
                  if (next) setHeatmapEnabled(true);
                }}
                className={`min-w-[44px] min-h-[40px] px-4 py-2 rounded-full shadow-xl transition-all duration-300 ease-out flex items-center gap-2 ${
                  ruleHeatmapEnabled
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700'
                    : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50'
                }`}
                title="Rule-based Heatmap"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${ruleHeatmapEnabled ? 'bg-green-300' : 'bg-gray-300'}`} />
                <span className="text-sm font-semibold">
                  {ruleHeatmapEnabled ? 'Rules: ON' : 'Rules: OFF'}
                </span>
              </button>
              <button
                onClick={() => setShowRulePanel((v) => !v)}
                className="min-w-[44px] min-h-[36px] px-3 py-2 rounded-full bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 shadow flex items-center gap-2"
                title="Rule filters"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs font-semibold">Filters</span>
              </button>
            </>
          )}
          {/* Rule Panel - Hidden during navigation and when active incidents panel is open */}
          {!isNavigationActive && showRulePanel && !showActiveIncidentsPanel && (
            <div className="w-72 bg-white/95 backdrop-blur rounded-2xl border border-gray-200 shadow-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800">Rule-based Heatmap</span>
                <button onClick={() => setShowRulePanel(false)} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Time</label>
                <select
                  value={ruleTimeFilter}
                  onChange={(e) => setRuleTimeFilter(e.target.value)}
                  className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1h">Last 1 hour</option>
                  <option value="3h">Last 3 hours</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="today_peak">Today peak hours</option>
                  <option value="night">Night hours</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Location</label>
                <select
                  value={ruleLocationFilter}
                  onChange={(e) => setRuleLocationFilter(e.target.value)}
                  className="w-full text-sm border rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="view">Current view</option>
                  <option value="city">City bounds</option>
                  <option value="radius">Radius around center</option>
                </select>
                {ruleLocationFilter === 'radius' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={ruleRadiusKm}
                      onChange={(e) => setRuleRadiusKm(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-700 w-12">{ruleRadiusKm} km</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Opacity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.2"
                    max="0.9"
                    step="0.05"
                    value={ruleHeatmapOpacity}
                    onChange={(e) => setRuleHeatmapOpacity(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-700 w-10">{Math.round(ruleHeatmapOpacity * 100)}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Traffic categories</label>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={ruleShowGreen} onChange={(e) => setRuleShowGreen(e.target.checked)} />
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#22c55e' }} />
                    <span>Free (green)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={ruleShowYellow} onChange={(e) => setRuleShowYellow(e.target.checked)} />
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#eab308' }} />
                    <span>Moderate (yellow)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={ruleShowRed} onChange={(e) => setRuleShowRed(e.target.checked)} />
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#dc2626' }} />
                    <span>Heavy (red)</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Major roads only</label>
                <input
                  type="checkbox"
                  checked={ruleMajorRoadsOnly}
                  onChange={(e) => setRuleMajorRoadsOnly(e.target.checked)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Critical threshold (congestion %)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="40"
                    max="100"
                    step="5"
                    value={ruleCriticalThreshold}
                    onChange={(e) => setRuleCriticalThreshold(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-700 w-10">{ruleCriticalThreshold}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-gray-600">Min occurrences (critical)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={ruleMinOccurrences}
                    onChange={(e) => setRuleMinOccurrences(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-700 w-10">{ruleMinOccurrences}+</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setHeatmapEnabled(true);
                    // Trigger immediate refresh via changing a noop state (or rely on deps)
                    fetchMajorRoadHeatmap();
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mini Dashboard Bottom Sheet - Hide when traffic monitoring panel is open or simulation is running */}
      {!showTrafficMonitoringPanel && !isSimulating && (
        (() => {
          const activeIncidents = (nearbyIncidents || []).length || 0;
          const totalReports = (userReports || []).length || 0;
          const heavyCount = (tmIncidents || []).filter(i => ['high', 'critical'].includes(i.severity)).length;
          const trafficCondition = heavyCount > 3 ? 'heavy' : heavyCount > 1 ? 'moderate' : 'normal';
          const updates = (nearbyIncidents || []).slice(0, 5).map((i, idx) => ({
            id: i.id || idx,
            type: 'incident',
            message: i.description || (i.type ? i.type.replace('_', ' ') : 'Incident reported'),
            timestamp: i.timestamp || Date.now(),
            priority: ['high', 'critical'].includes(i.severity) ? 'high' : 'normal',
            icon: '🚦',
          }));
          return (
            <MiniDashboardSheet
              isOpen={isMiniOpen}
              onClose={() => setIsMiniOpen(false)}
              onOpenDashboard={() => {
                setIsMiniOpen(false);
                const params = new URLSearchParams({
                  lat: String(mapCenter[0]),
                  lng: String(mapCenter[1]),
                  z: String(mapZoom),
                  incidents: String((nearbyIncidents || []).length || 0),
                  reports: String((userReports || []).length || 0),
                });
                navigate(`/dashboard?${params.toString()}`);
              }}
              stats={{ activeIncidents, totalReports, trafficCondition }}
              updates={updates}
              trafficData={trafficData || []}
              align="left"
              isLive={true}
              lastUpdated={Date.now()}
              isLoading={isLoadingData}
              onSelectUpdate={async (u) => {
                // Handle traffic data selection
                if (u.type === 'traffic' && mapRef.current) {
                  if (document && document.activeElement && document.activeElement.blur) {
                    try { document.activeElement.blur(); } catch (_) {}
                  }
                  
                  let targetLat = u.latitude || u.lat;
                  let targetLng = u.longitude || u.lng;
                  
                  // Use TomTom geocoding to get accurate coordinates for the road name
                  const roadName = u.road_name || u.roadName;
                  const barangay = u.barangay;
                  
                  if (roadName) {
                    // Build search query: "Road Name, Barangay, Las Piñas, Philippines"
                    let searchQuery = roadName;
                    if (barangay) {
                      searchQuery += `, ${barangay}`;
                    }
                    searchQuery += ', Las Piñas, Philippines';
                    
                    // Geocode using TomTom API for accurate location
                    // Note: This will automatically use fallback (OSM) if TomTom API returns 403/429
                    // The service handles errors gracefully, so we don't need try/catch here
                    const geocodeResult = await tomtomService.geocode(searchQuery, {
                      limit: 1,
                      countrySet: 'PH'
                    }).catch(() => {
                      // If geocoding completely fails, return null to use original coordinates
                      return null;
                    });
                    
                    // Extract coordinates from geocoding result
                    // TomTom API or fallback OSM returns: { results: [{ position: { lat, lon }, address: {...} }] }
                    if (geocodeResult?.results && geocodeResult.results.length > 0) {
                      const bestMatch = geocodeResult.results[0];
                      if (bestMatch.position) {
                        targetLat = bestMatch.position.lat;
                        targetLng = bestMatch.position.lon;
                        // Success - geocoded location (may be from TomTom or fallback OSM)
                        console.log(`✅ Geocoded "${roadName}" to location: ${targetLat}, ${targetLng}`);
                      } else if (bestMatch.lat && bestMatch.lon) {
                        // Fallback format (some APIs return lat/lon directly)
                        targetLat = bestMatch.lat;
                        targetLng = bestMatch.lon;
                        console.log(`✅ Geocoded "${roadName}" to location: ${targetLat}, ${targetLng}`);
                      }
                    }
                    // If no results, will use original coordinates (targetLat/targetLng from item)
                  }
                  
                  // Only proceed if we have valid coordinates
                  if (targetLat && targetLng && !isNaN(targetLat) && !isNaN(targetLng)) {
                    const targetZoom = Math.max(mapRef.current.getZoom?.() || mapZoom, 15);
                    mapRef.current.flyTo([targetLat, targetLng], targetZoom, { duration: 1.2 });
                    setHighlightedIncident({
                      lat: targetLat,
                      lng: targetLng,
                      title: roadName || 'Traffic Monitoring Point',
                      severity: u.traffic_status || 'moderate',
                    });
                    setIsMiniOpen(false);
                    return;
                  }
                }
                // Handle incident selection (fallback)
                const match = (nearbyIncidents || []).find(i => (i.id || i.type) === (u.id || u.type));
                if (match && mapRef.current) {
                  if (document && document.activeElement && document.activeElement.blur) {
                    try { document.activeElement.blur(); } catch (_) {}
                  }
                  const { lat, lng } = match.location || {};
                  if (typeof lat === 'number' && typeof lng === 'number') {
                    const targetZoom = Math.max(mapRef.current.getZoom?.() || mapZoom, 15);
                    mapRef.current.flyTo([lat, lng], targetZoom, { duration: 1.2 });
                    setHighlightedIncident({
                      lat,
                      lng,
                      title: match.description || match.type?.replace('_', ' '),
                      severity: match.severity,
                    });
                    setIsMiniOpen(false);
                  }
                }
              }}
            />
          );
        })()
      )}

      {/* Enhanced Search Panel - Hide when directions panel is open to avoid duplicate search bars, and hide on mobile when Active Incidents panel is open */}
      {!showDirectionsPanel && !showIncidentModal && !(showActiveIncidentsPanel && isMobile) && (
        <div onClick={(e) => {
          if (showSearchResults && !searchPanelRef.current?.contains(e.target)) {
            setShowSearchResults(false);
            setShowSuggestions(false);
          }
        }}>
          <EnhancedSearchPanel
          selectedOrigin={selectedOrigin}
          selectedDestination={selectedDestination}
          originQuery={originQuery}
          destinationQuery={destinationQuery}
          onOriginChange={setOriginQuery}
          onDestinationChange={setDestinationQuery}
          onOriginSelect={handleOriginSelectDirect}
          onDestinationSelect={handleDestinationSelectDirect}
          onGetCurrentLocation={getCurrentLocation}
          onShowSmartRoutePanel={() => setShowSmartRoutePanel(true)}
          onToggleSidePanel={() => {
            const newSidePanelState = !showSidePanel;
            setShowSidePanel(newSidePanelState);
            // Close Traffic Monitoring Panel when opening sidebar
            if (newSidePanelState && showTrafficMonitoringPanel) {
              setShowTrafficMonitoringPanel(false);
              setTrafficMonitorNewEnabled(false);
            }
          }}
          isLoadingRoute={isLoadingRoute}
          isSimulating={isSimulating}
          showSidePanel={showSidePanel}
          showHistoryPanel={showHistoryPanel}
          isNavigationActive={isNavigationActive}
          searchBarVisible={searchBarVisible}
          recentSearches={recentSearches}
          lasPinasSuggestions={lasPinasSuggestions}
          onSearchPanelRef={(ref) => { searchPanelRef.current = ref?.current; }}
          onShowPlaceInfo={handleShowPlaceInfo}
          onSearchResultsChange={(results) => {
            // Only update search results state - don't move the map while typing
            // Map will only move when user clicks on a place (handled by handleShowPlaceInfo)
            setSearchResults(results);
            // Clear selected result when new search results come in (removes old pin)
            // This prevents showing a pin from previous search while typing
            setSelectedSearchResult(null);
          }}
        />
        </div>
      )}

      {/* Map Controls - GPS Status, Navigation Toggle, and FAB buttons - Hide when Active Incidents panel is open */}
      {!showTrafficMonitoringPanel && !showActiveIncidentsPanel && (
        <MapControls
          isNavigationActive={isNavigationActive}
          isSimulating={isSimulating}
          isTrackingLocation={isTrackingLocation}
          simulationSpeed={simulationSpeed}
          selectedRoute={selectedRoute}
          onStartNavigation={startNavigation}
          onStopNavigation={stopNavigation}
          onShowIncidentModal={setShowIncidentModal}
          onSetShowAuthPrompt={setShowAuthPrompt}
          onSetWeatherEnabled={setWeatherEnabled}
          weatherEnabled={weatherEnabled}
          onSetShowPredictionsPanel={setShowPredictionsPanel}
          onSetIsMiniOpen={setIsMiniOpen}
          isGuest={isGuest}
          onSetVoiceEnabled={setVoiceEnabled}
          voiceEnabled={voiceEnabled}
          showDirectionsPanel={showDirectionsPanel}
          isMiniOpen={isMiniOpen}
          showSimulationCompleteModal={showSimulationCompleteModal}
          showRulePanel={showRulePanel}
        />
      )}

      {/* Simulation Control Panel */}
      <SimulationPanel
        isSimulating={isSimulating}
        simulationProgress={simulationProgress}
        simulationPaused={simulationPaused}
        simulationSpeed={simulationSpeed}
        simulationMinimized={simulationMinimized}
        selectedOrigin={selectedOrigin}
        selectedDestination={selectedDestination}
        selectedRoute={selectedRoute}
        currentStep={currentStep}
        onTogglePause={toggleSimulationPause}
        onChangeSpeed={changeSimulationSpeed}
        onStop={stopSimulation}
        onToggleMinimize={() => setSimulationMinimized(!simulationMinimized)}
      />

      {/* New Navigation HUD - Google Maps/Waze Style */}
      {isNavigationActive && selectedRoute && (
        <NavigationHUD
          currentStep={currentStep}
          nextStep={nextStep}
          distanceToNextTurn={distanceToNextTurn}
          estimatedTimeRemaining={selectedRoute.estimated_duration_minutes}
          currentSpeed={currentSpeed}
          speedLimit={currentStep?.speed_limit}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
          onExit={stopNavigation}
          isMinimized={navigationHUDMinimized}
          onToggleMinimize={() => setNavigationHUDMinimized(!navigationHUDMinimized)}
        />
      )}

      {/* Route Alternatives Panel - DISABLED: Using new Google Maps style instead */}
      {/* <RouteAlternativesPanel
        routeAlternatives={routeAlternatives}
        selectedRoute={selectedRoute}
        onSelectRoute={selectRoute}
        onClose={() => setShowRouteAlternatives(false)}
        showRouteAlternatives={showRouteAlternatives}
        isNavigationActive={isNavigationActive}
        showSmartRoutePanel={showSmartRoutePanel}
      /> */}

      {/* Place Info Panel */}
      <PlaceInfoPanel
        place={selectedPlace}
        isOpen={showPlaceInfoPanel}
        isLoadingDirections={isLoadingData}
        onClose={() => {
          setShowPlaceInfoPanel(false);
          setSelectedPlace(null);
          // Clear the pin when panel is closed
          setSelectedSearchResult(null);
          // Clear routes when panel is closed by clicking outside
          // Only clear if directions panel is also closed (routes were from place info)
          if (!showDirectionsPanel) {
            setCurrentRoute(null);
            setSelectedRoute(null);
            setRouteAlternatives([]);
          }
        }}
        onDirections={handlePlaceDirections}
        onStart={handlePlaceStart}
        onCall={handlePlaceCall}
        onSave={handlePlaceSave}
        onShare={handlePlaceShare}
        currentLocation={userLocation}
        estimatedTravelTime={userLocation && selectedPlace && selectedPlace.lat && selectedPlace.lng ? 
          (() => {
            // Better travel time estimation using Haversine formula
            const R = 6371; // Earth's radius in km
            const dLat = (selectedPlace.lat - userLocation.lat) * Math.PI / 180;
            const dLng = (selectedPlace.lng - userLocation.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(selectedPlace.lat * Math.PI / 180) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            // Estimate travel time: assume average speed of 30 km/h in city
            const estimatedMinutes = Math.round((distance / 30) * 60);
            return estimatedMinutes;
          })() : null
        }
      />

      {/* Google Maps Style Directions Panel */}
      {showDirectionsPanel && (
        <GoogleMapsStyleNavigation
          origin={selectedOrigin?.name || 'Your location'}
          destination={selectedDestination?.name || 'Destination'}
          routes={(() => {
            const allRoutes = routeAlternatives.length > 0 ? routeAlternatives : (currentRoute?.routes || []);
            
            // If no routes, return default placeholder
            if (allRoutes.length === 0) {
              return [{
                duration: 0,
                distance: "Calculating...",
                arrivalTime: "--:--",
                label: "Calculating best route...",
                isBest: true,
                hasRestrictions: false
              }];
            }
            
            // Transform routes to Google Maps format
            return allRoutes.map((route, index) => {
              const duration = Math.round(route.estimated_duration_minutes || route.duration || 0);
              const distance = route.distance_km 
                ? `${route.distance_km.toFixed(1)} km` 
                : route.distance || '0 km';
              
              // Calculate arrival time
              const now = new Date();
              const arrivalTime = new Date(now.getTime() + duration * 60000);
              const formattedTime = arrivalTime.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              });

              return {
                duration,
                distance,
                arrivalTime: formattedTime,
                label: route.route_name || route.summary?.description || `Route ${index + 1}`,
                isBest: route.is_recommended || index === 0,
                hasRestrictions: route.has_tolls || route.has_restrictions || false
              };
            });
          })()}
          minimized={navigationPanelMinimized}
          onMinimizedChange={setNavigationPanelMinimized}
          onOriginChange={(value) => {
            setOriginQuery(value);
            // If origin is cleared, clear the selected origin
            if (!value || value.trim() === '') {
              setSelectedOrigin(null);
            }
          }}
          onDestinationChange={(value) => {
            setDestinationQuery(value);
            // If destination is cleared, clear the selected destination
            if (!value || value.trim() === '') {
              setSelectedDestination(null);
            }
          }}
          onOriginSelect={async (location) => {
            // Handle origin location selection from autocomplete
            if (location) {
              setSelectedOrigin(location);
              const locationName = location.name || location.display_name || location.address?.full || location.address?.freeformAddress || '';
              setOriginQuery(locationName);
              
              // If destination is already set, trigger route calculation
              if (selectedDestination && location.lat && location.lng && 
                  selectedDestination.lat && selectedDestination.lng) {
                setTimeout(async () => {
                  await handleGetRoute({}, location, selectedDestination);
                }, 100);
              }
            }
          }}
          onDestinationSelect={async (location) => {
            // Handle destination location selection from autocomplete
            if (location) {
              setSelectedDestination(location);
              const locationName = location.name || location.display_name || location.address?.full || location.address?.freeformAddress || '';
              setDestinationQuery(locationName);
              
              // If origin is already set, trigger route calculation
              if (selectedOrigin && location.lat && location.lng && 
                  selectedOrigin.lat && selectedOrigin.lng) {
                setTimeout(async () => {
                  await handleGetRoute({}, selectedOrigin, location);
                }, 100);
              }
            }
          }}
          onStart={() => {
            if (selectedRoute) {
              startNavigation();
              setShowDirectionsPanel(false);
            }
          }}
          onSave={() => {
            if (selectedRoute) {
              saveAsFavorite();
            }
          }}
          onClose={() => {
            // Clear routes and search inputs when closing the panel
            setSelectedRoute(null);
            setCurrentRoute(null);
            setRouteAlternatives([]);
            setShowRouteAlternatives(false);
            setSelectedOrigin(null);
            setSelectedDestination(null);
            setOriginQuery('');
            setDestinationQuery('');
            // Clear place info and search result markers
            setSelectedPlace(null);
            setSelectedSearchResult(null);
            setShowPlaceInfoPanel(false);
            setSearchResults([]);
            setShowDirectionsPanel(false);
            setNavigationPanelMinimized(true);
          }}
          onRouteSelectIndex={(index) => {
            const allRoutes = routeAlternatives.length > 0 ? routeAlternatives : (currentRoute?.routes || []);
            const picked = allRoutes[index];
            if (picked) {
              selectRoute(picked);
            }
          }}
          onSimulate={() => {
            startSimulation();
          }}
        />
      )}

      {/* Route Found Panel removed - functionality moved to Smart Route Panel */}

      {/* Search Results Sidebar - Desktop View */}
      {searchResults.length > 0 && !isNavigationActive && (
        <SearchResultsSidebar
          searchResults={searchResults}
          selectedResult={selectedSearchResult}
          onResultSelect={(result) => {
            setSelectedSearchResult(result);
            // Smoothly zoom in and center map on selected result
            if (result.lat && result.lng && mapRef.current) {
              // Use flyTo for smooth animation
              const targetZoom = 17; // Zoom in closer for better visibility
              mapRef.current.flyTo([result.lat, result.lng], targetZoom, {
                duration: 1.0,
                easeLinearity: 0.25
              });
              // Update state to keep in sync
              setMapCenter([result.lat, result.lng]);
              setMapZoom(targetZoom);
            }
          }}
          onResultClick={(result) => {
            // Get the location name
            const locationName = result.name || result.display_name || result.address?.full || result.address?.freeformAddress || 'Unknown Location';
            
            // Update the search bar with the location name
            setDestinationQuery(locationName);
            
            // Smoothly zoom in and center map first, then show place info panel
            if (result.lat && result.lng && mapRef.current) {
              const targetZoom = 17; // Zoom in closer for better visibility
              mapRef.current.flyTo([result.lat, result.lng], targetZoom, {
                duration: 1.0,
                easeLinearity: 0.25
              });
              setMapCenter([result.lat, result.lng]);
              setMapZoom(targetZoom);
              // Set selected result to show pin with animation
              setSelectedSearchResult(result);
            }
            // Show place info panel after a short delay to allow zoom animation
            setTimeout(() => {
              setSelectedPlace({
                name: locationName,
                lat: result.lat,
                lng: result.lng,
                address: result.address?.full || result.address?.freeformAddress || '',
                type: result.type || 'general'
              });
              setShowPlaceInfoPanel(true);
            }, 500);
          }}
          onClose={() => {
            setSearchResults([]);
            setSelectedSearchResult(null);
          }}
          isOpen={searchResults.length > 0}
        />
      )}

      {/* Left Side Panel - extracted component */}
      <TrafficMapSidebar
        sidebarOpen={showSidePanel}
        onClose={() => setShowSidePanel(false)}
        onBackToDashboard={() => navigate('/dashboard')}
        travelHistory={travelHistory}
        onOpenHistory={() => { setShowHistoryPanel(!showHistoryPanel); setShowSidePanel(false); }}
        onOpenEmergencyReports={() => { 
          if (user) {
            setShowEmergencyReportsPanel(!showEmergencyReportsPanel); 
            setShowSidePanel(false);
          } else {
            toast.error('Please login to view emergency reports');
          }
        }}
        myEmergencyReports={myEmergencyReports}
        onOpenActiveIncidents={() => {
          setShowActiveIncidentsPanel(true);
          // Close sidebar after opening Active Incidents for better UX
          setShowSidePanel(false);
          // Enable traffic monitoring to load data (but don't show the panel)
          if (!trafficMonitorNewEnabled) {
            setTrafficMonitorNewEnabled(true);
          }
          // Ensure Traffic Monitoring Panel is closed when opening Active Incidents Panel
          if (showTrafficMonitoringPanel) {
            setShowTrafficMonitoringPanel(false);
          }
        }}
        activeIncidentsCount={(tmRoadworks?.length || 0) + (tmIncidents?.length || 0)}
        // Disable legacy heatmap control
        heatmapEnabled={false}
        setHeatmapEnabled={() => {}}
        trafficLayerEnabled={trafficLayerEnabled}
        setTrafficLayerEnabled={setTrafficLayerEnabled}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
        parkingEnabled={parkingEnabled}
        setParkingEnabled={setParkingEnabled}
        weatherEnabled={weatherEnabled}
        setWeatherEnabled={setWeatherEnabled}
        // emergencyEnabled={emergencyEnabled}
        // setEmergencyEnabled={setEmergencyEnabled}
        trafficMonitorNewEnabled={trafficMonitorNewEnabled}
        setTrafficMonitorNewEnabled={setTrafficMonitorNewEnabled}
        reportsEnabled={reportsEnabled}
        setReportsEnabled={setReportsEnabled}
        incidentProneEnabled={incidentProneEnabled}
        setIncidentProneEnabled={setIncidentProneEnabled}
        floodZonesEnabled={floodZonesEnabled}
        setFloodZonesEnabled={setFloodZonesEnabled}
        showPredictionsPanel={showPredictionsPanel}
        setShowPredictionsPanel={setShowPredictionsPanel}
        isGuest={isGuest}
        // 3D map overlay removed
      />

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        travelHistory={travelHistory}
        frequentLocations={frequentLocations}
        onLocationSelect={handleLocationSelect}
      />

      {/* Traffic Monitoring Panel */}
      <TrafficMonitoringPanel
        isOpen={showTrafficMonitoringPanel}
        onClose={() => {
          setShowTrafficMonitoringPanel(false);
          setTrafficMonitorNewEnabled(false);
        }}
        mapCenter={mapCenter}
        mapBounds={mapRef.current?.getBounds() || null}
      />

      {/* Emergency Reports Panel */}
      <EmergencyReportsPanel
        isOpen={showEmergencyReportsPanel}
        onClose={() => setShowEmergencyReportsPanel(false)}
        mapRef={mapRef}
        onEmergencyClick={(emergency) => {
          // Highlight the emergency on the map if needed
          if (emergency.latitude && emergency.longitude) {
            setHighlightedIncident({
              lat: emergency.latitude,
              lng: emergency.longitude,
              title: emergency.title || emergency.emergency_type?.replace('_', ' '),
              severity: emergency.severity,
            });
          }
        }}
      />

      {/* Active Incidents Panel - Accessible to all users, especially CITIZEN */}
      <ActiveIncidentsPanel
        isOpen={showActiveIncidentsPanel}
        onClose={() => {
          setShowActiveIncidentsPanel(false);
          // Disable traffic monitoring when panel closes to prevent Traffic Monitoring Panel from auto-opening
          setTrafficMonitorNewEnabled(false);
        }}
        incidents={tmIncidents || []}
        roadworks={tmRoadworks || []}
        onIncidentClick={(item) => {
          // Highlight the incident on the map
          if (item.latitude && item.longitude) {
            setHighlightedIncident({
              lat: item.latitude,
              lng: item.longitude,
              title: item.title,
              severity: item.severity,
            });
          }
        }}
        mapRef={mapRef}
        mapCenter={mapCenter}
      />

      {/* Route Loading Overlay - Enhanced with Skeleton */}
      {isLoadingRoute && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 flex flex-col items-center space-y-4 shadow-2xl border border-white/30 animate-scale-in min-w-[280px]">
            <div className="relative">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="absolute inset-0 rounded-full bg-blue-100 animate-ping opacity-20"></div>
            </div>
            <div className="text-center space-y-2">
              <span className="text-gray-800 font-semibold text-lg block">Calculating route...</span>
              <div className="flex space-x-1 justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
            {/* Route Loading Skeleton */}
            <div className="w-full space-y-3 mt-4">
              <div className="h-4 bg-gray-200 rounded-full animate-pulse w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded-full animate-pulse w-1/2"></div>
              <div className="flex space-x-3">
                <div className="h-12 bg-gray-200 rounded-xl animate-pulse flex-1"></div>
                <div className="h-12 bg-gray-200 rounded-xl animate-pulse flex-1"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NEW: 5 PRIORITY FEATURES UI COMPONENTS */}
      {/* ============================================ */}

      {/* Weather Alert Banner - Hide during simulation */}
      {showWeatherAlert && weatherWarnings.length > 0 && !showDirectionsPanel && !isSimulating && (
        <div className="absolute top-20 left-4 right-4 z-40 max-w-2xl mx-auto">
          <WeatherAlertBanner
            weather={weatherData}
            warnings={weatherWarnings}
            onDismiss={() => setShowWeatherAlert(false)}
          />
        </div>
      )}


      {/* Voice Navigation Panel - Only show when navigation is active */}
      {isNavigationActive && (
        <div className="absolute top-32 right-4 z-40 max-w-sm hidden md:block">
          <VoiceNavigationPanel />
        </div>
      )}

      {/* Auth Prompt Modal for guests */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAuthPrompt(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-200 w-[92%] max-w-md p-6 sm:p-7">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-xl font-bold text-gray-900">Sign in to report incidents</h3>
              <button onClick={() => setShowAuthPrompt(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-5">Create a quick report with photos and location. Log in or sign up to continue.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => navigate('/login')} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Login</button>
              <button onClick={() => navigate('/register')} className="flex-1 px-4 py-2.5 bg-white text-blue-700 border border-blue-300 rounded-xl hover:bg-blue-50 font-semibold">Sign up</button>
              <button onClick={() => setShowAuthPrompt(false)} className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold">Maybe later</button>
            </div>
          </div>
        </div>
      )}

      {/* Incident Report Modal - Hide during simulation */}
      {!isSimulating && (
        <IncidentReportModal
          isOpen={showIncidentModal}
          onClose={() => setShowIncidentModal(false)}
          onSubmit={handleIncidentReport}
          currentLocation={userLocation || { lat: mapCenter[0], lng: mapCenter[1] }}
        />
      )}

      {/* Multi-Stop Planner - Left Side */}
      {multiStopMode && (
        <div className="absolute top-24 left-4 z-40 max-w-md w-full sm:w-96">
          <MultiStopPlanner
            stops={stops}
            onStopsChange={setStops}
            onCalculateRoute={calculateMultiStopRoute}
          />
        </div>
      )}

      {/* Guest CTA Banner removed per request */}

      {/* Guest Intro Overlay */}
      {isGuest && showGuestIntro && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-200 max-w-2xl w-[92%] p-6 sm:p-8">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Explore Traffic Map (Guest)</h3>
              <button onClick={startGuestExplore} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-gray-600 mb-4">You can try Smart routing and Predictions without an account. To report incidents, save routes and history, or share trips, please sign in.</p>
            <ul className="text-sm text-gray-700 mb-6 list-disc pl-5 space-y-1">
              <li>Use the top search bar to set origin and destination</li>
              <li>Tap <span className="font-semibold">Smart</span> for the best route right now</li>
              <li>Tap <span className="font-semibold">Predictions</span> to foresee future traffic</li>
            </ul>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button onClick={startGuestExplore} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">Explore as Guest</button>
              <button onClick={() => navigate('/login')} className="flex-1 px-4 py-2.5 bg-white text-blue-700 border border-blue-300 rounded-xl hover:bg-blue-50 font-semibold">Login</button>
              <button onClick={() => navigate('/register')} className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold">Create account</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Trip Toggle Button - Bottom Left */}
      {!isGuest && selectedRoute && !multiStopMode && !showSidePanel && !showSharePanel && !isNavigationActive && (
        <button
          onClick={() => setShowSharePanel(true)}
          className="absolute bottom-4 left-4 z-40 px-4 py-3 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition-all hover:scale-105 active:scale-95 flex items-center space-x-2"
          title="Share Your Trip"
        >
          <Share2 className="w-5 h-5" />
          <span className="text-sm font-semibold">Share Trip</span>
        </button>
      )}

      {/* Location Share Panel - Bottom Left */}
      {!isGuest && showSharePanel && selectedRoute && !multiStopMode && !showSidePanel && (
        <div className="absolute bottom-4 left-4 z-40 max-w-sm w-full sm:w-80">
          <LocationSharePanel
            userId={user?.uid}
            userName={user?.displayName || 'Anonymous'}
            origin={selectedOrigin}
            destination={selectedDestination}
            routeData={selectedRoute}
            currentLocation={userLocation}
            onClose={() => setShowSharePanel(false)}
          />
        </div>
      )}

      {/* Street View Panel - Mobile Friendly */}
      {showStreetView && selectedParkingZone && selectedParkingZone.center && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            onClick={() => setShowStreetView(false)}
          />
          
          {/* Street View Panel */}
          <div 
            className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[90vw] md:max-w-4xl md:h-[80vh] z-[61] bg-white rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200 flex-shrink-0">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg">🚫 Street View</h3>
                {selectedParkingZone.name && (
                  <p className="text-sm text-gray-600 mt-1">{selectedParkingZone.name}</p>
                )}
              </div>
              <button
                onClick={() => setShowStreetView(false)}
                className="p-2 hover:bg-red-200 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90"
                aria-label="Close Street View"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            
            {/* Street View Content */}
            <div className="flex-1 relative min-h-0 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
              {selectedParkingZone.center && (
                <div className="text-center max-w-md w-full">
                  <div className="mb-6">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4">
                      <span className="text-4xl">🚫</span>
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">No-Parking Zone</h4>
                    {selectedParkingZone.name && (
                      <p className="text-sm text-gray-600 mb-1">{selectedParkingZone.name}</p>
                    )}
                    {selectedParkingZone.description && (
                      <p className="text-xs text-gray-500 mb-3">{selectedParkingZone.description}</p>
                    )}
                    {selectedParkingZone.radius && (
                      <p className="text-xs text-gray-500">Radius: {selectedParkingZone.radius}m</p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const streetViewUrl = `https://www.google.com/maps?q=&layer=c&cbll=${selectedParkingZone.center[0]},${selectedParkingZone.center[1]}`;
                        window.open(streetViewUrl, '_blank', 'noopener,noreferrer');
                        setShowStreetView(false);
                      }}
                      className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-5 h-5" />
                      Open Street View in Google Maps
                    </button>
                    
                    <button
                      onClick={() => {
                        const mapsUrl = `https://www.google.com/maps?q=${selectedParkingZone.center[0]},${selectedParkingZone.center[1]}`;
                        window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
                    >
                      View on Map
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-4">
                    Street View will open in a new window
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer Info */}
            {(selectedParkingZone.restriction_reason || selectedParkingZone.reason) && (
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
                <p className="text-xs text-gray-600">
                  <span className="font-medium">Restriction:</span> {selectedParkingZone.restriction_reason || selectedParkingZone.reason}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* END OF NEW FEATURES UI COMPONENTS */}
      {/* ============================================ */}

      {/* Smart Route Panel - Bottom Sheet */}
      <SmartRoutePanel
        isOpen={showSmartRoutePanel}
        onClose={() => {
          setShowSmartRoutePanel(false);
          // Clear trip when user closes the panel to remove route and play button
          clearTrip();
        }}
        initialOrigin={selectedOrigin}
        initialDestination={selectedDestination}
        onRouteSelect={(route, origin, destination, allRoutes) => {
          // Update selected locations
          if (origin) {
            setSelectedOrigin(origin);
            setOriginQuery(origin.name || origin.display_name || '');
          }
          if (destination) {
            setSelectedDestination(destination);
            setDestinationQuery(destination.name || destination.display_name || '');
          }
          
          // Update route state
          setSelectedRoute(route);
          setCurrentRoute({ routes: allRoutes || [], recommended_route: route });
          setRouteAlternatives(allRoutes || []);
          
          // Show route alternatives if multiple routes
          if (allRoutes && allRoutes.length > 1) {
            setShowRouteAlternatives(true);
          }
          
          // Center map on route
          if (route && route.bounds) {
            const { southwest, northeast } = route.bounds;
            if (southwest && northeast && southwest[0] && southwest[1] && northeast[0] && northeast[1]) {
              setMapCenter([
                (southwest[0] + northeast[0]) / 2,
                (southwest[1] + northeast[1]) / 2
              ]);
              setMapZoom(12);
            }
          }
        }}
        onStartNavigation={(route) => {
          // Start navigation with the selected route
          setSelectedRoute(route);
          setShowSmartRoutePanel(false);
          startNavigation();
        }}
        onStartSimulation={(route) => {
          // Start simulation with the selected route
          setSelectedRoute(route);
          setShowSmartRoutePanel(false);
          startSimulation();
        }}
      />

      {/* Weather & Flood Advisory Panel - Bottom Overlay - Hide during simulation */}
        <WeatherFloodAdvisory 
          mapCenter={mapCenter}
          locationName="Las Piñas City"
          sidebarOpen={showSidePanel}
        shouldHide={isSimulating || showSmartRoutePanel || isNavigationActive || isMiniOpen || showIncidentModal || showPredictionsPanel || showSharePanel || showTrafficMonitoringPanel || showDirectionsPanel}
        />

      {/* Traffic Predictions Panel - Hide during simulation */}
      {showPredictionsPanel && !isSimulating && (
        <TrafficPredictionsPanel
          isOpen={showPredictionsPanel}
          onClose={(e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            
            setShowPredictionsPanel(false);
          }}
          selectedRoute={selectedRoute}
          selectedOrigin={selectedOrigin}
          selectedDestination={selectedDestination}
        />
      )}

      {/* Simulation Completion Modal - Modern Design - Mobile Optimized */}
      {showSimulationCompleteModal && simulationCompleteData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          {/* Backdrop with blur */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => {
              setShowSimulationCompleteModal(false);
              setSimulationCompleteData(null);
            }}
          />
          
          {/* Modal Content - Scrollable on mobile */}
          <div 
            className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md my-auto animate-scale-in overflow-hidden border border-gray-100 flex flex-col"
            style={{
              maxHeight: 'min(95vh, calc(100dvh - 40px))'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button - Top Right */}
            <button
              onClick={() => {
                setShowSimulationCompleteModal(false);
                setSimulationCompleteData(null);
              }}
              className="absolute top-3 right-3 z-20 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Success Icon Header with Gradient */}
            <div className="relative bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 px-4 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10 text-center overflow-hidden flex-shrink-0">
              {/* Animated Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
                <div className="absolute bottom-0 right-0 w-40 h-40 bg-white rounded-full translate-x-1/2 translate-y-1/2 blur-2xl"></div>
              </div>
              
              {/* Success Icon */}
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-lg rounded-full mb-3 sm:mb-4 animate-scale-in">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">Trip Complete!</h2>
                <p className="text-green-50 text-xs sm:text-sm md:text-base">Simulation finished successfully</p>
              </div>
            </div>

            {/* Content Section - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
              {/* Trip Summary Cards - Better mobile layout */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                {/* Distance Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-blue-200">
                  <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 sm:mb-2">
                    <Route className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs font-semibold text-blue-700 uppercase tracking-wide">Distance</span>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-900">
                    {simulationCompleteData.distanceKm.toFixed(1)} km
                  </p>
                </div>

                {/* Duration Card */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-purple-200">
                  <div className="flex items-center space-x-1.5 sm:space-x-2 mb-1.5 sm:mb-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs font-semibold text-purple-700 uppercase tracking-wide">Duration</span>
                  </div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-900">
                    {Math.round(simulationCompleteData.durationMinutes)}m
                  </p>
                </div>
              </div>

              {/* Route Info - Improved mobile layout */}
              <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 mb-4 sm:mb-6 border border-gray-200">
                <div className="space-y-2 sm:space-y-3">
                  {/* Origin */}
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1">Origin</p>
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{simulationCompleteData.origin}</p>
                    </div>
                  </div>

                  {/* Route Line */}
                  <div className="flex items-center space-x-2 sm:space-x-3 ml-3.5 sm:ml-4">
                    <div className="w-0.5 h-6 sm:h-8 bg-gradient-to-b from-blue-400 to-red-400"></div>
                  </div>

                  {/* Destination */}
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1">Destination</p>
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 break-words">{simulationCompleteData.destination}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Messages - Mobile optimized */}
              {simulationCompleteData.saveSuccess && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl sm:rounded-2xl border border-green-200 flex items-start space-x-2 sm:space-x-3 animate-slide-down">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-green-900 mb-0.5 sm:mb-1">Saved to Travel History</p>
                    <p className="text-[10px] sm:text-xs text-green-700 break-words">Your trip has been saved and added to your travel history.</p>
                  </div>
                </div>
              )}

              {simulationCompleteData.isGuest && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl sm:rounded-2xl border border-blue-200 flex items-start space-x-2 sm:space-x-3 animate-slide-down">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-0.5 sm:mb-1">Sign in to Save Trips</p>
                    <p className="text-[10px] sm:text-xs text-blue-700 break-words">Create an account to automatically save your trips and access travel history.</p>
                  </div>
                </div>
              )}

              {simulationCompleteData.saveError && !simulationCompleteData.isGuest && (
                <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex items-start space-x-2 sm:space-x-3 animate-slide-down ${
                  simulationCompleteData.isAuthError 
                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200'
                    : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                }`}>
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    simulationCompleteData.isAuthError ? 'bg-yellow-500' : 'bg-red-500'
                  }`}>
                    <AlertTriangle className={`w-3 h-3 sm:w-4 sm:h-4 ${
                      simulationCompleteData.isAuthError ? 'text-yellow-900' : 'text-white'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1 ${
                      simulationCompleteData.isAuthError ? 'text-yellow-900' : 'text-red-900'
                    }`}>
                      {simulationCompleteData.isAuthError ? 'Authentication Required' : 'Save Failed'}
                    </p>
                    <p className={`text-[10px] sm:text-xs break-words ${
                      simulationCompleteData.isAuthError ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {simulationCompleteData.isAuthError 
                        ? 'Please log in to save trips to your travel history.'
                        : `Could not save trip: ${simulationCompleteData.saveError}`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons - Mobile optimized */}
              <div className="flex flex-col gap-2 sm:gap-3">
                {simulationCompleteData.isGuest && (
                  <button
                    onClick={() => {
                      setShowSimulationCompleteModal(false);
                      setSimulationCompleteData(null);
                      navigate('/login');
                    }}
                    className="w-full px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg sm:rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <span className="text-sm sm:text-base">Sign In</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
                
                {simulationCompleteData.saveError && !simulationCompleteData.isGuest && simulationCompleteData.isAuthError && (
                  <button
                    onClick={() => {
                      setShowSimulationCompleteModal(false);
                      setSimulationCompleteData(null);
                      navigate('/login');
                    }}
                    className="w-full px-4 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-lg sm:rounded-xl font-semibold hover:from-yellow-600 hover:to-amber-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] min-h-[44px]"
                  >
                    <span className="text-sm sm:text-base">Log In</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowSimulationCompleteModal(false);
                    setSimulationCompleteData(null);
                  }}
                  className={`w-full px-4 sm:px-6 py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] min-h-[44px] ${
                    simulationCompleteData.isGuest || simulationCompleteData.saveError
                      ? 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                  }`}
                >
                  <span className="text-sm sm:text-base">{simulationCompleteData.saveSuccess ? 'Done' : 'Close'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </ErrorBoundary>
    </DarkModeProvider>
  );
};

export default TrafficMap;
