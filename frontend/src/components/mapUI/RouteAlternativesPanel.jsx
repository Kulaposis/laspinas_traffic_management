import React from 'react';
import { X, Clock, Route } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Route Alternatives Panel Component
 * Displays multiple route options for user selection
 */
const RouteAlternativesPanel = ({
  routeAlternatives = [],
  selectedRoute,
  onSelectRoute,
  onClose,
  showRouteAlternatives = true,
  isNavigationActive = false,
  showSmartRoutePanel = false
}) => {
  if (!routeAlternatives || routeAlternatives.length === 0 || !showRouteAlternatives || isNavigationActive || showSmartRoutePanel) return null;

  return (
    <div className="absolute bottom-2 left-1 right-1 sm:bottom-4 sm:left-2 sm:right-2 z-40">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-80 sm:max-h-96">
        <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Choose Route</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {routeAlternatives.map((route, index) => {
            const isSelected = selectedRoute && selectedRoute.route_id === route.route_id;
            return (
              <button
                key={route.route_id || index}
                onClick={() => onSelectRoute(route)}
                className={`w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-blue-600 text-white' :
                    index === 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isSelected ? '✓' : index === 0 ? '🏆' : index + 1}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {route.route_name || `Alternative ${index + 1}`}
                      </span>
                      {isSelected && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mb-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {enhancedRoutingService.formatDuration(route.estimated_duration_minutes)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Route className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {enhancedRoutingService.formatDistance(route.distance_km * 1000)}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        route.traffic_conditions === 'heavy' ? 'bg-red-100 text-red-700' :
                        route.traffic_conditions === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {route.traffic_conditions || 'Light'} traffic
                      </div>
                    </div>

                    {route.hasTolls && (
                      <div className="flex items-center space-x-1 mb-1">
                        <span className="text-xs text-gray-500">💰 Has tolls</span>
                      </div>
                    )}

                    {route.has_highways && (
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-gray-500">🛣️ Highway route</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RouteAlternativesPanel;



