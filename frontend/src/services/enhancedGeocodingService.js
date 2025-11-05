/**
 * Enhanced Geocoding Service
 * Uses backend API as proxy to avoid CORS and API key issues
 */

import api from './api';

class EnhancedGeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.debounceTimeout = 300; // 300ms debounce
    this.debounceTimer = null;
    this.baseEndpoint = '/traffic';
  }

  /**
   * Search for locations using backend API proxy
   */
  async searchLocations(query, options = {}) {
    if (!query || query.length < 1) {
      return [];
    }

    const cacheKey = `search_${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Use backend API proxy endpoint
      const params = new URLSearchParams({
        query: query,
        limit: options.limit || 10,
        country: options.countrySet || 'PH'
      });

      const response = await api.get(`${this.baseEndpoint}/geocode?${params}`);
      
      if (response.data && Array.isArray(response.data)) {
        // Transform backend results to our format
        const results = response.data.map(result => ({
          id: result.id || `${result.lat}_${result.lng}`,
          name: result.name || 'Unknown',
          lat: result.lat,
          lng: result.lng,
          address: {
            full: result.address?.full || result.name,
            freeformAddress: result.address?.full || result.name,
            streetName: result.address?.street || '',
            streetNumber: '',
            municipality: result.address?.city || '',
            countrySubdivision: '',
            postalCode: '',
            country: result.address?.country || 'Philippines'
          },
          type: result.type || 'general',
          score: result.confidence || 0.8,
          provider: result.provider || 'OpenStreetMap'
        }));
        
        // Cache the results
        this.cache.set(cacheKey, {
          data: results,
          timestamp: Date.now()
        });

        return results;
      }
      
      return [];
    } catch (error) {
      // Return mock results for common locations as fallback
      return this.getMockResults(query);
    }
  }

  /**
   * Debounced search for autocomplete
   */
  async searchWithDebounce(query, options = {}) {
    return new Promise((resolve) => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(async () => {
        const results = await this.searchLocations(query, options);
        resolve(results);
      }, this.debounceTimeout);
    });
  }

  /**
   * Get mock results for common Las Piñas locations
   */
  getMockResults(query) {
    const mockLocations = [
      { name: 'SM Southmall', lat: 14.4504, lng: 121.0170, city: 'Las Piñas' },
      { name: 'Alabang Town Center', lat: 14.4195, lng: 121.0401, city: 'Muntinlupa' },
      { name: 'Las Piñas City Hall', lat: 14.4378, lng: 121.0122, city: 'Las Piñas' },
      { name: 'Zapote Market', lat: 14.4456, lng: 121.0189, city: 'Las Piñas' },
      { name: 'BF Homes', lat: 14.4389, lng: 121.0344, city: 'Las Piñas' },
      { name: 'Alabang-Zapote Road', lat: 14.4450, lng: 121.0200, city: 'Las Piñas' },
      { name: 'University of Perpetual Help', lat: 14.4456, lng: 121.0156, city: 'Las Piñas' }
    ];

    const lowerQuery = query.toLowerCase();
    return mockLocations
      .filter(loc => loc.name.toLowerCase().includes(lowerQuery))
      .map(loc => ({
        id: `mock_${loc.lat}_${loc.lng}`,
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        address: {
          street: '',
          city: loc.city,
          country: 'Philippines',
          full: `${loc.name}, ${loc.city}, Philippines`
        },
        type: 'general',
        provider: 'Mock',
        confidence: 0.5
      }));
  }

  /**
   * Reverse geocoding using backend API proxy
   */
  async reverseGeocode(lat, lng, options = {}) {
    const cacheKey = `reverse_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Use backend API proxy endpoint
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString()
      });

      const response = await api.get(`${this.baseEndpoint}/reverse-geocode?${params}`);
      
      if (response.data) {
        const result = response.data;
        
        // Transform backend result to our format
        const transformedResult = {
          id: result.id || `${lat}_${lng}`,
          name: result.name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          lat: result.lat || lat,
          lng: result.lng || lng,
          address: {
            full: result.address?.full || result.name,
            freeformAddress: result.address?.full || result.name,
            streetName: result.address?.street || '',
            streetNumber: '',
            municipality: result.address?.city || 'Las Piñas',
            countrySubdivision: '',
            postalCode: '',
            country: result.address?.country || 'Philippines'
          },
          type: result.type || 'general',
          provider: result.provider || 'OpenStreetMap',
          confidence: result.confidence || 0.8
        };
        
        // Cache the result (as array for compatibility)
        this.cache.set(cacheKey, {
          data: [transformedResult],
          timestamp: Date.now()
        });

        // Return as array for compatibility with code that expects array
        return [transformedResult];
      }
      
      // Fallback if no data - return as array
      const fallbackResult = {
        id: `${lat}_${lng}`,
        name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat: lat,
        lng: lng,
        address: {
          street: '',
          city: 'Las Piñas',
          country: 'Philippines',
          full: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        },
        type: 'general',
        provider: 'Fallback',
        confidence: 0.3
      };
      return [fallbackResult];
    } catch (error) {
      // Return a basic result on error - return as array
      const errorResult = {
        id: `${lat}_${lng}`,
        name: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat: lat,
        lng: lng,
        address: {
          street: '',
          city: 'Las Piñas',
          country: 'Philippines',
          full: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        },
        type: 'general',
        provider: 'Fallback',
        confidence: 0.3
      };
      return [errorResult];
    }
  }

  /**
   * Transform TomTom geocoding results to standard format
   */
  transformTomTomResults(results) {
    return results.map(result => ({
      id: `${result.position.lat}_${result.position.lon}`,
      name: result.address.freeformAddress,
      lat: result.position.lat,
      lng: result.position.lon,
      address: {
        street: result.address.streetName || '',
        city: result.address.municipality || '',
        country: result.address.country || 'Philippines',
        full: result.address.freeformAddress
      },
      type: this.determineLocationType(result.address),
      provider: 'TomTom',
      confidence: result.score || 1.0
    }));
  }

  /**
   * Transform TomTom reverse geocoding result to standard format
   */
  transformTomTomReverseResult(result) {
    return {
      id: `${result.position.lat}_${result.position.lon}`,
      name: result.address.freeformAddress,
      lat: result.position.lat,
      lng: result.position.lon,
      address: {
        street: result.address.streetName || '',
        city: result.address.municipality || '',
        country: result.address.country || 'Philippines',
        full: result.address.freeformAddress
      },
      type: this.determineLocationType(result.address),
      provider: 'TomTom',
      confidence: 1.0
    };
  }

  /**
   * Determine location type based on address components
   */
  determineLocationType(address) {
    const freeform = address.freeformAddress.toLowerCase();
    
    if (freeform.includes('mall') || freeform.includes('shopping')) return 'shopping';
    if (freeform.includes('hospital') || freeform.includes('medical')) return 'healthcare';
    if (freeform.includes('school') || freeform.includes('university')) return 'education';
    if (freeform.includes('church') || freeform.includes('cathedral')) return 'religious';
    if (freeform.includes('park') || freeform.includes('garden')) return 'recreation';
    if (freeform.includes('restaurant') || freeform.includes('cafe')) return 'food';
    if (freeform.includes('hotel') || freeform.includes('resort')) return 'accommodation';
    if (freeform.includes('bank') || freeform.includes('atm')) return 'financial';
    if (freeform.includes('gas') || freeform.includes('station')) return 'fuel';
    if (freeform.includes('road') || freeform.includes('street') || freeform.includes('avenue')) return 'road';
    
    return 'general';
  }

  /**
   * Fallback search using OpenStreetMap
   */
  async fallbackSearch(query, options, cacheKey) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: options.limit || 10,
        countrycodes: 'ph',
        addressdetails: 1
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data = await response.json();
      
      const transformedResults = data.map(item => ({
        id: `${item.lat}_${item.lon}`,
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: {
          street: item.address?.road || item.address?.street || '',
          city: item.address?.city || item.address?.town || item.address?.village || '',
          country: item.address?.country || 'Philippines',
          full: item.display_name
        },
        type: this.determineLocationType({ freeformAddress: item.display_name }),
        provider: 'OpenStreetMap',
        confidence: 0.8
      }));

      // Cache the results
      this.cache.set(cacheKey, {
        data: transformedResults,
        timestamp: Date.now()
      });

      return transformedResults;
    } catch (error) {

      return [];
    }
  }

  /**
   * Fallback reverse geocoding using OpenStreetMap
   */
  async fallbackReverseGeocode(lat, lng, options, cacheKey) {
    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: 1
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      const data = await response.json();
      
      const transformedResult = {
        id: `${lat}_${lng}`,
        name: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        address: {
          street: data.address?.road || data.address?.street || '',
          city: data.address?.city || data.address?.town || data.address?.village || '',
          country: data.address?.country || 'Philippines',
          full: data.display_name
        },
        type: this.determineLocationType({ freeformAddress: data.display_name }),
        provider: 'OpenStreetMap',
        confidence: 0.8
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: transformedResult,
        timestamp: Date.now()
      });

      return transformedResult;
    } catch (error) {

      return null;
    }
  }

  /**
   * Get location suggestions for autocomplete
   */
  async getSuggestions(query, options = {}) {
    if (!query || query.length < 2) {
      return [];
    }

    const results = await this.searchWithDebounce(query, {
      ...options,
      limit: 7
    });

    return results.map(result => ({
      id: result.id,
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      type: result.type,
      provider: result.provider
    }));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance
const enhancedGeocodingService = new EnhancedGeocodingService();

export default enhancedGeocodingService;
