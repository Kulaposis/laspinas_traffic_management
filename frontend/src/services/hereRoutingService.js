import { decode } from '@here/flexpolyline';

/**
 * Lightweight HERE Routing wrapper for web (REST) usage.
 * Used by enhancedRoutingService to get traffic-aware routes with maneuvers.
 */
class HereRoutingService {
  /**
   * Calculate a route between origin and destination.
   * @param {{lat:number,lng:number}} origin
   * @param {{lat:number,lng:number}} destination
   * @param {{maxAlternatives?:number, transportMode?:string, avoidTolls?:boolean}} options
   */
  async calculateRoute(origin, destination, options = {}) {
    const apiKey =
      import.meta.env.VITE_HERE_API_KEY ||
      import.meta.env.VITE_HERE_APIKEY ||
      import.meta.env.VITE_HERE_ROUTING_KEY;

    if (!apiKey) {
      const errorMsg = 'HERE Routing API key is not configured. Please add VITE_HERE_API_KEY to your .env file.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    const baseUrl = 'https://router.hereapi.com/v8/routes';
    const searchParams = new URLSearchParams({
      transportMode: options.transportMode || 'car',
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      // Request geometry + summary + detailed maneuvers
      return: 'polyline,summary,actions,instructions,travelSummary',
      alternatives: String(options.maxAlternatives ?? 2),
      lang: 'en-US'
    });

    if (options.avoidTolls) {
      // Avoid toll roads when requested
      searchParams.append('avoid[features]', 'tollRoad');
    }

    const url = `${baseUrl}?${searchParams.toString()}&apiKey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const errorMsg = `HERE Routing error ${res.status}: ${text || res.statusText}`;
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
    
    const data = await res.json();
    return data;
  }

  /**
   * Decode HERE flexible polyline string to [lat,lng] array.
   * Uses official @here/flexpolyline decoder.
   */
  decodePolyline(encoded) {
    if (!encoded || typeof encoded !== 'string') {
      return [];
    }
    
    try {
      const result = decode(encoded);
      
      // decode() returns an object with a polyline property containing the coordinates
      // Structure: { precision: 5, thirdDim: 0, thirdDimPrecision: 0, polyline: [[lat, lon], ...] }
      if (result && typeof result === 'object' && result !== null) {
        // Check if it has a polyline property (the actual format from @here/flexpolyline)
        if (Array.isArray(result.polyline)) {
          return result.polyline.map((coord) => {
            // Handle [lat, lon] tuples
            if (Array.isArray(coord) && coord.length >= 2) {
              return [coord[0], coord[1]];
            }
            // Handle object format {lat, lon}
            if (typeof coord === 'object' && coord !== null) {
              const lat = coord.lat ?? coord.latitude;
              const lon = coord.lon ?? coord.longitude ?? coord.lng;
              if (typeof lat === 'number' && typeof lon === 'number') {
                return [lat, lon];
              }
            }
            return null;
          }).filter(c => c !== null);
        }
        
        // Fallback: if result is directly an array (shouldn't happen with @here/flexpolyline, but handle it)
        if (Array.isArray(result) && result.length > 0) {
          // Check if it's an array of arrays (tuples) like [[lat, lon], [lat, lon]]
          if (Array.isArray(result[0])) {
            return result.map((coord) => {
              if (coord.length >= 2) {
                return [coord[0], coord[1]];
              }
              return null;
            }).filter(c => c !== null);
          }
          // Check if it's an array of objects like [{lat, lon}, {lat, lon}]
          if (typeof result[0] === 'object' && result[0] !== null) {
            return result.map((p) => {
              const lat = p.lat ?? p.latitude;
              const lon = p.lon ?? p.longitude ?? p.lng;
              if (typeof lat === 'number' && typeof lon === 'number') {
                return [lat, lon];
              }
              return null;
            }).filter(c => c !== null);
          }
        }
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }
}

export default new HereRoutingService();


