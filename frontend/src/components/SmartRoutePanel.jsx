import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  Route,
  X,
  ChevronUp,
  ChevronDown,
  Zap,
  Star,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Play,
  Volume2,
  VolumeX,
  Layers,
  ArrowRight,
  Sparkles,
  Gauge,
  Timer,
  Compass,
  Target,
  RefreshCw,
  Search
} from 'lucide-react';
import smartRoutingService from '../services/smartRoutingService';
import enhancedRoutingService from '../services/enhancedRoutingService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';
import voiceNavigationService from '../services/voiceNavigationService';

const SmartRoutePanel = ({ 
  onRouteSelect, 
  onStartNavigation, 
  onClose,
  isOpen = false,
  className = '',
  initialOrigin = null,
  initialDestination = null
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeComparison, setRouteComparison] = useState(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showInfoSection, setShowInfoSection] = useState(true); // New state for collapsible info
  
  // Location states
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);

  // Sync with external origin/destination when provided
  useEffect(() => {
    if (initialOrigin) {
      setSelectedOrigin(initialOrigin);
      setOriginQuery(initialOrigin.name || initialOrigin.display_name || '');
    }
    if (initialDestination) {
      setSelectedDestination(initialDestination);
      setDestinationQuery(initialDestination.name || initialDestination.display_name || '');
    }
  }, [initialOrigin, initialDestination]);
  
  // Mobile detection and drag handling
  const [isMobile, setIsMobile] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [panelOffset, setPanelOffset] = useState(0);
  const panelRef = useRef(null);
  const inputTimeoutRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsExpanded(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle location search with debouncing
  const handleOriginSearch = useCallback(async (query) => {
    setOriginQuery(query);
    
    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current);
    }
    
    if (query.length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }

    inputTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestions = await enhancedGeocodingService.searchLocations(query, 5);
        setOriginSuggestions(suggestions);
        setShowOriginSuggestions(true);
      } catch (error) {

      }
    }, 300);
  }, []);

  const handleDestinationSearch = useCallback(async (query) => {
    setDestinationQuery(query);
    
    if (inputTimeoutRef.current) {
      clearTimeout(inputTimeoutRef.current);
    }
    
    if (query.length < 2) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }

    inputTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestions = await enhancedGeocodingService.searchLocations(query, 5);
        setDestinationSuggestions(suggestions);
        setShowDestinationSuggestions(true);
      } catch (error) {

      }
    }, 300);
  }, []);

  const handleOriginSelect = (location) => {
    setSelectedOrigin(location);
    setOriginQuery(location.name || location.display_name);
    setOriginSuggestions([]);
    setShowOriginSuggestions(false);
  };

  const handleDestinationSelect = (location) => {
    setSelectedDestination(location);
    setDestinationQuery(location.name || location.display_name);
    setDestinationSuggestions([]);
    setShowDestinationSuggestions(false);
  };

  const handleGetRoutes = async () => {
    if (!selectedOrigin || !selectedDestination) {
      setError('Please select both origin and destination');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const originLat = selectedOrigin.lat || selectedOrigin.latitude;
      const originLng = selectedOrigin.lng || selectedOrigin.longitude || selectedOrigin.lon;
      const destLat = selectedDestination.lat || selectedDestination.latitude;
      const destLng = selectedDestination.lng || selectedDestination.longitude || selectedDestination.lon;

      const routeData = await enhancedRoutingService.getDetailedRoute(
        originLat,
        originLng,
        destLat,
        destLng,
        { 
          avoidTraffic: true,
          maxAlternatives: 3,
          travelMode: 'car'
        }
      );
      
      setRoutes(routeData.routes || []);
      setRouteComparison(smartRoutingService.getRouteComparison?.(routeData.routes || []));
      
      if (routeData.recommended_route) {
        setSelectedRoute(routeData.recommended_route);
        if (onRouteSelect) {
          onRouteSelect(routeData.recommended_route, selectedOrigin, selectedDestination, routeData.routes);
        }
      }
      
    } catch (err) {
      setError(err.message || 'Failed to find routes');

    } finally {
      setLoading(false);
    }
  };

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    if (onRouteSelect) {
      onRouteSelect(route, selectedOrigin, selectedDestination, routes);
    }
  };

  const handleUseCurrentLocation = async (type) => {
    try {
      const location = await enhancedGeocodingService.getCurrentLocation();
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
    const temp = selectedOrigin;
    setSelectedOrigin(selectedDestination);
    setSelectedDestination(temp);
    
    const tempQuery = originQuery;
    setOriginQuery(destinationQuery);
    setDestinationQuery(tempQuery);
  };

  const toggleVoiceNavigation = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      voiceNavigationService.enable();
      if (selectedRoute) {
        voiceNavigationService.announceETA(selectedRoute.estimated_duration_minutes);
      }
    } else {
      voiceNavigationService.disable();
    }
  };

  // Touch drag handlers for mobile
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    setDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isMobile || dragStart === null) return;
    const deltaY = e.touches[0].clientY - dragStart;
    if (deltaY > 0) {
      setPanelOffset(Math.min(deltaY, 200));
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || dragStart === null) return;
    if (panelOffset > 100) {
      setIsExpanded(false);
      if (onClose) onClose();
    }
    setPanelOffset(0);
    setDragStart(null);
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDistance = (km) => {
    if (!km) return '0 km';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const getTrafficColor = (condition) => {
    const colors = {
      light: 'text-emerald-600 bg-emerald-50',
      moderate: 'text-amber-600 bg-amber-50',
      heavy: 'text-orange-600 bg-orange-50',
      standstill: 'text-red-600 bg-red-50'
    };
    return colors[condition] || colors.moderate;
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={panelRef}
      className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-300 ease-out ${className}`}
      style={{
        transform: `translateY(${isExpanded ? -panelOffset : 'calc(100% - 60px)'}px)`,
        maxHeight: isExpanded ? '55vh' : '60px' // Reduced from 90vh to 55vh to show more map
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Backdrop */}
      {isExpanded && (
        <div 
          className="absolute inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => {
            setIsExpanded(false);
            if (onClose) onClose();
          }}
        />
      )}

      {/* Panel Container - Semi-transparent to show map */}
      <div className="bg-white/95 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-gray-200 overflow-hidden">
        {/* Drag Handle & Header - More Compact */}
        <div 
          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Navigation className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Smart Route</h3>
                <p className="text-blue-100 text-[10px]">
                  {selectedRoute ? `${formatDuration(selectedRoute.estimated_duration_minutes)} • ${formatDistance(selectedRoute.distance_km)}` : 'AI-powered navigation'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {selectedRoute && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVoiceNavigation();
                  }}
                  className={`p-2 rounded-lg transition-all ${
                    voiceEnabled 
                      ? 'bg-white/30 text-white' 
                      : 'bg-white/20 text-white/80 hover:bg-white/30'
                  }`}
                >
                  {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClose) onClose();
                }}
                className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Drag Indicator */}
          <div className="flex justify-center mt-2">
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(55vh - 80px)' }}>
            <div className="p-3 space-y-3">
              {/* Search Inputs - More Compact */}
              <div className="space-y-2">
                {/* Origin */}
                <div className="relative">
                  <label className="block text-[10px] font-semibold text-gray-700 mb-1 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-emerald-600" />
                    From
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search origin..."
                      value={originQuery}
                      onChange={(e) => handleOriginSearch(e.target.value)}
                      onFocus={() => setShowOriginSuggestions(originSuggestions.length > 0)}
                      className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs transition-all"
                    />
                    {selectedOrigin && (
                      <button
                        onClick={() => handleUseCurrentLocation('origin')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                        title="Use current location"
                      >
                        <Target className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {showOriginSuggestions && originSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {originSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleOriginSelect(suggestion)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">{suggestion.name}</div>
                          <div className="text-xs text-gray-500 truncate">{suggestion.display_name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap Button */}
                {selectedOrigin && selectedDestination && (
                  <div className="flex justify-center">
                    <button
                      onClick={handleSwapLocations}
                      className="p-2 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-600 rounded-full hover:from-blue-200 hover:to-indigo-200 transition-all shadow-sm"
                      title="Swap locations"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Destination */}
                <div className="relative">
                  <label className="block text-[10px] font-semibold text-gray-700 mb-1 flex items-center">
                    <MapPin className="w-3 h-3 mr-1 text-red-600" />
                    To
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search destination..."
                      value={destinationQuery}
                      onChange={(e) => handleDestinationSearch(e.target.value)}
                      onFocus={() => setShowDestinationSuggestions(destinationSuggestions.length > 0)}
                      className="w-full pl-9 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs transition-all"
                    />
                    {selectedDestination && (
                      <button
                        onClick={() => handleUseCurrentLocation('destination')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                        title="Use current location"
                      >
                        <Target className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {destinationSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleDestinationSelect(suggestion)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">{suggestion.name}</div>
                          <div className="text-xs text-gray-500 truncate">{suggestion.display_name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Get Routes Button - More Compact */}
              <button
                onClick={handleGetRoutes}
                disabled={loading || !selectedOrigin || !selectedDestination}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2 text-sm"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Finding Routes...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    <span>Get Smart Routes</span>
                  </>
                )}
              </button>

              {/* Error Display */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm flex-1">{error}</span>
                  <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Route Results */}
              {routes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="font-bold text-gray-900 flex items-center space-x-1.5 text-sm">
                      <Route className="w-4 h-4 text-blue-600" />
                      <span>{routes.length} Route{routes.length > 1 ? 's' : ''} Found</span>
                    </h4>
                    <button
                      onClick={() => setShowAllRoutes(!showAllRoutes)}
                      className="flex items-center space-x-1 px-2 py-1 text-[10px] bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Layers className="w-3 h-3" />
                      <span>{showAllRoutes ? 'Best' : 'All'}</span>
                    </button>
                  </div>

                  {routes.map((route, index) => {
                    const isSelected = selectedRoute?.route_id === route.route_id;
                    const isRecommended = index === 0;
                    
                    return (
                      <div
                        key={route.route_id || index}
                        className={`relative border-2 rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-500 bg-gradient-to-br from-blue-50/90 to-indigo-50/90 shadow-md scale-[1.01]'
                            : 'border-gray-200 bg-white/90 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => handleRouteSelect(route)}
                      >
                        {/* Recommended Badge - Smaller */}
                        {isRecommended && (
                          <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md flex items-center space-x-0.5">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>BEST</span>
                          </div>
                        )}

                        {/* Selected Indicator - Smaller */}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1.5">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-sm ${
                                isSelected ? 'bg-blue-600' : 'bg-gray-400'
                              }`}>
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-gray-900 text-sm truncate">{route.route_name || `Route ${index + 1}`}</h5>
                                <div className="flex items-center space-x-2 text-xs text-gray-600 mt-0.5">
                                  <span className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="font-semibold">{formatDuration(route.estimated_duration_minutes)}</span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <Gauge className="w-3 h-3" />
                                    <span>{formatDistance(route.distance_km)}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Route Stats Grid - More Compact */}
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          <div className="bg-white/70 rounded-lg p-1.5 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">Traffic</div>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getTrafficColor(route.traffic_conditions)}`}>
                              {route.traffic_conditions || 'moderate'}
                            </div>
                          </div>
                          <div className="bg-white/70 rounded-lg p-1.5 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">Delays</div>
                            <div className="text-xs font-bold text-orange-600">
                              {route.traffic_delays > 0 ? `+${route.traffic_delays}m` : 'None'}
                            </div>
                          </div>
                          <div className="bg-white/70 rounded-lg p-1.5 text-center">
                            <div className="text-[10px] text-gray-500 mb-0.5">Incidents</div>
                            <div className="text-xs font-bold text-red-600">
                              {route.incidents_on_route || 0}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons - More Compact */}
                        <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRouteSelect(route);
                            }}
                            className={`flex-1 py-2 rounded-lg font-medium text-xs transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {isSelected ? (
                              <span className="flex items-center justify-center space-x-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Selected</span>
                              </span>
                            ) : (
                              'Select Route'
                            )}
                          </button>
                          
                          {isSelected && onStartNavigation && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartNavigation(route);
                              }}
                              className="flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-green-700 transition-all shadow-md text-xs"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Start</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {!loading && routes.length === 0 && selectedOrigin && selectedDestination && (
                <div className="text-center py-12">
                  <Navigation className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium">No routes found</p>
                  <p className="text-sm text-gray-400 mt-1">Try different locations</p>
                </div>
              )}

              {/* Getting Started - Collapsible Info Section */}
              {!loading && routes.length === 0 && (!selectedOrigin || !selectedDestination) && (
                <div className="space-y-4">
                  {/* Collapsible Header */}
                  <button
                    onClick={() => setShowInfoSection(!showInfoSection)}
                    className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all"
                  >
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-700">About Smart Route</span>
                    </div>
                    {showInfoSection ? (
                      <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-gray-600" />
                    )}
                  </button>

                  {/* Collapsible Content */}
                  {showInfoSection && (
                    <div className="text-center py-6 animate-fade-in">
                      <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-2">Smart Route Planning</h3>
                      <p className="text-xs text-gray-600 mb-4 max-w-sm mx-auto">
                        Get intelligent route suggestions with real-time traffic data, incident avoidance, and time-saving optimizations.
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto text-xs">
                        <div className="flex items-center space-x-1.5 p-2 bg-emerald-50 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs">Real-time traffic</span>
                        </div>
                        <div className="flex items-center space-x-1.5 p-2 bg-blue-50 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-xs">Multiple routes</span>
                        </div>
                        <div className="flex items-center space-x-1.5 p-2 bg-purple-50 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                          <span className="text-xs">Incident avoidance</span>
                        </div>
                        <div className="flex items-center space-x-1.5 p-2 bg-orange-50 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                          <span className="text-xs">Time savings</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartRoutePanel;

