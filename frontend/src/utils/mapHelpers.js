/**
 * Map Helper Functions
 * Utility functions for map-related operations
 */

// Format coordinates for display
export const formatCoords = (lat, lng) => {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
  return 'Unknown';
};

// Get trip place name with fallbacks
export const getTripPlaceName = (trip, which = 'origin') => {
  try {
    const isOrigin = which === 'origin';
    const nameField = isOrigin ? trip?.origin_name : trip?.destination_name;
    
    // Skip "Current Location" and coordinates pattern
    const isGenericName = (name) => {
      if (!name) return true;
      const str = String(name).trim();
      return str === '' || 
             str === 'Current Location' || 
             str.startsWith('Location (') ||
             str.startsWith('Coordinates:') ||
             /^\d+\.\d+,\s*\d+\.\d+$/.test(str); // matches coordinate pattern
    };
    
    if (nameField && !isGenericName(nameField)) {
      return nameField;
    }

    const obj = isOrigin ? trip?.origin : trip?.destination;
    if (obj?.name && !isGenericName(obj.name)) {
      return obj.name;
    }

    // Try to get address if available
    if (obj?.address) {
      if (obj.address.freeformAddress && !isGenericName(obj.address.freeformAddress)) {
        return obj.address.freeformAddress;
      }
      if (obj.address.municipality) {
        const city = obj.address.municipality;
        const street = obj.address.streetName || obj.address.streetNumber;
        return street ? `${street}, ${city}` : city;
      }
      if (obj.address.full && !isGenericName(obj.address.full)) {
        return obj.address.full;
      }
      // Build address from components
      const parts = [];
      if (obj.address.streetName) parts.push(obj.address.streetName);
      if (obj.address.localName) parts.push(obj.address.localName);
      if (obj.address.countrySubdivision) parts.push(obj.address.countrySubdivision);
      if (parts.length > 0) return parts.join(', ');
    }

    // If we still don't have a name, return a generic location label
    return isOrigin ? 'Starting Point' : 'Destination';
  } catch {
    return 'Unknown Location';
  }
};



