import React from 'react';
import { Marker, Popup, Polygon, Circle } from 'react-leaflet';
import { createNoParkingIcon } from '../../utils/mapIcons';

/**
 * Parking Layer Component
 * Displays no-parking zones and restricted parking areas
 */
const ParkingLayer = ({ noParkingZones = [], enabled = false }) => {
  if (!enabled || !Array.isArray(noParkingZones) || noParkingZones.length === 0) {
    return null;
  }

  return (
    <>
      {noParkingZones.map((zone, idx) => {
        // Handle point-based zones (latitude, longitude, radius) - e.g., bus stops
        if (typeof zone?.latitude === 'number' && typeof zone?.longitude === 'number') {
          const center = [zone.latitude, zone.longitude];
          const radiusMeters = zone?.radius || zone?.radius_meters || 15;
          
          return (
            <React.Fragment key={`npz-${zone.id || idx}`}>
              <Circle 
                center={center} 
                radius={radiusMeters}
                pathOptions={{ color: '#dc2626', weight: 3, fillOpacity: 0.25, fillColor: '#dc2626' }}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">No-Parking Zone</h3>
                    {zone?.name && <p className="text-xs text-gray-600">{zone.name}</p>}
                    {zone?.description && <p className="text-xs text-gray-500 mt-1">{zone.description}</p>}
                    {zone?.zone_type && <p className="text-xs text-gray-500 mt-1">Type: {zone.zone_type.replace('_', ' ')}</p>}
                    {zone?.restriction_reason && <p className="text-xs text-gray-500 mt-1">Reason: {zone.restriction_reason}</p>}
                    <p className="text-xs text-gray-500 mt-1">Radius: {radiusMeters}m</p>
                  </div>
                </Popup>
              </Circle>
              <Marker 
                position={center} 
                icon={createNoParkingIcon(zone?.zone_type)}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-sm">🚫 No-Parking Zone</h3>
                    {zone?.name && <p className="text-xs text-gray-600">{zone.name}</p>}
                    {zone?.description && <p className="text-xs text-gray-500 mt-1">{zone.description}</p>}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        }
        
        // Handle polygon/polyline zones
        const toLatLng = (value) => {
          if (!value) return [];
          if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
            return [[value[0], value[1]]];
          }
          if (typeof value === 'object' && (value.lat || value.latitude) && (value.lng || value.longitude)) {
            const lat = value.lat ?? value.latitude;
            const lng = value.lng ?? value.longitude;
            return [[lat, lng]];
          }
          if (Array.isArray(value) && Array.isArray(value[0]) && Array.isArray(value[0][0])) {
            const ring = Array.isArray(value[0][0][0]) ? value[0][0] : value[0];
            return ring.map(([lng, lat]) => [lat, lng]);
          }
          if (Array.isArray(value)) {
            return value.flatMap(v => toLatLng(v));
          }
          return [];
        };

        const raw = zone?.coordinates || zone?.polygon || zone?.points || zone?.geometry?.coordinates;
        if (!raw) return null;
        
        const latlngs = toLatLng(raw).filter(([la, ln]) => typeof la === 'number' && typeof ln === 'number');
        if (latlngs.length === 0) return null;

        const centroid = latlngs.reduce((acc, [la, ln]) => [acc[0] + la, acc[1] + ln], [0, 0]).map(v => v / latlngs.length);
        
        return (
          <React.Fragment key={`npz-poly-${zone.id || idx}`}>
            <Polygon positions={latlngs} pathOptions={{ color: '#dc2626', weight: 3, fillOpacity: 0.25, fillColor: '#dc2626' }}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">No-Parking / Restricted</h3>
                  {zone?.name && <p className="text-xs text-gray-600">{zone.name}</p>}
                  {(zone?.restriction_reason || zone?.reason) && <p className="text-xs text-gray-500 mt-1">Reason: {zone.restriction_reason || zone.reason}</p>}
                </div>
              </Popup>
            </Polygon>
            <Marker 
              position={centroid} 
              icon={createNoParkingIcon(zone?.zone_type)}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">🚫 No-Parking / Restricted Zone</h3>
                  {zone?.name && <p className="text-xs text-gray-600">{zone.name}</p>}
                  {(zone?.restriction_reason || zone?.reason) && <p className="text-xs text-gray-500 mt-1">Reason: {zone.restriction_reason || zone.reason}</p>}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default ParkingLayer;



