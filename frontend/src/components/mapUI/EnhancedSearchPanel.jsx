import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Menu, X, History, MapPin, Zap, RefreshCw, Search, Building } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import enhancedGeocodingService from '../../services/enhancedGeocodingService';
import geoapifyService from '../../services/geoapifyService';

/**
 * Enhanced Search Panel Component
 * Handles origin and destination search with autocomplete, suggestions, and recent searches
 * 
 * Mobile Responsive Features:
 * - Responsive positioning (full-width on mobile, adjusted for side panels on larger screens)
 * - Touch-friendly buttons with minimum 44px touch targets
 * - Optimized padding and spacing for mobile screens
 * - Safe area insets support for notched devices
 * - Smooth scrolling with -webkit-overflow-scrolling: touch
 * - Responsive text sizes and icon sizes
 * - Active states for better touch feedback
 */
const EnhancedSearchPanel = ({
  selectedOrigin,
  selectedDestination,
  originQuery,
  destinationQuery,
  onOriginChange,
  onDestinationChange,
  onOriginSelect,
  onDestinationSelect,
  onGetCurrentLocation,
  onShowSmartRoutePanel,
  onToggleSidePanel,
  isLoadingRoute,
  isSimulating,
  showSidePanel,
  showHistoryPanel,
  isNavigationActive,
  searchBarVisible,
  recentSearches = [],
  lasPinasSuggestions = [],
  onSearchPanelRef,
  onShowPlaceInfo = null, // New callback to show place info panel
  onSearchResultsChange = null // Callback to pass search results to parent for map display
}) => {
  const { isDarkMode } = useDarkMode();
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchMode, setSearchMode] = useState('destination');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchPanelRef = useRef(null);
  // Track small screens to adjust layout when sidebar is open
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const SIDEBAR_MOBILE_WIDTH = 700; // px, approximate sidebar width on mobile (wider for tighter shrink)
  
  // Expose ref to parent if needed
  useEffect(() => {
    if (typeof onSearchPanelRef === 'function') {
      onSearchPanelRef(searchPanelRef);
    }
  }, []);

  // Listen for resize to detect small screen
  useEffect(() => {
    const handleResize = () => {
      try {
        setIsSmallScreen(window.innerWidth < 640); // Tailwind sm breakpoint
      } catch (_) {}
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle clicks outside search panel to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchPanelRef.current &&
        !searchPanelRef.current.contains(event.target) &&
        showSearchResults
      ) {
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

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSearchResults]);

  // Prevent body scroll when dropdown is open on mobile
  useEffect(() => {
    if (showSearchResults) {
      // Save current scroll position
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      
      // Prevent body scroll on mobile
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPosition = window.getComputedStyle(document.body).position;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        // Restore body scroll
        document.body.style.overflow = originalStyle;
        document.body.style.position = originalPosition;
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showSearchResults]);

  const handleSearch = useCallback(async (query, mode = searchMode) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      setShowSearchResults(showSuggestions);
      // Clear search results on map
      if (onSearchResultsChange) {
        onSearchResultsChange([]);
      }
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Faster debounce for autocomplete - allow single character queries
    // Shorter debounce for longer queries (user is typing fast)
    const debounceTime = query.length >= 3 ? 100 : query.length >= 2 ? 150 : 200;

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
        
        // Use Geoapify autocomplete API directly for better autocomplete experience
        // This provides faster, more accurate results for single character queries
        const autocompleteResult = await geoapifyService.autocompletePlaces(query, {
          limit: 20,
          countrySet: 'PH',
          lat: lasPinasCenter.lat,
          lng: lasPinasCenter.lng,
          radius: 15000
        });

        // Transform Geoapify results to our format
        const geoapifyResults = (autocompleteResult.results || []).map(result => {
          const name = result.poi?.name || result.address?.freeformAddress || 'Unknown Location';
          const address = result.address || {};
          
          // Determine if it's a POI/business (use Building icon) or address (use MapPin)
          const isPOI = result.poi !== null && result.poi !== undefined;
          const resultType = result.type || (isPOI ? 'POI' : 'address');
          
          // Format address like Geoapify example: "City, Province, Postal Code, Country"
          const addressParts = [];
          if (address.municipality) addressParts.push(address.municipality);
          if (address.countrySubdivision && !addressParts.includes(address.countrySubdivision)) {
            addressParts.push(address.countrySubdivision);
          }
          if (address.postalCode) addressParts.push(address.postalCode);
          if (address.country && address.country !== 'Philippines') {
            addressParts.push(address.country);
          }
          const formattedAddress = addressParts.join(', ') || address.freeformAddress || '';
          
          // Check if it's in Las Piñas
          const isLasPinas = address.municipality?.toLowerCase().includes('las piñas') ||
                            address.municipality?.toLowerCase().includes('las pinas') ||
                            address.countrySubdivision?.toLowerCase().includes('las piñas') ||
                            name.toLowerCase().includes('las pinas') ||
                            name.toLowerCase().includes('las piñas');
          
          return {
            name: name,
            lat: result.position?.lat || result.position?.latitude,
            lng: result.position?.lon || result.position?.longitude,
            address: {
              full: formattedAddress,
              municipality: address.municipality || '',
              countrySubdivision: address.countrySubdivision || '',
              postalCode: address.postalCode || '',
              country: address.country || 'Philippines',
              streetName: address.streetName || '',
              freeformAddress: address.freeformAddress || formattedAddress
            },
            type: resultType,
            isPOI: isPOI,
            isPriority: isLasPinas,
            poi: result.poi,
            score: result.score || 0
          };
        });

        // Also get results from enhancedGeocodingService for local database results
        const enhancedResults = await enhancedGeocodingService.searchLocations(query, {
          limit: 10,
          countrySet: 'PH',
          center: lasPinasCenter,
          radius: 15000
        }).catch(() => []);

        // Combine and prioritize results
        const allResults = [...geoapifyResults, ...(enhancedResults || [])];

        // Match recent searches
        const matchingRecent = recentSearches.filter(recent =>
          recent.name.toLowerCase().includes(query.toLowerCase()) ||
          recent.address?.full?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 2);

        // Prioritize Las Piñas results
        const lasPinasResults = allResults.filter(result => 
          result.isLocal ||
          result.isPriority ||
          result.address?.municipality?.toLowerCase().includes('las piñas') ||
          result.address?.municipality?.toLowerCase().includes('las pinas') ||
          result.address?.countrySubdivision?.toLowerCase().includes('las piñas') ||
          result.name?.toLowerCase().includes('las pinas') ||
          result.name?.toLowerCase().includes('las piñas')
        );

        // Nearby cities results
        const nearbyResults = allResults.filter(result => 
          !lasPinasResults.some(lp => lp.name === result.name && lp.lat === result.lat) &&
          (result.address?.municipality?.toLowerCase().includes('parañaque') ||
           result.address?.municipality?.toLowerCase().includes('paranaque') ||
           result.address?.municipality?.toLowerCase().includes('muntinlupa') ||
           result.address?.municipality?.toLowerCase().includes('bacoor') ||
           result.address?.municipality?.toLowerCase().includes('cavite'))
        );

        // Other results (not Las Piñas or nearby cities)
        const otherResults = allResults.filter(result => 
          !lasPinasResults.some(lp => lp.name === result.name && lp.lat === result.lat) &&
          !nearbyResults.some(nr => nr.name === result.name && nr.lat === result.lat)
        );

        // Combine and deduplicate results, sort by priority and score
        // Show all results, but prioritize Las Piñas and nearby cities
        const combinedResults = [
          ...matchingRecent.map(recent => ({ ...recent, isRecent: true })),
          ...lasPinasResults.slice(0, 10).map(result => ({ ...result, isPriority: true })),
          ...nearbyResults.slice(0, 5),
          ...otherResults.slice(0, 10) // Show other results too
        ]
        .filter((result, index, self) =>
          index === self.findIndex(r => 
            r.name === result.name && 
            Math.abs((r.lat || 0) - (result.lat || 0)) < 0.0001 &&
            Math.abs((r.lng || 0) - (result.lng || 0)) < 0.0001
          )
        )
        .sort((a, b) => {
          // Sort by: recent first, then priority (Las Piñas), then score
          if (a.isRecent && !b.isRecent) return -1;
          if (!a.isRecent && b.isRecent) return 1;
          if (a.isPriority && !b.isPriority) return -1;
          if (!a.isPriority && b.isPriority) return 1;
          return (b.score || 0) - (a.score || 0);
        });

        setSearchResults(combinedResults);
        
        // Pass search results to parent for map display
        if (onSearchResultsChange) {
          onSearchResultsChange(combinedResults);
        }
      } catch (error) {
        setSearchResults([]);
        // Clear search results on map on error
        if (onSearchResultsChange) {
          onSearchResultsChange([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, debounceTime);
  }, [recentSearches, searchMode, showSuggestions, onSearchResultsChange]);

  const handleLocationSelect = (location, mode = searchMode) => {
    // Always show place info panel if callback is provided (Google Maps style)
    if (onShowPlaceInfo && typeof onShowPlaceInfo === 'function') {
      // Ensure location has all required properties
      const locationWithDefaults = {
        ...location,
        name: location.name || 'Unknown Location',
        lat: location.lat || location.latitude || null,
        lng: location.lng || location.longitude || null,
        address: location.address || { 
          full: location.address?.full || location.name || 'Address not available',
          city: location.address?.city || location.address?.municipality || '',
          country: location.address?.country || 'Philippines'
        },
        type: location.type || location.category || 'Location'
      };
      
      // Always call the callback to show place info
      onShowPlaceInfo(locationWithDefaults);
      setShowSearchResults(false);
      setShowSuggestions(false);
      return;
    }
    
    // Fallback: directly select the location (legacy behavior)
    const targetMode = mode || searchMode;
    if (targetMode === 'origin') {
      onOriginSelect(location);
    } else {
      onDestinationSelect(location);
    }
    setShowSearchResults(false);
    setShowSuggestions(false);
  };

  // Get current search query value
  const currentQuery = originQuery || destinationQuery || '';

  return (
    <div 
      className={`absolute transition-all duration-300 ease-out ${
        showSidePanel
          ? 'left-0 right-0 sm:left-80 sm:right-4 md:left-96 md:right-6'
          : (showHistoryPanel
            ? 'left-0 right-0 sm:left-72 sm:right-4 md:left-80 md:right-6'
            : 'left-2 right-2 sm:left-4 sm:right-4 md:left-6 md:right-6')
      } top-2 sm:top-3 md:top-4 ${
        isNavigationActive && !searchBarVisible
          ? 'opacity-0 pointer-events-none translate-y-[-100%]'
          : 'opacity-100 translate-y-0'
      }`} 
      style={{ 
        zIndex: 1000,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        // On small screens, when the sidebar is open, shift and shrink the bar
        ...(showSidePanel && isSmallScreen
          ? { 
              left: `${SIDEBAR_MOBILE_WIDTH}px`, 
              right: '6px',
              maxWidth: `calc(100vw - ${SIDEBAR_MOBILE_WIDTH + 12}px)` 
            }
          : {})
      }}
    >
      <div className="flex items-center justify-center space-x-1.5 sm:space-x-2 max-w-4xl mx-auto">
        {/* Hamburger Menu - Positioned separately */}
        {onToggleSidePanel && (
          <button
            onClick={onToggleSidePanel}
            className={`rounded-full p-2 sm:p-2.5 flex-shrink-0 shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center z-50 border touch-manipulation ${
              isDarkMode
                ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 active:bg-gray-600'
                : 'bg-white hover:bg-gray-50 border-gray-300 active:bg-gray-100'
            }`}
            style={{ zIndex: 1001 }}
            title="Menu"
            aria-label="Toggle menu"
          >
            <Menu className={`w-5 h-5 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
          </button>
        )}

        {/* Google Maps Style - Single Search Bar - Normal/Standard */}
        <div ref={searchPanelRef} className={`flex-1 rounded-lg sm:rounded-lg shadow-md border overflow-visible transition-all duration-200 relative ${
          isDarkMode
            ? 'bg-gray-800 border-gray-700'
            : 'bg-gray-100 border-gray-300'
        }`}>
          <div className="flex items-center px-3 py-2 sm:px-4 sm:py-2.5">
            {/* Search Icon */}
            <Search className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mr-2 sm:mr-3 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`} />
            
            {/* Single Search Input - Google Maps Style */}
            <input
              type="text"
              placeholder="Search for places..."
              value={currentQuery}
              onChange={(e) => {
                const query = e.target.value;
                // Update both queries for compatibility
                onOriginChange(query);
                onDestinationChange(query);
                setShowSuggestions(false);
                handleSearch(query, 'destination');
              }}
              onFocus={() => {
                setSearchMode('destination');
                setShowSuggestions(true);
                setShowSearchResults(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              className={`flex-1 text-sm sm:text-base bg-transparent focus:outline-none min-w-0 ${
                isDarkMode
                  ? 'text-gray-100 placeholder-gray-500'
                  : 'text-gray-900 placeholder-gray-500'
              }`}
            />
            
            {/* Clear Button - X icon like Google Maps */}
            {currentQuery && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOriginSelect(null);
                  onDestinationSelect(null);
                  onOriginChange('');
                  onDestinationChange('');
                  setShowSearchResults(false);
                  setShowSuggestions(false);
                }}
                className={`p-1 sm:p-1.5 rounded-full transition-colors flex-shrink-0 ml-1 touch-manipulation active:scale-95 ${
                  isDarkMode
                    ? 'hover:bg-gray-700 active:bg-gray-600'
                    : 'hover:bg-gray-100 active:bg-gray-200'
                }`}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            )}
          </div>

          {/* Search Results Dropdown - Google Maps Style - Mobile Responsive */}
          {showSearchResults && (
            <div 
              className={`absolute top-full left-0 right-0 mt-1 sm:mt-2 rounded-xl sm:rounded-2xl shadow-2xl border overflow-hidden z-[9999] ${
                isDarkMode
                  ? 'bg-gray-900/98 backdrop-blur-md border-gray-600'
                  : 'bg-white border-gray-200'
              }`}
              style={{
                maxHeight: 'min(calc(100vh - 120px), calc(100dvh - 120px), 70vh)',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                position: 'absolute',
                willChange: 'transform'
              }}
            >
              <div 
                className="overflow-y-auto overflow-x-hidden h-full"
                style={{
                  maxHeight: 'min(calc(100vh - 120px), calc(100dvh - 120px), 70vh)',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain'
                }}
              >

              {/* Las Piñas Suggestions */}
              {showSuggestions && !currentQuery && (
                <div className={`px-2 sm:px-3 py-2 border-b ${
                  isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-2 px-2 flex items-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <MapPin className={`w-3 h-3 mr-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    Popular Places in Las Piñas City
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-1.5">
                    {lasPinasSuggestions.map((suggestion, index) => {
                      return (
                      <button
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
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
                          handleLocationSelect(location, 'destination');
                        }}
                        className={`w-full min-h-[52px] sm:min-h-[56px] flex items-center space-x-2 sm:space-x-2.5 px-2.5 sm:px-2.5 py-2 rounded-lg transition-all duration-150 text-left group border active:scale-[0.97] touch-manipulation ${
                          isDarkMode
                            ? 'bg-gray-800/90 border-gray-600 active:bg-gray-700 active:border-gray-500'
                            : 'bg-white border-gray-100 active:bg-gray-50 active:border-gray-200'
                        }`}
                      >
                        {/* Icon without circular background - Google Maps style */}
                        <div className={`text-lg sm:text-xl flex-shrink-0 leading-none ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {suggestion.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{suggestion.name}</p>
                          <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{suggestion.category} • Las Piñas City</p>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className={`px-2 sm:px-3 py-2 border-b ${
                  isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-2 px-2 flex items-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <History className={`w-3 h-3 mr-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    Recent Searches
                  </div>
                  <div className="space-y-0.5">
                    {recentSearches.slice(0, 3).map((recent, index) => {
                      return (
                      <button
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLocationSelect(recent, 'destination');
                        }}
                        className={`w-full min-h-[52px] sm:min-h-[56px] flex items-center space-x-2 sm:space-x-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left group border active:scale-[0.97] touch-manipulation ${
                          isDarkMode
                            ? 'bg-gray-800/90 border-gray-600 active:bg-gray-700 active:border-gray-500'
                            : 'bg-white border-gray-100 active:bg-gray-50 active:border-gray-200'
                        }`}
                      >
                        {/* Icon without circular background - Google Maps style */}
                        <div className="flex-shrink-0">
                          <History className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{recent.name}</p>
                          {recent.address?.full && (
                            <p className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{recent.address.full}</p>
                          )}
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isSearching && currentQuery && (
                <div className="px-2 sm:px-3 py-4 flex items-center justify-center">
                  <div className={`flex items-center space-x-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    <div className={`w-4 h-4 border-2 rounded-full animate-spin ${
                      isDarkMode ? 'border-gray-600 border-t-blue-500' : 'border-gray-300 border-t-blue-500'
                    }`}></div>
                    <span className="text-xs sm:text-sm">Searching places...</span>
                  </div>
                </div>
              )}

              {/* No Results Message */}
              {!isSearching && currentQuery && searchResults.length === 0 && (
                <div className="px-2 sm:px-3 py-4 text-center">
                  <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No places found</p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Try a different search term</p>
                </div>
              )}

              {/* Search Results */}
              {!isSearching && searchResults.filter(result => !result.isRecent).length > 0 && (
                <div className="px-2 sm:px-3 py-2">
                  <div className={`text-xs font-semibold uppercase tracking-wide mb-2 px-2 flex items-center ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    <MapPin className={`w-3 h-3 mr-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
                    {searchResults.some(r => r.isPriority) ? 'Las Piñas & Nearby' : 'Search Results'}
                  </div>
                  <div className="space-y-0.5">
                    {searchResults.filter(result => !result.isRecent).map((result, index) => {
                      // Format address like Geoapify: City, Province, Postal Code, Country
                      const formatAddress = (address) => {
                        if (address.full) return address.full;
                        const parts = [];
                        if (address.municipality) parts.push(address.municipality);
                        if (address.countrySubdivision && !parts.includes(address.countrySubdivision)) {
                          parts.push(address.countrySubdivision);
                        }
                        if (address.postalCode) parts.push(address.postalCode);
                        if (address.country && address.country !== 'Philippines') {
                          parts.push(address.country);
                        }
                        return parts.length > 0 ? parts.join(', ') : address.freeformAddress || '';
                      };
                      
                      const formattedAddress = result.address ? formatAddress(result.address) : '';
                      const isPOI = result.isPOI || result.type === 'POI' || result.poi;
                      
                      return (
                      <button
                        key={index}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLocationSelect(result, 'destination');
                        }}
                        className={`w-full min-h-[52px] sm:min-h-[56px] flex items-center space-x-2 sm:space-x-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left group border active:scale-[0.97] touch-manipulation ${
                          result.isPriority
                            ? isDarkMode
                              ? 'border-blue-600 bg-blue-900/40 active:border-blue-500 active:bg-blue-900/60'
                              : 'border-blue-100 bg-blue-50/20 active:border-blue-200'
                            : isDarkMode
                              ? 'border-gray-600 bg-gray-800/90 active:border-gray-500 active:bg-gray-700'
                              : 'border-gray-100 bg-white active:border-gray-200'
                        }`}
                      >
                        {/* Icon - Building for POIs/businesses, MapPin for addresses (Geoapify style) */}
                        <div className="flex-shrink-0">
                          {isPOI ? (
                            <Building className={`w-4 h-4 sm:w-5 sm:h-5 ${
                              result.isPriority
                                ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                                : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                            }`} />
                          ) : (
                            <MapPin className={`w-4 h-4 sm:w-5 sm:h-5 ${
                              result.isPriority
                                ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                                : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap">
                            <p className={`text-sm font-semibold truncate flex-1 min-w-0 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{result.name}</p>
                            {result.isPriority && (
                              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] sm:text-xs rounded-full font-medium flex-shrink-0">
                                Las Piñas
                              </span>
                            )}
                          </div>
                          {formattedAddress && (
                            <p className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formattedAddress}</p>
                          )}
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedSearchPanel;

