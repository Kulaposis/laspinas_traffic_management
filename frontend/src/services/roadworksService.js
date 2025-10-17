import api from './api';

class RoadworksService {
  // Scrape roadworks from external sources
  async scrapeRoadworks(facebookPages = null) {
    try {
      const requestData = facebookPages ? { facebook_pages: facebookPages } : {};
      const response = await api.post('/traffic/roadworks/scrape', requestData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to scrape roadworks data');
    }
  }

  // Get active roadworks
  async getActiveRoadworks(params = {}) {
    try {
      const response = await api.get('/traffic/roadworks/active', { params });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch active roadworks');
    }
  }

  // Create manual roadwork
  async createManualRoadwork(roadworkData) {
    try {
      const response = await api.post('/traffic/roadworks/manual', roadworkData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to create roadwork');
    }
  }

  // Get roadwork severity color
  getRoadworkSeverityColor(severity) {
    const colors = {
      'low': '#22c55e',      // green-500
      'medium': '#f59e0b',   // amber-500
      'high': '#ef4444',     // red-500
      'critical': '#dc2626'  // red-600
    };
    return colors[severity] || '#6b7280'; // gray-500
  }

  // Get color based on roadwork lifecycle status
  getStatusColor(status) {
    const normalized = (status || '').toString().toLowerCase();
    const colors = {
      'planned': '#3b82f6',   // blue-500
      'active': '#22c55e',    // green-500
      'ongoing': '#22c55e',   // alias for active
      'paused': '#f59e0b',    // amber-500
      'on_hold': '#f59e0b',   // alias for paused
      'completed': '#6b7280', // gray-500
      'cancelled': '#ef4444'  // red-500
    };
    return colors[normalized] || '#6b7280';
  }

  // Get color for traffic impact level label
  getImpactColor(impact) {
    const normalized = (impact || '').toString().toLowerCase();
    const colors = {
      'low': '#22c55e',
      'medium': '#f59e0b',
      'high': '#ef4444',
      'severe': '#dc2626'
    };
    return colors[normalized] || '#6b7280';
  }

  // Get roadwork type icon
  getRoadworkTypeIcon(type) {
    const icons = {
      'road_work': '🚧',
      'construction': '🏗️',
      'maintenance': '🔧',
      'repair': '⚒️',
      'improvement': '📈'
    };
    return icons[type] || '🚧';
  }

  // Format roadwork duration
  formatRoadworkDuration(startDate, endDate) {
    if (!startDate) return 'Ongoing';
    
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    const now = new Date();

    if (end && now > end) {
      return 'Completed';
    }

    if (!end) {
      const daysSinceStart = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      return `${daysSinceStart} days ongoing`;
    }

    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 0) {
      return 'Completed';
    }

    return `${remainingDays} days remaining (${totalDays} total)`;
  }

  // Get impact level based on severity and location
  getImpactLevel(roadwork) {
    const { severity, impact_radius_meters, affected_roads } = roadwork;
    
    let impactScore = 0;

    // Severity contribution
    const severityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    impactScore += severityScores[severity] || 1;

    // Radius contribution
    if (impact_radius_meters > 1000) impactScore += 2;
    else if (impact_radius_meters > 500) impactScore += 1;

    // Roads affected contribution
    if (affected_roads && affected_roads.length > 2) impactScore += 1;

    // Convert to level
    if (impactScore >= 6) return { level: 'Very High', color: '#dc2626' };
    if (impactScore >= 4) return { level: 'High', color: '#ef4444' };
    if (impactScore >= 2) return { level: 'Medium', color: '#f59e0b' };
    return { level: 'Low', color: '#22c55e' };
  }

  // Filter roadworks by area
  filterRoadworksByArea(roadworks, bounds) {
    if (!bounds || !roadworks) return roadworks;
    
    return roadworks.filter(roadwork => 
      roadwork.latitude >= bounds.lat_min &&
      roadwork.latitude <= bounds.lat_max &&
      roadwork.longitude >= bounds.lng_min &&
      roadwork.longitude <= bounds.lng_max
    );
  }

  // Sort roadworks by priority
  sortRoadworksByPriority(roadworks) {
    return roadworks.sort((a, b) => {
      // First by severity
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity] || 1;
      const bSeverity = severityOrder[b.severity] || 1;
      
      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity;
      }
      
      // Then by creation date (newest first)
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  // Get roadwork recommendation
  getRoadworkRecommendation(roadwork) {
    const recommendations = {
      'road_work': 'Plan alternative routes and allow extra travel time',
      'construction': 'Expect significant delays, consider alternate routes',
      'maintenance': 'Minor delays expected, proceed with caution',
      'repair': 'Road surface may be uneven, drive carefully',
      'improvement': 'Long-term project, seek permanent alternative routes'
    };
    
    return recommendations[roadwork.incident_type] || 'Exercise caution in this area';
  }

  // Format roadwork for display
  formatRoadworkForDisplay(roadwork) {
    const impact = this.getImpactLevel(roadwork);
    const duration = this.formatRoadworkDuration(roadwork.created_at, roadwork.estimated_clearance_time);
    const recommendation = this.getRoadworkRecommendation(roadwork);

    return {
      ...roadwork,
      displayTitle: roadwork.title,
      displayDescription: roadwork.description,
      severityColor: this.getRoadworkSeverityColor(roadwork.severity),
      typeIcon: this.getRoadworkTypeIcon(roadwork.incident_type),
      impactLevel: impact.level,
      impactColor: impact.color,
      duration,
      recommendation,
      isOngoing: !roadwork.estimated_clearance_time || new Date(roadwork.estimated_clearance_time) > new Date(),
      isRecent: new Date() - new Date(roadwork.created_at) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
    };
  }
}

export default new RoadworksService();
