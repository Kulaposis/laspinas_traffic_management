/**
 * Weather-Aware Routing Service
 * Integrates weather conditions into route planning
 */

import weatherService from './weatherService';
import enhancedRoutingService from './enhancedRoutingService';

class WeatherAwareRoutingService {
  constructor() {
    this.weatherCache = new Map();
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes
    this.floodProneAreas = this.getFloodProneAreasLasPinas();
  }

  /**
   * Get flood-prone areas in Las Piñas
   */
  getFloodProneAreasLasPinas() {
    return [
      // Major flood-prone areas in Las Piñas
      { name: 'CAA Road', lat: 14.4504, lng: 121.0170, radius: 0.5 },
      { name: 'Alabang-Zapote Road', lat: 14.4380, lng: 121.0250, radius: 0.8 },
      { name: 'Real Street', lat: 14.4450, lng: 121.0120, radius: 0.6 },
      { name: 'Talon Area', lat: 14.4850, lng: 121.0050, radius: 0.7 },
      { name: 'Pamplona Area', lat: 14.4300, lng: 121.0100, radius: 0.5 },
      { name: 'BF Homes Area', lat: 14.4600, lng: 121.0350, radius: 0.6 }
    ];
  }

  /**
   * Get weather-aware route
   */
  async getWeatherAwareRoute(originLat, originLng, destLat, destLng, options = {}) {
    try {
      // Get weather conditions
      const weather = await this.getWeatherForRoute(originLat, originLng, destLat, destLng);

      // Check for severe weather
      const weatherWarnings = this.analyzeWeatherConditions(weather);

      // Get standard routes
      const routeData = await enhancedRoutingService.getDetailedRoute(
        originLat,
        originLng,
        destLat,
        destLng,
        {
          ...options,
          maxAlternatives: 3
        }
      );

      if (!routeData || !routeData.routes) {
        throw new Error('Failed to get routes');
      }

      // Analyze each route for weather hazards
      const analyzedRoutes = await Promise.all(
        routeData.routes.map(route => this.analyzeRouteWeatherHazards(route, weather))
      );

      // Sort routes by weather safety score
      analyzedRoutes.sort((a, b) => b.weatherSafetyScore - a.weatherSafetyScore);

      return {
        routes: analyzedRoutes,
        weather,
        weatherWarnings,
        recommended_route: analyzedRoutes[0]
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get weather for route
   */
  async getWeatherForRoute(originLat, originLng, destLat, destLng) {
    try {
      // Get weather at origin, destination, and midpoint
      const midLat = (originLat + destLat) / 2;
      const midLng = (originLng + destLng) / 2;

      const [originWeather, destWeather, midWeather] = await Promise.all([
        this.getCachedWeather(originLat, originLng),
        this.getCachedWeather(destLat, destLng),
        this.getCachedWeather(midLat, midLng)
      ]);

      return {
        origin: originWeather,
        destination: destWeather,
        midpoint: midWeather,
        overall: this.aggregateWeather([originWeather, destWeather, midWeather])
      };
    } catch (error) {

      return null;
    }
  }

  /**
   * Get cached weather data
   */
  async getCachedWeather(lat, lng) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cached = this.weatherCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }

    try {
      const weather = await weatherService.getCurrentWeather(lat, lng);
      this.weatherCache.set(key, {
        data: weather,
        timestamp: Date.now()
      });
      return weather;
    } catch (error) {

      return null;
    }
  }

  /**
   * Aggregate weather data
   */
  aggregateWeather(weatherData) {
    const validData = weatherData.filter(w => w !== null);
    
    if (validData.length === 0) {
      return null;
    }

    // Get worst conditions
    const conditions = validData.map(w => w.condition).filter(Boolean);
    const hasRain = conditions.some(c => 
      c.toLowerCase().includes('rain') || 
      c.toLowerCase().includes('storm') ||
      c.toLowerCase().includes('drizzle')
    );

    const hasFog = conditions.some(c => 
      c.toLowerCase().includes('fog') || 
      c.toLowerCase().includes('mist')
    );

    return {
      condition: hasRain ? 'Rain' : (hasFog ? 'Fog' : validData[0].condition),
      temperature: validData.reduce((sum, w) => sum + (w.temperature || 0), 0) / validData.length,
      humidity: validData.reduce((sum, w) => sum + (w.humidity || 0), 0) / validData.length,
      hasRain,
      hasFog
    };
  }

  /**
   * Analyze weather conditions for warnings
   */
  analyzeWeatherConditions(weather) {
    const warnings = [];

    if (!weather || !weather.overall) {
      return warnings;
    }

    const { overall } = weather;

    // Heavy rain warning
    if (overall.hasRain) {
      warnings.push({
        type: 'heavy_rain',
        severity: 'high',
        message: 'Heavy rain detected. Expect flooding in low-lying areas.',
        icon: '🌧️'
      });
    }

    // Fog warning
    if (overall.hasFog) {
      warnings.push({
        type: 'fog',
        severity: 'medium',
        message: 'Foggy conditions. Reduced visibility expected.',
        icon: '🌫️'
      });
    }

    // High humidity (potential rain)
    if (overall.humidity > 85) {
      warnings.push({
        type: 'high_humidity',
        severity: 'low',
        message: 'High humidity. Rain may occur.',
        icon: '💧'
      });
    }

    return warnings;
  }

  /**
   * Analyze route for weather hazards
   */
  async analyzeRouteWeatherHazards(route, weather) {
    try {
      let weatherSafetyScore = 100;
      const hazards = [];

      // Check if route passes through flood-prone areas
      if (weather?.overall?.hasRain) {
        const floodHazards = this.checkFloodProneAreas(route.route_coordinates);
        
        if (floodHazards.length > 0) {
          weatherSafetyScore -= 30;
          hazards.push({
            type: 'flood_risk',
            severity: 'high',
            message: `Route passes through ${floodHazards.length} flood-prone area(s)`,
            locations: floodHazards
          });
        }
      }

      // Adjust for rain
      if (weather?.overall?.hasRain) {
        weatherSafetyScore -= 15;
        hazards.push({
          type: 'rain',
          severity: 'medium',
          message: 'Rainy conditions may cause delays'
        });
      }

      // Adjust for fog
      if (weather?.overall?.hasFog) {
        weatherSafetyScore -= 10;
        hazards.push({
          type: 'fog',
          severity: 'medium',
          message: 'Foggy conditions may reduce visibility'
        });
      }

      // Adjust estimated duration for weather
      let adjustedDuration = route.estimated_duration_minutes;
      if (weather?.overall?.hasRain) {
        adjustedDuration *= 1.3; // 30% longer in rain
      } else if (weather?.overall?.hasFog) {
        adjustedDuration *= 1.15; // 15% longer in fog
      }

      return {
        ...route,
        weatherSafetyScore: Math.max(0, weatherSafetyScore),
        weatherHazards: hazards,
        weatherAdjustedDuration: adjustedDuration,
        weatherSafe: weatherSafetyScore >= 70
      };
    } catch (error) {

      return {
        ...route,
        weatherSafetyScore: 50,
        weatherHazards: [],
        weatherAdjustedDuration: route.estimated_duration_minutes,
        weatherSafe: true
      };
    }
  }

  /**
   * Check if route passes through flood-prone areas
   */
  checkFloodProneAreas(routeCoordinates) {
    const floodHazards = [];

    // Sample points along route
    const samplePoints = routeCoordinates.filter((_, index) =>
      index % Math.max(1, Math.floor(routeCoordinates.length / 20)) === 0
    );

    for (const area of this.floodProneAreas) {
      for (const [lat, lng] of samplePoints) {
        const distance = this.calculateDistance(lat, lng, area.lat, area.lng);
        
        if (distance <= area.radius) {
          floodHazards.push({
            name: area.name,
            location: { lat, lng },
            distance: distance.toFixed(2)
          });
          break; // Only count each area once
        }
      }
    }

    return floodHazards;
  }

  /**
   * Get weather-based route recommendation
   */
  getWeatherRecommendation(analyzedRoutes) {
    if (!analyzedRoutes || analyzedRoutes.length === 0) {
      return null;
    }

    const safestRoute = analyzedRoutes[0];

    if (safestRoute.weatherSafetyScore >= 80) {
      return {
        type: 'safe',
        message: 'Weather conditions are favorable for travel',
        icon: '✅'
      };
    } else if (safestRoute.weatherSafetyScore >= 60) {
      return {
        type: 'caution',
        message: 'Exercise caution due to weather conditions',
        icon: '⚠️'
      };
    } else {
      return {
        type: 'warning',
        message: 'Consider delaying travel due to severe weather',
        icon: '🚨'
      };
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
}

export default new WeatherAwareRoutingService();
