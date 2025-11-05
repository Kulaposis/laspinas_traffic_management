import React, { useState, useCallback, useRef } from 'react';
import { Search, Target, X, History, MapPin, Zap, Route } from 'lucide-react';
import enhancedGeocodingService from '../../services/enhancedGeocodingService';

/**
 * Search Bar Component
 * Handles origin and destination search with autocomplete
 */
const SearchBar = ({
  originQuery,
  destinationQuery,
  onOriginChange,
  onDestinationChange,
  onOriginSelect,
  onDestinationSelect,
  selectedOrigin,
  selectedDestination,
  onGetCurrentLocation,
  onSwapLocations,
  onGetRoute,
  isLoading,
  showSidePanel,
  showHistoryPanel,
  recentSearches = []
}) => {
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [searchMode, setSearchMode] = useState('destination');
  const searchTimeoutRef = useRef(null);

  const handleOriginSearch = useCallback(async (query) => {
    onOriginChange(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 15,
          countrySet: 'PH',
          center: lasPinasCenter,
          radius: 15000
        });

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

        const matchingRecent = recentSearches.filter(recent =>
          recent.name.toLowerCase().includes(query.toLowerCase()) ||
          recent.address?.full?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 2);

        const combinedResults = [
          ...matchingRecent.map(recent => ({ ...recent, isRecent: true })),
          ...lasPinasResults.slice(0, 8).map(result => ({ ...result, isPriority: true })),
          ...nearbyResults.slice(0, 5)
        ].filter((result, index, self) =>
          index === self.findIndex(r => r.name === result.name)
        );

        setOriginSuggestions(combinedResults);
        setShowOriginSuggestions(true);
      } catch (error) {

      }
    }, 200);
  }, [onOriginChange, recentSearches]);

  const handleDestinationSearch = useCallback(async (query) => {
    onDestinationChange(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length < 2) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const lasPinasCenter = { lat: 14.4504, lng: 121.0170 };
        const results = await enhancedGeocodingService.searchLocations(query, {
          limit: 15,
          countrySet: 'PH',
          center: lasPinasCenter,
          radius: 15000
        });

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

        const matchingRecent = recentSearches.filter(recent =>
          recent.name.toLowerCase().includes(query.toLowerCase()) ||
          recent.address?.full?.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 2);

        const combinedResults = [
          ...matchingRecent.map(recent => ({ ...recent, isRecent: true })),
          ...lasPinasResults.slice(0, 8).map(result => ({ ...result, isPriority: true })),
          ...nearbyResults.slice(0, 5)
        ].filter((result, index, self) =>
          index === self.findIndex(r => r.name === result.name)
        );

        setDestinationSuggestions(combinedResults);
        setShowDestinationSuggestions(true);
      } catch (error) {

      }
    }, 200);
  }, [onDestinationChange, recentSearches]);

  const handleOriginSelect = (location) => {
    onOriginSelect(location);
    setOriginSuggestions([]);
    setShowOriginSuggestions(false);
  };

  const handleDestinationSelect = (location) => {
    onDestinationSelect(location);
    setDestinationSuggestions([]);
    setShowDestinationSuggestions(false);
  };

  return (
    <div className={`absolute transition-all duration-300 animate-fade-in ${
      showSidePanel
        ? 'top-4 left-80 right-4 sm:top-6 sm:left-96 sm:right-6'
        : (showHistoryPanel
          ? 'top-4 left-72 right-4 sm:top-6 sm:left-80 sm:right-6'
          : 'top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6')
    }`} style={{ zIndex: 40 }}>
      <div className="flex items-center justify-center space-x-3 max-w-5xl mx-auto">
        {/* Search Bar - Modern Elevated Card */}
        <div className="flex-1 max-w-3xl glass-effect rounded-3xl shadow-2xl overflow-hidden">
          {/* Origin Input */}
          <div className="flex items-center border-b border-gray-200 hover:bg-blue-50/30 transition-all duration-200">
            <div className="flex items-center space-x-3 px-5 py-4 flex-1 min-w-0">
              <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0 shadow-md ring-2 ring-blue-200"></div>
              <input
                type="text"
                placeholder="Choose starting point..."
                value={originQuery}
                onChange={(e) => {
                  setSearchMode('origin');
                  handleOriginSearch(e.target.value);
                }}
                onFocus={() => {
                  setSearchMode('origin');
                  setShowOriginSuggestions(originSuggestions.length > 0);
                }}
                className="flex-1 text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none text-base font-medium min-w-0"
              />
              {selectedOrigin && (
                <button
                  onClick={() => onOriginSelect(null)}
                  className="p-2 hover:bg-red-100 rounded-full flex-shrink-0 transition-all duration-200 transform hover:scale-110"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
            <button
              onClick={() => onGetCurrentLocation('origin')}
              className="p-3 hover:bg-blue-100 rounded-full flex-shrink-0 mr-4 transition-all duration-200 group transform hover:scale-110"
              title="Use current location as starting point"
            >
              <Target className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
            </button>
          </div>

          {/* Destination Input */}
          <div className="flex items-center hover:bg-red-50/30 transition-all duration-200">
            <div className="flex items-center space-x-3 px-5 py-4 flex-1 min-w-0">
              <div className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0 shadow-md ring-2 ring-red-200"></div>
              <input
                type="text"
                placeholder="Where to?"
                value={destinationQuery}
                onChange={(e) => {
                  setSearchMode('destination');
                  handleDestinationSearch(e.target.value);
                }}
                onFocus={() => {
                  setSearchMode('destination');
                  setShowDestinationSuggestions(destinationSuggestions.length > 0);
                }}
                className="flex-1 text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none text-base font-medium min-w-0"
              />
              {selectedDestination && (
                <button
                  onClick={() => onDestinationSelect(null)}
                  className="p-2 hover:bg-red-100 rounded-full flex-shrink-0 transition-all duration-200 transform hover:scale-110"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
              )}
            </div>
            <button
              onClick={() => onGetCurrentLocation('destination')}
              className="p-3 hover:bg-blue-100 rounded-full flex-shrink-0 mr-4 transition-all duration-200 group transform hover:scale-110"
              title="Use current location"
            >
              <Target className="w-5 h-5 text-gray-500 group-hover:text-blue-600" />
            </button>

            {/* Smart Route Button */}
            <button
              onClick={() => {}}
              className="modern-btn bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-4 rounded-2xl text-base font-bold transition-all duration-200 flex items-center space-x-2 mr-4 shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95"
              title="Smart Route Planning"
            >
              <Zap className="w-5 h-5" />
              <span className="hidden sm:inline">Smart</span>
            </button>

            {/* Route Button */}
            {selectedOrigin && selectedDestination && (
              <button
                onClick={onGetRoute}
                disabled={isLoading}
                className="modern-btn bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-4 rounded-2xl text-base font-bold transition-all duration-200 disabled:opacity-50 flex items-center space-x-2 mr-4 shadow-lg hover:shadow-2xl transform hover:scale-105 active:scale-95 disabled:transform-none"
                title="Get fastest route"
              >
                <Route className="w-5 h-5" />
                <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Go'}</span>
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {(showOriginSuggestions || showDestinationSuggestions) && (
            <div className="border-t border-gray-200/50 bg-white max-h-80 overflow-y-auto shadow-lg">
              {/* Quick Actions */}
              <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200/50">
                <button
                  onClick={() => onGetCurrentLocation(searchMode)}
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
                        onClick={() => {
                          if (searchMode === 'origin') {
                            handleOriginSelect(recent);
                          } else {
                            handleDestinationSelect(recent);
                          }
                        }}
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
              {((showOriginSuggestions && originSuggestions.length > 0) || 
                (showDestinationSuggestions && destinationSuggestions.length > 0)) && (
                <div className="px-4 py-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {(showOriginSuggestions ? originSuggestions : destinationSuggestions).some(r => r.isPriority) 
                      ? 'Las Piñas & Nearby' 
                      : 'Search Results'}
                  </div>
                  <div className="space-y-2">
                    {(showOriginSuggestions ? originSuggestions : destinationSuggestions)
                      .filter(result => !result.isRecent)
                      .map((result, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (showOriginSuggestions) {
                              handleOriginSelect(result);
                            } else {
                              handleDestinationSelect(result);
                            }
                          }}
                          className={`w-full flex items-center space-x-3 p-3 hover:bg-blue-50 rounded-xl transition-all duration-200 text-left group border ${
                            result.isPriority 
                              ? 'border-blue-200 bg-blue-50/30 hover:border-blue-300' 
                              : 'border-gray-100 hover:border-blue-200'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            result.isPriority
                              ? 'bg-blue-500 group-hover:bg-blue-600'
                              : 'bg-blue-100 group-hover:bg-blue-200'
                          }`}>
                            <MapPin className={`w-4 h-4 ${result.isPriority ? 'text-white' : 'text-blue-600'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{result.name}</p>
                              {result.isPriority && (
                                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-medium flex-shrink-0">
                                  Las Piñas
                                </span>
                              )}
                            </div>
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
  );
};

export default SearchBar;

