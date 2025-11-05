/**
 * Multi-Stop Routing Service
 * Handles route planning with multiple waypoints
 */

import enhancedRoutingService from './enhancedRoutingService';

class MultiStopRoutingService {
  constructor() {
    this.maxWaypoints = 10;
  }

  /**
   * Calculate route with multiple stops
   */
  async calculateMultiStopRoute(stops, options = {}) {
    try {
      if (!stops || stops.length < 2) {
        throw new Error('At least 2 stops are required');
      }

      if (stops.length > this.maxWaypoints + 2) {
        throw new Error(`Maximum ${this.maxWaypoints + 2} stops allowed`);
      }

      // Validate all stops have coordinates
      for (const stop of stops) {
        if (!stop.lat || !stop.lng) {
          throw new Error('All stops must have valid coordinates');
        }
      }

      const {
        optimize = false, // Optimize stop order
        travelMode = 'car',
        avoidTolls = false,
        avoidHighways = false
      } = options;

      // If optimize is true, reorder stops for shortest route
      let orderedStops = stops;
      if (optimize && stops.length > 2) {
        orderedStops = await this.optimizeStopOrder(stops);
      }

      // Calculate route segments between consecutive stops
      const segments = [];
      let totalDistance = 0;
      let totalDuration = 0;
      let allCoordinates = [];

      for (let i = 0; i < orderedStops.length - 1; i++) {
        const origin = orderedStops[i];
        const destination = orderedStops[i + 1];

        const segmentRoute = await enhancedRoutingService.getDetailedRoute(
          origin.lat,
          origin.lng,
          destination.lat,
          destination.lng,
          {
            travelMode,
            avoidTolls,
            avoidHighways,
            maxAlternatives: 1
          }
        );

        if (!segmentRoute || !segmentRoute.routes || segmentRoute.routes.length === 0) {
          throw new Error(`Failed to calculate route segment ${i + 1}`);
        }

        const segment = segmentRoute.routes[0];
        segments.push({
          from: origin,
          to: destination,
          distance_km: segment.distance_km,
          duration_minutes: segment.estimated_duration_minutes,
          route_coordinates: segment.route_coordinates,
          steps: segment.steps
        });

        totalDistance += segment.distance_km;
        totalDuration += segment.estimated_duration_minutes;
        allCoordinates = allCoordinates.concat(segment.route_coordinates);
      }

      // Calculate bounds for the entire route
      const bounds = this.calculateBounds(allCoordinates);

      return {
        stops: orderedStops,
        segments,
        totalDistance_km: totalDistance,
        totalDuration_minutes: totalDuration,
        route_coordinates: allCoordinates,
        bounds,
        optimized: optimize,
        stopCount: orderedStops.length
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Optimize stop order using nearest neighbor algorithm
   */
  async optimizeStopOrder(stops) {
    try {
      if (stops.length <= 2) {
        return stops;
      }

      // Keep first and last stops fixed
      const start = stops[0];
      const end = stops[stops.length - 1];
      const waypoints = stops.slice(1, -1);

      if (waypoints.length === 0) {
        return stops;
      }

      // Use nearest neighbor algorithm
      const optimized = [start];
      const remaining = [...waypoints];
      let current = start;

      while (remaining.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = this.calculateDistance(
          current.lat,
          current.lng,
          remaining[0].lat,
          remaining[0].lng
        );

        for (let i = 1; i < remaining.length; i++) {
          const distance = this.calculateDistance(
            current.lat,
            current.lng,
            remaining[i].lat,
            remaining[i].lng
          );

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        const nearest = remaining.splice(nearestIndex, 1)[0];
        optimized.push(nearest);
        current = nearest;
      }

      optimized.push(end);

      return optimized;
    } catch (error) {

      return stops; // Return original order on error
    }
  }

  /**
   * Add a waypoint to existing route
   */
  async addWaypoint(currentStops, newWaypoint, insertIndex = null) {
    try {
      const stops = [...currentStops];

      if (insertIndex !== null && insertIndex >= 0 && insertIndex <= stops.length) {
        stops.splice(insertIndex, 0, newWaypoint);
      } else {
        // Insert before last stop (destination)
        stops.splice(stops.length - 1, 0, newWaypoint);
      }

      return stops;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Remove a waypoint from route
   */
  removeWaypoint(stops, index) {
    try {
      if (index < 1 || index >= stops.length - 1) {
        throw new Error('Cannot remove origin or destination');
      }

      const newStops = [...stops];
      newStops.splice(index, 1);

      return newStops;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Reorder waypoints
   */
  reorderWaypoints(stops, fromIndex, toIndex) {
    try {
      // Don't allow reordering origin (0) or destination (last)
      if (fromIndex === 0 || fromIndex === stops.length - 1 ||
          toIndex === 0 || toIndex === stops.length - 1) {
        throw new Error('Cannot reorder origin or destination');
      }

      const newStops = [...stops];
      const [removed] = newStops.splice(fromIndex, 1);
      newStops.splice(toIndex, 0, removed);

      return newStops;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate bounds for coordinates
   */
  calculateBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) {
      return null;
    }

    let minLat = coordinates[0][0];
    let maxLat = coordinates[0][0];
    let minLng = coordinates[0][1];
    let maxLng = coordinates[0][1];

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
   * Get route summary
   */
  getRouteSummary(multiStopRoute) {
    if (!multiStopRoute) return null;

    return {
      totalStops: multiStopRoute.stopCount,
      totalDistance: `${multiStopRoute.totalDistance_km.toFixed(1)} km`,
      totalDuration: this.formatDuration(multiStopRoute.totalDuration_minutes),
      segments: multiStopRoute.segments.length,
      optimized: multiStopRoute.optimized
    };
  }

  /**
   * Format duration
   */
  formatDuration(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);

    if (mins === 0) {
      return `${hours} hr`;
    }

    return `${hours} hr ${mins} min`;
  }

  /**
   * Estimate fuel cost for multi-stop route
   */
  estimateFuelCost(totalDistanceKm, fuelPricePerLiter = 60, fuelEfficiencyKmPerLiter = 12) {
    const litersNeeded = totalDistanceKm / fuelEfficiencyKmPerLiter;
    const cost = litersNeeded * fuelPricePerLiter;
    return {
      liters: litersNeeded.toFixed(2),
      cost: cost.toFixed(2),
      currency: 'PHP'
    };
  }
}

export default new MultiStopRoutingService();
