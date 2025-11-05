import api from './api';

class TrafficService {
  // Traffic Monitoring
  async getTrafficMonitoring(params = {}) {
    try {
      const response = await api.get('/traffic/monitoring', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch traffic monitoring data');
    }
  }

  async getTrafficHeatmap(bounds) {
    try {
      const response = await api.get('/traffic/monitoring/heatmap', { params: bounds });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch traffic heatmap data');
    }
  }

  async createTrafficMonitoring(trafficData) {
    try {
      const response = await api.post('/traffic/monitoring', trafficData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create traffic monitoring entry');
    }
  }

  async updateTrafficMonitoring(trafficId, updateData) {
    try {
      const response = await api.put(`/traffic/monitoring/${trafficId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update traffic monitoring');
    }
  }

  // Route Alternatives
  async getRouteAlternatives(origin, destination) {
    try {
      const params = {
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_lat: destination.lat,
        destination_lng: destination.lng
      };
      const response = await api.get('/traffic/routes', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch route alternatives');
    }
  }

  async createRouteAlternative(routeData) {
    try {
      const response = await api.post('/traffic/routes', routeData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create route alternative');
    }
  }

  // Road Incidents
  async getRoadIncidents(params = {}) {
    try {
      const response = await api.get('/traffic/incidents', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch road incidents');
    }
  }

  async getNearbyIncidents(location, radius = 5) {
    try {
      const params = {
        latitude: location.lat,
        longitude: location.lng,
        radius_km: radius
      };
      const response = await api.get('/traffic/incidents/nearby', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch nearby incidents');
    }
  }

  async reportRoadIncident(incidentData) {
    try {
      const response = await api.post('/traffic/incidents', incidentData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to report road incident');
    }
  }

  async updateRoadIncident(incidentId, updateData) {
    try {
      const response = await api.put(`/traffic/incidents/${incidentId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update road incident');
    }
  }

  async resolveRoadIncident(incidentId) {
    try {
      const response = await api.delete(`/traffic/incidents/${incidentId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to resolve road incident');
    }
  }

  // Traffic Simulation Control (for development/demo)
  async startSimulation(updateInterval = 15) {
    try {
      const response = await api.post('/traffic/simulation/start', null, {
        params: { update_interval: updateInterval }
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to start traffic simulation');
    }
  }

  async stopSimulation() {
    try {
      const response = await api.post('/traffic/simulation/stop');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to stop traffic simulation');
    }
  }

  async getSimulationStatus() {
    try {
      const response = await api.get('/traffic/simulation/status');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get simulation status');
    }
  }

  // Traffic Patterns and Predictions
  async getTrafficPatterns() {
    try {
      const response = await api.get('/traffic/monitoring/patterns');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch traffic patterns');
    }
  }

  async getTrafficTrends() {
    try {
      const response = await api.get('/traffic/insights/trends');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch traffic trends');
    }
  }

  // Calculate best time to leave based on route and traffic patterns
  calculateBestTimeToLeave(patterns, route, targetArrivalTime) {
    if (!patterns || !patterns.data || !route) return null;

    // Extract road segments from route
    const routeRoads = this.extractRoadsFromRoute(route);
    
    // Group patterns by time of day
    const timeGroups = {
      morning: { start: 6, end: 9, label: 'Morning Rush (6-9 AM)' },
      lunch: { start: 11, end: 14, label: 'Lunch (11 AM-2 PM)' },
      evening: { start: 16, end: 19, label: 'Evening Rush (4-7 PM)' }
    };

    const recommendations = [];
    
    Object.entries(timeGroups).forEach(([key, group]) => {
      const relevantPatterns = patterns.data.filter(point => {
        const hour = new Date(point.timestamp).getHours();
        return hour >= group.start && hour < group.end && 
               routeRoads.some(road => point.road_name.includes(road));
      });

      if (relevantPatterns.length > 0) {
        const avgSpeed = relevantPatterns.reduce((sum, p) => sum + p.average_speed_kph, 0) / relevantPatterns.length;
        const avgCongestion = relevantPatterns.filter(p => p.congestion_level === 'heavy' || p.congestion_level === 'moderate').length / relevantPatterns.length;
        
        recommendations.push({
          period: key,
          label: group.label,
          avgSpeed,
          congestionLevel: avgCongestion > 0.5 ? 'heavy' : avgCongestion > 0.3 ? 'moderate' : 'low',
          congestionPercentage: Math.round(avgCongestion * 100)
        });
      }
    });

    // Find best time (lowest congestion)
    const bestTime = recommendations.reduce((best, current) => {
      if (!best || current.congestionPercentage < best.congestionPercentage) {
        return current;
      }
      return best;
    }, null);

    return {
      recommendations,
      bestTime,
      timeGroups
    };
  }

  // Helper to extract road names from route
  extractRoadsFromRoute(route) {
    if (!route) {
      return [];
    }

    // Try to extract from route steps if available
    if (route.steps && Array.isArray(route.steps)) {
      const roadNames = route.steps
        .map(step => step.street_name)
        .filter(name => name && name.trim() !== '')
        .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
      
      if (roadNames.length > 0) {
        return roadNames;
      }
    }

    // Try to extract from road_segments if available
    if (route.road_segments && Array.isArray(route.road_segments)) {
      return route.road_segments;
    }

    // Fallback to major roads in Las Piñas
    const majorRoads = [
      'Alabang-Zapote Road',
      'CAA Road',
      'C-5 Extension',
      'Almanza Road',
      'West Service Road'
    ];
    return majorRoads;
  }
}

export default new TrafficService();
