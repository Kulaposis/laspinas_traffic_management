/**
 * Real-time Traffic Service
 * Integrates with free APIs to get live traffic data
 */

import api from './api';

class RealTimeTrafficService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes cache for traffic data
    
    // Free traffic APIs
    this.apis = {
      overpass: {
        name: 'Overpass API (OpenStreetMap)',
        baseUrl: 'https://overpass-api.de/api/interpreter',
        enabled: true
      },
      tomtom: {
        name: 'TomTom (Free tier)',
        baseUrl: 'https://api.tomtom.com/traffic/services/4',
        // Note: Requires API key but has free tier
        enabled: false // Set to true if you have API key
      },
      here: {
        name: 'HERE API (Free tier)', 
        baseUrl: 'https://traffic.ls.hereapi.com/traffic/6.0',
        enabled: false // Set to true if you have API key
      }
    };
    
    // Las Piñas traffic monitoring points
    this.trafficPoints = [
      { name: 'Alabang-Zapote Road', lat: 14.4504, lng: 121.0170, priority: 'high' },
      { name: 'Westservice Road', lat: 14.4400, lng: 121.0200, priority: 'high' },
      { name: 'C-5 Extension', lat: 14.4600, lng: 121.0150, priority: 'medium' },
      { name: 'CAA Road', lat: 14.4450, lng: 121.0250, priority: 'medium' },
      { name: 'Almanza Road', lat: 14.4350, lng: 121.0100, priority: 'medium' }
    ];
  }

  /**
   * Get real-time traffic data for a route
   */
  async getRouteTrafficData(routeCoordinates) {
    const cacheKey = `route_traffic_${this.hashCoordinates(routeCoordinates)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      // Combine multiple data sources
      const [
        localTrafficData,
        osmTrafficData,
        backendTrafficData
      ] = await Promise.all([
        this.getLocalTrafficEstimate(routeCoordinates),
        this.getOSMTrafficData(routeCoordinates),
        this.getBackendTrafficData(routeCoordinates)
      ]);

      // Merge and analyze traffic data
      const trafficData = this.mergeTrafficData([
        localTrafficData,
        osmTrafficData,
        backendTrafficData
      ]);

      // Cache the result
      this.cache.set(cacheKey, {
        data: trafficData,
        timestamp: Date.now()
      });

      return trafficData;
    } catch (error) {

      return this.getFallbackTrafficData(routeCoordinates);
    }
  }

  /**
   * Get traffic data from backend system
   */
  async getBackendTrafficData(routeCoordinates) {
    try {
      // Get traffic monitoring data from our backend
      const response = await api.get('/traffic/monitoring');
      const trafficData = response.data || [];

      // Find traffic points near the route
      const relevantTraffic = trafficData.filter(traffic => {
        return routeCoordinates.some(coord => {
          const distance = this.calculateDistance(
            coord[0], coord[1], 
            traffic.latitude, traffic.longitude
          );
          return distance < 0.5; // Within 500m of route
        });
      });

      return {
        source: 'backend',
        data: relevantTraffic,
        coverage: relevantTraffic.length / Math.max(routeCoordinates.length, 1),
        timestamp: Date.now()
      };
    } catch (error) {

      return { source: 'backend', data: [], coverage: 0, timestamp: Date.now() };
    }
  }

  /**
   * Get OpenStreetMap traffic-related data
   */
  async getOSMTrafficData(routeCoordinates) {
    try {
      // Create bounding box for the route
      const bounds = this.calculateBounds(routeCoordinates);
      
      // Overpass query for traffic-related features
      const query = `
        [out:json][timeout:10];
        (
          way["highway"]["maxspeed"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["highway"]["lanes"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["highway"="traffic_signals"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["barrier"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out geom;
      `;

      const response = await fetch(this.apis.overpass.baseUrl, {
        method: 'POST',
        body: query,
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        source: 'osm',
        data: this.processOSMTrafficData(data.elements),
        coverage: 0.7, // OSM has good coverage
        timestamp: Date.now()
      };
    } catch (error) {

      return { source: 'osm', data: [], coverage: 0, timestamp: Date.now() };
    }
  }

  /**
   * Process OSM traffic data
   */
  processOSMTrafficData(elements) {
    const trafficFeatures = [];
    
    elements.forEach(element => {
      if (element.type === 'way' && element.tags) {
        const tags = element.tags;
        
        // Analyze road characteristics
        const feature = {
          type: 'road_segment',
          highway_type: tags.highway,
          max_speed: this.parseMaxSpeed(tags.maxspeed),
          lanes: parseInt(tags.lanes) || 1,
          coordinates: element.geometry || [],
          traffic_impact: this.calculateOSMTrafficImpact(tags)
        };
        
        trafficFeatures.push(feature);
      } else if (element.type === 'node' && element.tags) {
        // Traffic control features
        const tags = element.tags;
        
        if (tags.highway === 'traffic_signals' || tags.barrier) {
          trafficFeatures.push({
            type: 'traffic_control',
            control_type: tags.highway || tags.barrier,
            lat: element.lat,
            lng: element.lon,
            delay_factor: this.getControlDelayFactor(tags)
          });
        }
      }
    });
    
    return trafficFeatures;
  }

  /**
   * Get local traffic estimate based on time and location
   */
  async getLocalTrafficEstimate(routeCoordinates) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Time-based traffic patterns
    let timeMultiplier = 1.0;
    if (hour >= 7 && hour <= 9) timeMultiplier = 1.8; // Morning rush
    else if (hour >= 17 && hour <= 19) timeMultiplier = 2.0; // Evening rush
    else if (hour >= 12 && hour <= 13) timeMultiplier = 1.3; // Lunch rush
    else if (hour >= 22 || hour <= 5) timeMultiplier = 0.3; // Late night
    
    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      timeMultiplier *= 0.7; // 30% less traffic on weekends
    }
    
    // Analyze route through known traffic points
    const routeTrafficAnalysis = routeCoordinates.map(coord => {
      const nearbyTrafficPoint = this.findNearestTrafficPoint(coord[0], coord[1]);
      
      return {
        lat: coord[0],
        lng: coord[1],
        estimated_speed: this.estimateSpeed(nearbyTrafficPoint, timeMultiplier),
        congestion_level: this.estimateCongestion(nearbyTrafficPoint, timeMultiplier),
        delay_minutes: this.estimateDelay(nearbyTrafficPoint, timeMultiplier)
      };
    });
    
    return {
      source: 'local_estimate',
      data: routeTrafficAnalysis,
      coverage: 1.0,
      timestamp: Date.now(),
      time_multiplier: timeMultiplier
    };
  }

  /**
   * Find nearest traffic monitoring point
   */
  findNearestTrafficPoint(lat, lng) {
    let nearest = this.trafficPoints[0];
    let minDistance = this.calculateDistance(lat, lng, nearest.lat, nearest.lng);
    
    this.trafficPoints.forEach(point => {
      const distance = this.calculateDistance(lat, lng, point.lat, point.lng);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    });
    
    return { ...nearest, distance: minDistance };
  }

  /**
   * Estimate speed based on traffic point and time
   */
  estimateSpeed(trafficPoint, timeMultiplier) {
    let baseSpeed = 30; // km/h base speed in city
    
    // Adjust based on road priority
    if (trafficPoint.priority === 'high') baseSpeed = 40;
    else if (trafficPoint.priority === 'low') baseSpeed = 20;
    
    // Apply time multiplier (inverse relationship)
    const adjustedSpeed = baseSpeed / timeMultiplier;
    
    return Math.max(5, Math.min(60, adjustedSpeed)); // Clamp between 5-60 km/h
  }

  /**
   * Estimate congestion level
   */
  estimateCongestion(trafficPoint, timeMultiplier) {
    const baseCongestion = trafficPoint.priority === 'high' ? 0.4 : 0.2;
    const congestion = baseCongestion * timeMultiplier;
    
    if (congestion < 0.3) return 'light';
    else if (congestion < 0.6) return 'moderate';
    else if (congestion < 0.8) return 'heavy';
    else return 'severe';
  }

  /**
   * Estimate delay in minutes
   */
  estimateDelay(trafficPoint, timeMultiplier) {
    const baseDelay = trafficPoint.priority === 'high' ? 2 : 1;
    return Math.round(baseDelay * (timeMultiplier - 1));
  }

  /**
   * Merge traffic data from multiple sources
   */
  mergeTrafficData(sources) {
    const mergedData = {
      sources: sources.map(s => ({ name: s.source, coverage: s.coverage })),
      overall_coverage: sources.reduce((sum, s) => sum + s.coverage, 0) / sources.length,
      traffic_segments: [],
      incidents: [],
      controls: [],
      timestamp: Date.now()
    };

    // Combine data from all sources
    sources.forEach(source => {
      if (source.data && Array.isArray(source.data)) {
        source.data.forEach(item => {
          if (item.traffic_status || item.estimated_speed) {
            mergedData.traffic_segments.push({
              ...item,
              source: source.source
            });
          } else if (item.incident_type) {
            mergedData.incidents.push({
              ...item,
              source: source.source
            });
          } else if (item.type === 'traffic_control') {
            mergedData.controls.push({
              ...item,
              source: source.source
            });
          }
        });
      }
    });

    // Calculate overall traffic condition
    mergedData.overall_condition = this.calculateOverallCondition(mergedData);
    
    return mergedData;
  }

  /**
   * Calculate overall traffic condition
   */
  calculateOverallCondition(trafficData) {
    const segments = trafficData.traffic_segments;
    if (segments.length === 0) return 'unknown';
    
    // Count different condition types
    const conditions = {
      light: 0,
      moderate: 0,
      heavy: 0,
      severe: 0
    };
    
    segments.forEach(segment => {
      const condition = segment.congestion_level || segment.traffic_status || 'light';
      if (conditions.hasOwnProperty(condition)) {
        conditions[condition]++;
      }
    });
    
    const total = segments.length;
    if (conditions.severe / total > 0.3) return 'severe';
    if (conditions.heavy / total > 0.4) return 'heavy';
    if (conditions.moderate / total > 0.5) return 'moderate';
    return 'light';
  }

  /**
   * Get fallback traffic data when APIs fail
   */
  getFallbackTrafficData(routeCoordinates) {
    const now = new Date();
    const hour = now.getHours();
    
    let condition = 'light';
    if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19) {
      condition = 'moderate'; // Rush hours
    }
    
    return {
      sources: [{ name: 'fallback', coverage: 0.5 }],
      overall_coverage: 0.5,
      overall_condition: condition,
      traffic_segments: routeCoordinates.map(coord => ({
        lat: coord[0],
        lng: coord[1],
        congestion_level: condition,
        estimated_speed: condition === 'moderate' ? 20 : 30,
        source: 'fallback'
      })),
      incidents: [],
      controls: [],
      timestamp: Date.now(),
      fallback: true
    };
  }

  /**
   * Parse max speed from OSM data
   */
  parseMaxSpeed(maxspeed) {
    if (!maxspeed) return null;
    
    const match = maxspeed.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Calculate traffic impact from OSM tags
   */
  calculateOSMTrafficImpact(tags) {
    let impact = 0.5; // Base impact
    
    // Highway type impact
    const highwayTypes = {
      'motorway': 0.2,
      'trunk': 0.3,
      'primary': 0.4,
      'secondary': 0.5,
      'tertiary': 0.6,
      'residential': 0.7,
      'service': 0.8
    };
    
    if (tags.highway && highwayTypes[tags.highway]) {
      impact = highwayTypes[tags.highway];
    }
    
    // Lane count impact
    const lanes = parseInt(tags.lanes) || 1;
    impact *= Math.max(0.3, 1 - (lanes - 1) * 0.1);
    
    // Max speed impact
    const maxSpeed = this.parseMaxSpeed(tags.maxspeed);
    if (maxSpeed) {
      impact *= maxSpeed < 30 ? 1.2 : maxSpeed > 60 ? 0.8 : 1.0;
    }
    
    return Math.min(1.0, impact);
  }

  /**
   * Get delay factor for traffic controls
   */
  getControlDelayFactor(tags) {
    if (tags.highway === 'traffic_signals') return 30; // 30 second average delay
    if (tags.barrier === 'toll_booth') return 60; // 1 minute delay
    if (tags.barrier === 'gate') return 15; // 15 second delay
    return 10; // Default delay
  }

  /**
   * Calculate bounding box for coordinates
   */
  calculateBounds(coordinates) {
    const lats = coordinates.map(c => c[0]);
    const lngs = coordinates.map(c => c[1]);
    
    const padding = 0.01; // Add padding around route
    
    return {
      north: Math.max(...lats) + padding,
      south: Math.min(...lats) - padding,
      east: Math.max(...lngs) + padding,
      west: Math.min(...lngs) - padding
    };
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Create hash for coordinates (for caching)
   */
  hashCoordinates(coordinates) {
    return coordinates.map(c => `${c[0].toFixed(4)},${c[1].toFixed(4)}`).join('|');
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get real-time traffic incidents from various sources
   */
  async getTrafficIncidents(bounds) {
    try {
      // Get incidents from backend
      const backendIncidents = await api.get('/traffic/incidents', {
        params: { is_active: true }
      });
      
      // Get road work information from OSM
      const osmIncidents = await this.getOSMIncidents(bounds);
      
      return {
        incidents: [
          ...(backendIncidents.data || []),
          ...osmIncidents
        ],
        sources: ['backend', 'osm'],
        timestamp: Date.now()
      };
    } catch (error) {

      return { incidents: [], sources: [], timestamp: Date.now() };
    }
  }

  /**
   * Get incidents from OpenStreetMap data
   */
  async getOSMIncidents(bounds) {
    try {
      const query = `
        [out:json][timeout:10];
        (
          way["highway"]["construction"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          node["highway"="construction"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
          way["highway"]["barrier"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
        );
        out geom;
      `;

      const response = await fetch(this.apis.overpass.baseUrl, {
        method: 'POST',
        body: query
      });

      if (!response.ok) return [];

      const data = await response.json();
      
      return data.elements.map(element => ({
        id: `osm_${element.id}`,
        incident_type: 'road_work',
        title: 'Road Construction',
        description: element.tags?.construction || 'Construction work in progress',
        latitude: element.lat || (element.geometry?.[0]?.lat || 0),
        longitude: element.lon || (element.geometry?.[0]?.lon || 0),
        severity: 'medium',
        source: 'osm',
        is_active: true,
        created_at: new Date().toISOString()
      }));
    } catch (error) {

      return [];
    }
  }
}

export default new RealTimeTrafficService();
