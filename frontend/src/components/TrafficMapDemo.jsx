import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from 'react-leaflet';
import {
  MapPin,
  Play,
  Eye,
  Users,
  Lock,
  Search,
  Navigation,
  Car,
  Clock,
  AlertTriangle,
  TrendingUp,
  Target,
  Plus,
  Minus,
  RotateCcw,
  Zap,
  Star,
  Heart,
  Share2,
  Camera,
  Route,
  Layers,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Filter,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  Satellite,
  Thermometer,
  Cloud,
  Sun,
  CloudRain,
  Zap as ZapIcon
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TomTomTileLayer from './TomTomTileLayer';
import tomtomService from '../services/tomtomService';

// Add custom CSS animations for enhanced visual appeal
const demoStyles = `
  .custom-demo-marker {
    animation: markerPulse 2s ease-in-out infinite;
    transform-origin: center;
  }

  @keyframes markerPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.8; }
  }

  .traffic-heatmap {
    transition: opacity 0.3s ease-in-out;
  }

  .route-line {
    animation: routeDraw 1.5s ease-in-out;
  }

  @keyframes routeDraw {
    0% { stroke-dasharray: 0 1000; opacity: 0; }
    50% { opacity: 0.7; }
    100% { stroke-dasharray: 1000 0; opacity: 1; }
  }

  .search-result:hover {
    transform: translateX(2px);
    transition: transform 0.2s ease-in-out;
  }

  .demo-overlay {
    backdrop-filter: blur(2px);
    animation: fadeIn 0.5s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .traffic-card {
    animation: slideInRight 0.3s ease-out;
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .weather-indicator {
    animation: weatherPulse 3s ease-in-out infinite;
  }

  @keyframes weatherPulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .live-indicator {
    animation: livePulse 1.5s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

// Inject styles
if (!document.getElementById('traffic-demo-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'traffic-demo-styles';
  styleSheet.textContent = demoStyles;
  document.head.appendChild(styleSheet);
}

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Enhanced heatmap for demo with better visuals
const DemoHeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    // Remove existing layer
    map.eachLayer((layer) => {
      if (layer.options && layer.options.isHeatmapLayer) {
        map.removeLayer(layer);
      }
    });

    const heatLayer = L.heatLayer(points, {
      radius: 18,
      blur: 12,
      max: 0.9,
      minOpacity: 0.3,
      gradient: {
        0.1: '#0066ff',    // Blue for very light traffic
        0.3: '#00cc00',    // Green for light traffic
        0.5: '#ffff00',    // Yellow for moderate traffic
        0.7: '#ff6600',    // Orange for heavy traffic
        0.9: '#ff0000',    // Red for very heavy traffic
        1.0: '#990000'     // Dark red for extreme traffic
      }
    });

    heatLayer.options.isHeatmapLayer = true;
    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

// Custom marker icons for different types
const createCustomIcon = (color, type = 'pin') => {
  const size = type === 'current' ? 40 : 32;
  return L.divIcon({
    className: 'custom-demo-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${size * 0.4}px;
        font-weight: bold;
        animation: pulse 2s infinite;
      ">
        ${type === 'current' ? '📍' : '📍'}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size],
    popupAnchor: [0, -size],
  });
};

// Search functionality component
const SearchDemo = ({ onLocationSelect, mapCenter }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  // Demo search locations in Las Piñas
  const demoLocations = [
    {
      name: 'Las Piñas City Hall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4504,
      lng: 121.0170,
      type: 'government'
    },
    {
      name: 'SM Southmall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4475,
      lng: 121.0080,
      type: 'shopping'
    },
    {
      name: 'Las Piñas Doctors Hospital',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4448,
      lng: 121.0135,
      type: 'hospital'
    },
    {
      name: 'University of Perpetual Help',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4462,
      lng: 121.0180,
      type: 'school'
    },
    {
      name: 'Las Piñas Public Market',
      address: 'Real St, Las Piñas',
      lat: 14.4510,
      lng: 121.0155,
      type: 'market'
    }
  ];

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    // Simulate search delay
    setTimeout(() => {
      const filtered = demoLocations.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase()) ||
        location.address.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered);
      setShowResults(true);
      setIsSearching(false);
    }, 300);
  };

  const selectLocation = (location) => {
    setSearchQuery(location.name);
    setShowResults(false);
    onLocationSelect(location);
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search locations in Las Piñas..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-0 focus:ring-2 focus:ring-blue-500 rounded-lg"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="border-t border-gray-100 max-h-48 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => selectLocation(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-center space-x-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  result.type === 'government' ? 'bg-blue-100 text-blue-600' :
                  result.type === 'shopping' ? 'bg-green-100 text-green-600' :
                  result.type === 'hospital' ? 'bg-red-100 text-red-600' :
                  result.type === 'school' ? 'bg-purple-100 text-purple-600' :
                  'bg-yellow-100 text-yellow-600'
                }`}>
                  {result.type === 'government' ? '🏛️' :
                   result.type === 'shopping' ? '🛍️' :
                   result.type === 'hospital' ? '🏥' :
                   result.type === 'school' ? '🎓' :
                   '🏪'}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{result.name}</div>
                  <div className="text-sm text-gray-500">{result.address}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced Route Planning Component
