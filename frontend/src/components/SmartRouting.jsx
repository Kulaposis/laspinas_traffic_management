import React, { useState, useEffect, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  Route, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  X,
  RefreshCw,
  Zap,
  Star,
  ThumbsUp,
  ThumbsDown,
  Search,
  Loader,
  Target
} from 'lucide-react';
import smartRoutingService from '../services/smartRoutingService';
import enhancedRoutingService from '../services/enhancedRoutingService';
import geocodingService from '../services/geocodingService';
import realTimeTrafficService from '../services/realTimeTrafficService';

const SmartRouting = ({ onRouteSelect, onStartNavigation, className = '' }) => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [avoidTraffic, setAvoidTraffic] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeComparison, setRouteComparison] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [realTimeTraffic, setRealTimeTraffic] = useState(null);

  // Location search states
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [originLoading, setOriginLoading] = useState(false);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  // Refs for input focus management
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);

  // Default Las Piñas locations for quick selection
  const quickLocations = [
    { name: 'Alabang-Zapote Road', lat: 14.4504, lng: 121.0170 },
    { name: 'Westservice Road', lat: 14.4400, lng: 121.0200 },
    { name: 'C-5 Extension', lat: 14.4600, lng: 121.0150 },
    { name: 'CAA Road', lat: 14.4450, lng: 121.0250 },
    { name: 'Almanza Road', lat: 14.4350, lng: 121.0100 },
    { name: 'Las Piñas City Hall', lat: 14.4378, lng: 121.0219 }
  ];

  // Location search handlers
  const handleOriginSearch = async (query) => {
    setOriginQuery(query);
    
    if (query.length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }

    setOriginLoading(true);
    try {
      const suggestions = await geocodingService.searchLocations(query, 8);
      setOriginSuggestions(suggestions);
      setShowOriginSuggestions(true);
    } catch (error) {
      console.error('Origin search error:', error);
    } finally {
      setOriginLoading(false);
    }
  };

  const handleDestinationSearch = async (query) => {
    setDestinationQuery(query);
    
    if (query.length < 2) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }

    setDestinationLoading(true);
    try {
      const suggestions = await geocodingService.searchLocations(query, 8);
      setDestinationSuggestions(suggestions);
      setShowDestinationSuggestions(true);
    } catch (error) {
      console.error('Destination search error:', error);
    } finally {
      setDestinationLoading(false);
    }
  };

  const handleOriginSelect = (location) => {
    setSelectedOrigin(location);
    setOriginQuery(location.name);
    setOriginSuggestions([]);
    setShowOriginSuggestions(false);
  };

  const handleDestinationSelect = (location) => {
    setSelectedDestination(location);
    setDestinationQuery(location.name);
    setDestinationSuggestions([]);
    setShowDestinationSuggestions(false);
  };

  const handleGetRoutes = async () => {
    if (!selectedOrigin || !selectedDestination) {
      setError('Please select both origin and destination locations');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Get detailed routes with turn-by-turn instructions using enhanced routing
      const [routeData, trafficData] = await Promise.all([
        enhancedRoutingService.getDetailedRoute(
          selectedOrigin.lat,
          selectedOrigin.lon,
          selectedDestination.lat,
          selectedDestination.lon,
          { 
            avoidTraffic: avoidTraffic,
            maxAlternatives: 2,
            travelMode: 'car'
          }
        ),
        realTimeTrafficService.getRouteTrafficData([
          [selectedOrigin.lat, selectedOrigin.lon],
          [selectedDestination.lat, selectedDestination.lon]
        ]).catch(() => null) // Gracefully handle if traffic data service fails
      ]);
      
      setRoutes(routeData.routes || []);
      setRouteComparison(smartRoutingService.getRouteComparison(routeData.routes || []));
      setRealTimeTraffic(trafficData);
      
      // Auto-select recommended route
      if (routeData.recommended_route) {
        setSelectedRoute(routeData.recommended_route);
      }
      
    } catch (err) {
      setError(err.message || 'Failed to get route suggestions');
      console.error('Error getting routes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    if (onRouteSelect) {
      // Pass route along with origin, destination, and all routes for map visualization
      onRouteSelect(route, selectedOrigin, selectedDestination, routes);
    }
  };

  const handleQuickLocationSelect = async (location, type) => {
    try {
      // Try to refine coordinates using geocoding
      const results = await geocodingService.searchLocations(`${location.name}`, 1);
      const best = Array.isArray(results) && results.length > 0 ? results[0] : null;

      const locationData = {
        name: location.name,
        display_name: best?.display_name || `${location.name}, Las Piñas City, Philippines`,
        lat: typeof best?.lat === 'number' ? best.lat : location.lat,
        lon: typeof best?.lon === 'number' ? best.lon : location.lng,
        source: best ? `${best.source}_refined` : 'quick_select'
      };

      if (type === 'origin') {
        handleOriginSelect(locationData);
      } else {
        handleDestinationSelect(locationData);
      }
    } catch (e) {
      // Fallback to static coordinates on any error
      const fallback = {
        name: location.name,
        display_name: `${location.name}, Las Piñas City, Philippines`,
        lat: location.lat,
        lon: location.lng,
        source: 'quick_select'
      };
      if (type === 'origin') {
        handleOriginSelect(fallback);
      } else {
        handleDestinationSelect(fallback);
      }
    }
  };

  const handleUseCurrentLocation = async (type) => {
    try {
      setError('');
      const location = await geocodingService.getCurrentLocation();
      
      if (type === 'origin') {
        handleOriginSelect(location);
      } else {
        handleDestinationSelect(location);
      }
    } catch (error) {
      setError('Unable to get current location: ' + error.message);
    }
  };

  const handleSwapLocations = () => {
    const tempOrigin = selectedOrigin;
    const tempOriginQuery = originQuery;
    
    setSelectedOrigin(selectedDestination);
    setOriginQuery(destinationQuery);
    
    setSelectedDestination(tempOrigin);
    setDestinationQuery(tempOriginQuery);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (originInputRef.current && !originInputRef.current.contains(event.target)) {
        setShowOriginSuggestions(false);
      }
      if (destinationInputRef.current && !destinationInputRef.current.contains(event.target)) {
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Navigation className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Smart Routing</h3>
              <p className="text-sm text-gray-500">AI-powered route optimization</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            {showAdvanced ? 'Simple' : 'Advanced'}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Route Input Form */}
        <div className="space-y-4">
          {/* Origin Search */}
          <div className="relative" ref={originInputRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
              From
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search for origin location..."
                value={originQuery}
                onChange={(e) => handleOriginSearch(e.target.value)}
                onFocus={() => setShowOriginSuggestions(originSuggestions.length > 0)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {originLoading && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                </div>
              )}
              {selectedOrigin && (
                <button
                  onClick={() => handleUseCurrentLocation('origin')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-600 hover:text-green-700"
                  title="Use current location"
                >
                  <Target className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Origin Suggestions */}
            {showOriginSuggestions && originSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {originSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleOriginSelect(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
                  >
                    <span className="text-lg flex-shrink-0">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{suggestion.name}</div>
                      <div className="text-sm text-gray-500 truncate">{suggestion.display_name}</div>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {suggestion.source}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Quick Origin Buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => handleUseCurrentLocation('origin')}
                className="flex items-center space-x-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
              >
                <Target className="w-3 h-3" />
                <span>Current Location</span>
              </button>
              {quickLocations.slice(0, 3).map((location) => (
                <button
                  key={`origin-${location.name}`}
                  onClick={() => handleQuickLocationSelect(location, 'origin')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>

          {/* Swap Button */}
          {selectedOrigin && selectedDestination && (
            <div className="flex justify-center">
              <button
                onClick={handleSwapLocations}
                className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                title="Swap origin and destination"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Destination Search */}
          <div className="relative" ref={destinationInputRef}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
              To
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search for destination location..."
                value={destinationQuery}
                onChange={(e) => handleDestinationSearch(e.target.value)}
                onFocus={() => setShowDestinationSuggestions(destinationSuggestions.length > 0)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              {destinationLoading && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader className="h-4 w-4 text-blue-500 animate-spin" />
                </div>
              )}
              {selectedDestination && (
                <button
                  onClick={() => handleUseCurrentLocation('destination')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-600 hover:text-green-700"
                  title="Use current location"
                >
                  <Target className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Destination Suggestions */}
            {showDestinationSuggestions && destinationSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {destinationSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleDestinationSelect(suggestion)}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
                  >
                    <span className="text-lg flex-shrink-0">{suggestion.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{suggestion.name}</div>
                      <div className="text-sm text-gray-500 truncate">{suggestion.display_name}</div>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {suggestion.source}
                    </span>
                  </button>
                ))}
              </div>
            )}
            
            {/* Quick Destination Buttons */}
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => handleUseCurrentLocation('destination')}
                className="flex items-center space-x-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
              >
                <Target className="w-3 h-3" />
                <span>Current Location</span>
              </button>
              {quickLocations.slice(3, 6).map((location) => (
                <button
                  key={`dest-${location.name}`}
                  onClick={() => handleQuickLocationSelect(location, 'destination')}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {location.name}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={avoidTraffic}
                onChange={(e) => setAvoidTraffic(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Avoid heavy traffic</span>
            </label>
            
            <button
              onClick={handleGetRoutes}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Route className="w-4 h-4" />
              )}
              <span>{loading ? 'Finding Routes...' : 'Get Smart Routes'}</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto p-1 hover:bg-red-100 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Route Results */}
        {routes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Route Options ({routes.length})</span>
              </h4>
              
              {routeComparison && (
                <div className="text-sm text-gray-500">
                  Fastest: {smartRoutingService.formatDuration(routeComparison.fastest.estimated_duration_minutes)}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {routes.map((route, index) => (
                <div
                  key={route.route_id || index}
                  className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                    selectedRoute?.route_id === route.route_id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => handleRouteSelect(route)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">
                        {smartRoutingService.getRouteTypeIcon(route.route_type)}
                      </span>
                      <div>
                        <h5 className="font-medium text-gray-900">{route.route_name}</h5>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{smartRoutingService.formatDuration(route.estimated_duration_minutes)}</span>
                          </span>
                          <span>{smartRoutingService.formatDistance(route.distance_km)}</span>
                          {routeComparison && (
                            <span className="text-blue-600">
                              ETA: {routeComparison.comparison.find(r => r.route_id === route.route_id)?.arrivalTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {route.route_quality === 'primary' && (
                        <Star className="w-4 h-4 text-yellow-500" />
                      )}
                      <span
                        className="px-2 py-1 text-xs rounded-full text-white font-medium"
                        style={{ backgroundColor: smartRoutingService.getTrafficConditionColor(route.traffic_conditions) }}
                      >
                        {route.traffic_conditions}
                      </span>
                    </div>
                  </div>

                  {/* Route Details */}
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Traffic Delays</div>
                      <div className="text-sm font-medium">
                        {route.traffic_delays > 0 
                          ? `+${route.traffic_delays} min` 
                          : 'No delays'
                        }
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Incidents</div>
                      <div className="text-sm font-medium">
                        {route.incidents_on_route || 0} incidents
                      </div>
                    </div>
                  </div>

                  {/* Advantages and Disadvantages */}
                  {showAdvanced && (
                    <div className="space-y-2">
                      {route.advantages && route.advantages.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Advantages</div>
                          <div className="flex flex-wrap gap-1">
                            {route.advantages.slice(0, 2).map((advantage, idx) => (
                              <span key={idx} className="flex items-center space-x-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                <ThumbsUp className="w-3 h-3" />
                                <span>{advantage}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {route.disadvantages && route.disadvantages.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Considerations</div>
                          <div className="flex flex-wrap gap-1">
                            {route.disadvantages.slice(0, 2).map((disadvantage, idx) => (
                              <span key={idx} className="flex items-center space-x-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                <ThumbsDown className="w-3 h-3" />
                                <span>{disadvantage}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      {selectedRoute?.route_id === route.route_id ? (
                        <div className="flex items-center space-x-2 text-blue-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Selected Route</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRouteSelect(route)}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Select Route
                        </button>
                      )}
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRouteSelect(route)}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Show on Map</span>
                        </button>
                        
                        {selectedRoute?.route_id === route.route_id && onStartNavigation && (
                          <button
                            onClick={() => onStartNavigation(route)}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Start Navigation</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Traffic Status */}
        {realTimeTraffic && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center space-x-3 mb-3">
              <Zap className="w-5 h-5 text-blue-600" />
              <h4 className="font-medium text-gray-900">Real-time Traffic Data</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Overall Condition</div>
                <div className={`font-medium capitalize ${
                  realTimeTraffic.overall_condition === 'light' ? 'text-green-600' :
                  realTimeTraffic.overall_condition === 'moderate' ? 'text-yellow-600' :
                  realTimeTraffic.overall_condition === 'heavy' ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {realTimeTraffic.overall_condition}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Data Coverage</div>
                <div className="font-medium text-blue-600">
                  {Math.round(realTimeTraffic.overall_coverage * 100)}%
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Sources: {realTimeTraffic.sources.map(s => s.name).join(', ')}
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && routes.length === 0 && selectedOrigin && selectedDestination && (
          <div className="text-center py-8 text-gray-500">
            <Navigation className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No routes found between these locations.</p>
            <p className="text-sm mt-1">Try selecting different locations.</p>
          </div>
        )}

        {/* Getting Started */}
        {!loading && routes.length === 0 && !selectedOrigin && !selectedDestination && (
          <div className="text-center py-12 text-gray-500">
            <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Smart Route Planning</h3>
            <p className="mb-4">Search for locations to get intelligent route suggestions with real-time traffic data.</p>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Real-time traffic</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Multiple routes</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Incident avoidance</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Time savings</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartRouting;
