import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { createCustomIcon } from '../../utils/mapIcons';
import emergencyService from '../../services/emergencyService';

/**
 * Emergency Layer Component
 * Displays emergency reports and alerts
 */
const EmergencyLayer = ({ emergencies = [], enabled = false }) => {
  if (!enabled || !Array.isArray(emergencies) || emergencies.length === 0) {
    return null;
  }

  return (
    <>
      {emergencies.map((emergency, idx) => {
        const lat = emergency?.latitude || emergency?.lat || (emergency?.location && emergency.location.lat);
        const lng = emergency?.longitude || emergency?.lng || (emergency?.location && emergency.location.lng);
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        const icon = emergencyService.getEmergencyIcon(emergency.emergency_type);
        const severityColorName = emergencyService.getEmergencyColor(emergency.severity || 'medium');
        const severityColorHex = severityColorName === 'red' || severityColorName === 'critical' ? '#ef4444' :
                               severityColorName === 'orange' || severityColorName === 'high' ? '#f59e0b' :
                               severityColorName === 'yellow' || severityColorName === 'medium' ? '#eab308' :
                               '#10b981'; // green/low
        const statusColorMap = { reported: '#3b82f6', dispatched: '#eab308', in_progress: '#f59e0b', resolved: '#10b981', cancelled: '#6b7280' };
        const statusColor = statusColorMap[emergency.status] || '#6b7280';
        
        return (
          <Marker key={`emergency-${emergency.id || idx}`} position={[lat, lng]} icon={createCustomIcon(severityColorHex, 'emergency')}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm">{icon} {emergency.emergency_type?.replace('_', ' ') || 'Emergency'}</h3>
                {emergency.description && <p className="text-xs text-gray-600 mt-1">{emergency.description}</p>}
                {emergency.status && (
                  <p className="text-xs mt-1" style={{ color: statusColor }}>
                    Status: {emergency.status}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
};

export default EmergencyLayer;



