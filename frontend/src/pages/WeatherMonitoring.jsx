import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Cloud, 
  Droplets, 
  Wind, 
  Thermometer, 
  Eye, 
  AlertTriangle, 
  RefreshCw, 
  MapPin, 
  Shield, 
  Activity,
  TrendingUp,
  Sun,
  Zap,
  Navigation,
  Settings,
  Filter,
  Search
} from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="space-y-8 p-6">
        {/* Modern Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <Cloud className="w-8 h-8 text-white" />
                </div>
        <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                    Weather Monitoring
                  </h1>
                  <p className="text-gray-600 text-lg font-medium">Real-time weather and flood conditions</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
            {realtimeStatus && (
                  <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-white/40">
                    <div className={`w-3 h-3 rounded-full animate-pulse ${
                  realtimeStatus.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                    <span className="text-sm font-medium text-gray-700">
                      {realtimeStatus.status === 'active' ? 'Live' : 'Offline'}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {realtimeStatus.api_source}
                </span>
              </div>
            )}
            {lastUpdate && (
                  <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-white/40">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Updated: {lastUpdate.toLocaleTimeString()}
              </span>
                  </div>
            )}
          </div>
        </div>
        
            {/* Modern Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {user && (user.role === 'admin' || user.role === 'operator') && (
            <button
              onClick={handleRealtimeUpdate}
              disabled={isUpdating}
                  className={`group relative overflow-hidden px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                isUpdating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-lg hover:shadow-green-500/25 hover:-translate-y-0.5'
              }`}
            >
              {isUpdating ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                      <span>Update Live Data</span>
                    </div>
              )}
            </button>
          )}
          
              {/* View Mode Toggle */}
              <div className="flex bg-white/60 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-white/40">
          <button
            onClick={() => setViewMode('current')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'current' 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
                  <Sun className="w-4 h-4" />
                  <span>Current</span>
          </button>
          <button
            onClick={() => setViewMode('alerts')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'alerts' 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Alerts</span>
          </button>
          <button
            onClick={() => setViewMode('flood')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'flood' 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
                  <Droplets className="w-4 h-4" />
                  <span>Flood</span>
          </button>
          <button
            onClick={() => setViewMode('barangays')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'barangays' 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
                  <MapPin className="w-4 h-4" />
                  <span>Barangays</span>
          </button>
              </div>
            </div>
        </div>
      </div>

        {/* Modern Error Alert */}
      {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-xl p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-red-800">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
        </div>
      )}

        {/* Modern Current Weather Summary */}
      {currentWeather && (
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white rounded-2xl p-8 shadow-2xl border border-white/20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                    <span className="text-4xl">{getWeatherIcon(currentWeather.weather_condition)}</span>
                  </div>
            <div>
                    <h2 className="text-3xl font-bold">{currentWeather.area_name}</h2>
                    <p className="text-blue-100 text-lg">
                {new Date(currentWeather.recorded_at).toLocaleString()}
              </p>
            </div>
              </div>
                
                <div className="text-6xl font-bold mb-2">
                  {Math.round(currentWeather.temperature_celsius)}°C
                </div>
                <p className="text-xl text-blue-100 capitalize">
                {currentWeather.weather_condition.replace('_', ' ')}
              </p>
          </div>
          
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <Droplets className="w-8 h-8 mx-auto mb-2 text-blue-200" />
                  <p className="text-blue-200 text-sm font-medium">Humidity</p>
                  <p className="text-2xl font-bold">{Math.round(currentWeather.humidity_percent)}%</p>
            </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <Wind className="w-8 h-8 mx-auto mb-2 text-blue-200" />
                  <p className="text-blue-200 text-sm font-medium">Wind Speed</p>
                  <p className="text-2xl font-bold">{Math.round(currentWeather.wind_speed_kmh || 0)} km/h</p>
            </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <Cloud className="w-8 h-8 mx-auto mb-2 text-blue-200" />
                  <p className="text-blue-200 text-sm font-medium">Rainfall</p>
                  <p className="text-2xl font-bold">{Math.round(currentWeather.rainfall_mm)} mm</p>
            </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-blue-200" />
                  <p className="text-blue-200 text-sm font-medium">Visibility</p>
                  <p className="text-2xl font-bold">{currentWeather.visibility_km ? Math.round(currentWeather.visibility_km) : 'N/A'} km</p>
                </div>
            </div>
          </div>
        </div>
      )}

        {/* Modern Alert Notifications */}
      {weatherAlerts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Active Weather Alerts</h3>
            </div>
          {weatherAlerts.slice(0, 3).map((alert) => (
            <div 
              key={alert.id}
                className={`group relative overflow-hidden rounded-2xl border-l-4 shadow-lg hover:shadow-xl transition-all duration-300 ${
                  alert.severity === 'critical' ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-500' :
                  alert.severity === 'warning' ? 'bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-500' :
                  alert.severity === 'watch' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-500' :
                  'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500'
                }`}
              >
                <div className="p-6">
              <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === 'critical' ? 'bg-red-100' :
                          alert.severity === 'warning' ? 'bg-orange-100' :
                          alert.severity === 'watch' ? 'bg-yellow-100' :
                          'bg-blue-100'
                        }`}>
                          {alert.alert_type === 'flood' ? <Droplets className="w-5 h-5 text-blue-600" /> : 
                           alert.alert_type === 'rain' ? <Cloud className="w-5 h-5 text-blue-600" /> : 
                           alert.alert_type === 'storm' ? <Zap className="w-5 h-5 text-yellow-600" /> : 
                           <AlertTriangle className="w-5 h-5 text-orange-600" />}
                </div>
                        <h3 className="text-lg font-bold text-gray-900">{alert.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'warning' ? 'bg-orange-100 text-orange-800' :
                          alert.severity === 'watch' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity.toUpperCase()}
                </span>
                      </div>
                      <p className="text-gray-700 mb-3 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{alert.affected_areas}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Activity className="w-4 h-4" />
                          <span>{alert.alert_type}</span>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map */}
        <div className="lg:col-span-2">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
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
                          <p>Water Level: {Math.round(flood.water_level_cm)} cm</p>
                          <p>Flood Level: {flood.flood_level}</p>
                          <p>Alert Level: {Math.round(flood.alert_level)}/4</p>
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

          {/* Modern Sidebar */}
          <div className="space-y-6">
          {/* Real-time Status Panel */}
          {realtimeStatus && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full animate-pulse ${
                      realtimeStatus.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                    <h3 className="text-xl font-bold text-white">Real-time Status</h3>
              </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-600 font-medium">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        realtimeStatus.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {realtimeStatus.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-600 font-medium">API Source:</span>
                      <span className="font-semibold text-gray-900">{realtimeStatus.api_source}</span>
                </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-600 font-medium">Monitoring Areas:</span>
                      <span className="font-semibold text-gray-900">{realtimeStatus.monitoring_areas}</span>
                </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <span className="text-gray-600 font-medium">Recent Updates:</span>
                      <span className="font-semibold text-gray-900">{realtimeStatus.recent_updates}</span>
                </div>
                {realtimeStatus.last_update && (
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-medium">Last Update:</span>
                        <span className="font-semibold text-gray-900 text-sm">
                      {new Date(realtimeStatus.last_update).toLocaleString()}
                    </span>
                  </div>
                )}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-600 font-medium">Update Frequency:</span>
                        <span className="font-semibold text-gray-900 text-sm">
                      {realtimeStatus.update_frequency}
                    </span>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flood Alerts */}
          {viewMode === 'flood' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                  <div className="flex items-center space-x-3">
                    <Droplets className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-bold text-white">Flood Monitoring</h3>
                  </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {floodData.filter(f => f.alert_level > 0).length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="p-4 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="text-gray-500 font-medium">No flood alerts</p>
                      <p className="text-gray-400 text-sm">All areas are safe</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {floodData.filter(f => f.alert_level > 0).map((flood) => (
                        <div key={flood.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">{flood.location_name}</span>
                        <span 
                              className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: getFloodLevelColor(flood.flood_level) }}
                        >
                          {flood.flood_level}
                        </span>
                      </div>
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                              Level: <span className="font-semibold">{Math.round(flood.water_level_cm)} cm</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Alert: <span className="font-semibold">{Math.round(flood.alert_level)}/4</span>
                      </p>
                      {!flood.estimated_passable && (
                              <div className="flex items-center space-x-1 text-red-600 text-sm font-medium">
                                <AlertTriangle className="w-4 h-4" />
                                <span>Not passable</span>
                              </div>
                      )}
                    </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </div>
          )}

          {/* Weather Alerts List */}
          {viewMode === 'alerts' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-bold text-white">Active Alerts</h3>
                  </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {weatherAlerts.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="p-4 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="text-gray-500 font-medium">No active alerts</p>
                      <p className="text-gray-400 text-sm">Weather conditions are normal</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {weatherAlerts.map((alert) => (
                        <div key={alert.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-gray-900">{alert.title}</span>
                        <span 
                              className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: getSeverityColor(alert.severity) }}
                        >
                          {alert.severity}
                        </span>
                      </div>
                          <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                              Type: <span className="font-semibold capitalize">{alert.alert_type}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              Areas: <span className="font-semibold">{alert.affected_areas}</span>
                            </p>
                    </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </div>
          )}

          {/* Weather Conditions (deduplicated) */}
          {viewMode === 'current' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                  <div className="flex items-center space-x-3">
                    <Thermometer className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-bold text-white">Weather Stations</h3>
                  </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {uniqueWeatherStations.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Cloud className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No weather data available</p>
                      <p className="text-gray-400 text-sm">Check back later</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {uniqueWeatherStations.map((weather) => (
                        <div key={weather.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-shadow duration-200">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-gray-900">{weather.area_name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-2xl">{getWeatherIcon(weather.weather_condition)}</span>
                              <span className="text-lg font-bold text-gray-900">
                            {Math.round(weather.temperature_celsius)}°C
                          </span>
                        </div>
                      </div>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center space-x-1 text-gray-600">
                              <Droplets className="w-4 h-4 text-blue-500" />
                              <span>{Math.round(weather.humidity_percent)}%</span>
                      </div>
                            <div className="flex items-center space-x-1 text-gray-600">
                              <Cloud className="w-4 h-4 text-blue-500" />
                              <span>{Math.round(weather.rainfall_mm)}mm</span>
                    </div>
                            <div className="flex items-center space-x-1 text-gray-600">
                              <Wind className="w-4 h-4 text-blue-500" />
                              <span>{Math.round(weather.wind_speed_kmh || 0)}km/h</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                )}
              </div>
            </div>
          )}

          {/* Barangay Information */}
          {viewMode === 'barangays' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-6 h-6 text-white" />
                    <h3 className="text-xl font-bold text-white">Las Piñas Barangays</h3>
                  </div>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {barangayData.criticalAreas.length > 0 ? (
                    <div className="p-4 space-y-4">
                      <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                        <h4 className="font-semibold text-red-800 text-sm mb-3 flex items-center">
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Critical Risk Areas
                        </h4>
                        <div className="space-y-2">
                      {barangayData.criticalAreas.slice(0, 3).map((barangay, index) => (
                            <div key={index} className="flex items-center space-x-2 text-sm text-red-700">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="font-medium">{barangay.name}</span>
                              <span className="text-xs bg-red-100 px-2 py-1 rounded-full">
                                {barangay.historical_flood_level} risk
                              </span>
                        </div>
                      ))}
                    </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <h4 className="font-semibold text-gray-800 text-sm mb-3 flex items-center">
                          <Shield className="w-4 h-4 mr-2" />
                          All Flood-Prone Areas
                        </h4>
                        <div className="space-y-2">
                      {barangayData.floodProne.slice(0, 5).map((barangay, index) => (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-gray-200">
                              <span className="text-sm font-medium text-gray-700">{barangay.name}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
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
                            <p className="text-xs text-gray-500 mt-2 text-center">
                          +{barangayData.floodProne.length - 5} more barangays...
                        </p>
                      )}
                    </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <Activity className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">Loading barangay data...</p>
                      <p className="text-gray-400 text-sm">Please wait</p>
                    </div>
                )}
              </div>
            </div>
          )}

          {/* Legend for Barangays */}
          {viewMode === 'barangays' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-blue-600" />
                  Flood Risk Legend
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-600"></div>
                    <span className="text-sm font-medium text-gray-700">Critical Risk</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-orange-600"></div>
                    <span className="text-sm font-medium text-gray-700">High Risk</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-yellow-600"></div>
                    <span className="text-sm font-medium text-gray-700">Moderate Risk</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-green-600"></div>
                    <span className="text-sm font-medium text-gray-700">Low Risk</span>
                </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-4 h-4 rounded-full bg-gray-800"></div>
                      <span className="text-sm font-medium text-gray-700">🏥 Evacuation Centers</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Temperature Legend */}
          {viewMode === 'current' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Thermometer className="w-5 h-5 mr-2 text-blue-600" />
                  Temperature Scale
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-gray-700">Cold (&lt; 20°C)</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-700">Cool (20-25°C)</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium text-gray-700">Warm (25-30°C)</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className="text-sm font-medium text-gray-700">Hot (30-35°C)</span>
                </div>
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-gray-700">Very Hot (&gt; 35°C)</span>
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
    </div>
  );
};

export default WeatherMonitoring;
