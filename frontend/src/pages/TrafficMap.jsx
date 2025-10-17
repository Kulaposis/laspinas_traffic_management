import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ScaleControl, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Info
} from 'lucide-react';
import HeatmapLayer from '../components/HeatmapLayer';
import RouteLayer from '../components/RouteLayer';
import TomTomTileLayer from '../components/TomTomTileLayer';
import enhancedRoutingService from '../services/enhancedRoutingService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';
import travelHistoryService from '../services/travelHistoryService';
import tomtomService from '../services/tomtomService';
import { useAuth } from '../context/AuthContext';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              The traffic map encountered an error. Please refresh the page and try again.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer">Error Details</summary>
                <pre className="text-xs text-red-600 mt-2 overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different marker types
const createCustomIcon = (color, iconType = 'pin') => {
  const iconOptions = {
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  };

  if (iconType === 'navigation') {
    iconOptions.iconSize = [40, 40];
    iconOptions.iconAnchor = [20, 40];
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${iconOptions.iconSize[0]}px;
        height: ${iconOptions.iconSize[1]}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
      ">
        ${iconType === 'navigation' ? '📍' : '📍'}
      </div>
    `,
    ...iconOptions
  });
};

const TrafficMap = () => {
  const { user } = useAuth();
  const mapRef = useRef(null);
  
  // Map and navigation states
  const [mapCenter, setMapCenter] = useState([14.4504, 121.0170]); // Las Piñas default
  const [mapZoom, setMapZoom] = useState(13);
  const [isNavigationActive, setIsNavigationActive] = useState(false);
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

  // Load recent searches on component mount
  useEffect(() => {
    const saved = localStorage.getItem('trafficMapSearchHistory');
    if (saved) {
      const history = JSON.parse(saved);
      setRecentSearches(history.slice(0, 5)); // Show last 5 searches as recent
    }
  }, []);

  // GPS and navigation tracking
  const [userLocation, setUserLocation] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);
  const [navigationProgress, setNavigationProgress] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);

  // Route alternatives
  const [showRouteAlternatives, setShowRouteAlternatives] = useState(false);
  const [routeAlternatives, setRouteAlternatives] = useState([]);
  const [routeCriteria, setRouteCriteria] = useState('fastest'); // fastest, shortest, eco, avoidTolls
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  
  // UI states
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mapStyle, setMapStyle] = useState('main');
  const [heatmapEnabled, setHeatmapEnabled] = useState(true);
  const [trafficLayerEnabled, setTrafficLayerEnabled] = useState(true);
  
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

  // Refs
  const searchTimeoutRef = useRef(null);
  const navigationTimeoutRef = useRef(null);

  // Load user's personalized data
  useEffect(() => {
    loadUserData();
  }, [user]);

  // Load traffic and heatmap data
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
      console.log('No user logged in, skipping travel history data loading');
      return;
    }

    try {
      const [history, frequent, favorites, stats] = await Promise.all([
        travelHistoryService.getTravelHistory({ limit: 20 }),
        travelHistoryService.getFrequentLocations({ limit: 10 }),
        travelHistoryService.getFavoriteRoutes(),
        travelHistoryService.getTravelStats()
      ]);

      setTravelHistory(history);
      setFrequentLocations(frequent);
      setFavoriteRoutes(favorites);
      setTravelStats(stats);
    } catch (error) {
      console.error('Error loading user data:', error);
      // Don't throw error - gracefully handle missing travel history
      setTravelHistory([]);
      setFrequentLocations([]);
      setFavoriteRoutes([]);
      setTravelStats(null);
    }
  };

  const loadTrafficData = async () => {
    setIsLoadingData(true);
    try {
      // Simulate heatmap data (replace with actual API call)
      const mockHeatmapData = Array.from({ length: 50 }, (_, i) => [
        14.4504 + (Math.random() - 0.5) * 0.02,
        121.0170 + (Math.random() - 0.5) * 0.02,
        Math.random()
      ]);
      
      setHeatmapData(mockHeatmapData);
      
      // TomTom traffic flow functionality removed
      setTrafficData([]);
    } catch (error) {
      console.error('Error loading traffic data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

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
      console.error('Error loading route traffic data:', error);
    }
  };

  // Enhanced search functionality with debouncing
  const handleSearch = useCallback(async (query, mode = searchMode) => {
    console.log('Search called with query:', query, 'mode:', mode);

    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Executing search for:', query);
        // Search for locations
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 8,
          countrySet: 'PH'
        });

        console.log('Search results:', results);

        // Add recent searches that match
        const matchingRecent = recentSearches.filter(recent =>
          recent.name.toLowerCase().includes(query.toLowerCase()) ||
          recent.address?.full?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 3);

        // Combine and deduplicate results
        const combinedResults = [
          ...matchingRecent.map(recent => ({ ...recent, isRecent: true })),
          ...results.filter(result =>
            !matchingRecent.some(recent => recent.name === result.name)
          )
        ];

        console.log('Combined results:', combinedResults);
        setSearchResults(combinedResults);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [recentSearches, searchMode]);

  // Get current location
  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            name: 'Current Location',
            address: { full: 'Your current location' }
          };
          setCurrentLocation(location);

          if (searchMode === 'origin') {
            setSelectedOrigin(location);
            setOriginQuery(location.name || 'Current Location'); // Set the query to show the location name
          } else {
            setSelectedDestination(location);
            setDestinationQuery(location.name || 'Current Location'); // Set the query to show the location name
          }
          setShowSearchResults(false);
        },
        (error) => {
          console.error('Error getting location:', error);
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
    console.log('Location selected:', location);

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
      console.warn('No origin or destination selected');
      return;
    }

    // Validate coordinates
    if (!selectedOrigin.lat || !selectedOrigin.lng || !selectedDestination.lat || !selectedDestination.lng) {
      console.error('Invalid coordinates:', { selectedOrigin, selectedDestination });
      alert('Invalid location coordinates. Please select valid locations.');
      return;
    }

    setIsLoadingData(true);
    try {
      console.log('Getting route for:', {
        origin: `${selectedOrigin.lat}, ${selectedOrigin.lng}`,
        destination: `${selectedDestination.lat}, ${selectedDestination.lng}`
      });

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

      console.log('Route data received:', routeData);

      if (routeData && routeData.routes && routeData.routes.length > 0) {
        // Validate route data structure
        const validRoutes = routeData.routes.filter(route => {
          if (!route.route_coordinates || !Array.isArray(route.route_coordinates) || route.route_coordinates.length < 2) {
            console.warn('Invalid route data:', route);
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

        // If we got multiple routes, show route selection
        if (validRoutes.length > 1) {
          setShowRouteAlternatives(true);
          setRouteAlternatives(validRoutes);
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
      console.error('Error getting route:', error);
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
  };

  // Start GPS location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
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
          timestamp: position.timestamp
        };

        setUserLocation(location);
        setIsTrackingLocation(true);

        // Center map on user location if navigation is active
        if (isNavigationActive) {
          setMapCenter([location.lat, location.lng]);
          setMapZoom(16);
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
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
      console.error('Error updating navigation progress:', error);
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
      console.error('Error saving favorite:', error);
    }
  };

  // Map event handlers
  const MapEvents = () => {
    useMapEvents({
      click: (e) => {
        // Handle map clicks for location selection
      },
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

  // Current navigation step
  const currentStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep] : null;
  const nextStep = selectedRoute && selectedRoute.steps ? selectedRoute.steps[navigationStep + 1] : null;

  return (
    <ErrorBoundary>
      <div className="relative w-full h-screen bg-gray-900 overflow-hidden">
      {/* Map Container */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={mapRef}
        >
          <MapEvents />
          
          {/* Tile Layer */}
          <TomTomTileLayer 
            style={mapStyle}
            onError={(error) => {
              console.warn('Map tile error:', error);
            }}
          />

          {/* Heatmap Layer */}
          {heatmapEnabled && <HeatmapLayer points={heatmapData} />}

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

          {/* User Location Marker */}
          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createCustomIcon('#4285f4', 'navigation')}
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
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route Display */}
          {selectedRoute && (
            <RouteLayer
              routes={currentRoute ? currentRoute.routes || [] : []}
              selectedRoute={selectedRoute}
              showAllRoutes={false}
              origin={selectedOrigin}
              destination={selectedDestination}
            />
          )}

          <ScaleControl position="bottomright" />
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>

      {/* Google Maps Style Search Bar - Clean & Centered - Responsive */}
      <div className={`absolute z-40 transition-all duration-300 ${
        showSidePanel
          ? 'top-2 left-80 right-2 sm:top-4 sm:left-96 sm:right-4'
          : 'top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4'
      }`}>
        <div className="flex items-center justify-center space-x-1 sm:space-x-2 max-w-4xl mx-auto">
          {/* Hamburger Menu - Left Side */}
          <button
            onClick={() => setShowSidePanel(!showSidePanel)}
            className="bg-white hover:bg-gray-50 shadow-xl rounded-xl p-2 sm:p-3 transition-all duration-200 border border-gray-200 flex-shrink-0 z-50"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
          </button>

          {/* Search Bar - Centered */}
          <div className="flex-1 max-w-2xl bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden bg-white">
            {/* Origin Input */}
            <div className="flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3 px-4 py-3 flex-1 min-w-0">
                <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 shadow-sm"></div>
                <input
                  type="text"
                  placeholder="Choose starting point..."
                  value={originQuery}
                  onChange={(e) => {
                    setOriginQuery(e.target.value);
                    setSearchMode('origin');
                    handleSearch(e.target.value, 'origin');
                  }}
                  onFocus={() => setSearchMode('origin')}
                  className="flex-1 text-gray-900 placeholder-gray-500 bg-transparent focus:outline-none text-sm font-medium min-w-0"
                />
                {selectedOrigin && (
                  <button
                    onClick={() => setSelectedOrigin(null)}
                    className="p-1.5 hover:bg-red-100 rounded-full flex-shrink-0 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>

              {/* Current Location Button for Origin */}
              <button
                onClick={() => {
                  setSearchMode('origin');
                  getCurrentLocation();
                }}
                className="p-2 hover:bg-blue-100 rounded-full flex-shrink-0 mr-3 transition-colors group"
                title="Use current location as starting point"
              >
                <Target className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
              </button>
            </div>

            {/* Destination Input */}
            <div className="flex items-center hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3 px-4 py-3 flex-1 min-w-0">
                <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0 shadow-sm"></div>
                <input
                  type="text"
                  placeholder="Where to?"
                  value={destinationQuery}
                  onChange={(e) => {
                    setDestinationQuery(e.target.value);
                    setSearchMode('destination');
                    handleSearch(e.target.value, 'destination');
                  }}
                  onFocus={() => setSearchMode('destination')}
                  className="flex-1 text-gray-900 placeholder-gray-500 bg-transparent focus:outline-none text-sm font-medium min-w-0"
                />
                {selectedDestination && (
                  <button
                    onClick={() => setSelectedDestination(null)}
                    className="p-1.5 hover:bg-red-100 rounded-full flex-shrink-0 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>

              {/* Current Location Button for Destination */}
              <button
                onClick={() => {
                  setSearchMode('destination');
                  getCurrentLocation();
                }}
                className="p-2 hover:bg-blue-100 rounded-full flex-shrink-0 mr-3 transition-colors group"
                title="Use current location"
              >
                <Target className="w-4 h-4 text-gray-600 group-hover:text-blue-600" />
              </button>

              {/* Enhanced Route Button - Right Side of Search Bar */}
              {selectedOrigin && selectedDestination && (
                <button
                  onClick={() => handleGetRoute()}
                  disabled={isLoadingData}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 mr-3 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                  title="Get fastest route"
                >
                  <Route className="w-4 h-4" />
                  <span className="hidden sm:inline">{isLoadingData ? 'Loading...' : 'Route'}</span>
                </button>
              )}
            </div>

            {/* Enhanced Search Results - Modern Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="border-t border-gray-200/50 bg-white max-h-80 overflow-y-auto shadow-lg">
                {/* Quick Actions Section */}
                <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200/50">
                  <button
                    onClick={() => getCurrentLocation()}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-white rounded-xl transition-all duration-200 text-left group"
                  >
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors shadow-md">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Use current location</p>
                      <p className="text-xs text-gray-600">
                        Set as {searchMode === 'origin' ? 'starting point' : 'destination'}
                      </p>
                    </div>
                  </button>
                </div>

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
                          className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-all duration-200 text-left group border border-gray-100 hover:border-gray-200"
                        >
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                            <History className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{recent.name}</p>
                            {recent.address?.full && (
                              <p className="text-xs text-gray-500 truncate">{recent.address.full}</p>
                            )}
                          </div>
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
                      Search Results
                    </div>
                    <div className="space-y-2">
                      {searchResults.filter(result => !result.isRecent).map((result, index) => (
                        <button
                          key={index}
                          onClick={() => handleLocationSelect(result)}
                          className="w-full flex items-center space-x-3 p-3 hover:bg-blue-50 rounded-xl transition-all duration-200 text-left group border border-gray-100 hover:border-blue-200"
                        >
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <MapPin className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{result.name}</p>
                            {result.address?.full && (
                              <p className="text-xs text-gray-500 truncate">{result.address.full}</p>
                            )}
                          </div>
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

      {/* Bottom Right Controls - GPS & Navigation - Modern Design - Responsive */}
      <div className="absolute bottom-4 right-2 sm:bottom-6 sm:right-6 z-40 flex flex-col space-y-3">
        {/* GPS Status Indicator */}
        <div className={`bg-white rounded-xl shadow-xl p-3 transition-all duration-200 border-2 ${
          isTrackingLocation
            ? 'text-green-700 border-green-300 bg-green-50'
            : 'text-gray-700 border-gray-300'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full shadow-md ${
              isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}></div>
            <span className="text-xs font-semibold">
              {isTrackingLocation ? 'GPS Active' : 'GPS Off'}
            </span>
          </div>
        </div>

        {/* Navigation Toggle */}
        {selectedRoute && (
          <button
            onClick={isNavigationActive ? stopNavigation : startNavigation}
            className={`bg-white rounded-xl shadow-xl p-3 transition-all duration-200 border-2 ${
              isNavigationActive
                ? 'text-red-600 border-red-300 bg-red-50 hover:bg-red-100'
                : 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
            }`}
          >
            {isNavigationActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Enhanced Navigation Panel - Modern Google Maps Style - Responsive */}
      {isNavigationActive && currentStep && (
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
              <button
                onClick={stopNavigation}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                title="Exit navigation"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

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
      {showRouteAlternatives && routeAlternatives.length > 0 && (
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
              {routeAlternatives.map((route, index) => (
                <button
                  key={route.route_id || index}
                  onClick={() => selectRoute(route)}
                  className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {index === 0 ? '🏆' : index + 1}
                    </div>

                    <div className="flex-1">
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
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Route Information Panel with Real-time Traffic - Modern Design - Responsive */}
      {selectedRoute && !isNavigationActive && (
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
                  <button
                    onClick={saveAsFavorite}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                    title="Save as favorite"
                  >
                    <Heart className="w-5 h-5 text-gray-600" />
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
          className="fixed inset-0 bg-black bg-opacity-20 transition-opacity duration-300"
          style={{ zIndex: 1}}
          onClick={() => setShowSidePanel(false)}
        />
      )}

      {/* Left Side Panel - Modern Design - Responsive */}
      {showSidePanel && (
        <div
          className={`fixed top-0 left-0 h-full w-72 sm:w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out rounded-r-2xl border-r border-gray-200 ${
            showSidePanel ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 rounded-tr-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Traffic Map</h2>
              <button
                onClick={() => setShowSidePanel(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
            {/* History Button - Top of Sidebar */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <button
                onClick={() => {
                  setShowHistoryPanel(!showHistoryPanel);
                  setShowSidePanel(false); // Close main panel when opening history
                }}
                className="w-full flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-all duration-200 text-left relative group"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-800">Travel History</span>
                  <p className="text-xs text-gray-600 mt-0.5">View your past trips</p>
                </div>
                {travelHistory.length > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
                    {travelHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Map Controls */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-1">Map Layers</h3>
                <p className="text-xs text-gray-500">Toggle map overlays</p>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${heatmapEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform absolute top-1 ${heatmapEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                    </div>
                    <span className={`text-sm font-medium ${heatmapEnabled ? 'text-gray-800' : 'text-gray-600'}`}>Traffic Heatmap</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={heatmapEnabled}
                    onChange={(e) => setHeatmapEnabled(e.target.checked)}
                    className="sr-only"
                  />
                </label>
                <label className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer group">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${trafficLayerEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform absolute top-1 ${trafficLayerEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                    </div>
                    <span className={`text-sm font-medium ${trafficLayerEnabled ? 'text-gray-800' : 'text-gray-600'}`}>Traffic Layer</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={trafficLayerEnabled}
                    onChange={(e) => setTrafficLayerEnabled(e.target.checked)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Map Style */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-1">Map Style</h3>
                <p className="text-xs text-gray-500">Choose your preferred view</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2">
                  {['main', 'night', 'satellite'].map(style => (
                    <button
                      key={style}
                      onClick={() => setMapStyle(style)}
                      className={`px-4 py-3 rounded-full text-sm font-semibold transition-all duration-200 border-2 ${
                        mapStyle === style
                          ? 'bg-blue-500 text-white border-blue-500 shadow-md transform scale-105'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      {style === 'main' ? 'Day' : style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-1">Quick Actions</h3>
                <p className="text-xs text-gray-500">Common tasks</p>
              </div>
              <div className="p-4 space-y-3">
                <button
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setMapCenter([pos.coords.latitude, pos.coords.longitude]);
                      setMapZoom(16);
                    });
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-blue-50 rounded-lg transition-all duration-200 text-left group border border-gray-200 hover:border-blue-300"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">My Location</span>
                    <p className="text-xs text-gray-600 mt-0.5">Center map on your position</p>
                  </div>
                </button>

                <button className="w-full flex items-center space-x-3 p-3 hover:bg-green-50 rounded-lg transition-all duration-200 text-left group border border-gray-200 hover:border-green-300 opacity-60">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <RefreshCw className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-gray-800">Refresh Data</span>
                    <p className="text-xs text-gray-600 mt-0.5">Update traffic information</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Panel - Modern Design - Responsive */}
      {showHistoryPanel && (
        <div
          className={`fixed top-0 left-0 h-full w-72 sm:w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out rounded-r-2xl border-r border-gray-200 ${
            showHistoryPanel ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 rounded-tr-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Travel History</h2>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto h-full pb-20">
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
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          {trip.origin?.name} → {trip.destination?.name}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {new Date(trip.start_time).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{travelHistoryService.formatTravelTime(trip.duration_minutes)}</span>
                        <span>{travelHistoryService.formatDistance(trip.distance_km)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No travel history yet</p>
                  <p className="text-xs text-gray-400">Your trips will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay - Modern Design */}
      {isLoadingData && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 flex items-center space-x-3 shadow-2xl border border-gray-200">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-gray-700 font-medium">Loading route...</span>
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
};

export default TrafficMap;

