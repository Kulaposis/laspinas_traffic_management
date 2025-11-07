import React, { useEffect, useRef } from 'react';
import { X, History, Clock, Route } from 'lucide-react';
import travelHistoryService from '../../services/travelHistoryService';
import { getTripPlaceName } from '../../utils/mapHelpers';

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 transition-opacity duration-300 animate-fade-in backdrop-blur-sm"
        style={{ zIndex: 45 }}
        onClick={onClose}
      />

      {/* Panel - Using exact same structure as TrafficMapSidebar */}
      <div
        data-history-panel
        className="fixed top-0 left-0 h-full w-full sm:w-80 md:w-96 bg-white shadow-2xl transform transition-all duration-300 ease-out sm:rounded-r-3xl border-r border-gray-100 overflow-hidden flex flex-col animate-slide-in-left"
        style={{ zIndex: 50 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Travel History</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 transform hover:scale-110 hover:rotate-90"
            >
              <X className="w-5 h-5 text-gray-500" />
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
              <h3 className="font-medium text-gray-900 mb-3">Frequent Locations</h3>
              <div className="space-y-2">
                {frequentLocations.map((location, index) => (
                  <button
                    key={index}
                    onClick={() => onLocationSelect(location)}
                    className="w-full flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg transition-colors text-left border border-gray-200"
                  >
                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                      <span className="text-xs font-semibold text-blue-600">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{location.name}</p>
                      <p className="text-xs text-gray-500">{location.count} visits</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Trips */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Recent Trips</h3>
            {travelHistory.length > 0 ? (
              <div className="space-y-3">
                {travelHistory.map((trip, index) => (
                  <div key={index} className="p-4 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                    {/* Route Title */}
                    <div className="mb-3 pb-2 border-b border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-800 truncate">
                        From {getTripPlaceName(trip, 'origin')} to {getTripPlaceName(trip, 'destination')}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {new Date(trip.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    
                    {/* Route Visual */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          <p className="text-xs text-gray-600 truncate">
                            {getTripPlaceName(trip, 'origin')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 ml-1">
                          <div className="w-1 h-3 border-l-2 border-dashed border-gray-300"></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                          <p className="text-xs text-gray-600 truncate">
                            {getTripPlaceName(trip, 'destination')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{travelHistoryService.formatTravelTime(trip.duration_minutes)}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-600">
                        <Route className="w-3.5 h-3.5" />
                        <span>{travelHistoryService.formatDistance(trip.distance_km)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <History className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No travel history yet</p>
                <p className="text-xs text-gray-500 mb-4">Your trips will appear here</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
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
};

export default HistoryPanel;

