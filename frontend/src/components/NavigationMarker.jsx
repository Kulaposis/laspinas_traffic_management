import React from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * NavigationMarker - Realistic navigation marker with direction arrow
 * Similar to Google Maps/Waze navigation puck
 */
const NavigationMarker = ({ position, heading = 0, isNavigating = false }) => {
  const map = useMap();

  // Create custom navigation icon with arrow pointing in heading direction
  const createNavigationIcon = () => {
    const svgIcon = `
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <!-- Outer glow/pulse ring -->
        <circle cx="24" cy="24" r="20" fill="#2563eb" opacity="0.2" class="pulse-ring"/>
        
        <!-- Main circle background -->
        <circle cx="24" cy="24" r="14" fill="white" filter="url(#shadow)"/>
        
        <!-- Inner blue circle -->
        <circle cx="24" cy="24" r="12" fill="#2563eb"/>
        
        <!-- Direction arrow (pointing up, will rotate with heading) -->
        <g transform="rotate(${heading} 24 24)">
          <path d="M 24 10 L 28 20 L 24 18 L 20 20 Z" fill="white" stroke="white" stroke-width="1"/>
          <path d="M 24 18 L 24 28" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </g>
        
        <!-- Accuracy indicator ring -->
        <circle cx="24" cy="24" r="13" fill="none" stroke="white" stroke-width="1.5" opacity="0.5"/>
      </svg>
    `;

    return L.divIcon({
      html: svgIcon,
      className: 'navigation-marker',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  };

  // Rotate map to follow heading when navigating
  React.useEffect(() => {
    if (isNavigating && map) {
      try {
        // Smooth rotation animation
        const currentBearing = map.getBearing ? map.getBearing() : 0;
        const targetBearing = -heading; // Negative because map rotates opposite to marker
        
        // Only rotate if difference is significant (more than 5 degrees)
        if (Math.abs(targetBearing - currentBearing) > 5) {
          if (map.setBearing) {
            map.setBearing(targetBearing);
          }
        }
      } catch (error) {
        // Leaflet doesn't support rotation by default, we'll handle this differently
        console.log('Map rotation not supported in standard Leaflet');
      }
    }
  }, [heading, isNavigating, map]);

  return (
    <Marker
      position={position}
      icon={createNavigationIcon()}
      zIndexOffset={1000}
    />
  );
};

export default NavigationMarker;

