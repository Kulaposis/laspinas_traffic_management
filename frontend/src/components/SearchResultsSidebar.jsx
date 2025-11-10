import React from 'react';
import { X, MapPin, Building, Navigation, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * SearchResultsSidebar Component
 * Desktop-friendly sidebar showing search results with ability to select and view details
 */
const SearchResultsSidebar = ({
  searchResults = [],
  selectedResult = null,
  onResultSelect = null,
  onResultClick = null,
  onClose = null,
  isOpen = false
}) => {
  if (!isOpen || !searchResults || searchResults.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-[60] hidden lg:flex flex-col"
          style={{ maxHeight: '100vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Search Results</h2>
              <p className="text-sm text-gray-600">{searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-2">
              {searchResults.map((result, index) => {
                const isSelected = selectedResult && (
                  selectedResult.id === result.id ||
                  (selectedResult.lat === result.lat && selectedResult.lng === result.lng)
                );
                
                const locationName = result.name || result.display_name || result.address?.full || result.address?.freeformAddress || 'Unknown Location';
                const locationAddress = result.address?.full || result.address?.freeformAddress || '';
                const isPOI = result.type === 'POI' || result.poi;
                const isLasPinas = result.isPriority || result.isLasPinas;
                
                return (
                  <motion.div
                    key={result.id || `search-result-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-white rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                    onClick={() => {
                      if (onResultSelect) {
                        onResultSelect(result);
                      }
                    }}
                  >
                    <div className="p-4">
                      <div className="flex items-start space-x-3">
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          isPOI ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {isPOI ? (
                            <Building className="w-5 h-5 text-blue-600" />
                          ) : (
                            <MapPin className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h3 className="font-semibold text-sm text-gray-900 line-clamp-2">
                              {locationName}
                            </h3>
                            {isLasPinas && (
                              <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                                Las Piñas
                              </span>
                            )}
                          </div>
                          
                          {locationAddress && (
                            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                              {locationAddress}
                            </p>
                          )}
                          
                          {result.distance && (
                            <p className="text-xs text-gray-500 mb-2">
                              {result.distance.toFixed(1)} km away
                            </p>
                          )}
                          
                          {/* Actions */}
                          <div className="flex items-center space-x-2 mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onResultClick) {
                                  onResultClick(result);
                                }
                              }}
                              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Details</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onResultSelect) {
                                  onResultSelect(result);
                                }
                              }}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center space-x-1"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Select</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Click on a result to see it on the map
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchResultsSidebar;

