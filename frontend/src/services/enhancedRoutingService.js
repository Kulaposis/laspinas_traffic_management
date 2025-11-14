/**
 * Enhanced Routing Service with Multiple API Integration
 * Provides Google Maps/Waze-like turn-by-turn navigation
 * Routing Priority: OSRM -> Geoapify -> TomTom
 */

import tomtomService from './tomtomService';
import geoapifyService from './geoapifyService';
import hereRoutingService from './hereRoutingService';
import api from './api';

class EnhancedRoutingService {
  constructor() {
    this.currentRoute = null;
    this.navigationSession = null;
  }

  /**
   * Get detailed route from HERE Routing API
   */
  async getHereDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    const origin = { lat: originLat, lng: originLng };
    const destination = { lat: destinationLat, lng: destinationLng };

    const routeOptions = {
      transportMode: options.travelMode || 'car',
      maxAlternatives: options.maxAlternatives || 2,
      avoidTolls: options.avoidTolls || false
    };

    try {
      const result = await hereRoutingService.calculateRoute(origin, destination, routeOptions);

      if (!result || !result.routes || result.routes.length === 0) {
        throw new Error('HERE Routing API returned no routes');
      }

      return this.transformHereRoute(result);
    } catch (error) {
      console.error('HERE routing error:', error);
      throw error;
    }
  }

  /**
   * Get detailed route with turn-by-turn instructions
   * Priority: HERE -> OSRM -> Geoapify -> TomTom
   */
  async getDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    const maxAlternatives = options.maxAlternatives || 3;
    
    try {
      // Try HERE Routing first (traffic-aware, high quality maneuvers)
      // Check if API key is configured before attempting
      const hereApiKey = 
        import.meta.env.VITE_HERE_API_KEY ||
        import.meta.env.VITE_HERE_APIKEY ||
        import.meta.env.VITE_HERE_ROUTING_KEY;
      
      if (hereApiKey) {
        try {
          const hereRoute = await this.getHereDetailedRoute(
            originLat, originLng, destinationLat, destinationLng, options
          );

          if (hereRoute && hereRoute.routes && hereRoute.routes.length > 0) {
            return hereRoute;
          }
        } catch (hereError) {
          // Silently fall back to OSRM
        }
      }

      // Try OSRM (fast open-source routing with good alternates)
      try {
        const osrmRoute = await this.getOSRMDetailedRoute(
          originLat, originLng, destinationLat, destinationLng, options
        );

        if (osrmRoute && osrmRoute.routes && osrmRoute.routes.length > 0) {
          console.log('✅ Using OSRM for routing');
          return osrmRoute;
        }
      } catch (osrmError) {
        console.warn('OSRM routing failed, falling back to Geoapify:', osrmError.message);
      }

      // Fallback to Geoapify (with traffic data support)
      try {
        const geoapifyRoute = await this.getGeoapifyDetailedRoute(
          originLat, originLng, destinationLat, destinationLng, options
        );

        if (geoapifyRoute && geoapifyRoute.routes && geoapifyRoute.routes.length > 0) {
          console.log('✅ Using Geoapify for routing');
          return geoapifyRoute;
        }
      } catch (geoapifyError) {
        console.warn('Geoapify routing failed, falling back to TomTom:', geoapifyError.message);
      }

      // Final fallback to TomTom API (with traffic data)
      try {
        const tomtomRoute = await this.getTomTomDetailedRoute(
          originLat, originLng, destinationLat, destinationLng, options
        );

        if (tomtomRoute && tomtomRoute.routes) {
          // Transform TomTom response to our format
          const transformedRoute = this.transformTomTomRoute(tomtomRoute);
          
          if (transformedRoute && transformedRoute.routes && transformedRoute.routes.length > 0) {
            // If TomTom only returned 1 route but we requested multiple, try to get alternatives
            if (transformedRoute.routes.length === 1 && maxAlternatives > 1) {
              console.log('TomTom returned only 1 route, attempting to get alternatives via different route types...');
              
              // Try to get alternatives by requesting different route types
              const alternativeRoutes = await this.getTomTomAlternativesByType(
                originLat, originLng, destinationLat, destinationLng, transformedRoute.routes[0]
              );
              
              if (alternativeRoutes && alternativeRoutes.length > 1) {
                transformedRoute.routes = alternativeRoutes;
                transformedRoute.recommended_route = alternativeRoutes[0];
                console.log(`✅ Generated ${alternativeRoutes.length} alternative routes using different route types`);
                return transformedRoute;
              }
            }
            console.log('✅ Using TomTom API for routing');
            return transformedRoute;
          }
        }
      } catch (tomtomError) {
        console.warn('TomTom routing failed:', tomtomError.message);
      }

      throw new Error('No valid route found from any routing provider');
    } catch (error) {
      console.error('Route calculation error:', error);
      throw error;
    }
  }

  /**
   * Get alternative routes from TomTom by requesting different route types
   */
  async getTomTomAlternativesByType(originLat, originLng, destinationLat, destinationLng, primaryRoute) {
    const routeTypes = ['fastest', 'shortest', 'eco'];
    const alternativeRoutes = [primaryRoute]; // Start with the primary route
    
    try {
      // Request routes with different types to get alternatives
      for (const routeType of routeTypes) {
        if (alternativeRoutes.length >= 3) break; // We have enough routes
        
        try {
          const routeOptions = {
            routeType: routeType,
            maxAlternatives: 1, // Just get one route of this type
            travelMode: 'car',
            traffic: 'true'
          };
          
          const result = await tomtomService.calculateRoute(
            { lat: originLat, lng: originLng },
            { lat: destinationLat, lng: destinationLng },
            routeOptions
          );
          
          if (result && result.routes && result.routes.length > 0) {
            const transformed = this.transformTomTomRoute(result);
            if (transformed && transformed.routes && transformed.routes.length > 0) {
              const newRoute = transformed.routes[0];
              
              // Check if this route is different from existing ones (by distance/duration)
              const isDifferent = alternativeRoutes.every(existing => {
                const distanceDiff = Math.abs(existing.distance_km - newRoute.distance_km);
                const durationDiff = Math.abs(existing.estimated_duration_minutes - newRoute.estimated_duration_minutes);
                // Consider it different if distance or duration differs by more than 5%
                return distanceDiff > existing.distance_km * 0.05 || durationDiff > existing.estimated_duration_minutes * 0.05;
              });
              
              if (isDifferent) {
                newRoute.route_name = routeType === 'fastest' ? 'Fastest Route' : 
                                    routeType === 'shortest' ? 'Shortest Route' : 
                                    'Eco Route';
                alternativeRoutes.push(newRoute);
              }
            }
          }
        } catch (error) {
          // Continue to next route type if one fails
          console.warn(`Failed to get ${routeType} route:`, error.message);
        }
      }
      
      // Sort by distance (shortest first)
      alternativeRoutes.sort((a, b) => (a.distance_km || Infinity) - (b.distance_km || Infinity));
      
      // Update route names
      alternativeRoutes.forEach((route, index) => {
        if (index === 0) {
          route.route_name = 'Fastest Route';
        } else {
          route.route_name = `Alternative ${index}`;
        }
      });
      
      return alternativeRoutes;
    } catch (error) {
      console.error('Error getting TomTom alternatives by type:', error);
      return [primaryRoute]; // Return at least the primary route
    }
  }

  /**
   * Get route from OSRM (Open Source Routing Machine)
   */
  async getOSRMDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    try {
      const requestedAlternatives = options.maxAlternatives || 3;
      // Ensure we request at least 3 alternatives (OSRM returns up to 3) and cap to 4 for safety
      const osrmAlternatives = Math.min(Math.max(requestedAlternatives, 3), 4);
      
      // OSRM API expects coordinates in longitude,latitude order
      // Use alternatives parameter to request multiple routes
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson&steps=true&alternatives=${osrmAlternatives}`
      );

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`No route found: ${data.message || 'Unknown error'}`);
      }

      // Log how many routes were returned for debugging
      console.log(`OSRM API returned ${data.routes.length} route(s) (requested ${osrmAlternatives} alternatives)`);

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
   * Get route from Geoapify API with full details
   */
  async getGeoapifyDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    const origin = { lat: originLat, lng: originLng };
    const destination = { lat: destinationLat, lng: destinationLng };

    // Geoapify API parameters - optimized for better routing results
    const routeOptions = {
      traffic: options.traffic !== false, // Enable traffic for accurate ETAs
      travelMode: options.travelMode || 'car',
      maxAlternatives: options.maxAlternatives || 3, // Get multiple route alternatives
      routeType: options.routeType, // fastest, shortest, balanced
      avoidTraffic: options.avoidTraffic
    };

    try {
      const result = await geoapifyService.calculateRoute(origin, destination, routeOptions);
      
      // Log the result for debugging
      console.log('Geoapify calculateRoute result:', result);
      
      // Validate Geoapify response
      if (!result) {
        throw new Error('Geoapify API returned null/undefined response');
      }
      
      if (!result.routes || result.routes.length === 0) {
        console.warn('Geoapify API returned empty routes array. Full result:', result);
        throw new Error('Geoapify API returned no routes');
      }
      
      // Log how many routes were returned for debugging
      const maxAlternatives = options.maxAlternatives || 3;
      console.log(`Geoapify API returned ${result.routes.length} route(s) (requested ${maxAlternatives} alternatives)`);
      
      // Transform Geoapify response to our format
      // Geoapify routes are already in TomTom-compatible format with additional route_coordinates
      // Check if routes already have route_coordinates (Geoapify format)
      if (result.routes && result.routes.length > 0 && result.routes[0].route_coordinates) {
        // Geoapify routes already have the correct format, use them directly
        return result;
      }
      
      // Otherwise, transform using TomTom format
      const transformedRoute = this.transformTomTomRoute(result);
      
      if (transformedRoute && transformedRoute.routes && transformedRoute.routes.length > 0) {
        return transformedRoute;
      }
      
      throw new Error('Failed to transform Geoapify routes');
    } catch (error) {
      console.error('Geoapify routing error:', error);
      throw error;
    }
  }

  /**
   * Get route from TomTom API with full details
   */
  async getTomTomDetailedRoute(originLat, originLng, destinationLat, destinationLng, options = {}) {
    const origin = { lat: originLat, lng: originLng };
    const destination = { lat: destinationLat, lng: destinationLng };

    // TomTom API parameters - optimized for better routing results
    // Note: tomtomService.calculateRoute will convert these to proper URL params
    const routeOptions = {
      traffic: 'true', // Enable real-time traffic for accurate ETAs
      travelMode: options.travelMode || 'car',
      instructionsType: 'text', // Get detailed text instructions
      routeRepresentation: 'polyline', // Get polyline with detailed points in legs
      computeBestOrder: 'false',
      maxAlternatives: options.maxAlternatives || 3, // Get multiple route alternatives
      language: 'en-US'
    };
    
    // Add avoid parameters if requested for better route quality
    if (options.avoidTraffic === true) {
      routeOptions.avoid = 'unpavedRoads';
    }
    
    // Set route type based on options for optimal routing
    // Note: Don't set routeType if we want alternatives - TomTom returns more alternatives without routeType
    // We'll sort by distance after getting routes to make fastest = shortest
    // Only set routeType if explicitly requested AND we're not requesting multiple alternatives
    const maxAlternatives = options.maxAlternatives || 3;
    if (options.routeType && maxAlternatives <= 1) {
      routeOptions.routeType = options.routeType; // fastest, shortest, eco, thrilling
    } else {
      // Explicitly don't set routeType when requesting alternatives to get more diverse routes
      delete routeOptions.routeType;
    }

    try {
      const result = await tomtomService.calculateRoute(origin, destination, routeOptions);
      
      // Validate TomTom response
      if (!result || !result.routes || result.routes.length === 0) {
        throw new Error('TomTom API returned no routes');
      }
      
      // Log how many routes were returned for debugging
      console.log(`TomTom API returned ${result.routes.length} route(s) (requested ${maxAlternatives} alternatives)`);
      
      return result;
    } catch (error) {
      console.error('TomTom routing error:', error);
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

    // Sort routes by duration (fastest first)
    routes.sort((a, b) => {
      const durationA = a.estimated_duration_minutes || Infinity;
      const durationB = b.estimated_duration_minutes || Infinity;
      return durationA - durationB;
    });

    return {
      routes: routes,
      recommended_route: routes[0], // First route is now the fastest by ETA
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

      // Extract route coordinates from TomTom response
      const coordinates = [];
      
      // Method 1: Extract from leg.points array (primary method - TomTom includes this with polyline representation)
      if (leg.points && Array.isArray(leg.points)) {
        leg.points.forEach(point => {
          if (point.latitude !== undefined && point.longitude !== undefined) {
            const lat = point.latitude;
            const lng = point.longitude;
            if (typeof lat === 'number' && typeof lng === 'number' && 
                !isNaN(lat) && !isNaN(lng) &&
                lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              coordinates.push([lat, lng]);
            }
          }
        });
      }
      
      // Method 2: Extract from sections (alternative structure)
      if (coordinates.length === 0 && route.sections && Array.isArray(route.sections)) {
        route.sections.forEach(section => {
          // Extract from section points
          if (section.points && Array.isArray(section.points)) {
            section.points.forEach(point => {
              if (point.latitude !== undefined && point.longitude !== undefined) {
                const lat = point.latitude;
                const lng = point.longitude;
                if (typeof lat === 'number' && typeof lng === 'number' && 
                    !isNaN(lat) && !isNaN(lng) &&
                    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                  coordinates.push([lat, lng]);
                }
              }
            });
          }
          // Fallback to start/end points
          if (section.startPoint && section.startPoint.latitude !== undefined) {
            coordinates.push([section.startPoint.latitude, section.startPoint.longitude]);
          }
          if (section.endPoint && section.endPoint.latitude !== undefined) {
            coordinates.push([section.endPoint.latitude, section.endPoint.longitude]);
          }
        });
      }
      
      // Method 3: Fallback to instruction points (sparse but better than nothing)
      if (coordinates.length === 0 && leg.instructions && Array.isArray(leg.instructions)) {
        leg.instructions.forEach(instruction => {
          if (instruction.point) {
            const lat = instruction.point.latitude;
            const lng = instruction.point.longitude;
            if (lat !== undefined && lng !== undefined &&
                typeof lat === 'number' && typeof lng === 'number' && 
                !isNaN(lat) && !isNaN(lng) &&
                lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              coordinates.push([lat, lng]);
            }
          }
        });
      }
      
      // Remove duplicates and ensure proper order
      if (coordinates.length > 0) {
        // Remove duplicate consecutive coordinates
        const uniqueCoordinates = [coordinates[0]];
        for (let i = 1; i < coordinates.length; i++) {
          const prev = uniqueCoordinates[uniqueCoordinates.length - 1];
          const curr = coordinates[i];
          // Only add if different from previous (at least 0.00001 degrees apart)
          const latDiff = Math.abs(prev[0] - curr[0]);
          const lngDiff = Math.abs(prev[1] - curr[1]);
          if (latDiff > 0.00001 || lngDiff > 0.00001) {
            uniqueCoordinates.push(curr);
          }
        }
        // Replace coordinates array with deduplicated version
        coordinates.length = 0;
        coordinates.push(...uniqueCoordinates);
      }

      // Extract detailed turn-by-turn instructions
      const steps = [];
      
      // Try to get instructions from leg
      if (leg.instructions && Array.isArray(leg.instructions)) {
        leg.instructions.forEach((instruction, stepIndex) => {
          const step = {
            index: stepIndex,
            instruction: instruction.message || instruction.instructionType || instruction.combinedMessage || 'Continue',
            maneuver_type: this.mapTomTomManeuverType(instruction.instructionType || instruction.maneuver || 'STRAIGHT'),
            distance_meters: instruction.routeOffsetInMeters || instruction.distance || 0,
            travel_time_seconds: instruction.travelTimeInSeconds || instruction.time || 0,
            street_name: instruction.street || instruction.roadNumbers?.join(', ') || instruction.road || '',
            location: instruction.point ? [instruction.point.latitude, instruction.point.longitude] : null,
            
            // Additional details for better navigation
            turn_angle_degrees: instruction.turnAngleInDegrees,
            exit_number: instruction.exitNumber,
            roundabout_exit_number: instruction.roundaboutExitNumber,
            combined_instruction: instruction.combinedMessage || instruction.message,
            driving_side: instruction.drivingSide,
            lane_info: instruction.lanes ? this.extractLaneInfo(instruction.lanes) : null
          };

          steps.push(step);
        });
      }
      
      // Fallback: Create steps from sections if no instructions
      if (steps.length === 0 && route.sections && Array.isArray(route.sections)) {
        route.sections.forEach((section, sectionIndex) => {
          const step = {
            index: sectionIndex,
            instruction: section.drivingSide === 'LEFT' ? 'Continue on left side' : 'Continue on route',
            maneuver_type: 'straight',
            distance_meters: section.lengthInMeters || 0,
            travel_time_seconds: section.travelTimeInSeconds || 0,
            street_name: section.street || '',
            location: section.startPoint ? [section.startPoint.latitude, section.startPoint.longitude] : null
          };
          steps.push(step);
        });
      }
      
      // Last resort: Create a single step from route summary
      if (steps.length === 0) {
        steps.push({
          index: 0,
          instruction: 'Follow the route to your destination',
          maneuver_type: 'straight',
          distance_meters: summary.lengthInMeters || 0,
          travel_time_seconds: summary.travelTimeInSeconds || 0,
          street_name: '',
          location: coordinates.length > 0 ? coordinates[0] : null
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

    // Sort routes by duration (fastest first)
    routes.sort((a, b) => {
      const durationA = a.estimated_duration_minutes || Infinity;
      const durationB = b.estimated_duration_minutes || Infinity;
      return durationA - durationB;
    });

    return {
      routes: routes,
      recommended_route: routes[0], // First route is now the fastest by ETA
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
   * Transform HERE Routing v8 response to our internal route format
   */
  transformHereRoute(hereData) {
    if (!hereData || !hereData.routes || hereData.routes.length === 0) {
      return null;
    }

    const routes = hereData.routes.map((route, index) => {
      const sections = Array.isArray(route.sections) ? route.sections : [];
      if (sections.length === 0) {
        return null;
      }

      const allCoordinates = [];
      const steps = [];

      // Aggregate distance/duration across sections
      let totalLengthMeters = 0;
      let totalDurationSeconds = 0;

      // Try to get polyline from route level first (HERE v8 sometimes puts it here)
      if (route.polyline && typeof route.polyline === 'string') {
        try {
          const decoded = hereRoutingService.decodePolyline(route.polyline);
          if (Array.isArray(decoded) && decoded.length > 0) {
            decoded.forEach((coord) => {
              const [lat, lon] = Array.isArray(coord) ? coord : [coord.lat, coord.lon ?? coord.lng];
              if (
                typeof lat === 'number' &&
                typeof lon === 'number' &&
                !isNaN(lat) &&
                !isNaN(lon) &&
                lat >= -90 &&
                lat <= 90 &&
                lon >= -180 &&
                lon <= 180
              ) {
                allCoordinates.push([lat, lon]);
              }
            });
          }
        } catch (e) {
          // Silently continue if decoding fails
        }
      }

      // Also check sections for polylines (HERE v8 can put it in either place)
      sections.forEach((section, sectionIndex) => {
        // Decode geometry - HERE v8 returns polyline in section.polyline
        if (section.polyline && typeof section.polyline === 'string') {
          try {
            const decoded = hereRoutingService.decodePolyline(section.polyline);
            if (Array.isArray(decoded) && decoded.length > 0) {
              decoded.forEach((coord) => {
                const [lat, lon] = Array.isArray(coord) ? coord : [coord.lat, coord.lon ?? coord.lng];
                if (
                  typeof lat === 'number' &&
                  typeof lon === 'number' &&
                  !isNaN(lat) &&
                  !isNaN(lon) &&
                  lat >= -90 &&
                  lat <= 90 &&
                  lon >= -180 &&
                  lon <= 180
                ) {
                  // Avoid duplicates if route.polyline was already decoded
                  const isDuplicate = allCoordinates.some(
                    ([existingLat, existingLon]) =>
                      Math.abs(existingLat - lat) < 0.00001 && Math.abs(existingLon - lon) < 0.00001
                  );
                  if (!isDuplicate) {
                    allCoordinates.push([lat, lon]);
                  }
                }
              });
            }
          } catch (e) {
            // Silently continue if decoding fails
          }
        }
        
        // Fallback: Try to extract from section geometry if polyline is missing
        if (allCoordinates.length === 0 && section.geometry) {
          if (Array.isArray(section.geometry)) {
            section.geometry.forEach((point) => {
              const lat = point.lat ?? point.latitude;
              const lon = point.lon ?? point.longitude ?? point.lng;
              if (
                typeof lat === 'number' &&
                typeof lon === 'number' &&
                !isNaN(lat) &&
                !isNaN(lon) &&
                lat >= -90 &&
                lat <= 90 &&
                lon >= -180 &&
                lon <= 180
              ) {
                allCoordinates.push([lat, lon]);
              }
            });
          }
        }

        // Summary metrics
        const length = section.summary?.length || 0;
        const duration = section.summary?.duration || 0;
        totalLengthMeters += length;
        totalDurationSeconds += duration;
      });

      if (allCoordinates.length < 2) {
        return null;
      }

      // Build steps from actions, mapping offsets to coordinates as best effort
      let coordinateIndexOffset = 0;
      sections.forEach((section) => {
        const sectionCoordsCount = allCoordinates.length;
        const actions = Array.isArray(section.actions) ? section.actions : [];
        actions.forEach((action, stepIndex) => {
          const globalIndex =
            coordinateIndexOffset +
            Math.min(
              typeof action.offset === 'number' ? action.offset : 0,
              sectionCoordsCount - 1
            );
          const loc =
            allCoordinates[globalIndex] ||
            allCoordinates[allCoordinates.length - 1];

          steps.push({
            index: steps.length,
            instruction: action.instruction || action.action || 'Continue',
            maneuver_type: this.mapHereManeuverType(action.action),
            distance_meters: action.length || 0,
            travel_time_seconds: action.duration || 0,
            street_name: action.street || '',
            location: loc
          });
        });

        coordinateIndexOffset += sectionCoordsCount;
      });

      if (steps.length === 0) {
        // Fallback single step if HERE did not return actions
        steps.push({
          index: 0,
          instruction: 'Follow the route to your destination',
          maneuver_type: 'straight',
          distance_meters: totalLengthMeters,
          travel_time_seconds: totalDurationSeconds,
          street_name: '',
          location: allCoordinates[0]
        });
      }

      return {
        route_id: `here_${Date.now()}_${index}`,
        route_name: index === 0 ? 'Fastest Route' : `Alternative ${index}`,
        route_type: index === 0 ? 'fastest' : 'alternative',
        route_quality: index === 0 ? 'primary' : 'alternative',

        distance_km: totalLengthMeters / 1000,
        estimated_duration_minutes: totalDurationSeconds / 60,

        route_coordinates: allCoordinates,
        steps,

        traffic_conditions: 'moderate',
        has_tolls: false,
        has_highways: false,
        has_ferries: false,

        confidence_level: 'high',
        data_source: 'here',
        real_time_traffic: true,

        bounds: this.calculateBounds(allCoordinates)
      };
    }).filter(route => route !== null);

    if (routes.length === 0) {
      return null;
    }

    // Sort by ETA so first is fastest
    routes.sort((a, b) => {
      const durationA = a.estimated_duration_minutes || Infinity;
      const durationB = b.estimated_duration_minutes || Infinity;
      return durationA - durationB;
    });

    return {
      routes,
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
   * Map HERE Routing maneuver action types to our internal maneuver types
   */
  mapHereManeuverType(hereAction) {
    const action = (hereAction || '').toLowerCase();
    const map = {
      depart: 'depart',
      arrive: 'arrive',
      'turn-left': 'turn-left',
      'turn-right': 'turn-right',
      'keep-left': 'keep-left',
      'keep-right': 'keep-right',
      'u-turn': 'uturn',
      'enter-roundabout': 'roundabout-enter',
      'leave-roundabout': 'roundabout-exit',
      straight: 'straight',
      continue: 'straight',
      merge: 'merge',
      exit: 'exit'
    };

    // HERE actions are often like "turn", "keepLeft", "keepRight", "uTurn"
    if (!map[action]) {
      if (action.includes('left')) return 'turn-left';
      if (action.includes('right')) return 'turn-right';
      if (action.includes('uturn') || action.includes('u-turn')) return 'uturn';
      if (action.includes('roundabout')) return 'roundabout-enter';
      if (action.includes('exit')) return 'exit';
    }

    return map[action] || 'straight';
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

