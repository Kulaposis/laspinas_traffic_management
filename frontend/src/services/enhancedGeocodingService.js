/**
 * Enhanced Geocoding Service
 * Uses backend API as proxy to avoid CORS and API key issues
 * Falls back to Geoapify for better autocomplete and places search
 */

import api from './api';
import geoapifyService from './geoapifyService';

class EnhancedGeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.debounceTimeout = 300; // 300ms debounce
    this.debounceTimer = null;
    this.baseEndpoint = '/traffic';
  }

  /**
   * Search for locations using backend API proxy with enhanced algorithm
   */
  async searchLocations(query, options = {}) {
    if (!query || query.length < 1) {
      return [];
    }

    const cacheKey = `search_${query.toLowerCase()}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const normalizedQuery = query.toLowerCase().trim();
      const limit = options.limit || 20; // Increased default limit
      
      // For very short queries (1-3 chars), ONLY use Geoapify autocomplete
      // Backend API and searchPlaces don't handle short queries well
      const isVeryShortQuery = query.length <= 3;
      
      // Always use Geoapify autocomplete as primary method for better results
      // Geoapify provides excellent autocomplete with strong Las Piñas prioritization
      let allResults = [];
      let seenIds = new Set();
      
      // Use Geoapify autocomplete for all queries (better autocomplete experience)
      try {
        // Las Piñas City center coordinates
        const lasPinasCenter = options.center || { lat: 14.4504, lng: 121.0170 };
        
        // Use Geoapify autocomplete with enhanced Las Piñas focus
        const autocompleteResult = await geoapifyService.autocompletePlaces(query, {
          limit: limit * 2, // Get more results to filter and prioritize
          countrySet: 'PH', // Always filter to Philippines
          lat: lasPinasCenter.lat,
          lng: lasPinasCenter.lng,
          radius: options.radius || 20000 // 20km radius to include Las Piñas and nearby areas
        });
        
        // Transform and prioritize Geoapify autocomplete results
        if (autocompleteResult.results && autocompleteResult.results.length > 0) {
          autocompleteResult.results.forEach(result => {
            const name = result.poi?.name || result.address?.freeformAddress || 'Unknown Location';
            const resultId = result.metadata?.placeId || `${result.position?.lat || result.position?.latitude}_${result.position?.lon || result.position?.longitude}`;
            
            if (!seenIds.has(resultId)) {
              seenIds.add(resultId);
              
              // Check if result is in Las Piñas City
              const municipality = (result.address?.municipality || '').toLowerCase();
              const countrySubdivision = (result.address?.countrySubdivision || '').toLowerCase();
              const addressFull = (result.address?.freeformAddress || name).toLowerCase();
              const isLasPinas = municipality.includes('las piñas') || 
                                municipality.includes('las pinas') ||
                                countrySubdivision.includes('las piñas') ||
                                countrySubdivision.includes('las pinas') ||
                                addressFull.includes('las piñas') ||
                                addressFull.includes('las pinas');
              
              // Calculate distance from Las Piñas center for proximity scoring
              const resultLat = result.position?.lat || result.position?.latitude;
              const resultLng = result.position?.lon || result.position?.longitude;
              const distance = this.calculateDistance(
                lasPinasCenter.lat, lasPinasCenter.lng,
                resultLat, resultLng
              );
              
              // Boost score for Las Piñas results
              let enhancedScore = result.score || 0.8;
              if (isLasPinas) {
                enhancedScore += 0.3; // Strong boost for Las Piñas
              }
              if (distance < 5000) { // Within 5km of Las Piñas center
                enhancedScore += 0.2;
              } else if (distance < 10000) { // Within 10km
                enhancedScore += 0.1;
              }
              
              allResults.push({
                id: resultId,
                name: name,
                lat: resultLat,
                lng: resultLng,
                address: {
                  full: result.address?.freeformAddress || name,
                  freeformAddress: result.address?.freeformAddress || name,
                  streetName: result.address?.streetName || '',
                  streetNumber: result.address?.streetNumber || '',
                  municipality: result.address?.municipality || '',
                  countrySubdivision: result.address?.countrySubdivision || '',
                  postalCode: result.address?.postalCode || '',
                  country: result.address?.country || 'Philippines'
                },
                type: result.type || (result.poi ? 'POI' : 'address'),
                score: enhancedScore,
                provider: 'Geoapify',
                poi: result.poi,
                isLasPinas: isLasPinas,
                distance: distance,
                matchScore: this.calculateMatchScore(normalizedQuery, { 
                  name: name, 
                  address: { 
                    full: result.address?.freeformAddress || name,
                    municipality: result.address?.municipality || ''
                  } 
                })
              });
            }
          });
        }
      } catch (geoapifyError) {
        console.warn('Geoapify autocomplete failed, trying backend API:', geoapifyError);
      }
      
      // Try backend API as fallback ONLY if:
      // 1. Geoapify returned no results
      // 2. Query is longer than 3 characters (backend API doesn't handle short queries well)
      // 3. Not a very short query (skip entirely for 1-3 char queries)
      if (allResults.length === 0 && !isVeryShortQuery) {
        // Generate search variations for better results (only for longer queries)
        const searchVariations = this.generateSearchVariations(query);
        
        // Limit to first 3 variations to avoid too many timeout errors
        const limitedVariations = searchVariations.slice(0, 3);
        
        // Search with each variation (with timeout protection)
        for (const variation of limitedVariations) {
          // Skip variations that are too short (will cause backend API issues)
          if (variation.length <= 2) continue;
          
          try {
            const params = new URLSearchParams({
              query: variation,
              limit: limit,
              country: options.countrySet || 'PH'
            });

            // Add timeout to prevent long waits
            const response = await Promise.race([
              api.get(`${this.baseEndpoint}/geocode?${params}`),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Backend API timeout')), 5000)
              )
            ]);
            
            if (response.data && Array.isArray(response.data)) {
              // Transform and add results
              response.data.forEach(result => {
                const resultId = result.id || `${result.lat}_${result.lng}`;
                if (!seenIds.has(resultId)) {
                  seenIds.add(resultId);
                  allResults.push({
                    id: resultId,
                    name: result.name || 'Unknown',
                    lat: result.lat,
                    lng: result.lng,
                    address: {
                      full: result.address?.full || result.name,
                      freeformAddress: result.address?.full || result.name,
                      streetName: result.address?.street || '',
                      streetNumber: '',
                      municipality: result.address?.city || result.address?.municipality || '',
                      countrySubdivision: result.address?.state || result.address?.countrySubdivision || '',
                      postalCode: result.address?.postalCode || '',
                      country: result.address?.country || 'Philippines'
                    },
                    type: result.type || 'general',
                    score: result.confidence || 0.8,
                    provider: result.provider || 'OpenStreetMap',
                    searchMatch: variation, // Track which variation matched
                    matchScore: this.calculateMatchScore(normalizedQuery, result)
                  });
                }
              });
              
              // If we got results, break early to avoid unnecessary calls
              if (allResults.length >= limit) break;
            }
          } catch (err) {
            // Silently continue with next variation if one fails (don't log timeout errors)
            if (err.message !== 'Backend API timeout') {
              console.warn(`Search variation "${variation}" failed:`, err);
            }
          }
        }
      }
      
      // If backend API failed and we have no results, try Geoapify searchPlaces as fallback
      // But only for queries longer than 3 chars (short queries should use autocomplete only)
      if (allResults.length === 0 && query.length > 3) {
        try {
          const lasPinasCenter = options.center || { lat: 14.4504, lng: 121.0170 };
          // Use autocomplete instead of searchPlaces to avoid 400 errors
          const geoapifyResults = await geoapifyService.autocompletePlaces(query, {
            limit: limit,
            countrySet: 'PH', // Always filter to Philippines
            lat: lasPinasCenter.lat,
            lng: lasPinasCenter.lng,
            radius: options.radius || 20000
          });
          
          // Transform Geoapify search results
          if (geoapifyResults.results && geoapifyResults.results.length > 0) {
            geoapifyResults.results.forEach(result => {
              const name = result.poi?.name || result.address?.freeformAddress || 'Unknown Location';
              const resultId = result.metadata?.placeId || `${result.position?.lat || result.position?.latitude}_${result.position?.lon || result.position?.longitude}`;
              
              if (!seenIds.has(resultId)) {
                seenIds.add(resultId);
                allResults.push({
                  id: resultId,
                  name: name,
                  lat: result.position?.lat || result.position?.latitude,
                  lng: result.position?.lon || result.position?.longitude,
                  address: {
                    full: result.address?.freeformAddress || name,
                    freeformAddress: result.address?.freeformAddress || name,
                    streetName: result.address?.streetName || '',
                    streetNumber: result.address?.streetNumber || '',
                    municipality: result.address?.municipality || '',
                    countrySubdivision: result.address?.countrySubdivision || '',
                    postalCode: result.address?.postalCode || '',
                    country: result.address?.country || 'Philippines'
                  },
                  type: result.type || (result.poi ? 'POI' : 'address'),
                  score: result.score || 0.8,
                  provider: 'Geoapify',
                  poi: result.poi,
                  matchScore: this.calculateMatchScore(normalizedQuery, { name: name, address: { full: result.address?.freeformAddress || name } })
                });
              }
            });
          }
        } catch (geoapifyError) {
          console.warn('Geoapify searchPlaces fallback failed:', geoapifyError);
        }
      }
      
      // Add local Las Piñas locations if query matches
      if (this.isLasPinasQuery(normalizedQuery)) {
        const localResults = this.getLocalLasPinasLocations();
        localResults.forEach(loc => {
          const resultId = `local_${loc.lat}_${loc.lng}`;
          if (!seenIds.has(resultId)) {
            seenIds.add(resultId);
            allResults.push({
              id: resultId,
              name: loc.name,
              lat: loc.lat,
              lng: loc.lng,
              address: {
                full: loc.fullAddress,
                freeformAddress: loc.fullAddress,
                streetName: loc.street || '',
                municipality: 'Las Piñas',
                countrySubdivision: 'Metro Manila',
                country: 'Philippines'
              },
              type: loc.type || 'general',
              score: 0.95, // High score for local results
              provider: 'Local',
              isLocal: true,
              matchScore: this.calculateMatchScore(normalizedQuery, { name: loc.name, address: { full: loc.fullAddress } })
            });
          }
        });
      }
      
      // Sort by match score and relevance with strong Las Piñas prioritization
      const sortedResults = allResults
        .sort((a, b) => {
          // Prioritize local Las Piñas database results
          if (a.isLocal && !b.isLocal) return -1;
          if (!a.isLocal && b.isLocal) return 1;
          
          // Prioritize Geoapify results that are in Las Piñas
          if (a.isLasPinas && !b.isLasPinas) return -1;
          if (!a.isLasPinas && b.isLasPinas) return 1;
          
          // Prioritize Geoapify provider (better quality)
          if (a.provider === 'Geoapify' && b.provider !== 'Geoapify') return -1;
          if (a.provider !== 'Geoapify' && b.provider === 'Geoapify') return 1;
          
          // Sort by enhanced score (includes Las Piñas boost)
          if (Math.abs((b.score || 0) - (a.score || 0)) > 0.1) {
            return (b.score || 0) - (a.score || 0);
          }
          
          // Sort by match score
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          
          // Then by distance (closer to Las Piñas center is better)
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          
          // Finally by provider confidence
          return (b.score || 0) - (a.score || 0);
        })
        .slice(0, limit);
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: sortedResults,
        timestamp: Date.now()
      });

      return sortedResults;
    } catch (error) {
      console.error('Search error:', error);
      
      // Try Geoapify as final fallback before mock results
      try {
        const lasPinasCenter = options.center || { lat: 14.4504, lng: 121.0170 };
        
        // Always use autocomplete for better results
        const geoapifyResult = await geoapifyService.autocompletePlaces(query, {
          limit: options.limit || 20,
          countrySet: 'PH', // Always filter to Philippines
          lat: lasPinasCenter.lat,
          lng: lasPinasCenter.lng,
          radius: options.radius || 20000 // 20km radius
        });
        
        if (geoapifyResult.results && geoapifyResult.results.length > 0) {
          const transformedResults = geoapifyResult.results.map(result => {
            const name = result.poi?.name || result.address?.freeformAddress || 'Unknown Location';
            const municipality = (result.address?.municipality || '').toLowerCase();
            const addressFull = (result.address?.freeformAddress || name).toLowerCase();
            const isLasPinas = municipality.includes('las piñas') || 
                              municipality.includes('las pinas') ||
                              addressFull.includes('las piñas') ||
                              addressFull.includes('las pinas');
            
            const resultLat = result.position?.lat || result.position?.latitude;
            const resultLng = result.position?.lon || result.position?.longitude;
            const distance = this.calculateDistance(
              lasPinasCenter.lat, lasPinasCenter.lng,
              resultLat, resultLng
            );
            
            // Boost score for Las Piñas
            let enhancedScore = result.score || 0.8;
            if (isLasPinas) enhancedScore += 0.3;
            if (distance < 5000) enhancedScore += 0.2;
            else if (distance < 10000) enhancedScore += 0.1;
            
            return {
              id: result.metadata?.placeId || `${resultLat}_${resultLng}`,
              name: name,
              lat: resultLat,
              lng: resultLng,
              address: {
                full: result.address?.freeformAddress || name,
                freeformAddress: result.address?.freeformAddress || name,
                streetName: result.address?.streetName || '',
                streetNumber: result.address?.streetNumber || '',
                municipality: result.address?.municipality || '',
                countrySubdivision: result.address?.countrySubdivision || '',
                postalCode: result.address?.postalCode || '',
                country: result.address?.country || 'Philippines'
              },
              type: result.type || (result.poi ? 'POI' : 'address'),
              score: enhancedScore,
              provider: 'Geoapify',
              poi: result.poi,
              isLasPinas: isLasPinas,
              distance: distance,
              matchScore: this.calculateMatchScore(query.toLowerCase().trim(), { 
                name: name, 
                address: { 
                  full: result.address?.freeformAddress || name,
                  municipality: result.address?.municipality || ''
                } 
              })
            };
          });
          
          // Sort with Las Piñas prioritization
          return transformedResults
            .sort((a, b) => {
              if (a.isLasPinas && !b.isLasPinas) return -1;
              if (!a.isLasPinas && b.isLasPinas) return 1;
              if (a.distance !== undefined && b.distance !== undefined) {
                return a.distance - b.distance;
              }
              return (b.score || 0) - (a.score || 0);
            });
        }
      } catch (geoapifyFallbackError) {
        console.warn('Geoapify fallback also failed:', geoapifyFallbackError);
      }
      
      // Return mock results for common locations as final fallback
      return this.getMockResults(query);
    }
  }

  /**
   * Generate search variations for better coverage
   * Only creates variations for queries longer than 3 characters to avoid invalid queries
   */
  generateSearchVariations(query) {
    const variations = [query]; // Original query first
    const normalized = query.toLowerCase().trim();
    
    // Skip variations for very short queries (they cause API errors)
    if (query.length <= 3) {
      return variations;
    }
    
    // Common variations for Las Piñas
    if (normalized.includes('las pinas') || normalized.includes('las piñas')) {
      variations.push('Las Piñas City');
      variations.push('Las Piñas');
      variations.push('Las Pinas');
      variations.push('Las Piñas, Metro Manila');
      variations.push('Las Piñas, Philippines');
    }
    
    // Add city/country suffixes only if query is meaningful (longer than 3 chars)
    if (query.length > 3 && !normalized.includes('city') && !normalized.includes('philippines')) {
      variations.push(`${query} City`);
      variations.push(`${query}, Metro Manila`);
      variations.push(`${query}, Philippines`);
    }
    
    // Remove duplicates and filter out invalid short variations
    return [...new Set(variations)].filter(v => v.length > 2);
  }

  /**
   * Calculate match score for relevance ranking
   */
  calculateMatchScore(query, result) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const nameLower = (result.name || '').toLowerCase();
    const addressLower = (result.address?.full || result.address?.freeformAddress || '').toLowerCase();
    const municipalityLower = (result.address?.municipality || '').toLowerCase();
    
    // Exact match in name
    if (nameLower === queryLower) score += 100;
    // Starts with query
    else if (nameLower.startsWith(queryLower)) score += 80;
    // Contains query
    else if (nameLower.includes(queryLower)) score += 60;
    
    // Address matches
    if (addressLower.includes(queryLower)) score += 40;
    
    // Municipality matches
    if (municipalityLower.includes(queryLower)) score += 30;
    
    // Partial word matches
    const queryWords = queryLower.split(/\s+/);
    const nameWords = nameLower.split(/\s+/);
    queryWords.forEach(qWord => {
      if (nameWords.some(nWord => nWord.startsWith(qWord) || qWord.startsWith(nWord))) {
        score += 10;
      }
    });
    
    return score;
  }

  /**
   * Check if query is related to Las Piñas
   */
  isLasPinasQuery(query) {
    const lasPinasTerms = ['las pinas', 'las piñas', 'laspinas', 'las pinas city', 'las piñas city'];
    return lasPinasTerms.some(term => query.includes(term));
  }

  /**
   * Get local Las Piñas locations database
   */
  getLocalLasPinasLocations() {
    return [
      { name: 'SM Southmall Las Piñas', lat: 14.4504, lng: 121.0170, type: 'shopping', street: 'Alabang-Zapote Road', fullAddress: 'SM Southmall, Alabang-Zapote Road, Las Piñas City, Metro Manila' },
      { name: 'Las Piñas City Hall', lat: 14.4378, lng: 121.0122, type: 'government', street: 'Real Street', fullAddress: 'Las Piñas City Hall, Real Street, Las Piñas City' },
      { name: 'Zapote Public Market', lat: 14.4456, lng: 121.0189, type: 'market', street: 'Zapote Road', fullAddress: 'Zapote Public Market, Zapote Road, Las Piñas' },
      { name: 'BF Homes Las Piñas', lat: 14.4389, lng: 121.0344, type: 'residential', street: 'BF Homes', fullAddress: 'BF Homes, Las Piñas City' },
      { name: 'Alabang-Zapote Road', lat: 14.4450, lng: 121.0200, type: 'road', street: 'Alabang-Zapote Road', fullAddress: 'Alabang-Zapote Road, Las Piñas City' },
      { name: 'University of Perpetual Help System DALTA', lat: 14.4456, lng: 121.0156, type: 'education', street: 'Alabang-Zapote Road', fullAddress: 'University of Perpetual Help, Alabang-Zapote Road, Las Piñas' },
      { name: 'St. Joseph Parish Church', lat: 14.4370, lng: 121.0120, type: 'religious', street: 'Real Street', fullAddress: 'St. Joseph Parish Church, Las Piñas City' },
      { name: 'Las Piñas General Hospital', lat: 14.4390, lng: 121.0140, type: 'healthcare', street: 'Alabang-Zapote Road', fullAddress: 'Las Piñas General Hospital, Las Piñas City' },
      { name: 'Villar Sipag', lat: 14.4400, lng: 121.0160, type: 'attraction', street: 'Alabang-Zapote Road', fullAddress: 'Villar Sipag, Las Piñas City' },
      { name: 'Las Piñas City National High School', lat: 14.4380, lng: 121.0130, type: 'education', street: 'Real Street', fullAddress: 'Las Piñas City National High School, Las Piñas' },
      { name: 'Las Piñas Doctors Hospital', lat: 14.4410, lng: 121.0150, type: 'healthcare', street: 'Alabang-Zapote Road', fullAddress: 'Las Piñas Doctors Hospital, Las Piñas City' },
      { name: 'Robinsons Place Las Piñas', lat: 14.4520, lng: 121.0180, type: 'shopping', street: 'Alabang-Zapote Road', fullAddress: 'Robinsons Place Las Piñas, Las Piñas City' },
      { name: 'Villar Coliseum', lat: 14.4420, lng: 121.0170, type: 'sports', street: 'Alabang-Zapote Road', fullAddress: 'Villar Coliseum, Las Piñas City' },
      { name: 'Las Piñas City Library', lat: 14.4360, lng: 121.0110, type: 'cultural', street: 'Real Street', fullAddress: 'Las Piñas City Library, Las Piñas' },
      { name: 'Las Piñas Police Station', lat: 14.4375, lng: 121.0125, type: 'government', street: 'Real Street', fullAddress: 'Las Piñas Police Station, Las Piñas City' }
    ];
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
      
      // Fallback to Geoapify if no data from backend
      try {
        const geoapifyResult = await geoapifyService.getPlaceDetails(lat, lng, options);
        if (geoapifyResult) {
          const transformedResult = {
            id: geoapifyResult.id || `${lat}_${lng}`,
            name: geoapifyResult.name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            lat: geoapifyResult.lat || lat,
            lng: geoapifyResult.lng || lng,
            address: {
              full: geoapifyResult.address?.full || geoapifyResult.name,
              freeformAddress: geoapifyResult.address?.full || geoapifyResult.name,
              streetName: geoapifyResult.address?.street || '',
              streetNumber: '',
              municipality: geoapifyResult.address?.city || geoapifyResult.address?.municipality || 'Las Piñas',
              countrySubdivision: geoapifyResult.address?.state || '',
              postalCode: geoapifyResult.address?.postalCode || '',
              country: geoapifyResult.address?.country || 'Philippines'
            },
            type: geoapifyResult.type || 'general',
            provider: 'Geoapify',
            confidence: 0.8
          };
          
          // Cache the result
          this.cache.set(cacheKey, {
            data: [transformedResult],
            timestamp: Date.now()
          });
          
          return [transformedResult];
        }
      } catch (geoapifyError) {
        console.warn('Geoapify reverse geocode fallback failed:', geoapifyError);
      }
      
      // Final fallback if no data - return as array
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
      // Try Geoapify as fallback on error
      try {
        const geoapifyResult = await geoapifyService.getPlaceDetails(lat, lng, options);
        if (geoapifyResult) {
          const transformedResult = {
            id: geoapifyResult.id || `${lat}_${lng}`,
            name: geoapifyResult.name || `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            lat: geoapifyResult.lat || lat,
            lng: geoapifyResult.lng || lng,
            address: {
              full: geoapifyResult.address?.full || geoapifyResult.name,
              freeformAddress: geoapifyResult.address?.full || geoapifyResult.name,
              streetName: geoapifyResult.address?.street || '',
              streetNumber: '',
              municipality: geoapifyResult.address?.city || geoapifyResult.address?.municipality || 'Las Piñas',
              countrySubdivision: geoapifyResult.address?.state || '',
              postalCode: geoapifyResult.address?.postalCode || '',
              country: geoapifyResult.address?.country || 'Philippines'
            },
            type: geoapifyResult.type || 'general',
            provider: 'Geoapify',
            confidence: 0.8
          };
          
          return [transformedResult];
        }
      } catch (geoapifyError) {
        console.warn('Geoapify reverse geocode error fallback failed:', geoapifyError);
      }
      
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
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get location suggestions for autocomplete
   * Uses Geoapify autocomplete for better results with Las Piñas prioritization
   */
  async getSuggestions(query, options = {}) {
    if (!query || query.length < 1) {
      return [];
    }

    // Always use Geoapify autocomplete for better results with Las Piñas focus
    try {
      const lasPinasCenter = options.center || { lat: 14.4504, lng: 121.0170 };
      const autocompleteResult = await geoapifyService.autocompletePlaces(query, {
        limit: 10, // Get more results to prioritize
        countrySet: 'PH', // Always filter to Philippines
        lat: lasPinasCenter.lat,
        lng: lasPinasCenter.lng,
        radius: options.radius || 20000 // 20km radius
      });
      
      if (autocompleteResult.results && autocompleteResult.results.length > 0) {
        // Transform and prioritize results
        const transformedResults = autocompleteResult.results.map(result => {
          const name = result.poi?.name || result.address?.freeformAddress || 'Unknown Location';
          const municipality = (result.address?.municipality || '').toLowerCase();
          const addressFull = (result.address?.freeformAddress || name).toLowerCase();
          const isLasPinas = municipality.includes('las piñas') || 
                            municipality.includes('las pinas') ||
                            addressFull.includes('las piñas') ||
                            addressFull.includes('las pinas');
          
          const resultLat = result.position?.lat || result.position?.latitude;
          const resultLng = result.position?.lon || result.position?.longitude;
          const distance = this.calculateDistance(
            lasPinasCenter.lat, lasPinasCenter.lng,
            resultLat, resultLng
          );
          
          return {
            id: result.metadata?.placeId || `${resultLat}_${resultLng}`,
            name: name,
            lat: resultLat,
            lng: resultLng,
            type: result.type || (result.poi ? 'POI' : 'address'),
            provider: 'Geoapify',
            isLasPinas: isLasPinas,
            distance: distance,
            score: result.score || 0.8
          };
        });
        
        // Sort: Las Piñas first, then by distance, then by score
        return transformedResults
          .sort((a, b) => {
            if (a.isLasPinas && !b.isLasPinas) return -1;
            if (!a.isLasPinas && b.isLasPinas) return 1;
            if (a.distance !== undefined && b.distance !== undefined) {
              return a.distance - b.distance;
            }
            return (b.score || 0) - (a.score || 0);
          })
          .slice(0, 7); // Return top 7
      }
    } catch (error) {
      console.warn('Geoapify autocomplete failed in getSuggestions, using searchWithDebounce:', error);
    }

    // Fallback to standard search with debounce
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
