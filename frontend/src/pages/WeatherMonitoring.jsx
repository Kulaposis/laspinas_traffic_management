import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import weatherService from '../services/weatherService';
import { useAuth } from '../context/AuthContext';
import WeatherAnalytics from '../components/WeatherAnalytics';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const WeatherMonitoring = () => {
  const { user } = useAuth();
  const [weatherData, setWeatherData] = useState([]);
  const [floodData, setFloodData] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedArea, setSelectedArea] = useState('Las Piñas City');
  const [viewMode, setViewMode] = useState('current'); // current, alerts, flood, barangays
  const [realtimeStatus, setRealtimeStatus] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [barangayData, setBarangayData] = useState({
    floodProne: [],
    criticalAreas: [],
    evacuationCenters: []
  });

  // Las Piñas City center coordinates
  const defaultCenter = [14.4504, 121.0170];

  const fetchWeatherData = useCallback(async () => {
    try {
      setLoading(true);
      const [currentWeather, floodMonitoring, alerts, status] = await Promise.all([
        weatherService.getCurrentWeather(),
        weatherService.getFloodMonitoring(),
        weatherService.getWeatherAlerts({ is_active: true }),
        weatherService.getRealtimeStatus().catch(() => null)
      ]);

      setWeatherData(currentWeather);
      setFloodData(floodMonitoring);
      setWeatherAlerts(alerts);
      setRealtimeStatus(status);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBarangayData = useCallback(async () => {
    try {
      const [floodProne, criticalAreas, evacuationCenters] = await Promise.all([
        weatherService.getFloodProneBarangays().catch(() => ({ barangays: [] })),
        weatherService.getCriticalFloodAreas().catch(() => ({ critical_areas: [] })),
        weatherService.getEvacuationCenters().catch(() => ({ evacuation_centers: [] }))
      ]);

      setBarangayData({
        floodProne: floodProne.barangays || [],
        criticalAreas: criticalAreas.critical_areas || [],
        evacuationCenters: evacuationCenters.evacuation_centers || []
      });
    } catch (err) {
      console.error('Error fetching barangay data:', err);
    }
  }, []);

  const handleRealtimeUpdate = async () => {
    if (!user || isUpdating) return;
    
    try {
      setIsUpdating(true);
      setError('');
      
      await weatherService.updateRealtimeWeather();
      
      // Wait a moment for the update to process, then refresh data
      setTimeout(async () => {
        await fetchWeatherData();
        setIsUpdating(false);
      }, 3000);
      
    } catch (err) {
      setError(err.message);
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();
    fetchBarangayData();
    // Refresh every 2 minutes for real-time monitoring
    const interval = setInterval(fetchWeatherData, 120000);
    return () => clearInterval(interval);
  }, [fetchWeatherData, fetchBarangayData]);

  const getWeatherIcon = (condition) => {
    return weatherService.getWeatherIcon(condition);
  };

  const getFloodLevelColor = (level) => {
    const colors = {
      normal: '#22c55e',
      low: '#eab308',
      moderate: '#f97316',
      high: '#ef4444',
      critical: '#7c3aed'
    };
    return colors[level] || '#6b7280';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      advisory: '#3b82f6',
      watch: '#eab308',
      warning: '#f97316',
      critical: '#ef4444'
    };
    return colors[severity] || '#6b7280';
  };

  const getTemperatureColor = (temp) => {
    if (temp < 20) return '#3b82f6'; // Cold - Blue
    if (temp < 25) return '#22c55e'; // Cool - Green
    if (temp < 30) return '#eab308'; // Warm - Yellow
    if (temp < 35) return '#f97316'; // Hot - Orange
    return '#ef4444'; // Very Hot - Red
  };

  // Deduplicate weather stations by area_name, keep latest record
  const uniqueWeatherStations = React.useMemo(() => {
    const byArea = new Map();
    (weatherData || []).forEach((w) => {
      const key = w.area_name || `${w.latitude},${w.longitude}`;
      const existing = byArea.get(key);
      if (!existing) {
        byArea.set(key, w);
      } else {
        const existingTime = existing.recorded_at ? new Date(existing.recorded_at).getTime() : 0;
        const currentTime = w.recorded_at ? new Date(w.recorded_at).getTime() : 0;
        if (currentTime > existingTime) {
          byArea.set(key, w);
        }
      }
    });
    return Array.from(byArea.values());
  }, [weatherData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const currentWeather = (uniqueWeatherStations.find(w => (w.area_name || '').includes('Las Piñas')) || uniqueWeatherStations[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Weather Monitoring</h1>
          <div className="flex items-center space-x-4 mt-2">
            <p className="text-gray-600">Real-time weather and flood conditions</p>
            {realtimeStatus && (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  realtimeStatus.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-500">
                  {realtimeStatus.status === 'active' ? 'Live' : 'Offline'} • 
                  {realtimeStatus.api_source}
                </span>
              </div>
            )}
            {lastUpdate && (
              <span className="text-xs text-gray-400">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {user && (user.role === 'admin' || user.role === 'operator') && (
            <button
              onClick={handleRealtimeUpdate}
              disabled={isUpdating}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                isUpdating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isUpdating ? (
                <div className="flex items-center space-x-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
                  <span>Updating...</span>
                </div>
              ) : (
                '🔄 Update Live Data'
              )}
            </button>
          )}
          
          <button
            onClick={() => setViewMode('current')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'current' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🌤️ Current
          </button>
          <button
            onClick={() => setViewMode('alerts')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'alerts' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⚠️ Alerts
          </button>
          <button
            onClick={() => setViewMode('flood')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'flood' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🌊 Flood
          </button>
          <button
            onClick={() => setViewMode('barangays')}
            className={`px-4 py-2 rounded-lg ${
              viewMode === 'barangays' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            🏘️ Barangays
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Current Weather Summary */}
      {currentWeather && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{currentWeather.area_name}</h2>
              <p className="text-blue-100">
                {new Date(currentWeather.recorded_at).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center text-4xl">
                <span className="mr-2">{getWeatherIcon(currentWeather.weather_condition)}</span>
                <span>{Math.round(currentWeather.temperature_celsius)}°C</span>
              </div>
              <p className="text-blue-100 capitalize">
                {currentWeather.weather_condition.replace('_', ' ')}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-blue-200 text-sm">Humidity</p>
              <p className="text-xl font-semibold">{currentWeather.humidity_percent}%</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Wind Speed</p>
              <p className="text-xl font-semibold">{currentWeather.wind_speed_kmh || 0} km/h</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Rainfall</p>
              <p className="text-xl font-semibold">{currentWeather.rainfall_mm} mm</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Visibility</p>
              <p className="text-xl font-semibold">{currentWeather.visibility_km || 'N/A'} km</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Notifications */}
      {weatherAlerts.length > 0 && (
        <div className="space-y-2">
          {weatherAlerts.slice(0, 3).map((alert) => (
            <div 
              key={alert.id}
              className={`p-4 rounded-lg border-l-4 ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-500' :
                alert.severity === 'warning' ? 'bg-orange-50 border-orange-500' :
                alert.severity === 'watch' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {alert.affected_areas} • {alert.severity.toUpperCase()}
                  </p>
                </div>
                <span className="text-2xl">
                  {alert.alert_type === 'flood' ? '🌊' : 
                   alert.alert_type === 'rain' ? '🌧️' : 
                   alert.alert_type === 'storm' ? '⛈️' : '⚠️'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="h-96">
              <MapContainer
                center={defaultCenter}
                zoom={12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* Weather Stations (deduplicated) */}
                {viewMode === 'current' && uniqueWeatherStations.map((weather) => (
                  <Marker
                    key={weather.id}
                    position={[weather.latitude, weather.longitude]}
                    icon={L.divIcon({
                      className: 'weather-marker',
                      html: `<div style="background-color: ${getTemperatureColor(weather.temperature_celsius)}; color: white; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">${Math.round(weather.temperature_celsius)}°</div>`,
                      iconSize: [34, 34],
                      iconAnchor: [17, 17]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{weather.area_name}</h3>
                        <div className="space-y-1 text-sm">
                          <p>🌡️ {weather.temperature_celsius}°C</p>
                          <p>💧 {weather.humidity_percent}% humidity</p>
                          <p>💨 {weather.wind_speed_kmh || 0} km/h {weather.wind_direction || ''}</p>
                          <p>🌧️ {weather.rainfall_mm} mm rainfall</p>
                          <p>👁️ {weather.visibility_km || 'N/A'} km visibility</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(weather.recorded_at).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Flood Monitoring Points */}
                {viewMode === 'flood' && floodData.map((flood) => (
                  <Marker
                    key={flood.id}
                    position={[flood.latitude, flood.longitude]}
                    icon={L.divIcon({
                      className: 'flood-marker',
                      html: `<div style="background-color: ${getFloodLevelColor(flood.flood_level)}; color: white; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px;">🌊</div>`,
                      iconSize: [28, 28],
                      iconAnchor: [14, 14]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{flood.location_name}</h3>
                        <div className="space-y-1 text-sm">
                          <p>Water Level: {flood.water_level_cm} cm</p>
                          <p>Flood Level: {flood.flood_level}</p>
                          <p>Alert Level: {flood.alert_level}/4</p>
                          <p>Passable: {flood.estimated_passable ? '✅ Yes' : '❌ No'}</p>
                          {flood.evacuation_center_nearby && (
                            <p>Evacuation: {flood.evacuation_center_nearby}</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Updated: {new Date(flood.last_updated).toLocaleString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Weather Alerts */}
                {viewMode === 'alerts' && weatherAlerts.map((alert) => (
                  alert.latitude && alert.longitude && (
                    <Marker
                      key={alert.id}
                      position={[alert.latitude, alert.longitude]}
                      icon={L.divIcon({
                        className: 'alert-marker',
                        html: `<div style="background-color: ${getSeverityColor(alert.severity)}; color: white; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px;">⚠</div>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 12]
                      })}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-semibold">{alert.title}</h3>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <p className="text-sm text-gray-600">Severity: {alert.severity}</p>
                          <p className="text-sm text-gray-600">Type: {alert.alert_type}</p>
                          {alert.expires_at && (
                            <p className="text-xs text-gray-500">
                              Expires: {new Date(alert.expires_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}

                {/* Barangay Markers */}
                {viewMode === 'barangays' && barangayData.floodProne.map((barangay, index) => (
                  <Marker
                    key={`barangay-${index}`}
                    position={[barangay.lat, barangay.lon]}
                    icon={L.divIcon({
                      className: 'barangay-marker',
                      html: `<div style="background-color: ${
                        barangay.historical_flood_level === 'critical' ? '#dc2626' :
                        barangay.historical_flood_level === 'high' ? '#ea580c' :
                        barangay.historical_flood_level === 'moderate' ? '#d97706' :
                        '#16a34a'
                      }; color: white; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">🏘️</div>`,
                      iconSize: [29, 29],
                      iconAnchor: [14, 14]
                    })}
                  >
                    <Popup>
                      <div className="p-3">
                        <h3 className="font-semibold text-lg">{barangay.name}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Population:</span>
                            <span className="font-medium">{barangay.population?.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Flood Risk:</span>
                            <span className={`font-medium px-2 py-1 rounded text-xs ${
                              barangay.historical_flood_level === 'critical' ? 'bg-red-100 text-red-800' :
                              barangay.historical_flood_level === 'high' ? 'bg-orange-100 text-orange-800' :
                              barangay.historical_flood_level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {barangay.historical_flood_level}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Evacuation Center:</span>
                            <p className="font-medium">{barangay.evacuation_center}</p>
                          </div>
                          {barangay.risk_factors && barangay.risk_factors.length > 0 && (
                            <div>
                              <span className="text-gray-600">Risk Factors:</span>
                              <ul className="text-xs mt-1">
                                {barangay.risk_factors.map((factor, idx) => (
                                  <li key={idx} className="text-gray-500">• {factor}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Evacuation Centers */}
                {viewMode === 'barangays' && barangayData.evacuationCenters.map((center, index) => (
                  <Marker
                    key={`evacuation-${index}`}
                    position={[center.latitude, center.longitude]}
                    icon={L.divIcon({
                      className: 'evacuation-marker',
                      html: `<div style="background-color: #1f2937; color: white; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 10px;">🏥</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    })}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">{center.evacuation_center}</h3>
                        <p className="text-sm text-gray-600">Barangay: {center.barangay}</p>
                        <p className="text-sm text-gray-600">Serves: {center.population_served?.toLocaleString()} residents</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Real-time Status Panel */}
          {realtimeStatus && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    realtimeStatus.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  Real-time Status
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    realtimeStatus.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {realtimeStatus.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">API Source:</span>
                  <span className="font-medium">{realtimeStatus.api_source}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monitoring Areas:</span>
                  <span className="font-medium">{realtimeStatus.monitoring_areas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Recent Updates:</span>
                  <span className="font-medium">{realtimeStatus.recent_updates}</span>
                </div>
                {realtimeStatus.last_update && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Last Update:</span>
                    <span className="font-medium text-xs">
                      {new Date(realtimeStatus.last_update).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Update Frequency:</span>
                    <span className="font-medium text-xs">
                      {realtimeStatus.update_frequency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flood Alerts */}
          {viewMode === 'flood' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Flood Monitoring</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {floodData.filter(f => f.alert_level > 0).length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No flood alerts</p>
                ) : (
                  floodData.filter(f => f.alert_level > 0).map((flood) => (
                    <div key={flood.id} className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{flood.location_name}</span>
                        <span 
                          className="px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: getFloodLevelColor(flood.flood_level) }}
                        >
                          {flood.flood_level}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Level: {flood.water_level_cm} cm • Alert: {flood.alert_level}/4
                      </p>
                      {!flood.estimated_passable && (
                        <p className="text-xs text-red-600 mt-1">⚠️ Not passable</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Weather Alerts List */}
          {viewMode === 'alerts' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Active Alerts</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {weatherAlerts.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No active alerts</p>
                ) : (
                  weatherAlerts.map((alert) => (
                    <div key={alert.id} className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{alert.title}</span>
                        <span 
                          className="px-2 py-1 rounded text-xs text-white"
                          style={{ backgroundColor: getSeverityColor(alert.severity) }}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{alert.alert_type}</p>
                      <p className="text-xs text-gray-500">{alert.affected_areas}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Weather Conditions (deduplicated) */}
          {viewMode === 'current' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Weather Stations</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {uniqueWeatherStations.length === 0 ? (
                  <p className="p-4 text-gray-500 text-center">No weather data available</p>
                ) : (
                  uniqueWeatherStations.map((weather) => (
                    <div key={weather.id} className="p-4 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{weather.area_name}</span>
                        <div className="flex items-center space-x-1">
                          <span>{getWeatherIcon(weather.weather_condition)}</span>
                          <span className="text-sm font-semibold">
                            {Math.round(weather.temperature_celsius)}°C
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>💧 {weather.humidity_percent}%</span>
                        <span>🌧️ {weather.rainfall_mm}mm</span>
                        <span>💨 {weather.wind_speed_kmh || 0}km/h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Barangay Information */}
          {viewMode === 'barangays' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Las Piñas Barangays</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {barangayData.criticalAreas.length > 0 ? (
                  <>
                    <div className="p-3 bg-red-50 border-b border-gray-100">
                      <h4 className="font-medium text-red-800 text-sm mb-2">Critical Risk Areas</h4>
                      {barangayData.criticalAreas.slice(0, 3).map((barangay, index) => (
                        <div key={index} className="text-xs text-red-700 mb-1">
                          📍 {barangay.name} - {barangay.historical_flood_level} risk
                        </div>
                      ))}
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-gray-800 text-sm mb-2">All Flood-Prone Areas</h4>
                      {barangayData.floodProne.slice(0, 5).map((barangay, index) => (
                        <div key={index} className="flex justify-between items-center py-1 text-xs">
                          <span>{barangay.name}</span>
                          <span className={`px-2 py-1 rounded ${
                            barangay.historical_flood_level === 'critical' ? 'bg-red-100 text-red-700' :
                            barangay.historical_flood_level === 'high' ? 'bg-orange-100 text-orange-700' :
                            barangay.historical_flood_level === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {barangay.historical_flood_level}
                          </span>
                        </div>
                      ))}
                      {barangayData.floodProne.length > 5 && (
                        <p className="text-xs text-gray-500 mt-2">
                          +{barangayData.floodProne.length - 5} more barangays...
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="p-4 text-gray-500 text-center text-sm">Loading barangay data...</p>
                )}
              </div>
            </div>
          )}

          {/* Legend for Barangays */}
          {viewMode === 'barangays' && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Flood Risk Legend</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-600"></div>
                  <span className="text-sm">Critical Risk</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-orange-600"></div>
                  <span className="text-sm">High Risk</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
                  <span className="text-sm">Moderate Risk</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-600"></div>
                  <span className="text-sm">Low Risk</span>
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full bg-gray-800"></div>
                    <span className="text-sm">🏥 Evacuation Centers</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Temperature Legend */}
          {viewMode === 'current' && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-3">Temperature Scale</h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Cold (&lt; 20°C)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-sm">Cool (20-25°C)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-sm">Warm (25-30°C)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                  <span className="text-sm">Hot (30-35°C)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="text-sm">Very Hot (&gt; 35°C)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weather Analytics Section */}
      <WeatherAnalytics 
        weatherData={weatherData}
        floodData={floodData}
        weatherAlerts={weatherAlerts}
        barangayData={barangayData}
      />
    </div>
  );
};

export default WeatherMonitoring;
