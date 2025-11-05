import React from 'react';
import { Car, ChevronDown, ChevronUp, X, Play, Pause, Clock, Route } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Simulation Panel Component
 * Controls travel simulation with progress and speed controls
 */
const SimulationPanel = ({
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

  return (
    <div className={`absolute left-2 right-2 sm:left-4 sm:right-4 z-40 transition-all duration-300 ${
      simulationMinimized ? 'bottom-4' : 'bottom-20 sm:bottom-24'
    }`}>
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <Car className="w-5 h-5 text-green-600" />
              <span>Travel Simulation</span>
            </h3>
            {!simulationMinimized && (
              <div className="text-sm text-gray-600 mt-1 truncate">
                {selectedOrigin?.name} → {selectedDestination?.name}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleMinimize}
              className="p-2 hover:bg-green-200 rounded-full transition-colors"
              title={simulationMinimized ? 'Maximize' : 'Minimize'}
            >
              {simulationMinimized ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
            </button>
            <button
              onClick={onStop}
              className="p-2 hover:bg-green-200 rounded-full transition-colors"
              title="Stop simulation"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Minimized View */}
        {simulationMinimized && (
          <div className="p-3">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${simulationProgress}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700 min-w-[3rem] text-right">
                {Math.round(simulationProgress)}%
              </span>
              <button
                onClick={onTogglePause}
                className="p-2 rounded-lg transition-colors bg-gray-100 hover:bg-gray-200"
              >
                {simulationPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Full View */}
        {!simulationMinimized && (
          <div className="p-4">
            {/* Progress Bar */}
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(simulationProgress)}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden mb-4">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-300 ease-out relative"
                style={{ width: `${simulationProgress}%` }}
              >
                <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onTogglePause}
                className={`p-3 rounded-lg transition-colors border-2 ${
                  simulationPaused
                    ? 'bg-green-50 border-green-300 text-green-600 hover:bg-green-100'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
                title={simulationPaused ? 'Resume' : 'Pause'}
              >
                {simulationPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>

              {/* Speed Controls */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 mr-2">Speed:</span>
                {[1, 2, 5, 10].map(speed => (
                  <button
                    key={speed}
                    onClick={() => onChangeSpeed(speed)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      simulationSpeed === speed
                        ? 'bg-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Current Step Info */}
            {currentStep && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center border border-green-200">
                    <span className="text-xl">
                      {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{currentStep.instruction}</p>
                    {currentStep.street_name && (
                      <p className="text-xs text-gray-600">on {currentStep.street_name}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Trip Info */}
            {selectedRoute && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDistance(selectedRoute.distance_km * 1000)}
                  </div>
                  <div className="text-xs text-gray-500">Distance</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {enhancedRoutingService.formatDuration(selectedRoute.estimated_duration_minutes)}
                  </div>
                  <div className="text-xs text-gray-500">Duration</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-green-600">
                    {Math.round(simulationProgress)}%
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
};

export default SimulationPanel;



