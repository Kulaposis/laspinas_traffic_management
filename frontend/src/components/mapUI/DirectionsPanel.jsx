import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Route, Clock, Car, Navigation, Play, 
  ChevronRight, Layers, Zap, AlertTriangle, MapPin,
  TrendingUp, TrendingDown, Minimize2, Target, ArrowUpDown, Search,
  CheckCircle2, ChevronUp, ChevronDown
} from 'lucide-react';
import enhancedGeocodingService from '../../services/enhancedGeocodingService';

/**
 * Modern Directions Panel Component - Mobile & Desktop Optimized
 * Mobile: Bottom sheet design that doesn't cover the entire map
 * Desktop: Centered modal design
 */
const DirectionsPanel = ({
  isOpen,
  onClose,
  origin,
  destination,
  routes = [],
  selectedRoute = null,
  onSelectRoute,
  onStartNavigation,
  onStartSimulation,
  routeTrafficData = null,
  isMinimized = false,
  onToggleMinimize,
  onOriginChange = null,
  onDestinationChange = null,
  onOriginSelect = null,
  onDestinationSelect = null,
  onSwapLocations = null,
  onGetCurrentLocation = null
}) => {
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Editable fields state
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [editingDestination, setEditingDestination] = useState(false);
  const [originQuery, setOriginQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const searchTimeoutRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  
  // Initialize queries from origin/destination props
  useEffect(() => {
    if (origin && !editingOrigin) {
      setOriginQuery(origin?.name || origin?.address?.full || '');
    }
    if (destination && !editingDestination) {
      setDestinationQuery(destination?.name || destination?.address?.full || '');
    }
  }, [origin, destination, editingOrigin, editingDestination]);

  // Search handler
  const handleSearch = useCallback(async (query, type = 'origin') => {
    if (!query || query.length < 1) {
      if (type === 'origin') {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
      }
      return;
    }

    if (type === 'origin') {
      setIsSearchingOrigin(true);
      setShowOriginSuggestions(true);
    } else {
      setIsSearchingDestination(true);
      setShowDestinationSuggestions(true);
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const debounceTime = query.length >= 3 ? 150 : 300;
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 10,
          countrySet: 'PH',
          center: lasPinasCenter,
          radius: 15000
        });

        const allResults = results || [];
        if (type === 'origin') {
          setOriginSuggestions(allResults);
          setIsSearchingOrigin(false);
        } else {
          setDestinationSuggestions(allResults);
          setIsSearchingDestination(false);
        }
      } catch (error) {
        if (type === 'origin') {
          setOriginSuggestions([]);
          setIsSearchingOrigin(false);
        } else {
          setDestinationSuggestions([]);
          setIsSearchingDestination(false);
        }
      }
    }, debounceTime);
  }, []);

  // Handle location selection
  const handleLocationSelect = (location, type = 'origin') => {
    if (type === 'origin') {
      setOriginQuery(location.name || location.address?.full || '');
      setShowOriginSuggestions(false);
      setEditingOrigin(false);
      if (onOriginSelect) onOriginSelect(location);
      if (onOriginChange) onOriginChange(location.name || location.address?.full || '');
    } else {
      setDestinationQuery(location.name || location.address?.full || '');
      setShowDestinationSuggestions(false);
      setEditingDestination(false);
      if (onDestinationSelect) onDestinationSelect(location);
      if (onDestinationChange) onDestinationChange(location.name || location.address?.full || '');
    }
  };

  // Handle swap locations
  const handleSwap = () => {
    if (onSwapLocations) {
      onSwapLocations();
      const tempQuery = originQuery;
      setOriginQuery(destinationQuery);
      setDestinationQuery(tempQuery);
    }
  };

  // Monitor route availability
  useEffect(() => {
    if (isOpen && (!selectedRoute && (!routes || routes.length === 0))) {
      setIsLoadingRoute(true);
    } else {
      setIsLoadingRoute(false);
    }
  }, [isOpen, selectedRoute, routes]);

  const hasMultipleRoutes = routes && routes.length > 1;
  const hasRoutes = routes && routes.length > 0;
  const currentRoute = selectedRoute || (routes && routes.length > 0 ? routes[selectedRouteIndex] || routes[0] : null);

  // Allow panel to show even without origin (user can set it manually)
  // But require destination to be set
  if (!isOpen || !destination) return null;

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDistance = (km) => {
    if (!km) return 'N/A';
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const getTrafficColor = (condition) => {
    switch (condition) {
      case 'heavy': return 'text-red-600 bg-red-50 border-red-200';
      case 'moderate': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'light': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrafficIcon = (condition) => {
    switch (condition) {
      case 'heavy': return <TrendingUp className="w-4 h-4" />;
      case 'moderate': return <AlertTriangle className="w-4 h-4" />;
      case 'light': return <TrendingDown className="w-4 h-4" />;
      default: return null;
    }
  };

  // Mobile: Bottom sheet design, Desktop: Centered modal
  const panelContent = (
    <>
      {/* Backdrop - Only show on desktop or when not minimized */}
      {(!isMobile || !isMinimized) && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={isMobile ? onToggleMinimize : onClose}
          style={{ zIndex: 10000 }}
        />
      )}

      {isMobile ? (
        <div 
          className="fixed bottom-0 left-0 right-0 pointer-events-none"
          style={{ 
            zIndex: 10001,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className={`bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 ease-out ${
              isMinimized 
                ? 'h-20' // Minimized: Just show header bar
                : '' // Expanded: Use inline style for dynamic max-height
            }`}
            style={!isMinimized ? {
              maxHeight: 'min(85vh, calc(100dvh - env(safe-area-inset-bottom, 0px) - 100px))'
            } : {}}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle - Mobile Only */}
            {!isMinimized && (
              <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing" onClick={onToggleMinimize}>
                <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
              </div>
            )}

            {/* Header with Gradient */}
            <div className={`relative bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 ${isMinimized ? 'p-4' : 'p-5'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  {isMinimized ? (
                    // Minimized header - compact view
                    <div className="flex items-center space-x-3">
                      <Route className="w-5 h-5 text-white flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {origin?.name || 'Origin'} → {destination?.name || 'Destination'}
                        </p>
                        {currentRoute && (
                          <p className="text-xs text-white/80 mt-0.5">
                            {formatDuration(currentRoute?.estimated_duration_minutes)} • {formatDistance(currentRoute?.distance_km)}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Expanded header
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center flex-shrink-0">
                        <Route className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-bold text-white">Directions</h1>
                        <p className="text-xs text-white/90 mt-0.5 truncate">
                          {origin?.name || 'Set origin'} → {destination?.name || 'Destination'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* Minimize/Expand Button */}
                  <button
                    onClick={onToggleMinimize}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                    title={isMinimized ? "Expand" : "Minimize"}
                  >
                    {isMinimized ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Content - Only show when expanded */}
            {!isMinimized && (
              <>
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Route Summary Cards - Mobile */}
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100">
                    {isLoadingRoute || !currentRoute ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duration</span>
                          </div>
                          <p className="text-xl font-bold text-gray-400 animate-pulse">...</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <Car className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distance</span>
                          </div>
                          <p className="text-xl font-bold text-gray-400 animate-pulse">...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Duration Card */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <Clock className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duration</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatDuration(currentRoute?.estimated_duration_minutes)}
                          </p>
                        </div>

                        {/* Distance Card */}
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                          <div className="flex items-center space-x-2 mb-2">
                            <Car className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distance</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatDistance(currentRoute?.distance_km)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Traffic Status */}
                    {routeTrafficData && (
                      <div className={`mt-3 rounded-xl p-3 border ${getTrafficColor(routeTrafficData.condition)}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getTrafficIcon(routeTrafficData.condition)}
                            <span className="text-sm font-semibold capitalize">
                              {routeTrafficData.condition || 'Normal'} Traffic
                            </span>
                          </div>
                          {routeTrafficData.avgSpeed && (
                            <span className="text-sm font-medium text-gray-700">
                              {Math.round(routeTrafficData.avgSpeed)} km/h avg
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                    {/* Route Options */}
                    {hasRoutes && (
                      <div className="p-4 border-b border-gray-200">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">
                          {hasMultipleRoutes ? 'Route Options' : 'Route'}
                        </h3>
                        <div className="space-y-2">
                  {routes.map((route, index) => {
                    const isSelected = selectedRoute && (
                      selectedRoute.route_id === route.route_id ||
                      selectedRoute === route ||
                      (selectedRoute.route_id === undefined && route.route_id === undefined && index === selectedRouteIndex)
                    ) || (!selectedRoute && index === selectedRouteIndex);
                    
                    return (
                      <button
                        key={route.route_id || index}
                        onClick={() => {
                          setSelectedRouteIndex(index);
                          // onSelectRoute will handle closing the panel
                          if (onSelectRoute) {
                            onSelectRoute(route);
                          }
                        }}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              <span className="text-sm font-bold">
                                {index + 1}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold text-gray-900 mb-1">
                                {route.route_name || `Route ${index + 1}`}
                              </p>
                              <div className="flex items-center space-x-3">
                                <p className="text-sm text-gray-600">
                                  {formatDuration(route.estimated_duration_minutes)} • {formatDistance(route.distance_km)}
                                </p>
                                {route.traffic_conditions && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTrafficColor(route.traffic_conditions)}`}>
                                    {route.traffic_conditions}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                        })}
                        </div>
                      </div>
                    )}

                    {/* Origin & Destination */}
                    <div className="p-4 space-y-4">
                      {/* Origin */}
                      <div className="relative">
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <div className="w-4 h-4 rounded-full bg-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</p>
                            {editingOrigin ? (
                              <div className="relative">
                                <input
                                  ref={originInputRef}
                                  type="text"
                                  value={originQuery}
                                  onChange={(e) => {
                                    setOriginQuery(e.target.value);
                                    handleSearch(e.target.value, 'origin');
                                  }}
                                  onFocus={() => {
                                    setEditingOrigin(true);
                                    setShowOriginSuggestions(true);
                                    if (originQuery) {
                                      handleSearch(originQuery, 'origin');
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setShowOriginSuggestions(false);
                                    }, 200);
                                  }}
                                  placeholder="Enter origin"
                                  className="w-full text-base font-semibold text-gray-900 border-2 border-blue-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                {showOriginSuggestions && (originSuggestions.length > 0 || isSearchingOrigin) && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50">
                                    {isSearchingOrigin ? (
                                      <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                    ) : (
                                      <>
                                        {onGetCurrentLocation && (
                                          <button
                                            onClick={() => {
                                              if (onGetCurrentLocation) {
                                                onGetCurrentLocation('origin');
                                                setEditingOrigin(false);
                                                setShowOriginSuggestions(false);
                                              }
                                            }}
                                            className="w-full p-3 hover:bg-gray-50 flex items-center space-x-3 text-left border-b border-gray-100"
                                          >
                                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                              <Target className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">Use current location</p>
                                              <p className="text-xs text-gray-500">Set as origin</p>
                                            </div>
                                          </button>
                                        )}
                                        {originSuggestions.map((location, index) => (
                                          <button
                                            key={index}
                                            onClick={() => handleLocationSelect(location, 'origin')}
                                            className="w-full p-3 hover:bg-gray-50 flex items-start space-x-3 text-left"
                                          >
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">{location.name}</p>
                                              <p className="text-xs text-gray-500 truncate">{location.address?.full || location.address?.freeformAddress}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingOrigin(true);
                            setTimeout(() => originInputRef.current?.focus(), 100);
                          }}
                          className="cursor-pointer hover:bg-gray-50 rounded-xl px-4 py-3 -mx-4 -my-3 transition-colors"
                        >
                          <p className="text-base font-semibold text-gray-900">{origin?.name || originQuery || 'Set origin'}</p>
                          {origin?.address?.full && (
                            <p className="text-sm text-gray-500 mt-1">{origin.address.full}</p>
                          )}
                        </div>
                      )}
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <div className="flex items-center justify-center -my-2">
                        <button
                          onClick={handleSwap}
                          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all shadow-sm z-10"
                          title="Swap origin and destination"
                        >
                          <ArrowUpDown className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>

                      {/* Route Line Visual */}
                      <div className="flex items-center space-x-4 ml-5 -my-2">
                        <div className="w-0.5 h-10 bg-gradient-to-b from-blue-400 to-red-400"></div>
                      </div>

                      {/* Destination */}
                      <div className="relative">
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <div className="w-4 h-4 rounded-full bg-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</p>
                            {editingDestination ? (
                              <div className="relative">
                                <input
                                  ref={destinationInputRef}
                                  type="text"
                                  value={destinationQuery}
                                  onChange={(e) => {
                                    setDestinationQuery(e.target.value);
                                    handleSearch(e.target.value, 'destination');
                                  }}
                                  onFocus={() => {
                                    setEditingDestination(true);
                                    setShowDestinationSuggestions(true);
                                    if (destinationQuery) {
                                      handleSearch(destinationQuery, 'destination');
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setShowDestinationSuggestions(false);
                                    }, 200);
                                  }}
                                  placeholder="Enter destination"
                                  className="w-full text-base font-semibold text-gray-900 border-2 border-red-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  autoFocus
                                />
                                {showDestinationSuggestions && (destinationSuggestions.length > 0 || isSearchingDestination) && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50">
                                    {isSearchingDestination ? (
                                      <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                    ) : (
                                      <>
                                        {onGetCurrentLocation && (
                                          <button
                                            onClick={() => {
                                              if (onGetCurrentLocation) {
                                                onGetCurrentLocation('destination');
                                                setEditingDestination(false);
                                                setShowDestinationSuggestions(false);
                                              }
                                            }}
                                            className="w-full p-3 hover:bg-gray-50 flex items-center space-x-3 text-left border-b border-gray-100"
                                          >
                                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                              <Target className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">Use current location</p>
                                              <p className="text-xs text-gray-500">Set as destination</p>
                                            </div>
                                          </button>
                                        )}
                                        {destinationSuggestions.map((location, index) => (
                                          <button
                                            key={index}
                                            onClick={() => handleLocationSelect(location, 'destination')}
                                            className="w-full p-3 hover:bg-gray-50 flex items-start space-x-3 text-left"
                                          >
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">{location.name}</p>
                                              <p className="text-xs text-gray-500 truncate">{location.address?.full || location.address?.freeformAddress}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingDestination(true);
                            setTimeout(() => destinationInputRef.current?.focus(), 100);
                          }}
                          className="cursor-pointer hover:bg-gray-50 rounded-xl px-4 py-3 -mx-4 -my-3 transition-colors"
                        >
                          <p className="text-base font-semibold text-gray-900">{destination.name || destinationQuery || 'Destination'}</p>
                          {destination.address?.full && (
                            <p className="text-sm text-gray-500 mt-1">{destination.address.full}</p>
                          )}
                        </div>
                      )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Route Steps Preview */}
                    {currentRoute?.steps && currentRoute.steps.length > 0 && (
                      <div className="px-4 py-3 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Route Preview</h4>
                        <div className="space-y-2">
                          {currentRoute.steps.slice(0, 5).map((step, index) => (
                            <div key={index} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-semibold text-blue-600">{index + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">{step.instruction}</p>
                                {step.distance && (
                                  <p className="text-xs text-gray-500 mt-0.5">{step.distance}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {currentRoute.steps.length > 5 && (
                            <p className="text-xs text-gray-500 text-center mt-2">
                              +{currentRoute.steps.length - 5} more steps
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                {/* Action Buttons - Fixed Footer */}
                <div className="border-t border-gray-200 bg-white p-4 safe-area-bottom">
                  <div className="flex flex-col space-y-2">
                    {/* Primary Action */}
                    <button
                      onClick={onStartNavigation}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 px-4 font-semibold flex items-center justify-center space-x-2 shadow-lg active:scale-[0.98] transition-all"
                    >
                      <Navigation className="w-5 h-5" />
                      <span>Start Navigation</span>
                    </button>

                    {/* Secondary Actions - Horizontal */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={onStartSimulation}
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl py-3.5 px-4 font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl active:scale-[0.98] transition-all transform hover:scale-[1.02]"
                      >
                        <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                          <Play className="w-3 h-3 fill-white" />
                        </div>
                        <span className="text-sm font-semibold">Simulate</span>
                      </button>
                      {hasMultipleRoutes && (
                        <button
                          onClick={() => {/* Show route alternatives modal */}}
                          className="flex-1 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl py-3 px-4 font-medium flex items-center justify-center space-x-2 active:scale-[0.98] transition-all"
                        >
                          <Layers className="w-4 h-4" />
                          <span className="text-sm">Alternatives</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div 
            className="fixed inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 10001 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className={`bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden pointer-events-auto transform transition-all duration-300 ${
                isMinimized ? 'max-h-32' : 'max-h-[90vh]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Gradient */}
              <div className="relative bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isMinimized ? (
                      <div className="flex items-center space-x-3">
                        <Route className="w-6 h-6 text-white" />
                        <div>
                          <p className="text-base font-semibold text-white">
                            {origin?.name || 'Origin'} → {destination?.name || 'Destination'}
                          </p>
                          {currentRoute && (
                            <p className="text-sm text-white/80 mt-0.5">
                              {formatDuration(currentRoute?.estimated_duration_minutes)} • {formatDistance(currentRoute?.distance_km)}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                          <Route className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h1 className="text-2xl font-bold text-white">Directions</h1>
                          <p className="text-sm text-white/90 mt-0.5">
                            {origin?.name || 'Set origin'} → {destination?.name || 'Destination'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {hasMultipleRoutes && !isMinimized && (
                      <button
                        onClick={() => {/* Show route alternatives */}}
                        className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                        title="View alternatives"
                      >
                        <Layers className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={onToggleMinimize}
                      className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                      title={isMinimized ? "Expand" : "Minimize"}
                    >
                      {isMinimized ? <ChevronUp className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={onClose}
                      className="p-2.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                      title="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Content - Only show when expanded */}
              {!isMinimized && (
                <>
                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto">
                    {/* Route Summary Cards */}
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-blue-100">
                      {isLoadingRoute || !currentRoute ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                            <div className="flex items-center space-x-2 mb-2">
                              <Clock className="w-5 h-5 text-blue-600" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duration</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-400 animate-pulse">Calculating...</p>
                          </div>
                          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                            <div className="flex items-center space-x-2 mb-2">
                              <Car className="w-5 h-5 text-blue-600" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distance</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-400 animate-pulse">Calculating...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Duration Card */}
                          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                            <div className="flex items-center space-x-2 mb-2">
                              <Clock className="w-5 h-5 text-blue-600" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Duration</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">
                              {formatDuration(currentRoute?.estimated_duration_minutes)}
                            </p>
                          </div>

                          {/* Distance Card */}
                          <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100 hover:shadow-md transition-shadow">
                            <div className="flex items-center space-x-2 mb-2">
                              <Car className="w-5 h-5 text-blue-600" />
                              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Distance</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">
                              {formatDistance(currentRoute?.distance_km)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Traffic Status */}
                      {routeTrafficData && (
                        <div className={`mt-4 rounded-xl p-4 border ${getTrafficColor(routeTrafficData.condition)}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {getTrafficIcon(routeTrafficData.condition)}
                              <span className="text-sm font-semibold capitalize">
                                {routeTrafficData.condition || 'Normal'} Traffic
                              </span>
                            </div>
                            {routeTrafficData.avgSpeed && (
                              <span className="text-sm font-medium text-gray-700">
                                {Math.round(routeTrafficData.avgSpeed)} km/h avg
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Route Options */}
                    {hasRoutes && (
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          {hasMultipleRoutes ? 'Route Options' : 'Route'}
                        </h3>
                        <div className="space-y-3">
                          {routes.map((route, index) => {
                            const isSelected = selectedRoute && (
                              selectedRoute.route_id === route.route_id ||
                              selectedRoute === route ||
                              (selectedRoute.route_id === undefined && route.route_id === undefined && index === selectedRouteIndex)
                            ) || (!selectedRoute && index === selectedRouteIndex);
                            
                            return (
                              <button
                                key={route.route_id || index}
                                onClick={() => {
                                  setSelectedRouteIndex(index);
                                  if (onSelectRoute) {
                                    onSelectRoute(route);
                                  }
                                }}
                                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50 shadow-md'
                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4 flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      <span className="text-sm font-bold">
                                        {index + 1}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-base font-semibold text-gray-900 mb-1">
                                        {route.route_name || `Route ${index + 1}`}
                                      </p>
                                      <div className="flex items-center space-x-3">
                                        <p className="text-sm text-gray-600">
                                          {formatDuration(route.estimated_duration_minutes)} • {formatDistance(route.distance_km)}
                                        </p>
                                        {route.traffic_conditions && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTrafficColor(route.traffic_conditions)}`}>
                                            {route.traffic_conditions}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Origin & Destination */}
                    <div className="p-6 space-y-4">
                      {/* Origin */}
                      <div className="relative">
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <div className="w-4 h-4 rounded-full bg-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">From</p>
                            {editingOrigin ? (
                              <div className="relative">
                                <input
                                  ref={originInputRef}
                                  type="text"
                                  value={originQuery}
                                  onChange={(e) => {
                                    setOriginQuery(e.target.value);
                                    handleSearch(e.target.value, 'origin');
                                  }}
                                  onFocus={() => {
                                    setEditingOrigin(true);
                                    setShowOriginSuggestions(true);
                                    if (originQuery) {
                                      handleSearch(originQuery, 'origin');
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setShowOriginSuggestions(false);
                                    }, 200);
                                  }}
                                  placeholder="Enter origin"
                                  className="w-full text-base font-semibold text-gray-900 border-2 border-blue-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                {showOriginSuggestions && (originSuggestions.length > 0 || isSearchingOrigin) && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50">
                                    {isSearchingOrigin ? (
                                      <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                    ) : (
                                      <>
                                        {onGetCurrentLocation && (
                                          <button
                                            onClick={() => {
                                              if (onGetCurrentLocation) {
                                                onGetCurrentLocation('origin');
                                                setEditingOrigin(false);
                                                setShowOriginSuggestions(false);
                                              }
                                            }}
                                            className="w-full p-3 hover:bg-gray-50 flex items-center space-x-3 text-left border-b border-gray-100"
                                          >
                                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                              <Target className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">Use current location</p>
                                              <p className="text-xs text-gray-500">Set as origin</p>
                                            </div>
                                          </button>
                                        )}
                                        {originSuggestions.map((location, index) => (
                                          <button
                                            key={index}
                                            onClick={() => handleLocationSelect(location, 'origin')}
                                            className="w-full p-3 hover:bg-gray-50 flex items-start space-x-3 text-left"
                                          >
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">{location.name}</p>
                                              <p className="text-xs text-gray-500 truncate">{location.address?.full || location.address?.freeformAddress}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingOrigin(true);
                                  setTimeout(() => originInputRef.current?.focus(), 100);
                                }}
                                className="cursor-pointer hover:bg-gray-50 rounded-xl px-4 py-3 -mx-4 -my-3 transition-colors"
                              >
                                <p className="text-base font-semibold text-gray-900">{origin?.name || originQuery || 'Set origin'}</p>
                                {origin?.address?.full && (
                                  <p className="text-sm text-gray-500 mt-1">{origin.address.full}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <div className="flex items-center justify-center -my-2">
                        <button
                          onClick={handleSwap}
                          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all shadow-sm z-10"
                          title="Swap origin and destination"
                        >
                          <ArrowUpDown className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>

                      {/* Route Line Visual */}
                      <div className="flex items-center space-x-4 ml-5 -my-2">
                        <div className="w-0.5 h-10 bg-gradient-to-b from-blue-400 to-red-400"></div>
                      </div>

                      {/* Destination */}
                      <div className="relative">
                        <div className="flex items-start space-x-4">
                          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <div className="w-4 h-4 rounded-full bg-white"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">To</p>
                            {editingDestination ? (
                              <div className="relative">
                                <input
                                  ref={destinationInputRef}
                                  type="text"
                                  value={destinationQuery}
                                  onChange={(e) => {
                                    setDestinationQuery(e.target.value);
                                    handleSearch(e.target.value, 'destination');
                                  }}
                                  onFocus={() => {
                                    setEditingDestination(true);
                                    setShowDestinationSuggestions(true);
                                    if (destinationQuery) {
                                      handleSearch(destinationQuery, 'destination');
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setShowDestinationSuggestions(false);
                                    }, 200);
                                  }}
                                  placeholder="Enter destination"
                                  className="w-full text-base font-semibold text-gray-900 border-2 border-red-500 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                                  autoFocus
                                />
                                {showDestinationSuggestions && (destinationSuggestions.length > 0 || isSearchingDestination) && (
                                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50">
                                    {isSearchingDestination ? (
                                      <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                    ) : (
                                      <>
                                        {onGetCurrentLocation && (
                                          <button
                                            onClick={() => {
                                              if (onGetCurrentLocation) {
                                                onGetCurrentLocation('destination');
                                                setEditingDestination(false);
                                                setShowDestinationSuggestions(false);
                                              }
                                            }}
                                            className="w-full p-3 hover:bg-gray-50 flex items-center space-x-3 text-left border-b border-gray-100"
                                          >
                                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                                              <Target className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                              <p className="text-sm font-semibold text-gray-900">Use current location</p>
                                              <p className="text-xs text-gray-500">Set as destination</p>
                                            </div>
                                          </button>
                                        )}
                                        {destinationSuggestions.map((location, index) => (
                                          <button
                                            key={index}
                                            onClick={() => handleLocationSelect(location, 'destination')}
                                            className="w-full p-3 hover:bg-gray-50 flex items-start space-x-3 text-left"
                                          >
                                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">{location.name}</p>
                                              <p className="text-xs text-gray-500 truncate">{location.address?.full || location.address?.freeformAddress}</p>
                                            </div>
                                          </button>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingDestination(true);
                                  setTimeout(() => destinationInputRef.current?.focus(), 100);
                                }}
                                className="cursor-pointer hover:bg-gray-50 rounded-xl px-4 py-3 -mx-4 -my-3 transition-colors"
                              >
                                <p className="text-base font-semibold text-gray-900">{destination.name || destinationQuery || 'Destination'}</p>
                                {destination.address?.full && (
                                  <p className="text-sm text-gray-500 mt-1">{destination.address.full}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Route Steps Preview */}
                    {currentRoute?.steps && currentRoute.steps.length > 0 && (
                      <div className="px-6 py-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Route Preview</h4>
                        <div className="space-y-2">
                          {currentRoute.steps.slice(0, 5).map((step, index) => (
                            <div key={index} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-semibold text-blue-600">{index + 1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900">{step.instruction}</p>
                                {step.distance && (
                                  <p className="text-xs text-gray-500 mt-0.5">{step.distance}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          {currentRoute.steps.length > 5 && (
                            <p className="text-xs text-gray-500 text-center mt-2">
                              +{currentRoute.steps.length - 5} more steps
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Fixed Footer */}
                  <div className="border-t border-gray-200 bg-white p-6">
                    <div className="flex items-center space-x-3">
                      {/* Primary Action */}
                      <button
                        onClick={onStartNavigation}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-4 px-6 font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Navigation className="w-5 h-5" />
                        <span>Start Navigation</span>
                      </button>

                      {/* Secondary Actions */}
                      <button
                        onClick={onStartSimulation}
                        className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                          <Play className="w-4 h-4 fill-white" />
                        </div>
                        <span>Simulate</span>
                      </button>
                      {hasMultipleRoutes && (
                        <button
                          onClick={() => {/* Show route alternatives modal */}}
                          className="px-6 py-4 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                          <Layers className="w-5 h-5" />
                          <span>Alternatives</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
      )}
    </>
  );

  if (!document.body) {
    return null;
  }
  
  return createPortal(panelContent, document.body);
};

export default DirectionsPanel;
