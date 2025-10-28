/**
 * Travel History Service
 * Handles personalized travel data for users
 */

import api from './api';

class TravelHistoryService {
  constructor() {
    this.baseEndpoint = '/traffic';
  }

  /**
   * Save a travel session to user's history
   */
  async saveTravelSession(sessionData) {
    try {
      const origin = sessionData.origin || {};
      const destination = sessionData.destination || {};

      const payload = {
        // Flattened fields expected by backend (TravelSessionCreate)
        origin_name: origin.name || '',
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_name: destination.name || '',
        destination_lat: destination.lat,
        destination_lng: destination.lng,

        route_data: sessionData.routeData,
        duration_minutes: sessionData.durationMinutes,
        distance_km: sessionData.distanceKm,
        start_time: sessionData.startTime,
        end_time: sessionData.endTime,
        travel_mode: sessionData.travelMode || 'car',
        traffic_conditions: sessionData.trafficConditions,
        notes: sessionData.notes
      };

      const response = await api.post(`${this.baseEndpoint}/sessions`, payload);
      
      return response.data;
    } catch (error) {
      console.error('Error saving travel session:', error);
      throw error;
    }
  }

  /**
   * Get user's travel history
   */
  async getTravelHistory(params = {}) {
    try {
      const response = await api.get(`${this.baseEndpoint}/sessions`, {
        params: {
          limit: params.limit || 50,
          offset: params.offset || 0,
          start_date: params.startDate,
          end_date: params.endDate,
          ...params
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching travel history:', error);
      // Return cached data or empty array if API fails
      // If it's an auth error, don't try to cache since user isn't authenticated
      if (error.response?.status === 401) {
        return [];
      }
      return this.getCachedTravelHistory() || [];
    }
  }

  /**
   * Get frequently visited locations
   */
  async getFrequentLocations(params = {}) {
    try {
      const response = await api.get(`${this.baseEndpoint}/frequent-locations`, {
        params: {
          limit: params.limit || 10,
          ...params
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching frequent locations:', error);
      if (error.response?.status === 401) {
        return [];
      }
      return this.getCachedFrequentLocations() || [];
    }
  }

  /**
   * Get travel statistics for the user
   */
  async getTravelStats(timeframe = 'month') {
    try {
      const response = await api.get(`${this.baseEndpoint}/stats`, {
        params: { timeframe }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching travel stats:', error);
      if (error.response?.status === 401) {
        return this.getDefaultStats();
      }
      return this.getDefaultStats();
    }
  }

  /**
   * Save favorite route
   */
  async saveFavoriteRoute(routeData) {
    try {
      const origin = routeData.origin || {};
      const destination = routeData.destination || {};

      const payload = {
        name: routeData.name,
        // Flattened fields expected by backend (FavoriteRouteCreate)
        origin_name: origin.name || '',
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_name: destination.name || '',
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        route_summary: routeData.routeSummary,
        is_default: routeData.isDefault || false
      };

      const response = await api.post(`${this.baseEndpoint}/favorites`, payload);
      
      return response.data;
    } catch (error) {
      console.error('Error saving favorite route:', error);
      throw error;
    }
  }

  /**
   * Get favorite routes
   */
  async getFavoriteRoutes() {
    try {
      const response = await api.get(`${this.baseEndpoint}/favorites`);
      return response.data;
    } catch (error) {
      console.error('Error fetching favorite routes:', error);
      if (error.response?.status === 401) {
        return [];
      }
      return this.getCachedFavorites() || [];
    }
  }

  /**
   * Delete travel session
   */
  async deleteTravelSession(sessionId) {
    try {
      const response = await api.delete(`${this.baseEndpoint}/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting travel session:', error);
      throw error;
    }
  }

  /**
   * Get cached travel history from localStorage
   */
  getCachedTravelHistory() {
    try {
      const cached = localStorage.getItem('travel_history');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error reading cached travel history:', error);
      return [];
    }
  }

  /**
   * Cache travel history to localStorage
   */
  cacheTravelHistory(history) {
    try {
      localStorage.setItem('travel_history', JSON.stringify(history));
    } catch (error) {
      console.error('Error caching travel history:', error);
    }
  }

  /**
   * Get cached frequent locations
   */
  getCachedFrequentLocations() {
    try {
      const cached = localStorage.getItem('frequent_locations');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error reading cached frequent locations:', error);
      return [];
    }
  }

  /**
   * Get cached favorites
   */
  getCachedFavorites() {
    try {
      const cached = localStorage.getItem('favorite_routes');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error reading cached favorites:', error);
      return [];
    }
  }

  /**
   * Get default stats when API fails
   */
  getDefaultStats() {
    return {
      total_trips: 0,
      total_distance_km: 0,
      total_time_minutes: 0,
      average_speed_kmh: 0,
      most_frequent_destination: null,
      travel_patterns: []
    };
  }

  /**
   * Analyze travel patterns from history
   */
  analyzeTravelPatterns(history) {
    if (!history || history.length === 0) {
      return {
        peakHours: [],
        preferredRoutes: [],
        averageDuration: 0,
        distanceStats: { min: 0, max: 0, avg: 0 }
      };
    }

    // Analyze peak travel hours
    const hourCounts = {};
    history.forEach(session => {
      const hour = new Date(session.start_time).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([hour]) => parseInt(hour));

    // Analyze preferred routes
    const routeCounts = {};
    history.forEach(session => {
      const routeKey = `${session.origin?.lat},${session.origin?.lng}-${session.destination?.lat},${session.destination?.lng}`;
      routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
    });

    const preferredRoutes = Object.entries(routeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    // Calculate averages
    const durations = history.map(s => s.duration_minutes || 0);
    const distances = history.map(s => s.distance_km || 0);

    return {
      peakHours,
      preferredRoutes,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      distanceStats: {
        min: Math.min(...distances),
        max: Math.max(...distances),
        avg: distances.reduce((a, b) => a + b, 0) / distances.length
      }
    };
  }

  /**
   * Format travel time for display
   */
  formatTravelTime(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  /**
   * Format distance for display
   */
  formatDistance(km) {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }
}

export default new TravelHistoryService();

