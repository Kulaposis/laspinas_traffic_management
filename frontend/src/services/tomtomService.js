/**
 * TomTom Maps Service
 * Provides TomTom Maps API integration with usage limit management
 */

import tomtomConfig from '../config/tomtom.js';

class TomTomService {
  constructor() {
    // TomTom API configuration
    this.apiKey = tomtomConfig.apiKey;
    this.baseUrl = tomtomConfig.baseUrl;
    this.mapBaseUrl = tomtomConfig.mapBaseUrl;

    // Usage tracking
    this.usageStats = {
      requests: 0,
      dailyLimit: tomtomConfig.dailyLimit,
      lastReset: new Date().toDateString(),
      isLimitReached: false
    };

    // Time-based rate limiting (2-3 hours between requests)
    this.minRequestInterval = 2.5 * 60 * 60 * 1000; // 2.5 hours in milliseconds
    this.lastRequestTimestamp = null;

    // Cache for API responses
    this.cache = new Map();
    this.cacheTimeout = tomtomConfig.cacheTimeout;

    // Fallback configuration
    this.fallbackToOSM = tomtomConfig.fallbackToOSM;
    this.fallbackToBackend = tomtomConfig.fallbackToBackend;

    // Request settings
    this.timeout = tomtomConfig.timeout;
    this.maxRetries = tomtomConfig.maxRetries;
  }

  /**
   * Check if we can make API requests (within limits)
   */
  canMakeRequest() {
    this.checkDailyReset();

    // Check daily limits
    if (this.usageStats.isLimitReached) {

      return false;
    }

    if (this.usageStats.requests >= this.usageStats.dailyLimit) {
      this.usageStats.isLimitReached = true;

      return false;
    }

    // Check time-based rate limiting
    const now = Date.now();
    if (this.lastRequestTimestamp && (now - this.lastRequestTimestamp) < this.minRequestInterval) {
      const timeUntilNextRequest = Math.ceil((this.minRequestInterval - (now - this.lastRequestTimestamp)) / (60 * 1000));

      return false;
    }

    return true;
  }

  /**
   * Check if we need to reset daily usage counter
   */
  checkDailyReset() {
    const today = new Date().toDateString();
    if (this.usageStats.lastReset !== today) {
      this.usageStats.requests = 0;
      this.usageStats.isLimitReached = false;
      this.usageStats.lastReset = today;

    }
  }

  /**
   * Track API request
   */
  trackRequest() {
    this.usageStats.requests++;
    this.lastRequestTimestamp = Date.now();
  }

  /**
   * Get TomTom map tile URL template
   * Note: We don't track individual tile requests to avoid exhausting the API limit
   */
  getMapTileUrlTemplate(style = 'main') {
    // TomTom map tiles:
    // - Basic styles (main, night, labels, etc.): /tile/basic/{style}/{z}/{x}/{y}.png
    // - Satellite imagery: /tile/satellite/{z}/{x}/{y}.jpg
    const normalizedStyle = (style || 'main').toLowerCase();

    if (normalizedStyle === 'satellite') {
      return `${this.mapBaseUrl}/tile/satellite/{z}/{x}/{y}.jpg?key=${this.apiKey}`;
    }

    // Default to basic tiles with the requested style (main/night/...)
    return `${this.mapBaseUrl}/tile/basic/${normalizedStyle}/{z}/{x}/{y}.png?key=${this.apiKey}`;
  }

  /**
   * Get TomTom map attribution
   */
  getMapAttribution() {
    return '&copy; <a href="https://www.tomtom.com/">TomTom</a>';
  }

  /**
   * Geocoding - Convert address to coordinates
   */
  async geocode(query, options = {}) {
    const cacheKey = `geocode_${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      return this.fallbackGeocode(query, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        query: query,
        limit: options.limit || 10,
        countrySet: options.countrySet || 'PH', // Philippines
        ...options
      });

      const response = await fetch(`${this.baseUrl}/search/2/geocode/${encodeURIComponent(query)}.json?${params}`);
      
      if (!response.ok) {
        throw new Error(`TomTom geocoding failed: ${response.status}`);
      }

      this.trackRequest();
      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {

      return this.fallbackGeocode(query, options);
    }
  }

  /**
   * Reverse geocoding - Convert coordinates to address
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

    if (!this.canMakeRequest()) {
      return this.fallbackReverseGeocode(lat, lng, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        ...options
      });

      const response = await fetch(`${this.baseUrl}/search/2/reverseGeocode/${lat},${lng}.json?${params}`);
      
      if (!response.ok) {
        throw new Error(`TomTom reverse geocoding failed: ${response.status}`);
      }

      this.trackRequest();
      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {

      return this.fallbackReverseGeocode(lat, lng, options);
    }
  }

  /**
   * Get traffic flow data
   */
  async getTrafficFlow(lat, lng, options = {}) {
    const cacheKey = `traffic_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first (longer cache for traffic data to match rate limiting)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < tomtomConfig.trafficCacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      return this.fallbackTrafficFlow(lat, lng, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        point: `${lat},${lng}`,
        radius: options.radius || 1000,
        unit: options.unit || 'KMPH',
        ...options
      });

