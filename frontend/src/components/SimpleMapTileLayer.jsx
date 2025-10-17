import React from 'react';
import { TileLayer } from 'react-leaflet';

/**
 * Simple Map Tile Layer Component
 * A fallback component that always uses OpenStreetMap
 * Use this if TomTom integration causes issues
 */
const SimpleMapTileLayer = ({ 
  opacity = 1, 
  zIndex = 1,
  ...props 
}) => {
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      subdomains={['a', 'b', 'c']}
      opacity={opacity}
      zIndex={zIndex}
      {...props}
    />
  );
};

export default SimpleMapTileLayer;
