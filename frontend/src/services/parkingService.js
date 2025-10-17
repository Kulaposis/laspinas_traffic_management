import api from './api';

const parkingService = {
  // Parking Areas
  async getParkingAreas(params = {}) {
    try {
      const response = await api.get('/parking/areas', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching parking areas:', error);
      throw error;
    }
  },

  async getParkingArea(id) {
    try {
      const response = await api.get(`/parking/areas/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching parking area:', error);
      throw error;
    }
  },

  async createParkingArea(parkingData) {
    try {
      const response = await api.post('/parking/areas', parkingData);
      return response.data;
    } catch (error) {
      console.error('Error creating parking area:', error);
      throw error;
    }
  },

  async updateParkingArea(id, parkingData) {
    try {
      const response = await api.put(`/parking/areas/${id}`, parkingData);
      return response.data;
    } catch (error) {
      console.error('Error updating parking area:', error);
      throw error;
    }
  },

  async deleteParkingArea(id) {
    try {
      const response = await api.delete(`/parking/areas/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting parking area:', error);
      throw error;
    }
  },

  // No Parking Zones
  async getNoParkingZones(params = {}) {
    try {
      const response = await api.get('/parking/no-parking-zones', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching no parking zones:', error);
      throw error;
    }
  },

  async getNoParkingZone(id) {
    try {
      const response = await api.get(`/parking/no-parking-zones/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching no parking zone:', error);
      throw error;
    }
  },

  async createNoParkingZone(zoneData) {
    try {
      const response = await api.post('/parking/no-parking-zones', zoneData);
      return response.data;
    } catch (error) {
      console.error('Error creating no parking zone:', error);
      throw error;
    }
  },

  async updateNoParkingZone(id, zoneData) {
    try {
      const response = await api.put(`/parking/no-parking-zones/${id}`, zoneData);
      return response.data;
    } catch (error) {
      console.error('Error updating no parking zone:', error);
      throw error;
    }
  },

  async deleteNoParkingZone(id) {
    try {
      const response = await api.delete(`/parking/no-parking-zones/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting no parking zone:', error);
      throw error;
    }
  },

  // Statistics
  async getParkingStatistics() {
    try {
      const response = await api.get('/parking/statistics');
      return response.data;
    } catch (error) {
      console.error('Error fetching parking statistics:', error);
      throw error;
    }
  },

  async getNoParkingStatistics() {
    try {
      const response = await api.get('/parking/no-parking-zones/statistics');
      return response.data;
    } catch (error) {
      console.error('Error fetching no parking statistics:', error);
      throw error;
    }
  },

  // Map Data
  async getMapData(params = {}) {
    try {
      const response = await api.get('/parking/map-data', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching parking map data:', error);
      throw error;
    }
  },

  // Import Data
  async importNoParkingZones() {
    try {
      const response = await api.post('/parking/no-parking-zones/import');
      return response.data;
    } catch (error) {
      console.error('Error importing no parking zones:', error);
      throw error;
    }
  },

  // Utility functions
  getZoneTypeColor(zoneType) {
    const colors = {
      'restricted': '#dc2626', // red-600
      'road_restriction': '#ea580c', // orange-600
      'bus_stop': '#7c2d12', // amber-800
      'default': '#6b7280' // gray-500
    };
    return colors[zoneType] || colors.default;
  },

  getRestrictionReasonColor(reason) {
    const colors = {
      'fire_station': '#dc2626', // red-600 - highest priority
      'hospital': '#7c2d12', // red-800
      'government': '#1d4ed8', // blue-700
      'school': '#059669', // emerald-600
      'church': '#7c3aed', // violet-600
      'market': '#ea580c', // orange-600
      'bridge': '#b45309', // amber-700
      'intersection': '#374151', // gray-700
      'major_road': '#111827', // gray-900
      'public_transport': '#0369a1', // sky-700
      'default': '#6b7280' // gray-500
    };
    
    // Handle extended zones
    if (reason?.includes('_extended')) {
      const baseReason = reason.replace('_extended', '');
      const baseColor = colors[baseReason] || colors.default;
      // Make extended zones slightly lighter
      return this.lightenColor(baseColor, 0.3);
    }
    
    return colors[reason] || colors.default;
  },

  lightenColor(hex, percent) {
    // Convert hex to RGB
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  },

  getParkingStatusColor(status) {
    const colors = {
      'available': '#059669', // emerald-600
      'occupied': '#dc2626', // red-600
      'reserved': '#d97706', // amber-600
      'out_of_order': '#6b7280', // gray-500
      'default': '#6b7280'
    };
    return colors[status] || colors.default;
  },

  formatEnforcementHours(hours) {
    if (hours === '24/7') {
      return '24/7';
    }
    return hours;
  },

  formatFineAmount(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  }
};

export default parkingService;
