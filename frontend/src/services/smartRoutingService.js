/**
 * Smart Routing Service
 * Handles intelligent route suggestions based on real-time traffic
 */

import api from './api';

class SmartRoutingService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 3 * 60 * 1000; // 3 minutes for routes
  }

  /**
   * Get smart route suggestions between two points
   */
  async getSmartRoutes(originLat, originLng, destinationLat, destinationLng, avoidTraffic = true) {
    const cacheKey = `routes_${originLat}_${originLng}_${destinationLat}_${destinationLng}_${avoidTraffic}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await api.get('/traffic/routing/smart', {
        params: {
          origin_lat: originLat,
          origin_lng: originLng,
          destination_lat: destinationLat,
          destination_lng: destinationLng,
          avoid_traffic: avoidTraffic
        }
      });
      
      const data = response.data;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Save a preferred route
   */
  async saveRoute(routeData) {
    try {
      const response = await api.post('/traffic/routing/save-route', routeData);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get recommended routes
   */
  async getRecommendedRoutes(originLat = null, originLng = null, limit = 10) {
    try {
      const params = { limit };
      if (originLat !== null && originLng !== null) {
        params.origin_lat = originLat;
        params.origin_lng = originLng;
      }
      
      const response = await api.get('/traffic/routing/recommended', { params });
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get route type icon
   */
  getRouteTypeIcon(routeType) {
    const iconMap = {
      'direct': '🎯',
      'alternative': '🔄',
      'scenic': '🌳',
      'fastest': '⚡',
      'shortest': '📏',
      'eco': '🌱'
    };
    return iconMap[routeType] || '🛣️';
  }

  /**
   * Get route type color
   */
  getRouteTypeColor(routeType) {
    const colorMap = {
      'direct': '#3b82f6',
      'alternative': '#f59e0b',
      'scenic': '#10b981',
      'fastest': '#ef4444',
      'shortest': '#8b5cf6',
      'eco': '#22c55e'
    };
    return colorMap[routeType] || '#6b7280';
  }

  /**
   * Get traffic condition color
   */
  getTrafficConditionColor(condition) {
    const colorMap = {
      'light': '#22c55e',
      'moderate': '#eab308',
      'heavy': '#f97316',
      'standstill': '#ef4444',
      'unknown': '#6b7280'
    };
    return colorMap[condition] || '#6b7280';
  }

  /**
   * Get route quality badge color
   */
  getRouteQualityColor(quality) {
    const colorMap = {
      'primary': '#3b82f6',
      'alternative': '#f59e0b',
      'scenic': '#10b981',
      'backup': '#6b7280'
    };
    return colorMap[quality] || '#6b7280';
  }

  /**
   * Get confidence level color
   */
  getConfidenceLevelColor(confidence) {
    const colorMap = {
      'high': '#22c55e',
      'medium': '#eab308',
      'low': '#f97316'
    };
    return colorMap[confidence] || '#6b7280';
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${remainingMinutes}m`;
      }
    }
  }

  /**
   * Format distance for display
   */
  formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    } else {
      return `${km.toFixed(1)}km`;
    }
  }

  /**
   * Format time savings
   */
  formatTimeSavings(minutes) {
    if (minutes === 0) {
      return 'No savings';
    } else if (minutes < 60) {
      return `Saves ${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `Saves ${hours}h`;
      } else {
        return `Saves ${hours}h ${remainingMinutes}m`;
      }
    }
  }

  /**
   * Get advantage icon based on advantage text
   */
  getAdvantageIcon(advantage) {
    const text = advantage.toLowerCase();
    
    if (text.includes('direct') || text.includes('familiar')) return '🎯';
    if (text.includes('avoid') || text.includes('bypass')) return '🚫';
    if (text.includes('clear') || text.includes('less congested')) return '✅';
    if (text.includes('peaceful') || text.includes('scenic')) return '🌳';
    if (text.includes('stress') || text.includes('relaxing')) return '😌';
    if (text.includes('highway') || text.includes('major')) return '🛣️';
    if (text.includes('residential')) return '🏘️';
    if (text.includes('incident')) return '⚠️';
    
    return '👍'; // Default advantage icon
  }

  /**
   * Get disadvantage icon based on disadvantage text
   */
  getDisadvantageIcon(disadvantage) {
    const text = disadvantage.toLowerCase();
    
    if (text.includes('longer') || text.includes('distance')) return '📏';
    if (text.includes('turn') || text.includes('complex')) return '🔄';
    if (text.includes('slow') || text.includes('slower')) return '🐌';
    if (text.includes('unfamiliar')) return '❓';
    if (text.includes('construction')) return '🚧';
    
    return '⚠️'; // Default disadvantage icon
  }

  /**
   * Calculate estimated arrival time
   */
  calculateArrivalTime(durationMinutes) {
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + (durationMinutes * 60 * 1000));
    
    return arrivalTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Get route comparison data for visualization
   */
  getRouteComparison(routes) {
    if (!routes || routes.length === 0) return null;
    
    const fastestRoute = routes.reduce((fastest, route) => 
      route.estimated_duration_minutes < fastest.estimated_duration_minutes ? route : fastest
    );
    
    const shortestRoute = routes.reduce((shortest, route) => 
      route.distance_km < shortest.distance_km ? route : shortest
    );
    
    return {
      fastest: fastestRoute,
      shortest: shortestRoute,
      comparison: routes.map(route => ({
        ...route,
        timeDifference: route.estimated_duration_minutes - fastestRoute.estimated_duration_minutes,
        distanceDifference: route.distance_km - shortestRoute.distance_km,
        arrivalTime: this.calculateArrivalTime(route.estimated_duration_minutes)
      }))
    };
  }

  /**
   * Get traffic summary color
   */
  getTrafficSummaryColor(condition) {
    const colorMap = {
      'good': '#22c55e',
      'moderate': '#eab308',
      'heavy': '#f97316',
      'unknown': '#6b7280'
    };
    return colorMap[condition] || '#6b7280';
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(lat, lng) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  /**
   * Get route polyline color based on traffic conditions
   */
  getRoutePolylineColor(route) {
    if (route.route_type === 'direct') return '#3b82f6';
    if (route.route_type === 'alternative') return '#f59e0b';
    if (route.route_type === 'scenic') return '#10b981';
    
    // Color based on traffic conditions
    return this.getTrafficConditionColor(route.traffic_conditions);
  }

  /**
   * Get route polyline weight based on recommendation
   */
  getRoutePolylineWeight(route, isRecommended = false) {
    if (isRecommended) return 6;
    if (route.route_quality === 'primary') return 5;
    return 4;
  }

  /**
   * Clear route cache
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

  /**
   * Validate coordinates
   */
  validateCoordinates(lat, lng) {
    return (
      typeof lat === 'number' && 
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180
    );
  }

  /**
   * Calculate route bounds for map display
   */
  calculateRouteBounds(routes) {
    if (!routes || routes.length === 0) return null;
    
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    
    routes.forEach(route => {
      if (route.route_coordinates) {
        route.route_coordinates.forEach(([lat, lng]) => {
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
        });
      }
    });
    
    if (minLat === Infinity) return null;
    
    return {
      southwest: [minLat, minLng],
      northeast: [maxLat, maxLng]
    };
  }
}

export default new SmartRoutingService();
