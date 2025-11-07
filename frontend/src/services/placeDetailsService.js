/**
 * Place Details Service
 * Fetches detailed place information using TomTom Places API
 */

import tomtomService from './tomtomService';

class PlaceDetailsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours cache for place details
  }

  /**
   * Get comprehensive place details from TomTom Places API
   */
  async getPlaceDetails(place) {
    if (!place || (!place.lat && !place.latitude) || (!place.lng && !place.longitude)) {
      return null;
    }

    const lat = place.lat || place.latitude;
    const lng = place.lng || place.longitude || place.lon;
    const placeName = place.name || '';
    const cacheKey = `place_details_${lat}_${lng}_${placeName}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      let tomtomDetails = null;
      
      // Strategy 1: If we have a place name, search for it first (more accurate)
      if (placeName && placeName.length > 2) {
        try {
          const searchResults = await tomtomService.searchPlaces(placeName, {
            lat: lat,
            lng: lng,
            radius: 500, // Search within 500m
            limit: 5,
            countrySet: 'PH',
            typeahead: true
          });

          // Find the closest match to our coordinates
          if (searchResults.results && searchResults.results.length > 0) {
            // Find result closest to our coordinates
            let closestResult = null;
            let minDistance = Infinity;

            searchResults.results.forEach(result => {
              if (result.position) {
                const resultLat = result.position.lat;
                const resultLng = result.position.lon;
                const distance = this.calculateDistance(lat, lng, resultLat, resultLng);
                if (distance < minDistance && distance < 500) { // Within 500m
                  minDistance = distance;
                  closestResult = result;
                }
              }
            });

            if (closestResult) {
              console.log('✅ Found place via name search:', closestResult);
              
              // Extract POI data from search result
              // TomTom Search API includes POI data directly in the response
              const poiData = closestResult.poi || closestResult;
              const poiId = closestResult.id || poiData?.id;
              
              // Extract photos from search result if available
              // Photos might be in: poi.images, poi.photos, or result.images
              let transformedPhotos = null;
              const photosSource = poiData?.images || poiData?.photos || closestResult.images || closestResult.photos;
              
              if (photosSource) {
                if (Array.isArray(photosSource)) {
                  transformedPhotos = photosSource.map(photo => {
                    // Handle different photo formats
                    const photoUrl = typeof photo === 'string' 
                      ? photo 
                      : photo.url || photo.source || photo.originalUrl || photo.thumbnailUrl || photo.imageUrl;
                    return {
                      url: photoUrl,
                      title: photo.title || photo.caption || `Photo of ${placeName}`,
                      fallbackUrl: photo.thumbnailUrl || photoUrl
                    };
                  }).filter(photo => photo.url); // Filter out invalid photos
                } else if (typeof photosSource === 'string') {
                  transformedPhotos = [{
                    url: photosSource,
                    title: `Photo of ${placeName}`,
                    fallbackUrl: photosSource
                  }];
                }
                
                console.log('📸 Extracted photos from search result:', {
                  source: photosSource,
                  transformed: transformedPhotos,
                  count: transformedPhotos?.length || 0
                });
              } else {
                console.log('⚠️ No photos found in search result');
              }
              
              // Extract rating from search result if available
              // Ratings might be in: poi.rating, poi.ratings, or result.rating
              const rating = poiData?.rating || poiData?.ratings?.average || closestResult.rating || null;
              const reviewCount = poiData?.ratings?.count || poiData?.reviewCount || closestResult.reviewCount || null;
              
              console.log('⭐ Extracted rating from search result:', {
                rating: rating,
                reviewCount: reviewCount,
                poiData: poiData
              });
              
              tomtomDetails = {
                poi: closestResult,
                address: closestResult.address ? { address: closestResult.address } : null,
                coordinates: { lat, lng },
                poiId: poiId,
                photos: transformedPhotos || null,
                reviews: null, // Reviews are typically not available in TomTom Search API free tier
                rating: rating,
                reviewCount: reviewCount
              };
            } else {
              console.log('⚠️ Name search found results but none within 500m of coordinates');
            }
          }
        } catch (searchError) {
          console.warn('Place name search failed, trying coordinate-based search:', searchError);
        }
      }

      // Strategy 2: If name search didn't work, try coordinate-based search
      if (!tomtomDetails) {
        try {
          const coordinateDetails = await tomtomService.getPlaceDetails(lat, lng, {
            radius: 100
          });
          if (coordinateDetails && (coordinateDetails.poi || coordinateDetails.address)) {
            tomtomDetails = coordinateDetails;
          }
        } catch (coordError) {
          console.warn('Coordinate-based search failed:', coordError);
        }
      }

      // Strategy 3: Try reverse geocoding for at least an address
      if (!tomtomDetails || !tomtomDetails.address) {
        try {
          const reverseResult = await tomtomService.reverseGeocode(lat, lng);
          if (reverseResult && reverseResult.addresses && reverseResult.addresses.length > 0) {
            if (!tomtomDetails) {
              tomtomDetails = { address: { address: reverseResult.addresses[0] }, coordinates: { lat, lng } };
            } else {
              tomtomDetails.address = { address: reverseResult.addresses[0] };
            }
          }
        } catch (reverseError) {
          console.warn('Reverse geocoding failed:', reverseError);
        }
      }

      // Transform TomTom response to our format
      const placeDetails = tomtomDetails 
        ? this.transformTomTomPlaceDetails(tomtomDetails, place)
        : this.getBasicPlaceDetails(place);

      console.log('📍 Place details result:', {
        hasTomTomData: !!tomtomDetails,
        name: placeDetails.name,
        hasAddress: !!placeDetails.address?.full,
        hasPhone: !!placeDetails.phone,
        hasRating: !!placeDetails.rating,
        category: placeDetails.category,
        provider: placeDetails.provider
      });

      // Cache the result
      this.cache.set(cacheKey, {
        data: placeDetails,
        timestamp: Date.now()
      });

      return placeDetails;
    } catch (error) {
      console.warn('Failed to fetch place details from TomTom:', error);
      // Return basic details from the place object (no random data)
      return this.getBasicPlaceDetails(place);
    }
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Transform TomTom place details to our format
   */
  transformTomTomPlaceDetails(tomtomData, originalPlace) {
    // Handle both search result format and getPlaceDetails format
    const poi = tomtomData?.poi || tomtomData;
    const address = tomtomData?.address?.address || tomtomData?.address || poi?.address;
    
    // Extract POI data (could be nested or direct)
    const poiData = poi?.poi || poi;
    const poiAddress = poi?.address || address;

    return {
      // Basic info
      name: poiData?.name || originalPlace.name || address?.freeformAddress || 'Unknown Location',
      lat: originalPlace.lat || originalPlace.latitude,
      lng: originalPlace.lng || originalPlace.longitude || originalPlace.lon,

      // Address details - prioritize POI address, then reverse geocode address
      address: {
        full: poiAddress?.freeformAddress || address?.freeformAddress || originalPlace.address?.full || originalPlace.name,
        freeformAddress: poiAddress?.freeformAddress || address?.freeformAddress,
        streetName: poiAddress?.streetName || address?.streetName || '',
        streetNumber: poiAddress?.streetNumber || address?.streetNumber || '',
        municipality: poiAddress?.municipality || address?.municipality || originalPlace.address?.municipality || '',
        countrySubdivision: poiAddress?.countrySubdivision || address?.countrySubdivision || '',
        postalCode: poiAddress?.postalCode || address?.postalCode || '',
        country: poiAddress?.country || address?.country || 'Philippines'
      },

      // POI details
      category: poiData?.categorySet?.[0]?.id || poiData?.categories?.[0] || poi?.categorySet?.[0]?.id || originalPlace.category || originalPlace.type || 'Location',
      phone: poiData?.phone || poi?.phone || originalPlace.phone || null,
      website: poiData?.url || poi?.url || originalPlace.website || null,
      
      // Ratings and reviews extracted from Search API response
      rating: tomtomData?.rating || poiData?.rating || poi?.rating || originalPlace.rating || null,
      reviewCount: tomtomData?.reviewCount || poiData?.reviewCount || poi?.reviewCount || originalPlace.reviewCount || null,
      reviews: tomtomData?.reviews || null, // Reviews are typically not available in TomTom Search API
      
      // Photos from POI Photos API
      photos: tomtomData?.photos || null,

      // Additional info
      description: poiData?.description || poi?.description || originalPlace.description || null,
      openingHours: poiData?.openingHours || poi?.openingHours || originalPlace.openingHours || null,
      
      // Classification
      type: poiData?.classifications?.[0]?.code || poi?.classifications?.[0]?.code || originalPlace.type || 'general',
      
      // Data source
      provider: 'TomTom',
      confidence: poi?.score || tomtomData?.score || 0.8
    };
  }

  /**
   * Get basic place details from original place object
   */
  getBasicPlaceDetails(place) {
    return {
      name: place.name || 'Unknown Location',
      lat: place.lat || place.latitude,
      lng: place.lng || place.longitude || place.lon,
      address: {
        full: place.address?.full || place.address?.freeformAddress || place.name,
        freeformAddress: place.address?.freeformAddress || place.address?.full,
        streetName: place.address?.streetName || '',
        municipality: place.address?.municipality || '',
        country: place.address?.country || 'Philippines'
      },
      category: place.category || place.type || 'Location',
      phone: place.phone || null,
      rating: place.rating || null,
      reviewCount: place.reviewCount || null,
      description: place.description || null,
      type: place.type || 'general',
      provider: 'Fallback',
      confidence: 0.5
    };
  }

  /**
   * Search for places by name using TomTom Search API
   */
  async searchPlaceByName(name, options = {}) {
    if (!name || name.length < 2) {
      return null;
    }

    try {
      const searchResults = await tomtomService.searchPlaces(name, {
        limit: 1,
        countrySet: 'PH',
        typeahead: true,
        ...options
      });

      if (searchResults.results && searchResults.results.length > 0) {
        const result = searchResults.results[0];
        return this.transformTomTomSearchResult(result);
      }

      return null;
    } catch (error) {
      console.warn('Failed to search place by name:', error);
      return null;
    }
  }

  /**
   * Transform TomTom search result to our format
   */
  transformTomTomSearchResult(result) {
    return {
      name: result.poi?.name || result.address?.freeformAddress || 'Unknown',
      lat: result.position?.lat,
      lng: result.position?.lon,
      address: {
        full: result.address?.freeformAddress || '',
        freeformAddress: result.address?.freeformAddress,
        streetName: result.address?.streetName || '',
        municipality: result.address?.municipality || '',
        country: result.address?.country || 'Philippines'
      },
      category: result.poi?.categorySet?.[0]?.id || result.type || 'Location',
      phone: result.poi?.phone || null,
      rating: result.poi?.rating || null,
      type: result.poi?.classifications?.[0]?.code || 'general',
      provider: 'TomTom',
      confidence: result.score || 0.8
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default new PlaceDetailsService();

