import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ScaleControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from '../components/HeatmapLayer';
import TrafficInsights from '../components/TrafficInsights';
import SmartRouting from '../components/SmartRouting';
import RouteLayer from '../components/RouteLayer';
import NavigationMode from '../components/NavigationMode';
import EnhancedNavigationMode from '../components/EnhancedNavigationMode';
import TomTomTileLayer from '../components/TomTomTileLayer';
import SimpleMapTileLayer from '../components/SimpleMapTileLayer';
import MapStyleSwitcher from '../components/MapStyleSwitcher';
import trafficService from '../services/trafficService';
import enhancedRoutingService from '../services/enhancedRoutingService';
import incidentProneService from '../services/incidentProneService';
import roadworksService from '../services/roadworksService';
import websocketService from '../services/websocketService';
import weatherService from '../services/weatherService';
import smartRoutingService from '../services/smartRoutingService';
import tomtomService from '../services/tomtomService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';
import { useAuth } from '../context/AuthContext';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TrafficMonitoring = () => {
  const { user } = useAuth();
  const [trafficData, setTrafficData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [incidentProneAreas, setIncidentProneAreas] = useState([]);
  const [roadworks, setRoadworks] = useState([]);
  const [floodData, setFloodData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('heatmap'); // heatmap, incidents, monitoring, incident_prone, flood, roadworks
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [isRealTimeActive, setIsRealTimeActive] = useState(true);
  const [mapStyle, setMapStyle] = useState('main'); // TomTom map style
  const [useTomTomMaps, setUseTomTomMaps] = useState(true);
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState({ is_running: false, roads_monitored: 0 });
  const [newIncident, setNewIncident] = useState({
    incident_type: 'accident',
    title: '',
    description: '',
    severity: 'medium',
    latitude: 14.4504,
    longitude: 121.0170
  });
  
  // Web scraping states
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingResult, setScrapingResult] = useState(null);
  const [showScrapingPanel, setShowScrapingPanel] = useState(false);
  const [facebookPages, setFacebookPages] = useState([
    'https://www.facebook.com/laspinascity',
    'https://www.facebook.com/groups/laspinasresidents'
  ]);

  // New states for enhanced form functionality
  const [formStep, setFormStep] = useState(1);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [tempLocation, setTempLocation] = useState(null);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  // Map modal UX states
  const [locationMap, setLocationMap] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // New state for smart features
  const [showInsights, setShowInsights] = useState(true);
  const [showSmartRouting, setShowSmartRouting] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routesToShow, setRoutesToShow] = useState([]);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [routeDestination, setRouteDestination] = useState(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  
  // Navigation mode state
  const [navigationMode, setNavigationMode] = useState(false);
  
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Las Piñas City center coordinates
  const defaultCenter = [14.4504, 121.0170];
  const defaultBounds = {
    lat_min: 14.4200,
    lat_max: 14.4700,
    lng_min: 120.9800,
    lng_max: 121.0500
  };

  // Web scraping function
  const handleScrapeRoadworks = async () => {
    try {
      setIsScraping(true);
      setScrapingResult(null);
      
      const result = await roadworksService.scrapeRoadworks(facebookPages);
      setScrapingResult(result);
      
      // Refresh roadworks data after scraping
      const roadworksResponse = await roadworksService.getActiveRoadworks();
      setRoadworks(roadworksResponse);
      
      // Show success message
      setError('');
    } catch (error) {
      console.error('Scraping error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error occurred';
      setError(`Failed to scrape roadworks: ${errorMessage}`);
    } finally {
      setIsScraping(false);
    }
  };

  const fetchTrafficData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch basic traffic data, incidents, incident prone areas, roadworks, and flood data
      const [trafficResponse, incidentsResponse, incidentProneResponse, roadworksResponse, floodResponse] = await Promise.all([
        trafficService.getTrafficMonitoring().catch(() => []),
        trafficService.getRoadIncidents({ is_active: true }).catch(() => []),
        incidentProneService.getIncidentProneAreas({ 
          is_active: true
        }).catch(() => ({ areas: [] })),
        roadworksService.getActiveRoadworks().catch(() => []),
        weatherService.getFloodMonitoring().catch(() => [])
      ]);

      setTrafficData(trafficResponse);
      setIncidents(incidentsResponse);
      setIncidentProneAreas(incidentProneResponse.areas || []);
      setRoadworks(roadworksResponse);
      setFloodData(floodResponse);
      
      // Generate road-aligned heatmap data for Las Piñas major roads
      // (Bypassing API to ensure road alignment)
      const roadHeatmapData = [];
        
        // Define major roads in Las Piñas with their coordinates (following actual road paths)
        const majorRoads = [
          // ALABANG-ZAPOTE ROAD (Main horizontal road at top) - Multiple segments for accuracy
          { start: [14.4650, 120.9950], end: [14.4650, 121.0100], intensity: 0.8 },
          { start: [14.4650, 121.0100], end: [14.4650, 121.0250], intensity: 0.85 },
          { start: [14.4650, 121.0250], end: [14.4650, 121.0400], intensity: 0.8 },
          { start: [14.4650, 121.0400], end: [14.4650, 121.0500], intensity: 0.75 },
          
          // QUIRINO AVENUE / MARCOS ALVAREZ AVE (Diagonal major road)
          { start: [14.4600, 121.0000], end: [14.4500, 121.0100], intensity: 0.85 },
          { start: [14.4500, 121.0100], end: [14.4400, 121.0200], intensity: 0.9 },
          { start: [14.4400, 121.0200], end: [14.4300, 121.0300], intensity: 0.85 },
          
          // REAL STREET (Vertical road on left)
          { start: [14.4700, 121.0000], end: [14.4600, 121.0000], intensity: 0.6 },
          { start: [14.4600, 121.0000], end: [14.4500, 121.0000], intensity: 0.65 },
          { start: [14.4500, 121.0000], end: [14.4400, 121.0000], intensity: 0.6 },
          { start: [14.4400, 121.0000], end: [14.4300, 121.0000], intensity: 0.55 },
          
          // DAANG HARI ROAD (Vertical road on right)
          { start: [14.4700, 121.0400], end: [14.4600, 121.0400], intensity: 0.75 },
          { start: [14.4600, 121.0400], end: [14.4500, 121.0400], intensity: 0.8 },
          { start: [14.4500, 121.0400], end: [14.4400, 121.0400], intensity: 0.75 },
          { start: [14.4400, 121.0400], end: [14.4300, 121.0400], intensity: 0.7 },
          
          // CAA ROAD / NAGA ROAD (Horizontal middle)
          { start: [14.4450, 121.0000], end: [14.4450, 121.0150], intensity: 0.7 },
          { start: [14.4450, 121.0150], end: [14.4450, 121.0300], intensity: 0.75 },
          { start: [14.4450, 121.0300], end: [14.4450, 121.0450], intensity: 0.7 },
          
          // BF HOMES AREA - Multiple parallel roads
          { start: [14.4400, 121.0150], end: [14.4400, 121.0350], intensity: 0.7 },
          { start: [14.4380, 121.0150], end: [14.4380, 121.0350], intensity: 0.65 },
          { start: [14.4360, 121.0150], end: [14.4360, 121.0350], intensity: 0.6 },
          
          // TALON AREA ROADS
          { start: [14.4300, 121.0100], end: [14.4300, 121.0300], intensity: 0.7 },
          { start: [14.4280, 121.0100], end: [14.4280, 121.0300], intensity: 0.65 },
          
          // PAMPLONA AREA (North)
          { start: [14.4550, 121.0100], end: [14.4550, 121.0300], intensity: 0.65 },
          { start: [14.4530, 121.0100], end: [14.4530, 121.0300], intensity: 0.6 },
          
          // PULANG LUPA / ALMANZA AREA (South)
          { start: [14.4250, 121.0200], end: [14.4250, 121.0400], intensity: 0.75 },
          { start: [14.4230, 121.0200], end: [14.4230, 121.0400], intensity: 0.7 },
          
          // ZAPOTE-ALABANG ROAD EXTENSION (Lower section)
          { start: [14.4350, 121.0000], end: [14.4350, 121.0200], intensity: 0.7 },
          { start: [14.4350, 121.0200], end: [14.4350, 121.0400], intensity: 0.75 },
        ];
        
        // Generate points along each road
        majorRoads.forEach(road => {
          const { start, end, intensity } = road;
          const numPoints = 15; // Fewer points per segment for cleaner look
          
          for (let i = 0; i <= numPoints; i++) {
            const ratio = i / numPoints;
            const lat = start[0] + (end[0] - start[0]) * ratio;
            const lng = start[1] + (end[1] - start[1]) * ratio;
            
            // Much lower intensity for subtle effect
            const randomVariation = (Math.random() - 0.5) * 0.1;
            const finalIntensity = Math.max(0.1, Math.min(0.4, (intensity * 0.3) + randomVariation));
            
            roadHeatmapData.push({
              lat,
              lng,
              intensity: finalIntensity
            });
          }
        });
        
        setHeatmapData(roadHeatmapData);
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching traffic data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time heatmap updates via WebSocket
  const handleHeatmapUpdate = useCallback((data) => {
    if (isRealTimeActive && data.heatmap_data) {
      console.log('Received real-time heatmap update:', data);
      setHeatmapData(data.heatmap_data);
      setLastUpdateTime(new Date(data.timestamp || Date.now()));
      
      // Also update traffic data if included
      if (data.traffic_data) {
        setTrafficData(data.traffic_data);
      }
    }
  }, [isRealTimeActive]);

  // Handle real-time weather/flood updates via WebSocket
  const handleWeatherUpdate = useCallback((data) => {
    if (isRealTimeActive) {
      console.log('Received real-time weather/flood update:', data);
      setLastUpdateTime(new Date(data.timestamp || Date.now()));
      
      // Update flood data if included
      if (data.flood_data) {
        setFloodData(data.flood_data);
      }
      
      // Update weather-related incidents if included
      if (data.weather_incidents) {
        setIncidents(prevIncidents => {
          // Merge weather incidents with existing traffic incidents
          const nonWeatherIncidents = prevIncidents.filter(incident => 
            !['flooding', 'weather_related'].includes(incident.incident_type)
          );
          return [...nonWeatherIncidents, ...data.weather_incidents];
        });
      }
    }
  }, [isRealTimeActive]);

  // Check simulation status
  const checkSimulationStatus = useCallback(async () => {
    if (user?.role === 'admin' || user?.role === 'traffic_enforcer') {
      try {
        const status = await trafficService.getSimulationStatus();
        setSimulationStatus(status);
      } catch (err) {
        console.warn('Could not fetch simulation status:', err);
      }
    }
  }, [user]);

  // Control simulation
  const toggleSimulation = async () => {
    if (user?.role !== 'admin') return;
    
    try {
      if (simulationStatus.is_running) {
        await trafficService.stopSimulation();
      } else {
        await trafficService.startSimulation(15); // 15 second intervals
      }
      await checkSimulationStatus();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchTrafficData();
    checkSimulationStatus();
    
    // Set up WebSocket connection and listeners
    websocketService.connect();
    websocketService.on('traffic_heatmap_update', handleHeatmapUpdate);
    websocketService.on('weather_update', handleWeatherUpdate);
    
    // Fallback: Refresh data every 30 seconds if real-time is disabled
    let interval = null;
    if (!isRealTimeActive) {
      interval = setInterval(fetchTrafficData, 30000);
    }
    
    return () => {
      websocketService.off('traffic_heatmap_update', handleHeatmapUpdate);
      websocketService.off('weather_update', handleWeatherUpdate);
      if (interval) clearInterval(interval);
    };
  }, [fetchTrafficData, handleHeatmapUpdate, handleWeatherUpdate, isRealTimeActive, checkSimulationStatus]);

  // Form validation helper
  const validateForm = () => {
    const errors = {};
    
    if (!newIncident.title.trim()) {
      errors.title = 'Incident title is required';
    } else if (newIncident.title.length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }
    
    if (newIncident.description && newIncident.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }
    
    if (!newIncident.incident_type) {
      errors.incident_type = 'Please select an incident type';
    }
    
    if (formStep === 3 && !newIncident.severity) {
      errors.severity = 'Please select a severity level';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate step 1 only
  const validateStep1 = () => {
    const errors = {};
    
    if (!newIncident.title.trim()) {
      errors.title = 'Incident title is required';
    } else if (newIncident.title.length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }
    
    if (newIncident.description && newIncident.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle photo upload
  const handlePhotoUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxFiles = 3;
    
    if (uploadedPhotos.length + files.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} photos`);
      return;
    }
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Each photo must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedPhotos(prev => [...prev, {
          id: Date.now() + Math.random(),
          file,
          preview: e.target.result,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove uploaded photo
  const removePhoto = (photoId) => {
    setUploadedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  // Handle location selection
  const handleLocationSelect = (lat, lng) => {
    setTempLocation({ latitude: lat, longitude: lng });
  };

  // LocationPicker component for map interaction
  const LocationPicker = () => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        handleLocationSelect(lat, lng);
      }
    });
    return null;
  };

  // Confirm location selection
  const confirmLocation = () => {
    if (tempLocation) {
      setNewIncident(prev => ({
        ...prev,
        latitude: tempLocation.latitude,
        longitude: tempLocation.longitude
      }));
    }
    setShowLocationPicker(false);
    setTempLocation(null);
  };

  const handleGeocodeSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchError('');
    setSearchLoading(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setTempLocation({ latitude: lat, longitude: lon });
        if (locationMap) {
          locationMap.flyTo([lat, lon], 17, { animate: true, duration: 0.75 });
        }
      } else {
        setSearchError('No results found');
      }
    } catch (err) {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Debounced autocomplete suggestions
  useEffect(() => {
    const controller = new AbortController();
    const query = searchQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightIndex(-1);
      return () => controller.abort();
    }
    const t = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=7`; 
        const resp = await fetch(url, { signal: controller.signal, headers: { 'Accept-Language': 'en' } });
        const data = await resp.json();
        const mapped = (Array.isArray(data) ? data : []).map((d) => ({
          id: `${d.place_id}`,
          name: d.display_name,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon)
        }));
        setSuggestions(mapped);
        setShowSuggestions(true);
        setHighlightIndex(-1);
      } catch (_) {
        // ignore aborts
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [searchQuery]);

  const chooseSuggestion = (s) => {
    setSearchQuery(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
    setTempLocation({ latitude: s.lat, longitude: s.lon });
    if (locationMap) {
      locationMap.flyTo([s.lat, s.lon], 17, { animate: true, duration: 0.75 });
    }
  };

  // Reset form
  const resetForm = () => {
    setNewIncident({
      incident_type: 'accident',
      title: '',
      description: '',
      severity: 'medium',
      latitude: 14.4504,
      longitude: 121.0170
    });
    setFormStep(1);
    setFormErrors({});
    setUploadedPhotos([]);
    setTempLocation(null);
    setShowLocationPicker(false);
  };

  const handleReportIncident = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await trafficService.reportRoadIncident({
        ...newIncident,
        photos: uploadedPhotos.map(photo => photo.file)
      });
      
      setShowSuccessAnimation(true);
      
      // Show success animation for 2 seconds
      setTimeout(() => {
        setShowSuccessAnimation(false);
        setShowReportForm(false);
        resetForm();
        fetchTrafficData();
      }, 2000);
      
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  // Handlers for new smart features
  const handleRouteRequest = (suggestion) => {
    // Show smart routing panel when user requests route from insights
    setShowSmartRouting(true);
    setShowInsights(false);
  };

  const handleRouteSelect = async (route, origin = null, destination = null, allRoutes = []) => {
    // Validate route before selection
    if (!route) {
      console.error('Invalid route: route is null');
      setError('Invalid route selected');
      return;
    }
    
    // If we have origin and destination, try to get detailed route with turn-by-turn instructions
    if (origin && destination && route && origin.lat && origin.lon && destination.lat && destination.lon) {
      try {
        console.log('Fetching detailed route with turn-by-turn instructions...');
        const detailedRoute = await enhancedRoutingService.getDetailedRoute(
          origin.lat,
          origin.lon,
          destination.lat,
          destination.lon,
          { avoidTraffic: true, maxAlternatives: 0 }
        );
        
        // Use the detailed route if available and valid
        if (detailedRoute && detailedRoute.recommended_route && 
            detailedRoute.recommended_route.route_coordinates && 
            detailedRoute.recommended_route.route_coordinates.length >= 2) {
          console.log('Using detailed route with', detailedRoute.recommended_route.route_coordinates.length, 'points');
          setSelectedRoute(detailedRoute.recommended_route);
        } else {
          console.log('Detailed route invalid, using original route');
          setSelectedRoute(route);
        }
      } catch (error) {
        console.error('Error getting detailed route:', error);
        setError('Could not get detailed route, using basic route');
        setSelectedRoute(route);
      }
    } else {
      // Use basic route if no origin/destination or route has coordinates
      console.log('Using basic route');
      setSelectedRoute(route);
    }
    
    setRoutesToShow(allRoutes.length > 0 ? allRoutes : [route]);
    
    // Set origin and destination for map markers
    if (origin) setRouteOrigin(origin);
    if (destination) setRouteDestination(destination);
    
    // Switch to map view if route is selected
    if (route && showSmartRouting) {
      console.log('Selected route for visualization');
    }
  };
  
  // Start navigation mode with the selected route
  const handleStartNavigation = () => {
    // Validate all required data
    if (!selectedRoute) {
      setError('Please select a route before starting navigation');
      return;
    }
    
    if (!routeOrigin || !routeDestination) {
      setError('Origin and destination are required for navigation');
      return;
    }
    
    if (!selectedRoute.route_coordinates || selectedRoute.route_coordinates.length < 2) {
      setError('Invalid route: insufficient coordinates for navigation');
      return;
    }
    
    console.log('Starting navigation with route:', {
      points: selectedRoute.route_coordinates?.length,
      steps: selectedRoute.steps?.length,
      distance: selectedRoute.distance_km,
      duration: selectedRoute.estimated_duration_minutes
    });
    
    // Prepare route with turn-by-turn instructions if not already present
    if (!selectedRoute.steps || selectedRoute.steps.length === 0) {
      console.log('Generating basic route steps...');
      // Generate basic steps for the route based on coordinates
      const enhancedRoute = {
        ...selectedRoute,
        steps: generateRouteSteps(selectedRoute.route_coordinates)
      };
      setSelectedRoute(enhancedRoute);
    }
    
    // Hide other UI elements
    setShowSmartRouting(false);
    setShowInsights(false);
    
    // Enter navigation mode
    setNavigationMode(true);
  };
  
  // Exit navigation mode
  const handleExitNavigation = () => {
    setNavigationMode(false);
    setShowSmartRouting(true);
  };
  
  // Generate basic route steps for turn-by-turn navigation
  const generateRouteSteps = (coordinates) => {
    if (!coordinates || coordinates.length < 3) {
      return [];
    }
    
    const steps = [];
    const stepInterval = Math.max(Math.floor(coordinates.length / 10), 5); // Create steps at regular intervals
    
    for (let i = stepInterval; i < coordinates.length - stepInterval; i += stepInterval) {
      // Calculate direction change to determine maneuver type
      const prev = coordinates[i - stepInterval];
      const current = coordinates[i];
      const next = coordinates[i + stepInterval];
      
      const bearing1 = calculateBearing(prev[0], prev[1], current[0], current[1]);
      const bearing2 = calculateBearing(current[0], current[1], next[0], next[1]);
      
      // Calculate the angle change
      let angleDiff = bearing2 - bearing1;
      if (angleDiff < -180) angleDiff += 360;
      if (angleDiff > 180) angleDiff -= 360;
      
      // Determine maneuver type based on angle
      let maneuverType = 'straight';
      let instruction = 'Continue straight';
      
      if (angleDiff > 30 && angleDiff < 150) {
        maneuverType = 'turn-right';
        instruction = 'Turn right';
      } else if (angleDiff < -30 && angleDiff > -150) {
        maneuverType = 'turn-left';
        instruction = 'Turn left';
      } else if (Math.abs(angleDiff) > 150) {
        maneuverType = 'uturn';
        instruction = 'Make a U-turn';
      }
      
      steps.push({
        index: i,
        maneuver_type: maneuverType,
        instruction: instruction,
        location: coordinates[i]
      });
    }
    
    // Add final step for arrival
    steps.push({
      index: coordinates.length - 1,
      maneuver_type: 'arrive',
      instruction: 'Arrive at destination',
      location: coordinates[coordinates.length - 1]
    });
    
    return steps;
  };
  
  // Calculate bearing between two points
  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const toDeg = (value) => (value * 180) / Math.PI;
    
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const λ1 = toRad(lon1);
    const λ2 = toRad(lon2);
    
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    
    return (toDeg(θ) + 360) % 360;
  };

  const handleMapRouteClick = (route) => {
    setSelectedRoute(route);
  };

  // Handle map style changes
  const handleMapStyleChange = (style) => {
    setMapStyle(style.id);
    setUseTomTomMaps(style.provider === 'TomTom');
    console.log(`Switched to ${style.name} (${style.provider})`);
  };
  
  // Handle fullscreen toggle
  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleToggleAllRoutes = () => {
    setShowAllRoutes(!showAllRoutes);
  };

  const handleClearRoutes = () => {
    setSelectedRoute(null);
    setRoutesToShow([]);
    setRouteOrigin(null);
    setRouteDestination(null);
    setShowAllRoutes(false);
  };

  const toggleInsights = () => {
    setShowInsights(!showInsights);
    if (showSmartRouting) {
      setShowSmartRouting(false);
    }
  };

  const toggleSmartRouting = () => {
    setShowSmartRouting(!showSmartRouting);
    if (showInsights) {
      setShowInsights(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      free_flow: '#22c55e',
      light: '#eab308', 
      moderate: '#f97316',
      heavy: '#ef4444',
      standstill: '#7c3aed'
    };
    return colors[status] || '#6b7280';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#22c55e',
      medium: '#eab308',
      high: '#f97316',
      critical: '#ef4444'
    };
    return colors[severity] || '#6b7280';
  };

  const getFloodLevelColor = (level) => {
    const colors = {
      normal: '#22c55e',
      low: '#eab308',
      moderate: '#f97316',
      high: '#ef4444',
      critical: '#7c3aed'
    };
    return colors[level] || '#6b7280';
  };

  // Map numeric flood alert levels to colors used in fullscreen markers
  const getFloodAlertColor = (alertLevel) => {
    const numericLevel = typeof alertLevel === 'string' ? parseInt(alertLevel, 10) : alertLevel;
    const colorsByLevel = {
      0: '#22c55e', // normal
      1: '#eab308', // low
      2: '#f97316', // moderate
      3: '#ef4444', // high
      4: '#7c3aed'  // critical
    };
    return colorsByLevel[numericLevel] || '#6b7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>
      
      {/* Modern Header with Glassmorphism */}
      <div className="relative bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col space-y-4">
            {/* Title Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                  <div className="relative p-3 sm:p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl transform transition-transform group-hover:scale-110">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
                    Traffic Intelligence
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm lg:text-base mt-0.5 sm:mt-1 font-medium">
                    🚦 Real-time monitoring • Las Piñas City
                  </p>
                  {isScraping && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-1.5 bg-blue-100/80 backdrop-blur-sm rounded-full">
                      <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs sm:text-sm font-semibold text-blue-700">Fetching data...</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Real-time Status Badge - Mobile Optimized */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20">
                <div className={`relative w-2.5 h-2.5 rounded-full ${
                  isRealTimeActive ? 'bg-emerald-500' : 'bg-gray-400'
                }`}>
                  {isRealTimeActive && (
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
                  )}
                </div>
                <span className="text-xs font-bold text-gray-700 hidden sm:inline">
                  {isRealTimeActive ? 'LIVE' : 'PAUSED'}
                </span>
              </div>
            </div>
            
            {/* Action Buttons - Improved Mobile Layout */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Heatmap Overlay Toggle - Mobile Friendly */}
              {viewMode !== 'heatmap' && (
                <button
                  onClick={() => setShowHeatmapOverlay(!showHeatmapOverlay)}
                  className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                    showHeatmapOverlay
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-xl'
                      : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white border border-gray-200/50 shadow-md'
                  }`}
                  title={showHeatmapOverlay ? 'Hide heatmap overlay' : 'Show heatmap overlay'}
                >
                  <span className="mr-1">🌡️</span>
                  <span className="hidden sm:inline">Overlay</span>
                </button>
              )}

              {/* Modern View Mode Tabs - Horizontal Scroll on Mobile */}
              <div className="flex-1 overflow-x-auto scrollbar-hide">
                <div className="flex items-center bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-lg border border-white/20 min-w-max">
                  {[
                    { key: 'normal', label: 'Map', icon: '🗺️', color: 'from-slate-500 to-slate-600' },
                    { key: 'heatmap', label: 'Heat', icon: '🔥', color: 'from-red-500 to-orange-500' },
                    { key: 'incidents', label: 'Alert', icon: '⚠️', color: 'from-amber-500 to-red-500' },
                    { key: 'monitoring', label: 'Data', icon: '📊', color: 'from-blue-500 to-cyan-500' },
                    { key: 'incident_prone', label: 'Risk', icon: '🚨', color: 'from-purple-500 to-pink-500' },
                    { key: 'roadworks', label: 'Work', icon: '🚧', color: 'from-orange-500 to-yellow-500' },
                    { key: 'flood', label: 'Flood', icon: '🌊', color: 'from-cyan-500 to-blue-600' }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setViewMode(mode.key)}
                      className={`relative px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap ${
                        viewMode === mode.key
                          ? `bg-gradient-to-r ${mode.color} text-white shadow-xl`
                          : 'text-gray-600 hover:bg-white/50'
                      }`}
                    >
                      <span className="mr-1 text-sm">{mode.icon}</span>
                      <span>{mode.label}</span>
                      {viewMode === mode.key && (
                        <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-white/50 rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Control Button */}
              <button
                onClick={() => setIsRealTimeActive(!isRealTimeActive)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg ${
                  isRealTimeActive
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:shadow-emerald-500/50'
                    : 'bg-gradient-to-r from-gray-500 to-gray-600 text-white hover:shadow-gray-500/50'
                }`}
              >
                <span className="hidden sm:inline">{isRealTimeActive ? '⏸️ Pause' : '▶️ Resume'}</span>
                <span className="sm:hidden">{isRealTimeActive ? '⏸️' : '▶️'}</span>
              </button>

              {/* Last Update Time */}
              {lastUpdateTime && (
                <div className="flex items-center space-x-2 px-3 py-2 bg-white/70 rounded-lg border border-gray-200/60">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-gray-600">
                    {lastUpdateTime.toLocaleTimeString()}
                  </span>
                </div>
              )}

              {/* Modern Simulation Controls */}
              {user?.role === 'admin' && (
                <div className="flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-sm rounded-xl border border-blue-300/30 shadow-lg">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      simulationStatus.is_running ? 'bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50' : 'bg-gray-400'
                    }`}></div>
                    <span className="text-xs sm:text-sm font-bold text-blue-700 hidden sm:inline">Simulation</span>
                  </div>
                  <span className="text-xs font-semibold text-blue-600">
                    {simulationStatus.roads_monitored} <span className="hidden sm:inline">roads</span>
                  </span>
                  <button
                    onClick={toggleSimulation}
                    className={`px-2 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-md ${
                      simulationStatus.is_running
                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-red-500/50'
                        : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-emerald-500/50'
                    }`}
                  >
                    {simulationStatus.is_running ? '⏹️' : '▶️'}
                  </button>
                </div>
              )}
              
              {/* Smart Features Buttons - Mobile Optimized */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleInsights}
                  className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 text-xs sm:text-sm ${
                    showInsights 
                      ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-pink-500 text-white shadow-purple-500/50'
                      : 'bg-white/80 backdrop-blur-sm text-purple-700 border border-purple-200/50 hover:bg-purple-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Insights</span>
                  <span className="sm:hidden">🧠</span>
                </button>
                
                <button
                  onClick={toggleSmartRouting}
                  className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 text-xs sm:text-sm ${
                    showSmartRouting 
                      ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white shadow-green-500/50'
                      : 'bg-white/80 backdrop-blur-sm text-green-700 border border-green-200/50 hover:bg-green-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="hidden sm:inline">Routing</span>
                  <span className="sm:hidden">🗺️</span>
                </button>
              </div>

              {/* Modern Report Button */}
              {(user?.role === 'traffic_enforcer' || user?.role === 'admin') && (
                <button
                  onClick={() => setShowReportForm(true)}
                  className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-rose-500 via-red-500 to-pink-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95 text-xs sm:text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden sm:inline">Report</span>
                  <span className="sm:hidden">🚨</span>
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 overflow-x-hidden">

      {error && (
        <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 text-red-700 px-4 py-3 rounded-2xl shadow-lg flex items-center space-x-3">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">{error}</span>
        </div>
      )}

        {/* Modern Interactive Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3 lg:gap-4">
          {/* Free Flow Traffic */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 lg:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('monitoring')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-green-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="relative">
                  <div className="absolute -inset-0.5 sm:-inset-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl sm:rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2 sm:p-2.5 lg:p-3 bg-gradient-to-br from-emerald-500 to-green-500 rounded-xl sm:rounded-2xl shadow-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-0.5 sm:mb-1">Free Flow</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 mb-1 sm:mb-1.5">
                  {trafficData.filter(t => t.traffic_status === 'free_flow').length}
                </p>
                <div className="flex items-center space-x-1">
                  <div className="flex-1 h-1 sm:h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((trafficData.filter(t => t.traffic_status === 'free_flow').length / Math.max(trafficData.length, 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">
                    {Math.round((trafficData.filter(t => t.traffic_status === 'free_flow').length / Math.max(trafficData.length, 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Light Traffic */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 lg:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('monitoring')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-amber-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="relative">
                  <div className="absolute -inset-0.5 sm:-inset-1 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-xl sm:rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2 sm:p-2.5 lg:p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl sm:rounded-2xl shadow-lg">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-0.5 sm:mb-1">Light Traffic</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 mb-1 sm:mb-1.5">
                  {trafficData.filter(t => t.traffic_status === 'light').length}
                </p>
                <div className="flex items-center space-x-1">
                  <div className="flex-1 h-1 sm:h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((trafficData.filter(t => t.traffic_status === 'light').length / Math.max(trafficData.length, 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-yellow-600">
                    {Math.round((trafficData.filter(t => t.traffic_status === 'light').length / Math.max(trafficData.length, 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Heavy Traffic */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 lg:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('monitoring')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Heavy Traffic</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">
                  {trafficData.filter(t => ['moderate', 'heavy'].includes(t.traffic_status)).length}
                </p>
                <div className="flex items-center space-x-1">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((trafficData.filter(t => ['moderate', 'heavy'].includes(t.traffic_status)).length / Math.max(trafficData.length, 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-orange-600">
                    {Math.round((trafficData.filter(t => ['moderate', 'heavy'].includes(t.traffic_status)).length / Math.max(trafficData.length, 1)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Incidents */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('incidents')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 to-rose-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Incidents</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{incidents.length}</p>
                <p className="text-xs font-bold text-red-600">
                  {incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length} 🔥 critical
                </p>
              </div>
            </div>
          </div>

          {/* Incident Prone Areas */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('incident_prone')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Risk Zones</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{incidentProneAreas.length}</p>
                <p className="text-xs font-bold text-purple-600">
                  {incidentProneAreas.filter(area => area.risk_score > 70).length} ⚠️ high risk
                </p>
              </div>
            </div>
          </div>

          {/* Active Roadworks */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('roadworks')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScrapeRoadworks();
                  }}
                  disabled={isScraping}
                  className="p-1.5 text-white bg-blue-600/90 backdrop-blur-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {isScraping ? (
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Roadworks</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{roadworks.length}</p>
                <p className="text-xs font-bold text-amber-600">
                  {roadworks.filter(rw => rw.severity === 'high').length} 🚧 active
                </p>
              </div>
            </div>
          </div>

          {/* Flood Monitoring */}
          <div 
            className="group relative bg-white/60 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg border border-white/40 hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-500 cursor-pointer overflow-hidden"
            onClick={() => setViewMode('flood')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative p-2.5 sm:p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl shadow-lg">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Flood Points</p>
                <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-1">{floodData.length}</p>
                <p className="text-xs font-bold text-cyan-600">
                  {floodData.filter(f => f.alert_level >= 3).length} 🌊 critical
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
          {/* Modern Map Container */}
          <div className="xl:col-span-3">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
              {/* Map Header */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-purple-50/50 via-pink-50/50 to-rose-50/50 border-b border-white/30">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-40"></div>
                      <div className="relative p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-gray-900">Live Traffic Map</h3>
                      <p className="text-xs text-gray-600 font-medium hidden sm:block">
                        {viewMode === 'normal' && '🗺️ Clean view'}
                        {viewMode === 'heatmap' && '🔥 Traffic density'}
                        {viewMode === 'incidents' && '⚠️ Active incidents'}
                        {viewMode === 'monitoring' && '📊 Live monitoring'}
                        {viewMode === 'incident_prone' && '🚨 Risk zones'}
                        {viewMode === 'roadworks' && '🚧 Construction zones'}
                        {viewMode === 'flood' && '🌊 Flood monitoring'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Map Controls */}
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    {/* Route Controls */}
                    {(selectedRoute || routesToShow.length > 0) && (
                      <>
                        <button
                          onClick={handleToggleAllRoutes}
                          className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-300 shadow-md hover:shadow-lg ${
                            showAllRoutes 
                              ? 'bg-blue-500 border-blue-600 text-white'
                              : 'bg-white/80 backdrop-blur-sm border-white/40 text-gray-600 hover:bg-white'
                          }`}
                          title={showAllRoutes ? 'Show selected route only' : 'Show all route options'}
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </button>
                        
                        <button
                          onClick={handleClearRoutes}
                          className="p-1.5 sm:p-2 bg-white/80 backdrop-blur-sm rounded-xl border border-white/40 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-600 transition-all duration-300 shadow-md hover:shadow-lg"
                          title="Clear routes"
                        >
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
                        <div className="h-5 w-px bg-gray-300/50"></div>
                      </>
                    )}
                    
                    {/* Refresh Button */}
                    <button
                      onClick={fetchTrafficData}
                      className="p-1.5 sm:p-2 bg-white/80 backdrop-blur-sm rounded-xl border border-white/40 hover:bg-white transition-all duration-300 shadow-md hover:shadow-lg hover:scale-110 active:scale-95"
                      title="Refresh data"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    
                    {/* Map Style Switcher */}
                    <MapStyleSwitcher 
                      onStyleChange={handleMapStyleChange}
                      currentStyle={mapStyle}
                    />
                    
                    {/* Fullscreen Toggle */}
                    <button
                      onClick={handleFullscreenToggle}
                      className="p-1.5 sm:p-2 bg-white/80 backdrop-blur-sm rounded-xl border border-white/40 hover:bg-white transition-all duration-300 shadow-md hover:shadow-lg hover:scale-110 active:scale-95"
                      title="Toggle fullscreen"
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Map Container */}
              <div className="relative h-[400px] sm:h-[500px] lg:h-[600px] bg-gradient-to-br from-gray-100 to-gray-200">
                {/* Loading Overlay */}
                {loading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-gray-600">Loading traffic data...</p>
                    </div>
                  </div>
                )}
                
                <MapContainer
                  center={defaultCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  className="rounded-b-2xl"
                >
                  {/* Dynamic Tile Layer - TomTom or OpenStreetMap */}
                  {mapError ? (
                    <SimpleMapTileLayer
                      opacity={1}
                      zIndex={1}
                    />
                  ) : useTomTomMaps ? (
                    <TomTomTileLayer
                      style={mapStyle}
                      opacity={1}
                      zIndex={1}
                      onError={(error) => {
                        console.warn('TomTom tiles failed, falling back to OpenStreetMap:', error);
                        setUseTomTomMaps(false);
                        setMapError(true);
                      }}
                    />
                  ) : (
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      subdomains={['a', 'b', 'c']}
                    />
                  )}
                  
                  {/* Route Visualization Layer */}
                  {!navigationMode ? (
                    <RouteLayer
                      routes={routesToShow}
                      selectedRoute={selectedRoute}
                      onRouteClick={handleMapRouteClick}
                      showAllRoutes={showAllRoutes}
                      origin={routeOrigin}
                      destination={routeDestination}
                    />
                  ) : (
                    <EnhancedNavigationMode
                      route={selectedRoute}
                      origin={routeOrigin}
                      destination={routeDestination}
                      onExitNavigation={handleExitNavigation}
                    />
                  )}
                  
                  {/* View Mode Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    📍 {viewMode.charAt(0).toUpperCase() + viewMode.slice(1).replace('_', ' ')} View
                    {selectedRoute && (
                      <div style={{ marginTop: '4px', color: '#2563eb' }}>
                        🗺️ Route: {selectedRoute.route_name}
                      </div>
                    )}
                  </div>

                  {/* Route Legend */}
                  {(selectedRoute || routesToShow.length > 0) && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      zIndex: 1000,
                      background: 'rgba(255, 255, 255, 0.95)',
                      padding: '12px',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      fontSize: '11px',
                      minWidth: '150px'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                        Route Legend
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '6px' }}></div>
                        <span>Origin (A)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '6px' }}></div>
                        <span>Destination (B)</span>
                      </div>
                      {selectedRoute && (
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                          <div style={{ 
                            width: '20px', 
                            height: '3px', 
                            backgroundColor: smartRoutingService.getRoutePolylineColor(selectedRoute), 
                            marginRight: '6px',
                            borderRadius: '2px'
                          }}></div>
                          <span>Selected Route</span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Traffic Heatmap - Only show in heatmap mode with reduced intensity */}
                {(viewMode === 'heatmap' || showHeatmapOverlay) && heatmapData.length > 0 && (
                  <HeatmapLayer
                    points={heatmapData.map(point => [
                      point.lat,
                      point.lng,
                      point.intensity || 0.3  // Reduced intensity
                    ])}
                    options={{
                      radius: 20,    // Reduced radius
                      blur: 12,      // Reduced blur
                      maxZoom: 15,
                      max: 0.8,      // Reduced max intensity
                      minOpacity: 0.2  // Reduced opacity
                    }}
                  />
                )}

                {/* Fallback message when no heatmap data */}
                {(viewMode === 'heatmap' || showHeatmapOverlay) && heatmapData.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p className="text-gray-600">No traffic heatmap data available</p>
                    <p className="text-sm text-gray-500">Switch to "Data" view to see monitoring points</p>
                  </div>
                )}

                {/* Traffic Monitoring Points */}
                {viewMode === 'monitoring' && trafficData.map((traffic) => (
                  <Marker
                    key={traffic.id}
                    position={[traffic.latitude, traffic.longitude]}
                    icon={L.divIcon({
                      className: 'traffic-marker',
                      html: `<div style="background-color: ${getStatusColor(traffic.traffic_status)}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{traffic.road_name}</h3>
                        <p className="text-sm text-gray-600">Status: {traffic.traffic_status}</p>
                        <p className="text-sm text-gray-600">Speed: {traffic.average_speed_kmh || 'N/A'} km/h</p>
                        <p className="text-sm text-gray-600">Vehicles: {traffic.vehicle_count}</p>
                        <p className="text-sm text-gray-600">Congestion: {traffic.congestion_percentage}%</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Road Incidents */}
                {(viewMode === 'incidents' || viewMode === 'heatmap') && incidents.map((incident) => (
                  <Marker
                    key={incident.id}
                    position={[incident.latitude, incident.longitude]}
                    icon={L.divIcon({
                      className: 'incident-marker',
                      html: `<div style="background-color: ${getSeverityColor(incident.severity)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">⚠</div>`,
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{incident.title}</h3>
                        <p className="text-sm text-gray-600">Type: {incident.incident_type}</p>
                        <p className="text-sm text-gray-600">Severity: {incident.severity}</p>
                        <p className="text-sm text-gray-600">{incident.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Reported: {new Date(incident.created_at).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Incident Prone Areas */}
                {(viewMode === 'incident_prone' || viewMode === 'heatmap') && incidentProneAreas.map((area) => (
                  <Marker
                    key={`prone-${area.id}`}
                    position={[area.latitude, area.longitude]}
                    icon={L.divIcon({
                      className: 'incident-prone-marker',
                      html: `<div style="background-color: ${incidentProneService.getAreaTypeColor(area.area_type)}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${incidentProneService.getAreaTypeIcon(area.area_type)}</div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    })}
                    eventHandlers={{
                      click: () => {
                        setSelectedIncident(area);
                      }
                    }}
                  >
                    <Popup>
                      <div className="p-3 max-w-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{incidentProneService.getAreaTypeIcon(area.area_type)}</span>
                          <h3 className="font-semibold text-gray-900">{area.area_name}</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Type:</span>
                            <span className="text-sm font-medium" style={{ color: incidentProneService.getAreaTypeColor(area.area_type) }}>
                              {incidentProneService.getAreaTypeLabel(area.area_type)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Risk Score:</span>
                            <span className="text-sm font-bold" style={{ color: incidentProneService.getRiskScoreColor(area.risk_score) }}>
                              {area.risk_score.toFixed(1)} / 100
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Severity:</span>
                            <span className="text-sm font-medium capitalize" style={{ color: incidentProneService.getSeverityColor(area.severity_level) }}>
                              {area.severity_level}
                            </span>
                          </div>
                          
                          {area.barangay && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Barangay:</span>
                              <span className="text-sm">{area.barangay}</span>
                            </div>
                          )}
                          
                          {area.incident_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Incidents:</span>
                              <span className="text-sm font-medium">{area.incident_count}</span>
                            </div>
                          )}
                        </div>
                        
                        {area.description && (
                          <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                            {area.description}
                          </p>
                        )}
                        
                        {area.prevention_measures && (
                          <div className="mt-3 p-2 bg-blue-50 rounded">
                            <p className="text-xs font-medium text-blue-800 mb-1">Safety Measures:</p>
                            <p className="text-xs text-blue-700">{area.prevention_measures}</p>
                          </div>
                        )}
                        
                        <div className="mt-3 text-xs text-gray-500">
                          <div>Source: {area.data_source.replace('_', ' ')}</div>
                          {area.is_verified && (
                            <div className="text-green-600 font-medium">✓ Verified</div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Flood Monitoring Points */}
                {(viewMode === 'flood' || viewMode === 'heatmap') && floodData.map((flood, index) => (
                  <Marker
                    key={`normal-flood-${flood.id}-${index}`}
                    position={[flood.latitude, flood.longitude]}
                    icon={L.divIcon({
                      className: 'flood-marker',
                      html: `<div style="background-color: ${getFloodLevelColor(flood.flood_level)}; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">🌊</div>`,
                      iconSize: [28, 28],
                      iconAnchor: [14, 14]
                    })}
                  >
                    <Popup>
                      <div className="p-3 max-w-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🌊</span>
                          <h3 className="font-semibold text-gray-900">{flood.location_name}</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Water Level:</span>
                            <span className="text-sm font-medium">{flood.water_level_cm} cm</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Flood Level:</span>
                            <span 
                              className="text-sm font-medium capitalize"
                              style={{ color: getFloodLevelColor(flood.flood_level) }}
                            >
                              {flood.flood_level}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Alert Level:</span>
                            <span className="text-sm font-bold">{flood.alert_level}/4</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Passable:</span>
                            <span className={`text-sm font-medium ${flood.estimated_passable ? 'text-green-600' : 'text-red-600'}`}>
                              {flood.estimated_passable ? '✅ Yes' : '❌ No'}
                            </span>
                          </div>
                          
                          {flood.is_flood_prone && (
                            <div className="text-sm text-orange-600 font-medium">
                              ⚠️ Flood-prone area
                            </div>
                          )}
                        </div>
                        
                        {flood.evacuation_center_nearby && (
                          <div className="mt-3 p-2 bg-blue-50 rounded">
                            <p className="text-xs font-medium text-blue-800 mb-1">Evacuation Center:</p>
                            <p className="text-xs text-blue-700">{flood.evacuation_center_nearby}</p>
                          </div>
                        )}
                        
                        {flood.affected_roads && (
                          <div className="mt-3 p-2 bg-orange-50 rounded">
                            <p className="text-xs font-medium text-orange-800 mb-1">Affected Roads:</p>
                            <p className="text-xs text-orange-700">{flood.affected_roads}</p>
                          </div>
                        )}
                        
                        <div className="mt-3 text-xs text-gray-500">
                          <div>Updated: {new Date(flood.last_updated).toLocaleString()}</div>
                          {flood.sensor_id && (
                            <div>Sensor: {flood.sensor_id}</div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Roadworks */}
                {(viewMode === 'roadworks' || viewMode === 'heatmap' || viewMode === 'incidents') && roadworks.map((roadwork) => (
                  <Marker
                    key={`roadwork-${roadwork.id}`}
                    position={[roadwork.latitude, roadwork.longitude]}
                    icon={L.divIcon({
                      className: 'roadwork-marker',
                      html: `<div style="background-color: ${roadworksService.getRoadworkSeverityColor(roadwork.severity)}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">🚧</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                    eventHandlers={{
                      click: () => {
                        setSelectedIncident(roadwork);
                      }
                    }}
                  >
                    <Popup>
                      <div className="p-3 max-w-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">🚧</span>
                          <h3 className="font-semibold text-gray-900">{roadwork.title}</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Type:</span>
                            <span className="text-sm font-medium">Road Work</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Severity:</span>
                            <span className="text-sm font-medium capitalize" style={{ color: roadworksService.getRoadworkSeverityColor(roadwork.severity) }}>
                              {roadwork.severity}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Impact Radius:</span>
                            <span className="text-sm">{roadwork.impact_radius_meters}m</span>
                          </div>
                          
                          {roadwork.estimated_clearance_time && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Expected End:</span>
                              <span className="text-sm">{new Date(roadwork.estimated_clearance_time).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        
                        {roadwork.description && (
                          <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                            {roadwork.description}
                          </p>
                        )}
                        
                        <div className="mt-3 p-2 bg-orange-50 rounded">
                          <p className="text-xs font-medium text-orange-800 mb-1">Traffic Advisory:</p>
                          <p className="text-xs text-orange-700">Plan alternative routes and allow extra travel time</p>
                        </div>
                        
                        <div className="mt-3 text-xs text-gray-500">
                          <div>Source: {roadwork.reporter_source.replace('_', ' ')}</div>
                          <div>Reported: {new Date(roadwork.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

          {/* Enhanced Interactive Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            
            {/* Smart Traffic Insights */}
            {showInsights && (
              <TrafficInsights 
                onRouteRequest={handleRouteRequest}
                className="w-full"
              />
            )}
            
            {/* Smart Routing */}
            {showSmartRouting && (
              <SmartRouting 
                onRouteSelect={handleRouteSelect}
                onStartNavigation={handleStartNavigation}
                className="w-full"
              />
            )}
            {/* Quick Stats Overview */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg border border-white/40 overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b border-white/30">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-40"></div>
                    <div className="relative p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-gray-900">Traffic Overview</h3>
                    <p className="text-xs text-gray-600 font-medium">Real-time status</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
                {/* Traffic Status Bars */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-700">Free Flow</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      {trafficData.filter(t => t.traffic_status === 'free_flow').length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min((trafficData.filter(t => t.traffic_status === 'free_flow').length / Math.max(trafficData.length, 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium text-gray-700">Light Traffic</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-600">
                      {trafficData.filter(t => t.traffic_status === 'light').length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min((trafficData.filter(t => t.traffic_status === 'light').length / Math.max(trafficData.length, 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-gray-700">Heavy Traffic</span>
                    </div>
                    <span className="text-sm font-bold text-red-600">
                      {trafficData.filter(t => ['moderate', 'heavy'].includes(t.traffic_status)).length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-red-400 to-red-500 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min((trafficData.filter(t => ['moderate', 'heavy'].includes(t.traffic_status)).length / Math.max(trafficData.length, 1)) * 100, 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Incidents Enhanced */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-lg border border-white/40 overflow-hidden">
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-red-50/50 to-pink-50/50 border-b border-white/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="relative">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl blur opacity-40"></div>
                      <div className="relative p-1.5 sm:p-2 bg-gradient-to-br from-red-500 to-pink-500 rounded-xl shadow-lg">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-gray-900">Active Incidents</h3>
                      <p className="text-xs text-gray-600 font-medium">{incidents.length} total</p>
                    </div>
                  </div>
                  
                  {incidents.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-red-600 font-medium">Live</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                {incidents.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">No active incidents</p>
                    <p className="text-xs text-gray-400 mt-1">Traffic is flowing smoothly</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {incidents.map((incident, index) => (
                      <div 
                        key={incident.id} 
                        className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200 group"
                        onClick={() => setSelectedIncident(incident)}
                      >
                        <div className="flex items-start space-x-2 sm:space-x-3">
                          <div 
                            className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                            style={{ backgroundColor: getSeverityColor(incident.severity) }}
                          ></div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-bold text-gray-900 text-xs sm:text-sm truncate">{incident.title}</h4>
                              <span className="text-xs text-gray-400 flex-shrink-0">#{index + 1}</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1 capitalize truncate">
                              {incident.incident_type.replace('_', ' ')} • {incident.severity} priority
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-400">
                                {new Date(incident.created_at).toLocaleTimeString()}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          {/* Incident Prone Areas List */}
          {viewMode === 'incident_prone' && (
            <div className="sidebar-card">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Incident Prone Areas</h3>
                <p className="text-xs text-gray-500">
                  {incidentProneAreas.filter(area => area.risk_score > 70).length} high risk areas
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {incidentProneAreas.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No incident prone areas</p>
                ) : (
                  incidentProneService.sortAreasByPriority(incidentProneAreas).map((area) => (
                    <div 
                      key={`sidebar-${area.id}`} 
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedIncident(area)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{incidentProneService.getAreaTypeIcon(area.area_type)}</span>
                          <span className="font-medium text-sm truncate">{area.area_name}</span>
                        </div>
                        <span 
                          className="text-xs px-2 py-1 rounded-full text-white font-medium"
                          style={{ backgroundColor: incidentProneService.getRiskScoreColor(area.risk_score) }}
                        >
                          {area.risk_score.toFixed(0)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span 
                          className="font-medium"
                          style={{ color: incidentProneService.getAreaTypeColor(area.area_type) }}
                        >
                          {incidentProneService.getAreaTypeLabel(area.area_type)}
                        </span>
                        <span className="text-gray-500 capitalize">{area.severity_level}</span>
                      </div>
                      
                      {area.barangay && (
                        <p className="text-xs text-gray-400 mt-1">📍 {area.barangay}</p>
                      )}
                      
                      {area.incident_count > 0 && (
                        <p className="text-xs text-gray-400">🔢 {area.incident_count} incidents</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Flood Monitoring List */}
          {viewMode === 'flood' && (
            <div className="sidebar-card">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Flood Monitoring</h3>
                <p className="text-xs text-gray-500">
                  {floodData.filter(f => f.alert_level >= 3).length} critical alerts • {floodData.filter(f => !f.estimated_passable).length} impassable
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {floodData.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No flood monitoring data</p>
                ) : (
                  // Sort by alert level (highest first) then by water level
                  floodData
                    .sort((a, b) => {
                      if (b.alert_level !== a.alert_level) {
                        return b.alert_level - a.alert_level;
                      }
                      return b.water_level_cm - a.water_level_cm;
                    })
                    .map((flood, index) => (
                      <div 
                        key={`sidebar-flood-${flood.id}-${index}`} 
                        className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedIncident(flood)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">🌊</span>
                            <span className="font-medium text-sm truncate">{flood.location_name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span 
                              className="text-xs px-2 py-1 rounded-full text-white font-medium"
                              style={{ backgroundColor: getFloodLevelColor(flood.flood_level) }}
                            >
                              {flood.flood_level}
                            </span>
                            {flood.alert_level >= 3 && (
                              <span className="text-xs text-red-600 font-bold">⚠️</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            Water: {flood.water_level_cm}cm
                          </span>
                          <span className="text-gray-500">
                            Alert: {flood.alert_level}/4
                          </span>
                        </div>
                        
                        {!flood.estimated_passable && (
                          <p className="text-xs text-red-600 mt-1 font-medium">❌ Not passable</p>
                        )}
                        
                        {flood.is_flood_prone && (
                          <p className="text-xs text-orange-600 mt-1">⚠️ Flood-prone area</p>
                        )}
                        
                        <p className="text-xs text-gray-400 mt-1">
                          🕒 Updated: {new Date(flood.last_updated).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Roadworks List */}
          {viewMode === 'roadworks' && (
            <div className="sidebar-card">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold">Active Roadworks</h3>
                  {user?.role === 'admin' && (
                    <button
                      onClick={handleScrapeRoadworks}
                      disabled={isScraping}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
                    >
                      {isScraping ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Scraping...
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Scrape
                        </>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {roadworks.filter(rw => rw.severity === 'high').length} high impact works
                </p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {roadworks.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No active roadworks</p>
                ) : (
                  roadworksService.sortRoadworksByPriority(roadworks).map((roadwork) => (
                    <div 
                      key={`sidebar-roadwork-${roadwork.id}`} 
                      className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedIncident(roadwork)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">🚧</span>
                          <span className="font-medium text-sm truncate">{roadwork.title}</span>
                        </div>
                        <span 
                          className="text-xs px-2 py-1 rounded-full text-white font-medium"
                          style={{ backgroundColor: roadworksService.getRoadworkSeverityColor(roadwork.severity) }}
                        >
                          {roadwork.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Impact: {roadwork.impact_radius_meters}m radius
                        </span>
                        <span className="text-gray-500 capitalize">
                          {roadwork.estimated_clearance_time ? 
                            `Ends: ${new Date(roadwork.estimated_clearance_time).toLocaleDateString()}` : 
                            'Ongoing'
                          }
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        📍 {roadwork.description ? roadwork.description.substring(0, 60) + '...' : 'Road work in progress'}
                      </p>
                      
                      <p className="text-xs text-gray-400">
                        🕒 Started: {new Date(roadwork.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
              
              {/* Scraping Results Panel */}
              {user?.role === 'admin' && scrapingResult && (
                <div className="p-4 border-t border-gray-200 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-sm font-semibold text-green-800">Scraping Complete</h4>
                  </div>
                  <div className="text-xs text-green-700 space-y-1">
                    <p>✅ Scraped {scrapingResult.result?.scraped_roadworks || 0} roadworks</p>
                    {scrapingResult.result?.database_result && (
                      <>
                        <p>📊 New: {scrapingResult.result.database_result.new_roadworks || 0}</p>
                        <p>🔄 Updated: {scrapingResult.result.database_result.updated_roadworks || 0}</p>
                      </>
                    )}
                    <p className="text-gray-600">
                      Sources: DPWH, LGU, MMDA, News, Social Media, Facebook
                    </p>
                  </div>
                </div>
              )}
              
              {/* Facebook Pages Configuration (Admin only) */}
              {user?.role === 'admin' && (
              <div className="p-4 border-t border-gray-200 bg-blue-50">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-blue-800">Facebook Pages</h4>
                </div>
                <div className="space-y-2">
                  {facebookPages.map((page, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={page}
                        onChange={(e) => {
                          const newPages = [...facebookPages];
                          newPages[index] = e.target.value;
                          setFacebookPages(newPages);
                        }}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Facebook page URL"
                      />
                      <button
                        onClick={() => {
                          const newPages = facebookPages.filter((_, i) => i !== index);
                          setFacebookPages(newPages);
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setFacebookPages([...facebookPages, ''])}
                    className="w-full px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 rounded border border-blue-300"
                  >
                    + Add Facebook Page
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Add Facebook page URLs to scrape traffic and weather updates
                </p>
              </div>
              )}
            </div>
          )}

          {/* Traffic Legend */}
          <div className="legend-card p-4">
            <h3 className="text-lg font-semibold mb-3">Traffic Legend</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm">Free Flow</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Light Traffic</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <span className="text-sm">Moderate Traffic</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm">Heavy Traffic</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                <span className="text-sm">Standstill</span>
              </div>
              
              {/* Divider */}
              <hr className="my-3 border-gray-200" />
              
              {/* Roadworks Legend */}
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">🚧</div>
                <span className="text-sm">Low Impact Roadwork</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs">🚧</div>
                <span className="text-sm">Medium Impact Roadwork</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">🚧</div>
                <span className="text-sm">High Impact Roadwork</span>
              </div>
              
              {/* Divider */}
              <hr className="my-3 border-gray-200" />
              
              {/* Flood Level Legend */}
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">🌊</div>
                <span className="text-sm">Normal Flood Level</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-white text-xs">🌊</div>
                <span className="text-sm">Low Flood Level</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">🌊</div>
                <span className="text-sm">Moderate Flood Level</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">🌊</div>
                <span className="text-sm">High Flood Level</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs">🌊</div>
                <span className="text-sm">Critical Flood Level</span>
              </div>
              
              {/* Divider */}
              <hr className="my-3 border-gray-200" />
              
              {/* Other markers */}
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-white text-xs">⚠</div>
                <span className="text-sm">Active Incident</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">⚠️</div>
                <span className="text-sm">Incident Prone Area</span>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Enhanced Interactive Report Incident Modal */}
        {showReportForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform transition-all duration-300 scale-100">
              
              {/* Success Animation Overlay */}
              {showSuccessAnimation && (
                <div className="absolute inset-0 bg-green-500 flex items-center justify-center z-10 rounded-3xl">
                  <div className="text-center text-white">
                    <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-green-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Incident Reported!</h3>
                    <p className="text-green-100">Thank you for helping keep our roads safe</p>
                  </div>
                </div>
              )}

              {/* Modal Header with Progress */}
              <div className="px-8 py-6 bg-gradient-to-r from-red-50 via-pink-50 to-red-50 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Report Traffic Incident</h2>
                      <p className="text-sm text-gray-600">Help keep our community roads safe and informed</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowReportForm(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-red-100 rounded-xl transition-colors duration-200 group"
                  >
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center space-x-4">
                  {[
                    { step: 1, label: 'Type & Details', icon: '📝' },
                    { step: 2, label: 'Location & Photos', icon: '📍' },
                    { step: 3, label: 'Review & Submit', icon: '✅' }
                  ].map((item) => (
                    <div key={item.step} className="flex items-center">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                        formStep >= item.step 
                          ? 'bg-red-500 border-red-500 text-white' 
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}>
                        {formStep > item.step ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-sm font-bold">{item.step}</span>
                        )}
                      </div>
                      <span className={`ml-3 text-sm font-medium ${
                        formStep >= item.step ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {item.label}
                      </span>
                      {item.step < 3 && <div className="w-8 h-px bg-gray-300 ml-4"></div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Body with Steps */}
              <form onSubmit={handleReportIncident} className="overflow-y-auto max-h-[calc(90vh-200px)]">
                
                {/* Debug indicator - remove in production */}
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 text-xs">
                  Debug: Current Step = {formStep}, Title = "{newIncident.title}", Photos = {uploadedPhotos.length}, ShowLocationPicker = {showLocationPicker.toString()}
                </div>
                
                {/* Step 1: Type & Details */}
                {formStep === 1 && (
                  <div className="p-8 space-y-6">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">What type of incident are you reporting?</h3>
                      <p className="text-sm text-gray-500">Select the category that best describes the incident</p>
                    </div>

                    {/* Incident Type - Visual Cards */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4">Incident Type</label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { value: 'accident', label: 'Traffic Accident', icon: '🚗', color: 'red', description: 'Vehicle collision or crash' },
                          { value: 'road_work', label: 'Road Construction', icon: '🚧', color: 'orange', description: 'Construction or maintenance' },
                          { value: 'flooding', label: 'Flooding', icon: '🌊', color: 'blue', description: 'Water on roadway' },
                          { value: 'vehicle_breakdown', label: 'Vehicle Breakdown', icon: '⚙️', color: 'yellow', description: 'Disabled vehicle' },
                          { value: 'debris', label: 'Road Debris', icon: '🗑️', color: 'gray', description: 'Objects blocking road' },
                          { value: 'other', label: 'Other', icon: '❓', color: 'purple', description: 'Other traffic issue' }
                        ].map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={() => setNewIncident({...newIncident, incident_type: type.value})}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg transform hover:scale-105 ${
                              newIncident.incident_type === type.value
                                ? 'border-red-500 bg-red-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-2xl">{type.icon}</span>
                              <span className="font-semibold text-gray-900">{type.label}</span>
                            </div>
                            <p className="text-xs text-gray-500">{type.description}</p>
                          </button>
                        ))}
                      </div>
                      {formErrors.incident_type && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formErrors.incident_type}
                        </p>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Incident Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newIncident.title}
                        onChange={(e) => {
                          setNewIncident({...newIncident, title: e.target.value});
                          if (formErrors.title) {
                            setFormErrors(prev => ({...prev, title: ''}));
                          }
                        }}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 transition-colors duration-200 ${
                          formErrors.title ? 'border-red-300' : 'border-gray-300 focus:border-red-500'
                        }`}
                        placeholder="Brief description of the incident (e.g., 'Multi-car collision on Main St')"
                      />
                      {formErrors.title && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formErrors.title}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">{newIncident.title.length}/100 characters</p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Details</label>
                      <textarea
                        value={newIncident.description}
                        onChange={(e) => {
                          setNewIncident({...newIncident, description: e.target.value});
                          if (formErrors.description) {
                            setFormErrors(prev => ({...prev, description: ''}));
                          }
                        }}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-red-500 transition-colors duration-200 resize-none ${
                          formErrors.description ? 'border-red-300' : 'border-gray-300 focus:border-red-500'
                        }`}
                        rows="4"
                        placeholder="Provide additional details about the incident, injuries, road conditions, etc. (optional)"
                      />
                      {formErrors.description && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formErrors.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">{newIncident.description.length}/500 characters</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Location & Photos */}
                {formStep === 2 && (
                  <div className="p-8 space-y-6">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Where did this incident occur?</h3>
                      <p className="text-sm text-gray-500">Set the location and add photos if available</p>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Incident Location</label>
                      <div className="bg-gray-50 rounded-xl p-4 border-2 border-dashed border-gray-300">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Current Location</p>
                            <p className="text-xs text-gray-500">Lat: {newIncident.latitude.toFixed(6)}, Lng: {newIncident.longitude.toFixed(6)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              console.log('Pick on Map button clicked');
                              console.log('Current showLocationPicker state:', showLocationPicker);
                              setShowLocationPicker(true);
                              console.log('Setting showLocationPicker to true');
                            }}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm font-medium"
                          >
                            📍 Pick on Map
                          </button>
                        </div>
                        <div className="text-xs text-gray-400">
                          💡 Tip: Click "Pick on Map" to precisely select the incident location
                        </div>
                      </div>
                    </div>

                    {/* Photo Upload */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Photos (Optional)
                        <span className="text-gray-500 font-normal ml-1">- Help others understand the situation</span>
                      </label>
                      
                      {/* Upload Area */}
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-400 transition-colors duration-200 bg-gray-50">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                          id="photo-upload-step2"
                        />
                        <label htmlFor="photo-upload-step2" className="cursor-pointer block">
                          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                            </svg>
                          </div>
                          <p className="text-lg font-medium text-gray-700 mb-2">📸 Upload Photos</p>
                          <p className="text-sm text-gray-500 mb-1">Click here to select photos from your device</p>
                          <p className="text-xs text-gray-400">PNG, JPG up to 5MB each (max 3 photos)</p>
                        </label>
                      </div>

                      {/* Uploaded Photos Preview */}
                      {uploadedPhotos.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-4">
                          {uploadedPhotos.map((photo) => (
                            <div key={photo.id} className="relative group">
                              <img
                                src={photo.preview}
                                alt={photo.name}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(photo.id)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <p className="text-xs text-gray-500 mt-1 truncate">{photo.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Review & Submit */}
                {formStep === 3 && (
                  <div className="p-8 space-y-6">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Review Your Report</h3>
                      <p className="text-sm text-gray-500">Please review the information before submitting</p>
                    </div>

                    {/* Severity Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Severity Level <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { value: 'low', label: 'Low Priority', color: 'green', icon: '🟢', description: 'Minor issue, minimal impact' },
                          { value: 'medium', label: 'Medium Priority', color: 'yellow', icon: '🟡', description: 'Moderate impact on traffic' },
                          { value: 'high', label: 'High Priority', color: 'orange', icon: '🟠', description: 'Significant traffic disruption' },
                          { value: 'critical', label: 'Critical', color: 'red', icon: '🔴', description: 'Emergency, immediate attention' }
                        ].map((severity) => (
                          <button
                            key={severity.value}
                            type="button"
                            onClick={() => setNewIncident({...newIncident, severity: severity.value})}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 text-left hover:shadow-lg transform hover:scale-105 ${
                              newIncident.severity === severity.value
                                ? 'border-red-500 bg-red-50 shadow-lg'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-center space-x-3 mb-2">
                              <span className="text-xl">{severity.icon}</span>
                              <span className="font-semibold text-gray-900">{severity.label}</span>
                            </div>
                            <p className="text-xs text-gray-500">{severity.description}</p>
                          </button>
                        ))}
                      </div>
                      {formErrors.severity && (
                        <p className="mt-2 text-sm text-red-600 flex items-center">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formErrors.severity}
                        </p>
                      )}
                    </div>

                    {/* Summary Card */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Report Summary
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Type:</p>
                          <p className="font-medium capitalize">{newIncident.incident_type.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Severity:</p>
                          <p className="font-medium capitalize">{newIncident.severity}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-600">Title:</p>
                          <p className="font-medium">{newIncident.title}</p>
                        </div>
                        {newIncident.description && (
                          <div className="col-span-2">
                            <p className="text-gray-600">Description:</p>
                            <p className="font-medium">{newIncident.description}</p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-gray-600">Location:</p>
                          <p className="font-medium text-xs">{newIncident.latitude.toFixed(6)}, {newIncident.longitude.toFixed(6)}</p>
                        </div>
                        {uploadedPhotos.length > 0 && (
                          <div className="col-span-2">
                            <p className="text-gray-600">Photos:</p>
                            <p className="font-medium">{uploadedPhotos.length} photo(s) attached</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer with Navigation */}
                <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                  <div className="flex space-x-3">
                    {formStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormStep(formStep - 1)}
                        className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-100 font-medium transition-colors duration-200 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Previous</span>
                      </button>
                    )}
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReportForm(false);
                        resetForm();
                      }}
                      className="px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    
                    {formStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          console.log('Continue button clicked, current step:', formStep);
                          console.log('Current incident data:', newIncident);
                          
                          if (formStep === 1) {
                            // Validate only required fields for step 1
                            if (!newIncident.title.trim()) {
                              setFormErrors({ title: 'Incident title is required' });
                              console.log('Validation failed: title required');
                              return;
                            }
                            if (newIncident.title.length < 5) {
                              setFormErrors({ title: 'Title must be at least 5 characters' });
                              console.log('Validation failed: title too short');
                              return;
                            }
                            // Clear errors and proceed
                            setFormErrors({});
                            console.log('Validation passed, moving to step 2');
                            setFormStep(2);
                          } else if (formStep === 2) {
                            console.log('Moving from step 2 to step 3');
                            setFormStep(3);
                          }
                        }}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                      >
                        <span>Continue</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center space-x-2"
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Submitting...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            <span>Submit Report</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Location Picker Modal */}
        {showLocationPicker && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 md:p-8" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl lg:max-w-5xl h-[75vh] md:h-[70vh] overflow-hidden border border-gray-100">
              <div className="p-3 sm:p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">Select Incident Location</h3>
                  <span className="hidden md:inline text-xs text-gray-500">Click map or drag the red marker</span>
                </div>
                <button
                  onClick={() => {
                    setShowLocationPicker(false);
                    setTempLocation(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  aria-label="Close location picker"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search bar */}
              <div className="px-3 sm:px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <div className="relative flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (!showSuggestions) {
                        if (e.key === 'Enter') handleGeocodeSearch();
                        return;
                      }
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightIndex((i) => Math.max(i - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
                          chooseSuggestion(suggestions[highlightIndex]);
                        } else {
                          handleGeocodeSearch();
                        }
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                    placeholder="Search place, address, landmark..."
                    className="w-full bg-transparent outline-none text-sm"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute z-[10000] left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto text-sm">
                      {suggestions.map((s, idx) => (
                        <li
                          key={s.id}
                          className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${idx === highlightIndex ? 'bg-gray-100' : ''}`}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          onMouseDown={(e) => { e.preventDefault(); chooseSuggestion(s); }}
                        >
                          {s.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button onClick={handleGeocodeSearch} disabled={searchLoading} className="px-3 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                  {searchLoading ? 'Searching...' : 'Search'}
                </button>
              </div>

              <div className="h-[60vh] md:h-[52vh] relative">
                <MapContainer
                  center={[newIncident.latitude, newIncident.longitude]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                  className="cursor-crosshair"
                  whenCreated={(map) => setLocationMap(map)}
                  zoomControl={false}
                >
                  <ZoomControl position="topleft" />
                  <ScaleControl position="bottomleft" />
                  {/* Dynamic Tile Layer - TomTom or OpenStreetMap */}
                  {mapError ? (
                    <SimpleMapTileLayer
                      opacity={1}
                      zIndex={1}
                    />
                  ) : useTomTomMaps ? (
                    <TomTomTileLayer
                      style={mapStyle}
                      opacity={1}
                      zIndex={1}
                      onError={(error) => {
                        console.warn('TomTom tiles failed in modal, falling back to OpenStreetMap:', error);
                        setUseTomTomMaps(false);
                        setMapError(true);
                      }}
                    />
                  ) : (
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      subdomains={['a', 'b', 'c']}
                    />
                  )}
                  <LocationPicker />

                  {/* Current location marker */}
                  <Marker
                    position={[newIncident.latitude, newIncident.longitude]}
                    icon={L.divIcon({
                      className: 'current-location-marker',
                      html: '<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.25);"></div>',
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  >
                    <Popup>Current Location</Popup>
                  </Marker>

                  {/* Draggable temporary marker */}
                  {tempLocation && (
                    <Marker
                      position={[tempLocation.latitude, tempLocation.longitude]}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const pos = e.target.getLatLng();
                          setTempLocation({ latitude: pos.lat, longitude: pos.lng });
                        }
                      }}
                      icon={L.divIcon({
                        className: 'temp-location-marker',
                        html: '<div style="background-color: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.25);"></div>',
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                      })}
                    >
                      <Popup>Selected Location</Popup>
                    </Marker>
                  )}
                </MapContainer>

                {/* Overlays */}
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                  <p className="text-xs sm:text-sm font-medium text-gray-700">Click map or drag the red marker</p>
                  {searchError && <p className="text-xs text-red-600 mt-1">{searchError}</p>}
                </div>
                {tempLocation && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white text-xs sm:text-sm px-3 py-1.5 rounded-full shadow-lg">
                    {tempLocation.latitude.toFixed(5)}, {tempLocation.longitude.toFixed(5)}
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center">
                <div className="text-sm text-gray-600 order-2 sm:order-1">
                  {tempLocation ? (
                    <>Selected: {tempLocation.latitude.toFixed(6)}, {tempLocation.longitude.toFixed(6)}</>
                  ) : (
                    <>Current: {newIncident.latitude.toFixed(6)}, {newIncident.longitude.toFixed(6)}</>
                  )}
                </div>
                <div className="flex gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => {
                      if (locationMap) {
                        locationMap.flyTo([newIncident.latitude, newIncident.longitude], 16, { animate: true, duration: 0.6 });
                      }
                    }}
                    className="px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Recenter
                  </button>
                  <button
                    onClick={() => {
                      setShowLocationPicker(false);
                      setTempLocation(null);
                    }}
                    className="px-3 sm:px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmLocation}
                    disabled={!tempLocation}
                    className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Confirm Location
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Fullscreen Map Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-gray-900">
            {/* Fullscreen Header */}
            <div className="absolute top-0 left-0 right-0 z-[1001] bg-gray-800 border-b border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Fullscreen Traffic Map</h3>
                    <p className="text-sm text-gray-300">
                      {viewMode === 'heatmap' && 'Traffic density visualization'}
                      {viewMode === 'incidents' && 'Active incident locations'}
                      {viewMode === 'monitoring' && 'Real-time monitoring points'}
                      {viewMode === 'incident_prone' && 'High-risk area analysis'}
                      {viewMode === 'roadworks' && 'Construction and maintenance zones'}
                      {viewMode === 'flood' && 'Flood monitoring stations'}
                    </p>
                  </div>
                </div>
                
                {/* Fullscreen Controls */}
                <div className="flex items-center space-x-2">
                  {/* Refresh Button */}
                  <button
                    onClick={fetchTrafficData}
                    className="p-2 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors duration-200"
                    title="Refresh data"
                  >
                    <svg className="w-4 h-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  {/* Map Style Switcher */}
                  <MapStyleSwitcher 
                    onStyleChange={handleMapStyleChange}
                    currentStyle={mapStyle}
                  />
                  
                  {/* Exit Fullscreen Button */}
                  <button
                    onClick={handleFullscreenToggle}
                    className="p-2 bg-red-600 rounded-lg border border-red-500 hover:bg-red-700 transition-colors duration-200"
                    title="Exit fullscreen"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Fullscreen Map Container */}
            <div className="absolute inset-0 pt-[72px]">
              {loading && (
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-gray-200">Loading traffic data...</p>
                  </div>
                </div>
              )}
              
              <MapContainer
                center={defaultCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                {/* Dynamic Tile Layer - TomTom or OpenStreetMap */}
                {mapError ? (
                  <SimpleMapTileLayer
                    opacity={1}
                    zIndex={1}
                  />
                ) : useTomTomMaps ? (
                  <TomTomTileLayer
                    style={mapStyle}
                    opacity={1}
                    zIndex={1}
                    onError={(error) => {
                      console.warn('TomTom tiles failed, falling back to OpenStreetMap:', error);
                      setUseTomTomMaps(false);
                      setMapError(true);
                    }}
                  />
                ) : (
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    subdomains={['a', 'b', 'c']}
                  />
                )}
                
                {/* Route Visualization Layer */}
                {!navigationMode ? (
                  <RouteLayer
                    routes={routesToShow}
                    selectedRoute={selectedRoute}
                    onRouteClick={handleMapRouteClick}
                    showAllRoutes={showAllRoutes}
                    origin={routeOrigin}
                    destination={routeDestination}
                  />
                ) : (
                  <EnhancedNavigationMode
                    route={selectedRoute}
                    origin={routeOrigin}
                    destination={routeDestination}
                    onExitNavigation={handleExitNavigation}
                  />
                )}
                
                {/* View Mode Indicator */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 1000,
                  background: 'rgba(255, 255, 255, 0.95)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  📍 {viewMode.charAt(0).toUpperCase() + viewMode.slice(1).replace('_', ' ')} View
                  {selectedRoute && (
                    <div style={{ marginTop: '4px', color: '#2563eb' }}>
                      🗺️ Route: {selectedRoute.route_name}
                    </div>
                  )}
                </div>

                {/* Route Legend */}
                {(selectedRoute || routesToShow.length > 0) && (
                  <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.95)',
                    padding: '12px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontSize: '11px',
                    minWidth: '150px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                      Route Legend
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%', marginRight: '6px' }}></div>
                      <span>Origin (A)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '50%', marginRight: '6px' }}></div>
                      <span>Destination (B)</span>
                    </div>
                    {selectedRoute && (
                      <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                        <div style={{ 
                          width: '20px', 
                          height: '3px', 
                          backgroundColor: smartRoutingService.getRoutePolylineColor(selectedRoute), 
                          marginRight: '6px',
                          borderRadius: '2px'
                        }}></div>
                        <span>Selected Route</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Traffic Heatmap - Only show in heatmap mode with reduced intensity */}
                {(viewMode === 'heatmap' || showHeatmapOverlay) && heatmapData.length > 0 && (
                  <HeatmapLayer
                    points={heatmapData.map(point => [
                      point.lat,
                      point.lng,
                      point.intensity || 0.3  // Reduced intensity
                    ])}
                    options={{
                      radius: 20,    // Reduced radius
                      blur: 12,      // Reduced blur
                      maxZoom: 15,
                      max: 0.8,      // Reduced max intensity
                      minOpacity: 0.2  // Reduced opacity
                    }}
                  />
                )}

                {/* Fallback message when no heatmap data */}
                {(viewMode === 'heatmap' || showHeatmapOverlay) && heatmapData.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1000,
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <p className="text-gray-600">No traffic heatmap data available</p>
                    <p className="text-sm text-gray-500">Switch to "Data" view to see monitoring points</p>
                  </div>
                )}

                {/* Traffic Monitoring Points */}
                {viewMode === 'monitoring' && trafficData.map((traffic) => (
                  <Marker
                    key={traffic.id}
                    position={[traffic.latitude, traffic.longitude]}
                    icon={L.divIcon({
                      className: 'traffic-marker',
                      html: `<div style="background-color: ${getStatusColor(traffic.traffic_status)}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{traffic.road_name}</h3>
                        <p className="text-sm text-gray-600">Status: {traffic.traffic_status}</p>
                        <p className="text-sm text-gray-600">Speed: {traffic.average_speed_kmh || 'N/A'} km/h</p>
                        <p className="text-sm text-gray-600">Vehicles: {traffic.vehicle_count}</p>
                        <p className="text-sm text-gray-600">Congestion: {traffic.congestion_percentage}%</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Road Incidents */}
                {(viewMode === 'incidents' || viewMode === 'heatmap') && incidents.map((incident) => (
                  <Marker
                    key={incident.id}
                    position={[incident.latitude, incident.longitude]}
                    icon={L.divIcon({
                      className: 'incident-marker',
                      html: `<div style="background-color: ${getSeverityColor(incident.severity)}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;">⚠</div>`,
                      iconSize: [20, 20],
                      iconAnchor: [10, 10]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{incident.title}</h3>
                        <p className="text-sm text-gray-600">Type: {incident.incident_type}</p>
                        <p className="text-sm text-gray-600">Severity: {incident.severity}</p>
                        <p className="text-sm text-gray-600">{incident.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Reported: {new Date(incident.created_at).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Incident Prone Areas */}
                {(viewMode === 'incident_prone' || viewMode === 'heatmap') && incidentProneAreas.map((area) => (
                  <Marker
                    key={`prone-${area.id}`}
                    position={[area.latitude, area.longitude]}
                    icon={L.divIcon({
                      className: 'incident-prone-marker',
                      html: `<div style="background-color: ${incidentProneService.getAreaTypeColor(area.area_type)}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${incidentProneService.getAreaTypeIcon(area.area_type)}</div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    })}
                    eventHandlers={{
                      click: () => {
                        setSelectedIncident(area);
                      }
                    }}
                  >
                    <Popup>
                      <div className="p-3 max-w-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{incidentProneService.getAreaTypeIcon(area.area_type)}</span>
                          <h3 className="font-semibold text-gray-900">{area.area_name}</h3>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Type:</span>
                            <span className="text-sm font-medium" style={{ color: incidentProneService.getAreaTypeColor(area.area_type) }}>
                              {incidentProneService.getAreaTypeLabel(area.area_type)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Risk Score:</span>
                            <span className="text-sm font-bold" style={{ color: incidentProneService.getRiskScoreColor(area.risk_score) }}>
                              {area.risk_score.toFixed(1)} / 100
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Severity:</span>
                            <span className="text-sm font-medium capitalize" style={{ color: incidentProneService.getSeverityColor(area.severity_level) }}>
                              {area.severity_level}
                            </span>
                          </div>
                          
                          {area.barangay && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Barangay:</span>
                              <span className="text-sm">{area.barangay}</span>
                            </div>
                          )}
                          
                          {area.incident_count > 0 && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Incidents:</span>
                              <span className="text-sm font-medium">{area.incident_count}</span>
                            </div>
                          )}
                        </div>
                        
                        {area.description && (
                          <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                            {area.description}
                          </p>
                        )}
                        
                        {area.prevention_measures && (
                          <div className="mt-3 p-2 bg-blue-50 rounded">
                            <p className="text-xs font-medium text-blue-800 mb-1">Safety Measures:</p>
                            <p className="text-xs text-blue-700">{area.prevention_measures}</p>
                          </div>
                        )}
                        
                        <div className="mt-3 text-xs text-gray-500">
                          <div>Source: {area.data_source.replace('_', ' ')}</div>
                          {area.is_verified && (
                            <div className="text-green-600 font-medium">✓ Verified</div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Flood Monitoring Points */}
                {(viewMode === 'flood' || viewMode === 'heatmap') && floodData.map((flood, index) => (
                  <Marker
                    key={`fullscreen-flood-${flood.id}-${index}`}
                    position={[flood.latitude, flood.longitude]}
                    icon={L.divIcon({
                      className: 'flood-marker',
                      html: `<div style="background-color: ${getFloodAlertColor(flood.alert_level)}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">💧</div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{flood.location}</h3>
                        <p className="text-sm text-gray-600">
                          Alert Level: <span style={{ color: getFloodAlertColor(flood.alert_level), fontWeight: 'bold' }}>
                            {flood.alert_level}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">Water Level: {flood.water_level_cm} cm</p>
                        {flood.description && (
                          <p className="text-sm text-gray-600 mt-1">{flood.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Updated: {new Date(flood.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Roadworks Markers */}
                {(viewMode === 'roadworks' || viewMode === 'heatmap') && roadworks.map((roadwork) => (
                  <Marker
                    key={`roadwork-${roadwork.id}`}
                    position={[roadwork.latitude, roadwork.longitude]}
                    icon={L.divIcon({
                      className: 'roadwork-marker',
                      html: `<div style="background-color: ${roadworksService.getStatusColor(roadwork.status)}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: bold;">🚧</div>`,
                      iconSize: [30, 30],
                      iconAnchor: [15, 15]
                    })}
                  >
                    <Popup>
                      <div className="p-3 max-w-sm">
                        <h3 className="font-semibold text-gray-900 mb-2">{roadwork.location}</h3>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Type:</span>
                            <span className="text-sm font-medium capitalize">
                              {String(roadwork.work_type || roadwork.incident_type || roadwork.type || 'unknown').replace('_', ' ')}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Status:</span>
                            <span className="text-sm font-medium capitalize" style={{ color: roadworksService.getStatusColor(roadwork.status) }}>
                              {roadwork.status}
                            </span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Impact:</span>
                            <span className="text-sm font-medium capitalize" style={{ color: roadworksService.getImpactColor(roadwork.traffic_impact) }}>
                              {roadwork.traffic_impact}
                            </span>
                          </div>
                          
                          {roadwork.start_date && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Start:</span>
                              <span className="text-sm">{new Date(roadwork.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          
                          {roadwork.estimated_end_date && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600">Est. End:</span>
                              <span className="text-sm">{new Date(roadwork.estimated_end_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        
                        {roadwork.description && (
                          <p className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                            {roadwork.description}
                          </p>
                        )}
                        
                        {roadwork.affected_lanes && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600">
                              Affected Lanes: <span className="font-medium">{roadwork.affected_lanes}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrafficMonitoring;

