import api from './api';

class EmergencyService {
  // Emergency Management
  async getEmergencies(params = {}) {
    try {
      const response = await api.get('/emergency/', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch emergencies');
    }
  }

  async getActiveEmergencies() {
    try {
      const response = await api.get('/emergency/active');
      return response.data;
    } catch (error) {
      // Silently handle 403 errors (unauthorized access) - citizens don't have permission
      if (error.response?.status === 403) {
        return [];
      }
      throw new Error(error.response?.data?.detail || 'Failed to fetch active emergencies');
    }
  }

  async getMyEmergencyReports() {
    try {
      const response = await api.get('/emergency/my-reports');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to fetch your emergency reports';
      const enrichedError = new Error(message);
      enrichedError.status = error.response?.status;
      throw enrichedError;
    }
  }

  async getNearbyEmergencies(location, radius = 5) {
    try {
      const params = {
        latitude: location.lat,
        longitude: location.lng,
        radius_km: radius
      };
      const response = await api.get('/emergency/nearby', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch nearby emergencies');
    }
  }

  // Emergency Button - Report Emergency
  async reportEmergency(emergencyData) {
    try {
      const response = await api.post('/emergency/report', emergencyData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to report emergency');
    }
  }

  async reportEmergencyAnonymous(emergencyData, contactInfo = {}) {
    try {
      const params = {
        reporter_name: contactInfo.name,
        reporter_phone: contactInfo.phone
      };
      const response = await api.post('/emergency/report/anonymous', emergencyData, { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to report emergency anonymously');
    }
  }

  async updateEmergency(emergencyId, updateData) {
    try {
      // Normalize status to uppercase if present (backend expects uppercase enum values)
      const normalizedData = { ...updateData };
      if (normalizedData.status) {
        normalizedData.status = normalizedData.status.toUpperCase();
      }
      
      const response = await api.put(`/emergency/${emergencyId}`, normalizedData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update emergency');
    }
  }

  // Complaints & Suggestions
  async getComplaintsSuggestions(params = {}) {
    try {
      const response = await api.get('/emergency/complaints', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch complaints and suggestions');
    }
  }

  async submitComplaint(complaintData) {
    try {
      const response = await api.post('/emergency/complaint', complaintData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to submit complaint');
    }
  }

  async submitComplaintAnonymous(complaintData, contactInfo = {}) {
    try {
      const params = {
        reporter_name: contactInfo.name,
        reporter_email: contactInfo.email,
        reporter_phone: contactInfo.phone
      };
      const response = await api.post('/emergency/complaint/anonymous', complaintData, { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to submit anonymous complaint');
    }
  }

  async updateComplaint(complaintId, updateData) {
    try {
      const response = await api.put(`/emergency/complaint/${complaintId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update complaint');
    }
  }

  // Statistics for Dashboard
  async getEmergencyStatistics(days = 30) {
    try {
      const params = { days };
      const response = await api.get('/emergency/statistics', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch emergency statistics');
    }
  }

  // Utility functions
  getEmergencyIcon(type) {
    const iconMap = {
      accident: '🚗',
      medical: '🚑',
      fire: '🔥',
      crime: '🚔',
      road_hazard: '⚠️',
      vehicle_breakdown: '🔧',
      other: '📞'
    };
    return iconMap[type] || '📞';
  }

  getEmergencyColor(severity) {
    const colorMap = {
      low: 'green',
      medium: 'yellow',
      high: 'orange',
      critical: 'red'
    };
    return colorMap[severity] || 'gray';
  }

  getStatusColor(status) {
    const colorMap = {
      reported: 'blue',
      dispatched: 'yellow',
      in_progress: 'orange',
      resolved: 'green',
      cancelled: 'gray'
    };
    return colorMap[status] || 'gray';
  }

  getPriorityColor(priority) {
    const colorMap = {
      low: 'green',
      medium: 'yellow',
      high: 'red'
    };
    return colorMap[priority] || 'gray';
  }

  // Content Moderation
  async getModerationQueue(filters = {}) {
    try {
      // Pass only supported params and omit empty strings to avoid 422
      const params = {};
      if (filters && typeof filters === 'object') {
        const { priority, verification_status, skip, limit } = filters;
        if (priority) params.priority = priority;
        if (verification_status) params.verification_status = verification_status;
        if (Number.isInteger(skip)) params.skip = skip;
        if (Number.isInteger(limit)) params.limit = limit;
      }
      const response = await api.get('/emergency/moderation/queue', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch moderation queue');
    }
  }

  async moderateEmergencyReport(emergencyId, moderationData) {
    try {
      // Primary attempt with PUT (backend supports PUT/POST/PATCH)
      const response = await api.put(
        `/emergency/moderation/${emergencyId}`,
        moderationData,
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      // Fallback: Some environments intermittently 405 on PUT; retry with POST
      if (error?.response?.status === 405) {
        try {
          const fallback = await api.post(
            `/emergency/moderation/${emergencyId}`,
            moderationData,
            { headers: { 'Content-Type': 'application/json' } }
          );
          return fallback.data;
        } catch (fallbackErr) {
          throw new Error(fallbackErr.response?.data?.detail || 'Failed to moderate emergency report');
        }
      }
      throw new Error(error.response?.data?.detail || 'Failed to moderate emergency report');
    }
  }

  // Quick Emergency Templates
  getEmergencyTemplates() {
    return [
      {
        type: 'accident',
        title: 'Vehicle Accident',
        description: 'Vehicle accident requiring immediate attention',
        severity: 'high'
      },
      {
        type: 'medical',
        title: 'Medical Emergency',
        description: 'Medical emergency requiring ambulance',
        severity: 'critical'
      },
      {
        type: 'fire',
        title: 'Fire Emergency',
        description: 'Fire emergency requiring fire department',
        severity: 'critical'
      },
      {
        type: 'crime',
        title: 'Crime in Progress',
        description: 'Crime in progress requiring police response',
        severity: 'high'
      },
      {
        type: 'road_hazard',
        title: 'Road Hazard',
        description: 'Road hazard affecting traffic safety',
        severity: 'medium'
      },
      {
        type: 'vehicle_breakdown',
        title: 'Vehicle Breakdown',
        description: 'Vehicle breakdown blocking traffic',
        severity: 'low'
      }
    ];
  }

  // Complaint Categories
  getComplaintCategories() {
    return [
      'illegal_parking',
      'reckless_driving',
      'traffic_violation',
      'road_maintenance',
      'traffic_light_issue',
      'road_signage',
      'pedestrian_safety',
      'noise_pollution',
      'public_transport',
      'infrastructure',
      'other'
    ];
  }
}

export default new EmergencyService();
