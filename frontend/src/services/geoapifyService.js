/**
 * Geoapify Service
 * Provides Geoapify Location Platform API integration
 * Used as fallback when TomTom API exceeds limits or returns 403 errors
 */

class GeoapifyService {
  constructor() {
    // Geoapify API configuration
    // Get your API key from: https://www.geoapify.com/get-started-with-maps-api
    this.apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY || 'c5044b7c329c41298245fc3c41dadc80';
    this.baseUrl = 'https://api.geoapify.com/v1';
    
    // Cache for API responses
    this.cache = new Map();
    this.cacheTimeout = 2.5 * 60 * 60 * 1000; // 2.5 hours (same as TomTom)
    
    // Request settings
    this.timeout = 30.0;
    this.maxRetries = 3;
  }

  /**
   * Check cache first
   */
  getCached(cacheKey) {
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    return null;
  }

  /**
   * Set cache
   */
  setCache(cacheKey, data) {
    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Transform Geoapify geocoding result to TomTom-like format
   * Enhanced to ensure accurate coordinate extraction
   */
  transformGeocodingResult(geoapifyResult) {
    if (!geoapifyResult || !geoapifyResult.features || geoapifyResult.features.length === 0) {
      return { results: [] };
    }

    return {
      results: geoapifyResult.features.map(feature => {
        const props = feature.properties;
        // Geoapify uses GeoJSON format: [longitude, latitude]
        const coords = feature.geometry.coordinates;
        
        // Ensure coordinates are valid
        const lat = Array.isArray(coords) ? coords[1] : (props.lat || null);
        const lon = Array.isArray(coords) ? coords[0] : (props.lon || props.lng || null);
        
        // Validate coordinates
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
          console.warn('Invalid coordinates in Geoapify result:', feature);
          return null;
        }
        
        return {
          position: {
            lat: parseFloat(lat),
            lon: parseFloat(lon)
          },
          address: {
            freeformAddress: props.formatted || props.name || props.address_line2 || '',
            country: props.country || 'Philippines',
            municipality: props.city || props.municipality || props.county || '',
            streetName: props.street || props.road || '',
            streetNumber: props.housenumber || '',
            postalCode: props.postcode || '',
            countrySubdivision: props.state || props.region || ''
          },
          poi: props.name ? {
            name: props.name,
            categorySet: props.categories ? props.categories.map(cat => ({ id: cat })) : [],
            phone: props.phone || '',
            website: props.website || ''
          } : null,
          type: props.type || props.result_type || 'POI',
          score: props.rank ? (props.rank.confidence / 100) : (props.rank?.confidence || 0.8)
        };
      }).filter(result => result !== null) // Remove invalid results
    };
  }

