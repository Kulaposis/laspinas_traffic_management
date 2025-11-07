import React from 'react';
import { Marker, Popup, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { createCustomIcon, createNavigationIcon } from '../../utils/mapIcons';
import incidentReportingService from '../../services/incidentReportingService';

/**
 * Map Markers Component
 * Renders all markers on the map (origin, destination, user location, incidents, etc.)
 */
const MapMarkers = ({
  selectedOrigin,
  selectedDestination,
  userLocation,
  simulatedLocation,
  isSimulating,
  navigationIcon,
  userHeading,
  nearbyIncidents = [],
  emergencyEnabled,
  highlightedIncident,
  user,
  simulationProgress,
  simulationSpeed,
  gyroscopeEnabled
}) => {
  // Create incident icon
  const createIncidentIcon = (type) => {
    const incidentTypes = incidentReportingService.getIncidentTypes();
    const incidentType = incidentTypes.find(t => t.id === type) || incidentTypes[incidentTypes.length - 1];
    
    return L.divIcon({
      className: 'custom-incident-marker',
      html: `
        <div style="
          background-color: ${incidentType.color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">
          ${incidentType.icon}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  return (
    <>
      {/* Temporary highlight when selecting from Insights */}
      {highlightedIncident && (
        <>
          <Circle
            center={[highlightedIncident.lat, highlightedIncident.lng]}
            radius={120}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 }}
          />
          <Marker position={[highlightedIncident.lat, highlightedIncident.lng]} icon={createCustomIcon('#3b82f6', 'pin')}>
            <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
              <div className="text-xs font-semibold text-gray-900">
                {highlightedIncident.title || 'Selected incident'}
              </div>
            </Tooltip>
          </Marker>
        </>
      )}

      {/* Origin Marker */}
      {selectedOrigin && (
        <Marker
          position={[selectedOrigin.lat, selectedOrigin.lng]}
          icon={createCustomIcon('#4285f4', 'pin')}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm">Origin</h3>
              <p className="text-xs text-gray-600">{selectedOrigin.name}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Destination Marker */}
      {selectedDestination && (
        <Marker
          position={[selectedDestination.lat, selectedDestination.lng]}
          icon={createCustomIcon('#ea4335', 'pin')}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm">Destination</h3>
              <p className="text-xs text-gray-600">{selectedDestination.name}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* User Location Marker */}
      {userLocation && !isSimulating && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={createNavigationIcon(navigationIcon, userHeading)}
          rotationAngle={userHeading}
          rotationOrigin="center"
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm">Your Location</h3>
              <p className="text-xs text-gray-600">
                Accuracy: ±{Math.round(userLocation.accuracy)}m
              </p>
              <p className="text-xs text-gray-500">
                {new Date(userLocation.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Simulated Location Marker */}
      {simulatedLocation && isSimulating && (
        <Marker
          position={[simulatedLocation.lat, simulatedLocation.lng]}
          icon={createNavigationIcon(navigationIcon, userHeading)}
          rotationAngle={userHeading}
          rotationOrigin="center"
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm">🚗 Simulated Position</h3>
              <p className="text-xs text-gray-600">
                Progress: {Math.round(simulationProgress || 0)}%
              </p>
              {simulationSpeed && (
                <p className="text-xs text-gray-500">
                  Speed: {simulationSpeed}x
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {/* Incident Markers */}
      {emergencyEnabled && nearbyIncidents.map((incident) => (
        <Marker
          key={incident.id}
          position={[incident.location.lat, incident.location.lng]}
          icon={createIncidentIcon(incident.type)}
        >
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold text-sm capitalize">{incident.type.replace('_', ' ')}</h3>
              <p className="text-xs text-gray-600 mt-1">{incident.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {incident.distance ? `${incident.distance.toFixed(1)} km away` : ''}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                <button 
                  onClick={() => incidentReportingService.upvoteIncident(incident.id, user?.uid)}
                  className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  👍 {incident.upvotes || 0}
                </button>
                <button 
                  onClick={() => incidentReportingService.downvoteIncident(incident.id, user?.uid)}
                  className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  👎 {incident.downvotes || 0}
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
};

export default MapMarkers;

