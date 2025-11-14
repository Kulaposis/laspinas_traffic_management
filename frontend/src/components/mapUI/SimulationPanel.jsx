import React, { memo } from 'react';
import { Car, ChevronDown, ChevronUp, X, Play, Pause } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Simulation Panel Component
 * Controls travel simulation with progress and speed controls
 * Optimized for desktop with compact design and smooth performance
 */
const SimulationPanel = memo(({
  isSimulating,
  simulationProgress,
  simulationPaused,
  simulationSpeed,
  simulationMinimized,
  selectedOrigin,
  selectedDestination,
  selectedRoute,
  currentStep,
  onTogglePause,
  onChangeSpeed,
  onStop,
  onToggleMinimize
}) => {
  if (!isSimulating) return null;

  // Round progress to reduce re-renders from minor changes
  const roundedProgress = Math.round(simulationProgress);

  return (
    <div 
      className="absolute z-40 transition-all duration-300 ease-out left-2 right-2 sm:left-auto sm:right-4"
      style={{
        // Desktop: Fixed width, bottom-right. Mobile: Full width with margins
        bottom: '16px',
        width: 'calc(100% - 1rem)',
        maxWidth: simulationMinimized ? '320px' : '420px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitTransform: 'translateZ(0)', // Force GPU acceleration on Safari
        willChange: 'transform'
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden backdrop-blur-sm bg-opacity-95">
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center space-x-1.5">
              <Car className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="truncate">Travel Simulation</span>
            </h3>
            {!simulationMinimized && (
              <div className="text-xs text-gray-600 mt-0.5 truncate">
                {selectedOrigin?.name} → {selectedDestination?.name}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={onToggleMinimize}
              className="p-1.5 hover:bg-green-200 rounded transition-colors touch-manipulation active:scale-95 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title={simulationMinimized ? 'Maximize' : 'Minimize'}
            >
              {simulationMinimized ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
            </button>
            <button
              onClick={onStop}
              className="p-1.5 hover:bg-green-200 rounded transition-colors touch-manipulation active:scale-95 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Stop simulation"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Minimized View - Very Compact */}
        {simulationMinimized && (
          <div className="px-3 py-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={onTogglePause}
                className="p-1.5 rounded transition-colors bg-gray-100 hover:bg-gray-200 flex-shrink-0 touch-manipulation active:scale-95 min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                {simulationPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${roundedProgress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-700 min-w-[2.5rem] text-right">
                {roundedProgress}%
              </span>
            </div>
          </div>
        )}

        {/* Full View - Compact */}
        {!simulationMinimized && (
          <div className="px-3 py-2.5">
            {/* Progress Bar - Compact */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-600">Progress</span>
              <span className="text-xs font-semibold text-gray-700">{roundedProgress}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden mb-3">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${roundedProgress}%` }}
              />
            </div>

            {/* Controls - Compact */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={onTogglePause}
                className={`p-2 rounded-lg transition-colors border touch-manipulation active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center ${
                  simulationPaused
                    ? 'bg-green-50 border-green-300 text-green-600 hover:bg-green-100'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
                title={simulationPaused ? 'Resume' : 'Pause'}
              >
                {simulationPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              {/* Speed Controls - Compact */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs text-gray-600">Speed:</span>
                {[1, 2, 5, 10].map(speed => (
                  <button
                    key={speed}
                    onClick={() => onChangeSpeed(speed)}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-all duration-150 touch-manipulation active:scale-95 min-w-[36px] min-h-[32px] flex items-center justify-center ${
                      simulationSpeed === speed
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Current Step Info - Compact */}
            {currentStep && (
              <div className="mb-3 pt-2 border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center border border-green-200 flex-shrink-0">
                    <span className="text-lg">
                      {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{currentStep.instruction}</p>
                    {currentStep.street_name && (
                      <p className="text-xs text-gray-600 truncate">on {currentStep.street_name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Trip Info - Compact */}
            {selectedRoute && (
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-200">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {enhancedRoutingService.formatDistance(selectedRoute.distance_km * 1000)}
                  </div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {enhancedRoutingService.formatDuration(selectedRoute.estimated_duration_minutes)}
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-green-600">
                    {roundedProgress}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Only re-render if essential props changed
  return (
    prevProps.isSimulating === nextProps.isSimulating &&
    Math.round(prevProps.simulationProgress) === Math.round(nextProps.simulationProgress) &&
    prevProps.simulationPaused === nextProps.simulationPaused &&
    prevProps.simulationSpeed === nextProps.simulationSpeed &&
    prevProps.simulationMinimized === nextProps.simulationMinimized &&
    prevProps.currentStep?.instruction === nextProps.currentStep?.instruction
  );
});

SimulationPanel.displayName = 'SimulationPanel';

export default SimulationPanel;



