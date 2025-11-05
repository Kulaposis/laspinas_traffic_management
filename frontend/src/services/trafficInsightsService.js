/**
 * Traffic Insights Service
 * Handles real-time traffic insights and daily traffic analysis
 */

import api from './api';

class TrafficInsightsService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get daily traffic insights with personalized messages
   */
  async getDailyInsights() {
    const cacheKey = 'daily-insights';
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await api.get('/traffic/insights/daily');
      const data = response.data;
      
      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get hourly traffic trends for the current day
   */
  async getTrafficTrends() {
    try {
      const response = await api.get('/traffic/insights/trends');
      return response.data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get traffic condition emoji based on condition string
   */
  getConditionEmoji(condition) {
    const emojiMap = {
      'excellent': '🟢',
      'good': '🟡', 
      'moderate': '🟠',
      'heavy': '🔴',
      'severe': '🚨',
      'unknown': '❓'
    };
    return emojiMap[condition] || '❓';
  }

  /**
   * Get condition color based on condition string
   */
  getConditionColor(condition) {
    const colorMap = {
      'excellent': '#22c55e',
      'good': '#eab308',
      'moderate': '#f97316', 
      'heavy': '#ef4444',
      'severe': '#dc2626',
      'unknown': '#6b7280'
    };
    return colorMap[condition] || '#6b7280';
  }

  /**
   * Get advisory level color
   */
  getAdvisoryLevelColor(level) {
    const colorMap = {
      'normal': '#22c55e',
      'medium': '#eab308',
      'high': '#f97316',
      'critical': '#ef4444'
    };
    return colorMap[level] || '#6b7280';
  }

  /**
   * Format time for display
   */
  formatTime(isoString) {
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  }

  /**
   * Format next update time
   */
  formatNextUpdate(isoString) {
    try {
      const nextUpdate = new Date(isoString);
      const now = new Date();
      const diffMinutes = Math.ceil((nextUpdate - now) / (1000 * 60));
      
      if (diffMinutes <= 0) {
        return 'Updating now...';
      } else if (diffMinutes === 1) {
        return 'Updates in 1 minute';
      } else {
        return `Updates in ${diffMinutes} minutes`;
      }
    } catch (error) {
      return 'Next update pending';
    }
  }

  /**
   * Get traffic score description
   */
  getTrafficScoreDescription(score) {
    if (score >= 85) {
      return 'Excellent traffic conditions';
    } else if (score >= 70) {
      return 'Good traffic flow';
    } else if (score >= 50) {
      return 'Moderate traffic conditions';
    } else if (score >= 30) {
      return 'Heavy traffic detected';
    } else {
      return 'Severe traffic congestion';
    }
  }

  /**
   * Get recommendation icon based on recommendation text
   */
  getRecommendationIcon(recommendation) {
    const text = recommendation.toLowerCase();
    
    if (text.includes('morning') || text.includes('🌅')) return '🌅';
    if (text.includes('evening') || text.includes('🌆')) return '🌆';
    if (text.includes('lunch') || text.includes('🍽️')) return '🍽️';
    if (text.includes('night') || text.includes('🌙')) return '🌙';
    if (text.includes('coffee') || text.includes('☕')) return '☕';
    if (text.includes('public') || text.includes('🚌')) return '🚌';
    if (text.includes('podcast') || text.includes('🎧')) return '🎧';
    if (text.includes('phone') || text.includes('📱')) return '📱';
    if (text.includes('fuel') || text.includes('⛽')) return '⛽';
    if (text.includes('sun') || text.includes('☀️')) return '☀️';
    if (text.includes('work') || text.includes('🏢')) return '🏢';
    
    return '💡'; // Default tip icon
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus() {
    const status = {};
    for (const [key, value] of this.cache.entries()) {
      const age = Date.now() - value.timestamp;
      status[key] = {
        age: Math.round(age / 1000) + 's',
        expired: age > this.cacheTimeout
      };
    }
    return status;
  }
}

export default new TrafficInsightsService();
