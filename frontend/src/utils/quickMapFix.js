/**
 * Quick Map Fix Utility
 * Run this in the browser console to diagnose and fix map issues
 */

export const quickMapFix = () => {

  // Check if Leaflet is loaded
  if (typeof L === 'undefined') {

    return false;
  }

  // Check if React Leaflet components are available
  try {
    const { MapContainer, TileLayer } = require('react-leaflet');

  } catch (error) {

    return false;
  }

  // Test OpenStreetMap tiles
  const testTileUrl = 'https://a.tile.openstreetmap.org/10/512/512.png';
  fetch(testTileUrl)
    .then(response => {
      if (response.ok) {

      } else {

      }
    })
    .catch(error => {

    });

  // Test TomTom API key
  const tomtomService = require('../services/tomtomService').default;
  if (tomtomService.apiKey) {

    // Test TomTom tile URL
    const tomtomTileUrl = tomtomService.getMapTileUrlTemplate('main');

    // Test a TomTom tile
    const testTomTomUrl = tomtomTileUrl.replace('{z}', '10').replace('{x}', '512').replace('{y}', '512');
    fetch(testTomTomUrl)
      .then(response => {
        if (response.ok) {

        } else {

        }
      })
      .catch(error => {

      });
  } else {

  }

  // Check usage stats
  const usageStats = tomtomService.getUsageStats();

  // Clear any cached data
  tomtomService.clearCache();

  // Test geocoding service
  const geocodingService = require('../services/enhancedGeocodingService').default;
  geocodingService.clearCache();


  return true;
};

// Auto-run if in development
if (import.meta.hot) {
  quickMapFix();
}

export default quickMapFix;
