/**
 * Enhanced Routing Service with TomTom API Integration
 * Provides Google Maps/Waze-like turn-by-turn navigation
 */

import tomtomService from './tomtomService';
import api from './api';

class EnhancedRoutingService {
  constructor() {
    this.currentRoute = null;
    this.navigationSession = null;
  }

  /**
   * Get detailed route with turn-by-turn instructions using OSRM (Open Source Routing Machine)
   */
  async getDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    try {

      // Use OSRM for reliable routing
      const osrmRoute = await this.getOSRMDetailedRoute(
        originLat, originLng, destinationLat, destinationLng, options
      );

      if (osrmRoute && osrmRoute.routes && osrmRoute.routes.length > 0) {

        return osrmRoute;
      }

      throw new Error('No valid route found');
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get route from OSRM (Open Source Routing Machine)
   */
  async getOSRMDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    try {

      // OSRM API expects coordinates in longitude,latitude order
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson&steps=true&alternatives=${options.maxAlternatives || 3}`
      );

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`No route found: ${data.message || 'Unknown error'}`);
      }

      // Validate response structure
      if (!data.routes[0].geometry || !data.routes[0].geometry.coordinates) {
        throw new Error('Invalid route geometry in OSRM response');
      }

      // Transform OSRM format to our format
      return this.transformOSRMRoute(data);
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get route from TomTom API with full details
   */
  async getTomTomDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    const origin = { lat: originLat, lng: originLng };
    const destination = { lat: destinationLat, lng: destinationLng };

    // TomTom API parameters - simplified to avoid 400 errors
    const routeOptions = {
      traffic: 'true',
      travelMode: options.travelMode || 'car',
      instructionsType: 'text',
      routeRepresentation: 'polyline',
      computeBestOrder: 'false',
      maxAlternatives: String(options.maxAlternatives || 0), // 0 means fastest route only
      language: 'en-US'
    };
    
    // Only add avoid parameter if explicitly requested
    if (options.avoidTraffic === true) {
      routeOptions.avoid = 'unpavedRoads';
    }

    try {
      const result = await tomtomService.calculateRoute(origin, destination, routeOptions);
      return result;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Transform OSRM route to our format with detailed instructions
   */
  transformOSRMRoute(osrmData) {
    if (!osrmData || !osrmData.routes || osrmData.routes.length === 0) {

      return null;
    }

    const routes = osrmData.routes.map((route, index) => {
      const leg = route.legs?.[0];
      if (!leg) {

        return null;
      }

      // Extract route coordinates from geometry
      const coordinates = [];
      if (route.geometry && route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
        route.geometry.coordinates.forEach(coord => {
          // OSRM returns [longitude, latitude] - convert to [latitude, longitude]
          if (Array.isArray(coord) && coord.length >= 2) {
            coordinates.push([coord[1], coord[0]]);
          }
        });
      }

      if (coordinates.length === 0) {

        return null;
      }

      // Transform OSRM steps to our format
      const steps = [];
      if (leg.steps && Array.isArray(leg.steps)) {
        leg.steps.forEach((step, stepIndex) => {
          if (!step) return;

          const stepData = {
            index: stepIndex,
            instruction: step.maneuver?.instruction || this.getOSRMManeuverInstruction(step.maneuver),
            maneuver_type: this.mapOSRMManeuverType(step.maneuver?.type || 'continue'),
            distance_meters: step.distance || 0,
            travel_time_seconds: step.duration || 0,
            street_name: step.name || '',
            location: step.maneuver?.location ? [step.maneuver.location[1], step.maneuver.location[0]] : null,
          };
          steps.push(stepData);
        });
      }

      if (coordinates.length < 2) {

        return null;
      }

      return {
        route_id: `osrm_${Date.now()}_${index}`,
        route_name: index === 0 ? 'Fastest Route' : `Alternative ${index}`,
        route_type: index === 0 ? 'fastest' : 'alternative',
        route_quality: index === 0 ? 'primary' : 'alternative',

        // Route metrics
        distance_km: route.distance / 1000,
        estimated_duration_minutes: route.duration / 60,

        // Route data
        route_coordinates: coordinates,
        steps: steps,

        // Additional info
        confidence_level: 'high',
        data_source: 'osrm',
        real_time_traffic: false,

        // Route bounds for map display
        bounds: this.calculateBounds(coordinates)
      };
    }).filter(route => route !== null);

    if (routes.length === 0) {

      return null;
    }

    return {
      routes: routes,
      recommended_route: routes[0],
      origin: {
        lat: routes[0].route_coordinates[0][0],
        lon: routes[0].route_coordinates[0][1]
      },
      destination: {
        lat: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][0],
        lon: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][1]
      }
    };
  }

  /**
   * Get maneuver instruction from OSRM step
   */
  getOSRMManeuverInstruction(maneuver) {
    if (!maneuver || !maneuver.instruction) {
      return 'Continue driving';
    }
    return maneuver.instruction;
  }

  /**
   * Map OSRM maneuver types to our system
   */
  mapOSRMManeuverType(osrmType) {
    const maneuverMap = {
      'turn': 'turn-right', // Default for turns
      'turn-left': 'turn-left',
      'turn-right': 'turn-right',
      'turn-sharp-left': 'sharp-left',
      'turn-sharp-right': 'sharp-right',
      'turn-slight-left': 'bear-left',
      'turn-slight-right': 'bear-right',
      'continue': 'straight',
      'straight': 'straight',
      'uturn': 'uturn',
      'depart': 'depart',
      'arrive': 'arrive',
      'merge': 'merge',
      'fork': 'fork',
      'end of road': 'arrive',
      'roundabout': 'roundabout-enter',
      'rotary': 'roundabout-enter',
      'roundabout-exit': 'roundabout-exit',
      'exit': 'exit',
      'exit-roundabout': 'roundabout-exit'
    };

    return maneuverMap[osrmType] || 'straight';
  }

  /**
   * Transform TomTom route to our format with detailed instructions
   */
  transformTomTomRoute(tomtomData) {
    if (!tomtomData || !tomtomData.routes || tomtomData.routes.length === 0) {

      return null;
    }

    const routes = tomtomData.routes.map((route, index) => {
      const leg = route.legs?.[0];
      const summary = route.summary;
      
      if (!leg || !summary) {

        return null;
      }

      // Extract route coordinates
      const coordinates = [];
      if (leg.points && Array.isArray(leg.points)) {
        leg.points.forEach(point => {
          if (point.latitude && point.longitude) {
            coordinates.push([point.latitude, point.longitude]);
          }
        });
      }
      
      // Fallback: use instruction points if no leg points
      if (coordinates.length === 0 && leg.instructions) {
        leg.instructions.forEach(instruction => {
          if (instruction.point?.latitude && instruction.point?.longitude) {
            coordinates.push([instruction.point.latitude, instruction.point.longitude]);
          }
        });
      }

      // Extract detailed turn-by-turn instructions
      const steps = [];
      if (leg.instructions) {
        leg.instructions.forEach((instruction, stepIndex) => {
          const step = {
            index: stepIndex,
            instruction: instruction.message || instruction.instructionType || 'Continue',
            maneuver_type: this.mapTomTomManeuverType(instruction.instructionType || instruction.maneuver),
            distance_meters: instruction.routeOffsetInMeters || 0,
            travel_time_seconds: instruction.travelTimeInSeconds || 0,
            street_name: instruction.street || instruction.roadNumbers?.join(', ') || '',
            location: instruction.point ? [instruction.point.latitude, instruction.point.longitude] : null,
            
            // Additional details for better navigation
            turn_angle_degrees: instruction.turnAngleInDegrees,
            exit_number: instruction.exitNumber,
            roundabout_exit_number: instruction.roundaboutExitNumber,
            combined_instruction: instruction.combinedMessage,
            driving_side: instruction.drivingSide,
            lane_info: instruction.lanes ? this.extractLaneInfo(instruction.lanes) : null
          };

          steps.push(step);
        });
      }

      // Skip invalid routes
      if (coordinates.length < 2) {

        return null;
      }

      // Determine route type
      const routeType = index === 0 ? 'fastest' : 'alternative';
      const trafficDelay = summary.trafficDelayInSeconds || 0;
      const hasTraffic = trafficDelay > 60; // More than 1 minute delay

      return {
        route_id: `tomtom_${Date.now()}_${index}`,
        route_name: index === 0 ? 'Fastest Route' : `Alternative ${index}`,
        route_type: routeType,
        route_quality: index === 0 ? 'primary' : 'alternative',
        
        // Route metrics
        distance_km: summary.lengthInMeters / 1000,
        estimated_duration_minutes: summary.travelTimeInSeconds / 60,
        traffic_delay_minutes: trafficDelay / 60,
        
        // Route data
        route_coordinates: coordinates,
        steps: steps,
        
        // Traffic information
        traffic_conditions: hasTraffic ? 'heavy' : 'light',
        has_tolls: summary.hasTolls || false,
        has_highways: summary.hasHighway || false,
        has_ferries: summary.hasFerry || false,
        
        // Additional info
        confidence_level: 'high',
        data_source: 'tomtom',
        real_time_traffic: true,
        
        // Route bounds for map display
        bounds: this.calculateBounds(coordinates)
      };
    }).filter(route => route !== null); // Remove null routes
    
    // Validate we have at least one valid route
    if (routes.length === 0) {

      return null;
    }

    return {
      routes: routes,
      recommended_route: routes[0],
      origin: {
        lat: routes[0].route_coordinates[0][0],
        lon: routes[0].route_coordinates[0][1]
      },
      destination: {
        lat: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][0],
        lon: routes[0].route_coordinates[routes[0].route_coordinates.length - 1][1]
      }
    };
  }

  /**
   * Extract lane information for lane guidance
   */
  extractLaneInfo(lanes) {
    if (!lanes || lanes.length === 0) return null;

    return lanes.map(lane => ({
      directions: lane.directions || [],
      is_recommended: lane.isRecommended || false,
      lane_type: lane.laneType
    }));
  }

  /**
   * Map TomTom maneuver types to our system
   */
  mapTomTomManeuverType(tomtomType) {
    const maneuverMap = {
      'TURN_LEFT': 'turn-left',
      'TURN_RIGHT': 'turn-right',
      'KEEP_LEFT': 'keep-left',
      'KEEP_RIGHT': 'keep-right',
      'BEAR_LEFT': 'bear-left',
      'BEAR_RIGHT': 'bear-right',
      'SHARP_LEFT': 'sharp-left',
      'SHARP_RIGHT': 'sharp-right',
      'STRAIGHT': 'straight',
      'ENTER_ROUNDABOUT': 'roundabout-enter',
      'EXIT_ROUNDABOUT': 'roundabout-exit',
      'TAKE_EXIT': 'exit',
      'MAKE_UTURN': 'uturn',
      'ENTER_HIGHWAY': 'merge',
      'EXIT_HIGHWAY': 'exit',
      'ARRIVE': 'arrive',
      'DEPART': 'depart',
      'ENTER_MOTORWAY': 'merge',
      'EXIT_MOTORWAY': 'exit',
      'WAYPOINT_LEFT': 'waypoint-left',
      'WAYPOINT_RIGHT': 'waypoint-right',
      'WAYPOINT_REACHED': 'waypoint'
    };

    return maneuverMap[tomtomType] || 'straight';
  }

  /**
   * Get route from backend API (fallback)
   */
  async getBackendDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    try {
      const response = await api.get('/traffic/routing/smart', {
        params: {
          origin_lat: originLat,
          origin_lng: originLng,
          destination_lat: destinationLat,
          destination_lng: destinationLng,
          avoid_traffic: options.avoidTraffic || true,
          detailed: true // Request detailed route with instructions
        }
      });

      return response.data;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Calculate route bounds for map display
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;

    coordinates.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    return {
      southwest: [minLat, minLng],
      northeast: [maxLat, maxLng]
    };
  }

  /**
   * Start a navigation session
   */
  startNavigationSession(route, origin, destination) {
    // Validate inputs
    if (!route || !route.route_coordinates || route.route_coordinates.length < 2) {
      throw new Error('Invalid route: must have at least 2 coordinates');
    }
    
    if (!origin || !destination) {
      throw new Error('Invalid navigation: origin and destination required');
    }
    
    this.navigationSession = {
      route: route,
      origin: origin,
      destination: destination,
      startTime: Date.now(),
      currentStepIndex: 0,
      isActive: true
    };

    this.currentRoute = route;

    return this.navigationSession;
  }

  /**
   * Update navigation progress
   */
  updateNavigationProgress(userLat, userLng) {
    if (!this.navigationSession || !this.navigationSession.isActive) {
      return null;
    }

    const route = this.navigationSession.route;
    
    // Find closest point on route
    const closestPoint = this.findClosestPointOnRoute(userLat, userLng, route.route_coordinates);
    
    // Find next maneuver
    const nextStep = this.findNextStep(closestPoint.index, route.steps);
    
    // Calculate remaining distance and time
    const remaining = this.calculateRemaining(closestPoint.index, route);
    
    return {
      closestPoint: closestPoint,
      nextStep: nextStep,
      remaining: remaining,
      progress: (closestPoint.index / route.route_coordinates.length) * 100
    };
  }

  /**
   * Find closest point on route to user's location
   */
  findClosestPointOnRoute(userLat, userLng, routeCoordinates) {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < routeCoordinates.length; i++) {
      const [lat, lng] = routeCoordinates[i];
      const distance = this.calculateDistance(userLat, userLng, lat, lng);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return {
      index: closestIndex,
      distance: minDistance,
      coordinates: routeCoordinates[closestIndex]
    };
  }

  /**
   * Find next navigation step
   */
  findNextStep(currentIndex, steps) {
    if (!steps || steps.length === 0) return null;

    // Find the next step after current position
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].index > currentIndex) {
        return steps[i];
      }
    }

    // Return last step (arrival)
    return steps[steps.length - 1];
  }

  /**
   * Calculate remaining distance and time
   */
  calculateRemaining(currentIndex, route) {
    let remainingDistance = 0;
    
    for (let i = currentIndex; i < route.route_coordinates.length - 1; i++) {
      const [lat1, lng1] = route.route_coordinates[i];
      const [lat2, lng2] = route.route_coordinates[i + 1];
      remainingDistance += this.calculateDistance(lat1, lng1, lat2, lng2);
    }

    const totalDistance = route.distance_km * 1000; // Convert to meters
    const proportion = totalDistance > 0 ? remainingDistance / totalDistance : 0;
    const remainingTime = route.estimated_duration_minutes * proportion;

    return {
      distance_meters: remainingDistance,
      distance_km: remainingDistance / 1000,
      time_minutes: remainingTime,
      time_seconds: remainingTime * 60
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * End navigation session
   */
  endNavigationSession() {
    if (this.navigationSession) {
      this.navigationSession.isActive = false;
      this.navigationSession.endTime = Date.now();
    }
    
    this.currentRoute = null;
  }

  /**
   * Format instruction for voice/display
   */
  formatInstruction(step, distanceMeters) {
    if (!step) return '';

    let instruction = step.instruction;
    
    // Add distance prefix
    const distanceText = this.formatDistance(distanceMeters);
    
    if (distanceMeters < 50) {
      instruction = `Now, ${instruction}`;
    } else {
      instruction = `In ${distanceText}, ${instruction}`;
    }

    // Add street name if available
    if (step.street_name) {
      instruction += ` onto ${step.street_name}`;
    }

    return instruction;
  }

  /**
   * Format distance for display
   */
  formatDistance(meters) {
    if (meters < 100) {
      return `${Math.round(meters / 10) * 10}m`;
    } else if (meters < 1000) {
      return `${Math.round(meters / 50) * 50}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
    if (minutes < 1) {
      return '< 1 min';
    } else if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  }

  /**
   * Get maneuver icon for UI
   */
  getManeuverIcon(maneuverType) {
    const iconMap = {
      'turn-left': '↰',
      'turn-right': '↱',
      'sharp-left': '⮰',
      'sharp-right': '⮱',
      'keep-left': '⬉',
      'keep-right': '⬈',
      'bear-left': '⬋',
      'bear-right': '⬊',
      'straight': '↑',
      'uturn': '↺',
      'merge': '⤎',
      'exit': '⤴',
      'roundabout-enter': '↻',
      'roundabout-exit': '⮕',
      'arrive': '🏁',
      'depart': '🚗'
    };

    return iconMap[maneuverType] || '→';
  }
}

export default new EnhancedRoutingService();

