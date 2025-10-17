import api from './api';

class ReportService {
  async createReport(reportData) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.post('/reports/', reportData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create report');
    }
  }

  async getReports(params = {}) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        // In Google-only sessions, backend data is unavailable
        return [];
      }
      const { skip = 0, limit = 100, status } = params;
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      
      if (status) {
        queryParams.append('status', status);
      }

      const response = await api.get(`/reports/?${queryParams}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch reports');
    }
  }

  async getReport(reportId) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.get(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch report');
    }
  }

  async updateReport(reportId, updateData) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.put(`/reports/${reportId}`, updateData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update report');
    }
  }

  async deleteReport(reportId) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await api.delete(`/reports/${reportId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to delete report');
    }
  }

  async getNearbyReports(latitude, longitude, radiusKm = 5) {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return [];
      }
      const queryParams = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius_km: radiusKm.toString(),
      });

      const response = await api.get(`/reports/nearby?${queryParams}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch nearby reports');
    }
  }

  getReportTypeColor(type) {
    const colors = {
      accident: '#ef4444',      // red
      traffic_jam: '#f59e0b',   // amber
      road_closure: '#8b5cf6',  // violet
      flooding: '#3b82f6',      // blue
      broken_traffic_light: '#f97316', // orange
      illegal_parking: '#10b981', // emerald
      other: '#6b7280',         // gray
    };
    return colors[type] || colors.other;
  }

  getReportStatusColor(status) {
    const colors = {
      pending: '#f59e0b',       // amber
      in_progress: '#3b82f6',   // blue
      resolved: '#10b981',      // emerald
      closed: '#6b7280',        // gray
    };
    return colors[status] || colors.pending;
  }
}

export default new ReportService();
