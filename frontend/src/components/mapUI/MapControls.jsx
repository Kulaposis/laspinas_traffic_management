import React, { useEffect, useMemo, useState } from 'react';
import { Play, Pause, BarChart3, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import voiceNavigationService from '../../services/voiceNavigationService';
import { useDarkMode } from '../../context/DarkModeContext';

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
  onSetShowPredictionsPanel,
  onSetIsMiniOpen,
  isGuest,
  onSetVoiceEnabled,
  voiceEnabled,
  showDirectionsPanel = false, // Hide buttons when GoogleMapsStyleNavigation is showing
  isMiniOpen = false, // Hide buttons when Insights panel is open (especially on mobile)
  showSimulationCompleteModal = false, // Hide buttons when simulation complete modal is showing
  showRulePanel = false // Hide buttons when rule-based heatmap panel is showing
}) => {
  const { isDarkMode } = useDarkMode();
  
  return (
    <>
      {/* Bottom Right Controls */}
      <div className="absolute bottom-6 right-5 flex flex-col space-y-3 lg:space-y-2 animate-fade-in" style={{ zIndex: 40 }}>
        {/* Simulation Status Indicator */}
        {isSimulating && (
          <div className={`modern-pill rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border ${
            isDarkMode 
              ? 'bg-gray-800 border-green-700 bg-gradient-to-r from-green-900/50 to-emerald-900/50' 
              : 'bg-white border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
          }`}>
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full shadow-md bg-green-500 animate-pulse"></div>
              <span className={`text-sm font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                {simulationSpeed}x
              </span>
            </div>
          </div>
        )}

        {/* GPS Status Indicator */}
        {!isSimulating && (
          <div className={`modern-pill rounded-full shadow-2xl px-4 py-3 transition-all duration-200 border ${
            isTrackingLocation
              ? isDarkMode 
                ? 'border-green-700 bg-gradient-to-r from-green-900/50 to-emerald-900/50' 
                : 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50'
              : isDarkMode 
                ? 'border-gray-700 bg-gradient-to-r from-gray-800 to-gray-800' 
                : 'border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50'
          } ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center space-x-2">
              <div className={`w-2.5 h-2.5 rounded-full shadow-md ${
                isTrackingLocation ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className={`text-sm font-bold ${
                isTrackingLocation 
                  ? (isDarkMode ? 'text-green-400' : 'text-green-700') 
                  : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
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
            className={`min-w-[56px] min-h-[56px] lg:min-w-[52px] lg:min-h-[52px] rounded-full shadow-2xl p-5 lg:p-4 transition-all duration-300 ease-out transform hover:scale-110 active:scale-95 relative overflow-hidden group ${
              isNavigationActive
                ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white'
                : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white'
            }`}
          >
            <div className="relative z-10">
              {isNavigationActive ? (
                <Pause className="w-7 h-7 lg:w-6 lg:h-6 transition-transform duration-300 group-hover:scale-110" />
              ) : (
                <Play className="w-7 h-7 lg:w-6 lg:h-6 transition-transform duration-300 group-hover:scale-110" />
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
      {(() => {
        // Compute dynamic bottom offset to avoid overlap with mobile browser toolbars and Leaflet attribution
        const [bottomOffset, setBottomOffset] = useState(20);

        const computeOffset = () => {
          // Increased base offset to account for larger buttons (64-80px each + spacing)
          // Emergency button: ~64-80px, Traffic button: ~64-80px, spacing: ~12px
          // Need room for buttons + zoom control + attribution
          const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
          // On desktop, leave more breathing room above Leaflet attribution and zoom
          let base = isDesktop ? (isNavigationActive ? 110 : 48) : (isNavigationActive ? 100 : 24);
          let extra = 0;
          try {
            if (window.visualViewport) {
              const delta = window.innerHeight - window.visualViewport.height;
              // delta includes bottom bars/keyboard; cap to a reasonable value
              extra = Math.max(0, Math.min(120, Math.round(delta)));
            } else {
              // Fallback heuristics for mobile browsers
              const ua = navigator.userAgent || '';
              const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
              if (isMobile) extra = 24;
            }
          } catch (_) {}
          return base + extra;
        };

        useEffect(() => {
          const update = () => setBottomOffset(computeOffset());
          update();
          window.addEventListener('resize', update);
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', update);
            window.visualViewport.addEventListener('scroll', update);
          }
          return () => {
            window.removeEventListener('resize', update);
            if (window.visualViewport) {
              window.visualViewport.removeEventListener('resize', update);
              window.visualViewport.removeEventListener('scroll', update);
            }
          };
        }, [isNavigationActive]);

        return (
          <div 
            className="absolute right-4 sm:right-5 z-[1000] flex flex-col space-y-3 lg:space-y-2 transition-all duration-300"
            style={{
              bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
        {/* Primary Actions - Large Prominent Buttons - Hidden during navigation, simulation, when directions panel is showing, when insights panel is open (mobile), when simulation complete modal is showing, or when rule-based heatmap panel is showing */}
        {!isNavigationActive && !isSimulating && !showDirectionsPanel && !isMiniOpen && !showSimulationCompleteModal && !showRulePanel && (
          <div className="flex flex-col space-y-3 lg:space-y-2">
            {/* Emergency/Incident Report Button - Large & Prominent */}
            <button
              onClick={() => {
                if (isGuest) {
                  onSetShowAuthPrompt(true);
                  return;
                }
                onShowIncidentModal(true);
              }}
              className="group relative w-16 h-16 sm:w-20 sm:h-20 lg:w-14 lg:h-14 min-w-[64px] min-h-[64px] lg:min-w-[56px] lg:min-h-[56px] bg-gradient-to-br from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 backdrop-blur-lg text-white rounded-2xl shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation border-2 border-red-400/30 hover:border-red-300/50"
              title="Report Emergency"
            >
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 lg:w-6 lg:h-6 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
              {/* Subtle glow effect on hover only */}
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            </button>

            {/* Voice Navigation - Medium Size */}
            {!isGuest && (
              <button
                onClick={() => {
                  const newState = voiceNavigationService.toggle();
                  onSetVoiceEnabled(newState);
                }}
                className={`group relative w-14 h-14 sm:w-16 sm:h-16 lg:w-12 lg:h-12 min-w-[56px] min-h-[56px] lg:min-w-[48px] lg:min-h-[48px] rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation border-2 ${
                  voiceNavigationService.isEnabled()
                    ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white border-blue-400/30 hover:border-blue-300/50'
                    : 'bg-white/90 backdrop-blur-lg hover:bg-white text-gray-700 border-gray-200/50 hover:border-gray-300/70'
                }`}
                title={voiceNavigationService.isEnabled() ? 'Mute Voice' : 'Enable Voice'}
              >
                {voiceNavigationService.isEnabled() ? (
                  <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-5 lg:h-5 relative z-10" strokeWidth={2.5} />
                ) : (
                  <VolumeX className="w-6 h-6 sm:w-7 sm:h-7 lg:w-5 lg:h-5 relative z-10" strokeWidth={2.5} />
                )}
              </button>
            )}

            {/* Traffic Predictions Button - Large & Prominent */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetShowPredictionsPanel(true);
              }}
              className="group relative w-16 h-16 sm:w-20 sm:h-20 lg:w-14 lg:h-14 min-w-[64px] min-h-[64px] lg:min-w-[56px] lg:min-h-[56px] bg-gradient-to-br from-cyan-500 via-cyan-600 to-cyan-700 hover:from-cyan-600 hover:via-cyan-700 hover:to-cyan-800 backdrop-blur-lg text-white rounded-2xl shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center touch-manipulation border-2 border-cyan-400/30 hover:border-cyan-300/50"
              title="Traffic Predictions"
            >
              {/* Subtle glow effect */}
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              <BarChart3 className="w-7 h-7 sm:w-8 sm:h-8 lg:w-6 lg:h-6 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
            </button>
          </div>
        )}
          </div>
        );
      })()}
    </>
  );
};

export default MapControls;

