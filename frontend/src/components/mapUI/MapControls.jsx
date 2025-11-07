import React from 'react';
import { Play, Pause, Layers, BarChart3, Shuffle, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import voiceNavigationService from '../../services/voiceNavigationService';

/**
 * Map Controls Component
 * Floating action buttons for map controls (GPS, Navigation, Incident Report, etc.)
 */
const MapControls = ({
  isNavigationActive,
  isSimulating,
  isTrackingLocation,
  simulationSpeed,
  selectedRoute,
  onStartNavigation,
  onStopNavigation,
  onShowIncidentModal,
  onSetShowAuthPrompt,
  onSetWeatherEnabled,
  weatherEnabled,
  onSetShowSecondaryActions,
  showSecondaryActions,
  onSetShowPredictionsPanel,
  onSetIsMiniOpen,
  onToggleMultiStopMode,
  multiStopMode,
  isGuest,
  onSetVoiceEnabled,
  voiceEnabled
}) => {
  return (
    <>
      {/* Bottom Right Controls */}
      <div className="absolute bottom-6 right-5 flex flex-col space-y-3 animate-fade-in" style={{ zIndex: 40 }}>
        {/* Simulation Status Indicator */}
        {isSimulating && (
          <div className="modern-pill bg-white rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full shadow-md bg-green-500 animate-pulse"></div>
              <span className="text-sm font-bold text-green-700">
                {simulationSpeed}x
              </span>
            </div>
          </div>
        )}

        {/* GPS Status Indicator */}
        {!isSimulating && (
          <div className={`modern-pill bg-white rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border ${
            isTrackingLocation
              ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
              : 'border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50'
          }`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full shadow-md ${
                isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className={`text-sm font-bold ${
                isTrackingLocation ? 'text-green-700' : 'text-gray-600'
              }`}>
                GPS
              </span>
            </div>
          </div>
        )}

        {/* Navigation Toggle */}
        {selectedRoute && !isSimulating && (
          <button
            onClick={isNavigationActive ? onStopNavigation : onStartNavigation}
            className={`min-w-[64px] min-h-[64px] rounded-full shadow-2xl p-5 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 relative overflow-hidden group ${
              isNavigationActive
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white'
                : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white'
            }`}
          >
            <div className="relative z-10">
              {isNavigationActive ? (
                <Pause className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Play className="w-7 h-7 transition-transform duration-300 group-hover:scale-110" />
              )}
            </div>
            <span className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-active:opacity-100 transition-opacity duration-200"></span>
            {isNavigationActive && (
              <span className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping"></span>
            )}
          </button>
        )}
      </div>

      {/* Compact Floating Action Buttons - Right Side - Mobile Optimized */}
      <div 
        className="absolute right-3 sm:right-4 z-[45] flex flex-col space-y-2 transition-all duration-300"
        style={{
          bottom: isNavigationActive 
            ? `calc(80px + env(safe-area-inset-bottom, 0px))`
            : `calc(20px + env(safe-area-inset-bottom, 0px))`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Primary Actions */}
        <div className="flex flex-col space-y-2.5 sm:space-y-2">
          {/* Incident Report */}
          <button
            onClick={() => {
              if (isGuest) {
                onSetShowAuthPrompt(true);
                return;
              }
              onShowIncidentModal(true);
            }}
            className="w-12 h-12 sm:w-12 sm:h-12 bg-red-600/90 backdrop-blur-lg hover:bg-red-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation"
            title="Report Incident"
          >
            <AlertTriangle className="w-5 h-5" />
          </button>

          {/* Voice Navigation */}
          {!isGuest && (
            <button
              onClick={() => {
                const newState = voiceNavigationService.toggle();
                onSetVoiceEnabled(newState);
              }}
              className={`w-12 h-12 sm:w-12 sm:h-12 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation ${
                voiceNavigationService.isEnabled()
                  ? 'bg-blue-600/90 backdrop-blur-lg hover:bg-blue-700 text-white'
                  : 'bg-white/80 backdrop-blur-lg hover:bg-white text-gray-700'
              }`}
              title={voiceNavigationService.isEnabled() ? 'Mute Voice' : 'Enable Voice'}
            >
              {voiceNavigationService.isEnabled() ? (
                <Volume2 className="w-5 h-5" />
              ) : (
                <VolumeX className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Layers Toggle */}
          <button
            onClick={() => onSetShowSecondaryActions(!showSecondaryActions)}
            className="w-12 h-12 sm:w-12 sm:h-12 bg-white/80 backdrop-blur-lg hover:bg-white text-gray-700 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation"
            title="More Options"
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>

        {/* Secondary Actions - Expandable */}
        {showSecondaryActions && (
          <div className="flex flex-col space-y-2.5 sm:space-y-2 animate-fade-in mt-2.5 sm:mt-2">
            {/* Traffic Predictions */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetShowPredictionsPanel(true);
              }}
              className="w-12 h-12 sm:w-12 sm:h-12 bg-cyan-600/90 backdrop-blur-lg hover:bg-cyan-700 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation"
              title="View Traffic Predictions"
            >
              <BarChart3 className="w-5 h-5" />
            </button>

            {/* Multi-Stop Mode Toggle */}
            {!isGuest && (
              <button
                onClick={onToggleMultiStopMode}
                className={`w-12 h-12 sm:w-12 sm:h-12 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation ${
                  multiStopMode
                    ? 'bg-purple-600/90 backdrop-blur-lg hover:bg-purple-700 text-white'
                    : 'bg-white/80 backdrop-blur-lg hover:bg-white text-gray-700'
                }`}
                title="Multi-Stop Planning"
              >
                <Shuffle className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default MapControls;

