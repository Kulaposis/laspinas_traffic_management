import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import tomtomConfig from '../config/tomtom.js';

/**
 * TrafficFlowLayer - Displays real-time traffic flow on the map
 * Updates every 10 minutes to avoid overwhelming the server
 */
const TrafficFlowLayer = ({ enabled = true }) => {
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
    const createTrafficLayer = () => {
      // Get API key from tomtom config
      const apiKey = tomtomConfig.apiKey;
      
      // TomTom Traffic Flow Tiles with adjusted brightness
      const layer = L.tileLayer(
        `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${apiKey}&thickness=7`,
        {
          attribution: '© TomTom Traffic',
          maxZoom: 18,
          minZoom: 8,
          opacity: 0.6, // Increased from 0.4 to 0.6 for more visibility
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

    // Set up 10-minute refresh interval
    intervalRef.current = setInterval(() => {
      if (enabled) {
        addTrafficLayer();
      }
    }, 10 * 60 * 1000); // 10 minutes

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
