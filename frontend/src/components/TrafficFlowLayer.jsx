import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import tomtomConfig from '../config/tomtom.js';

/**
 * TrafficFlowLayer - Displays real-time traffic flow on the map
 * DISABLED by default to save API calls - each tile request counts as an API call
 * Only enable if you have sufficient API quota
 */
const TrafficFlowLayer = ({ enabled = false }) => {
  const map = useMap();
  const layerRef = React.useRef(null);
  const intervalRef = React.useRef(null);

  useEffect(() => {
    if (!map) return;

    // Remove layer if disabled
    if (!enabled) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;

      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Create TomTom Traffic Flow tile layer
    // WARNING: Each visible tile counts as an API call!
    // At zoom level 12, you can have 16+ tiles visible = 16+ API calls per refresh
    // This can quickly exhaust your API quota. Use sparingly!
    const createTrafficLayer = () => {
      // Get API key from tomtom config
      const apiKey = tomtomConfig.apiKey;
      
      // TomTom Traffic Flow Tiles with adjusted brightness
      // Each tile request counts as 1 API call
      const layer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${apiKey}&thickness=7`,
        {
          attribution: '© TomTom Traffic',
          maxZoom: 15, // Reduced from 18 to limit tile requests
          minZoom: 8,
          opacity: 0.6,
          zIndex: 500,
          className: 'traffic-flow-layer',
        }
      );

      return layer;
    };

    // Add traffic layer to map
    const addTrafficLayer = () => {
      // Remove old layer if exists
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }

      const newLayer = createTrafficLayer();
      newLayer.addTo(map);
      layerRef.current = newLayer;
      
    };

    // Initial load
    addTrafficLayer();

    // Set up 30-minute refresh interval (increased to reduce API calls)
    // WARNING: Each refresh reloads all visible tiles = multiple API calls
    intervalRef.current = setInterval(() => {
      if (enabled) {
        addTrafficLayer();
      }
    }, 30 * 60 * 1000); // 30 minutes (increased from 10 to reduce API usage)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, enabled]);

  return null; // This component doesn't render anything visible
};

export default TrafficFlowLayer;