const RoutePlanner = ({ origin, destination, onRouteCalculated, onClearRoute }) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeData, setRouteData] = useState(null);

  const calculateRoute = async () => {
    if (!origin || !destination) return;

    setIsCalculating(true);

    // Simulate route calculation
    setTimeout(() => {
      const mockRoute = {
        distance: Math.round(Math.random() * 10 + 5), // 5-15 km
        duration: Math.round(Math.random() * 30 + 15), // 15-45 minutes
        trafficDelay: Math.round(Math.random() * 10),
        coordinates: [
          [origin.lat, origin.lng],
          [(origin.lat + destination.lat) / 2 + (Math.random() - 0.5) * 0.002, (origin.lng + destination.lng) / 2 + (Math.random() - 0.5) * 0.002],
          [destination.lat, destination.lng]
        ]
      };

      setRouteData(mockRoute);
      onRouteCalculated(mockRoute);
      setIsCalculating(false);
    }, 1500);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Route Planner</h3>
        <button
          onClick={onClearRoute}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-sm text-gray-600 truncate">{origin?.name || 'Select origin'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-sm text-gray-600 truncate">{destination?.name || 'Select destination'}</span>
        </div>
      </div>

      {routeData && (
        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Distance:</span>
              <div className="font-semibold text-gray-900">{routeData.distance} km</div>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <div className="font-semibold text-gray-900">{routeData.duration} min</div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Traffic Delay:</span>
              <div className={`font-semibold ${routeData.trafficDelay > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {routeData.trafficDelay > 0 ? `+${routeData.trafficDelay} min` : 'No delay'}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={calculateRoute}
        disabled={!origin || !destination || isCalculating}
        className="w-full py-2 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 flex items-center justify-center space-x-2"
      >
        {isCalculating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span>Calculating...</span>
          </>
        ) : (
          <>
            <Route className="w-4 h-4" />
            <span>Get Route</span>
          </>
        )}
      </button>
    </div>
  );
};

// Enhanced Traffic Info Card with more details
const TrafficInfoCard = ({ location, trafficData, onGetDirections, onAddFavorite }) => {
  const getTrafficColor = (condition) => {
    switch (condition) {
      case 'heavy': return 'text-red-600 bg-red-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'light': return 'text-green-600 bg-green-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getTrafficIcon = (condition) => {
    switch (condition) {
      case 'heavy': return '🚨';
      case 'moderate': return '⚠️';
      case 'light': return '✅';
      default: return 'ℹ️';
    }
  };

  const getWeatherIcon = () => {
    const weatherTypes = ['☀️', '⛅', '🌧️', '⛈️', '❄️'];
    return weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTrafficColor(trafficData?.condition)}`}>
            <span className="text-lg">{getTrafficIcon(trafficData?.condition)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{location.name}</h3>
            <p className="text-sm text-gray-600">{location.address}</p>
          </div>
        </div>
        <button
          onClick={onAddFavorite}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
        </button>
      </div>

      {trafficData && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Traffic Condition:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTrafficColor(trafficData.condition)}`}>
              {trafficData.condition?.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Current Speed:</span>
            <span className="font-medium">{trafficData.avgSpeed} km/h</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Normal Speed:</span>
            <span className="font-medium">{trafficData.freeFlowSpeed} km/h</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                trafficData.condition === 'heavy' ? 'bg-red-500' :
                trafficData.condition === 'moderate' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(100, (trafficData.avgSpeed / trafficData.freeFlowSpeed) * 100)}%` }}
            ></div>
          </div>

          {/* Weather Info */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getWeatherIcon()}</span>
              <div>
                <div className="text-sm font-medium">24°C</div>
                <div className="text-xs text-gray-500">Partly Cloudy</div>
              </div>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <Camera className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => onGetDirections(location)}
              className="flex-1 py-2 px-3 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Directions</span>
            </button>
            <button className="flex-1 py-2 px-3 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors flex items-center justify-center space-x-1">
              <Share2 className="w-3 h-3" />
              <span>Share</span>
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Updated {Math.floor(Math.random() * 5) + 1} minutes ago • Live data
          </p>
        </div>
      )}
    </div>
  );
};

