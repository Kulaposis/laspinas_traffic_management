import React, { useState, useEffect } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

/**
 * SearchResultsLayer Component
 * Displays only the selected search result as a marker on the map
 * Only shows a pin when user clicks/selects a specific search result
 */
const SearchResultsLayer = ({
  searchResults = [],
  selectedResult = null,
  onResultSelect = null,
  onResultClick = null
}) => {
  // Track animation trigger to restart animation when selection changes
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation restart when selectedResult changes
  useEffect(() => {
    if (selectedResult && selectedResult.lat && selectedResult.lng) {
      setAnimationKey(prev => prev + 1);
    }
  }, [selectedResult?.lat, selectedResult?.lng]);

  // Only show pin for the selected result, not all search results
  if (!selectedResult || !selectedResult.lat || !selectedResult.lng) {
    return null;
  }

  // Create icon for selected result with drop/bounce animation
  const createSearchResultIcon = (result, animKey) => {
    const isPOI = result.type === 'POI' || result.poi;
    const color = '#10b981'; // Green for selected location
    
    return L.divIcon({
      className: 'custom-search-result-marker pin-container',
      html: `
        <div style="
          position: relative;
          width: 40px;
          height: 40px;
        ">
          <div class="pin-marker" style="
            background-color: ${color};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 20px;
            transition: transform 0.2s ease;
          ">
            ${isPOI ? '🏢' : '📍'}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });
  };

  const locationName = selectedResult.name || selectedResult.display_name || selectedResult.address?.full || selectedResult.address?.freeformAddress || 'Unknown Location';
  const locationAddress = selectedResult.address?.full || selectedResult.address?.freeformAddress || '';
  const isPOI = selectedResult.type === 'POI' || selectedResult.poi;
  
  // Use animation key to force marker recreation and restart animation
  const markerKey = `search-result-${selectedResult.lat}-${selectedResult.lng}-${animationKey}`;
  
  return (
    <Marker
      key={markerKey}
      position={[selectedResult.lat, selectedResult.lng]}
      icon={createSearchResultIcon(selectedResult, animationKey)}
      eventHandlers={{
        click: () => {
          // When clicking the marker directly, trigger the click handler
          if (onResultClick) {
            onResultClick(selectedResult);
          }
        }
      }}
    >
      <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
        <div className="text-xs font-semibold text-gray-900 bg-white px-2 py-1 rounded shadow-sm">
          {locationName.length > 30 ? locationName.substring(0, 30) + '...' : locationName}
        </div>
      </Tooltip>
      <Popup className="search-result-popup" maxWidth={320}>
        <div className="p-3 min-w-[280px]">
          <div className="flex items-start space-x-3 mb-2">
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-2xl ${
              isPOI ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              {isPOI ? '🏢' : '📍'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-gray-900 mb-1">
                {locationName}
              </h3>
              {locationAddress && (
                <p className="text-sm text-gray-600 mb-2">
                  {locationAddress}
                </p>
              )}
              {selectedResult.distance && (
                <p className="text-xs text-gray-500">
                  {selectedResult.distance.toFixed(1)} km away
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onResultSelect) {
                  onResultSelect(selectedResult);
                }
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Select
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onResultClick) {
                  onResultClick(selectedResult);
                }
              }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              View Details
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

export default SearchResultsLayer;

