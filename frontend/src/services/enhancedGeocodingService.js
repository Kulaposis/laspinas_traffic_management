/**
 * Enhanced Geocoding Service
 * Combines TomTom API with OpenStreetMap fallback for optimal performance
 */

import tomtomService from './tomtomService';

class EnhancedGeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.debounceTimeout = 300; // 300ms debounce
    this.debounceTimer = null;
  }

  /**
   * Search for locations with intelligent fallback
   */
  async searchLocations(query, options = {}) {
    const cacheKey = `search_${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Try TomTom first if available
    if (tomtomService.canMakeRequest()) {
      try {
        const tomtomResults = await tomtomService.geocode(query, {
          limit: options.limit || 10,
          countrySet: 'PH',
          ...options
        });

        if (tomtomResults.results && tomtomResults.results.length > 0) {
          const transformedResults = this.transformTomTomResults(tomtomResults.results);
          
          // Cache the results
          this.cache.set(cacheKey, {
            data: transformedResults,
            timestamp: Date.now()
          });

          return transformedResults;
        }
      } catch (error) {
        console.warn('TomTom geocoding failed, trying fallback:', error);
      }
    }

    // Fallback to OpenStreetMap
    return this.fallbackSearch(query, options, cacheKey);
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
   * Reverse geocoding with fallback
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

    // Try TomTom first if available
    if (tomtomService.canMakeRequest()) {
      try {
        const tomtomResults = await tomtomService.reverseGeocode(lat, lng, options);

        if (tomtomResults.addresses && tomtomResults.addresses.length > 0) {
          const transformedResult = this.transformTomTomReverseResult(tomtomResults.addresses[0]);
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: transformedResult,
            timestamp: Date.now()
          });

          return transformedResult;
        }
      } catch (error) {
        console.warn('TomTom reverse geocoding failed, trying fallback:', error);
      }
    }

    // Fallback to OpenStreetMap
    return this.fallbackReverseGeocode(lat, lng, options, cacheKey);
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
      console.error('Fallback geocoding error:', error);
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
      console.error('Fallback reverse geocoding error:', error);
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
