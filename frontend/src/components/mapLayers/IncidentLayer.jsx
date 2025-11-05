import React from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { createCustomIcon } from '../../utils/mapIcons';
import incidentReportingService from '../../services/incidentReportingService';
import incidentProneService from '../../services/incidentProneService';
import L from 'leaflet';

/**
 * Incident Layer Component
 * Displays incidents, incident-prone areas, and related markers
 */
const IncidentLayer = ({ 
  incidents = [], 
  incidentProneAreas = [],
  enabled = false,
  user = null
}) => {
  if (!enabled) return null;

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
      {/* Incidents */}
      {Array.isArray(incidents) && incidents.map((incident) => {
        const lat = incident?.location?.lat || incident?.latitude;
        const lng = incident?.location?.lng || incident?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        return (
          <Marker
            key={incident.id}
            position={[lat, lng]}
            icon={createIncidentIcon(incident.type)}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm capitalize">{incident.type?.replace('_', ' ')}</h3>
                <p className="text-xs text-gray-600 mt-1">{incident.description}</p>
                {incident.distance && (
                  <p className="text-xs text-gray-500 mt-1">
                    {incident.distance.toFixed(1)} km away
                  </p>
                )}
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
        );
      })}

      {/* Incident Prone Areas */}
      {Array.isArray(incidentProneAreas) && incidentProneAreas.map((area, idx) => {
        const lat = area?.latitude || area?.lat;
        const lng = area?.longitude || area?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        const color = incidentProneService.getAreaTypeColor(area.area_type);
        const radius = area?.radius_meters || 500;
        
        return (
          <React.Fragment key={`ipa-${area.id || idx}`}>
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}
            />
            <Marker position={[lat, lng]} icon={createCustomIcon(color, 'incident-prone')}>
              <Popup>
                <div className="p-2">
                  <h3 className="font-semibold text-sm">{incidentProneService.getAreaTypeLabel(area.area_type)}</h3>
                  {area.barangay && <p className="text-xs text-gray-600">{area.barangay}</p>}
                  {area.risk_score && (
                    <p className="text-xs mt-1" style={{ color: incidentProneService.getRiskScoreColor(area.risk_score) }}>
                      Risk Score: {area.risk_score}
                    </p>
                  )}
                  {area.incident_count && (
                    <p className="text-xs text-gray-500 mt-1">{area.incident_count} incidents reported</p>
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

export default IncidentLayer;



