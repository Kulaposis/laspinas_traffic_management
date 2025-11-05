import React from 'react';
import { X, Clock, Route } from 'lucide-react';
import enhancedRoutingService from '../../services/enhancedRoutingService';

/**
 * Navigation Panel Component
 * Displays turn-by-turn navigation instructions
 */
const NavigationPanel = ({
  isNavigationActive,
  currentStep,
  nextStep,
  navigationStep,
  selectedRoute,
  userLocation,
  isTrackingLocation,
  onStopNavigation
}) => {
  if (!isNavigationActive || !currentStep) return null;

  return (
    <div className="absolute bottom-20 sm:bottom-24 left-2 right-2 sm:left-4 sm:right-4 z-40">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Turn-by-turn navigation</h3>
            <div className="text-sm text-gray-500">
              Step {navigationStep + 1} of {selectedRoute ? selectedRoute.steps.length : 0}
            </div>
            {userLocation && (
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-500">
                  GPS: ±{Math.round(userLocation.accuracy)}m
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onStopNavigation}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="Exit navigation"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Current Instruction */}
        <div className="p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center border-2 border-blue-200">
                <span className="text-3xl">
                  {enhancedRoutingService.getManeuverIcon(currentStep.maneuver_type)}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                {currentStep.instruction}
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

        {/* Next Instruction Preview */}
        {nextStep && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
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
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>
              {Math.round(((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100)}%
            </span>
          </div>
          <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${((navigationStep + 1) / (selectedRoute ? selectedRoute.steps.length : 1)) * 100}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;



