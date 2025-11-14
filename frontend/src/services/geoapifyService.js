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
   * Enhanced to extract detailed instructions, tolls, ferries, and route information
   * Geoapify returns GeoJSON FeatureCollection with features containing properties.legs[]
   */
  transformRoutingResult(geoapifyResult, options = {}) {
    if (!geoapifyResult || !geoapifyResult.features || geoapifyResult.features.length === 0) {
      return { routes: [] };
    }

    const routes = geoapifyResult.features.map((feature, index) => {
      const props = feature.properties;
      
      // Geoapify geometry: MultiLineString - array of LineStrings (one per leg)
      // Each LineString is an array of [lon, lat] coordinates
      let allCoordinates = [];
      if (feature.geometry && feature.geometry.coordinates) {
        if (Array.isArray(feature.geometry.coordinates[0][0])) {
          // MultiLineString - multiple legs
          feature.geometry.coordinates.forEach(legCoords => {
            legCoords.forEach(coord => {
              allCoordinates.push([coord[1], coord[0]]); // Convert [lon, lat] to [lat, lng]
            });
          });
        } else {
          // Single LineString
          feature.geometry.coordinates.forEach(coord => {
            allCoordinates.push([coord[1], coord[0]]); // Convert [lon, lat] to [lat, lng]
          });
        }
      }
      
      // Extract route metrics from properties
      const distanceMeters = props.distance || 0;
      const timeSeconds = props.time || 0;
      const distanceKm = distanceMeters / 1000;
      const durationMinutes = timeSeconds / 60;

      // Extract turn-by-turn instructions from legs
      const steps = [];
      if (props.legs && Array.isArray(props.legs)) {
        props.legs.forEach((leg, legIndex) => {
          if (leg.steps && Array.isArray(leg.steps)) {
            leg.steps.forEach((step, stepIndex) => {
              // Get step coordinates from geometry using from_index and to_index
              let stepLocation = null;
              if (step.from_index !== undefined && feature.geometry.coordinates) {
                const legGeometry = Array.isArray(feature.geometry.coordinates[0][0]) 
                  ? feature.geometry.coordinates[legIndex] 
                  : feature.geometry.coordinates;
                if (legGeometry && legGeometry[step.from_index]) {
                  const coord = legGeometry[step.from_index];
                  stepLocation = [coord[1], coord[0]]; // Convert [lon, lat] to [lat, lng]
                }
              }

              const stepData = {
                index: steps.length,
                instruction: step.instruction?.text || step.instruction || 'Continue',
                maneuver_type: this.mapGeoapifyManeuverType(step.instruction?.type || 'Straight'),
                distance_meters: step.distance || 0,
                travel_time_seconds: step.time || 0,
                street_name: step.name || step.instruction?.streets?.[0] || '',
                location: stepLocation
              };
              steps.push(stepData);
            });
          }
        });
      }

      // If no steps extracted, create a basic step
      if (steps.length === 0 && allCoordinates.length >= 2) {
        steps.push({
          index: 0,
          instruction: 'Follow the route to your destination',
          maneuver_type: 'straight',
          distance_meters: distanceMeters,
          travel_time_seconds: timeSeconds,
          street_name: '',
          location: allCoordinates[0]
        });
      }

      // Check for tolls, ferries, highways from route properties and leg steps
      const hasTolls = props.toll === true || 
                       (props.legs && props.legs.some(leg => 
                         leg.steps && leg.steps.some(step => step.toll === true)
                       ));
      const hasFerries = props.ferry === true ||
                         (props.legs && props.legs.some(leg => 
                           leg.steps && leg.steps.some(step => step.ferry === true)
                         ));
      const hasHighways = props.legs && props.legs.some(leg => 
                         leg.steps && leg.steps.some(step => 
                           step.road_class && (step.road_class === 'motorway' || step.road_class === 'trunk')
                         ));

      // Apply avoidance filters if specified
      if (options.avoid === 'tolls' && hasTolls) {
        return null; // Filter out toll routes
      }
      if (options.avoid === 'ferries' && hasFerries) {
        return null; // Filter out ferry routes
      }
      if (options.avoid === 'highways' && hasHighways) {
        return null; // Filter out highway routes
      }

      // Convert coordinates to TomTom format (for compatibility)
      const points = allCoordinates.map(coord => ({
        latitude: coord[0],
        longitude: coord[1]
      }));

      // Create route in TomTom-compatible format
      const route = {
        summary: {
          lengthInMeters: distanceMeters,
          travelTimeInSeconds: timeSeconds,
          hasTolls: hasTolls,
          hasFerry: hasFerries,
          hasHighway: hasHighways
        },
        legs: [{
          points: points,
          summary: {
            lengthInMeters: distanceMeters,
            travelTimeInSeconds: timeSeconds
          },
          instructions: steps.map(step => ({
            message: step.instruction,
            instructionType: this.reverseMapManeuverType(step.maneuver_type),
            routeOffsetInMeters: step.distance_meters,
            travelTimeInSeconds: step.travel_time_seconds,
            street: step.street_name,
            point: step.location ? {
              latitude: step.location[0],
              longitude: step.location[1]
            } : null
          }))
        }],
        geometry: {
          coordinates: allCoordinates.map(coord => [coord[1], coord[0]]) // Back to [lon, lat] for geometry
        },
        // Additional route information for our system
        route_id: `geoapify_${Date.now()}_${index}`,
        route_name: props.route_name || (index === 0 ? 'Recommended Route' : `Alternative ${index}`),
        route_type: props.route_type || (index === 0 ? 'fastest' : 'alternative'),
        route_quality: index === 0 ? 'primary' : 'alternative',
        distance_km: distanceKm,
        estimated_duration_minutes: durationMinutes,
        route_coordinates: allCoordinates,
        steps: steps,
        traffic_conditions: props.traffic ? 'heavy' : 'light',
        has_tolls: hasTolls,
        has_highways: hasHighways,
        has_ferries: hasFerries,
        confidence_level: 'high',
        data_source: 'geoapify',
        real_time_traffic: props.traffic === 'enabled' || props.traffic === 'approximated',
        bounds: this.calculateRouteBounds(allCoordinates)
      };

      return route;
    }).filter(route => route !== null); // Remove filtered routes

    if (routes.length === 0) {
      return { routes: [] };
    }

    // Sort routes by duration (fastest first)
    routes.sort((a, b) => {
      const durationA = a.estimated_duration_minutes || a.summary?.travelTimeInSeconds / 60 || Infinity;
      const durationB = b.estimated_duration_minutes || b.summary?.travelTimeInSeconds / 60 || Infinity;
      return durationA - durationB;
    });

    // Return in format compatible with both TomTom and our enhanced routing service
    return {
      routes: routes,
      recommended_route: routes[0],
      origin: routes[0].route_coordinates && routes[0].route_coordinates.length > 0 ? {
        lat: routes[0].route_coordinates[0][0],
        lon: routes[0].route_coordinates[0][1]
      } : null,
      destination: routes[0].route_coordinates && routes[0].route_coordinates.length > 0 ? {
        lat: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][0],
        lon: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][1]
      } : null
    };
  }

  /**
   * Map Geoapify maneuver types to our system
   */
  mapGeoapifyManeuverType(geoapifyType) {
    const typeMap = {
      'turn-left': 'turn-left',
      'turn-right': 'turn-right',
      'turn-sharp-left': 'sharp-left',
      'turn-sharp-right': 'sharp-right',
      'turn-slight-left': 'bear-left',
      'turn-slight-right': 'bear-right',
      'continue': 'straight',
      'straight': 'straight',
      'uturn': 'uturn',
      'depart': 'depart',
      'arrive': 'arrive',
      'merge': 'merge',
      'fork': 'fork',
      'roundabout': 'roundabout-enter',
      'roundabout-exit': 'roundabout-exit',
      'exit': 'exit',
      'enter-roundabout': 'roundabout-enter',
      'exit-roundabout': 'roundabout-exit',
      'enter-motorway': 'merge',
      'exit-motorway': 'exit',
      'new-name': 'straight',
      'end-of-road': 'arrive'
    };

    return typeMap[geoapifyType?.toLowerCase()] || 'straight';
  }

  /**
   * Reverse map maneuver type back to TomTom format (for compatibility)
   */
  reverseMapManeuverType(maneuverType) {
    const reverseMap = {
      'turn-left': 'TURN_LEFT',
      'turn-right': 'TURN_RIGHT',
      'sharp-left': 'SHARP_LEFT',
      'sharp-right': 'SHARP_RIGHT',
      'bear-left': 'BEAR_LEFT',
      'bear-right': 'BEAR_RIGHT',
      'straight': 'STRAIGHT',
      'uturn': 'MAKE_UTURN',
      'depart': 'DEPART',
      'arrive': 'ARRIVE',
      'merge': 'ENTER_HIGHWAY',
      'exit': 'EXIT_HIGHWAY',
      'roundabout-enter': 'ENTER_ROUNDABOUT',
      'roundabout-exit': 'EXIT_ROUNDABOUT'
    };

    return reverseMap[maneuverType] || 'STRAIGHT';
  }

  /**
   * Calculate route bounds for map display
   */
  calculateRouteBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    coordinates.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    return {
      southwest: [minLat, minLng],
      northeast: [maxLat, maxLng]
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
   * Enhanced with support for alternatives, better instructions, and more routing options
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
      // Build waypoints string: Geoapify uses lat,lon format (latitude first!)
      // According to docs: waypoints=50.679023,4.569876|50.66170,4.578667
      const waypoints = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;

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

      // Add traffic option (only for drive mode) - use 'approximated' or 'enabled' for better traffic data
      if (mode === 'drive' && options.traffic !== false) {
        params.append('traffic', 'approximated'); // Use 'approximated' for better performance, 'enabled' for real-time
      }

      // Enhanced details - request comprehensive route information
      // Geoapify details parameter accepts: instruction_details, route_details, elevation
      // instruction_details: Adds detailed turn-by-turn instructions
      // route_details: Adds road class, surface, speed limits, etc.
      const details = ['instruction_details', 'route_details'];
      params.append('details', details.join(','));

      // Request route alternatives if specified
      const maxAlternatives = options.maxAlternatives || 1;
      if (maxAlternatives > 1) {
        // Geoapify doesn't have a direct alternatives parameter, but we can request different route types
        // We'll make multiple requests with different optimization types
        return await this.getGeoapifyRoutesWithAlternatives(origin, destination, options, mode, maxAlternatives);
      }

      // Add route optimization type (not "optimize" - it's "type")
      // Geoapify supports: balanced (default), short, less_maneuvers
      if (options.routeType === 'shortest') {
        params.append('type', 'short');
      } else if (options.routeType === 'fastest' || options.avoidTraffic === true) {
        // For fastest, use balanced (default) or less_maneuvers for smoother routes
        params.append('type', 'less_maneuvers');
      }
      // Default is 'balanced' - no need to set it explicitly

      // Add avoidance options
      const avoid = [];
      if (options.avoid === 'tolls' || options.avoidTolls === true) {
        // Note: Geoapify doesn't have direct toll avoidance, but we can filter routes
        // We'll handle this in the transformation
      }
      if (options.avoid === 'ferries' || options.avoidFerries === true) {
        // Similar to tolls, we'll check ferry flag in response
      }
      if (options.avoid === 'highways' || options.avoidHighways === true) {
        // We can filter by road_class in the response
      }

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
      
      // Log the raw response for debugging
      console.log('Geoapify API raw response:', data);
      
      // Check if we have valid route data
      if (!data) {
        console.warn('Geoapify routing returned null/undefined response');
        return { routes: [] };
      }
      
      // Geoapify returns GeoJSON FeatureCollection by default
      if (!data.features || data.features.length === 0) {
        console.warn('Geoapify routing returned no features in response:', data);
        // Check if it's a JSON format response (has results array instead of features)
        if (data.results && Array.isArray(data.results) && data.results.length > 0) {
          console.log('Geoapify returned JSON format with results array');
          // Convert JSON format to FeatureCollection format for transformation
          const featureCollection = {
            type: 'FeatureCollection',
            features: data.results.map((result, index) => ({
              type: 'Feature',
              geometry: result.geometry || { type: 'LineString', coordinates: [] },
              properties: result
            }))
          };
          const transformed = this.transformRoutingResult(featureCollection, options);
          this.setCache(cacheKey, transformed);
          return transformed;
        }
        return { routes: [] };
      }

      const transformed = this.transformRoutingResult(data, options);
      
      // Log transformed result for debugging
      console.log('Geoapify transformed result:', transformed);
      
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
   * Get multiple route alternatives from Geoapify by requesting different optimization types
   */
  async getGeoapifyRoutesWithAlternatives(origin, destination, options, mode, maxAlternatives) {
    // Geoapify supports: balanced (default), short, less_maneuvers
    const optimizationTypes = ['balanced', 'short', 'less_maneuvers'];
    const routes = [];
    // Geoapify uses lat,lon format (latitude first!)
    const waypoints = `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`;

    // Request routes with different optimization types
    for (let i = 0; i < Math.min(maxAlternatives, optimizationTypes.length); i++) {
      try {
        const params = new URLSearchParams({
          waypoints: waypoints,
          mode: mode,
          type: optimizationTypes[i], // Use 'type' parameter, not 'optimize'
          apiKey: this.apiKey
        });

        // Add traffic for drive mode
        if (mode === 'drive' && options.traffic !== false) {
          params.append('traffic', 'approximated');
        }

        // Enhanced details - use correct parameter names
        const details = ['instruction_details', 'route_details'];
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

        if (response.ok) {
          const data = await response.json();
          if (data && data.features && data.features.length > 0) {
            // Transform each route
            const transformed = this.transformRoutingResult(data, options);
            if (transformed && transformed.routes && transformed.routes.length > 0) {
              // Mark route type
              transformed.routes[0].route_name = 
                optimizationTypes[i] === 'balanced' ? 'Balanced Route' :
                optimizationTypes[i] === 'short' ? 'Shortest Route' :
                'Smooth Route';
              transformed.routes[0].route_type = 
                optimizationTypes[i] === 'balanced' ? 'balanced' :
                optimizationTypes[i] === 'short' ? 'shortest' :
                'less_maneuvers';
              
              routes.push(transformed.routes[0]);
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to get ${optimizationModes[i]} route:`, error);
        // Continue to next optimization mode
      }
    }

    // If we got routes, combine them
    if (routes.length > 0) {
      // Remove duplicates (routes that are too similar)
      const uniqueRoutes = this.deduplicateRoutes(routes);
      
      // Sort by duration (fastest first)
      uniqueRoutes.sort((a, b) => (a.estimated_duration_minutes || Infinity) - (b.estimated_duration_minutes || Infinity));

      return {
        routes: uniqueRoutes,
        recommended_route: uniqueRoutes[0],
        origin: {
          lat: origin.lat,
          lon: origin.lng
        },
        destination: {
          lat: destination.lat,
          lon: destination.lng
        }
      };
    }

    // Fallback: return empty routes if no alternatives found
    console.warn('No route alternatives found from Geoapify');
    return { routes: [] };
  }

  /**
   * Remove duplicate routes (routes that are too similar)
   */
  deduplicateRoutes(routes) {
    const uniqueRoutes = [];
    
    for (const route of routes) {
      const isDuplicate = uniqueRoutes.some(existing => {
        const distanceDiff = Math.abs((existing.distance_km || 0) - (route.distance_km || 0));
        const durationDiff = Math.abs((existing.estimated_duration_minutes || 0) - (route.estimated_duration_minutes || 0));
        // Consider duplicate if distance and duration differ by less than 5%
        return distanceDiff < (existing.distance_km || 0) * 0.05 && 
               durationDiff < (existing.estimated_duration_minutes || 0) * 0.05;
      });
      
      if (!isDuplicate) {
        uniqueRoutes.push(route);
      }
    }
    
    return uniqueRoutes;
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

