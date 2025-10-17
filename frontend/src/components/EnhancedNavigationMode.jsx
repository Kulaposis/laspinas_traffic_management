import React, { useState, useEffect, useRef } from 'react';
import { useMap, Marker, Polyline, Circle, Popup } from 'react-leaflet';
import L from 'leaflet';
import { 
  Navigation, 
  CornerUpRight, 
  CornerUpLeft, 
  ArrowUp, 
  Milestone,
  Clock,
  Target,
  MapPin,
  AlertTriangle,
  X,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Volume2,
  VolumeX,
  ZoomIn,
  Maximize2,
  Info
} from 'lucide-react';
import enhancedRoutingService from '../services/enhancedRoutingService';

// Custom user location marker with direction indicator (like Google Maps blue dot)
const createUserLocationMarker = (heading) => {
  const arrowRotation = heading || 0;
  
  return L.divIcon({
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <!-- Pulsing outer circle -->
        <div style="
          position: absolute;
          top: 12px;
          left: 12px;
          width: 24px;
          height: 24px;
          background-color: rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
        
        <!-- Main blue dot -->
        <div style="
          position: absolute;
          top: 16px;
          left: 16px;
          width: 16px;
          height: 16px;
          background-color: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          z-index: 2;
        "></div>
        
        <!-- Direction arrow -->
        <div style="
          position: absolute;
          top: 6px;
          left: 19px;
          width: 10px;
          height: 10px;
          transform: rotate(${arrowRotation}deg);
          transform-origin: center bottom;
          z-index: 3;
        ">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <path d="M5 0 L8 10 L5 8 L2 10 Z" />
          </svg>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `,
    className: 'user-location-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

// Maneuver icon with styling like Google Maps/Waze
const createManeuverIcon = (maneuverType) => {
  let icon = '↑';
  let color = '#3b82f6';
  
  const iconMap = {
    'turn-left': { icon: '↰', color: '#3b82f6' },
    'turn-right': { icon: '↱', color: '#3b82f6' },
    'sharp-left': { icon: '⮰', color: '#f59e0b' },
    'sharp-right': { icon: '⮱', color: '#f59e0b' },
    'keep-left': { icon: '⬉', color: '#22c55e' },
    'keep-right': { icon: '⬈', color: '#22c55e' },
    'straight': { icon: '↑', color: '#22c55e' },
    'uturn': { icon: '↺', color: '#ef4444' },
    'merge': { icon: '⤎', color: '#f59e0b' },
    'roundabout-enter': { icon: '↻', color: '#8b5cf6' },
    'roundabout-exit': { icon: '⮕', color: '#8b5cf6' },
    'exit': { icon: '⤴', color: '#f59e0b' },
    'arrive': { icon: '🏁', color: '#ef4444' }
  };
  
  if (iconMap[maneuverType]) {
    icon = iconMap[maneuverType].icon;
    color = iconMap[maneuverType].color;
  }
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
        font-weight: bold;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        ${icon}
      </div>
    `,
    className: 'maneuver-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const EnhancedNavigationMode = ({ 
  route, 
  origin, 
  destination,
  onExitNavigation
}) => {
  const map = useMap();
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [navigationProgress, setNavigationProgress] = useState(null);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [showRecalculatePrompt, setShowRecalculatePrompt] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState(null);
  const [mapCentering, setMapCentering] = useState(true); // Auto-center map on user
  const [showLaneGuidance, setShowLaneGuidance] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false); // Minimize instruction panel
  
  const navigationSessionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const mapContainerRef = useRef(null);
  
  useEffect(() => {
    // Validate route
    if (!route) {
      console.error('Invalid route for navigation: route is null');
      if (onExitNavigation) {
        setTimeout(() => onExitNavigation(), 100);
      }
      return;
    }
    
    if (!route.route_coordinates || !Array.isArray(route.route_coordinates)) {
      console.error('Invalid route for navigation: no coordinates array');
      if (onExitNavigation) {
        setTimeout(() => onExitNavigation(), 100);
      }
      return;
    }
    
    if (route.route_coordinates.length < 2) {
      console.error('Invalid route for navigation: insufficient coordinates');
      if (onExitNavigation) {
        setTimeout(() => onExitNavigation(), 100);
      }
      return;
    }
    
    // Validate origin and destination
    if (!origin || !destination) {
      console.error('Invalid navigation: missing origin or destination');
      if (onExitNavigation) {
        setTimeout(() => onExitNavigation(), 100);
      }
      return;
    }
    
    // Start navigation session
    try {
      navigationSessionRef.current = enhancedRoutingService.startNavigationSession(
        route,
        origin,
        destination
      );
    } catch (error) {
      console.error('Failed to start navigation session:', error);
      if (onExitNavigation) {
        setTimeout(() => onExitNavigation(), 100);
      }
      return;
    }
    
    // Calculate estimated arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (route.estimated_duration_minutes * 60 * 1000));
    setArrivalTime(arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesisRef.current = window.speechSynthesis;
    }
    
    // Start GPS tracking
    startNavigation();
    
    return () => {
      stopNavigation();
      enhancedRoutingService.endNavigationSession();
    };
  }, [route, origin, destination]);
  
  const startNavigation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }
    
    setIsNavigating(true);
    
    const id = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );
    
    setWatchId(id);
    
    // Device orientation for heading
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientationChange);
    }
  };
  
  const stopNavigation = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    if (window.DeviceOrientationEvent) {
      window.removeEventListener('deviceorientation', handleOrientationChange);
    }
    
    setIsNavigating(false);
  };
  
  const handlePositionUpdate = (position) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    
    const newUserLocation = {
      lat: latitude,
      lng: longitude,
      accuracy,
      speed,
      timestamp: position.timestamp
    };
    
    setUserLocation(newUserLocation);
    
    if (heading !== null && !isNaN(heading)) {
      setUserHeading(heading);
    }
    
    // Update navigation progress
    const progress = enhancedRoutingService.updateNavigationProgress(latitude, longitude);
    
    if (progress) {
      setNavigationProgress(progress);
      
      // Check if off route
      if (progress.closestPoint.distance > 50) {
        if (!isOffRoute) {
          setIsOffRoute(true);
          setShowRecalculatePrompt(true);
          announceVoice('You appear to be off route. Would you like to recalculate?');
        }
      } else {
        if (isOffRoute) {
          setIsOffRoute(false);
          setShowRecalculatePrompt(false);
        }
        
        // Voice announcements for upcoming maneuvers
        if (progress.nextStep && voiceEnabled) {
          handleVoiceAnnouncement(progress.nextStep, progress.closestPoint.distance);
        }
        
        // Show lane guidance if available
        if (progress.nextStep?.lane_info && progress.closestPoint.distance < 200) {
          setShowLaneGuidance(true);
        } else {
          setShowLaneGuidance(false);
        }
      }
      
      // Update arrival time based on progress
      if (progress.remaining) {
        const now = new Date();
        const newArrival = new Date(now.getTime() + (progress.remaining.time_minutes * 60 * 1000));
        setArrivalTime(newArrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
    
    // Auto-center map on user location
    if (mapCentering) {
      map.setView([latitude, longitude], map.getZoom(), {
        animate: true,
        duration: 0.5
      });
      
      // Optionally rotate map based on heading (advanced feature)
      // This would require a custom map rotation plugin
    }
  };
  
  const handleOrientationChange = (event) => {
    if (event.webkitCompassHeading) {
      setUserHeading(event.webkitCompassHeading);
    } else if (event.alpha !== null) {
      setUserHeading(360 - event.alpha);
    }
  };
  
  const handlePositionError = (error) => {
    console.error('Position error:', error.message);
  };
  
  const handleVoiceAnnouncement = (step, distanceToStep) => {
    if (!voiceEnabled || !step) return;
    
    // Announce at specific distances
    const shouldAnnounce = 
      (distanceToStep < 100 && distanceToStep > 50 && lastAnnouncedStep !== `${step.index}_near`) ||
      (distanceToStep < 30 && lastAnnouncedStep !== `${step.index}_now`);
    
    if (shouldAnnounce) {
      const instruction = enhancedRoutingService.formatInstruction(step, distanceToStep);
      announceVoice(instruction);
      
      if (distanceToStep < 30) {
        setLastAnnouncedStep(`${step.index}_now`);
      } else {
        setLastAnnouncedStep(`${step.index}_near`);
      }
    }
  };
  
  const announceVoice = (text) => {
    if (!speechSynthesisRef.current) return;
    
    // Cancel any ongoing speech
    speechSynthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    speechSynthesisRef.current.speak(utterance);
  };
  
  const handleRecalculateRoute = async () => {
    if (!userLocation || !destination) return;
    
    try {
      setShowRecalculatePrompt(false);
      
      const newRouteData = await enhancedRoutingService.getDetailedRoute(
        userLocation.lat,
        userLocation.lng,
        destination.lat,
        destination.lon,
        { avoidTraffic: true }
      );
      
      if (newRouteData && newRouteData.routes && newRouteData.routes.length > 0) {
        const newRoute = newRouteData.recommended_route || newRouteData.routes[0];
        
        // Update navigation session
        navigationSessionRef.current = enhancedRoutingService.startNavigationSession(
          newRoute,
          { lat: userLocation.lat, lon: userLocation.lng, name: 'Current Location' },
          destination
        );
        
        setIsOffRoute(false);
        announceVoice('Route recalculated');
      }
    } catch (error) {
      console.error('Recalculation error:', error);
    }
  };
  
  const getManeuverDisplayIcon = (maneuverType) => {
    const iconMap = {
      'turn-right': <CornerUpRight size={36} className="text-white" />,
      'turn-left': <CornerUpLeft size={36} className="text-white" />,
      'straight': <ArrowUp size={36} className="text-white" />,
      'uturn': <RotateCcw size={36} className="text-white" />,
      'arrive': <MapPin size={36} className="text-white" />
    };
    
    return iconMap[maneuverType] || <ChevronRight size={36} className="text-white" />;
  };
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      // Enter fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { // IE11
        elem.msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { // Safari
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { // IE11
        document.msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };
  
  // Listen for fullscreen changes (user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  return (
    <>
      {/* Route polyline */}
      {route && route.route_coordinates && route.route_coordinates.length >= 2 && (
        <>
          {/* Outline for better visibility */}
          <Polyline
            positions={route.route_coordinates.map(coord => [coord[0], coord[1]])}
            color="#ffffff"
            weight={10}
            opacity={0.7}
            interactive={false}
          />
          
          {/* Main route line */}
          <Polyline
            positions={route.route_coordinates.map(coord => [coord[0], coord[1]])}
            color={isOffRoute ? "#ef4444" : "#3b82f6"}
            weight={6}
            opacity={0.9}
          />
        </>
      )}
      
      {/* User location marker */}
      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy || 20}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1
            }}
          />
          
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserLocationMarker(userHeading)}
            zIndexOffset={1000}
          />
        </>
      )}
      
      {/* Next maneuver marker */}
      {navigationProgress?.nextStep && navigationProgress.nextStep.location && (
        <Marker
          position={[navigationProgress.nextStep.location[0], navigationProgress.nextStep.location[1]]}
          icon={createManeuverIcon(navigationProgress.nextStep.maneuver_type)}
          zIndexOffset={900}
        >
          <Popup>
            <div className="p-2">
              <div className="text-sm font-medium">{navigationProgress.nextStep.instruction}</div>
              {navigationProgress.nextStep.street_name && (
                <div className="text-xs text-gray-600 mt-1">
                  {navigationProgress.nextStep.street_name}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Destination marker */}
      {destination && (
        <Marker
          position={[destination.lat, destination.lon]}
          icon={L.divIcon({
            html: `
              <div style="background-color: #ef4444; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                B
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })}
          zIndexOffset={800}
        >
          <Popup>
            <div className="p-2">
              <div className="font-semibold">{destination.name}</div>
              {destination.display_name && (
                <div className="text-xs text-gray-600">{destination.display_name}</div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Google Maps/Waze-style Navigation UI */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1000 }}>
        {/* Top bar with ETA and exit button */}
        <div className="p-3 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-4 flex items-center justify-between">
            <button
              onClick={onExitNavigation}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              title="Exit navigation"
            >
              <X size={24} className="text-gray-600" />
            </button>
            
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{arrivalTime}</div>
                <div className="text-xs text-gray-500">Estimated arrival</div>
              </div>
              
              {navigationProgress?.remaining && (
                <>
                  <div className="text-center">
                    <div className="text-xl font-semibold text-gray-900">
                      {enhancedRoutingService.formatDuration(navigationProgress.remaining.time_minutes)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {enhancedRoutingService.formatDistance(navigationProgress.remaining.distance_meters)}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2 rounded-full transition-colors ${
                  voiceEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}
                title={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
              >
                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              
              <button
                onClick={() => setMapCentering(!mapCentering)}
                className={`p-2 rounded-full transition-colors ${
                  mapCentering ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                }`}
                title="Toggle map centering"
              >
                <Target size={20} />
              </button>
              
              <button
                onClick={toggleFullscreen}
                className={`p-2 rounded-full transition-colors ${
                  isFullscreen ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                <Maximize2 size={20} />
              </button>
              
              {navigationProgress?.nextStep && (
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  title={isMinimized ? 'Show instructions' : 'Minimize instructions'}
                >
                  {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Large maneuver instruction (like Google Maps) */}
        {navigationProgress?.nextStep && !isMinimized && (
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
              <div className="p-6 flex items-center space-x-6">
                {/* Maneuver Icon */}
                <div className="flex-shrink-0 bg-blue-500 rounded-2xl p-4 shadow-lg">
                  {getManeuverDisplayIcon(navigationProgress.nextStep.maneuver_type)}
                </div>
                
                {/* Instruction */}
                <div className="flex-1">
                  <div className="text-white text-4xl font-bold mb-2">
                    {enhancedRoutingService.formatDistance(
                      enhancedRoutingService.calculateDistance(
                        userLocation?.lat || 0,
                        userLocation?.lng || 0,
                        navigationProgress.nextStep.location?.[0] || 0,
                        navigationProgress.nextStep.location?.[1] || 0
                      )
                    )}
                  </div>
                  <div className="text-blue-100 text-lg font-medium">
                    {navigationProgress.nextStep.instruction}
                  </div>
                  {navigationProgress.nextStep.street_name && (
                    <div className="text-blue-200 text-sm mt-1">
                      onto {navigationProgress.nextStep.street_name}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Lane Guidance */}
              {showLaneGuidance && navigationProgress.nextStep.lane_info && (
                <div className="bg-blue-800 px-6 py-3 border-t border-blue-600">
                  <div className="flex items-center space-x-2">
                    <div className="text-blue-200 text-xs font-medium">LANE GUIDANCE</div>
                    <div className="flex space-x-1">
                      {navigationProgress.nextStep.lane_info.map((lane, idx) => (
                        <div
                          key={idx}
                          className={`w-8 h-12 rounded flex items-center justify-center text-xs font-bold ${
                            lane.is_recommended
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-700 text-blue-300'
                          }`}
                        >
                          {lane.directions.join('')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Minimized instruction bar */}
        {navigationProgress?.nextStep && isMinimized && (
          <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-auto">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-500 rounded-xl p-2">
                  {getManeuverDisplayIcon(navigationProgress.nextStep.maneuver_type)}
                </div>
                <div>
                  <div className="text-white text-2xl font-bold">
                    {enhancedRoutingService.formatDistance(
                      enhancedRoutingService.calculateDistance(
                        userLocation?.lat || 0,
                        userLocation?.lng || 0,
                        navigationProgress.nextStep.location?.[0] || 0,
                        navigationProgress.nextStep.location?.[1] || 0
                      )
                    )}
                  </div>
                  <div className="text-blue-100 text-sm">
                    {navigationProgress.nextStep.instruction}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsMinimized(false)}
                className="p-2 bg-blue-500 hover:bg-blue-400 rounded-full transition-colors"
              >
                <ChevronUp size={20} className="text-white" />
              </button>
            </div>
          </div>
        )}
        
        {/* Off-route recalculation prompt */}
        {showRecalculatePrompt && (
          <div className="absolute top-24 left-4 right-4 pointer-events-auto">
            <div className="bg-orange-500 text-white rounded-xl shadow-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle size={24} />
                <div>
                  <div className="font-semibold">You're off route</div>
                  <div className="text-sm text-orange-100">Recalculate to get back on track</div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowRecalculatePrompt(false)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleRecalculateRoute}
                  className="px-4 py-2 bg-white text-orange-600 hover:bg-orange-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Recalculate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default EnhancedNavigationMode;

