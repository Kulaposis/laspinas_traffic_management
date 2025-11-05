import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom Hook for GPS Location Tracking
 * Manages user location tracking and updates
 */
export const useLocationTracking = (isNavigationActive = false) => {
  const [userLocation, setUserLocation] = useState(null);
  const [locationWatchId, setLocationWatchId] = useState(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);

  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {

      return;
    }

    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        setUserLocation(location);
        setIsTrackingLocation(true);
      },
      (error) => {

        setIsTrackingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    setLocationWatchId(watchId);
  }, [locationWatchId]);

  const stopLocationTracking = useCallback(() => {
    if (locationWatchId) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }
    setIsTrackingLocation(false);
    setUserLocation(null);
  }, [locationWatchId]);

  useEffect(() => {
    if (isNavigationActive) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [isNavigationActive, startLocationTracking, stopLocationTracking]);

  return {
    userLocation,
    isTrackingLocation,
    startLocationTracking,
    stopLocationTracking
  };
};



