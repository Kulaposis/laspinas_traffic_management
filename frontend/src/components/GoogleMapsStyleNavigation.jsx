import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Share2, 
  Bookmark,
  X,
  ChevronDown,
  ChevronUp,
  Car,
  Bike,
  Footprints,
  Bus,
  MoreHorizontal,
  Settings,
  Search,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import enhancedGeocodingService from '../services/enhancedGeocodingService';

/**
 * GoogleMapsStyleNavigation - Modern navigation UI inspired by Google Maps
 * Mobile-first, responsive design with bottom sheet and floating cards
 */
const GoogleMapsStyleNavigation = ({
  origin = "Your location",
  destination = "Maple Grove Rainwater Park",
  routes = [
    { duration: 36, distance: "11 km", arrivalTime: "2:01 PM", label: "Best route, despite much heavier traffic than usual", isBest: true, hasRestrictions: true },
    { duration: 34, distance: "9.5 km", arrivalTime: "1:59 PM", label: "Via highway", isBest: false },
    { duration: 37, distance: "12 km", arrivalTime: "2:02 PM", label: "Scenic route", isBest: false }
  ],
  onStart,
  onSimulate,
  onSave,
  onPredictions, // Callback for traffic predictions
  onClose,
  onModeChange, // Optional callback for mode changes
  minimized: controlledMinimized, // Controlled minimized state from parent
  onMinimizedChange, // Callback when minimized state changes
  onOriginChange, // Callback when origin changes
  onDestinationChange, // Callback when destination changes
  onOriginSelect, // Callback when origin location is selected
  onDestinationSelect, // Callback when destination location is selected
  onRouteSelectIndex // Notify parent when a route option is selected (by index)
}) => {
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [selectedMode, setSelectedMode] = useState('car'); // car, bike, walk, transit
  const [internalMinimized, setInternalMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [originValue, setOriginValue] = useState(origin);
  const [destinationValue, setDestinationValue] = useState(destination);
  
  // Autocomplete states
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const originSuggestionsRef = useRef(null);
  const destinationSuggestionsRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Sync state when props change
  useEffect(() => {
    setOriginValue(origin);
    // Reset internal state when origin is cleared
    if (!origin || origin === 'Your location' || (typeof origin === 'string' && origin.trim() === '')) {
      setOriginValue('');
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
    }
  }, [origin]);
  
  useEffect(() => {
    setDestinationValue(destination);
    // Reset internal state when destination is cleared
    if (!destination || destination === 'Destination' || (typeof destination === 'string' && destination.trim() === '')) {
      setDestinationValue('');
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
    }
  }, [destination]);

  // Reset isClosed state when component receives new props (component reopened)
  // Since component is conditionally rendered, it will be a new instance, but this ensures clean state
  useEffect(() => {
    // If origin and destination are both empty/default, reset closed state
    if ((!origin || origin === 'Your location') && (!destination || destination === 'Destination')) {
      setIsClosed(false);
    }
  }, [origin, destination]);
  
  // Use controlled minimized state if provided, otherwise use internal state
  const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized;
  
  // Handler for minimizing/expanding
  const handleMinimizeToggle = (minimized) => {
    if (controlledMinimized === undefined) {
      setInternalMinimized(minimized);
    }
    if (onMinimizedChange) {
      onMinimizedChange(minimized);
    }
  };

  // Handler for closing the panel - clear all internal state
  const handleClose = () => {
    setIsClosed(true);
    // Clear internal state
    setOriginValue('');
    setDestinationValue('');
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setSelectedRoute(0);
    setAvoidTolls(false);
    setSelectedMode('car');
    setIsBottomSheetExpanded(false);
    // Notify parent to clear state
    if (onClose) {
      onClose();
    }
    // Clear parent's origin and destination
    if (onOriginChange) {
      onOriginChange('');
    }
    if (onDestinationChange) {
      onDestinationChange('');
    }
    if (onOriginSelect) {
      onOriginSelect(null);
    }
    if (onDestinationSelect) {
      onDestinationSelect(null);
    }
  };
  
  // Search handler with debouncing
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
          limit: 20, // Get more results to filter and prioritize
          countrySet: 'PH', // Strictly Philippines only
          center: lasPinasCenter,
          radius: 15000 // Reduced radius to focus more on Las Piñas area (15km)
        });

        let allResults = results || [];
        
        // Filter to ensure Philippines only and prioritize Las Piñas
        allResults = allResults
          .filter(location => {
            // Ensure country is Philippines
            const country = (location.address?.country || '').toLowerCase();
            const countryCode = (location.country || '').toLowerCase();
            if (country && !country.includes('philippines') && !country.includes('ph')) {
              return false;
            }
            if (countryCode && !countryCode.includes('ph')) {
              return false;
            }
            return true;
          })
          .map(location => {
            // Check if result is in Las Piñas City
            const municipality = (location.address?.municipality || '').toLowerCase();
            const countrySubdivision = (location.address?.countrySubdivision || '').toLowerCase();
            const addressFull = (location.address?.full || location.address?.freeformAddress || location.name || '').toLowerCase();
            const isLasPinas = municipality.includes('las piñas') || 
                              municipality.includes('las pinas') ||
                              countrySubdivision.includes('las piñas') ||
                              countrySubdivision.includes('las pinas') ||
                              addressFull.includes('las piñas') ||
                              addressFull.includes('las pinas');
            
            // Calculate distance from Las Piñas center
            const distance = location.distance || (location.lat && location.lng ? 
              Math.sqrt(
                Math.pow((location.lat - lasPinasCenter.lat) * 111, 2) + 
                Math.pow((location.lng - lasPinasCenter.lng) * 111, 2)
              ) : Infinity
            );
            
            return {
              ...location,
              isLasPinas: isLasPinas,
              distance: distance,
              priorityScore: isLasPinas ? 1000 : (distance < 10000 ? 500 - distance : 0) + (location.score || 0)
            };
          })
          .sort((a, b) => {
            // Sort by priority: Las Piñas first, then by distance, then by score
            if (a.isLasPinas && !b.isLasPinas) return -1;
            if (!a.isLasPinas && b.isLasPinas) return 1;
            if (a.isLasPinas && b.isLasPinas) {
              // Both in Las Piñas, sort by distance
              return a.distance - b.distance;
            }
            // Neither in Las Piñas, prioritize closer results
            if (a.distance < 10000 && b.distance >= 10000) return -1;
            if (a.distance >= 10000 && b.distance < 10000) return 1;
            // Both within or both outside 10km, sort by distance then score
            if (Math.abs(a.distance - b.distance) < 1000) {
              return (b.score || 0) - (a.score || 0);
            }
            return a.distance - b.distance;
          })
          .slice(0, 10); // Limit to top 10 results

        if (type === 'origin') {
          setOriginSuggestions(allResults);
          setIsSearchingOrigin(false);
        } else {
          setDestinationSuggestions(allResults);
          setIsSearchingDestination(false);
        }
      } catch (error) {
        console.error('Search error:', error);
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
    const locationName = location.name || location.display_name || location.address?.full || location.address?.freeformAddress || '';
    
    if (type === 'origin') {
      setOriginValue(locationName);
      setShowOriginSuggestions(false);
      if (onOriginSelect) {
        onOriginSelect(location);
      }
    } else {
      setDestinationValue(locationName);
      setShowDestinationSuggestions(false);
      if (onDestinationSelect) {
        onDestinationSelect(location);
      }
    }
  };
  
  // Handle clicks outside suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (originSuggestionsRef.current && !originSuggestionsRef.current.contains(event.target) && 
          originInputRef.current && !originInputRef.current.contains(event.target)) {
        setShowOriginSuggestions(false);
      }
      if (destinationSuggestionsRef.current && !destinationSuggestionsRef.current.contains(event.target) &&
          destinationInputRef.current && !destinationInputRef.current.contains(event.target)) {
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentRoute = routes[selectedRoute];

  // Calculate estimated times for different travel modes based on current route
  const calculateModeTime = (mode) => {
    if (!currentRoute || !currentRoute.duration) return '--';
    
    const baseDuration = currentRoute.duration;
    let multiplier = 1;
    
    switch(mode) {
      case 'car':
        multiplier = 1;
        break;
      case 'bike':
        multiplier = 0.7; // Motorcycles are typically faster in traffic
        break;
      case 'transit':
        multiplier = 1.8; // Public transit is slower than car but faster than walking
        break;
      case 'walk':
        multiplier = 3.5; // Walking is slowest
        break;
      default:
        multiplier = 1;
    }
    
    const estimatedMinutes = Math.round(baseDuration * multiplier);
    
    if (estimatedMinutes >= 60) {
      const hours = Math.floor(estimatedMinutes / 60);
      const mins = estimatedMinutes % 60;
      return `${hours} hr ${mins > 0 ? mins : ''}`.trim();
    }
    return `${estimatedMinutes} min`;
  };

  const travelModes = [
    { id: 'car', icon: Car, label: 'Drive', time: calculateModeTime('car') },
    { id: 'bike', icon: Bike, label: 'Motorcycle', time: calculateModeTime('bike') },
    { id: 'transit', icon: Bus, label: 'Transit', time: calculateModeTime('transit') },
    { id: 'walk', icon: Footprints, label: 'Walk', time: calculateModeTime('walk') }
  ];

  // Handle mode change
  const handleModeChange = (modeId) => {
    setSelectedMode(modeId);
    // Notify parent component if callback provided
    if (onModeChange) {
      onModeChange(modeId);
    }
    console.log(`Travel mode changed to: ${modeId}`);
  };

  // Don't render if closed
  if (isClosed) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {/* Route Duration Labels - REMOVED to avoid clutter on map */}

      {/* Top Destination Card - Compact */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-2 left-2 right-2 z-20 max-w-md mx-auto pointer-events-auto"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200 overflow-hidden relative">
          {/* Origin */}
          <div className="relative">
            <div className="flex items-center px-3 py-2 border-b border-gray-100">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 flex-shrink-0"></div>
              <input
                ref={originInputRef}
                type="text"
                value={originValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setOriginValue(value);
                  if (onOriginChange) {
                    onOriginChange(value);
                  }
                  handleSearch(value, 'origin');
                }}
                onFocus={() => {
                  if (originValue && originValue.length > 0) {
                    handleSearch(originValue, 'origin');
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow click events
                  setTimeout(() => {
                    setShowOriginSuggestions(false);
                  }, 200);
                }}
                className="text-xs text-blue-600 font-medium flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 placeholder:text-blue-400 placeholder:font-normal"
                placeholder="Your location"
              />
              <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            {/* Origin Suggestions Dropdown */}
            <AnimatePresence>
              {showOriginSuggestions && (originSuggestions.length > 0 || isSearchingOrigin) && (
                <motion.div
                  ref={originSuggestionsRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50"
                >
                  {isSearchingOrigin ? (
                    <div className="p-3 text-center text-xs text-gray-500">Searching...</div>
                  ) : (
                    originSuggestions.map((location, index) => (
                      <button
                        key={index}
                        onClick={() => handleLocationSelect(location, 'origin')}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <div className="text-xs font-semibold text-gray-900 truncate">
                                {location.name || location.display_name || location.address?.full || location.address?.freeformAddress || 'Unknown Location'}
                              </div>
                              {location.isLasPinas && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                  Las Piñas
                                </span>
                              )}
                            </div>
                            {location.address && (location.address.full || location.address.freeformAddress) && (
                              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                {location.address.full || location.address.freeformAddress}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Destination */}
          <div className="relative">
            <div className="flex items-center px-3 py-2">
              <MapPin className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
              <input
                ref={destinationInputRef}
                type="text"
                value={destinationValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setDestinationValue(value);
                  if (onDestinationChange) {
                    onDestinationChange(value);
                  }
                  handleSearch(value, 'destination');
                }}
                onFocus={() => {
                  if (destinationValue && destinationValue.length > 0) {
                    handleSearch(destinationValue, 'destination');
                  }
                }}
                onBlur={() => {
                  // Delay hiding suggestions to allow click events
                  setTimeout(() => {
                    setShowDestinationSuggestions(false);
                  }, 200);
                }}
                className="text-xs text-gray-900 font-semibold flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 placeholder:text-gray-400 placeholder:font-normal"
                placeholder="Destination"
              />
              <button 
                onClick={() => {
                  // Trigger route calculation when clicking the navigation button
                  if (onStart && originValue && destinationValue) {
                    onStart({ mode: selectedMode, route: routes[selectedRoute] });
                  }
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Start navigation"
              >
                <Navigation className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            {/* Destination Suggestions Dropdown */}
            <AnimatePresence>
              {showDestinationSuggestions && (destinationSuggestions.length > 0 || isSearchingDestination) && (
                <motion.div
                  ref={destinationSuggestionsRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50"
                >
                  {isSearchingDestination ? (
                    <div className="p-3 text-center text-xs text-gray-500">Searching...</div>
                  ) : (
                    destinationSuggestions.map((location, index) => (
                      <button
                        key={index}
                        onClick={() => handleLocationSelect(location, 'destination')}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <div className="text-xs font-semibold text-gray-900 truncate">
                                {location.name || location.display_name || location.address?.full || location.address?.freeformAddress || 'Unknown Location'}
                              </div>
                              {location.isLasPinas && (
                                <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                                  Las Piñas
                                </span>
                              )}
                            </div>
                            {location.address && (location.address.full || location.address.freeformAddress) && (
                              <div className="text-[10px] text-gray-500 truncate mt-0.5">
                                {location.address.full || location.address.freeformAddress}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Map Controls - Top Right */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2 pointer-events-auto">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="bg-white/95 backdrop-blur-xl p-3 rounded-full shadow-lg hover:shadow-xl transition-all border border-gray-200"
        >
          <Settings className="w-5 h-5 text-gray-700" />
        </motion.button>
      </div>

      {/* Bottom Sheet - Compact Design with Minimize */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: isMinimized ? "calc(100% - 60px)" : 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto"
      >
        <div className="bg-white rounded-t-3xl shadow-2xl max-w-2xl mx-auto overflow-hidden flex flex-col max-h-[60vh] md:max-h-[70vh]">
          {/* Drag Handle with Minimize Button */}
          <div 
            className="flex justify-center items-center pt-2 pb-1 cursor-pointer hover:bg-gray-50 transition-colors relative flex-shrink-0"
            onClick={() => handleMinimizeToggle(!isMinimized)}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
            {isMinimized ? (
              <ChevronUp className="w-4 h-4 text-gray-400 absolute right-3" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3" />
            )}
          </div>

          {/* Minimized View - Show only essential info */}
          {isMinimized ? (
            <div className="px-3 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="text-xl font-bold text-red-500">
                  {(() => {
                    const modeTime = calculateModeTime(selectedMode);
                    const match = modeTime.match(/^(\d+)/);
                    return match ? match[1] : currentRoute.duration;
                  })()}
                  <span className="text-xs ml-1">min</span>
                </div>
                <div className="text-xs text-gray-600">
                  <div className="font-semibold">{currentRoute.distance}</div>
                  <div className="text-[10px] text-gray-500">Arrive {currentRoute.arrivalTime}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart && onStart({ mode: selectedMode, route: routes[selectedRoute] });
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-full shadow-lg text-sm flex items-center space-x-1"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Start</span>
                </motion.button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {/* Travel Mode Header - Compact */}
                <div className="px-3 pb-2 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-gray-900 capitalize">
                      {travelModes.find(m => m.id === selectedMode)?.label || 'Drive'}
                    </h2>
                    <div className="flex items-center space-x-1">
                      <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                        <Share2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        onClick={() => handleMinimizeToggle(true)}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        title="Minimize"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      </button>
                      <button 
                        onClick={() => {
                          handleClose();
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        title="Close"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Travel Mode Tabs - Compact */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
                    {travelModes.map((mode) => {
                      const Icon = mode.icon;
                      const isActive = selectedMode === mode.id;
                      return (
                        <motion.button
                          key={mode.id}
                          onClick={() => handleModeChange(mode.id)}
                          whileTap={{ scale: 0.95 }}
                          className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-lg transition-all flex-shrink-0 min-w-[60px] ${
                            isActive 
                              ? 'bg-blue-50 border-2 border-blue-500' 
                              : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                          <span className={`text-[10px] font-semibold whitespace-nowrap ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
                            {mode.time}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Route Options Toggle - Compact */}
                <button
                  onClick={() => setIsBottomSheetExpanded(!isBottomSheetExpanded)}
                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <span className="text-xs text-gray-600 font-medium">
                    {routes.length} route options
                  </span>
                  {isBottomSheetExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </button>

                {/* Main Route Info - Compact */}
                <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-start space-x-3">
                    {/* Duration Badge - Shows selected mode time */}
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-red-500">
                        {(() => {
                          const modeTime = calculateModeTime(selectedMode);
                          const match = modeTime.match(/^(\d+)/);
                          return match ? match[1] : currentRoute.duration;
                        })()}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        {(() => {
                          const modeTime = calculateModeTime(selectedMode);
                          if (modeTime.includes('hr')) return 'hr';
                          return 'min';
                        })()}
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-gray-900">
                          Arrive {currentRoute.arrivalTime}
                        </span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-xs text-gray-600 truncate">
                          {currentRoute.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {currentRoute.distance}
                        {selectedMode !== 'car' && (
                          <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            via {travelModes.find(m => m.id === selectedMode)?.label.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {currentRoute.hasRestrictions && (
                        <div className="text-[10px] text-gray-500 flex items-start">
                          <span className="mr-1">⚠️</span>
                          <span>Restricted usage or private roads</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Avoid Tolls Toggle - Compact */}
                <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={avoidTolls}
                      onChange={(e) => setAvoidTolls(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-2 text-xs font-medium text-gray-700">Avoid tolls</span>
                  </label>
                </div>

                {/* Expandable Route Alternatives - Compact */}
                <AnimatePresence>
                  {isBottomSheetExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden flex-shrink-0"
                    >
                      <div className="px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
                        {routes.map((route, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedRoute(index);
                              if (onRouteSelectIndex) {
                                onRouteSelectIndex(index);
                              }
                            }}
                            className={`w-full text-left p-2 rounded-lg transition-all ${
                              selectedRoute === index
                                ? 'bg-blue-50 border-2 border-blue-500'
                                : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center space-x-1.5">
                                <span className={`text-sm font-bold ${
                                  selectedRoute === index ? 'text-blue-600' : 'text-gray-900'
                                }`}>
                                  {route.duration} min
                                </span>
                                {route.isBest && (
                                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                                    Best
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500">{route.distance}</span>
                            </div>
                            <p className="text-[10px] text-gray-600 truncate">{route.label}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action Buttons - Sticky at Bottom */}
              <div className="px-3 py-2.5 flex items-center space-x-2 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex-wrap gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onStart && onStart({ mode: selectedMode, route: routes[selectedRoute] })}
                  className="flex-1 min-w-[100px] bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-4 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-1.5"
                >
                  <Navigation className="w-4 h-4" />
                  <span className="text-sm">Start</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSimulate && onSimulate({ mode: selectedMode, route: routes[selectedRoute] })}
                  className="flex-1 min-w-[100px] bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200 flex items-center justify-center space-x-1.5"
                >
                  <Footprints className="w-4 h-4" />
                  <span className="text-sm">Simulate</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPredictions && onPredictions({ mode: selectedMode, route: routes[selectedRoute] })}
                  className="flex-1 min-w-[100px] bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-1.5"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Traffic Prediction</span>
                  <span className="text-sm sm:hidden">Prediction</span>
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSave && onSave({ mode: selectedMode, route: routes[selectedRoute] })}
                  className="flex-1 min-w-[100px] bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 rounded-full shadow-md hover:shadow-lg transition-all border border-gray-200 flex items-center justify-center space-x-1.5"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="text-sm">Save</span>
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GoogleMapsStyleNavigation;

