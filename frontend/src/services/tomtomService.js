/**
 * TomTom Maps Service
 * Provides TomTom Maps API integration with usage limit management
 * Falls back to Geoapify API when TomTom returns 403/429 errors or exceeds limits
 */

import tomtomConfig from '../config/tomtom.js';
import geoapifyService from './geoapifyService.js';

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
    
    // Cache for failed requests (403/429) to skip TomTom and go directly to fallback
    this.failedRequestsCache = new Map();
    this.failedCacheTimeout = 24 * 60 * 60 * 1000; // 24 hours - if TomTom fails, skip it for a day

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
    // Note: TomTom tile API doesn't support "light-driving" style directly
    // The "main" style is already light and suitable for driving navigation
    const normalizedStyle = (style || 'main').toLowerCase();

    if (normalizedStyle === 'satellite') {
      return `${this.mapBaseUrl}/tile/satellite/{z}/{x}/{y}.jpg?key=${this.apiKey}`;
    }

    // Handle light driving style - use "main" style since tile API doesn't have separate light-driving
    // The "main" style is already optimized for general use and is light-colored
    if (normalizedStyle === 'light_driving' || normalizedStyle === 'light-driving') {
      return `${this.mapBaseUrl}/tile/basic/main/{z}/{x}/{y}.png?key=${this.apiKey}`;
    }

    // Minimal style - uses basic style with fewer labels (if available)
    // Falls back to main style if minimal is not available
    if (normalizedStyle === 'minimal' || normalizedStyle === 'minimal-labels') {
      // Try using basic style which typically has fewer labels than main
      return `${this.mapBaseUrl}/tile/basic/basic/{z}/{x}/{y}.png?key=${this.apiKey}`;
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
    
    // Check if this query previously failed with 403/429 - skip TomTom and use fallback directly
    if (this.failedRequestsCache.has(cacheKey)) {
      const failedCache = this.failedRequestsCache.get(cacheKey);
      if (Date.now() - failedCache.timestamp < this.failedCacheTimeout) {
        // Skip TomTom API and go directly to fallback to avoid showing 403 error
        return this.fallbackGeocode(query, options);
      } else {
        // Cache expired, remove it and try TomTom again
        this.failedRequestsCache.delete(cacheKey);
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

      // Use fetch with error handling that doesn't throw for 403/429
      let response;
      try {
        response = await fetch(`${this.baseUrl}/search/2/geocode/${encodeURIComponent(query)}.json?${params}`);
      } catch (networkError) {
        // Network error - use fallback silently
        return this.fallbackGeocode(query, options);
      }
      
      // Check status before trying to parse response
      if (!response.ok) {
        // For 403/429 errors, cache the failure and use fallback
        // This prevents showing the error on subsequent requests
        if (response.status === 403 || response.status === 429) {
          // Cache this failure so we skip TomTom on next request
          this.failedRequestsCache.set(cacheKey, {
            timestamp: Date.now(),
            status: response.status
          });
          // Silently use fallback - this is expected behavior
          return this.fallbackGeocode(query, options);
        }
        // For other errors, still use fallback
        return this.fallbackGeocode(query, options);
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
      // Only log unexpected errors (not 403/429 which are handled above)
      // Network errors are also handled silently
      if (!error.message?.includes('403') && !error.message?.includes('429') && !error.message?.includes('fetch')) {
        console.debug('TomTom geocoding error (using fallback):', error.message);
      }
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
   * DISABLED by default to save API calls - returns cached/mock data only
   */
  async getTrafficFlow(lat, lng, options = {}) {
    // Check if traffic flow is enabled in config
    if (tomtomConfig.trafficFlowEnabled === false) {
      // Return fallback/mock data without making API call
      return this.fallbackTrafficFlow(lat, lng, options);
    }

    const cacheKey = `traffic_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first (24 hour cache to reduce API calls)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < tomtomConfig.trafficCacheTimeout) {
        return cached.data;
      }
    }

    // Don't make API calls if we're at the limit
    if (!this.canMakeRequest()) {
      return this.fallbackTrafficFlow(lat, lng, options);
    }

    // Only make API call if explicitly enabled and not cached
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
      
      // Cache the result for 24 hours
      this.cache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });

      return data;
    } catch (error) {
      // Return fallback instead of making more API calls
      return this.fallbackTrafficFlow(lat, lng, options);
    }
  }

  /**
   * Calculate route between two points - Enhanced with better parameters
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
      console.warn('TomTom API limit reached for routing.');
      // Signal caller to use fallback provider
      const err = new Error('TOMTOM_RATE_LIMIT');
      err.code = 429;
      throw err;
    }

    try {
      // Enhanced parameters for better routing results
      const params = new URLSearchParams({
        key: this.apiKey,
        traffic: options.traffic !== undefined ? String(options.traffic) : 'true',
        travelMode: options.travelMode || 'car',
        instructionsType: options.instructionsType || 'text',
        routeRepresentation: options.routeRepresentation || 'polyline',
        computeBestOrder: options.computeBestOrder || 'false',
        maxAlternatives: String(options.maxAlternatives || 3),
        language: options.language || 'en-US',
        ...(options.avoid && { avoid: options.avoid }),
        ...(options.routeType && { routeType: options.routeType })
      });

      const response = await fetch(`${this.baseUrl}/routing/1/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json?${params}`);

      if (!response.ok) {
        // Handle rate limiting (429) and forbidden (403) - let caller fallback
        if (response.status === 429 || response.status === 403) {
          const err = new Error(response.status === 403 ? 'TOMTOM_FORBIDDEN' : 'TOMTOM_RATE_LIMIT');
          err.code = response.status;
          throw err;
        }
        const err = new Error(`TomTom routing failed: ${response.status}`);
        err.code = response.status;
        throw err;
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
      console.warn('TomTom routing error:', error?.message || error);
      // Do not perform fallback here; allow upstream to decide the provider
      throw error;
    }
  }

  /**
   * Search for places/POIs using TomTom Search API
   * Enhanced to use Geoapify autocomplete when TomTom fails with 403/429 for autocomplete scenarios
   */
  async searchPlaces(query, options = {}) {
    const cacheKey = `places_${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      console.warn('TomTom API limit reached. Falling back to Geoapify for places search.');
      // Use autocomplete for short queries (autocomplete scenario)
      const isAutocompleteScenario = query.length <= 3 || options.typeahead === true;
      if (isAutocompleteScenario) {
        return await geoapifyService.autocompletePlaces(query, options);
      }
      return await geoapifyService.searchPlaces(query, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        query: query,
        limit: String(options.limit || 10),
        countrySet: options.countrySet || 'PH',
        typeahead: options.typeahead !== undefined ? String(options.typeahead) : 'true',
        ...(options.lat && options.lng && {
          lat: String(options.lat),
          lon: String(options.lng),
          radius: String(options.radius || 5000)
        }),
        ...(options.categorySet && { categorySet: options.categorySet }),
        ...(options.idxSet && { idxSet: options.idxSet })
      });

      const response = await fetch(`${this.baseUrl}/search/2/search/${encodeURIComponent(query)}.json?${params}`);
      
      if (!response.ok) {
        // Handle rate limiting (429) and forbidden (403) - fallback to Geoapify
        if (response.status === 429 || response.status === 403) {
          console.warn(`TomTom API ${response.status === 403 ? 'forbidden' : 'rate limit'} reached. Falling back to Geoapify for places search.`);
          // Use autocomplete for short queries or when typeahead is enabled (autocomplete scenario)
          const isAutocompleteScenario = query.length <= 3 || options.typeahead === true;
          if (isAutocompleteScenario) {
            return await geoapifyService.autocompletePlaces(query, options);
          }
          return await geoapifyService.searchPlaces(query, options);
        }
        // Return cached data if available for other errors
        if (this.cache.has(cacheKey)) {
          const cached = this.cache.get(cacheKey);
          return cached.data;
        }
        throw new Error(`TomTom places search failed: ${response.status}`);
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
      console.warn('TomTom places search error:', error);
      // Fallback to Geoapify on any error
      console.warn('Falling back to Geoapify for places search.');
      // Use autocomplete for short queries or when typeahead is enabled (autocomplete scenario)
      const isAutocompleteScenario = query.length <= 3 || options.typeahead === true;
      if (isAutocompleteScenario) {
        return await geoapifyService.autocompletePlaces(query, options);
      }
      return await geoapifyService.searchPlaces(query, options);
    }
  }

  /**
   * Get traffic incidents from TomTom Traffic Incidents API
   * @param {Object} bounds - Bounding box {minLat, minLng, maxLat, maxLng}
   * @param {Date} startTime - Start time for filtering incidents
   * @param {Date} endTime - End time for filtering incidents
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Traffic incidents data
   */
  async getTrafficIncidents(bounds, startTime = null, endTime = null, options = {}) {
    try {
      // Validate bounds
      if (!bounds || typeof bounds.minLat !== 'number' || typeof bounds.minLng !== 'number' || 
          typeof bounds.maxLat !== 'number' || typeof bounds.maxLng !== 'number') {
        console.warn('Invalid bounds provided to getTrafficIncidents');
        return { incidents: [] };
      }

      // Validate bounding box coordinates (min must be less than max)
      if (bounds.minLat >= bounds.maxLat || bounds.minLng >= bounds.maxLng) {
        console.warn('Invalid bounding box: min values must be less than max values');
        return { incidents: [] };
      }

      // Validate bounding box size (TomTom API has limits - typically max 5 degrees)
      const latDiff = Math.abs(bounds.maxLat - bounds.minLat);
      const lngDiff = Math.abs(bounds.maxLng - bounds.minLng);
      if (latDiff > 5 || lngDiff > 5) {
        console.warn('Bounding box too large for TomTom API (max 5 degrees)');
        return { incidents: [] };
      }

      // Default to today only if not specified (not past dates)
      if (!endTime) {
        endTime = new Date();
      }
      if (!startTime) {
        // Start from beginning of today, not 3 days ago
        startTime = new Date();
        startTime.setHours(0, 0, 0, 0); // Start of today
      }

      // Validate date range (endTime must be after startTime)
      if (endTime <= startTime) {
        console.warn('Invalid date range: endTime must be after startTime');
        return { incidents: [] };
      }

      // Ensure dates are not in the future (TomTom API doesn't accept future dates)
      const now = new Date();
      if (startTime > now || endTime > now) {
        console.warn('TomTom API does not accept future dates, adjusting to current time');
        endTime = new Date(Math.min(endTime.getTime(), now.getTime()));
        if (startTime > now) {
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        }
      }

      // Format bounding box as required by TomTom API: minLat,minLng,maxLat,maxLng
      // Ensure coordinates are in valid range and properly formatted
      const bbox = `${bounds.minLat.toFixed(6)},${bounds.minLng.toFixed(6)},${bounds.maxLat.toFixed(6)},${bounds.maxLng.toFixed(6)}`;
      
      // Format times as ISO 8601 strings
      const startTimeISO = startTime.toISOString();
      const endTimeISO = endTime.toISOString();

      // TomTom Traffic Incidents API endpoint
      // Using version 4, s3 format (simplified)
      const params = new URLSearchParams({
        key: this.apiKey,
        startTime: startTimeISO,
        endTime: endTimeISO,
        ...(options.category && { category: options.category }),
        ...(options.severity && { severity: options.severity })
      });

      const url = `${this.baseUrl}/traffic/services/4/incidentDetails/s3/${bbox}/json?${params}`;

      // Check cache first
      const cacheKey = `incidents_${bbox}_${startTimeISO}_${endTimeISO}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minute cache for incidents
          return cached.data;
        }
      }

      if (!this.canMakeRequest()) {
        console.warn('TomTom API limit reached, cannot fetch incidents');
        return { incidents: [] };
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `TomTom incidents API error: ${response.status}`;
        try {
          // Read response as text first to handle both JSON and XML
          const responseText = await response.clone().text();
          if (responseText) {
            // Try to parse as JSON first
            try {
              const errorJson = JSON.parse(responseText);
              errorMessage = errorJson.detailedError?.message || errorJson.message || errorMessage;
            } catch {
              // Try to parse as XML (TomTom sometimes returns XML errors)
              if (responseText.includes('<errorResponse>')) {
                const match = responseText.match(/<message>([^<]+)<\/message>/);
                if (match) {
                  errorMessage = match[1];
                }
              } else {
                errorMessage = responseText.substring(0, 200); // Limit length
              }
            }
          }
        } catch (e) {
          // Ignore error parsing error response
          console.warn('Could not parse error response:', e);
        }
        
        // Log the error with context (only in development or for debugging)
        if (process.env.NODE_ENV === 'development') {
          console.warn('TomTom API error:', errorMessage);
        }
        
        // Return empty incidents instead of throwing to prevent breaking the app
        return { incidents: [] };
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
      console.error('TomTom traffic incidents error:', error);
      return { incidents: [] };
    }
  }

  /**
   * Autocomplete places using TomTom Search API (typeahead)
   * This is optimized for autocomplete with faster responses
   * Enhanced to always use Geoapify autocomplete API when TomTom fails with 403/429
   */
  async autocompletePlaces(query, options = {}) {
    if (!query || query.length < 1) {
      return { results: [] };
    }

    const cacheKey = `autocomplete_${query}_${JSON.stringify(options)}`;
    
    // Check cache first (shorter cache for autocomplete)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes cache for autocomplete
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      console.warn('TomTom API limit reached. Falling back to Geoapify autocomplete API.');
      return await geoapifyService.autocompletePlaces(query, options);
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        query: query,
        limit: String(options.limit || 10),
        countrySet: options.countrySet || 'PH',
        typeahead: 'true', // Always use typeahead for autocomplete
        ...(options.lat && options.lng && {
          lat: String(options.lat),
          lon: String(options.lng),
          radius: String(options.radius || 10000)
        }),
        ...(options.categorySet && { categorySet: options.categorySet })
      });

      const response = await fetch(`${this.baseUrl}/search/2/search/${encodeURIComponent(query)}.json?${params}`);
      
      if (!response.ok) {
        // Handle rate limiting (429) and forbidden (403) - always fallback to Geoapify autocomplete
        if (response.status === 429 || response.status === 403) {
          console.warn(`TomTom API ${response.status === 403 ? 'forbidden' : 'rate limit'} reached. Falling back to Geoapify autocomplete API.`);
          return await geoapifyService.autocompletePlaces(query, options);
        }
        throw new Error(`TomTom autocomplete failed: ${response.status}`);
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
      console.warn('TomTom autocomplete error:', error);
      // Fallback to Geoapify autocomplete on any error
      console.warn('Falling back to Geoapify autocomplete API.');
      return await geoapifyService.autocompletePlaces(query, options);
    }
  }

  /**
   * Get POI photos using TomTom Search API
   * Note: TomTom Search API may include photos in the response, or we extract from POI data
   * This method extracts photos from search results or returns empty array
   */
  async getPOIPhotos(poiId, options = {}) {
    if (!poiId) {
      return { photos: [] };
    }

    // TomTom Search API doesn't have a separate POI Photos endpoint
    // Photos are typically included in the Search API response itself
    // Return empty array as photos should be extracted from search results
    console.warn('TomTom POI Photos API endpoint not available. Photos should be extracted from Search API response.');
    return { photos: [] };
  }

  /**
   * Get POI details including reviews and ratings
   * Note: TomTom Search API may include ratings in the response
   * Reviews are typically not available in the free tier
   * This method extracts details from search results
   */
  async getPOIDetails(poiId, options = {}) {
    if (!poiId) {
      return null;
    }

    // TomTom Search API doesn't have a separate POI Details endpoint for reviews
    // Ratings may be included in the Search API response
    // Reviews are typically not available in the free tier
    console.warn('TomTom POI Details API endpoint not available. Details should be extracted from Search API response.');
    return null;
  }

  /**
   * Get place details by coordinates (POI search)
   */
  async getPlaceDetails(lat, lng, options = {}) {
    const cacheKey = `place_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      console.warn('TomTom API limit reached. Falling back to Geoapify for place details.');
      return await geoapifyService.getPlaceDetails(lat, lng, options);
    }

    try {
      // First try reverse geocoding to get address
      const reverseResult = await this.reverseGeocode(lat, lng, options);
      
      // Then search for nearby POIs using Search API with coordinates
      const params = new URLSearchParams({
        key: this.apiKey,
        lat: String(lat),
        lon: String(lng),
        radius: String(options.radius || 50),
        limit: '1',
        ...(options.categorySet && { categorySet: options.categorySet }),
        idxSet: 'POI'
      });

      // Use Search API with empty query but coordinates to find nearby POIs
      const poiResponse = await fetch(`${this.baseUrl}/search/2/search/.json?${params}`);
      
      // Handle 403/429 errors for POI search
      if (!poiResponse.ok && (poiResponse.status === 403 || poiResponse.status === 429)) {
        console.warn(`TomTom API ${poiResponse.status === 403 ? 'forbidden' : 'rate limit'} reached. Falling back to Geoapify for place details.`);
        return await geoapifyService.getPlaceDetails(lat, lng, options);
      }
      
      let poiData = null;
      if (poiResponse.ok) {
        poiData = await poiResponse.json();
        this.trackRequest();
      }

      // Combine reverse geocoding and POI data
      const placeDetails = {
        address: reverseResult.addresses?.[0] || null,
        poi: poiData?.results?.[0] || null,
        coordinates: { lat, lng }
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: placeDetails,
        timestamp: Date.now()
      });

      return placeDetails;
    } catch (error) {
      console.warn('TomTom place details error:', error);
      // Fallback to Geoapify on any error
      console.warn('Falling back to Geoapify for place details.');
      return await geoapifyService.getPlaceDetails(lat, lng, options);
    }
  }

  /**
   * Search for POIs by category
   */
  async searchPOIByCategory(category, lat, lng, options = {}) {
    const cacheKey = `poi_${category}_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    if (!this.canMakeRequest()) {
      return { results: [] };
    }

    try {
      const params = new URLSearchParams({
        key: this.apiKey,
        lat: String(lat),
        lon: String(lng),
        radius: String(options.radius || 1000),
        limit: String(options.limit || 10),
        categorySet: category
      });

      const response = await fetch(`${this.baseUrl}/search/2/categorySearch/${category}.json?${params}`);
      
      if (!response.ok) {
        throw new Error(`TomTom POI search failed: ${response.status}`);
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
      console.warn('TomTom POI search error:', error);
      return { results: [] };
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
