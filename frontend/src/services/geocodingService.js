/**
 * Geocoding Service
 * Handles location search, geocoding, and reverse geocoding using backend proxy
 */

import api from './api';

class GeocodingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache
    
    // Backend proxy endpoints
    this.apis = {
      nominatim: {
        name: 'OpenStreetMap Nominatim (via proxy)',
        searchUrl: '/traffic/geocoding/search',
        reverseUrl: '/traffic/geocoding/reverse',
        enabled: true
      },
      photon: {
        name: 'Photon (Komoot)',
        searchUrl: 'https://photon.komoot.io/api',
        enabled: false // Disabled since we're using backend proxy
      }
    };
    
    // Las Piñas specific locations for better search results
    this.lasPinasLocations = [
      { name: 'Las Piñas City Hall', lat: 14.4378, lng: 121.0219, type: 'government' },
      { name: 'SM Southmall', lat: 14.433348864026852, lng: 121.0105438052383, type: 'mall' },
      { name: 'Robinsons Place Las Piñas', lat: 14.4504, lng: 121.0170, type: 'mall' },
      { name: 'Las Piñas General Hospital', lat: 14.4445, lng: 121.0167, type: 'hospital' },
      { name: 'University of Perpetual Help', lat: 14.451834519987528, lng: 120.98532866926787, type: 'school' },
      { name: 'Alabang-Zapote Road', lat: 14.4504, lng: 121.0170, type: 'road' },
      { name: 'Westservice Road', lat: 14.4400, lng: 121.0200, type: 'road' },
      { name: 'C-5 Extension', lat: 14.4600, lng: 121.0150, type: 'road' },
      { name: 'CAA Road', lat: 14.4450, lng: 121.0250, type: 'road' },
      { name: 'Almanza Road', lat: 14.4350, lng: 121.0100, type: 'road' },
      { name: 'BF Almanza', lat: 14.4320, lng: 121.0080, type: 'subdivision' },
      { name: 'Talon Village', lat: 14.4520, lng: 121.0130, type: 'subdivision' },
      { name: 'Pamplona Tres', lat: 14.4470, lng: 121.0280, type: 'barangay' },
      { name: 'Pilar Village', lat: 14.4380, lng: 121.0220, type: 'subdivision' },
      { name: 'Las Piñas Sports Complex', lat: 14.4356, lng: 121.0189, type: 'sports' }
    ];
  }

  /**
   * Search for locations based on query string
   */
  async searchLocations(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search_${query.toLowerCase()}_${limit}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // First, search in local Las Piñas locations
      const localResults = this.searchLocalLocations(query, Math.min(limit, 5));
      
      // Then search using external APIs
      const externalResults = await this.searchExternalLocations(query, limit - localResults.length);
      
      // Combine and deduplicate results
      const allResults = [...localResults, ...externalResults];
      const uniqueResults = this.deduplicateResults(allResults).slice(0, limit);
      
      // Optionally resolve local results to live geocoded coordinates
      const finalResults = this.preferLiveCoordinates
        ? await this.resolveLocalResults(uniqueResults)
        : uniqueResults;
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: finalResults,
        timestamp: Date.now()
      });
      
      return finalResults;
    } catch (error) {
      console.error('Error searching locations:', error);
      // Return local results as fallback
      return this.searchLocalLocations(query, limit);
    }
  }

  /**
   * Resolve local landmark coordinates to live values via external APIs
   */
  async resolveLocalResults(results) {
    const resolved = await Promise.all(results.map(async (item) => {
      try {
        if (item?.source !== 'local' || !item?.name) return item;

        // Check cache for this landmark
        const liveKey = `live_${item.name.toLowerCase()}`;
        const cachedLive = this.cache.get(liveKey);
        if (cachedLive && Date.now() - cachedLive.timestamp < this.cacheTimeout) {
          return { ...item, ...cachedLive.data, source: cachedLive.data.source || 'nominatim_live' };
        }

        // Try external geocoding (bounded to 1 result)
        const ext = await this.searchExternalLocations(item.name, 1);
        const best = Array.isArray(ext) && ext.length > 0 ? ext[0] : null;
        if (best && typeof best.lat === 'number' && typeof best.lon === 'number') {
          const liveItem = {
            ...item,
            lat: best.lat,
            lon: best.lon,
            source: `${best.source || 'nominatim'}_live`
          };
          this.cache.set(liveKey, { data: { lat: best.lat, lon: best.lon, source: liveItem.source }, timestamp: Date.now() });
          return liveItem;
        }

        return item; // fallback to local if no external result
      } catch (_) {
        return item;
      }
    }));

    return resolved;
  }

  /**
   * Search in local Las Piñas locations
   */
  searchLocalLocations(query, limit = 5) {
    const searchTerm = query.toLowerCase();
    
    return this.lasPinasLocations
      .filter(location => 
        location.name.toLowerCase().includes(searchTerm) ||
        location.type.toLowerCase().includes(searchTerm)
      )
      .map(location => ({
        display_name: `${location.name}, Las Piñas City, Philippines`,
        name: location.name,
        lat: location.lat,
        lon: location.lng,
        type: location.type,
        importance: 0.9, // High importance for local results
        source: 'local',
        icon: this.getLocationIcon(location.type)
      }))
      .slice(0, limit);
  }

  /**
   * Search using external APIs
   */
  async searchExternalLocations(query, limit = 5) {
    const results = [];
    
    // Add Las Piñas context to improve search results
    const searchQuery = `${query}, Las Piñas City, Philippines`;
    
    try {
      // Try Nominatim first (OpenStreetMap)
      if (this.apis.nominatim.enabled) {
        const nominatimResults = await this.searchNominatim(searchQuery, limit);
        results.push(...nominatimResults);
      }
      
      // Try Photon if we need more results
      if (results.length < limit && this.apis.photon.enabled) {
        const photonResults = await this.searchPhoton(searchQuery, limit - results.length);
        results.push(...photonResults);
      }
      
    } catch (error) {
      console.error('Error with external location search:', error);
    }
    
    return results.slice(0, limit);
  }

  /**
   * Search using Nominatim (OpenStreetMap) via backend proxy
   */
  async searchNominatim(query, limit = 5) {
    try {
      const response = await api.get(this.apis.nominatim.searchUrl, {
        params: {
          q: query,
          limit: limit
        }
      });

      const data = response.data;
      
      return data.map(item => ({
        display_name: item.display_name,
        name: item.name || item.display_name.split(',')[0],
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: this.categorizeNominatimType(item),
        importance: parseFloat(item.importance) || 0.5,
        source: 'nominatim',
        icon: this.getLocationIcon(this.categorizeNominatimType(item)),
        address: item.address || {}
      }));
    } catch (error) {
      console.error('Nominatim search error:', error);
      return [];
    }
  }

  /**
   * Search using Photon API
   */
  async searchPhoton(query, limit = 5) {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        lat: '14.4378', // Las Piñas center
        lon: '121.0219',
        radius: '50000', // 50km radius
        lang: 'en'
      });

      const response = await fetch(`${this.apis.photon.searchUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Photon API error: ${response.status}`);
      }

      const data = await response.json();
      
      return data.features.map(feature => ({
        display_name: feature.properties.name + 
          (feature.properties.city ? `, ${feature.properties.city}` : '') +
          (feature.properties.country ? `, ${feature.properties.country}` : ''),
        name: feature.properties.name,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        type: this.categorizePhotonType(feature.properties),
        importance: 0.6,
        source: 'photon',
        icon: this.getLocationIcon(this.categorizePhotonType(feature.properties)),
        address: feature.properties || {}
      }));
    } catch (error) {
      console.error('Photon search error:', error);
      return [];
    }
  }

  /**
   * Reverse geocoding - get location name from coordinates via backend proxy
   */
  async reverseGeocode(lat, lng) {
    const cacheKey = `reverse_${lat}_${lng}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await api.get(this.apis.nominatim.reverseUrl, {
        params: {
          lat: lat,
          lon: lng
        }
      });

      const data = response.data;
      
      const result = {
        display_name: data.display_name,
        name: data.name || data.display_name.split(',')[0],
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        address: data.address || {},
        source: 'nominatim'
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        display_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        name: 'Unknown Location',
        lat: lat,
        lon: lng,
        source: 'coordinates'
      };
    }
  }

  /**
   * Get current location using browser geolocation
   */
  async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const location = await this.reverseGeocode(latitude, longitude);
            resolve({
              ...location,
              lat: latitude,
              lon: longitude,
              accuracy: position.coords.accuracy
            });
          } catch (error) {
            // Even if reverse geocoding fails, return coordinates
            resolve({
              display_name: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
              name: 'Current Location',
              lat: latitude,
              lon: longitude,
              accuracy: position.coords.accuracy,
              source: 'geolocation'
            });
          }
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  /**
   * Categorize Nominatim place types
   */
  categorizeNominatimType(item) {
    const type = item.type || '';
    const category = item.class || '';
    
    if (category === 'highway' || type === 'road') return 'road';
    if (category === 'amenity') {
      if (['hospital', 'clinic'].includes(type)) return 'hospital';
      if (['school', 'university', 'college'].includes(type)) return 'school';
      if (['restaurant', 'fast_food', 'cafe'].includes(type)) return 'restaurant';
      if (['fuel'].includes(type)) return 'gas_station';
      return 'amenity';
    }
    if (category === 'shop' || type === 'mall') return 'mall';
    if (category === 'place') {
      if (['city', 'town', 'village'].includes(type)) return 'city';
      if (['suburb', 'neighbourhood'].includes(type)) return 'subdivision';
      return 'place';
    }
    if (category === 'building') return 'building';
    
    return 'place';
  }

  /**
   * Categorize Photon place types
   */
  categorizePhotonType(properties) {
    const type = properties.type || '';
    const osm_key = properties.osm_key || '';
    const osm_value = properties.osm_value || '';
    
    if (osm_key === 'highway') return 'road';
    if (osm_key === 'amenity') {
      if (['hospital', 'clinic'].includes(osm_value)) return 'hospital';
      if (['school', 'university', 'college'].includes(osm_value)) return 'school';
      return 'amenity';
    }
    if (osm_key === 'shop') return 'mall';
    if (osm_key === 'place') return 'place';
    
    return 'place';
  }

  /**
   * Get appropriate icon for location type
   */
  getLocationIcon(type) {
    const icons = {
      'road': '🛣️',
      'hospital': '🏥',
      'school': '🏫',
      'mall': '🛒',
      'restaurant': '🍽️',
      'gas_station': '⛽',
      'government': '🏛️',
      'subdivision': '🏘️',
      'barangay': '📍',
      'sports': '🏟️',
      'building': '🏢',
      'city': '🏙️',
      'place': '📍',
      'amenity': '🏢'
    };
    return icons[type] || '📍';
  }

  /**
   * Remove duplicate results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.name}_${result.lat.toFixed(4)}_${result.lon.toFixed(4)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    const status = {};
    for (const [key, value] of this.cache.entries()) {
      const age = Date.now() - value.timestamp;
      status[key] = {
        age: Math.round(age / 1000) + 's',
        expired: age > this.cacheTimeout
      };
    }
    return status;
  }
}

export default new GeocodingService();
