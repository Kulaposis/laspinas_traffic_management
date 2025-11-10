import { useState, useEffect, useCallback } from 'react';

/**
 * useDeviceOrientation - Hook to track device orientation for map rotation
 * Supports both iOS and Android devices
 */
export const useDeviceOrientation = (enabled = false) => {
  const [heading, setHeading] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Request permission for device orientation (iOS 13+)
  const requestPermission = useCallback(async () => {
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        const granted = permission === 'granted';
        setPermissionGranted(granted);
        return granted;
      } catch (error) {
        console.error('Error requesting device orientation permission:', error);
        return false;
      }
    } else {
      // Android or older iOS - no permission needed
      setPermissionGranted(true);
      return true;
    }
  }, []);

  // Handle device orientation event
  const handleOrientation = useCallback((event) => {
    if (!enabled) return;

    let compassHeading = 0;
    let deviceTilt = 0;

    // iOS devices (webkitCompassHeading)
    if (event.webkitCompassHeading !== undefined) {
      compassHeading = event.webkitCompassHeading;
    }
    // Android devices (alpha)
    else if (event.alpha !== null && event.alpha !== undefined) {
      // Convert device orientation to compass heading
      // Alpha: 0-360 degrees (rotation around z-axis)
      compassHeading = 360 - event.alpha;
    }

    // Get device tilt (beta: front-to-back tilt)
    if (event.beta !== null && event.beta !== undefined) {
      deviceTilt = event.beta;
    }

    // Normalize heading to 0-360 range
    compassHeading = ((compassHeading % 360) + 360) % 360;

    setHeading(compassHeading);
    setTilt(deviceTilt);
  }, [enabled]);

  // Check if device orientation is supported
  useEffect(() => {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      setIsSupported(true);
    }
  }, []);

  // Add/remove event listener
  useEffect(() => {
    if (!enabled || !isSupported) return;

    // Request permission first (for iOS)
    const setupListener = async () => {
      const granted = await requestPermission();
      if (granted) {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    };

    setupListener();

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [enabled, isSupported, handleOrientation, requestPermission]);

  return {
    heading,
    tilt,
    isSupported,
    permissionGranted,
    requestPermission
  };
};

/**
 * useGeolocationHeading - Hook to get heading from GPS
 * Fallback when device orientation is not available
 */
export const useGeolocationHeading = (enabled = false) => {
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [watchId, setWatchId] = useState(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.heading !== null && position.coords.heading !== undefined) {
          setHeading(position.coords.heading);
        }
        if (position.coords.speed !== null && position.coords.speed !== undefined) {
          // Convert m/s to km/h
          setSpeed(position.coords.speed * 3.6);
        }
      },
      (error) => {
        console.error('Error getting geolocation heading:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    setWatchId(id);

    return () => {
      if (id !== null) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [enabled]);

  return { heading, speed };
};

export default useDeviceOrientation;