  /**
   * Transform Geoapify places result to TomTom-like format
   */
  transformPlacesResult(geoapifyResult) {
    if (!geoapifyResult || !geoapifyResult.features || geoapifyResult.features.length === 0) {
      return { results: [] };
    }

    return {
      results: geoapifyResult.features.map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates; // [lon, lat]
        
        return {
          position: {
            lat: coords[1],
            lon: coords[0]
          },
          poi: {
            name: props.name || 'Unknown',
            categorySet: props.categories ? props.categories.map(cat => ({ id: cat })) : [],
            phone: props.phone || '',
            website: props.website || '',
            openingHours: props.opening_hours || {}
          },
          address: {
            freeformAddress: props.formatted || props.name || '',
            country: props.country || 'Philippines',
            municipality: props.city || props.municipality || '',
            streetName: props.street || '',
            postalCode: props.postcode || ''
          },
          type: 'POI',
          score: props.rank ? props.rank.confidence / 100 : 0.8
        };
      })
    };
  }

  /**
   * Transform Geoapify routing result to TomTom-like format
   */
  transformRoutingResult(geoapifyResult) {
    if (!geoapifyResult || !geoapifyResult.features || geoapifyResult.features.length === 0) {
      return { routes: [] };
    }

    return {
      routes: geoapifyResult.features.map(feature => {
        const props = feature.properties;
        const coords = feature.geometry.coordinates; // Array of [lon, lat]
        
        // Convert LineString coordinates to TomTom format
        const points = coords.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));

        return {
          summary: {
            lengthInMeters: props.distance || 0,
            travelTimeInSeconds: props.time || 0
          },
          legs: [{
            points: points,
            summary: {
              lengthInMeters: props.distance || 0,
              travelTimeInSeconds: props.time || 0
            }
          }],
          geometry: {
            coordinates: coords
          }
        };
      })
    };
  }

  /**
   * Search places using Geoapify Geocoding API (enhanced for accurate place search)
   * Compatible with TomTom searchPlaces interface
   * Uses autocomplete API for short queries (1-3 characters) to prevent 400 errors
   * Uses geocoding API for longer queries with enhanced parameters for better accuracy
   */
  async searchPlaces(query, options = {}) {
    // For short queries (autocomplete scenario), use autocomplete endpoint
    // This prevents 400 Bad Request errors from geocoding API
    if (query && query.length <= 3) {
      return await this.autocompletePlaces(query, options);
    }

    const cacheKey = `places_${query}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Validate query length (geocoding API requires at least 2 characters)
      if (!query || query.length < 2) {
        // For very short queries, use autocomplete
        return await this.autocompletePlaces(query, options);
      }

      const params = new URLSearchParams({
        text: query,
        limit: String(options.limit || 20),
        apiKey: this.apiKey,
        format: 'geojson',
        lang: 'en'
      });

      // Enhanced proximity bias for better local results (Las Piñas)
      // Always use Las Piñas center if not provided for Philippine searches
      let searchLat = options.lat;
      let searchLng = options.lng;
      let searchRadius = options.radius;
      
      if (options.countrySet === 'PH' && (!searchLat || !searchLng)) {
        // Default to Las Piñas City center for Philippine searches
        searchLat = 14.4504;
        searchLng = 121.0170;
        searchRadius = searchRadius || 20000; // 20km radius for better coverage
      }
      
      if (searchLat && searchLng) {
        // Use proximity bias to prioritize results near the center (stronger for Las Piñas)
        params.append('bias', `proximity:${searchLat},${searchLng}`);
        
        // Add circle filter if radius is provided
        if (searchRadius) {
          params.append('filter', `circle:${searchLng},${searchLat},${searchRadius}`);
        }
      }

      // Country filter for better accuracy
      if (options.countrySet) {
        const countryCode = options.countrySet.toLowerCase();
        if (!params.has('filter')) {
          params.append('filter', `countrycode:${countryCode}`);
        } else {
          const existingFilter = params.get('filter');
          params.set('filter', `${existingFilter}|countrycode:${countryCode}`);
        }
      }

      // Note: Don't add 'type' parameter to geocoding/search API as it can cause 400 errors
      // The API will return all types by default, and we can filter in the transformation

      const response = await fetch(
        `${this.baseUrl}/geocode/search?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: options.signal // Support for abort signals
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Geoapify API rate limit reached');
          return { results: [] };
        }
        // If geocoding fails with 400, try autocomplete as fallback
        if (response.status === 400) {
          console.warn('Geoapify geocoding returned 400, falling back to autocomplete API');
          return await this.autocompletePlaces(query, options);
        }
        throw new Error(`Geoapify places search failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform with enhanced accuracy
      const transformed = this.transformGeocodingResult(data);
      
      // Sort results by relevance (rank/confidence)
      if (transformed.results && transformed.results.length > 0) {
        transformed.results.sort((a, b) => {
          // Sort by score (higher is better)
          const scoreA = a.score || 0;
          const scoreB = b.score || 0;
          return scoreB - scoreA;
        });
      }
      
      // Cache the result
      this.setCache(cacheKey, transformed);

      return transformed;
    } catch (error) {
      // Handle abort errors silently
      if (error.name === 'AbortError') {
        return { results: [] };
      }
      console.warn('Geoapify places search error:', error);
      // Try autocomplete as fallback for any error
      try {
        return await this.autocompletePlaces(query, options);
      } catch (fallbackError) {
        console.warn('Geoapify autocomplete fallback also failed:', fallbackError);
        return { results: [] };
      }
    }
  }

  /**
   * Autocomplete places using Geoapify Autocomplete API
   * Enhanced with better parameters, ranking, and relevance
   * Compatible with TomTom autocompletePlaces interface
   * Supports single character queries to prevent 400 errors
   */
  async autocompletePlaces(query, options = {}) {
    // Allow single character queries for autocomplete (minimum requirement)
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

    try {
      const params = new URLSearchParams({
        text: query,
        limit: String(options.limit || 10),
        apiKey: this.apiKey,
        lang: options.lang || 'en', // Language for results
        format: 'geojson' // Always use geojson format for consistency
      });

      // Enhanced proximity bias - prioritize results near user location (Las Piñas)
      // Always use Las Piñas center if not provided for Philippine searches
      let searchLat = options.lat;
      let searchLng = options.lng;
      let searchRadius = options.radius;
      
      if (options.countrySet === 'PH' && (!searchLat || !searchLng)) {
        // Default to Las Piñas City center for Philippine searches
        searchLat = 14.4504;
        searchLng = 121.0170;
        searchRadius = searchRadius || 20000; // 20km radius for better coverage
      }
      
      if (searchLat && searchLng) {
        // Use proximity bias for better local results (stronger bias for Las Piñas)
        // Note: Geoapify autocomplete uses lat,lng format for proximity
        params.append('bias', `proximity:${searchLat},${searchLng}`);
        
        // If radius is provided, also add circle filter for better relevance
        if (searchRadius) {
          // Circle filter uses lng,lat format
          if (!params.has('filter')) {
            params.append('filter', `circle:${searchLng},${searchLat},${searchRadius}`);
          } else {
            const existingFilter = params.get('filter');
            params.set('filter', `${existingFilter}|circle:${searchLng},${searchLat},${searchRadius}`);
          }
        }
      }

      // Country filter - prioritize results in specified country
      if (options.countrySet) {
        const countryCode = options.countrySet.toLowerCase();
        // Use countrycode filter for better accuracy
        if (!params.has('filter')) {
          params.append('filter', `countrycode:${countryCode}`);
        } else {
          // Combine filters if both radius and country are specified
          const existingFilter = params.get('filter');
          params.set('filter', `${existingFilter}|countrycode:${countryCode}`);
        }
      }
      
      // For Philippine searches, enhance query with Las Piñas context if needed
      if (options.countrySet === 'PH' && this.isPlaceTypeQuery(query)) {
        // Add Las Piñas context to query for better results
        const enhancedQuery = this.enhanceQueryForLasPinas(query);
        if (enhancedQuery !== query) {
          params.set('text', enhancedQuery);
        }
      }

      // Add type filter if specified (address, place, etc.)
      if (options.type) {
        params.append('type', options.type);
      }

      const response = await fetch(
        `${this.baseUrl}/geocode/autocomplete?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: options.signal // Support for abort signals
        }
      );

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          console.warn('Geoapify API rate limit reached');
          return { results: [] };
        }
        // Log error details for debugging
        let errorMessage = `Geoapify autocomplete failed: ${response.status}`;
        try {
          const errorData = await response.text();
          console.warn('Geoapify autocomplete error details:', errorData);
        } catch (e) {
          // Ignore parsing errors
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Enhanced transformation with better ranking
      const transformed = this.transformAutocompleteResult(data, query, options);
      
      // Cache the result
      this.setCache(cacheKey, transformed);

      return transformed;
    } catch (error) {
      // Handle abort errors silently
      if (error.name === 'AbortError') {
        return { results: [] };
      }
      console.warn('Geoapify autocomplete error:', error);
      return { results: [] };
    }
  }

  /**
   * Transform autocomplete results with enhanced ranking and relevance
   */
  transformAutocompleteResult(geoapifyResult, query, options = {}) {
    if (!geoapifyResult || !geoapifyResult.features || geoapifyResult.features.length === 0) {
      return { results: [] };
    }

    const queryLower = query.toLowerCase().trim();
    const results = geoapifyResult.features.map(feature => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates; // [lon, lat]
      
      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(props, queryLower, options);
      
      // Determine result type
      const resultType = this.determineResultType(props);
      
      return {
        position: {
          lat: coords[1],
          lon: coords[0]
        },
        address: {
          freeformAddress: props.formatted || props.name || '',
          country: props.country || 'Philippines',
          municipality: props.city || props.municipality || props.county || '',
          streetName: props.street || props.road || '',
          streetNumber: props.housenumber || '',
          postalCode: props.postcode || '',
          countrySubdivision: props.state || props.region || '',
          district: props.district || '',
          suburb: props.suburb || props.neighbourhood || ''
        },
        poi: props.name && resultType === 'POI' ? {
          name: props.name,
          categorySet: props.categories ? props.categories.map(cat => ({ id: cat })) : [],
          phone: props.phone || '',
          website: props.website || ''
        } : null,
        type: resultType,
        score: relevanceScore,
        rank: props.rank || {},
        // Additional metadata
        metadata: {
          placeId: props.place_id || props.osm_id || null,
          osmType: props.osm_type || null,
          category: props.category || null,
          countryCode: props.country_code || 'ph'
        }
      };
    });

    // Sort by relevance score (highest first)
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return { results };
  }

  /**
   * Calculate relevance score for autocomplete results
   * Enhanced with Las Piñas prioritization
   */
  calculateRelevanceScore(props, queryLower, options = {}) {
    let score = 0.5; // Base score
    
    const formatted = (props.formatted || '').toLowerCase();
    const name = (props.name || '').toLowerCase();
    const city = (props.city || props.municipality || '').toLowerCase();
    const state = (props.state || props.region || '').toLowerCase();
    
    // Exact match bonus
    if (formatted === queryLower || name === queryLower) {
      score += 0.3;
    }
    // Starts with query
    else if (formatted.startsWith(queryLower) || name.startsWith(queryLower)) {
      score += 0.25;
    }
    // Contains query
    else if (formatted.includes(queryLower) || name.includes(queryLower)) {
      score += 0.15;
    }
    
    // Las Piñas prioritization bonus (strong boost for local results)
    const isLasPinas = city.includes('las piñas') || city.includes('las pinas') || 
                      state.includes('las piñas') || state.includes('las pinas') ||
                      formatted.includes('las piñas') || formatted.includes('las pinas') ||
                      name.includes('las piñas') || name.includes('las pinas');
    if (isLasPinas) {
      score += 0.3; // Strong boost for Las Piñas results
    }
    
    // Proximity bonus if location provided (Las Piñas area)
    if (options.lat && options.lng && props.rank) {
      const distance = props.rank.distance || Infinity;
      if (distance < 1000) score += 0.25; // Within 1km (strong bonus)
      else if (distance < 5000) score += 0.15; // Within 5km
      else if (distance < 10000) score += 0.1; // Within 10km
      else if (distance < 20000) score += 0.05; // Within 20km (Las Piñas area)
    }
    
    // Importance/rank bonus (higher rank = more important)
    if (props.rank && props.rank.importance) {
      score += Math.min(props.rank.importance * 0.1, 0.2);
    }
    
    // Country match bonus
    if (options.countrySet && props.country_code === options.countrySet.toLowerCase()) {
      score += 0.1;
    }
    
    // Type bonuses (prioritize places over addresses for autocomplete)
    if (props.type === 'amenity' || props.type === 'building' || props.categories) {
      score += 0.1; // POI bonus
    }
    
    // Philippine context bonus
    if (options.countrySet === 'PH' && (props.country_code === 'ph' || props.country === 'Philippines')) {
      score += 0.05;
    }
    
    return Math.min(score, 1.0); // Cap at 1.0
  }
  
  /**
   * Check if query is a place type (university, school, hospital, etc.)
   */
  isPlaceTypeQuery(query) {
    const placeTypes = ['university', 'school', 'hospital', 'mall', 'market', 'church', 'park', 
                        'restaurant', 'hotel', 'bank', 'pharmacy', 'clinic', 'gym', 'cinema',
                        'supermarket', 'gas station', 'police', 'fire station', 'library'];
    const queryLower = query.toLowerCase();
    return placeTypes.some(type => queryLower.includes(type));
  }
  
  /**
   * Enhance query with Las Piñas context for better results
   */
  enhanceQueryForLasPinas(query) {
    const queryLower = query.toLowerCase().trim();
    
    // If query is just a place type without location, add Las Piñas
    if (this.isPlaceTypeQuery(query) && !queryLower.includes('las piñas') && !queryLower.includes('las pinas')) {
      // Don't modify the query, let proximity bias handle it
      // But we can add it as a variation if needed
      return query;
    }
    
    return query;
  }

  /**
   * Determine result type from properties
   */
  determineResultType(props) {
    // Check if it's a POI (Point of Interest)
    if (props.categories && props.categories.length > 0) {
      return 'POI';
    }
    
    // Check if it's a named place
    if (props.name && (props.type === 'amenity' || props.type === 'building' || props.type === 'tourism')) {
      return 'POI';
    }
    
    // Default to address
    return 'address';
  }

  /**
   * Get place details using Geoapify Place Details API
   * Compatible with TomTom getPlaceDetails interface
   */
  async getPlaceDetails(lat, lng, options = {}) {
    const cacheKey = `place_${lat}_${lng}_${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // First, do reverse geocoding to get place details
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        apiKey: this.apiKey
      });

      const response = await fetch(
        `${this.baseUrl}/geocode/reverse?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Geoapify place details failed: ${response.status}`);
      }

      const reverseData = await response.json();
      
      // Ensure reverseData has features array
      if (!reverseData || !reverseData.features || !Array.isArray(reverseData.features)) {
        // Return basic place details without POI data
        return {
          address: null,
          poi: null,
          coordinates: { lat, lng }
        };
      }
      
      // Then search for nearby POIs if needed
      // Note: Geoapify Places API requires a 'type' parameter, so we'll skip POI search
      // and rely on reverse geocoding data instead
      let poiData = null;
      // Skip POI search to avoid "type is required" error
      // We can get POI information from reverse geocoding if available
      if (options.includePOI !== false && reverseData.features && reverseData.features.length > 0) {
        // Extract POI information from reverse geocoding if available
        const feature = reverseData.features[0];
        if (feature.properties.name && feature.properties.categories) {
          poiData = {
            features: [{
              properties: {
                name: feature.properties.name,
                categories: feature.properties.categories || []
              }
            }]
          };
        }
      }

      // Combine reverse geocoding and POI data
      const placeDetails = {
        address: reverseData.features && Array.isArray(reverseData.features) && reverseData.features.length > 0 ? {
          position: {
            lat: reverseData.features[0].geometry.coordinates[1],
            lon: reverseData.features[0].geometry.coordinates[0]
          },
          address: {
            freeformAddress: reverseData.features[0].properties.formatted || '',
            country: reverseData.features[0].properties.country || 'Philippines',
            municipality: reverseData.features[0].properties.city || reverseData.features[0].properties.municipality || '',
            streetName: reverseData.features[0].properties.street || ''
          }
        } : null,
        poi: poiData && poiData.features && Array.isArray(poiData.features) && poiData.features.length > 0 ? {
          name: poiData.features[0].properties?.name || '',
          categorySet: Array.isArray(poiData.features[0].properties?.categories) ? 
            poiData.features[0].properties.categories.map(cat => ({ id: cat })) : []
        } : null,
        coordinates: { lat, lng }
      };

      // Cache the result
      this.setCache(cacheKey, placeDetails);

      return placeDetails;
    } catch (error) {
      console.warn('Geoapify place details error:', error);
      return null;
    }
  }

  /**
   * Calculate route using Geoapify Routing API
   * Compatible with TomTom calculateRoute interface
   */
  async calculateRoute(origin, destination, options = {}) {
    // Validate coordinates
    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      console.warn('Geoapify routing: Invalid coordinates');
      return { routes: [] };
    }

    const cacheKey = `route_${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}_${JSON.stringify(options)}`;

    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Build waypoints string: Geoapify uses lon,lat format (longitude first!)
      const waypoints = `${origin.lng},${origin.lat}|${destination.lng},${destination.lat}`;

      // Map TomTom travel modes to Geoapify modes
      const modeMap = {
        'car': 'drive',
        'truck': 'truck',
        'pedestrian': 'walk',
        'bicycle': 'bicycle',
        'scooter': 'scooter',
        'walk': 'walk',
        'drive': 'drive'
      };
      const mode = modeMap[options.travelMode] || 'drive';

      const params = new URLSearchParams({
        waypoints: waypoints,
        mode: mode,
        apiKey: this.apiKey
      });

      // Add traffic option (only for drive mode)
      if (mode === 'drive' && options.traffic !== false) {
        params.append('traffic', 'approximated');
      }

      // Add details - Geoapify uses comma-separated values
      // Note: Each value must be 5-100 characters (removed 'time' as it's only 4 chars)
      // The API will still return time information in the response
      const details = ['instruction', 'geometry', 'distance'];
      params.append('details', details.join(','));

      const response = await fetch(
        `${this.baseUrl}/routing?${params}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        // Get error details from response
        let errorMessage = `Geoapify routing failed: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage += ` - ${errorData.message}`;
          }
          console.error('Geoapify routing error details:', errorData);
        } catch (e) {
          // If we can't parse error, use status text
          errorMessage += ` - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Check if we have valid route data
      if (!data || !data.features || data.features.length === 0) {
        console.warn('Geoapify routing returned no routes');
        return { routes: [] };
      }

      const transformed = this.transformRoutingResult(data);
      
      // Cache the result
      this.setCache(cacheKey, transformed);

      return transformed;
    } catch (error) {
      console.warn('Geoapify routing error:', error);
      // Return empty routes instead of throwing to allow fallback
      return { routes: [] };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Geoapify cache cleared');
  }
}

// Create singleton instance
const geoapifyService = new GeoapifyService();

export default geoapifyService;

