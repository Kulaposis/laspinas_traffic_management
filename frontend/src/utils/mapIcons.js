import L from 'leaflet';

/**
 * Map Icon Utilities
 * Creates custom Leaflet icons for different marker types
 */

// Weather Icon (Cloud)
export const createWeatherIcon = (color = '#3b82f6') => {
  return L.divIcon({
    className: 'weather-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="white" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Flood Icon (Droplets/Water)
export const createFloodIcon = (color = '#3b82f6') => {
  return L.divIcon({
    className: 'flood-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" fill="white"/>
          <path d="M8 12h8M8 16h8" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

// Active Flood Icon (Water Waves)
export const createActiveFloodIcon = (color = '#dc2626') => {
  return L.divIcon({
    className: 'active-flood-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 12px rgba(220, 38, 38, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2" fill="white" opacity="0.4"/>
          <path d="M3 16c0 3.314 2.686 6 6 6s6-2.686 6-6" fill="white" opacity="0.6"/>
          <path d="M4 20c0 1.657 1.343 3 3 3s3-1.343 3-3" fill="white"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// Navigation icons for different travel modes
export const createNavigationIcon = (iconType = 'car', heading = 0) => {
  const iconSize = 40;
  const icons = {
    car: '🚗',
    bike: '🚴',
    walk: '🚶',
    motorcycle: '🏍️',
    bus: '🚌',
    truck: '🚚',
    default: '📍'
  };

  const iconEmoji = icons[iconType] || icons.default;
  
  return L.divIcon({
    className: 'navigation-marker',
    html: `
      <div style="
        background-color: #4285f4;
        width: ${iconSize}px;
        height: ${iconSize}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transform: rotate(${heading}deg);
        transition: transform 0.3s ease;
      ">
        ${iconEmoji}
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    popupAnchor: [0, -iconSize / 2]
  });
};

// Custom icons for different marker types
export const createCustomIcon = (color, iconType = 'pin', heading = 0) => {
  const iconOptions = {
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  };

  if (iconType === 'navigation') {
    // Use default car icon for backward compatibility
    return createNavigationIcon('car', heading);
  }

  // Use specialized icons for weather and flood
  if (iconType === 'weather') {
    return createWeatherIcon(color);
  }
  
  if (iconType === 'flood') {
    return createFloodIcon(color);
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${iconOptions.iconSize[0]}px;
        height: ${iconOptions.iconSize[1]}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
      ">
        📍
      </div>
    `,
    ...iconOptions
  });
};

// No-Parking Zone Icon
export const createNoParkingIcon = (zoneType = 'restricted') => {
  const iconSize = [36, 36];
  const iconColor = '#dc2626'; // red-600
  const iconEmoji = zoneType === 'bus_stop' ? '🚫' : '🚫';
  
  return L.divIcon({
    className: 'no-parking-marker',
    html: `
      <div style="
        background-color: ${iconColor};
        width: ${iconSize[0]}px;
        height: ${iconSize[1]}px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(220, 38, 38, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 20px;
        font-weight: bold;
        position: relative;
      ">
        ${iconEmoji}
      </div>
    `,
    iconSize: iconSize,
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};



