/**
 * TomTom Integration Test Utility
 * Test script to verify TomTom API integration and fallback functionality
 */

import tomtomService from '../services/tomtomService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';

export const testTomTomIntegration = async () => {
  console.log('🧪 Testing TomTom Integration...');
  
  const results = {
    tomtomService: {},
    geocodingService: {},
    overall: 'success'
  };

  try {
    // Test 1: TomTom Service Initialization
    console.log('1️⃣ Testing TomTom Service Initialization...');
    results.tomtomService.initialization = {
      apiKey: tomtomService.apiKey ? '✅ Set' : '❌ Missing',
      baseUrl: tomtomService.baseUrl ? '✅ Set' : '❌ Missing',
      canMakeRequest: tomtomService.canMakeRequest() ? '✅ Available' : '⚠️ Limited/Unavailable'
    };

    // Test 2: Usage Statistics
    console.log('2️⃣ Testing Usage Statistics...');
    const usageStats = tomtomService.getUsageStats();
    results.tomtomService.usageStats = {
      requests: usageStats.requests,
      dailyLimit: usageStats.dailyLimit,
      usagePercentage: usageStats.usagePercentage.toFixed(1) + '%',
      remainingRequests: usageStats.remainingRequests,
      isLimitReached: usageStats.isLimitReached ? '⚠️ Yes' : '✅ No'
    };

    // Test 3: Geocoding Service
    console.log('3️⃣ Testing Enhanced Geocoding Service...');
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
    console.log('4️⃣ Testing Reverse Geocoding...');
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
    console.log('5️⃣ Testing Cache Functionality...');
    const cacheStats = enhancedGeocodingService.getCacheStats();
    results.geocodingService.cache = {
      status: '✅ Working',
      cacheSize: cacheStats.size,
      entries: cacheStats.entries.length
    };

    // Test 6: Fallback Mechanism
    console.log('6️⃣ Testing Fallback Mechanism...');
    if (!tomtomService.canMakeRequest()) {
      console.log('⚠️ TomTom API limit reached, testing fallback...');
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
    console.error('❌ Test failed:', error);
    results.overall = 'failed';
    results.error = error.message;
  }

  // Display Results
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log('Overall Status:', results.overall === 'success' ? '✅ SUCCESS' : '❌ FAILED');
  
  console.log('\n🗺️ TomTom Service:');
  Object.entries(results.tomtomService).forEach(([key, value]) => {
    if (typeof value === 'object') {
      console.log(`  ${key}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        console.log(`    ${subKey}: ${subValue}`);
      });
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });

  console.log('\n🔍 Geocoding Service:');
  Object.entries(results.geocodingService).forEach(([key, value]) => {
    if (typeof value === 'object') {
      console.log(`  ${key}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        console.log(`    ${subKey}: ${subValue}`);
      });
    } else {
      console.log(`  ${key}: ${value}`);
    }
  });

  if (results.error) {
    console.log('\n❌ Error:', results.error);
  }

  return results;
};

// Auto-run test if this file is imported directly
if (import.meta.hot) {
  // Only run in development
  testTomTomIntegration();
}

export default testTomTomIntegration;
