import api from './api';

class ViolationService {
  async createViolation(violationData) {
    try {
      const response = await api.post('/violations/', violationData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create violation');
    }
  }

  async getViolations(params = {}) {
    try {
      const { skip = 0, limit = 100, status } = params;
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      
      if (status) {
        queryParams.append('status', status);
      }

      const response = await api.get(`/violations/?${queryParams}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violations');
    }
  }

  async getViolation(violationId) {
    try {
      const response = await api.get(`/violations/${violationId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violation');
    }
  }

  async getViolationByNumber(violationNumber) {
    try {
      const response = await api.get(`/violations/number/${violationNumber}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violation');
    }
  }

  async getViolationsByLicense(driverLicense) {
    try {
      const response = await api.get(`/violations/license/${driverLicense}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violations');
    }
  }

  async getViolationsByPlate(vehiclePlate) {
    try {
      const response = await api.get(`/violations/plate/${vehiclePlate}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch violations');
    }
  }

  async updateViolation(violationId, updateData) {
    try {
      const response = await api.put(`/violations/${violationId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update violation');
    }
  }

  getViolationTypeColor(type) {
    const colors = {
      speeding: '#ef4444',              // red
      illegal_parking: '#f59e0b',       // amber
      running_red_light: '#dc2626',     // red-600
      no_seatbelt: '#fb923c',           // orange
      drunk_driving: '#7c2d12',         // red-900
      reckless_driving: '#991b1b',      // red-800
      expired_license: '#8b5cf6',       // violet
      no_helmet: '#f97316',             // orange
      other: '#6b7280',                 // gray
    };
    return colors[type] || colors.other;
  }

  getViolationStatusColor(status) {
    const colors = {
      issued: '#f59e0b',        // amber
      paid: '#10b981',          // emerald
      contested: '#3b82f6',     // blue
      dismissed: '#6b7280',     // gray
    };
    return colors[status] || colors.issued;
  }

  formatFineAmount(amount) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  }

  getViolationTypeLabel(type) {
    const labels = {
      speeding: 'Speeding',
      illegal_parking: 'Illegal Parking',
      running_red_light: 'Running Red Light',
      no_seatbelt: 'No Seatbelt',
      drunk_driving: 'Drunk Driving',
      reckless_driving: 'Reckless Driving',
      expired_license: 'Expired License',
      no_helmet: 'No Helmet',
      other: 'Other',
    };
    return labels[type] || type;
  }
}

export default new ViolationService();
