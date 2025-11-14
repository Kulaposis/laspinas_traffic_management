import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, History, Clock, Route } from 'lucide-react';
import travelHistoryService from '../../services/travelHistoryService';
import { getTripPlaceName } from '../../utils/mapHelpers';
import { useDarkMode } from '../../context/DarkModeContext';

/**
 * History Panel Component
 * Displays travel history and frequent locations
 */
const HistoryPanel = ({
  isOpen,
  onClose,
  travelHistory = [],
  frequentLocations = [],
  onLocationSelect
}) => {
  const scrollContainerRef = useRef(null);
  const { isDarkMode } = useDarkMode();

  // Prevent body scroll when panel is open (simple approach like sidebar)
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      
      // Prevent body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore body scroll
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const panelContent = (
    <>
      {/* Backdrop */}
      <div
        className="history-panel-backdrop fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
        style={{ zIndex: 99998, position: 'fixed' }}
        onClick={onClose}
      />

      {/* Panel - Using exact same structure as TrafficMapSidebar */}
      <div
        data-history-panel
        className={`fixed top-0 left-0 h-full w-full sm:w-80 md:w-96 shadow-2xl transform transition-all duration-300 ease-out sm:rounded-r-3xl border-r overflow-hidden flex flex-col animate-slide-in-left ${
          isDarkMode 
            ? 'bg-gray-900 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}
        style={{ 
          zIndex: 99999, 
          position: 'fixed',
          pointerEvents: 'auto', 
          visibility: 'visible', 
          opacity: 1
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 border-b ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-900' 
            : 'border-gray-100 bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Travel History</h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90 ${
                isDarkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div 
          ref={scrollContainerRef}
          className="p-6 space-y-6 overflow-y-auto flex-1 pb-24 modern-scrollbar overscroll-contain" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Frequent Locations */}
          {frequentLocations.length > 0 && (
            <div className="mb-6">
              <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Frequent Locations</h3>
              <div className="space-y-2">
                {frequentLocations.map((location, index) => (
                  <button
                    key={index}
                    onClick={() => onLocationSelect(location)}
                    className={`w-full flex items-center space-x-3 p-2 rounded-lg transition-colors text-left border ${
                      isDarkMode 
                        ? 'hover:bg-gray-800 border-gray-700' 
                        : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                      isDarkMode 
                        ? 'bg-blue-900 border-blue-700' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <span className={`text-xs font-semibold ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{location.name}</p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{location.count} visits</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trips */}
          <div>
            <h3 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Recent Trips</h3>
            {travelHistory.length > 0 ? (
              <div className="space-y-3">
                {travelHistory.map((trip, index) => (
                  <div key={index} className={`p-4 rounded-xl border hover:shadow-md transition-all duration-200 ${
                    isDarkMode 
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-blue-600' 
                      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-blue-300'
                  }`}>
                    {/* Route Title */}
                    <div className={`mb-3 pb-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <h4 className={`text-sm font-semibold truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                        From {getTripPlaceName(trip, 'origin')} to {getTripPlaceName(trip, 'destination')}
                      </h4>
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(trip.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    
                    {/* Route Visual */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          <p className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {getTripPlaceName(trip, 'origin')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-1">
                          <div className={`w-1 h-3 border-l-2 border-dashed ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                          <p className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {getTripPlaceName(trip, 'destination')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                      <div className={`flex items-center space-x-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{travelHistoryService.formatTravelTime(trip.duration_minutes)}</span>
                      </div>
                      <div className={`flex items-center space-x-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        <Route className="w-3.5 h-3.5" />
                        <span>{travelHistoryService.formatDistance(trip.distance_km)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                  isDarkMode ? 'bg-gray-800' : 'bg-gray-100'
                }`}>
                  <History className={`w-8 h-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                </div>
                <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>No travel history yet</p>
                <p className={`text-xs mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Your trips will appear here</p>
                <div className={`border rounded-lg p-3 ${
                  isDarkMode 
                    ? 'bg-blue-900/30 border-blue-700' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <p className={`text-xs ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                    💡 Complete a simulation to add your first trip!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  // Render panel using portal to ensure it's always on top
  return createPortal(panelContent, document.body);
};

export default HistoryPanel;

