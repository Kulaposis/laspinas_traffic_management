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
  RouteAlternativesPanel,
  EnhancedSearchPanel,
  EnhancedNavigationPanel,
  MapControls,
  MapMarkers,
  HistoryPanel,
  PlaceInfoPanel,
  DirectionsPanel
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
import EmergencyReportsPanel from '../components/EmergencyReportsPanel';
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

  // Layout optimization states
  const [navigationPanelMinimized, setNavigationPanelMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
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
  const [showEmergencyReportsPanel, setShowEmergencyReportsPanel] = useState(false);
  const [myEmergencyReports, setMyEmergencyReports] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedParkingZone, setSelectedParkingZone] = useState(null);
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapStyle, setMapStyle] = useState('main');
  const [previousMapStyle, setPreviousMapStyle] = useState('main'); // Store previous style for restoration
  const [heatmapEnabled, setHeatmapEnabled] = useState(false); // Disabled by default to remove random lines
  const [trafficLayerEnabled, setTrafficLayerEnabled] = useState(true); // Enabled - uses TomTom API for real traffic data
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
  
  // Simulation Completion Modal
  const [showSimulationCompleteModal, setShowSimulationCompleteModal] = useState(false);
  const [simulationCompleteData, setSimulationCompleteData] = useState(null);

  // Load user's personalized data
  useEffect(() => {
    loadUserData();
  }, [user]);

  // Load traffic and heatmap data (keep for now, will refactor later)
  useEffect(() => {
    // Skip loading traffic data during simulation to prevent infinite loops
    if (isSimulating) {
      return;
    }
    
    loadTrafficData();
    const interval = setInterval(loadTrafficData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
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

  const loadTrafficData = async () => {
    // Don't load traffic data during simulation to prevent loops
    if (isSimulating) {
      return;
    }
    
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
    
    // Close search results and other panels
    setShowSearchResults(false);
    setShowSuggestions(false);
    setShowDirectionsPanel(false);
    setShowSmartRoutePanel(false);
    
    // Center map on selected place with validated coordinates
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      setMapCenter([lat, lng]);
      setMapZoom(15); // Zoom in to show the place clearly
      
      // Also update map ref if available
      if (mapRef.current) {
        try {
          mapRef.current.flyTo([lat, lng], 15, {
            duration: 1.0
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
      toast.success('Route calculated!', { id: 'calculate-route' });
    } catch (error) {
      console.warn('Failed to get GPS location or calculate route:', error);
      
      // Show the directions panel even if GPS fails, so user can set origin manually
      setShowDirectionsPanel(true);
      setDirectionsPanelMinimized(false);
      
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
      setOriginQuery(location.name || '');
      
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
      setDestinationQuery(location.name || '');
      
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
    
    // Close directions panel when selecting a route option
    setShowDirectionsPanel(false);
    
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
  const startNavigation = () => {
    if (!selectedRoute) return;

    setIsNavigationActive(true);
    setNavigationStep(0);
    
    // Hide route alternatives panel when starting navigation
    setShowRouteAlternatives(false);
    
    // Close directions panel when starting navigation
    setShowDirectionsPanel(false);

    // Automatically switch to light driving map theme for navigation
    if (mapStyle !== 'light_driving') {
      setPreviousMapStyle(mapStyle); // Save current style
      setMapStyle('light_driving'); // Switch to light driving theme
    }

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

    // Restore previous map style when navigation stops
    if (mapStyle === 'light_driving' && previousMapStyle !== 'light_driving') {
      setMapStyle(previousMapStyle);
    }

    // Stop GPS tracking
    stopLocationTracking();
    
    // Stop simulation if active
    stopSimulation();
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
    
    // Close directions panel when starting simulation
    setShowDirectionsPanel(false);
    
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

      // Auto-center map on simulated location (only update map directly, not state to avoid loops)
      // Use mapRef to update map center without triggering useEffect
      if (mapRef.current) {
        try {
          mapRef.current.setView([coords[0], coords[1]], mapRef.current.getZoom(), {
            animate: false // Disable animation to prevent extra renders
          });
        } catch (err) {
          // Silently fail if map is not ready
        }
      }

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
    
    // Restore previous map style when simulation stops (only if navigation is not active)
    if (!isNavigationActive && mapStyle === 'light_driving' && previousMapStyle !== 'light_driving') {
      setMapStyle(previousMapStyle);
    }
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

    let saveSuccess = false;
    let saveError = null;
    let isAuthError = false;

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
      isGuest: !user,
      durationMinutes: Math.round(durationMinutes),
      distanceKm: selectedRoute?.distance_km || 0,
      origin: selectedOrigin?.name || 'Unknown Origin',
      destination: selectedDestination?.name || 'Unknown Destination',
      trafficConditions: selectedRoute?.traffic_conditions || 'light'
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
      <div 
        className="traffic-map-container fixed inset-0 w-full min-h-screen bg-gray-900 overflow-y-auto" 
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
            emergencyEnabled={emergencyEnabled}
            highlightedIncident={highlightedIncident}
            user={user}
            simulationProgress={simulationProgress}
            simulationSpeed={simulationSpeed}
            gyroscopeEnabled={gyroscopeEnabled}
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

      {/* Enhanced Search Panel */}
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
          onToggleSidePanel={() => setShowSidePanel(!showSidePanel)}
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
        />
      </div>

      {/* Map Controls - GPS Status, Navigation Toggle, and FAB buttons */}
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
        onSetShowSecondaryActions={setShowSecondaryActions}
        showSecondaryActions={showSecondaryActions}
        onSetShowPredictionsPanel={setShowPredictionsPanel}
        onSetIsMiniOpen={setIsMiniOpen}
        onToggleMultiStopMode={toggleMultiStopMode}
        multiStopMode={multiStopMode}
        isGuest={isGuest}
        onSetVoiceEnabled={setVoiceEnabled}
        voiceEnabled={voiceEnabled}
      />

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

      {/* Enhanced Navigation Panel */}
      <EnhancedNavigationPanel
        isNavigationActive={isNavigationActive}
        selectedRoute={selectedRoute}
        navigationStep={navigationStep}
        navigationPanelMinimized={navigationPanelMinimized}
        onToggleMinimize={() => setNavigationPanelMinimized(!navigationPanelMinimized)}
        onClearTrip={clearTrip}
        gyroscopeEnabled={gyroscopeEnabled}
        onToggleGyroscope={() => setGyroscopeEnabled(!gyroscopeEnabled)}
        currentStep={currentStep}
        nextStep={nextStep}
      />

      {/* Route Alternatives Panel */}
      <RouteAlternativesPanel
        routeAlternatives={routeAlternatives}
        selectedRoute={selectedRoute}
        onSelectRoute={selectRoute}
        onClose={() => setShowRouteAlternatives(false)}
        showRouteAlternatives={showRouteAlternatives}
        isNavigationActive={isNavigationActive}
        showSmartRoutePanel={showSmartRoutePanel}
      />

      {/* Place Info Panel */}
      <PlaceInfoPanel
        place={selectedPlace}
        isOpen={showPlaceInfoPanel}
        isLoadingDirections={isLoadingData}
        onClose={() => {
          setShowPlaceInfoPanel(false);
          setSelectedPlace(null);
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

      {/* Directions Panel */}
      <DirectionsPanel
        isOpen={showDirectionsPanel}
        onClose={() => {
          setShowDirectionsPanel(false);
        }}
        origin={selectedOrigin}
        destination={selectedDestination}
        routes={routeAlternatives.length > 0 ? routeAlternatives : (currentRoute?.routes || [])}
        selectedRoute={selectedRoute}
        onSelectRoute={selectRoute}
        onStartNavigation={startNavigation}
        onStartSimulation={startSimulation}
        routeTrafficData={routeTrafficData}
        isMinimized={directionsPanelMinimized}
        onToggleMinimize={() => setDirectionsPanelMinimized(!directionsPanelMinimized)}
        onOriginChange={setOriginQuery}
        onDestinationChange={setDestinationQuery}
        onOriginSelect={handleOriginSelectDirect}
        onDestinationSelect={handleDestinationSelectDirect}
        onSwapLocations={swapLocations}
        onGetCurrentLocation={getCurrentLocation}
      />

      {/* Route Found Panel removed - functionality moved to Smart Route Panel */}

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
          onOpenEmergencyReports={() => { setShowEmergencyReportsPanel(!showEmergencyReportsPanel); setShowSidePanel(false); }}
          myEmergencyReports={myEmergencyReports}
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

      {/* History Panel */}
      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        travelHistory={travelHistory}
        frequentLocations={frequentLocations}
        onLocationSelect={handleLocationSelect}
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

      {/* Weather & Flood Advisory Panel - Bottom Overlay */}
      {!showSmartRoutePanel && !isNavigationActive && !isMiniOpen && !showIncidentModal && !showPredictionsPanel && !showSharePanel && (
        <WeatherFloodAdvisory 
          mapCenter={mapCenter}
          locationName="Las Piñas City"
          sidebarOpen={showSidePanel}
        />
      )}

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
  );
};

export default TrafficMap;