      const response = await fetch(`${this.baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json?${params}`);
      
      if (!response.ok) {
        throw new Error(`TomTom traffic flow failed: ${response.status}`);
      }

      this.trackRequest();
      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {

      return this.fallbackTrafficFlow(lat, lng, options);
    }
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(origin, destination, options = {}) {
    // Validate coordinates
    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {

      return this.fallbackRoute(origin, destination, options);
    }

    const cacheKey = `route_${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}_${JSON.stringify(options)}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      return this.fallbackRoute(origin, destination, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        ...options
      });

      const response = await fetch(`${this.baseUrl}/routing/1/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json?${params}`);

      if (!response.ok) {
        throw new Error(`TomTom routing failed: ${response.status}`);
      }

      this.trackRequest();
      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {

      return this.fallbackRoute(origin, destination, options);
    }
  }

  /**
   * Fallback geocoding using OpenStreetMap Nominatim
   */
  async fallbackGeocode(query, options = {}) {

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
      
      // Transform OSM format to TomTom-like format
      return {
        results: data.map(item => ({
          position: {
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
          },
          address: {
            freeformAddress: item.display_name,
            country: item.address?.country || 'Philippines',
            municipality: item.address?.city || item.address?.town || item.address?.village,
            streetName: item.address?.road || item.address?.street
          }
        }))
      };
    } catch (error) {

      return { results: [] };
    }
  }

  /**
   * Fallback reverse geocoding using OpenStreetMap Nominatim
   */
  async fallbackReverseGeocode(lat, lng, options = {}) {

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: 1
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      const data = await response.json();
      
      // Transform OSM format to TomTom-like format
      return {
        addresses: [{
          position: {
            lat: parseFloat(data.lat),
            lon: parseFloat(data.lon)
          },
          address: {
            freeformAddress: data.display_name,
            country: data.address?.country || 'Philippines',
            municipality: data.address?.city || data.address?.town || data.address?.village,
            streetName: data.address?.road || data.address?.street
          }
        }]
      };
    } catch (error) {

      return { addresses: [] };
    }
  }

  /**
   * Fallback traffic flow using backend service
   */
  async fallbackTrafficFlow(lat, lng, options = {}) {

    try {
      // Use your existing backend traffic service
      const response = await fetch(`/api/traffic/nearby?lat=${lat}&lng=${lng}&radius=${options.radius || 1000}`);

      if (!response.ok) {
        throw new Error(`Backend traffic API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform backend format to TomTom-like format
      return {
        flowSegmentData: {
          frc: 'MAJOR_ROAD',
          currentSpeed: data.average_speed || 30,
          freeFlowSpeed: data.free_flow_speed || 50,
          confidence: data.confidence || 0.7
        }
      };
    } catch (error) {

      // Return a valid response structure even on error
      return {
        flowSegmentData: {
          frc: 'MAJOR_ROAD',
          currentSpeed: 30,
          freeFlowSpeed: 50,
          confidence: 0.5
        }
      };
    }
  }

  /**
   * Fallback routing using OSRM
   */
  async fallbackRoute(origin, destination, options = {}) {

    try {
      const response = await fetch(
        `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          routes: [{
            summary: {
              lengthInMeters: route.distance,
              travelTimeInSeconds: route.duration
            },
            legs: [{
              points: route.geometry.coordinates.map(coord => ({
                latitude: coord[1],
                longitude: coord[0]
              }))
            }]
          }]
        };
      }
      
      return { routes: [] };
    } catch (error) {

      return { routes: [] };
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    this.checkDailyReset();
    const now = Date.now();
    const nextRequestTime = this.lastRequestTimestamp ?
      new Date(this.lastRequestTimestamp + this.minRequestInterval) : new Date(now);

    return {
      ...this.usageStats,
      remainingRequests: this.usageStats.dailyLimit - this.usageStats.requests,
      usagePercentage: (this.usageStats.requests / this.usageStats.dailyLimit) * 100,
      lastRequestTime: this.lastRequestTimestamp ? new Date(this.lastRequestTimestamp) : null,
      nextRequestTime: nextRequestTime,
      timeUntilNextRequest: this.lastRequestTimestamp ?
        Math.max(0, Math.ceil((nextRequestTime - now) / (60 * 1000))) : 0,
      rateLimitInterval: this.minRequestInterval / (60 * 60 * 1000) // in hours
    };
  }

  /**
   * Reset usage counter (for testing)
   */
  resetUsage() {
    this.usageStats.requests = 0;
    this.usageStats.isLimitReached = false;
    this.usageStats.lastReset = new Date().toDateString();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();

  }
}

// Create singleton instance
const tomtomService = new TomTomService();

export default tomtomService;
