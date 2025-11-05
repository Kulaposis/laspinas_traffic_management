import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap, ScaleControl, ZoomControl, Polygon, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MiniDashboardSheet from '../components/MiniDashboardSheet';
import './TrafficMap.css';
import TrafficMapSidebar from '../components/TrafficMapSidebar';
import { MapSkeleton } from '../components/LoadingSkeleton';
import ErrorBoundary from '../components/ErrorBoundary';
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
  RouteAlternativesPanel
} from '../components/mapUI';
// Custom Hooks
import { useMapData } from '../hooks/useMapData';
import { useLocationTracking } from '../hooks/useLocationTracking';
// Utils
import { createCustomIcon, createNoParkingIcon, createNavigationIcon } from '../utils/mapIcons';
import { formatCoords, getTripPlaceName } from '../utils/mapHelpers';
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
import MultiStopPlanner from '../components/MultiStopPlanner';
import LocationSharePanel from '../components/LocationSharePanel';
import WeatherAlertBanner from '../components/WeatherAlertBanner';
import SmartRoutePanel from '../components/SmartRoutePanel';
import WeatherFloodAdvisory from '../components/WeatherFloodAdvisory';
import TrafficPredictionsPanel from '../components/TrafficPredictionsPanel';

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
  const [emergencyEnabled, setEmergencyEnabled] = useState(false);
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

  // Popular Las Piñas City locations for quick suggestions
  const lasPinasSuggestions = [
    { name: 'SM Southmall', lat: 14.4504, lng: 121.0170, category: 'Shopping', icon: '🛒' },
    { name: 'Las Piñas City Hall', lat: 14.4378, lng: 121.0122, category: 'Government', icon: '🏛️' },
    { name: 'Alabang-Zapote Road', lat: 14.4450, lng: 121.0200, category: 'Road', icon: '🛣️' },
    { name: 'Robinsons Place Las Piñas', lat: 14.4420, lng: 121.0190, category: 'Shopping', icon: '🛒' },
    { name: 'University of Perpetual Help System', lat: 14.4456, lng: 121.0156, category: 'Education', icon: '🎓' },
    { name: 'Zapote Market', lat: 14.4456, lng: 121.0189, category: 'Market', icon: '🏪' },
    { name: 'BF Homes Las Piñas', lat: 14.4389, lng: 121.0344, category: 'Residential', icon: '🏘️' },
    { name: 'Las Piñas City Medical Center', lat: 14.4370, lng: 121.0130, category: 'Healthcare', icon: '🏥' },
    { name: 'St. Joseph Parish Church', lat: 14.4380, lng: 121.0120, category: 'Religious', icon: '⛪' },
    { name: 'Evia Lifestyle Center', lat: 14.4280, lng: 121.0250, category: 'Shopping', icon: '🛒' },
    { name: 'Pillar Village', lat: 14.4350, lng: 121.0200, category: 'Residential', icon: '🏘️' },
    { name: 'Alabang', lat: 14.4195, lng: 121.0401, category: 'District', icon: '📍' }
  ];

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

  // GPS and navigation tracking
  const [userLocation, setUserLocation] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);
  const [navigationProgress, setNavigationProgress] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const [userHeading, setUserHeading] = useState(0); // Device heading for map rotation
  const [mapRotation, setMapRotation] = useState(0); // Map rotation angle
  const [gyroscopeEnabled, setGyroscopeEnabled] = useState(false); // Gyroscope toggle
  const [navigationIcon, setNavigationIcon] = useState('car'); // Selected navigation icon
  const [showIconSelector, setShowIconSelector] = useState(false); // Icon selector visibility

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
  const [showSettings, setShowSettings] = useState(false);
  const [selectedParkingZone, setSelectedParkingZone] = useState(null);
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapStyle, setMapStyle] = useState('main');
  const [heatmapEnabled, setHeatmapEnabled] = useState(false); // Disabled by default to remove random lines
  const [trafficLayerEnabled, setTrafficLayerEnabled] = useState(true); // Enabled - uses TomTom API for real traffic data
  const [trafficMonitorNewEnabled, setTrafficMonitorNewEnabled] = useState(false);
  // Removed 3D map overlay feature
  
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
  const [isScrapingIncidentProne, setIsScrapingIncidentProne] = useState(false);
  const [showGuestIntro, setShowGuestIntro] = useState(false);

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
    emergencyEnabled,
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
  const searchPanelRef = useRef(null);

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

  // Load user's personalized data
  useEffect(() => {
    loadUserData();
  }, [user]);

  // Load traffic and heatmap data (keep for now, will refactor later)
  useEffect(() => {
    loadTrafficData();
    const interval = setInterval(loadTrafficData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [mapCenter, mapZoom]);

  // Load traffic data for selected route
  useEffect(() => {
    if (selectedRoute && selectedRoute.route_coordinates) {
      loadRouteTrafficData();
      const interval = setInterval(loadRouteTrafficData, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [selectedRoute]);

  const loadUserData = async () => {
    if (!user) {
      // Guest mode: no user-specific data
      setTravelHistory([]);
      setFrequentLocations([]);
      setFavoriteRoutes([]);
      setTravelStats(null);
      return;
    }

    try {
      // Load travel history with individual error handling
      const results = await Promise.allSettled([
        travelHistoryService.getTravelHistory({ limit: 20 }).catch(() => []),
        travelHistoryService.getFrequentLocations({ limit: 10 }).catch(() => []),
        travelHistoryService.getFavoriteRoutes().catch(() => []),
        travelHistoryService.getTravelStats().catch(() => null)
      ]);

      setTravelHistory(results[0].status === 'fulfilled' ? results[0].value : []);
      setFrequentLocations(results[1].status === 'fulfilled' ? results[1].value : []);
      setFavoriteRoutes(results[2].status === 'fulfilled' ? results[2].value : []);
      setTravelStats(results[3].status === 'fulfilled' ? results[3].value : null);
    } catch (error) {
      
      // Gracefully handle missing travel history - set empty defaults
      setTravelHistory([]);
      setFrequentLocations([]);
      setFavoriteRoutes([]);
      setTravelStats(null);
    }
  };

  const loadTrafficData = async () => {
    setIsLoadingData(true);
    try {
      // Try to fetch real traffic data from API
      try {
        const bounds = mapRef.current?.getBounds();
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          
          // Fetch traffic heatmap data
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/traffic/monitoring/heatmap?` +
            `lat_min=${sw.lat}&lat_max=${ne.lat}&lng_min=${sw.lng}&lng_max=${ne.lng}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.heatmap_data && Array.isArray(data.heatmap_data)) {
              // Render a road-aligned heatmap regardless of API shape for consistent alignment
              const roadAligned = generateRoadBasedHeatmapData(mapCenter);
              const boundedRoadAligned = roadAligned.filter(p => (
                p[0] >= defaultBounds.lat_min &&
                p[0] <= defaultBounds.lat_max &&
                p[1] >= defaultBounds.lng_min &&
                p[1] <= defaultBounds.lng_max
              ));
              setHeatmapData(boundedRoadAligned);
              return;
            }
          }
        }
      } catch (apiError) {
        
      }

      // Fallback: Generate enhanced mock heatmap data that follows road patterns
      const mockHeatmapData = generateRoadBasedHeatmapData(mapCenter);
      const boundedMock = mockHeatmapData.filter(p => (
        p[0] >= defaultBounds.lat_min &&
        p[0] <= defaultBounds.lat_max &&
        p[1] >= defaultBounds.lng_min &&
        p[1] <= defaultBounds.lng_max
      ));
      setHeatmapData(boundedMock);
      // Convert mock heatmap data to traffic data format for 3D visualization
      const mockTrafficData = mockHeatmapData.map((point, index) => ({
        latitude: point[0],
        longitude: point[1],
        lat: point[0],
        lng: point[1],
        intensity: point[2] || 0.5,
        road_name: `Road Segment ${Math.floor(index / 10)}`,
        status: point[2] < 0.3 ? 'free_flow' : point[2] < 0.5 ? 'light' : point[2] < 0.7 ? 'moderate' : point[2] < 0.9 ? 'heavy' : 'standstill',
        traffic_status: point[2] < 0.3 ? 'free_flow' : point[2] < 0.5 ? 'light' : point[2] < 0.7 ? 'moderate' : point[2] < 0.9 ? 'heavy' : 'standstill',
        vehicle_count: Math.floor(point[2] * 50),
        congestion_percentage: Math.floor(point[2] * 100)
      }));
      setTrafficData(mockTrafficData);
    } catch (error) {
      
      // Final fallback
      const mockHeatmapData = generateRoadBasedHeatmapData(mapCenter);
      const boundedMock = mockHeatmapData.filter(p => (
        p[0] >= defaultBounds.lat_min &&
        p[0] <= defaultBounds.lat_max &&
        p[1] >= defaultBounds.lng_min &&
        p[1] <= defaultBounds.lng_max
      ));
      setHeatmapData(boundedMock);
      // Convert mock heatmap data to traffic data format for 3D visualization
      const mockTrafficData = mockHeatmapData.map((point, index) => ({
        latitude: point[0],
        longitude: point[1],
        lat: point[0],
        lng: point[1],
        intensity: point[2] || 0.5,
        road_name: `Road Segment ${Math.floor(index / 10)}`,
        status: point[2] < 0.3 ? 'free_flow' : point[2] < 0.5 ? 'light' : point[2] < 0.7 ? 'moderate' : point[2] < 0.9 ? 'heavy' : 'standstill',
        traffic_status: point[2] < 0.3 ? 'free_flow' : point[2] < 0.5 ? 'light' : point[2] < 0.7 ? 'moderate' : point[2] < 0.9 ? 'heavy' : 'standstill',
        vehicle_count: Math.floor(point[2] * 50),
        congestion_percentage: Math.floor(point[2] * 100)
      }));
      setTrafficData(mockTrafficData);
    } finally {
      setIsLoadingData(false);
    }
  };

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
        
        // Search for locations with Las Piñas bias
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 15, // More results for better selection
          countrySet: 'PH',
          center: lasPinasCenter, // Bias towards Las Piñas
          radius: 15000 // 15km radius around Las Piñas
        });

        

        // Filter and prioritize Las Piñas results
        const lasPinasResults = results.filter(result => 
          result.address?.municipality?.toLowerCase().includes('las piñas') ||
          result.address?.municipality?.toLowerCase().includes('las pinas') ||
          result.address?.countrySubdivision?.toLowerCase().includes('las piñas')
        );

        const nearbyResults = results.filter(result => 
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

            if (mode === 'origin') {
              setSelectedOrigin(location);
              setOriginQuery(location.name);
            } else {
              setSelectedDestination(location);
              setDestinationQuery(location.name);
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
            if (mode === 'origin') {
              setSelectedOrigin(location);
              setOriginQuery(location.name);
            } else {
              setSelectedDestination(location);
              setDestinationQuery(location.name);
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

  // Swap origin and destination
  const swapLocations = () => {
    const tempOrigin = selectedOrigin;
    const tempOriginQuery = originQuery;

    setSelectedOrigin(selectedDestination);
    setOriginQuery(destinationQuery);

    setSelectedDestination(tempOrigin);
    setDestinationQuery(tempOriginQuery);
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
  const handleGetRoute = async (routeOptions = {}) => {
    if (!selectedOrigin || !selectedDestination) {
      
      return;
    }

    // Validate coordinates
    if (!selectedOrigin.lat || !selectedOrigin.lng || !selectedDestination.lat || !selectedDestination.lng) {
      
      alert('Invalid location coordinates. Please select valid locations.');
      return;
    }

    setIsLoadingData(true);
    try {

      const defaultOptions = {
        avoidTraffic: true,
        maxAlternatives: 3,
        ...routeOptions
      };

      const routeData = await enhancedRoutingService.getDetailedRoute(
        selectedOrigin.lat,
        selectedOrigin.lng,
        selectedDestination.lat,
        selectedDestination.lng,
        defaultOptions
      );

      

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        // Validate route data structure
        const validRoutes = routeData.routes.filter(route => {
          if (!route.route_coordinates || !Array.isArray(route.route_coordinates) || route.route_coordinates.length < 2) {
            
            return false;
          }
          return true;
        });

        if (validRoutes.length === 0) {
          alert('No valid routes found. Please try different locations.');
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
        alert('No route found. Please check your locations and try again.');
      }
    } catch (error) {
      
      alert('Error calculating route. Please check your locations and try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Select a specific route from alternatives
  const selectRoute = (route) => {
    setSelectedRoute(route);
    setShowRouteAlternatives(false);
  };

  // Get route with specific criteria
  const getRouteWithCriteria = (criteria) => {
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
  const startNavigation = () => {
    if (!selectedRoute) return;

    setIsNavigationActive(true);
    setNavigationStep(0);
    
    // Hide route alternatives panel when starting navigation
    setShowRouteAlternatives(false);

    // Start GPS tracking
    startLocationTracking();

    // Auto-zoom to route starting point (origin) with smooth animation - similar to Google Maps
    if (selectedOrigin && selectedOrigin.lat && selectedOrigin.lng) {
      setTimeout(() => {
        smoothZoomToLocation([selectedOrigin.lat, selectedOrigin.lng], 18);
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

    // Stop GPS tracking
    stopLocationTracking();
    
    // Stop simulation if active
    stopSimulation();
  };

  // Handle device orientation for gyroscope-based map rotation
  const handleDeviceOrientation = useCallback((event) => {
    if (!gyroscopeEnabled || !isNavigationActive) return;

    let heading = 0;
    
    // iOS devices
    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading;
    }
    // Android devices
    else if (event.alpha !== null && event.alpha !== undefined) {
      // Convert device orientation to compass heading
      heading = (360 - event.alpha) % 360;
    }
    // GPS heading fallback
    else if (userLocation?.heading !== undefined) {
      heading = userLocation.heading;
    }

    setUserHeading(heading);
    setMapRotation(heading);
  }, [gyroscopeEnabled, isNavigationActive, userLocation]);

  // Start gyroscope/device orientation tracking
  useEffect(() => {
    if (gyroscopeEnabled && isNavigationActive) {
      // Request permission for device orientation (iOS 13+)
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleDeviceOrientation);
            }
          })
          .catch(() => {
            console.warn('Device orientation permission denied');
          });
      } else {
        // Android and older iOS
        window.addEventListener('deviceorientation', handleDeviceOrientation);
      }

      return () => {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
      };
    }
  }, [gyroscopeEnabled, isNavigationActive, handleDeviceOrientation]);

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
          heading: position.coords.heading || null
        };

        setUserLocation(location);
        setIsTrackingLocation(true);

        // Update heading if GPS provides it and gyroscope is not enabled
        if (!gyroscopeEnabled && location.heading !== null) {
          setUserHeading(location.heading);
        }

        // Center map on user location if navigation is active
        if (isNavigationActive) {
          setMapCenter([location.lat, location.lng]);
          setMapZoom(16);
          
          // Apply map rotation if gyroscope is enabled
          if (gyroscopeEnabled && mapRef.current) {
            const map = mapRef.current;
            if (map && typeof map.setBearing === 'function') {
              map.setBearing(userHeading);
            }
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
        timeout: 10000,
        maximumAge: 30000 // Accept location up to 30 seconds old
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
      // Navigation complete
      setIsNavigationActive(false);
      setNavigationStep(0);
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
    
    // Set initial simulated location to origin
    const startCoords = selectedRoute.route_coordinates[0];
    setSimulatedLocation({
      lat: startCoords[0],
      lng: startCoords[1],
      timestamp: Date.now()
    });

    // Center map on starting point
    setMapCenter([startCoords[0], startCoords[1]]);
    setMapZoom(16);

    // Start simulation animation
    runSimulation();
  };

  // Run simulation animation
  const runSimulation = () => {
    if (!selectedRoute || !selectedRoute.route_coordinates) return;

    const totalPoints = selectedRoute.route_coordinates.length;
    let currentIndex = currentSimulationIndex;

    // Calculate interval based on speed (faster = shorter interval)
    const baseInterval = 100; // milliseconds
    const interval = baseInterval / simulationSpeed;

    simulationIntervalRef.current = setInterval(() => {
      if (simulationPaused) return;

      currentIndex++;
      
      if (currentIndex >= totalPoints) {
        // Simulation complete
        completeSimulation();
        return;
      }

      const coords = selectedRoute.route_coordinates[currentIndex];
      const progress = (currentIndex / totalPoints) * 100;

      setCurrentSimulationIndex(currentIndex);
      setSimulatedLocation({
        lat: coords[0],
        lng: coords[1],
        timestamp: Date.now()
      });

      setSimulationProgress(progress);

      // Auto-center map on simulated location
      setMapCenter([coords[0], coords[1]]);

      // Update navigation step based on progress
      if (selectedRoute.steps) {
        const stepIndex = Math.floor((currentIndex / totalPoints) * selectedRoute.steps.length);
        setNavigationStep(Math.min(stepIndex, selectedRoute.steps.length - 1));
      }
    }, interval);
  };

  // Pause/Resume simulation
  const toggleSimulationPause = () => {
    setSimulationPaused(!simulationPaused);
  };

  // Stop simulation
  const stopSimulation = () => {
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
  };

  // Complete simulation and save to history
  const completeSimulation = async () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    const endTime = new Date();
    const durationMinutes = simulationStartTime 
      ? (endTime - simulationStartTime) / 1000 / 60 
      : selectedRoute.estimated_duration_minutes;

    // Save to travel history (only if user is logged in)
    if (user && selectedOrigin && selectedDestination && selectedRoute) {
      try {
        await travelHistoryService.saveTravelSession({
          origin: {
            name: selectedOrigin.name || 'Unknown Origin',
            lat: selectedOrigin.lat,
            lng: selectedOrigin.lng,
            address: selectedOrigin.address || { full: '' }
          },
          destination: {
            name: selectedDestination.name || 'Unknown Destination',
            lat: selectedDestination.lat,
            lng: selectedDestination.lng,
            address: selectedDestination.address || { full: '' }
          },
          routeData: {
            route_id: selectedRoute.route_id || 'simulated',
            route_name: selectedRoute.route_name || 'Simulated Route',
            distance_km: selectedRoute.distance_km || 0,
            estimated_duration_minutes: selectedRoute.estimated_duration_minutes || 0
          },
          durationMinutes: durationMinutes,
          distanceKm: selectedRoute.distance_km || 0,
          startTime: simulationStartTime ? simulationStartTime.toISOString() : new Date().toISOString(),
          endTime: endTime.toISOString(),
          travelMode: 'car',
          trafficConditions: selectedRoute.traffic_conditions || 'light',
          notes: 'Simulated trip'
        });

        // Refresh travel history
        await loadUserData();

        alert('✅ Simulation complete! Trip saved to your travel history.');
      } catch (error) {
        
        // Check if it's an authentication error
        if (error.response?.status === 401) {
          alert('✅ Simulation complete!\n\n⚠️ Note: You need to be logged in to save trips to your travel history.');
        } else {
          alert('✅ Simulation complete!\n\n⚠️ Could not save to travel history: ' + (error.message || 'Unknown error'));
        }
      }
    } else if (!user) {
      // User not logged in
      alert('✅ Simulation complete!\n\n💡 Tip: Log in to save your simulated trips to travel history.');
    } else {
      alert('✅ Simulation complete!');
    }

    // Reset simulation state
    setIsSimulating(false);
    setSimulationProgress(100);
    setSimulationPaused(false);
    setSimulationMinimized(false);
    setCurrentSimulationIndex(0);
    
    // Keep simulated location at destination for a moment
    setTimeout(() => {
      setSimulatedLocation(null);
      setSimulationProgress(0);
    }, 3000);
  };

  // Change simulation speed
  const changeSimulationSpeed = (speed) => {
    setSimulationSpeed(speed);
    
    // Restart simulation with new speed if currently running
    if (isSimulating && !simulationPaused) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      runSimulation();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
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
      
      // Don't set empty array on error, keep existing incidents
    }
  }, [mapCenter]);

  // Load incidents when map moves
  useEffect(() => {
    loadNearbyIncidents();
    const interval = setInterval(loadNearbyIncidents, 60000);
    return () => clearInterval(interval);
  }, [loadNearbyIncidents]);

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
        photo_urls: photoUrls
      };

      // Validate required fields
      if (!emergencyData.latitude || !emergencyData.longitude || !emergencyData.emergency_type) {
        alert('⚠️ Please provide location and incident type');
        return;
      }

      

      // Submit to Emergency API (saves to emergencies table)
      const response = await emergencyService.reportEmergency(emergencyData);
      
      
      alert('✅ Incident reported successfully!');
      
      // Reload nearby incidents to show the new one
      loadNearbyIncidents();
      
      // Also reload nearby emergencies if emergency layer is enabled
      if (emergencyEnabled) {
        // This will trigger the emergency data refresh
        window.dispatchEvent(new Event('refresh-emergencies'));
      }
    } catch (error) {
      
      const errorMessage = error.message || 'Failed to report incident. Please try again.';
      alert(`❌ ${errorMessage}`);
    }
  };

  // Create incident icon
  const createIncidentIcon = (type) => {
    const incidentTypes = incidentReportingService.getIncidentTypes();
    const incidentType = incidentTypes.find(t => t.id === type) || incidentTypes[incidentTypes.length - 1];
    
    return L.divIcon({
      className: 'custom-incident-marker',
      html: `
        <div style="
          background-color: ${incidentType.color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">
          ${incidentType.icon}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
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
      setIsLoadingData(true);
      
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
      setIsLoadingData(false);
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
    if (!selectedOrigin || !selectedDestination) return;
    
    try {
      setIsLoadingData(true);
      
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
      
      handleGetRoute();
    } finally {
      setIsLoadingData(false);
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
      
      // Handle map clicks to close icon selector and search results
      const handleMapClick = () => {
        if (showIconSelector) {
          setShowIconSelector(false);
        }
        // Close search results when clicking on map
        if (showSearchResults) {
          setShowSearchResults(false);
          setShowSuggestions(false);
        }
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
      },
      zoomend: (e) => {
        setMapZoom(e.target.getZoom());
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

  // Current navigation step
  const currentStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep] : null;
  const nextStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep + 1] : null;

  return (
    <ErrorBoundary>
      <div className="traffic-map-container fixed inset-0 w-full h-screen bg-gray-900 overflow-y-auto" style={{ zIndex: 9999, touchAction: 'pan-y' }}>
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

          {/* Traditional Point-based Heatmap Layer (fallback) */}
          {heatmapEnabled && heatmapData.length > 0 && (
            <HeatmapLayer 
              points={heatmapData} 
              options={{
                radius: 24,
                blur: 22,
                max: 0.68,
                minOpacity: 0.26,
                gradient: {
                  0.0: '#64B5F6',    // soft blue
                  0.3: '#81C784',    // soft green
                  0.5: '#FFF176',    // soft yellow
                  0.7: '#FFB74D',    // soft orange
                  1.0: '#E53935'     // toned red
                }
              }}
            />
          )}

          {/* Temporary highlight when selecting from Insights */}
          {highlightedIncident && (
            <>
              <Circle
                center={[highlightedIncident.lat, highlightedIncident.lng]}
                radius={120}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 }}
              />
              <Marker position={[highlightedIncident.lat, highlightedIncident.lng]} icon={createCustomIcon('#3b82f6', 'pin')}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                  <div className="text-xs font-semibold text-gray-900">
                    {highlightedIncident.title || 'Selected incident'}
                  </div>
                </Tooltip>
              </Marker>
            </>
          )}

          {/* 3D Map Visualization removed */}


          {/* Origin Marker */}
          {selectedOrigin && (
            <Marker
              position={[selectedOrigin.lat, selectedOrigin.lng]}
              icon={createCustomIcon('#4285f4', 'pin')}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">Origin</h3>
                  <p className="text-xs text-gray-600">{selectedOrigin.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Destination Marker */}
          {selectedDestination && (
            <Marker
              position={[selectedDestination.lat, selectedDestination.lng]}
              icon={createCustomIcon('#ea4335', 'pin')}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">Destination</h3>
                  <p className="text-xs text-gray-600">{selectedDestination.name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* User Location Marker with Custom Icon */}
          {userLocation && !isSimulating && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createNavigationIcon(navigationIcon, userHeading)}
              rotationAngle={userHeading}
              rotationOrigin="center"
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">Your Location</h3>
                  <p className="text-xs text-gray-600">
                    Accuracy: ±{Math.round(userLocation.accuracy)}m
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(userLocation.timestamp).toLocaleTimeString()}
                  </p>
                  {gyroscopeEnabled && (
                    <p className="text-xs text-blue-600 mt-1">
                      🧭 Heading: {Math.round(userHeading)}°
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Simulated Location Marker */}
          {simulatedLocation && isSimulating && (
            <Marker
              position={[simulatedLocation.lat, simulatedLocation.lng]}
              icon={createNavigationIcon(navigationIcon, userHeading)}
              rotationAngle={userHeading}
              rotationOrigin="center"
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">🚗 Simulated Position</h3>
                  <p className="text-xs text-gray-600">
                    Progress: {Math.round(simulationProgress)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Speed: {simulationSpeed}x
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* NEW: Incident Markers */}
          {emergencyEnabled && nearbyIncidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[incident.location.lat, incident.location.lng]}
              icon={createIncidentIcon(incident.type)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm capitalize">{incident.type.replace('_', ' ')}</h3>
                  <p className="text-xs text-gray-600 mt-1">{incident.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {incident.distance ? `${incident.distance.toFixed(1)} km away` : ''}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <button 
                      onClick={() => incidentReportingService.upvoteIncident(incident.id, user?.uid)}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      👍 {incident.upvotes || 0}
                    </button>
                    <button 
                      onClick={() => incidentReportingService.downvoteIncident(incident.id, user?.uid)}
                      className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      👎 {incident.downvotes || 0}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

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
          <EmergencyLayer emergencies={nearbyEmergencies} enabled={emergencyEnabled} />
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

          <ScaleControl position="bottomright" />
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      {/* Insights FAB - Enhanced */}
      <div
        className={`absolute left-4 sm:left-6 z-50 transition-all duration-500 ease-out ${isMiniOpen ? 'opacity-0 pointer-events-none scale-0' : 'opacity-100 scale-100'}`}
        style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={() => setIsMiniOpen(true)}
          className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 hover:from-blue-700 hover:via-blue-700 hover:to-blue-800 text-white rounded-full shadow-2xl hover:shadow-blue-500/50 px-4 py-2 text-sm sm:px-5 sm:py-3 sm:text-base font-semibold transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group"
        >
          <span className="relative z-10 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            <span>Insights</span>
          </span>
          <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
        </button>
      </div>

      {/* Mini Dashboard Bottom Sheet */}
      {(
        () => {
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
              align="left"
              isLive={true}
              lastUpdated={Date.now()}
              onSelectUpdate={(u) => {
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
                    // Minimize the sheet for better focus on map
                    setIsMiniOpen(false);
                  }
                }
              }}
            />
          );
        }
      )()}

      {/* Modern Floating Search Bar - Google Maps/Waze Style */}
      <div className={`absolute transition-all duration-500 ease-out animate-fade-in ${
        showSidePanel
          ? 'top-4 left-80 right-4 sm:top-6 sm:left-96 sm:right-6'
          : (showHistoryPanel
            ? 'top-4 left-72 right-4 sm:top-6 sm:left-80 sm:right-6'
            : 'top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6')
      }`} style={{ zIndex: 40 }}>
        <div className="flex items-center justify-center space-x-3 max-w-5xl mx-auto">
          {/* Hamburger Menu - Modern Floating Button with Enhanced Animations */}
          <button
            onClick={() => setShowSidePanel(!showSidePanel)}
            className="modern-fab bg-white/95 backdrop-blur-xl hover:bg-white rounded-full p-3.5 sm:p-4 flex-shrink-0 border border-white/50 shadow-lg hover:shadow-2xl transition-all duration-300 ease-out hover:scale-110 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{ zIndex: 41 }}
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 transition-transform duration-300 group-hover:rotate-90" />
          </button>

          {/* Search Bar - Enhanced Glassmorphism Card */}
          <div ref={searchPanelRef} className="flex-1 max-w-3xl bg-white/90 backdrop-blur-2xl backdrop-saturate-150 rounded-3xl shadow-2xl border border-white/30 overflow-hidden transition-all duration-500 hover:shadow-3xl hover:border-white/50 animate-slide-down">
            {/* Origin Input - Enhanced with Glassmorphism */}
            <div className="flex items-center border-b border-gray-200/50 hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-transparent transition-all duration-300 ease-out group">
              <div className="flex items-center space-x-3 px-5 py-4 flex-1 min-w-0">
                <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex-shrink-0 shadow-lg ring-2 ring-blue-200/50 transition-all duration-300 group-hover:scale-110 group-hover:ring-blue-300"></div>
                <input
                  type="text"
                  placeholder="Choose starting point..."
                  value={originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setSearchMode('origin');
                    setShowSuggestions(false);
                    handleSearch(e.target.value, 'origin');
                  }}
                  onFocus={() => {
                    setSearchMode('origin');
                    setShowSuggestions(true);
                    if (!originQuery) {
                      setShowSearchResults(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow click on suggestions
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="flex-1 text-gray-900 placeholder-gray-400/70 bg-transparent focus:outline-none text-base font-medium min-w-0 transition-all duration-200 focus:placeholder-gray-300"
                />
                {selectedOrigin && (
                  <button
                    onClick={() => setSelectedOrigin(null)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100 rounded-full flex-shrink-0 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:shadow-md"
                  >
                    <X className="w-4 h-4 text-gray-400 transition-colors duration-200 hover:text-red-500" />
                  </button>
                )}
              </div>

              {/* Current Location Button for Origin - Enhanced with Gradient Hover */}
              <button
                onClick={() => {
                  setSearchMode('origin');
                  getCurrentLocation('origin');
                }}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200 rounded-full flex-shrink-0 mr-4 transition-all duration-300 ease-out group transform hover:scale-110 active:scale-95 hover:shadow-lg"
                title="Use current location as starting point"
              >
                <Target className="w-5 h-5 text-gray-500 transition-all duration-300 group-hover:text-blue-600 group-hover:scale-110" />
              </button>
            </div>

            {/* Destination Input - Enhanced with Glassmorphism */}
            <div className="flex items-center hover:bg-gradient-to-r hover:from-red-50/40 hover:to-transparent transition-all duration-300 ease-out group">
              <div className="flex items-center space-x-3 px-5 py-4 flex-1 min-w-0">
                <div className="w-4 h-4 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex-shrink-0 shadow-lg ring-2 ring-red-200/50 transition-all duration-300 group-hover:scale-110 group-hover:ring-red-300"></div>
                <input
                  type="text"
                  placeholder="Where to?"
                  value={destinationQuery}
                  onChange={(e) => {
                    setDestinationQuery(e.target.value);
                    setSearchMode('destination');
                    setShowSuggestions(false);
                    handleSearch(e.target.value, 'destination');
                  }}
                  onFocus={() => {
                    setSearchMode('destination');
                    setShowSuggestions(true);
                    if (!destinationQuery) {
                      setShowSearchResults(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay hiding to allow click on suggestions
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  className="flex-1 text-gray-900 placeholder-gray-400/70 bg-transparent focus:outline-none text-base font-medium min-w-0 transition-all duration-200 focus:placeholder-gray-300"
                />
                {selectedDestination && (
                  <button
                    onClick={() => setSelectedDestination(null)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100 rounded-full flex-shrink-0 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 hover:shadow-md"
                  >
                    <X className="w-4 h-4 text-gray-400 transition-colors duration-200 hover:text-red-500" />
                  </button>
                )}
              </div>

              {/* Current Location Button for Destination - Enhanced with Gradient Hover */}
              <button
                onClick={() => {
                  setSearchMode('destination');
                  getCurrentLocation('destination');
                }}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200 rounded-full flex-shrink-0 mr-4 transition-all duration-300 ease-out group transform hover:scale-110 active:scale-95 hover:shadow-lg"
                title="Use current location"
              >
                <Target className="w-5 h-5 text-gray-500 transition-all duration-300 group-hover:text-blue-600 group-hover:scale-110" />
              </button>

              {/* Enhanced Route Button - Modern Waze Style with Loading State */}
              {selectedOrigin && selectedDestination ? (
                <>
                  <button
                    onClick={() => handleGetRoute()}
                    disabled={isLoadingData}
                    className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-blue-500 via-blue-600 to-blue-600 hover:from-blue-600 hover:via-blue-700 hover:to-blue-700 disabled:from-gray-400 disabled:via-gray-500 disabled:to-gray-500 text-white px-6 py-4 rounded-2xl text-base font-bold transition-all duration-300 ease-out disabled:opacity-50 flex items-center justify-center space-x-2 mr-4 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 disabled:transform-none disabled:cursor-not-allowed relative overflow-hidden group"
                    title="Get fastest route"
                  >
                    {isLoadingData ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="hidden sm:inline">Loading...</span>
                      </>
                    ) : (
                      <>
                        <Route className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
                        <span className="hidden sm:inline">Go</span>
                      </>
                    )}
                    {/* Ripple effect overlay */}
                    <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-300"></span>
                  </button>
                  {/* Auto-open Smart Route when both locations are selected */}
                  {!showSmartRoutePanel && (
                    <>
                      <button
                        onClick={() => setShowSmartRoutePanel(true)}
                        className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-600 hover:from-indigo-700 hover:via-purple-700 hover:to-purple-700 text-white px-4 py-4 rounded-2xl text-base font-bold transition-all duration-300 ease-out flex items-center justify-center space-x-2 mr-4 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 relative overflow-hidden group"
                        title="Open Smart Route options"
                      >
                        <Zap className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="hidden sm:inline">Smart</span>
                        <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          setShowPredictionsPanel(true);
                        }}
                        className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-600 hover:from-cyan-700 hover:via-blue-700 hover:to-blue-700 text-white px-4 py-4 rounded-2xl text-base font-bold transition-all duration-300 ease-out flex items-center justify-center space-x-2 mr-4 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 relative overflow-hidden group"
                        title="View Traffic Predictions"
                      >
                        <BarChart3 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        <span className="hidden sm:inline">Predictions</span>
                        <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                /* Smart Route Button - Show when locations not both selected */
                <>
                  <button
                    onClick={() => setShowSmartRoutePanel(true)}
                    className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-indigo-600 via-purple-600 to-purple-600 hover:from-indigo-700 hover:via-purple-700 hover:to-purple-700 text-white px-5 py-4 rounded-2xl text-base font-bold transition-all duration-300 ease-out flex items-center justify-center space-x-2 mr-4 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 relative overflow-hidden group"
                    title="Smart Route Planning"
                  >
                    <Zap className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    <span className="hidden sm:inline">Smart</span>
                    <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      setShowPredictionsPanel(true);
                    }}
                    className="min-w-[88px] min-h-[44px] bg-gradient-to-r from-cyan-600 via-blue-600 to-blue-600 hover:from-cyan-700 hover:via-blue-700 hover:to-blue-700 text-white px-4 py-4 rounded-2xl text-base font-bold transition-all duration-300 ease-out flex items-center justify-center space-x-2 mr-4 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 relative overflow-hidden group"
                    title="View Traffic Predictions"
                  >
                    <BarChart3 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    <span className="hidden sm:inline">Predictions</span>
                    <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                  </button>
                </>
              )}
            </div>

            {/* Enhanced Search Results - Modern Dropdown with Glassmorphism */}
            {showSearchResults && (
              <div className="border-t border-gray-200/30 bg-white/95 backdrop-blur-xl backdrop-saturate-150 max-h-80 overflow-y-auto shadow-2xl animate-slide-down">
                {/* Quick Actions Section - Enhanced */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50/90 to-blue-100/90 backdrop-blur-sm border-b border-blue-200/50">
                  <button
                    onClick={() => getCurrentLocation(searchMode)}
                    className="w-full min-h-[56px] flex items-center space-x-3 p-3 hover:bg-white/80 rounded-xl transition-all duration-300 ease-out text-left group relative overflow-hidden touch-feedback"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300 shadow-lg group-hover:shadow-xl group-hover:scale-110">
                      <Target className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 transition-colors duration-200 group-hover:text-blue-700">Use current location</p>
                      <p className="text-xs text-gray-600">
                        Set as {searchMode === 'origin' ? 'starting point' : 'destination'}
                      </p>
                    </div>
                    <span className="absolute inset-0 rounded-xl bg-blue-500/10 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                  </button>
                </div>

                {/* Las Piñas City Suggestions - Show when field is empty */}
                {showSuggestions && (originQuery === '' || destinationQuery === '') && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      Popular Places in Las Piñas City
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {lasPinasSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            const location = {
                              name: suggestion.name,
                              lat: suggestion.lat,
                              lng: suggestion.lng,
                              address: {
                                full: `${suggestion.name}, Las Piñas City`,
                                city: 'Las Piñas',
                                country: 'Philippines'
                              },
                              type: suggestion.category.toLowerCase(),
                              isSuggestion: true
                            };
                            handleLocationSelect(location);
                            setShowSuggestions(false);
                          }}
                          className="w-full min-h-[56px] flex items-center space-x-3 p-3 hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-transparent rounded-xl transition-all duration-300 ease-out text-left group border border-gray-100/50 hover:border-blue-200 bg-white/80 backdrop-blur-sm relative overflow-hidden touch-feedback"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:scale-110 text-lg flex-shrink-0">
                            {suggestion.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate transition-colors duration-200 group-hover:text-blue-700">{suggestion.name}</p>
                            <p className="text-xs text-gray-500 truncate">{suggestion.category} • Las Piñas City</p>
                          </div>
                          <span className="absolute inset-0 rounded-xl bg-blue-500/10 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center">
                      <History className="w-4 h-4 mr-2" />
                      Recent Searches
                    </div>
                    <div className="space-y-2">
                      {recentSearches.slice(0, 3).map((recent, index) => (
                        <button
                          key={index}
                          onClick={() => handleLocationSelect(recent)}
                          className="w-full min-h-[56px] flex items-center space-x-3 p-3 hover:bg-gradient-to-r hover:from-gray-50/80 hover:to-transparent rounded-xl transition-all duration-300 ease-out text-left group border border-gray-100/50 hover:border-gray-200 bg-white/60 backdrop-blur-sm relative overflow-hidden touch-feedback"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center group-hover:from-gray-200 group-hover:to-gray-300 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110">
                            <History className="w-4 h-4 text-gray-500 transition-transform duration-300 group-hover:scale-110" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate transition-colors duration-200 group-hover:text-gray-700">{recent.name}</p>
                            {recent.address?.full && (
                              <p className="text-xs text-gray-500 truncate">{recent.address.full}</p>
                            )}
                          </div>
                          <span className="absolute inset-0 rounded-xl bg-gray-500/10 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {searchResults.filter(result => !result.isRecent).length > 0 && (
                  <div className="px-4 py-3">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      {searchResults.some(r => r.isPriority) ? 'Las Piñas & Nearby' : 'Search Results'}
                    </div>
                    <div className="space-y-2">
                      {searchResults.filter(result => !result.isRecent).map((result, index) => (
                        <button
                          key={index}
                          onClick={() => handleLocationSelect(result)}
                          className={`w-full min-h-[56px] flex items-center space-x-3 p-3 hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-transparent rounded-xl transition-all duration-300 ease-out text-left group border relative overflow-hidden touch-feedback ${
                            result.isPriority 
                              ? 'border-blue-200/50 bg-blue-50/40 backdrop-blur-sm hover:border-blue-300' 
                              : 'border-gray-100/50 bg-white/60 backdrop-blur-sm hover:border-blue-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:scale-110 ${
                            result.isPriority
                              ? 'bg-gradient-to-br from-blue-500 to-blue-600 group-hover:from-blue-600 group-hover:to-blue-700'
                              : 'bg-gradient-to-br from-blue-100 to-blue-200 group-hover:from-blue-200 group-hover:to-blue-300'
                          }`}>
                            <MapPin className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${result.isPriority ? 'text-white' : 'text-blue-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-semibold truncate transition-colors duration-200 ${result.isPriority ? 'text-gray-900 group-hover:text-blue-700' : 'text-gray-900 group-hover:text-gray-700'}`}>{result.name}</p>
                              {result.isPriority && (
                                <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs rounded-full font-medium flex-shrink-0 shadow-sm">
                                  Las Piñas
                                </span>
                              )}
                            </div>
                            {result.address?.full && (
                              <p className="text-xs text-gray-500 truncate">{result.address.full}</p>
                            )}
                          </div>
                          <span className="absolute inset-0 rounded-xl bg-blue-500/10 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Right Controls - Modern Floating Buttons - Mobile Optimized */}
      <div className="absolute bottom-6 right-5 flex flex-col space-y-3 animate-fade-in" style={{ zIndex: 40 }}>
        {/* Simulation Status Indicator - Modern Pill */}
        {isSimulating && (
          <div className="modern-pill bg-white rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full shadow-md bg-green-500 animate-pulse"></div>
              <span className="text-sm font-bold text-green-700">
                {simulationSpeed}x
              </span>
            </div>
          </div>
        )}

        {/* GPS Status Indicator - Modern Pill */}
        {!isSimulating && (
          <div className={`modern-pill bg-white rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border ${
            isTrackingLocation
              ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
              : 'border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full shadow-md ${
                isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className={`text-sm font-bold ${
                isTrackingLocation ? 'text-green-700' : 'text-gray-600'
              }`}>
                GPS
              </span>
            </div>
          </div>
        )}

        {/* Navigation Toggle - Large Floating Action Button - Enhanced */}
        {selectedRoute && !isSimulating && (
          <button
            onClick={isNavigationActive ? stopNavigation : startNavigation}
            className={`min-w-[64px] min-h-[64px] rounded-full shadow-2xl p-5 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 relative overflow-hidden group ${
              isNavigationActive
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white'
                : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white'
            }`}
          >
            <div className="relative z-10">
              {isNavigationActive ? (
                <Pause className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Play className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
              )}
            </div>
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
            {/* Pulse ring for active navigation */}
            {isNavigationActive && (
              <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></span>
            )}
          </button>
        )}
      </div>

      {/* Simulation Control Panel */}
      {isSimulating && (
        <div className={`absolute left-2 right-2 sm:left-4 sm:right-4 z-40 transition-all duration-300 ${
          simulationMinimized ? 'bottom-4' : 'bottom-20 sm:bottom-24'
        }`}>
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                  <Car className="w-5 h-5 text-green-600" />
                  <span>Travel Simulation</span>
                </h3>
                {!simulationMinimized && (
                  <div className="text-sm text-gray-600 mt-1 truncate">
                    {selectedOrigin?.name} → {selectedDestination?.name}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSimulationMinimized(!simulationMinimized)}
                  className="p-2 hover:bg-green-200 rounded-full transition-colors"
                  title={simulationMinimized ? 'Maximize' : 'Minimize'}
                >
                  {simulationMinimized ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                </button>
                <button
                  onClick={stopSimulation}
                  className="p-2 hover:bg-green-200 rounded-full transition-colors"
                  title="Stop simulation"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {!simulationMinimized && (
            <div className="p-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{Math.round(simulationProgress)}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-4">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${simulationProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleSimulationPause}
                    className={`p-3 rounded-lg transition-colors border-2 ${
                      simulationPaused
                        ? 'bg-green-50 border-green-300 text-green-600 hover:bg-green-100'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                    title={simulationPaused ? 'Resume' : 'Pause'}
                  >
                    {simulationPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-600 mr-2">Speed:</span>
                  {[1, 2, 5, 10].map(speed => (
                    <button
                      key={speed}
                      onClick={() => changeSimulationSpeed(speed)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        simulationSpeed === speed
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Step Info */}
              {currentStep && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center border border-green-200">
                      <span className="text-xl">
                        {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{currentStep.instruction}</p>
                      {currentStep.street_name && (
                        <p className="text-xs text-gray-600">on {currentStep.street_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Trip Info */}
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDistance(selectedRoute.distance_km * 1000)}
                  </div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDuration(selectedRoute.estimated_duration_minutes)}
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-green-600">
                    {Math.round(simulationProgress)}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
            )}
            
            {/* Minimized View - Just Progress Bar */}
            {simulationMinimized && (
              <div className="p-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${simulationProgress}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 min-w-[3rem] text-right">
                    {Math.round(simulationProgress)}%
                  </span>
                  <button
                    onClick={toggleSimulationPause}
                    className="p-2 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200"
                  >
                    {simulationPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Navigation Panel - Modern Google Maps Style - Responsive */}
      {isNavigationActive && !isSimulating && currentStep && (
        <div className="absolute bottom-20 sm:bottom-24 left-2 right-2 sm:left-4 sm:right-4 z-40">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Turn-by-turn navigation</h3>
                <div className="text-sm text-gray-500">
                  Step {navigationStep + 1} of {selectedRoute ? selectedRoute.steps.length : 0}
                </div>
                {userLocation && (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs text-gray-500">
                      GPS: ±{Math.round(userLocation.accuracy)}m
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {/* Gyroscope Toggle */}
                <button
                  onClick={() => setGyroscopeEnabled(!gyroscopeEnabled)}
                  className={`p-2 rounded-full transition-colors ${
                    gyroscopeEnabled 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={gyroscopeEnabled ? 'Disable gyroscope rotation' : 'Enable gyroscope rotation'}
                >
                  <Navigation className="w-5 h-5" />
                </button>
                
                {/* Icon Selector */}
                <button
                  onClick={() => setShowIconSelector(!showIconSelector)}
                  className="p-2 bg-gray-200 text-gray-600 hover:bg-gray-300 rounded-full transition-colors"
                  title="Select navigation icon"
                >
                  <span className="text-xl">{navigationIcon === 'car' ? '🚗' : navigationIcon === 'bike' ? '🚴' : navigationIcon === 'walk' ? '🚶' : navigationIcon === 'motorcycle' ? '🏍️' : navigationIcon === 'bus' ? '🚌' : navigationIcon === 'truck' ? '🚚' : '📍'}</span>
                </button>
                
                {/* Exit Navigation */}
                <button
                  onClick={stopNavigation}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                  title="Exit navigation"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            {/* Icon Selector Dropdown */}
            {showIconSelector && (
              <div className="absolute top-16 right-4 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-50">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Select Icon
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'car', icon: '🚗', label: 'Car' },
                    { type: 'bike', icon: '🚴', label: 'Bike' },
                    { type: 'walk', icon: '🚶', label: 'Walk' },
                    { type: 'motorcycle', icon: '🏍️', label: 'Motorcycle' },
                    { type: 'bus', icon: '🚌', label: 'Bus' },
                    { type: 'truck', icon: '🚚', label: 'Truck' }
                  ].map((option) => (
                    <button
                      key={option.type}
                      onClick={() => {
                        setNavigationIcon(option.type);
                        setShowIconSelector(false);
                      }}
                      className={`p-3 rounded-lg transition-all ${
                        navigationIcon === option.type
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-xs text-gray-600">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Instruction */}
            <div className="p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-200">
                    <span className="text-3xl">
                      {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type)}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                    {currentStep.instruction}
                  </p>
                  {currentStep.street_name && (
                    <p className="text-sm text-gray-600 mb-2">
                      on {currentStep.street_name}
                    </p>
                  )}

                  {/* Distance to next turn */}
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-gray-500">
                      {enhancedRoutingService.formatDistance(currentStep.distance_meters || 0)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">
                      {enhancedRoutingService.formatDuration((currentStep.travel_time_seconds || 0) / 60)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Instruction Preview */}
            {nextStep && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-sm">
                      {enhancedRoutingService.getManeuverIcon(nextStep.maneuver_type)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Next: {nextStep.instruction}</p>
                    {nextStep.street_name && (
                      <p className="text-xs text-gray-500">on {nextStep.street_name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Progress Bar */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>
                  {Math.round(((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100)}%
                </span>
              </div>
              <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out relative"
                  style={{ width: `${((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Alternatives Panel - Modern Design - Responsive */}
      {showRouteAlternatives && routeAlternatives.length > 0 && !isNavigationActive && (
        <div className="absolute bottom-2 left-1 right-1 sm:bottom-4 sm:left-2 sm:right-2 z-40">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-80 sm:max-h-96">
            <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Choose Route</h3>
                <button
                  onClick={() => setShowRouteAlternatives(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {routeAlternatives.map((route, index) => {
                const isSelected = selectedRoute && selectedRoute.route_id === route.route_id;
                return (
                  <button
                    key={route.route_id || index}
                    onClick={() => selectRoute(route)}
                    className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 text-white' :
                        index === 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isSelected ? '✓' : index === 0 ? '🏆' : index + 1}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {route.route_name || `Alternative ${index + 1}`}
                          </span>
                          {isSelected && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 mb-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {enhancedRoutingService.formatDuration(route.estimated_duration_minutes)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Route className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {enhancedRoutingService.formatDistance(route.distance_km * 1000)}
                            </span>
                          </div>

                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            route.traffic_conditions === 'heavy' ? 'bg-red-100 text-red-700' :
                            route.traffic_conditions === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {route.traffic_conditions || 'Light'} traffic
                          </div>
                        </div>

                        {route.hasTolls && (
                          <div className="flex items-center space-x-1 mb-1">
                            <span className="text-xs text-gray-500">💰 Has tolls</span>
                          </div>
                        )}

                        {route.has_highways && (
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">🛣️ Highway route</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Route Information Panel with Real-time Traffic - Modern Design - Responsive */}
      {selectedRoute && !isNavigationActive && !isSimulating && (
        <div className="absolute bottom-2 left-1 right-1 sm:bottom-4 sm:left-2 sm:right-2 z-40">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                    <Route className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Route Found</h3>
                    <p className="text-sm text-gray-500">{selectedRoute.route_name || 'Recommended Route'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Show alternatives button if multiple routes available */}
                  {routeAlternatives.length > 1 && (
                    <button
                      onClick={() => setShowRouteAlternatives(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                      title="View alternative routes"
                    >
                      <Layers className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                  {/* Close button */}
                  <button
                    onClick={clearLocations}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    title="Close route"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={saveAsFavorite}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    title="Save as favorite"
                  >
                    <Heart className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={startSimulation}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm"
                    title="Simulate this trip"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Simulate</span>
                  </button>
                  <button
                    onClick={startNavigation}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 shadow-sm"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Start</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDuration(selectedRoute.estimated_duration_minutes)}
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDistance(selectedRoute.distance_km * 1000)}
                  </div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>

                {/* Real-time Traffic Condition */}
                <div>
                  <div className={`text-lg font-semibold ${
                    routeTrafficData?.condition === 'heavy' ? 'text-red-600' :
                    routeTrafficData?.condition === 'moderate' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {routeTrafficData?.condition === 'heavy' ? 'Heavy' :
                     routeTrafficData?.condition === 'moderate' ? 'Moderate' :
                     'Light'}
                  </div>
                  <div className="text-xs text-gray-500">Traffic</div>
                  {routeTrafficData && (
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.round(routeTrafficData.avgSpeed)} km/h avg
                    </div>
                  )}
                </div>

                {/* Traffic Indicator */}
                <div className="flex items-center justify-center">
                  <div className={`w-3 h-3 rounded-full ${
                    routeTrafficData?.condition === 'heavy' ? 'bg-red-500' :
                    routeTrafficData?.condition === 'moderate' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></div>
                  <span className="ml-2 text-xs text-gray-500">
                    Live traffic
                  </span>
                </div>
              </div>

              {/* Traffic Details */}
              {routeTrafficData && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Traffic flow:</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          routeTrafficData.condition === 'heavy' ? 'bg-red-500' :
                          routeTrafficData.condition === 'moderate' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}></div>
                        <span className="text-gray-700 capitalize">{routeTrafficData.condition}</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">
                        {routeTrafficData.samplePoints} checkpoints
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Semi-transparent overlay for sidebar */}
      {showSidePanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
          style={{ zIndex: 45}}
          onClick={() => setShowSidePanel(false)}
        />
      )}

      {/* Left Side Panel - extracted component */}
      {showSidePanel && (
        <TrafficMapSidebar
          onClose={() => setShowSidePanel(false)}
          onBackToDashboard={() => navigate('/dashboard')}
          travelHistory={travelHistory}
          onOpenHistory={() => { setShowHistoryPanel(!showHistoryPanel); setShowSidePanel(false); }}
          heatmapEnabled={heatmapEnabled}
          setHeatmapEnabled={setHeatmapEnabled}
          trafficLayerEnabled={trafficLayerEnabled}
          setTrafficLayerEnabled={setTrafficLayerEnabled}
          mapStyle={mapStyle}
          setMapStyle={setMapStyle}
          parkingEnabled={parkingEnabled}
          setParkingEnabled={setParkingEnabled}
          weatherEnabled={weatherEnabled}
          setWeatherEnabled={setWeatherEnabled}
          emergencyEnabled={emergencyEnabled}
          setEmergencyEnabled={setEmergencyEnabled}
          trafficMonitorNewEnabled={trafficMonitorNewEnabled}
          setTrafficMonitorNewEnabled={setTrafficMonitorNewEnabled}
          reportsEnabled={reportsEnabled}
          setReportsEnabled={setReportsEnabled}
          incidentProneEnabled={incidentProneEnabled}
          setIncidentProneEnabled={setIncidentProneEnabled}
          floodZonesEnabled={floodZonesEnabled}
          setFloodZonesEnabled={setFloodZonesEnabled}
          isGuest={isGuest}
          // 3D map overlay removed
        />
      )}

      {/* History Panel Backdrop */}
      {showHistoryPanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
          style={{ zIndex: 45 }}
          onClick={() => setShowHistoryPanel(false)}
        />
      )}

      {/* History Panel - Modern Design - Responsive */}
      {showHistoryPanel && (
        <div
          className="fixed top-0 left-0 bottom-0 w-80 sm:w-96 bg-white shadow-2xl transform transition-all duration-300 ease-out rounded-r-3xl border-r border-gray-100 flex flex-col animate-slide-in-left overflow-hidden"
          style={{ zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Travel History</h2>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 modern-scrollbar">
            {/* Frequent Locations */}
            {frequentLocations.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Frequent Locations</h3>
                <div className="space-y-2">
                  {frequentLocations.slice(0, 5).map((location, index) => (
                    <button
                      key={index}
                      onClick={() => handleLocationSelect(location)}
                      className="w-full flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left border border-gray-200"
                    >
                      <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                        <span className="text-xs font-semibold text-blue-600">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{location.name}</p>
                        <p className="text-xs text-gray-500">{location.count} visits</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Trips */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Recent Trips</h3>
              {travelHistory.length > 0 ? (
                <div className="space-y-3">
                  {travelHistory.slice(0, 5).map((trip, index) => (
                    <div key={index} className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                      {/* Route Title */}
                      <div className="mb-3 pb-2 border-b border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-800 truncate">
                          From {getTripPlaceName(trip, 'origin')} to {getTripPlaceName(trip, 'destination')}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {new Date(trip.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      
                      {/* Route Visual */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <p className="text-xs text-gray-600 truncate">
                              {getTripPlaceName(trip, 'origin')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 ml-1">
                            <div className="w-1 h-3 border-l-2 border-dashed border-gray-300"></div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                            <p className="text-xs text-gray-600 truncate">
                              {getTripPlaceName(trip, 'destination')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{travelHistoryService.formatTravelTime(trip.duration_minutes)}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <Route className="w-3.5 h-3.5" />
                          <span>{travelHistoryService.formatDistance(trip.distance_km)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No travel history yet</p>
                  <p className="text-xs text-gray-500 mb-4">Your trips will appear here</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      💡 Complete a simulation to add your first trip!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay - Enhanced with Skeleton */}
      {isLoadingData && (
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

      {/* Weather Alert Banner */}
      {showWeatherAlert && weatherWarnings.length > 0 && (
        <div className="absolute top-20 left-4 right-4 z-40 max-w-2xl mx-auto">
          <WeatherAlertBanner
            weather={weatherData}
            warnings={weatherWarnings}
            onDismiss={() => setShowWeatherAlert(false)}
          />
        </div>
      )}

      {/* Feature Toggle Buttons - Right Side */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col space-y-3">
        {/* Incident Report Button - Enhanced with Pulse Animation */}
        <button
          onClick={() => {
            if (isGuest) {
              setShowAuthPrompt(true);
              return;
            }
            setShowIncidentModal(true);
          }}
          className="min-w-[56px] min-h-[56px] p-4 bg-gradient-to-br from-red-600 via-red-600 to-red-700 text-white rounded-full shadow-2xl hover:shadow-red-500/50 hover:from-red-700 hover:via-red-700 hover:to-red-800 transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group"
          title="Report Incident"
        >
          <AlertTriangle className="w-6 h-6 relative z-10 animate-pulse" />
          <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
        </button>

        {/* Voice Navigation Toggle - Enhanced */}
        {!isGuest && (
        <button
          onClick={() => {
            const newState = voiceNavigationService.toggle();
            setVoiceEnabled(newState);
          }}
          className={`min-w-[56px] min-h-[56px] p-3 rounded-full shadow-xl transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group ${
            voiceNavigationService.isEnabled()
              ? 'bg-gradient-to-br from-blue-600 via-blue-600 to-blue-700 text-white hover:from-blue-700 hover:via-blue-700 hover:to-blue-800'
              : 'bg-white/95 backdrop-blur-xl text-gray-700 hover:bg-gray-50 border border-gray-200/50'
          }`}
          title="Voice Navigation"
        >
          <div className="relative z-10">
            {voiceNavigationService.isEnabled() ? (
              <Volume2 className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
            ) : (
              <VolumeX className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
            )}
          </div>
          <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
        </button>
        )}

        {/* 3D Traffic Visualization Toggle removed */}
        
        {/* Multi-Stop Mode Toggle - Enhanced */}
        {!isGuest && (
        <button
          onClick={toggleMultiStopMode}
          className={`min-w-[56px] min-h-[56px] p-3 rounded-full shadow-xl transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group ${
            multiStopMode
              ? 'bg-gradient-to-br from-purple-600 via-purple-600 to-purple-700 text-white hover:from-purple-700 hover:via-purple-700 hover:to-purple-800'
              : 'bg-white/95 backdrop-blur-xl text-gray-700 hover:bg-gray-50 border border-gray-200/50'
          }`}
          title="Multi-Stop Planning"
        >
          <Shuffle className={`w-5 h-5 transition-transform duration-300 ${multiStopMode ? 'group-hover:rotate-180' : 'group-hover:scale-110'}`} />
          <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
        </button>
        )}
        
        {/* Update Incident‑Prone Areas (Web Scrape) - Admin Only */}
        {user?.role === 'admin' && (
        <button
          onClick={handleScrapeIncidentProneAreas}
          className={`p-3 rounded-full shadow-xl transition-all hover:scale-110 active:scale-95 ${
            incidentProneEnabled ? 'bg-amber-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title="Update Incident‑Prone Areas"
        >
          {isScrapingIncidentProne ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <BarChart3 className="w-5 h-5" />
          )}
        </button>
        )}
        
        {/* Weather-Aware Route - Enhanced */}
        {!isGuest && selectedOrigin && selectedDestination && (
          <button
            onClick={getWeatherAwareRoute}
            className="min-w-[56px] min-h-[56px] p-3 bg-white/95 backdrop-blur-xl text-gray-700 rounded-full shadow-xl hover:bg-gradient-to-br hover:from-cyan-50 hover:to-blue-50 border border-gray-200/50 transition-all duration-300 ease-out hover:scale-110 active:scale-95 relative overflow-hidden group"
            title="Weather-Aware Route"
          >
            <Cloud className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 group-hover:text-cyan-600" />
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
          </button>
        )}
      </div>

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

      {/* Incident Report Modal */}
      <IncidentReportModal
        isOpen={showIncidentModal}
        onClose={() => setShowIncidentModal(false)}
        onSubmit={handleIncidentReport}
        currentLocation={userLocation || { lat: mapCenter[0], lng: mapCenter[1] }}
      />

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
        onClose={() => setShowSmartRoutePanel(false)}
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
      />

      {/* Weather & Flood Advisory Panel - Bottom Overlay */}
      <WeatherFloodAdvisory 
        mapCenter={mapCenter}
        locationName="Las Piñas City"
        sidebarOpen={showSidePanel}
      />

      {/* Traffic Predictions Panel */}
      {showPredictionsPanel && (
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

      </div>
    </ErrorBoundary>
  );
};

export default TrafficMap;
