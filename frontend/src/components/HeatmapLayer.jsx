import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const HeatmapLayer = ({ points, options = {} }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  useEffect(() => {
    if (!points || points.length === 0) {
      // Remove existing layer if no points
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Remove existing layer before creating new one
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Get current zoom level for responsive settings
    const zoom = map.getZoom();

    // Adjust heatmap settings based on zoom level
    const getResponsiveOptions = (zoom) => {
      if (zoom >= 16) {
        // Very close zoom - reduce intensity and radius to avoid clutter
        return {
          radius: Math.max(8, (options.radius || 25) * 0.4),
          blur: Math.max(15, (options.blur || 20) * 0.8),
          max: (options.max || 0.5) * 0.5,
          minOpacity: Math.max(0.05, (options.minOpacity || 0.1) * 0.4)
        };
      } else if (zoom >= 14) {
        // Close zoom - moderate settings
        return {
          radius: Math.max(12, (options.radius || 25) * 0.6),
          blur: Math.max(18, (options.blur || 20) * 0.9),
          max: (options.max || 0.5) * 0.6,
          minOpacity: (options.minOpacity || 0.1) * 0.5
        };
      } else if (zoom >= 12) {
        // Medium zoom - balanced settings
        return {
          radius: Math.max(15, (options.radius || 25) * 0.8),
          blur: Math.max(20, (options.blur || 20)),
          max: (options.max || 0.5) * 0.7,
          minOpacity: (options.minOpacity || 0.1) * 0.6
        };
      } else {
        // Far zoom - full intensity for overview
        return {
          radius: options.radius || 25,
          blur: options.blur || 20,
          max: options.max || 0.5,
          minOpacity: options.minOpacity || 0.1
        };
      }
    };

    const responsiveOptions = getResponsiveOptions(zoom);

    // Filter points based on zoom level to reduce clutter at high zoom
    let filteredPoints = points;
    if (zoom >= 16) {
      // At very close zoom, show fewer points to avoid extreme clutter
      filteredPoints = points.filter((_, index) => index % 4 === 0); // Show every 4th point
    } else if (zoom >= 14) {
      // At close zoom, show moderate number of points
      filteredPoints = points.filter((_, index) => index % 2 === 0); // Show every 2nd point
    }

    // Create heatmap layer with responsive settings
    const heatLayer = L.heatLayer(filteredPoints, {
      radius: responsiveOptions.radius,
      blur: responsiveOptions.blur,
      maxZoom: options.maxZoom || 18,
      max: responsiveOptions.max,
      minOpacity: responsiveOptions.minOpacity,
      gradient: options.gradient || {
        0.0: '#0066ff',    // Blue for low traffic
        0.3: '#00ff00',    // Green for light traffic
        0.5: '#ffff00',    // Yellow for moderate traffic
        0.7: '#ff9900',    // Orange for heavy traffic
        1.0: '#ff0000'     // Red for extreme traffic
      },
      ...options
    });

    // Add to map
    heatLayer.addTo(map);
    heatLayerRef.current = heatLayer;

    // Listen for zoom changes to update the layer
    const handleZoomChange = () => {
      const newZoom = map.getZoom();
      if (newZoom !== currentZoom) {
        setCurrentZoom(newZoom);
      }
    };

    map.on('zoomend', handleZoomChange);

    // Cleanup function
    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      map.off('zoomend', handleZoomChange);
    };
  }, [map, points, options, currentZoom]);

  return null;
};

export default HeatmapLayer;
