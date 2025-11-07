import React from 'react';
import { X, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Enhanced Navigation Panel Component
 * Displays turn-by-turn navigation with minimize/collapse functionality
 */
const EnhancedNavigationPanel = ({
  isNavigationActive,
  selectedRoute,
  navigationStep,
  navigationPanelMinimized,
  onToggleMinimize,
  onClearTrip,
  gyroscopeEnabled,
  onToggleGyroscope,
  currentStep,
  nextStep
}) => {
  if (!isNavigationActive || !selectedRoute) return null;

  return (
    <div 
      className="absolute left-0 right-0 z-50 md:left-1/2 md:transform md:-translate-x-1/2 md:max-w-3xl"
      style={{
        bottom: 'env(safe-area-inset-bottom, 0px)',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))'
      }}
    >
      {/* Swipe Handle */}
      <div className="flex justify-center pt-2 pb-1">
        <button
          onClick={onToggleMinimize}
          className="w-12 h-1 bg-gray-300 rounded-full hover:bg-gray-400 transition-colors"
        />
      </div>

      {/* Panel */}
      <div className={`bg-white/90 backdrop-blur-xl border-t border-gray-200 shadow-2xl transition-all duration-300 ${
        navigationPanelMinimized ? 'rounded-t-2xl' : ''
      }`}>
        <div className={`transition-all duration-300 ${
          navigationPanelMinimized ? 'p-2 md:p-3' : 'p-3 md:p-4'
        }`}>
          {navigationPanelMinimized ? (
            /* Minimized View */
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-200 flex-shrink-0">
                  <span className="text-xl">
                    {currentStep ? enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type) : '→'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {currentStep ? currentStep.instruction : 'Navigation active'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentStep ? (
                      <>
                        {enhancedRoutingService.formatDistance(currentStep.distance_meters || 0)} • {enhancedRoutingService.formatDuration((currentStep.travel_time_seconds || 0) / 60)}
                      </>
                    ) : (
                      selectedRoute ? `${selectedRoute.distance_km?.toFixed(1) || 0} km • ${Math.round(selectedRoute.estimated_duration_minutes || 0)} min` : ''
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <button
                  onClick={onToggleMinimize}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={onClearTrip}
                  className="p-2 hover:bg-red-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-red-600" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded View */
            <div className="max-h-[42vh] md:max-h-[28vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Turn-by-turn navigation</h3>
                  <div className="text-sm text-gray-500">
                    Step {navigationStep + 1} of {selectedRoute ? selectedRoute.steps.length : 0}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onToggleGyroscope}
                    className={`p-2 rounded-full transition-colors ${
                      gyroscopeEnabled 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onToggleMinimize}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={onClearTrip}
                    className="p-2 hover:bg-red-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>

              {/* Current Instruction */}
              {currentStep ? (
                <div className="mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-200 flex-shrink-0">
                      <span className="text-3xl">
                        {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type || 'straight')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                        {currentStep.instruction || 'Continue on route'}
                      </p>
                      {currentStep.street_name && (
                        <p className="text-sm text-gray-600 mb-2">
                          on {currentStep.street_name}
                        </p>
                      )}
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-500">
                          {enhancedRoutingService.formatDistance(currentStep.distance_meters || 0)}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-500">
                          {enhancedRoutingService.formatDuration((currentStep.travel_time_seconds || 0) / 60)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Navigation className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">Navigation Active</p>
                      <p className="text-xs text-gray-600">
                        {selectedRoute ? (
                          <>
                            {selectedRoute.distance_km?.toFixed(1) || 0} km • {Math.round(selectedRoute.estimated_duration_minutes || 0)} min
                          </>
                        ) : (
                          'Route information loading...'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Instruction Preview */}
              {nextStep && (
                <div className="p-3 bg-gray-50 rounded-xl mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-sm">
                        {enhancedRoutingService.getManeuverIcon(nextStep.maneuver_type)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700">Next: {nextStep.instruction}</p>
                      {nextStep.street_name && (
                        <p className="text-xs text-gray-500">on {nextStep.street_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>
                    {Math.round(((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100)}%
                  </span>
                </div>
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-700"
                    style={{ width: `${((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedNavigationPanel;

