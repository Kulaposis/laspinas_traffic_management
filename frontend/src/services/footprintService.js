import api from './api';

class FootprintService {
  constructor() {
    this.baseURL = '/footprints';
  }

  // Get all footprint monitoring areas
  async getFootprints(params = {}) {
    try {
      const response = await api.get(this.baseURL, { params });
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Get footprint heatmap data within bounds
  async getFootprintHeatmap(bounds) {
    try {
      const { lat_min, lat_max, lng_min, lng_max } = bounds;
      const response = await api.get(`${this.baseURL}/heatmap`, {
        params: { lat_min, lat_max, lng_min, lng_max }
      });
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Get footprint statistics
  async getFootprintStatistics() {
    try {
      const response = await api.get(`${this.baseURL}/statistics`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Get all monitoring areas with current data
  async getMonitoringAreas() {
    try {
      const response = await api.get(`${this.baseURL}/areas`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Get specific footprint area by ID
  async getFootprintById(areaId) {
    try {
      const response = await api.get(`${this.baseURL}/areas/${areaId}`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Create new footprint monitoring area
  async createFootprintArea(footprintData) {
    try {
      const response = await api.post(`${this.baseURL}/areas`, footprintData);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Update footprint area
  async updateFootprintArea(areaId, updateData) {
    try {
      const response = await api.put(`${this.baseURL}/areas/${areaId}`, updateData);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Delete footprint area
  async deleteFootprintArea(areaId) {
    try {
      const response = await api.delete(`${this.baseURL}/areas/${areaId}`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Initialize footprint monitoring areas
  async initializeFootprintMonitoring() {
    try {
      const response = await api.post(`${this.baseURL}/initialize`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Trigger real-time footprint update
  async updateRealtimeFootprints() {
    try {
      const response = await api.post(`${this.baseURL}/realtime/update`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Get available crowd levels
  async getCrowdLevels() {
    try {
      const response = await api.get(`${this.baseURL}/crowd-levels`);
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  // Helper methods for data processing
  formatFootprintData(footprintData) {
    return {
      ...footprintData,
      recorded_at: new Date(footprintData.recorded_at),
      created_at: new Date(footprintData.created_at),
      crowd_level_display: this.getCrowdLevelDisplay(footprintData.crowd_level),
      crowd_level_color: this.getCrowdLevelColor(footprintData.crowd_level)
    };
  }

  getCrowdLevelDisplay(level) {
    const displays = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical'
    };
    return displays[level] || level;
  }

  getCrowdLevelColor(level) {
    const colors = {
      low: '#22c55e',     // Green
      medium: '#eab308',  // Yellow
      high: '#f97316',    // Orange
      critical: '#ef4444' // Red
    };
    return colors[level] || '#6b7280';
  }

  getCrowdLevelIntensity(level) {
    const intensities = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0
    };
    return intensities[level] || 0.5;
  }

  // Calculate distance between two points (in meters)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Find nearest footprint area to a location
  findNearestArea(lat, lon, areas) {
    if (!areas || areas.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    areas.forEach(area => {
      const distance = this.calculateDistance(lat, lon, area.latitude, area.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...area, distance };
      }
    });

    return nearest;
  }

  // Check if location is within any monitoring area
  isLocationInMonitoringArea(lat, lon, areas) {
    if (!areas || areas.length === 0) return false;

    return areas.some(area => {
      const distance = this.calculateDistance(lat, lon, area.latitude, area.longitude);
      return distance <= area.radius_meters;
    });
  }

  // Process heatmap data for visualization
  processHeatmapData(heatmapData) {
    if (!heatmapData || !Array.isArray(heatmapData)) return [];

    return heatmapData.map(point => ({
      lat: point.lat,
      lng: point.lng,
      intensity: point.intensity || this.getCrowdLevelIntensity(point.crowd_level),
      radius: point.radius || 50,
      pedestrian_count: point.pedestrian_count || 0,
      crowd_level: point.crowd_level || 'low',
      area_name: point.area_name || 'Unknown Area'
    }));
  }

  // Get crowd density classification
  getCrowdDensity(pedestrianCount, areaRadius) {
    // Calculate people per square meter
    const area = Math.PI * Math.pow(areaRadius, 2);
    const density = pedestrianCount / area;

    if (density < 0.001) return 'sparse';
    if (density < 0.005) return 'light';
    if (density < 0.01) return 'moderate';
    if (density < 0.02) return 'dense';
    return 'very_dense';
  }

  // Generate demo/sample data for testing
  generateSampleFootprintData() {
    const sampleAreas = [
      {
        id: 1,
        area_name: "SM Southmall Area",
        latitude: 14.4506,
        longitude: 121.0194,
        radius_meters: 200,
        pedestrian_count: Math.floor(Math.random() * 500) + 100,
        crowd_level: "medium",
        temperature_celsius: 28.5,
        humidity_percent: 75,
        recorded_at: new Date()
      },
      {
        id: 2,
        area_name: "Las Piñas Government Center",
        latitude: 14.4634,
        longitude: 121.0186,
        radius_meters: 150,
        pedestrian_count: Math.floor(Math.random() * 200) + 50,
        crowd_level: "low",
        temperature_celsius: 29.2,
        humidity_percent: 70,
        recorded_at: new Date()
      }
    ];

    return sampleAreas.map(area => this.formatFootprintData(area));
  }
}

const footprintService = new FootprintService();
export default footprintService;
