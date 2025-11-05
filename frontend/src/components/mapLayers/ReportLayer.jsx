import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { createCustomIcon } from '../../utils/mapIcons';
import reportService from '../../services/reportService';

/**
 * Report Layer Component
 * Displays user-submitted reports on the map
 */
const ReportLayer = ({ reports = [], enabled = false }) => {
  if (!enabled || !Array.isArray(reports) || reports.length === 0) {
    return null;
  }

  return (
    <>
      {reports.map((report, idx) => {
        const lat = report?.latitude || report?.lat || (report?.location && report.location.lat);
        const lng = report?.longitude || report?.lng || (report?.location && report.location.lng);
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        
        const color = reportService.getReportTypeColor(report.report_type || 'other');
        
        return (
          <Marker key={`report-${report.id || idx}`} position={[lat, lng]} icon={createCustomIcon(color, 'report')}>
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-sm capitalize">{report.report_type?.replace('_', ' ') || 'Report'}</h3>
                {report.description && <p className="text-xs text-gray-600 mt-1">{report.description}</p>}
                {report.status && (
                  <p className="text-xs mt-1" style={{ color: reportService.getReportStatusColor(report.status) }}>
                    Status: {report.status}
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

export default ReportLayer;



