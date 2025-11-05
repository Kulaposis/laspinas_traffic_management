import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import reportService from '../services/reportService';
import RouteLayer from './RouteLayer';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different report types
const createCustomIcon = (color) => {
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg width="25" height="35" viewBox="0 0 25 35" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 22.5 12.5 22.5s12.5-10 12.5-22.5C25 5.6 19.4 0 12.5 0z" fill="${color}"/>
        <circle cx="12.5" cy="12.5" r="6" fill="white"/>
      </svg>
    `)}`,
    iconSize: [25, 35],
    iconAnchor: [12, 35],
    popupAnchor: [0, -35],
  });
};

const MapView = ({ 
  reports = [], 
  footprints = [], 
  center = [14.5995, 120.9842], // Manila coordinates
  zoom = 13,
  height = '400px',
  onMapClick = null,
  routes = [],
  selectedRoute = null,
  origin = null,
  destination = null,
  onRouteClick = null,
  showAllRoutes = false
}) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (mapInstance && reports.length > 0) {
      // Fit map to show all reports
      const group = new L.featureGroup(reports.map(report => 
        L.marker([report.latitude, report.longitude])
      ));
      mapInstance.fitBounds(group.getBounds().pad(0.1));
    }
  }, [mapInstance, reports]);

  const handleMapEvents = {
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    }
  };

  // Adjust height for mobile
  const responsiveHeight = isMobile ? '300px' : height;

  return (
    <div 
      style={{ height: responsiveHeight }} 
      className="rounded-lg overflow-hidden border border-gray-200 shadow-sm touch-manipulation"
    >
      <MapContainer
        center={center}
        zoom={isMobile ? zoom - 1 : zoom}
        style={{ height: '100%', width: '100%' }}
        ref={setMapInstance}
        eventHandlers={handleMapEvents}
        zoomControl={!isMobile}
        touchZoom={true}
        dragging={true}
        tap={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Traffic Reports */}
        {reports.map((report) => (
          <Marker
            key={`report-${report.id}`}
            position={[report.latitude, report.longitude]}
            icon={createCustomIcon(reportService.getReportTypeColor(report.report_type))}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-gray-900">{report.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs">
                    <span className="font-medium">Type:</span>{' '}
                    <span className="capitalize">{report.report_type.replace('_', ' ')}</span>
                  </p>
                  <p className="text-xs">
                    <span className="font-medium">Status:</span>{' '}
                    <span 
                      className="capitalize px-2 py-1 rounded text-white text-xs"
                      style={{ backgroundColor: reportService.getReportStatusColor(report.status) }}
                    >
                      {report.status.replace('_', ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Pedestrian Footprints (Crowd Levels) */}
        {footprints.map((footprint) => (
          <Circle
            key={`footprint-${footprint.id}`}
            center={[footprint.latitude, footprint.longitude]}
            radius={footprint.radius_meters}
            pathOptions={{
              fillColor: getCrowdLevelColor(footprint.crowd_level),
              fillOpacity: 0.3,
              color: getCrowdLevelColor(footprint.crowd_level),
              weight: 2,
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold text-gray-900">{footprint.area_name}</h3>
                <div className="mt-2 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">Pedestrian Count:</span> {footprint.pedestrian_count}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Crowd Level:</span>{' '}
                    <span 
                      className="capitalize px-2 py-1 rounded text-white text-xs"
                      style={{ backgroundColor: getCrowdLevelColor(footprint.crowd_level) }}
                    >
                      {footprint.crowd_level}
                    </span>
                  </p>
                  {footprint.temperature_celsius && (
                    <p className="text-sm">
                      <span className="font-medium">Temperature:</span> {footprint.temperature_celsius}°C
                    </p>
                  )}
                  {footprint.humidity_percent && (
                    <p className="text-sm">
                      <span className="font-medium">Humidity:</span> {footprint.humidity_percent}%
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(footprint.recorded_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </Popup>
          </Circle>
        ))}

        {/* Route Layer */}
        {(routes.length > 0 || selectedRoute) && (
          <RouteLayer
            routes={routes}
            selectedRoute={selectedRoute}
            onRouteClick={onRouteClick}
            showAllRoutes={showAllRoutes}
            origin={origin}
            destination={destination}
          />
        )}
      </MapContainer>
    </div>
  );
};

const getCrowdLevelColor = (level) => {
  const colors = {
    low: '#10b981',      // emerald
    medium: '#f59e0b',   // amber
    high: '#f97316',     // orange
    critical: '#ef4444', // red
  };
  return colors[level] || colors.low;
};

export default MapView;
