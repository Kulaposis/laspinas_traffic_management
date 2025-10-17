import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Car, MapPin, AlertTriangle, RefreshCw, Camera, ExternalLink, Ban } from 'lucide-react';
import parkingService from '../services/parkingService';
import { useAuth } from '../context/AuthContext';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Street View Image Component with multiple fallback options
const StreetViewImage = ({ latitude, longitude, name }) => {
  const [showFallback, setShowFallback] = useState(false);
  
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  
  // Try Google Street View if API key is available
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const hasGoogleKey = googleApiKey && googleApiKey !== 'your_google_maps_api_key_here';
  
  const streetViewUrl = hasGoogleKey 
    ? `https://maps.googleapis.com/maps/api/streetview?size=300x200&location=${lat},${lng}&heading=0&pitch=0&key=${googleApiKey}`
    : null;
  
  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps/@${latitude},${longitude},18z`, '_blank');
  };
  
  const openInStreetView = () => {
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`, '_blank');
  };
  
  // If no Google API key or street view fails, show interactive fallback
  if (!hasGoogleKey || showFallback) {
    return (
      <div className="w-full h-32 bg-gradient-to-br from-blue-50 to-gray-100 border border-gray-200 rounded-lg flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern"></div>
        </div>
        
        <Camera className="w-8 h-8 text-blue-500 mb-2 relative z-10" />
        <p className="text-xs text-gray-600 mb-2 relative z-10 text-center px-2">
          Click to view this location
        </p>
        <div className="flex gap-2 relative z-10">
          <button
            onClick={openInGoogleMaps}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <MapPin className="w-3 h-3" />
            Maps
          </button>
          <button
            onClick={openInStreetView}
            className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <Camera className="w-3 h-3" />
            Street View
          </button>
        </div>
        
        {/* Location info overlay */}
        <div className="absolute bottom-1 left-2 text-xs text-gray-500 bg-white bg-opacity-75 px-2 py-1 rounded">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative">
      <img
        src={streetViewUrl}
        alt={`Street view of ${name}`}
        className="w-full h-32 object-cover rounded-lg border border-gray-200"
        onError={() => setShowFallback(true)}
      />
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={openInGoogleMaps}
          className="bg-black bg-opacity-50 text-white p-1 rounded text-xs hover:bg-opacity-70 transition-all"
          title="Open in Google Maps"
        >
          <MapPin className="w-3 h-3" />
        </button>
        <button
          onClick={openInStreetView}
          className="bg-black bg-opacity-50 text-white p-1 rounded text-xs hover:bg-opacity-70 transition-all"
          title="Open in Street View"
        >
          <Camera className="w-3 h-3" />
        </button>
      </div>
      
      {/* Location info overlay */}
      <div className="absolute bottom-1 left-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>
    </div>
  );
};

