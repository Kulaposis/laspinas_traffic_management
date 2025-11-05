/**
 * TomTom Integration Test Utility
 * Test script to verify TomTom API integration and fallback functionality
 */

import tomtomService from '../services/tomtomService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';

export const testTomTomIntegration = async () => {

  const results = {
    tomtomService: {},
    geocodingService: {},
    overall: 'success'
  };

  try {
    // Test 1: TomTom Service Initialization

    results.tomtomService.initialization = {
      apiKey: tomtomService.apiKey ? '✅ Set' : '❌ Missing',
      baseUrl: tomtomService.baseUrl ? '✅ Set' : '❌ Missing',
      canMakeRequest: tomtomService.canMakeRequest() ? '✅ Available' : '⚠️ Limited/Unavailable'
    };

    // Test 2: Usage Statistics

    const usageStats = tomtomService.getUsageStats();
    results.tomtomService.usageStats = {
      requests: usageStats.requests,
      dailyLimit: usageStats.dailyLimit,
      usagePercentage: usageStats.usagePercentage.toFixed(1) + '%',
      remainingRequests: usageStats.remainingRequests,
      isLimitReached: usageStats.isLimitReached ? '⚠️ Yes' : '✅ No'
    };

    // Test 3: Geocoding Service

    try {
      const geocodeResults = await enhancedGeocodingService.searchLocations('Las Piñas City');
      results.geocodingService.geocoding = {
        status: '✅ Working',
        resultsCount: geocodeResults.length,
        provider: geocodeResults[0]?.provider || 'Unknown'
      };
    } catch (error) {
      results.geocodingService.geocoding = {
        status: '❌ Failed',
        error: error.message
      };
    }

    // Test 4: Reverse Geocoding

    try {
      const reverseResult = await enhancedGeocodingService.reverseGeocode(14.4504, 121.0170);
      results.geocodingService.reverseGeocoding = {
        status: reverseResult ? '✅ Working' : '❌ No Results',
        address: reverseResult?.name || 'N/A',
        provider: reverseResult?.provider || 'Unknown'
      };
    } catch (error) {
      results.geocodingService.reverseGeocoding = {
        status: '❌ Failed',
        error: error.message
      };
    }

    // Test 5: Cache Functionality

    const cacheStats = enhancedGeocodingService.getCacheStats();
    results.geocodingService.cache = {
      status: '✅ Working',
      cacheSize: cacheStats.size,
      entries: cacheStats.entries.length
    };

    // Test 6: Fallback Mechanism

    if (!tomtomService.canMakeRequest()) {

      try {
        const fallbackResults = await enhancedGeocodingService.searchLocations('Manila');
        results.geocodingService.fallback = {
          status: fallbackResults.length > 0 ? '✅ Working' : '❌ No Results',
          provider: fallbackResults[0]?.provider || 'Unknown'
        };
      } catch (error) {
        results.geocodingService.fallback = {
          status: '❌ Failed',
          error: error.message
        };
      }
    } else {
      results.geocodingService.fallback = {
        status: '⏭️ Skipped (TomTom available)'
      };
    }

  } catch (error) {

    results.overall = 'failed';
    results.error = error.message;
  }

  // Display Results




  Object.entries(results.tomtomService).forEach(([key, value]) => {
    if (typeof value === 'object') {

      Object.entries(value).forEach(([subKey, subValue]) => {

      });
    } else {

    }
  });

  Object.entries(results.geocodingService).forEach(([key, value]) => {
    if (typeof value === 'object') {

      Object.entries(value).forEach(([subKey, subValue]) => {

      });
    } else {

    }
  });

  if (results.error) {

  }

  return results;
};

// Auto-run test if this file is imported directly
if (import.meta.hot) {
  // Only run in development
  testTomTomIntegration();
}

export default testTomTomIntegration;
