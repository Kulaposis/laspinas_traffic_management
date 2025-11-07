/**
 * TomTom Maps Configuration
 * Configure your TomTom API settings here
 */

export const tomtomConfig = {
  // TomTom API Key - Get from https://developer.tomtom.com/
  // IMPORTANT: Replace with your own API key for production use
  apiKey: import.meta.env.VITE_TOMTOM_API_KEY || 'YOUR_TOMTOM_API_KEY_HERE',
  
  // API Base URLs
  baseUrl: 'https://api.tomtom.com',
  mapBaseUrl: 'https://api.tomtom.com/map/1',
  
  // Usage limits (free tier)
  dailyLimit: parseInt(import.meta.env.VITE_TOMTOM_DAILY_LIMIT) || 2500,
  
  // Feature flags - disabled by default until API key is configured
  enabled: import.meta.env.VITE_TOMTOM_ENABLED === 'true',
  
  // Map styles available
  mapStyles: {
    main: {
      name: 'TomTom Main',
      description: 'Standard TomTom map style',
      preview: '🗺️'
    },
    night: {
      name: 'TomTom Night',
      description: 'Dark theme for night viewing',
      preview: '🌙'
    },
    satellite: {
      name: 'TomTom Satellite',
      description: 'Satellite imagery',
      preview: '🛰️'
    },
    light_driving: {
      name: 'Light Driving',
      description: 'Light theme optimized for driving navigation',
      preview: '🚗'
    }
  },
  
  // Cache settings (increased to match time-based rate limiting)
  cacheTimeout: 2.5 * 60 * 60 * 1000, // 2.5 hours (matches rate limiting)
  trafficCacheTimeout: 24 * 60 * 60 * 1000, // 24 hours for traffic data (to reduce API calls)
  
  // Traffic flow settings - DISABLED to save API calls
  trafficFlowEnabled: false, // Set to false to disable automatic traffic flow fetching
  
  // Fallback settings
  fallbackToOSM: true,
  fallbackToBackend: true,
  
  // Request settings
  timeout: 30.0,
  maxRetries: 3
};

export default tomtomConfig;
