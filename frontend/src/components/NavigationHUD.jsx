import React from 'react';
import { Navigation, MapPin, Clock, AlertTriangle, Volume2, VolumeX, X, ChevronDown } from 'lucide-react';

/**
 * NavigationHUD - Heads-up display for turn-by-turn navigation
 * Google Maps/Waze style - Mobile optimized
 */
const NavigationHUD = ({
  currentStep,
  nextStep,
  distanceToNextTurn,
  estimatedTimeRemaining,
  currentSpeed,
  speedLimit,
  voiceEnabled,
  onToggleVoice,
  onExit,
  isMinimized,
  onToggleMinimize
}) => {
  // Format distance for display
  const formatDistance = (meters) => {
    if (!meters && meters !== 0) return '---';
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  // Format time for display
  const formatTime = (minutes) => {
    if (!minutes && minutes !== 0) return '0';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  // Get turn icon/arrow based on instruction
  const getTurnArrow = (instruction) => {
    if (!instruction) return '↑';
    const lower = instruction.toLowerCase();
    if (lower.includes('left')) return '←';
    if (lower.includes('right')) return '→';
    if (lower.includes('straight') || lower.includes('continue')) return '↑';
    if (lower.includes('u-turn')) return '↶';
    if (lower.includes('exit') || lower.includes('ramp')) return '↗';
    if (lower.includes('merge')) return '↗';
    return '↑';
  };

  // Get simplified instruction text
  const getSimplifiedInstruction = (instruction) => {
    if (!instruction) return 'Continue on route';
    // Remove extra details and keep it short
    return instruction.split(',')[0].trim();
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed top-2 left-1/2 -translate-x-1/2 z-50 cursor-pointer px-2"
        onClick={onToggleMinimize}
      >
        <div className="bg-white text-gray-900 px-4 py-2 rounded-full shadow-lg flex items-center space-x-3 hover:shadow-xl transition-all border border-gray-200">
          <Clock className="w-4 h-4 text-gray-600" />
          <span className="font-bold text-sm">{formatTime(estimatedTimeRemaining)}</span>
          <div className="w-px h-4 bg-gray-300"></div>
          <span className="font-bold text-sm text-blue-600">{formatDistance(distanceToNextTurn)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Main Navigation Card - Mobile Optimized */}
      <div className="pointer-events-auto bg-white shadow-lg mx-2 mt-2 rounded-2xl overflow-hidden border border-gray-200 max-w-md mx-auto">
        {/* Top Bar - Compact */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
          {/* ETA */}
          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs font-semibold text-gray-900">{formatTime(estimatedTimeRemaining)}</span>
          </div>

          {/* Controls - Compact */}
          <div className="flex items-center space-x-1">
            <button
              onClick={onToggleVoice}
              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
              title={voiceEnabled ? 'Mute' : 'Unmute'}
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4 text-gray-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={onToggleMinimize}
              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
              title="Minimize"
            >
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onExit}
              className="p-1.5 hover:bg-red-100 rounded-full transition-colors"
              title="Exit"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* Main Turn Instruction - Compact */}
        {currentStep && (
          <div className="px-4 py-3">
            <div className="flex items-center space-x-3">
              {/* Turn Icon - Smaller */}
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-3xl font-bold text-white">{getTurnArrow(currentStep.instruction)}</span>
                </div>
              </div>

              {/* Instruction Text - Compact */}
              <div className="flex-1 min-w-0">
                {/* Distance - Smaller but readable */}
                <div className="text-2xl font-bold text-gray-900 leading-tight mb-0.5">
                  {formatDistance(distanceToNextTurn || currentStep.distance)}
                </div>
                
                {/* Instruction - Compact */}
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {getSimplifiedInstruction(currentStep.instruction)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Turn Preview - Compact */}
        {nextStep && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">THEN</span>
              <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                <span className="text-lg">{getTurnArrow(nextStep.instruction)}</span>
                <span className="text-xs text-gray-700 truncate">
                  {getSimplifiedInstruction(nextStep.instruction)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NavigationHUD;

