/**
 * Route Smoothing Service
 * Provides utilities for smoothing and enhancing route visualization
 */

class RouteSmoothingService {
  constructor() {
    this.smoothingFactor = 0.3;
  }

  /**
   * Smooth route coordinates using Bezier curve interpolation
   */
  smoothRouteCoordinates(coordinates, smoothingFactor = this.smoothingFactor) {
    if (!coordinates || coordinates.length < 3) {
      return coordinates;
    }

    const smoothed = [];
    
    // Always keep the first point
    smoothed.push(coordinates[0]);

    // Smooth intermediate points
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1];
      const current = coordinates[i];
      const next = coordinates[i + 1];

      // Calculate control points for smooth curves
      const smoothedPoint = this.calculateSmoothPoint(prev, current, next, smoothingFactor);
      smoothed.push(smoothedPoint);
    }

    // Always keep the last point
    smoothed.push(coordinates[coordinates.length - 1]);

    return smoothed;
  }

  /**
   * Calculate smooth point using weighted average
   */
  calculateSmoothPoint(prev, current, next, factor) {
    const lat = current[0] + factor * ((prev[0] + next[0]) / 2 - current[0]);
    const lng = current[1] + factor * ((prev[1] + next[1]) / 2 - current[1]);
    
    return [lat, lng];
  }

  /**
   * Add intermediate points between coordinates for smoother visualization
   */
  interpolateRoutePoints(coordinates, density = 3) {
    if (!coordinates || coordinates.length < 2) {
      return coordinates;
    }

    const interpolated = [];
    
    for (let i = 0; i < coordinates.length - 1; i++) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      
      // Add the start point
      interpolated.push(start);
      
      // Add intermediate points
      for (let j = 1; j < density; j++) {
        const ratio = j / density;
        const lat = start[0] + (end[0] - start[0]) * ratio;
        const lng = start[1] + (end[1] - start[1]) * ratio;
        interpolated.push([lat, lng]);
      }
    }
    
    // Add the final point
    interpolated.push(coordinates[coordinates.length - 1]);
    
    return interpolated;
  }

  /**
   * Remove redundant points that are too close together
   */
  simplifyRoute(coordinates, tolerance = 0.0001) {
    if (!coordinates || coordinates.length < 3) {
      return coordinates;
    }

    const simplified = [coordinates[0]];
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      const current = coordinates[i];
      
      const distance = this.calculateDistance(prev[0], prev[1], current[0], current[1]);
      
      // Only add point if it's far enough from the previous point
      if (distance > tolerance) {
        simplified.push(current);
      }
    }
    
    // Always keep the last point
    simplified.push(coordinates[coordinates.length - 1]);
    
    return simplified;
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Enhance route with turn-by-turn visualization points
   */
  addTurnIndicators(coordinates, route) {
    if (!route.steps || !Array.isArray(route.steps)) {
      return coordinates;
    }

    const enhanced = [...coordinates];
    const turnPoints = [];

    // Extract turn locations from route steps
    route.steps.forEach((step, index) => {
      if (step.location && Array.isArray(step.location) && step.location.length >= 2) {
        const maneuver = step.maneuver || {};
        const maneuverType = maneuver.type;

        // Add turn indicators for significant maneuvers
        if (['turn', 'ramp', 'merge', 'fork'].includes(maneuverType)) {
          turnPoints.push({
            coordinates: [step.location[1], step.location[0]], // Convert lng,lat to lat,lng
            type: maneuverType,
            instruction: step.instruction || `${maneuverType} maneuver`,
            index: index
          });
        }
      }
    });

    return {
      coordinates: enhanced,
      turnPoints: turnPoints
    };
  }

  /**
   * Apply Google Maps-like route styling
   */
  applyGoogleMapsStyle(route) {
    const styled = { ...route };

    // Enhance coordinates with smoothing and interpolation
    if (styled.route_coordinates && styled.route_coordinates.length > 0) {
      let coordinates = styled.route_coordinates;

      // Step 1: Simplify to remove redundant points
      coordinates = this.simplifyRoute(coordinates, 0.00005);

      // Step 2: Add intermediate points for smoother curves
      coordinates = this.interpolateRoutePoints(coordinates, 2);

      // Step 3: Apply smoothing
      coordinates = this.smoothRouteCoordinates(coordinates, 0.2);

      // Step 4: Add turn indicators if steps are available
      if (styled.steps) {
        const enhanced = this.addTurnIndicators(coordinates, styled);
        styled.route_coordinates = enhanced.coordinates;
        styled.turnPoints = enhanced.turnPoints;
      } else {
        styled.route_coordinates = coordinates;
        styled.turnPoints = [];
      }
    }

    // Add visual styling properties
    styled.visualStyle = {
      weight: styled.route_quality === 'primary' ? 6 : 4,
      opacity: 0.9,
      color: this.getRouteColor(styled),
      dashArray: styled.route_quality === 'alternative' ? '10, 5' : null,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1
    };

    return styled;
  }

  /**
   * Get appropriate color for route based on conditions
   */
  getRouteColor(route) {
    // Priority: traffic conditions > route type > default
    if (route.traffic_conditions) {
      const trafficColors = {
        'light': '#22c55e',      // Green
        'moderate': '#eab308',   // Yellow  
        'heavy': '#f97316',      // Orange
        'standstill': '#ef4444', // Red
      };
      
      if (trafficColors[route.traffic_conditions]) {
        return trafficColors[route.traffic_conditions];
      }
    }

    // Route type colors
    const typeColors = {
      'direct': '#3b82f6',     // Blue
      'alternative': '#f59e0b', // Amber
      'scenic': '#10b981',     // Emerald
      'fastest': '#ef4444',    // Red
      'shortest': '#8b5cf6',   // Violet
    };

    return typeColors[route.route_type] || '#6b7280'; // Default gray
  }

  /**
   * Create smooth animation between route changes
   */
  createRouteTransition(fromRoute, toRoute, duration = 1000) {
    if (!fromRoute || !toRoute) {
      return toRoute;
    }

    const steps = 30; // Number of animation steps
    const stepDuration = duration / steps;
    const transitions = [];

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const transitionRoute = this.interpolateRoutes(fromRoute, toRoute, progress);
      
      transitions.push({
        route: transitionRoute,
        delay: i * stepDuration
      });
    }

    return transitions;
  }

  /**
   * Interpolate between two routes for smooth transitions
   */
  interpolateRoutes(routeA, routeB, progress) {
    // Simple interpolation - in production you might want more sophisticated blending
    const coordsA = routeA.route_coordinates || [];
    const coordsB = routeB.route_coordinates || [];
    
    // Use the longer route as base and interpolate towards the shorter one
    const baseCoords = coordsA.length >= coordsB.length ? coordsA : coordsB;
    const targetCoords = coordsA.length >= coordsB.length ? coordsB : coordsA;
    const isReversed = coordsA.length < coordsB.length;
    
    const interpolated = baseCoords.map((coord, index) => {
      const targetIndex = Math.min(index, targetCoords.length - 1);
      const targetCoord = targetCoords[targetIndex];
      
      if (!targetCoord) return coord;
      
      const actualProgress = isReversed ? 1 - progress : progress;
      
      return [
        coord[0] + (targetCoord[0] - coord[0]) * actualProgress,
        coord[1] + (targetCoord[1] - coord[1]) * actualProgress
      ];
    });

    return {
      ...routeB,
      route_coordinates: interpolated
    };
  }

  /**
   * Optimize route coordinates for performance
   */
  optimizeForPerformance(coordinates, maxPoints = 200) {
    if (!coordinates || coordinates.length <= maxPoints) {
      return coordinates;
    }

    // Use Douglas-Peucker algorithm for intelligent point reduction
    return this.douglasPeucker(coordinates, 0.00008); // ~9 meters tolerance
  }

  /**
   * Douglas-Peucker line simplification algorithm
   */
  douglasPeucker(points, tolerance) {
    if (points.length <= 2) {
      return points;
    }

    // Find the point with maximum distance from the line segment
    let maxDistance = 0;
    let maxIndex = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(
        points[i], points[0], points[points.length - 1]
      );
      
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const leftPart = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
      const rightPart = this.douglasPeucker(points.slice(maxIndex), tolerance);
      
      // Combine results (remove duplicate point at junction)
      return leftPart.slice(0, -1).concat(rightPart);
    } else {
      // All points are close to the line, return just the endpoints
      return [points[0], points[points.length - 1]];
    }
  }

  /**
   * Calculate perpendicular distance from point to line segment
   */
  perpendicularDistance(point, lineStart, lineEnd) {
    const [x, y] = point;
    const [x1, y1] = lineStart;
    const [x2, y2] = lineEnd;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // Line segment is actually a point
      return Math.sqrt(A * A + B * B);
    }

    const param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export default new RouteSmoothingService();
