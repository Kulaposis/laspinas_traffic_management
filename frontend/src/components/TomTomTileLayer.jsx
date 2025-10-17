import React, { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import tomtomService from '../services/tomtomService';

/**
 * TomTom Tile Layer Component
 * Provides TomTom map tiles with fallback to OpenStreetMap
 */
const TomTomTileLayer = ({ 
  style = 'main', 
  opacity = 1, 
  zIndex = 1,
  onError = null,
  ...props 
}) => {
  const [useTomTom, setUseTomTom] = useState(true);
  const [attribution, setAttribution] = useState('');

  useEffect(() => {
    // Check if we can use TomTom
    const canUseTomTom = tomtomService.canMakeRequest() && tomtomService.apiKey;
    setUseTomTom(canUseTomTom);
    
    if (canUseTomTom) {
      setAttribution(tomtomService.getMapAttribution());
    } else {
      setAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    }
  }, [style]);

  // TomTom tile URL template string
  const tomtomUrlTemplate = tomtomService.apiKey ? tomtomService.getMapTileUrlTemplate(style) : null;

  // OpenStreetMap fallback URL template
  const osmUrlTemplate = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const handleTileError = (error) => {
    console.warn('TomTom tile error, falling back to OpenStreetMap:', error);
    setUseTomTom(false);
    setAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    
    if (onError) {
      onError(error);
    }
  };

  if (useTomTom && tomtomUrlTemplate) {
    return (
      <TileLayer
        url={tomtomUrlTemplate}
        attribution={attribution}
        opacity={opacity}
        zIndex={zIndex}
        errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        onError={handleTileError}
        {...props}
      />
    );
  }

  // Fallback to OpenStreetMap
  return (
    <TileLayer
      url={osmUrlTemplate}
      attribution={attribution}
      opacity={opacity}
      zIndex={zIndex}
      subdomains={['a', 'b', 'c']}
      {...props}
    />
  );
};

export default TomTomTileLayer;
