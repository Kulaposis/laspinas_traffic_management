import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage map preferences with localStorage persistence
 * Saves and restores user preferences for map settings (heatmap, traffic layer, night mode)
 */
const useMapPreferences = () => {
  const STORAGE_KEY = 'traffic_map_preferences';
  
  // Default preferences
  const defaultPreferences = {
    heatmapEnabled: false,
    trafficLayerEnabled: false,
    mapStyle: 'main', // 'main' | 'night' | 'satellite'
  };

  // Load preferences from localStorage on mount
  const loadPreferences = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing properties
        return { ...defaultPreferences, ...parsed };
      }
    } catch (error) {
      console.error('Error loading map preferences:', error);
    }
    return defaultPreferences;
  }, []);

  // Initialize state with loaded preferences
  const [heatmapEnabled, setHeatmapEnabledState] = useState(() => {
    const prefs = loadPreferences();
    return prefs.heatmapEnabled;
  });
  
  const [trafficLayerEnabled, setTrafficLayerEnabledState] = useState(() => {
    const prefs = loadPreferences();
    return prefs.trafficLayerEnabled;
  });
  
  const [mapStyle, setMapStyleState] = useState(() => {
    const prefs = loadPreferences();
    return prefs.mapStyle;
  });

  // Save preferences to localStorage
  const savePreferences = useCallback((updates) => {
    try {
      const current = loadPreferences();
      const updated = { ...current, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving map preferences:', error);
    }
  }, [loadPreferences]);

  // Wrapped setters that update both state and localStorage
  const setHeatmapEnabled = useCallback((value) => {
    setHeatmapEnabledState(value);
    savePreferences({ heatmapEnabled: value });
  }, [savePreferences]);

  const setTrafficLayerEnabled = useCallback((value) => {
    setTrafficLayerEnabledState(value);
    savePreferences({ trafficLayerEnabled: value });
  }, [savePreferences]);

  const setMapStyle = useCallback((value) => {
    setMapStyleState(value);
    // Don't save 'light_driving' to preferences - it's only for simulation/navigation
    // Only save user-selected styles: 'main', 'night', 'satellite'
    if (value !== 'light_driving') {
      savePreferences({ mapStyle: value });
    }
  }, [savePreferences]);

  // Listen for storage changes (in case preferences are changed in another tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setHeatmapEnabledState(parsed.heatmapEnabled ?? defaultPreferences.heatmapEnabled);
          setTrafficLayerEnabledState(parsed.trafficLayerEnabled ?? defaultPreferences.trafficLayerEnabled);
          setMapStyleState(parsed.mapStyle ?? defaultPreferences.mapStyle);
        } catch (error) {
          console.error('Error parsing storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    heatmapEnabled,
    setHeatmapEnabled,
    trafficLayerEnabled,
    setTrafficLayerEnabled,
    mapStyle,
    setMapStyle,
  };
};

export default useMapPreferences;

