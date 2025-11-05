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
  
  // Esri World Imagery (satellite) fallback when TomTom satellite is unavailable
  const esriWorldImageryUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const handleTileError = (error) => {

    setUseTomTom(false);
    setAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    
    if (onError) {
      onError(error);
    }
  };

  // Always use Esri for satellite to guarantee imagery
  if (style === 'satellite') {
    return (
      <TileLayer
        url={esriWorldImageryUrl}
        attribution={'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'}
        opacity={opacity}
        zIndex={zIndex}
        {...props}
      />
    );
  }

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

  // Fallback to OpenStreetMap for non-satellite styles
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
