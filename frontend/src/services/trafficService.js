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
}

export default new TrafficService();
