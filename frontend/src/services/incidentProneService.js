import api from './api';

class IncidentProneService {
  // Get incident prone areas with filtering
  async getIncidentProneAreas(params = {}) {
    try {
      const response = await api.get('/incident-prone-areas/', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch incident prone areas');
    }
  }

  // Get specific incident prone area by ID
  async getIncidentProneArea(areaId) {
    try {
      const response = await api.get(`/incident-prone-areas/${areaId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch incident prone area');
    }
  }

  // Get nearby incident prone areas
  async getNearbyIncidentProneAreas(latitude, longitude, radius = 5, filters = {}) {
    try {
      const params = {
        latitude,
        longitude,
        radius_km: radius,
        ...filters
      };
      const response = await api.get('/incident-prone-areas/nearby/search', { params });
      // Backend returns {nearby_areas: [...], total: ...}, extract the array
      return response.data?.nearby_areas || response.data?.areas || response.data || [];
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch nearby incident prone areas');
    }
  }

  // Get statistics
  async getIncidentProneAreasStats() {
    try {
      const response = await api.get('/incident-prone-areas/stats/overview');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch incident prone areas statistics');
    }
  }

  // Create new incident prone area (Admin/LGU Staff only)
  async createIncidentProneArea(areaData) {
    try {
      const response = await api.post('/incident-prone-areas', areaData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create incident prone area');
    }
  }

  // Update incident prone area (Admin/LGU Staff only)
  async updateIncidentProneArea(areaId, areaData) {
    try {
      const response = await api.put(`/incident-prone-areas/${areaId}`, areaData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to update incident prone area');
    }
  }

  // Delete incident prone area (Admin only)
  async deleteIncidentProneArea(areaId) {
    try {
      const response = await api.delete(`/incident-prone-areas/${areaId}`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to delete incident prone area');
    }
  }

  // Verify incident prone area (Admin/LGU Staff only)
  async verifyIncidentProneArea(areaId) {
    try {
      const response = await api.post(`/incident-prone-areas/${areaId}/verify`);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to verify incident prone area');
    }
  }

  // Scrape incident data (Admin/LGU Staff only)
  async scrapeIncidentData(scrapingRequest = {}) {
    try {
      const response = await api.post('/incident-prone-areas/scrape', scrapingRequest);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to scrape incident data');
    }
  }

  // Utility functions
  getAreaTypeLabel(areaType) {
    const labels = {
      'accident_prone': 'Accident Prone',
      'crime_hotspot': 'Crime Hotspot',
      'flood_prone': 'Flood Prone',
      'traffic_congestion': 'Traffic Congestion',
      'road_hazard': 'Road Hazard'
    };
    return labels[areaType] || areaType;
  }

  getAreaTypeColor(areaType) {
    const colors = {
      'accident_prone': '#dc2626', // red-600
      'crime_hotspot': '#7c2d12', // amber-900
      'flood_prone': '#1d4ed8', // blue-700
      'traffic_congestion': '#ea580c', // orange-600
      'road_hazard': '#a21caf' // fuchsia-700
    };
    return colors[areaType] || '#6b7280'; // gray-500
  }

  getSeverityColor(severity) {
    const colors = {
      'low': '#16a34a', // green-600
      'medium': '#ea580c', // orange-600
      'high': '#dc2626', // red-600
      'critical': '#7c2d12' // red-900
    };
    return colors[severity] || '#6b7280'; // gray-500
  }

  getRiskScoreColor(riskScore) {
    if (riskScore >= 80) return '#7c2d12'; // red-900 - Critical
    if (riskScore >= 60) return '#dc2626'; // red-600 - High
    if (riskScore >= 40) return '#ea580c'; // orange-600 - Medium
    if (riskScore >= 20) return '#eab308'; // yellow-500 - Low
    return '#16a34a'; // green-600 - Very Low
  }

  formatRiskScore(riskScore) {
    if (riskScore >= 80) return { label: 'Critical', color: this.getRiskScoreColor(riskScore) };
    if (riskScore >= 60) return { label: 'High', color: this.getRiskScoreColor(riskScore) };
    if (riskScore >= 40) return { label: 'Medium', color: this.getRiskScoreColor(riskScore) };
    if (riskScore >= 20) return { label: 'Low', color: this.getRiskScoreColor(riskScore) };
    return { label: 'Very Low', color: this.getRiskScoreColor(riskScore) };
  }

  getAreaTypeIcon(areaType) {
    const icons = {
      'accident_prone': '🚗💥',
      'crime_hotspot': '🚨',
      'flood_prone': '🌊',
      'traffic_congestion': '🚦',
      'road_hazard': '⚠️'
    };
    return icons[areaType] || '📍';
  }

  // Filter incident prone areas by current view bounds
  filterAreasByBounds(areas, bounds) {
    if (!bounds || !areas) return areas;
    
    return areas.filter(area => 
      area.latitude >= bounds.lat_min &&
      area.latitude <= bounds.lat_max &&
      area.longitude >= bounds.lng_min &&
      area.longitude <= bounds.lng_max
    );
  }

  // Get recommendation based on area data
  getAreaRecommendation(area) {
    const recommendations = {
      'accident_prone': 'Drive carefully, reduce speed, maintain safe distance',
      'crime_hotspot': 'Stay alert, avoid walking alone at night, secure valuables',
      'flood_prone': 'Check weather conditions, avoid during heavy rain',
      'traffic_congestion': 'Consider alternative routes, allow extra travel time',
      'road_hazard': 'Exercise extreme caution, report hazards to authorities'
    };
    
    return recommendations[area.area_type] || 'Exercise general caution in this area';
  }

  // Sort areas by priority (risk score, severity, type)
  sortAreasByPriority(areas) {
    return areas.sort((a, b) => {
      // First sort by risk score (descending)
      if (a.risk_score !== b.risk_score) {
        return b.risk_score - a.risk_score;
      }
      
      // Then by severity
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aSeverity = severityOrder[a.severity_level] || 0;
      const bSeverity = severityOrder[b.severity_level] || 0;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      // Finally by area type priority
      const typeOrder = {
        'accident_prone': 5,
        'crime_hotspot': 4,
        'road_hazard': 3,
        'traffic_congestion': 2,
        'flood_prone': 1
      };
      const aType = typeOrder[a.area_type] || 0;
      const bType = typeOrder[b.area_type] || 0;
      
      return bType - aType;
    });
  }
}

export default new IncidentProneService();
