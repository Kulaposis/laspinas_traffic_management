import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import { Polyline } from 'react-leaflet';
import L from 'leaflet';
import trafficService from '../services/trafficService';

/**
 * TrafficFlowHeatmap - Displays traffic flow as colored polylines along roads
 * Creates a more realistic traffic visualization that follows road geometry
 */
const TrafficFlowHeatmap = ({ enabled = true, mapCenter, mapBounds }) => {
  const map = useMap();
  const [trafficSegments, setTrafficSegments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef(null);

  // Get traffic color based on status - Bright and vibrant colors
  const getTrafficColor = (status, intensity = 0.5) => {
    if (typeof status === 'string') {
      status = status.toLowerCase();
    }

    // Map status to bright, vibrant colors
    if (status === 'free_flow' || status === 'freeflow' || intensity < 0.3) {
      return '#00ff41'; // Bright green - free flow
    } else if (status === 'light' || intensity < 0.5) {
      return '#ffeb3b'; // Bright yellow - light traffic
    } else if (status === 'moderate' || intensity < 0.7) {
      return '#ff9800'; // Bright orange - moderate traffic
    } else if (status === 'heavy' || intensity < 0.9) {
      return '#ff5722'; // Bright deep orange - heavy traffic
    } else {
      return '#ff1744'; // Bright red - standstill/severe
    }
  };

  // Get traffic weight (thickness) based on road type and traffic
  const getTrafficWeight = (roadType, intensity) => {
    const baseWeight = roadType === 'highway' || roadType === 'major' ? 7 : 5; // Increased base thickness
    // Increase weight slightly for heavy traffic to make it more visible
    return intensity > 0.7 ? baseWeight + 2 : baseWeight; // Increased for heavy traffic
  };

  // Fetch traffic data and create road segments
  const loadTrafficFlowData = async () => {
    if (!enabled || !mapCenter) return;

    setIsLoading(true);
    try {
      // Get map bounds
      const bounds = mapBounds || map.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      // Fetch traffic data from API
      let trafficData = [];
      try {
        // Try to fetch heatmap data from API first
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/traffic/monitoring/heatmap?` +
          `lat_min=${sw.lat}&lat_max=${ne.lat}&lng_min=${sw.lng}&lng_max=${ne.lng}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.heatmap_data && Array.isArray(data.heatmap_data)) {
            trafficData = data.heatmap_data;
          }
        }
        
        // If no API data, try traffic service
        if (trafficData.length === 0) {
          try {
            const incidents = await trafficService.getNearbyIncidents(
              { lat: mapCenter[0], lng: mapCenter[1] },
              50
            );
            trafficData = Array.isArray(incidents) ? incidents : [];
          } catch (serviceError) {

          }
        }
      } catch (error) {

      }

      // Generate road segments with traffic flow
      let segments = [];
      if (trafficData.length > 0 && trafficData[0] && (trafficData[0].lat !== undefined || trafficData[0].latitude !== undefined)) {
        // Has actual traffic data points
        segments = generateRoadSegments(trafficData, mapCenter, bounds);
      } else {
        // Use mock data that follows major roads
        segments = generateMockTrafficSegments(mapCenter, bounds);
      }
      setTrafficSegments(segments);
    } catch (error) {

      // Fallback to mock data
      const bounds = mapBounds || map.getBounds();
      const segments = generateMockTrafficSegments(mapCenter, bounds);
      setTrafficSegments(segments);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate mock traffic segments that follow major roads
  const generateMockTrafficSegments = (center, bounds) => {
    const segments = [];
    const centerLat = center[0] || 14.4504;
    const centerLng = center[1] || 121.0170;

    // Define major road segments in Las Piñas area - relative to center
    const majorRoads = [
      // Alabang-Zapote Road (main artery) - NE-SW diagonal
      {
        name: 'Alabang-Zapote Road',
        coordinates: [
          [centerLat - 0.015, centerLng - 0.022], // Start near Alabang
          [centerLat - 0.010, centerLng - 0.017],
          [centerLat - 0.005, centerLng - 0.012],
          [centerLat, centerLng - 0.007], // Las Piñas center
          [centerLat + 0.005, centerLng - 0.002],
          [centerLat + 0.010, centerLng + 0.003], // Zapote area
        ],
        intensity: 0.75, // Heavy traffic
        status: 'heavy'
      },
      // Alabang-Las Piñas Road - N-S
      {
        name: 'Alabang-Las Piñas Road',
        coordinates: [
          [centerLat - 0.030, centerLng - 0.017],
          [centerLat - 0.020, centerLng - 0.012],
          [centerLat - 0.010, centerLng - 0.007],
          [centerLat, centerLng - 0.002],
        ],
        intensity: 0.65,
        status: 'moderate'
      },
      // Coastal Road - NW-SE
      {
        name: 'Coastal Road',
        coordinates: [
          [centerLat - 0.020, centerLng - 0.027],
          [centerLat - 0.010, centerLng - 0.022],
          [centerLat, centerLng - 0.017],
          [centerLat + 0.010, centerLng - 0.012],
        ],
        intensity: 0.55,
        status: 'moderate'
      },
      // Quirino Avenue - E-W
      {
        name: 'Quirino Avenue',
        coordinates: [
          [centerLat - 0.005, centerLng - 0.007],
          [centerLat, centerLng - 0.002],
          [centerLat + 0.005, centerLng + 0.003],
          [centerLat + 0.010, centerLng + 0.008],
        ],
        intensity: 0.85,
        status: 'heavy'
      },
      // Las Piñas-Bacoor Road - NE
      {
        name: 'Las Piñas-Bacoor Road',
        coordinates: [
          [centerLat, centerLng - 0.007],
          [centerLat + 0.010, centerLng - 0.002],
          [centerLat + 0.020, centerLng + 0.003],
        ],
        intensity: 0.45,
        status: 'light'
      },
      // Manuyo Road - N-S
      {
        name: 'Manuyo Road',
        coordinates: [
          [centerLat - 0.010, centerLng - 0.012],
          [centerLat - 0.005, centerLng - 0.007],
          [centerLat, centerLng - 0.002],
        ],
        intensity: 0.70,
        status: 'moderate'
      },
      // Talon Road - Diagonal
      {
        name: 'Talon Road',
        coordinates: [
          [centerLat - 0.015, centerLng - 0.017],
          [centerLat - 0.010, centerLng - 0.012],
          [centerLat - 0.005, centerLng - 0.007],
        ],
        intensity: 0.80,
        status: 'heavy'
      },
      // Molino Road - NW-SE
      {
        name: 'Molino Road',
        coordinates: [
          [centerLat - 0.025, centerLng - 0.012],
          [centerLat - 0.020, centerLng - 0.007],
          [centerLat - 0.015, centerLng - 0.002],
        ],
        intensity: 0.60,
        status: 'moderate'
      },
      // BF International Road - E-W
      {
        name: 'BF International Road',
        coordinates: [
          [centerLat - 0.008, centerLng + 0.003],
          [centerLat - 0.003, centerLng + 0.008],
          [centerLat + 0.002, centerLng + 0.013],
        ],
        intensity: 0.50,
        status: 'light'
      },
      // Alabang-Zapote Road Extension - N-S
      {
        name: 'Alabang-Zapote Extension',
        coordinates: [
          [centerLat + 0.005, centerLng - 0.012],
          [centerLat + 0.010, centerLng - 0.007],
          [centerLat + 0.015, centerLng - 0.002],
        ],
        intensity: 0.65,
        status: 'moderate'
      }
    ];

    // Generate segments from major roads
    majorRoads.forEach((road, index) => {
      // Add some variation to make it more realistic
      const variation = (Math.random() - 0.5) * 0.1;
      const finalIntensity = Math.max(0.2, Math.min(1.0, road.intensity + variation));

      // Create segments every 2-3 points for smoother visualization
      for (let i = 0; i < road.coordinates.length - 1; i++) {
        segments.push({
          id: `${road.name}-${i}`,
          coordinates: [road.coordinates[i], road.coordinates[i + 1]],
          intensity: finalIntensity,
          status: road.status,
          roadName: road.name,
          roadType: 'major'
        });
      }
    });

    // Add some minor roads for completeness - relative to center
    const minorRoads = [
      [[centerLat - 0.005, centerLng - 0.009], [centerLat - 0.004, centerLng - 0.005], [centerLat - 0.003, centerLng - 0.001]],
      [[centerLat - 0.012, centerLng - 0.013], [centerLat - 0.008, centerLng - 0.009], [centerLat - 0.004, centerLng - 0.005]],
      [[centerLat + 0.002, centerLng - 0.005], [centerLat + 0.003, centerLng - 0.001], [centerLat + 0.004, centerLng + 0.003]],
      [[centerLat - 0.003, centerLng + 0.005], [centerLat, centerLng + 0.008], [centerLat + 0.003, centerLng + 0.011]],
      [[centerLat + 0.008, centerLng - 0.003], [centerLat + 0.010, centerLng], [centerLat + 0.012, centerLng + 0.003]],
    ];

    minorRoads.forEach((road, index) => {
      for (let i = 0; i < road.length - 1; i++) {
        segments.push({
          id: `minor-${index}-${i}`,
          coordinates: [road[i], road[i + 1]],
          intensity: 0.3 + Math.random() * 0.3, // Light to moderate
          status: 'light',
          roadName: `Minor Road ${index + 1}`,
          roadType: 'minor'
        });
      }
    });

    return segments;
  };

  // Generate road segments from traffic data
  const generateRoadSegments = (trafficData, center, bounds) => {
    const segments = [];
    
    // Group traffic points by road name to create segments
    const roadsMap = new Map();
    
    trafficData.forEach((point, index) => {
      const roadName = point.road_name || point.roadName || 'Unknown Road';
      if (!roadsMap.has(roadName)) {
        roadsMap.set(roadName, []);
      }
      
      const lat = point.latitude || point.lat || point.location?.lat;
      const lng = point.longitude || point.lng || point.location?.lng;
      
      if (typeof lat === 'number' && typeof lng === 'number') {
        roadsMap.get(roadName).push({
          lat,
          lng,
          intensity: point.intensity || (point.congestion_percentage || 0) / 100,
          status: point.status || point.traffic_status || 'moderate'
        });
      }
    });

    // Create segments from grouped points
    roadsMap.forEach((points, roadName) => {
      if (points.length < 2) return;

      // Sort points to create a logical road path (simple nearest neighbor)
      const sortedPoints = [points[0]];
      const remaining = [...points.slice(1)];

      while (remaining.length > 0) {
        const lastPoint = sortedPoints[sortedPoints.length - 1];
        let nearestIdx = 0;
        let nearestDist = Infinity;

        remaining.forEach((point, idx) => {
          const dist = Math.sqrt(
            Math.pow(point.lat - lastPoint.lat, 2) +
            Math.pow(point.lng - lastPoint.lng, 2)
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = idx;
          }
        });

        sortedPoints.push(remaining[nearestIdx]);
        remaining.splice(nearestIdx, 1);
      }

      // Create segments
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const p1 = sortedPoints[i];
        const p2 = sortedPoints[i + 1];
        
        // Average intensity for the segment
        const avgIntensity = (p1.intensity + p2.intensity) / 2;
        const avgStatus = p1.status || p2.status || 'moderate';

        segments.push({
          id: `${roadName}-${i}`,
          coordinates: [[p1.lat, p1.lng], [p2.lat, p2.lng]],
          intensity: avgIntensity,
          status: avgStatus,
          roadName: roadName,
          roadType: roadName.includes('Highway') || roadName.includes('Avenue') ? 'major' : 'minor'
        });
      }
    });

    return segments;
  };

  // Load data on mount and when dependencies change
  useEffect(() => {
    if (!enabled) {
      setTrafficSegments([]);
      return;
    }

    loadTrafficFlowData();

    // Set up refresh interval (every 2 minutes)
    intervalRef.current = setInterval(() => {
      if (enabled) {
        loadTrafficFlowData();
      }
    }, 120000); // 2 minutes

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, mapCenter, mapBounds]);

  // Update when map bounds change
  useEffect(() => {
    if (!enabled || !map) return;

    const handleMoveEnd = () => {
      const newBounds = map.getBounds();
      loadTrafficFlowData();
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [enabled, map]);

  if (!enabled || trafficSegments.length === 0) {
    return null;
  }

  return (
    <>
      {trafficSegments.map((segment) => {
        const color = getTrafficColor(segment.status, segment.intensity);
        const weight = getTrafficWeight(segment.roadType, segment.intensity);
        const opacity = Math.min(1.0, 0.75 + (segment.intensity * 0.25)); // 0.75 to 1.0 opacity - brighter and more visible

        return (
          <Polyline
            key={segment.id}
            positions={segment.coordinates}
            pathOptions={{
              color: color,
              weight: weight,
              opacity: opacity,
              lineCap: 'round',
              lineJoin: 'round',
              className: 'traffic-flow-line',
              interactive: false,
              smoothFactor: 1.0
            }}
          />
        );
      })}
    </>
  );
};

export default TrafficFlowHeatmap;

