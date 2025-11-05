import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { createCustomIcon } from '../../utils/mapIcons';

/**
 * Traffic Monitoring Layer Component
 * Displays traffic incidents and roadworks from the monitoring system
 */
const TrafficMonitoringLayer = ({ incidents = [], roadworks = [], enabled = false }) => {
  if (!enabled) return null;

  return (
    <>
      {/* Traffic Incidents */}
      {Array.isArray(incidents) && incidents.map((it, idx) => {
        const lat = it?.location?.lat || it?.latitude;
        const lng = it?.location?.lng || it?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <Marker key={`tmi-${it.id || idx}`} position={[lat, lng]} icon={createCustomIcon('#ef4444', 'incident')}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{it.title || 'Traffic Incident'}</h3>
                {it.description && <p className="text-xs text-gray-600 mt-1">{it.description}</p>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Roadworks */}
      {Array.isArray(roadworks) && roadworks.map((rw, idx) => {
        const lat = rw.latitude || rw.lat || (rw.location && rw.location.lat);
        const lng = rw.longitude || rw.lng || (rw.location && rw.location.lng);
        const radius = rw.impact_radius_meters || 250;
        
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <React.Fragment key={`tmr-${rw.id || idx}`}>
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12 }}
            />
            <Marker
              position={[lat, lng]}
              icon={createCustomIcon('#f59e0b', 'roadwork')}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">{rw.title || 'Roadwork'}</h3>
                  {rw.description && <p className="text-xs text-gray-600 mt-1">{rw.description}</p>}
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default TrafficMonitoringLayer;



