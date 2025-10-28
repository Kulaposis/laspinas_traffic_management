import api from './api';

class WeatherService {
  // Weather Data
  async getCurrentWeather(params = {}) {
    try {
      const response = await api.get('/weather/current', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch current weather');
    }
  }

  async getWeatherHistory(areaName, hours = 24) {
    try {
      const params = { area_name: areaName, hours };
      const response = await api.get('/weather/history', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch weather history');
    }
  }

  async createWeatherData(weatherData) {
    try {
      const response = await api.post('/weather/data', weatherData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create weather data');
    }
  }

  // Flood Monitoring
  async getFloodMonitoring(params = {}) {
    try {
      const response = await api.get('/weather/flood', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch flood monitoring data');
    }
  }

  async getFloodAlerts() {
    try {
      const response = await api.get('/weather/flood/alerts');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch flood alerts');
    }
  }

  async createFloodMonitoring(floodData) {
    try {
      const response = await api.post('/weather/flood', floodData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create flood monitoring entry');
    }
  }

  async updateFloodMonitoring(floodId, updateData) {
    try {
      const response = await api.put(`/weather/flood/${floodId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update flood monitoring');
    }
  }

  // Weather Alerts
  async getWeatherAlerts(params = {}) {
    try {
      const response = await api.get('/weather/alerts', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch weather alerts');
    }
  }

  async getNearbyWeatherAlerts(location, radius = 10) {
    try {
      const params = {
        latitude: location.lat,
        longitude: location.lng,
        radius_km: radius
      };
      const response = await api.get('/weather/alerts/nearby', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch nearby weather alerts');
    }
  }

  async createWeatherAlert(alertData) {
    try {
      const response = await api.post('/weather/alerts', alertData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create weather alert');
    }
  }

  async updateWeatherAlert(alertId, updateData) {
    try {
      const response = await api.put(`/weather/alerts/${alertId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update weather alert');
    }
  }

  async deactivateWeatherAlert(alertId) {
    try {
      const response = await api.delete(`/weather/alerts/${alertId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to deactivate weather alert');
    }
  }

  // Real-time Weather
  async updateRealtimeWeather() {
    try {
      const response = await api.post('/weather/realtime/update');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to trigger weather update');
    }
  }

  async getRealtimeWeather(latitude, longitude, areaName = null) {
    try {
      const params = { latitude, longitude };
      if (areaName) params.area_name = areaName;
      
      const response = await api.get('/weather/realtime/current', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch real-time weather');
    }
  }

  async getRealtimeStatus() {
    try {
      const response = await api.get('/weather/realtime/status');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get realtime status');
    }
  }

  // Barangay Flood Monitoring
  async getFloodProneBarangays() {
    try {
      const response = await api.get('/weather/barangay/flood-prone');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get flood-prone barangays');
    }
  }

  async getCriticalFloodAreas() {
    try {
      const response = await api.get('/weather/barangay/critical-areas');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get critical flood areas');
    }
  }

  async getEvacuationCenters() {
    try {
      const response = await api.get('/weather/barangay/evacuation-centers');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get evacuation centers');
    }
  }

  async getBarangayInfo(barangayName) {
    try {
      const response = await api.get(`/weather/barangay/${encodeURIComponent(barangayName)}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to get barangay info');
    }
  }

  async updateBarangayFloodData() {
    try {
      const response = await api.post('/weather/barangay/update-flood-data');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update barangay flood data');
    }
  }

  // Combined Weather + Traffic Advisory
  async getWeatherTrafficAdvisory(location, radius = 5) {
    try {
      const params = {
        latitude: location.lat,
        longitude: location.lng,
        radius_km: radius
      };
      const response = await api.get('/weather/advisory', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch weather-traffic advisory');
    }
  }

  // Utility functions
  getWeatherIcon(condition) {
    const iconMap = {
      clear: '☀️',
      partly_cloudy: '⛅',
      cloudy: '☁️',
      light_rain: '🌦️',
      moderate_rain: '🌧️',
      heavy_rain: '⛈️',
      thunderstorm: '⛈️',
      fog: '🌫️'
    };
    return iconMap[condition] || '🌤️';
  }

  getFloodLevelColor(level) {
    const colorMap = {
      normal: '#22c55e', // green-500
      low: '#eab308',    // yellow-500
      moderate: '#f97316', // orange-500
      high: '#ef4444',   // red-500
      critical: '#7c3aed' // purple-600
    };
    return colorMap[level] || '#6b7280'; // gray-500
  }

  getSeverityColor(severity) {
    const colorMap = {
      advisory: '#3b82f6', // blue-500
      watch: '#eab308',    // yellow-500
      warning: '#f97316',  // orange-500
      critical: '#ef4444'  // red-500
    };
    return colorMap[severity] || '#6b7280'; // gray-500
  }
}

export default new WeatherService();
