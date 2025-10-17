/**
 * Quick Map Fix Utility
 * Run this in the browser console to diagnose and fix map issues
 */

export const quickMapFix = () => {
  console.log('🔧 Running Quick Map Fix...');
  
  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {
    console.error('❌ Leaflet is not loaded');
    return false;
  }
  console.log('✅ Leaflet is loaded');

  // Check if React Leaflet components are available
  try {
    const { MapContainer, TileLayer } = require('react-leaflet');
    console.log('✅ React Leaflet components are available');
  } catch (error) {
    console.error('❌ React Leaflet components not available:', error);
    return false;
  }

  // Test OpenStreetMap tiles
  const testTileUrl = 'https://a.tile.openstreetmap.org/10/512/512.png';
  fetch(testTileUrl)
    .then(response => {
      if (response.ok) {
        console.log('✅ OpenStreetMap tiles are accessible');
      } else {
        console.error('❌ OpenStreetMap tiles not accessible:', response.status);
      }
    })
    .catch(error => {
      console.error('❌ Network error testing OpenStreetMap:', error);
    });

  // Test TomTom API key
  const tomtomService = require('../services/tomtomService').default;
  if (tomtomService.apiKey) {
    console.log('✅ TomTom API key is set');
    
    // Test TomTom tile URL
    const tomtomTileUrl = tomtomService.getMapTileUrlTemplate('main');
    console.log('TomTom tile URL template:', tomtomTileUrl);
    
    // Test a TomTom tile
    const testTomTomUrl = tomtomTileUrl.replace('{z}', '10').replace('{x}', '512').replace('{y}', '512');
    fetch(testTomTomUrl)
      .then(response => {
        if (response.ok) {
          console.log('✅ TomTom tiles are accessible');
        } else {
          console.warn('⚠️ TomTom tiles not accessible:', response.status);
        }
      })
      .catch(error => {
        console.warn('⚠️ Network error testing TomTom:', error);
      });
  } else {
    console.warn('⚠️ TomTom API key is not set');
  }

  // Check usage stats
  const usageStats = tomtomService.getUsageStats();
  console.log('📊 Usage Stats:', usageStats);

  // Clear any cached data
  tomtomService.clearCache();
  console.log('🧹 Cleared TomTom service cache');

  // Test geocoding service
  const geocodingService = require('../services/enhancedGeocodingService').default;
  geocodingService.clearCache();
  console.log('🧹 Cleared geocoding service cache');

  console.log('✅ Quick Map Fix completed');
  return true;
};

// Auto-run if in development
if (import.meta.hot) {
  quickMapFix();
}

export default quickMapFix;