// Google Maps-style Search Component
const GoogleMapsSearch = ({ onLocationSelect, onRouteRequest, currentOrigin, currentDestination }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [searchMode, setSearchMode] = useState('destination'); // 'origin' or 'destination'

  // Enhanced demo locations with more variety
  const demoLocations = [
    {
      name: 'Las Piñas City Hall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4504,
      lng: 121.0170,
      type: 'government',
      rating: 4.2,
      reviews: 156
    },
    {
      name: 'SM Southmall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4475,
      lng: 121.0080,
      type: 'shopping',
      rating: 4.3,
      reviews: 2847
    },
    {
      name: 'Las Piñas Doctors Hospital',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4448,
      lng: 121.0135,
      type: 'hospital',
      rating: 4.1,
      reviews: 423
    },
    {
      name: 'University of Perpetual Help',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4462,
      lng: 121.0180,
      type: 'school',
      rating: 4.0,
      reviews: 189
    },
    {
      name: 'Las Piñas Public Market',
      address: 'Real St, Las Piñas',
      lat: 14.4510,
      lng: 121.0155,
      type: 'market',
      rating: 3.9,
      reviews: 567
    },
    {
      name: 'Starbucks Coffee - Southmall',
      address: 'SM Southmall, Las Piñas',
      lat: 14.4478,
      lng: 121.0085,
      type: 'cafe',
      rating: 4.4,
      reviews: 892
    },
    {
      name: 'Jollibee Las Piñas',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4490,
      lng: 121.0120,
      type: 'restaurant',
      rating: 4.2,
      reviews: 1345
    },
    {
      name: 'Las Piñas Baywalk',
      address: 'Coastal Road, Las Piñas',
      lat: 14.4300,
      lng: 120.9900,
      type: 'park',
      rating: 4.3,
      reviews: 234
    }
  ];

  const handleSearch = (query) => {
    setSearchQuery(query);

    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    // Simulate search delay like Google Maps
    setTimeout(() => {
      const filtered = demoLocations.filter(location =>
        location.name.toLowerCase().includes(query.toLowerCase()) ||
        location.address.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6); // Limit results like Google Maps

      setSearchResults(filtered);
      setShowResults(true);
      setIsSearching(false);
    }, 300);
  };

  const selectLocation = (location) => {
    setSearchQuery(location.name);
    setShowResults(false);
    onLocationSelect(location, searchMode);
  };

  const getPlaceholderText = () => {
    if (searchMode === 'origin') {
      return currentOrigin ? currentOrigin.name : 'Choose starting point...';
    }
    return currentDestination ? currentDestination.name : 'Where to?';
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000]">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
        {/* Route Input Mode */}
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className={`w-3 h-3 rounded-full ${searchMode === 'origin' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <span>Origin</span>
            <div className="flex-1 border-b border-gray-300"></div>
            <div className={`w-3 h-3 rounded-full ${searchMode === 'destination' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            <span>Destination</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="flex">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={getPlaceholderText()}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setSearchMode('destination')}
                className="w-full pl-10 pr-4 py-3 border-0 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Mode Toggle */}
            <button
              onClick={() => setSearchMode(searchMode === 'origin' ? 'destination' : 'origin')}
              className="px-3 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-l border-gray-200"
            >
              <Navigation className="w-4 h-4 text-gray-500" />
            </button>

            {/* Route Button */}
            {currentOrigin && currentDestination && (
              <button
                onClick={onRouteRequest}
                className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white transition-colors flex items-center space-x-2"
              >
                <Route className="w-4 h-4" />
                <span className="hidden sm:inline">Route</span>
              </button>
            )}
          </div>

          {/* Loading Indicator */}
          {isSearching && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {/* Search Results - Google Maps Style */}
        {showResults && searchResults.length > 0 && (
          <div className="border-t border-gray-100 max-h-80 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => selectLocation(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-start space-x-3 group"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ${
                  result.type === 'government' ? 'bg-blue-100 text-blue-600' :
                  result.type === 'shopping' ? 'bg-green-100 text-green-600' :
                  result.type === 'hospital' ? 'bg-red-100 text-red-600' :
                  result.type === 'school' ? 'bg-purple-100 text-purple-600' :
                  result.type === 'cafe' ? 'bg-yellow-100 text-yellow-600' :
                  result.type === 'restaurant' ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {result.type === 'government' ? '🏛️' :
                   result.type === 'shopping' ? '🛍️' :
                   result.type === 'hospital' ? '🏥' :
                   result.type === 'school' ? '🎓' :
                   result.type === 'cafe' ? '☕' :
                   result.type === 'restaurant' ? '🍔' :
                   '📍'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{result.name}</div>
                  <div className="text-sm text-gray-500 truncate">{result.address}</div>
                  {result.rating && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-600">{result.rating}</span>
                      <span className="text-xs text-gray-400">({result.reviews})</span>
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Powered by TomTom */}
            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 border-t border-gray-100">
              Search powered by TomTom Maps
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TrafficMapDemo = ({ onUpgradeClick }) => {
  const [mapCenter, setMapCenter] = useState([14.4504, 121.0170]); // Las Piñas center
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showTrafficCard, setShowTrafficCard] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapStyle, setMapStyle] = useState('main');
  const [routeData, setRouteData] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [weatherOverlay, setWeatherOverlay] = useState(false);

  // Enhanced heatmap data with more realistic traffic patterns
  const [heatmapData] = useState(
    Array.from({ length: 80 }, (_, i) => {
      const baseLat = 14.4504;
      const baseLng = 121.0170;

      // Create traffic hotspots around key locations with different intensities
      const hotspots = [
        { lat: baseLat, lng: baseLng, intensity: 0.9, type: 'heavy' }, // City center - heavy traffic
        { lat: baseLat - 0.003, lng: baseLng - 0.009, intensity: 0.7, type: 'moderate' }, // Shopping area
        { lat: baseLat + 0.004, lng: baseLng + 0.01, intensity: 0.3, type: 'light' }, // Residential area
        { lat: baseLat - 0.001, lng: baseLng + 0.005, intensity: 0.6, type: 'moderate' }, // Hospital area
        { lat: baseLat + 0.002, lng: baseLng - 0.003, intensity: 0.8, type: 'heavy' }, // Market area
      ];

      const hotspot = hotspots[i % hotspots.length];
      const variance = 0.0015;

      return [
        hotspot.lat + (Math.random() - 0.5) * variance,
        hotspot.lng + (Math.random() - 0.5) * variance,
        Math.random() * hotspot.intensity + 0.2
      ];
    })
  );

  const [isDemoActive, setIsDemoActive] = useState(false);
  const [currentDemoStep, setCurrentDemoStep] = useState(0);

  // Demo locations with enhanced data
  const demoLocations = [
    {
      id: 1,
      name: 'Las Piñas City Hall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4504,
      lng: 121.0170,
      type: 'government',
      trafficData: {
        condition: 'moderate',
        avgSpeed: 35,
        freeFlowSpeed: 50,
        lastUpdated: new Date()
      }
    },
    {
      id: 2,
      name: 'SM Southmall',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4475,
      lng: 121.0080,
      type: 'shopping',
      trafficData: {
        condition: 'heavy',
        avgSpeed: 25,
        freeFlowSpeed: 45,
        lastUpdated: new Date()
      }
    },
    {
      id: 3,
      name: 'Las Piñas Doctors Hospital',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4448,
      lng: 121.0135,
      type: 'hospital',
      trafficData: {
        condition: 'light',
        avgSpeed: 45,
        freeFlowSpeed: 50,
        lastUpdated: new Date()
      }
    },
    {
      id: 4,
      name: 'University of Perpetual Help',
      address: 'Alabang-Zapote Rd, Las Piñas',
      lat: 14.4462,
      lng: 121.0180,
      type: 'school',
      trafficData: {
        condition: 'moderate',
        avgSpeed: 30,
        freeFlowSpeed: 45,
        lastUpdated: new Date()
      }
    },
    {
      id: 5,
      name: 'Las Piñas Public Market',
      address: 'Real St, Las Piñas',
      lat: 14.4510,
      lng: 121.0155,
      type: 'market',
      trafficData: {
        condition: 'heavy',
        avgSpeed: 20,
        freeFlowSpeed: 40,
        lastUpdated: new Date()
      }
    }
  ];

  const demoSteps = [
    {
      title: "Explore with TomTom Maps",
      description: "Experience high-quality TomTom mapping with real-time traffic visualization",
      action: "Pan and zoom to explore different areas of Las Piñas"
    },
    {
      title: "Search & Discover",
      description: "Find locations and see live traffic conditions",
      action: "Use the search bar to find places and click markers for traffic info"
    },
    {
      title: "Interactive Features",
      description: "Click markers to view detailed traffic information and conditions",
      action: "Try clicking on different location markers to see traffic data"
    },
    {
      title: "Ready for More?",
      description: "Register for advanced features like routing, navigation, and live updates",
      action: "Click 'Upgrade' to unlock the full traffic management experience"
    }
  ];

  const startDemo = () => {
    setIsDemoActive(true);
    setCurrentDemoStep(0);
  };

  const nextDemoStep = () => {
    if (currentDemoStep < demoSteps.length - 1) {
      setCurrentDemoStep(currentDemoStep + 1);
    }
  };

  const handleLocationSelect = (location, mode = 'destination') => {
    if (mode === 'origin') {
      setOrigin(location);
    } else {
      setDestination(location);
    }

    setSelectedLocation(location);
    setShowTrafficCard(true);
    setMapCenter([location.lat, location.lng]);

    // Add slight animation effect
    setTimeout(() => {
      setMapCenter([location.lat, location.lng]);
    }, 100);
  };

  const handleMapClick = (event) => {
    // Show current location when clicking on map
    const clickedLocation = {
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      name: 'Selected Location',
      address: `${event.latlng.lat.toFixed(4)}, ${event.latlng.lng.toFixed(4)}`,
      type: 'custom'
    };

    setCurrentLocation(clickedLocation);
    setSelectedLocation(clickedLocation);
    setShowTrafficCard(true);
  };

  const handleRouteRequest = () => {
    if (origin && destination) {
      setShowRoute(true);
    }
  };

  const handleRouteCalculated = (route) => {
    setRouteData(route);
    setShowRoute(true);
  };

  const clearRoute = () => {
    setRouteData(null);
    setShowRoute(false);
  };

  const handleGetDirections = (location) => {
    // Simulate navigation mode
    if (currentLocation) {
      setOrigin(currentLocation);
      setDestination(location);
      setShowRoute(true);
    }
  };

  const handleAddFavorite = (location) => {
    // Simulate adding to favorites

    // Could show a toast notification here
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  const toggleWeatherOverlay = () => {
    setWeatherOverlay(!weatherOverlay);
  };

  // Auto-update traffic data simulation
  useEffect(() => {
    if (!isDemoActive) return;

    const interval = setInterval(() => {
      // Simulate real-time traffic updates
      demoLocations.forEach(location => {
        const conditions = ['light', 'moderate', 'heavy'];
        const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

        location.trafficData = {
          ...location.trafficData,
          condition: randomCondition,
          avgSpeed: Math.max(15, location.trafficData.freeFlowSpeed - Math.floor(Math.random() * 20)),
          lastUpdated: new Date()
        };
      });

      // Force re-render
      setSelectedLocation(prev => prev ? { ...prev } : null);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [isDemoActive, demoLocations]);

  return (
    <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      {/* Enhanced Demo Header */}
      <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Interactive Traffic Map</h3>
              <p className="text-sm text-gray-600">Powered by TomTom Maps</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Map Controls */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white rounded-full transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-gray-600" /> : <Maximize2 className="w-4 h-4 text-gray-600" />}
            </button>

            <button
              onClick={toggleSound}
              className="p-2 hover:bg-white rounded-full transition-colors"
              title="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-600" />}
            </button>

            {!isDemoActive && (
              <button
                onClick={startDemo}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Try Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Demo Progress */}
        {isDemoActive && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Demo Progress</span>
              <span>{currentDemoStep + 1} of {demoSteps.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${((currentDemoStep + 1) / demoSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Enhanced Demo Step */}
        {isDemoActive && (
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-2">{demoSteps[currentDemoStep].title}</h4>
            <p className="text-sm text-gray-600 mb-3">{demoSteps[currentDemoStep].description}</p>
            <p className="text-xs text-blue-600 italic">{demoSteps[currentDemoStep].action}</p>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setCurrentDemoStep(Math.max(0, currentDemoStep - 1))}
                disabled={currentDemoStep === 0}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Previous
              </button>

              {currentDemoStep === demoSteps.length - 1 ? (
                <button
                  onClick={onUpgradeClick}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full hover:from-green-600 hover:to-green-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>Upgrade Now</span>
                </button>
              ) : (
                <button
                  onClick={nextDemoStep}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Map Container */}
      <div className={`relative ${isFullscreen ? 'h-screen' : 'h-96'} bg-gray-100`}>
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          dragging={true}
          onClick={handleMapClick}
        >
          <TomTomTileLayer style={mapStyle} />

          {/* Enhanced Demo Heatmap */}
          <DemoHeatmapLayer points={heatmapData} />

          {/* Interactive Demo Markers */}
          {demoLocations.map((location) => (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={createCustomIcon(
                location.type === 'government' ? '#3b82f6' :
                location.type === 'shopping' ? '#10b981' :
                location.type === 'hospital' ? '#ef4444' :
                location.type === 'school' ? '#8b5cf6' :
                location.type === 'cafe' ? '#f59e0b' :
                location.type === 'restaurant' ? '#f97316' :
                '#6b7280'
              )}
              eventHandlers={{
                click: () => handleLocationSelect(location)
              }}
            >
              <Popup>
                <div className="p-3 min-w-48">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">
                      {location.type === 'government' ? '🏛️' :
                       location.type === 'shopping' ? '🛍️' :
                       location.type === 'hospital' ? '🏥' :
                       location.type === 'school' ? '🎓' :
                       location.type === 'cafe' ? '☕' :
                       location.type === 'restaurant' ? '🍔' :
                       '📍'}
                    </span>
                    <h3 className="font-semibold text-sm">{location.name}</h3>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{location.address}</p>

                  {location.trafficData && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Traffic:</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          location.trafficData.condition === 'heavy' ? 'bg-red-100 text-red-700' :
                          location.trafficData.condition === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {location.trafficData.condition.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Speed:</span>
                        <span className="font-medium">{location.trafficData.avgSpeed} km/h</span>
                      </div>
                    </div>
                  )}

                  {location.rating && (
                    <div className="flex items-center space-x-1 mt-2 mb-2">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span className="text-xs text-gray-600">{location.rating}</span>
                      <span className="text-xs text-gray-400">({location.reviews})</span>
                    </div>
                  )}

                  <button className="w-full mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors">
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Current Location Marker */}
          {currentLocation && (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={createCustomIcon('#4285f4', 'current')}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">Selected Location</h3>
                  <p className="text-xs text-gray-600">{currentLocation.address}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route Line */}
          {showRoute && routeData && (
            <Polyline
              positions={routeData.coordinates}
              color="#3b82f6"
              weight={6}
              opacity={0.8}
            />
          )}
        </MapContainer>

        {/* Enhanced Google Maps-style Search Component */}
        <GoogleMapsSearch
          onLocationSelect={handleLocationSelect}
          onRouteRequest={handleRouteRequest}
          currentOrigin={origin}
          currentDestination={destination}
        />

        {/* Enhanced Map Controls */}
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col space-y-2">
          <button
            onClick={() => setMapStyle(mapStyle === 'main' ? 'satellite' : 'main')}
            className="w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Toggle Map Style"
          >
            {mapStyle === 'main' ? <Satellite className="w-4 h-4 text-gray-600" /> : <MapIcon className="w-4 h-4 text-gray-600" />}
          </button>

          <button
            onClick={toggleWeatherOverlay}
            className={`w-10 h-10 rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-colors ${
              weatherOverlay ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
            }`}
            title="Weather Overlay"
          >
            <Cloud className="w-4 h-4" />
          </button>

          <button
            onClick={() => setMapCenter([14.4504, 121.0170])}
            className="w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Traffic Legend */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
            <div className="text-xs font-medium text-gray-700 mb-2">Traffic Legend</div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Light</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Moderate</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Heavy</span>
              </div>
            </div>
          </div>
        </div>

          {/* Demo Overlay Instructions */}
          {!isDemoActive && (
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[1000]">
            <div className="bg-white rounded-lg p-6 text-center shadow-lg max-w-sm mx-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Interactive Demo</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Experience TomTom-powered mapping with real-time traffic visualization
              </p>
              <button
                onClick={startDemo}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
              >
                Start Demo
              </button>
            </div>
          </div>
        )}

        {/* Feature Limitations Overlay */}
        <div className="absolute top-2 right-2 bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-2 shadow-sm z-[1000]">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-800">Demo Mode</span>
          </div>
        </div>
      </div>

      {/* Enhanced Demo Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">Demo Users Online</span>
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">Live Traffic Data</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full hover:from-green-600 hover:to-green-700 transition-all duration-300 text-sm flex items-center justify-center space-x-2"
          >
            <Lock className="w-4 h-4" />
            <span>Upgrade Now</span>
          </button>

          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-all duration-300 text-sm flex items-center justify-center space-x-2">
            <Share2 className="w-4 h-4" />
            <span>Share Demo</span>
          </button>
        </div>
      </div>

        {/* Enhanced Traffic Info Card Popup */}
        {showTrafficCard && selectedLocation && (
          <div className="absolute top-4 right-4 z-[1000] max-w-sm">
          <TrafficInfoCard
            location={selectedLocation}
            trafficData={selectedLocation.trafficData}
            onGetDirections={handleGetDirections}
            onAddFavorite={handleAddFavorite}
          />
          <button
            onClick={() => setShowTrafficCard(false)}
            className="absolute top-2 right-2 w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg"
          >
            ×
          </button>
        </div>
      )}

        {/* Route Planner Popup */}
        {showRoute && (
          <div className="absolute top-4 left-4 z-[1000] max-w-sm">
          <RoutePlanner
            origin={origin}
            destination={destination}
            onRouteCalculated={handleRouteCalculated}
            onClearRoute={clearRoute}
          />
        </div>
      )}

        {/* Weather Overlay Indicator */}
        {weatherOverlay && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000]">
          <div className="bg-blue-500 text-white rounded-full px-3 py-1 text-xs font-medium flex items-center space-x-2">
            <Cloud className="w-3 h-3" />
            <span>Weather Radar Active</span>
          </div>
        </div>
      )}

      {/* Live Updates Indicator */}
      <div className="absolute top-2 left-2 z-[1000]">
        <div className="bg-green-500 text-white rounded-full px-2 py-1 text-xs font-medium flex items-center space-x-1">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>LIVE</span>
        </div>
      </div>
    </div>
  );
};

export default TrafficMapDemo;