const Parking = () => {
  const { user } = useAuth();
  const [parkingAreas, setParkingAreas] = useState([]);
  const [noParkingZones, setNoParkingZones] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('both'); // both, parking, no-parking
  const [isUpdating, setIsUpdating] = useState(false);

  // Las Piñas City center coordinates
  const defaultCenter = [14.4504, 121.0170];

  // Create custom icons for different parking types
  const createParkingIcon = (status, type) => {
    const color = parkingService.getParkingStatusColor(status);
    return L.divIcon({
      className: 'parking-marker',
      html: `<div style="background-color: ${color}; color: white; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">🅿️</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  const createNoParkingIcon = (zoneType, restrictionReason, isStrict) => {
    const color = parkingService.getRestrictionReasonColor(restrictionReason);
    const symbol = isStrict ? '🚫' : '⚠️';
    return L.divIcon({
      className: 'no-parking-marker',
      html: `<div style="background-color: ${color}; color: white; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${symbol}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  const fetchData = useCallback(async () => {
    try {
      setIsUpdating(true);
      setError('');

      const promises = [];

      // Fetch parking areas if needed
      if (viewMode === 'both' || viewMode === 'parking') {
        promises.push(parkingService.getParkingAreas({ limit: 500 }));
      } else {
        promises.push(Promise.resolve([]));
      }

      // Fetch no parking zones
      if (viewMode === 'both' || viewMode === 'no-parking') {
        promises.push(parkingService.getNoParkingZones({ limit: 1000 }));
      } else {
        promises.push(Promise.resolve([]));
      }

      // Fetch statistics
      promises.push(parkingService.getParkingStatistics());

      const [parkingData, noParkingData, statsData] = await Promise.all(promises);

      setParkingAreas(parkingData || []);
      setNoParkingZones(noParkingData || []);
      setStatistics(statsData);

    } catch (err) {
      console.error('Error fetching parking data:', err);
      setError('Failed to load parking data. Please try again.');
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-gray-600">Loading parking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">

      {/* Content Container */}
      <div className="relative px-4 pt-3 pb-6">
        <div className="max-w-7xl mx-auto">

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/60 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-red-900 mb-1">Connection Error</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Modern Statistics Cards */}
          {statistics && (
            <div className="mb-4">
              <div className="flex justify-end mb-3">
                <button
                  onClick={fetchData}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-white/20 hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg text-sm"
                >
                  <RefreshCw className={`w-3 h-3 transition-transform duration-300 ${isUpdating ? 'animate-spin' : ''}`} />
                  Refresh Data
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* No Parking Zones Card */}
                <div className="group relative bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5 rounded-2xl"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg">
                        <Ban className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">
                          {statistics.no_parking_zones?.total_no_parking_zones || 0}
                        </div>
                        <div className="text-xs text-gray-500">Restricted</div>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">No Parking Zones</h3>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-gradient-to-r from-red-500 to-rose-500 h-1.5 rounded-full transition-all duration-500 w-full"></div>
                    </div>
                  </div>
                </div>

                {/* Strict Zones Card */}
                <div className="group relative bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-2xl"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                        <AlertTriangle className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900">
                          {statistics.no_parking_zones?.strict_enforcement_zones || 0}
                        </div>
                        <div className="text-xs text-gray-500">High Risk</div>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-gray-600 mb-2">Strict Enforcement</h3>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min((statistics.no_parking_zones?.strict_enforcement_zones || 0) / Math.max(statistics.no_parking_zones?.total_no_parking_zones || 1, 1) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* Interactive Map Section */}
          <div className="mb-4 bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Interactive Map</h3>
                <p className="text-xs text-gray-600">Real-time parking and restriction zones</p>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden shadow-xl border border-gray-200/50">
              {/* Map Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-600 font-medium text-sm">Loading map data...</p>
                  </div>
                </div>
              )}

              <div className="relative" style={{ height: '450px', minHeight: '350px' }}>
                <MapContainer
                  center={defaultCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                  className="rounded-xl"
                >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

                {/* Parking Areas */}
                {(viewMode === 'both' || viewMode === 'parking') && parkingAreas.map((parking) => (
                  <Marker
                    key={`parking-${parking.id}`}
                    position={[parking.latitude, parking.longitude]}
                    icon={createParkingIcon(parking.status, parking.parking_type)}
                  >
                    <Popup>
                      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[280px] max-w-[350px]">
                        {/* Header */}
                        <div className={`p-4 ${
                          parking.status === 'available'
                            ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                            : parking.status === 'occupied'
                            ? 'bg-gradient-to-r from-red-500 to-rose-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                              parking.status === 'available' ? 'bg-white/20' :
                              parking.status === 'occupied' ? 'bg-white/20' : 'bg-white/20'
                            }`}>
                              <Car className="w-5 h-5 text-white" />
                            </div>
                            <div className="text-white">
                              <h3 className="font-bold text-lg leading-tight">{parking.name}</h3>
                              <p className="text-sm opacity-90 capitalize">{parking.parking_type}</p>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                          {/* Status Badge */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">Status</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              parking.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : parking.status === 'occupied'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {parking.status}
                            </span>
                          </div>

                          {/* Capacity */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-gray-50 rounded-xl">
                              <div className="text-2xl font-bold text-gray-900">{parking.available_spaces}</div>
                              <div className="text-xs text-gray-600">Available</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-xl">
                              <div className="text-2xl font-bold text-gray-900">{parking.total_spaces}</div>
                              <div className="text-xs text-gray-600">Total</div>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="space-y-2 text-sm">
                            {parking.hourly_rate && (
                              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Hourly Rate</span>
                                <span className="font-semibold text-gray-900">{parkingService.formatFineAmount(parking.hourly_rate)}</span>
                              </div>
                            )}

                            {(parking.operating_hours_start && parking.operating_hours_end) && (
                              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Hours</span>
                                <span className="font-semibold text-gray-900">{parking.operating_hours_start} - {parking.operating_hours_end}</span>
                              </div>
                            )}

                            <div className="pt-2">
                              <div className="text-gray-600 text-xs mb-1">Address</div>
                              <div className="text-gray-900 font-medium text-sm leading-tight">{parking.address}</div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button className="w-full mt-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105">
                            Get Directions
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* No Parking Zones */}
                {(viewMode === 'both' || viewMode === 'no-parking') && noParkingZones.map((zone) => (
                  <React.Fragment key={`no-parking-${zone.id}`}>
                    <Marker
                      position={[zone.latitude, zone.longitude]}
                      icon={createNoParkingIcon(zone.zone_type, zone.restriction_reason, zone.is_strict)}
                    >
                      <Popup>
                        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[320px] max-w-[400px]">
                          {/* Header */}
                          <div className={`p-4 ${
                            zone.is_strict
                              ? 'bg-gradient-to-r from-red-500 to-rose-500'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500'
                          }`}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg">
                                <Ban className="w-5 h-5 text-white" />
                              </div>
                              <div className="text-white">
                                <h3 className="font-bold text-lg leading-tight">{zone.name}</h3>
                                <p className="text-sm opacity-90 capitalize">{zone.zone_type.replace('_', ' ')}</p>
                              </div>
                            </div>
                          </div>

                          {/* Street View Image */}
                          <div className="p-4 pb-0">
                            <div className="mb-4">
                              <StreetViewImage
                                latitude={zone.latitude}
                                longitude={zone.longitude}
                                name={zone.name}
                              />
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-4 pt-0 space-y-3">
                            {/* Enforcement Level */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-600">Enforcement</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                zone.is_strict
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {zone.is_strict ? 'Strict' : 'Regular'}
                              </span>
                            </div>

                            {/* Zone Details */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-center p-3 bg-gray-50 rounded-xl">
                                <div className="text-xl font-bold text-gray-900">{zone.radius_meters}m</div>
                                <div className="text-xs text-gray-600">Radius</div>
                              </div>
                              <div className="text-center p-3 bg-gray-50 rounded-xl">
                                <div className="text-xl font-bold text-gray-900">{parkingService.formatFineAmount(zone.fine_amount)}</div>
                                <div className="text-xs text-gray-600">Fine</div>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Reason</span>
                                <span className="font-semibold text-gray-900 capitalize">{zone.restriction_reason.replace('_', ' ')}</span>
                              </div>

                              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Hours</span>
                                <span className="font-semibold text-gray-900">{parkingService.formatEnforcementHours(zone.enforcement_hours)}</span>
                              </div>

                              <div className="pt-2">
                                <div className="text-gray-600 text-xs mb-1">Address</div>
                                <div className="text-gray-900 font-medium text-sm leading-tight">{zone.address}</div>
                              </div>

                              {zone.description && (
                                <div className="pt-2">
                                  <div className="text-gray-600 text-xs mb-1">Description</div>
                                  <div className="text-gray-900 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">{zone.description}</div>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mt-4">
                              <button className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105">
                                Report Violation
                              </button>
                              <button className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 hover:scale-105">
                                Get Directions
                              </button>
                            </div>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                
                {/* Zone Circle */}
                <Circle
                  center={[zone.latitude, zone.longitude]}
                  radius={zone.radius_meters}
                  fillColor={parkingService.getRestrictionReasonColor(zone.restriction_reason)}
                  fillOpacity={zone.is_strict ? 0.3 : 0.15}
                  color={parkingService.getRestrictionReasonColor(zone.restriction_reason)}
                  weight={zone.is_strict ? 2 : 1}
                  opacity={0.8}
                />
              </React.Fragment>
            ))}
          </MapContainer>
        </div>
      </div>

          {/* Modern Legend Section */}
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-gray-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Map Legend</h3>
                <p className="text-xs text-gray-600">Understanding the markers and zones</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Parking Areas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-semibold text-gray-900 text-sm">Parking Areas</h4>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">🅿️</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Available</div>
                      <div className="text-xs text-gray-600">Spaces are free</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-red-50 rounded-xl border border-red-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">🅿️</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Occupied/Full</div>
                      <div className="text-xs text-gray-600">No spaces available</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* No Parking Zones */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-600" />
                  <h4 className="font-semibold text-gray-900 text-sm">Restricted Zones</h4>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-red-50 rounded-xl border border-red-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">🚫</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Strict Enforcement</div>
                      <div className="text-xs text-gray-600">High fines, active monitoring</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">⚠️</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Regular Restriction</div>
                      <div className="text-xs text-gray-600">Standard enforcement</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">🏛️</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Government Areas</div>
                      <div className="text-xs text-gray-600">Official buildings & facilities</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-xs font-bold">🏫</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">School Zones</div>
                      <div className="text-xs text-gray-600">Educational institutions</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h5 className="font-semibold text-gray-900 mb-1 text-sm">Important Note</h5>
                  <p className="text-xs text-gray-600">
                    Always check local traffic regulations and parking signs. Fines and enforcement may vary by location and time.
                    Click on any marker for detailed information and street view images.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Parking;
