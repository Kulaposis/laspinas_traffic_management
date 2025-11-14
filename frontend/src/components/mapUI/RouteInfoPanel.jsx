import React from 'react';
import { X, Route, Layers, Heart } from 'lucide-react';
import { Navigation, Play } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Route Info Panel Component
 * Displays route information and actions
 */
const RouteInfoPanel = ({
  selectedRoute,
  routeAlternatives = [],
  routeTrafficData = null,
  onShowAlternatives,
  onClearRoute,
  onSaveFavorite,
  onStartSimulation,
  onStartNavigation
}) => {
  if (!selectedRoute) return null;

  return (
    <div 
      className="absolute bottom-2 left-1 right-1 sm:bottom-4 sm:left-2 sm:right-2 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <div 
        className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        style={{
          maxHeight: 'min(calc(100vh - 100px), calc(100dvh - 100px), 80vh)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border border-blue-200">
                <Route className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Route Found</h3>
                <p className="text-sm text-gray-500">{selectedRoute.route_name || 'Recommended Route'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {routeAlternatives.length > 1 && (
                <button
                  onClick={onShowAlternatives}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 touch-manipulation active:scale-95"
                  title="View alternative routes"
                >
                  <Layers className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <button
                onClick={onClearRoute}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 touch-manipulation active:scale-95"
                title="Close route"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={onSaveFavorite}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 touch-manipulation active:scale-95"
                title="Save as favorite"
              >
                <Heart className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={onStartSimulation}
                className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 sm:space-x-2 shadow-sm touch-manipulation active:scale-95"
                title="Simulate this trip"
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Simulate</span>
                <span className="sm:hidden">Sim</span>
              </button>
              <button
                onClick={onStartNavigation}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center space-x-1.5 sm:space-x-2 shadow-sm touch-manipulation active:scale-95"
              >
                <Navigation className="w-4 h-4" />
                <span>Start</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {enhancedRoutingService.formatDuration(selectedRoute.estimated_duration_minutes)}
              </div>
              <div className="text-xs text-gray-500">Duration</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {enhancedRoutingService.formatDistance(selectedRoute.distance_km * 1000)}
              </div>
              <div className="text-xs text-gray-500">Distance</div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${
                routeTrafficData?.condition === 'heavy' ? 'text-red-600' :
                routeTrafficData?.condition === 'moderate' ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {routeTrafficData?.condition === 'heavy' ? 'Heavy' :
                 routeTrafficData?.condition === 'moderate' ? 'Moderate' :
                 'Light'}
              </div>
              <div className="text-xs text-gray-500">Traffic</div>
              {routeTrafficData && (
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round(routeTrafficData.avgSpeed)} km/h avg
                </div>
              )}
            </div>
            <div className="flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${
                routeTrafficData?.condition === 'heavy' ? 'bg-red-500' :
                routeTrafficData?.condition === 'moderate' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}></div>
              <span className="ml-2 text-xs text-gray-500">
                Live traffic
              </span>
            </div>
          </div>

          {/* Traffic Details */}
          {routeTrafficData && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Traffic flow:</span>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    <div className={`w-2 h-2 rounded-full ${
                      routeTrafficData.condition === 'heavy' ? 'bg-red-500' :
                      routeTrafficData.condition === 'moderate' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}></div>
                    <span className="text-gray-700 capitalize">{routeTrafficData.condition}</span>
                  </div>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-600">
                    {routeTrafficData.samplePoints} checkpoints
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteInfoPanel;



