import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { createWeatherIcon } from '../../utils/mapIcons';

/**
 * Weather Layer Component
 * Displays weather alerts and warnings on the map
 */
const WeatherLayer = ({ weatherAlerts = [], enabled = false }) => {
  if (!enabled || !Array.isArray(weatherAlerts) || weatherAlerts.length === 0) {
    return null;
  }

  return (
    <>
      {weatherAlerts.map((alert, idx) => {
        const lat = alert?.latitude || alert?.lat || alert?.location?.lat;
        const lng = alert?.longitude || alert?.lng || alert?.location?.lng;
        
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <Marker key={`wx-${alert.id || idx}`} position={[lat, lng]} icon={createWeatherIcon('#3b82f6')}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{alert?.title || 'Weather Alert'}</h3>
                {alert?.severity && (
                  <p className="text-xs text-gray-600">Severity: {alert.severity}</p>
                )}
                {alert?.description && (
                  <p className="text-xs text-gray-500 mt-1">{alert.description}</p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default WeatherLayer;



