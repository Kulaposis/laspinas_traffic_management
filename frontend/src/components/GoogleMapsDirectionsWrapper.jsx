import React from 'react';
import GoogleMapsStyleNavigation from './GoogleMapsStyleNavigation';

/**
 * Wrapper component to integrate Google Maps style navigation
 * with existing TrafficMap data
 */
const GoogleMapsDirectionsWrapper = ({
  isOpen,
  onClose,
  origin,
  destination,
  routes = [],
  selectedRoute,
  onSelectRoute,
  onStartNavigation,
  onStartSimulation
}) => {
  if (!isOpen) return null;

  // Transform routes to Google Maps format
  const formattedRoutes = routes.map((route, index) => {
    const duration = Math.round(route.estimated_duration_minutes || route.duration || 0);
    const distance = route.distance_km 
      ? `${route.distance_km.toFixed(1)} km` 
      : route.distance || '0 km';
    
    // Calculate arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + duration * 60000);
    const formattedTime = arrivalTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return {
      duration,
      distance,
      arrivalTime: formattedTime,
      label: route.route_name || route.summary?.description || `Route ${index + 1}`,
      isBest: route.is_recommended || index === 0,
      hasRestrictions: route.has_tolls || route.has_restrictions || false
    };
  });

  const handleStart = () => {
    if (onStartNavigation) {
      onStartNavigation(selectedRoute || routes[0]);
    }
  };

  const handleSave = () => {
    // Implement save functionality
    console.log('Save route');
  };

  return (
    <GoogleMapsStyleNavigation
      origin={origin?.name || 'Your location'}
      destination={destination?.name || 'Destination'}
      routes={formattedRoutes.length > 0 ? formattedRoutes : [
        { 
          duration: 36, 
          distance: "11 km", 
          arrivalTime: "2:01 PM", 
          label: "Best route", 
          isBest: true 
        }
      ]}
      onStart={handleStart}
      onSave={handleSave}
      onClose={onClose}
    />
  );
};

export default GoogleMapsDirectionsWrapper;

