import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { createFloodIcon, createActiveFloodIcon } from '../../utils/mapIcons';
import weatherService from '../../services/weatherService';

/**
 * Flood Layer Component
 * Displays flood-prone areas, critical flood areas, and active floods
 */
const FloodLayer = ({ 
  floodProneAreas = [], 
  criticalFloodAreas = [], 
  activeFloods = [],
  enabled = false 
}) => {
  if (!enabled) return null;

  return (
    <>
      {/* Flood Prone Areas */}
      {floodProneAreas.map((area, idx) => {
        const lat = area?.latitude || area?.lat || (area?.location && area.location.lat);
        const lng = area?.longitude || area?.lng || (area?.location && area.location.lng);
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <React.Fragment key={`flood-prone-${area.id || area.barangay_name || idx}`}>
            <Circle
              center={[lat, lng]}
              radius={area.radius_meters || 1000}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2, dashArray: '10, 5' }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">Flood Prone Area</h3>
                  {area.barangay_name && <p className="text-xs text-gray-600">{area.barangay_name}</p>}
                  {area.flood_level && <p className="text-xs text-gray-500 mt-1">Level: {area.flood_level}</p>}
                </div>
              </Popup>
            </Circle>
            <Marker position={[lat, lng]} icon={createFloodIcon('#3b82f6')}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">💧 Flood Prone Area</h3>
                  {area.barangay_name && <p className="text-xs text-gray-600">{area.barangay_name}</p>}
                  {area.flood_level && <p className="text-xs text-gray-500 mt-1">Level: {area.flood_level}</p>}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}

      {/* Critical Flood Areas */}
      {criticalFloodAreas.map((area, idx) => {
        const lat = area?.latitude || area?.lat || (area?.location && area.location.lat);
        const lng = area?.longitude || area?.lng || (area?.location && area.location.lng);
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <React.Fragment key={`critical-flood-${area.id || idx}`}>
            <Circle
              center={[lat, lng]}
              radius={area.radius_meters || 800}
              pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.2, weight: 3 }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm text-red-600">⚠️ Critical Flood Area</h3>
                  {area.barangay_name && <p className="text-xs text-gray-600">{area.barangay_name}</p>}
                  {area.severity && <p className="text-xs text-red-600 mt-1">Severity: {area.severity}</p>}
                </div>
              </Popup>
            </Circle>
            <Marker position={[lat, lng]} icon={createActiveFloodIcon('#dc2626')}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm text-red-600">🌊 Critical Flood Area</h3>
                  {area.barangay_name && <p className="text-xs text-gray-600">{area.barangay_name}</p>}
                  {area.severity && <p className="text-xs text-red-600 mt-1">Severity: {area.severity}</p>}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}

      {/* Active Floods */}
      {activeFloods.map((flood, idx) => {
        const lat = flood?.latitude || flood?.lat || (flood?.location && flood.location.lat);
        const lng = flood?.longitude || flood?.lng || (flood?.location && flood.location.lng);
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        const level = flood?.flood_level || 'normal';
        const color = weatherService.getFloodLevelColor(level);
        
        return (
          <React.Fragment key={`active-flood-${flood.id || idx}`}>
            <Circle
              center={[lat, lng]}
              radius={flood.radius_meters || 500}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 3 }}
            />
            <Marker position={[lat, lng]} icon={createActiveFloodIcon(color)}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">🌊 Active Flood</h3>
                  <p className="text-xs text-gray-600 mt-1">Level: {level}</p>
                  {flood.depth_cm && <p className="text-xs text-gray-500">Depth: {flood.depth_cm}cm</p>}
                  {flood.reported_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      Reported: {new Date(flood.reported_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default FloodLayer;



