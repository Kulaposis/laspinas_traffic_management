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
  Compass,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import smartRoutingService from '../services/smartRoutingService';
import geocodingService from '../services/geocodingService';
import routeSmoothingService from '../services/routeSmoothingService';

// Custom user location marker with direction indicator
const createUserLocationMarker = (heading) => {
  const arrowRotation = heading || 0;
  
  return L.divIcon({
    html: `
      <div class="relative">
        <div class="w-12 h-12 rounded-full bg-blue-500 border-4 border-white shadow-lg flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-white flex items-center justify-center">
            <div class="w-4 h-4 rounded-full bg-blue-500"></div>
          </div>
        </div>
        <div class="absolute top-0 left-0 w-12 h-12 flex items-center justify-center">
          <div style="transform: rotate(${arrowRotation}deg); transform-origin: center;" class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-white"></div>
        </div>
      </div>
    `,
    className: 'user-location-marker',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

// Custom maneuver icon
const createManeuverIcon = (maneuverType) => {
  let bgColor = '#3b82f6'; // Default blue
  let icon = '→';
  
  switch (maneuverType) {
    case 'turn-right':
      icon = '↱';
      break;
    case 'turn-left':
      icon = '↰';
      break;
    case 'straight':
      icon = '↑';
      break;
    case 'uturn':
      icon = '↺';
      break;
    case 'merge':
      icon = '⤎';
      break;
    case 'fork':
      icon = '⑂';
      break;
    case 'roundabout':
      icon = '↻';
      break;
    case 'exit':
      icon = '⤴';
      break;
    case 'arrive':
      bgColor = '#ef4444'; // Red for destination
      icon = '⦿';
      break;
    default:
      icon = '→';
  }
  
  return L.divIcon({
    html: `
      <div style="background-color: ${bgColor}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
        ${icon}
      </div>
    `,
    className: 'maneuver-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const NavigationMode = ({ 
  route, 
  origin, 
  destination,
  onExitNavigation,
  showRemainingRoute = true
}) => {
  const map = useMap();
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [remainingRoute, setRemainingRoute] = useState(route?.route_coordinates || []);
  const [nextManeuver, setNextManeuver] = useState(null);
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState(null);
  const [timeToDestination, setTimeToDestination] = useState(route?.estimated_duration_minutes || 0);
  const [distanceToDestination, setDistanceToDestination] = useState(route?.distance_km || 0);
  const [showRecalculatePrompt, setShowRecalculatePrompt] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const locationUpdateRef = useRef(0);
  const routeRef = useRef(route);
  const remainingTimeRef = useRef(route?.estimated_duration_minutes || 0);
  
  // Initialize navigation
  useEffect(() => {
    if (!route || !route.route_coordinates || route.route_coordinates.length === 0) {
      console.error('Invalid route for navigation');
      return;
    }
    
    routeRef.current = route;
    setRemainingRoute(route.route_coordinates);
    
    // Calculate estimated arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (route.estimated_duration_minutes * 60 * 1000));
    setArrivalTime(arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Start navigation
    startNavigation();
    
    // Clean up on unmount
    return () => {
      stopNavigation();
    };
  }, [route]);
  
  // Start GPS tracking and navigation
  const startNavigation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by your browser');
      return;
    }
    
    setIsNavigating(true);
    
    // Start watching user's position with high accuracy
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
    
    // Start device orientation tracking for heading
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientationChange);
    }
  };
  
  // Stop navigation and cleanup
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
  
  // Handle user's position updates
  const handlePositionUpdate = (position) => {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    locationUpdateRef.current++;
    
    // Update user location
    const newUserLocation = {
      lat: latitude,
      lng: longitude,
      accuracy,
      speed,
      timestamp: position.timestamp
    };
    
    setUserLocation(newUserLocation);
    
    // Update heading if available from GPS
    if (heading !== null && !isNaN(heading)) {
      setUserHeading(heading);
    }
    
    // Center map on user's location (only for first few updates)
    if (locationUpdateRef.current <= 3) {
      map.setView([latitude, longitude], 18, {
        animate: true,
        duration: 1
      });
    }
    
    // Process navigation logic
    updateNavigation(newUserLocation);
  };
  
  // Handle device orientation for heading
  const handleOrientationChange = (event) => {
    if (event.webkitCompassHeading) {
      // For iOS devices
      setUserHeading(event.webkitCompassHeading);
    } else if (event.alpha !== null) {
      // For Android devices
      setUserHeading(360 - event.alpha);
    }
  };
  
  // Handle position errors
  const handlePositionError = (error) => {
    console.error('Error getting user location:', error.message);
    // Show error message to user
  };
  
  // Update navigation based on user's current position
  const updateNavigation = (userLocation) => {
    if (!routeRef.current || !routeRef.current.route_coordinates || !userLocation) return;
    
    // Find closest point on route to user's location
    const closestPointInfo = findClosestPointOnRoute(
      userLocation, 
      routeRef.current.route_coordinates
    );
    
    // Check if user is off route
    if (closestPointInfo.distance > 50) { // 50 meters threshold
      if (!isOffRoute) {
        setIsOffRoute(true);
        setShowRecalculatePrompt(true);
      }
    } else {
      if (isOffRoute) {
        setIsOffRoute(false);
        setShowRecalculatePrompt(false);
      }
      
      // Update remaining route from closest point
      if (closestPointInfo.index < routeRef.current.route_coordinates.length - 1) {
        const updatedRoute = routeRef.current.route_coordinates.slice(closestPointInfo.index);
        setRemainingRoute(updatedRoute);
        
        // Update next maneuver
        updateNextManeuver(closestPointInfo.index);
        
        // Update remaining time and distance
        updateRemainingTimeAndDistance(closestPointInfo.index);
      }
      
      // Check if arrived at destination
      const distanceToDestination = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        destination.lat,
        destination.lon
      );
      
      if (distanceToDestination < 30) { // 30 meters threshold for arrival
        handleArrival();
      }
    }
  };
  
  // Find closest point on route to user's location
  const findClosestPointOnRoute = (userLocation, routeCoordinates) => {
    let minDistance = Infinity;
    let closestIndex = 0;
    
    for (let i = 0; i < routeCoordinates.length; i++) {
      const point = routeCoordinates[i];
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        point[0],
        point[1]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return { index: closestIndex, distance: minDistance };
  };
  
  // Calculate distance between two points in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
  };
  
  // Update next maneuver based on current position
  const updateNextManeuver = (currentIndex) => {
    if (!routeRef.current || !routeRef.current.steps) return;
    
    // Find the next maneuver
    const nextStep = routeRef.current.steps?.find(step => 
      step.index > currentIndex
    );
    
    if (nextStep) {
      setNextManeuver(nextStep);
      
      // Calculate distance to next maneuver
      if (currentIndex < routeRef.current.route_coordinates.length) {
        const currentPoint = routeRef.current.route_coordinates[currentIndex];
        const maneuverPoint = routeRef.current.route_coordinates[nextStep.index];
        
        if (currentPoint && maneuverPoint) {
          const distance = calculateDistance(
            currentPoint[0], currentPoint[1],
            maneuverPoint[0], maneuverPoint[1]
          );
          
          setDistanceToNextManeuver(distance);
        }
      }
    } else {
      // No more maneuvers, approaching destination
      setNextManeuver({
        maneuver_type: 'arrive',
        instruction: 'Arrive at destination',
        index: routeRef.current.route_coordinates.length - 1
      });
      
      // Calculate distance to destination
      if (currentIndex < routeRef.current.route_coordinates.length) {
        const currentPoint = routeRef.current.route_coordinates[currentIndex];
        const destPoint = routeRef.current.route_coordinates[routeRef.current.route_coordinates.length - 1];
        
        if (currentPoint && destPoint) {
          const distance = calculateDistance(
            currentPoint[0], currentPoint[1],
            destPoint[0], destPoint[1]
          );
          
          setDistanceToNextManeuver(distance);
        }
      }
    }
  };
  
  // Update remaining time and distance
  const updateRemainingTimeAndDistance = (currentIndex) => {
    if (!routeRef.current || !routeRef.current.route_coordinates) return;
    
    // Calculate remaining distance
    let remainingDistance = 0;
    for (let i = currentIndex; i < routeRef.current.route_coordinates.length - 1; i++) {
      const point1 = routeRef.current.route_coordinates[i];
      const point2 = routeRef.current.route_coordinates[i + 1];
      
      remainingDistance += calculateDistance(
        point1[0], point1[1],
        point2[0], point2[1]
      );
    }
    
    // Convert to kilometers
    const remainingDistanceKm = remainingDistance / 1000;
    setDistanceToDestination(remainingDistanceKm);
    
    // Calculate remaining time based on proportion of distance traveled
    const totalDistance = routeRef.current.distance_km || 0;
    const totalTime = routeRef.current.estimated_duration_minutes || 0;
    
    if (totalDistance > 0) {
      const remainingTime = (remainingDistanceKm / totalDistance) * totalTime;
      setTimeToDestination(remainingTime);
      remainingTimeRef.current = remainingTime;
      
      // Update arrival time
      const now = new Date();
      const arrivalTime = new Date(now.getTime() + (remainingTime * 60 * 1000));
      setArrivalTime(arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };
  
  // Handle arrival at destination
  const handleArrival = () => {
    // Show arrival notification
    setNextManeuver({
      maneuver_type: 'arrive',
      instruction: 'You have arrived at your destination',
      index: routeRef.current.route_coordinates.length - 1
    });
    
    setTimeToDestination(0);
    setDistanceToDestination(0);
    
    // Stop navigation after a delay
    setTimeout(() => {
      stopNavigation();
    }, 5000);
  };
  
  // Handle recalculation of route
  const handleRecalculateRoute = async () => {
    if (!userLocation || !destination) return;
    
    try {
      // Get current location as origin
      const origin = {
        lat: userLocation.lat,
        lon: userLocation.lng,
        name: 'Current Location'
      };
      
      // Request new route
      const routeData = await smartRoutingService.getSmartRoutes(
        origin.lat,
        origin.lon,
        destination.lat,
        destination.lon,
        true // Avoid traffic
      );
      
      if (routeData.routes && routeData.routes.length > 0) {
        // Use recommended route or first route
        const newRoute = routeData.recommended_route || routeData.routes[0];
        
        // Update route reference
        routeRef.current = newRoute;
        setRemainingRoute(newRoute.route_coordinates);
        
        // Update navigation parameters
        setTimeToDestination(newRoute.estimated_duration_minutes);
        setDistanceToDestination(newRoute.distance_km);
        
        // Update arrival time
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + (newRoute.estimated_duration_minutes * 60 * 1000));
        setArrivalTime(arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        
        // Reset off-route status
        setIsOffRoute(false);
        setShowRecalculatePrompt(false);
      }
    } catch (error) {
      console.error('Error recalculating route:', error);
    }
  };
  
  // Format distance for display
  const formatDistance = (meters) => {
    if (!meters && meters !== 0) return '';
    
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };
  
  // Get maneuver icon based on type
  const getManeuverIcon = (maneuverType) => {
    switch (maneuverType) {
      case 'turn-right':
        return <CornerUpRight size={24} />;
      case 'turn-left':
        return <CornerUpLeft size={24} />;
      case 'straight':
        return <ArrowUp size={24} />;
      case 'uturn':
        return <RotateCcw size={24} />;
      case 'arrive':
        return <MapPin size={24} />;
      default:
        return <ChevronRight size={24} />;
    }
  };
  
  // Toggle navigation instructions panel
  const toggleInstructions = () => {
    setShowInstructions(!showInstructions);
  };
  
  return (
    <>
      {/* Remaining route polyline */}
      {showRemainingRoute && remainingRoute && remainingRoute.length >= 2 && (
        <>
          {/* Route outline for better visibility */}
          <Polyline
            positions={remainingRoute.map(coord => [coord[0], coord[1]])}
            color="#ffffff"
            weight={12}
            opacity={0.8}
            className="route-outline"
            interactive={false}
          />
          
          {/* Main route line */}
          <Polyline
            positions={remainingRoute.map(coord => [coord[0], coord[1]])}
            color={isOffRoute ? "#ef4444" : "#3b82f6"}
            weight={6}
            opacity={0.9}
            className="route-line"
          />
        </>
      )}
      
      {/* User location marker */}
      {userLocation && (
        <>
          {/* Accuracy circle */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={userLocation.accuracy}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1
            }}
          />
          
          {/* User marker with direction */}
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserLocationMarker(userHeading)}
            zIndexOffset={1000}
          />
        </>
      )}
      
      {/* Next maneuver marker */}
      {nextManeuver && nextManeuver.index && routeRef.current && routeRef.current.route_coordinates && (
        <Marker
          position={[
            routeRef.current.route_coordinates[nextManeuver.index][0],
            routeRef.current.route_coordinates[nextManeuver.index][1]
          ]}
          icon={createManeuverIcon(nextManeuver.maneuver_type)}
          zIndexOffset={900}
        >
          <Popup>
            <div className="p-2">
              <div className="text-sm font-medium">{nextManeuver.instruction}</div>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Destination marker */}
      {destination && (
        <Marker
          position={[destination.lat, destination.lon]}
          icon={createCustomIcon('#ef4444', 'destination')}
          zIndexOffset={800}
        >
          <Popup>
            <div className="p-2">
              <div className="font-semibold">{destination.name}</div>
              <div className="text-xs text-gray-600">{destination.display_name}</div>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Navigation UI */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        {/* Top navigation bar */}
        <div className="bg-white bg-opacity-90 shadow-md p-3 m-2 rounded-lg pointer-events-auto">
          <div className="flex justify-between items-center">
            <button 
              onClick={onExitNavigation} 
              className="p-2 rounded-full hover:bg-gray-200"
              title="Exit navigation"
            >
              <X size={20} />
            </button>
            
            <div className="text-center">
              <div className="text-sm text-gray-600">Arriving at</div>
              <div className="font-semibold">{arrivalTime}</div>
            </div>
            
            <div className="flex items-center">
              <button 
                onClick={toggleInstructions}
                className="p-2 rounded-full hover:bg-gray-200 mr-1"
                title={showInstructions ? "Hide instructions" : "Show instructions"}
              >
                {showInstructions ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              <button
                onClick={onExitNavigation}
                className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                title="Cancel trip"
              >
                <span className="text-xs font-medium px-1">Cancel</span>
              </button>
            </div>
          </div>
          
          {/* Navigation instructions */}
          {showInstructions && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              {/* Next maneuver */}
              {nextManeuver && (
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-500 text-white p-2 rounded-lg">
                    {getManeuverIcon(nextManeuver.maneuver_type)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{nextManeuver.instruction}</div>
                    {distanceToNextManeuver !== null && (
                      <div className="text-sm text-gray-600">
                        In {formatDistance(distanceToNextManeuver)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Route summary */}
              <div className="flex justify-between mt-3 text-sm text-gray-600">
                <div className="flex items-center">
                  <Clock size={16} className="mr-1" />
                  <span>{Math.round(timeToDestination)} min</span>
                </div>
                <div className="flex items-center">
                  <Milestone size={16} className="mr-1" />
                  <span>{distanceToDestination.toFixed(1)} km</span>
                </div>
                <div className="flex items-center">
                  <Target size={16} className="mr-1" />
                  <span>{arrivalTime}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Off-route recalculation prompt */}
      {showRecalculatePrompt && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
          <div className="bg-white bg-opacity-90 shadow-lg rounded-lg p-4 pointer-events-auto">
            <div className="flex items-center mb-2">
              <AlertTriangle size={20} className="text-orange-500 mr-2" />
              <div className="font-medium">You appear to be off route</div>
            </div>
            <div className="flex justify-end space-x-2 mt-2">
              <button 
                onClick={() => setShowRecalculatePrompt(false)} 
                className="px-3 py-1 text-gray-700 hover:bg-gray-200 rounded"
              >
                Dismiss
              </button>
              <button 
                onClick={handleRecalculateRoute} 
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Recalculate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper function to create custom icon for destination
const createCustomIcon = (color, type) => {
  const iconHtml = type === 'origin' 
    ? `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">A</div>`
    : `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">B</div>`;
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-route-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

export default NavigationMode;
