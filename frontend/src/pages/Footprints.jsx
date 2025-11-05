import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Users, MapPin, Activity, Thermometer, Droplets, RefreshCw, 
  TrendingUp, AlertTriangle, Clock, Map, BarChart3, Settings
} from 'lucide-react';
import HeatmapLayer from '../components/HeatmapLayer';
import FootprintAnalytics from '../components/FootprintAnalytics';
import footprintService from '../services/footprintService';
import { useAuth } from '../context/AuthContext';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom crowd level icons
const createCrowdIcon = (level, count) => {
  const colors = {
    low: '#22c55e',
    medium: '#eab308', 
    high: '#f97316',
    critical: '#ef4444'
  };
  
  const color = colors[level] || '#6b7280';
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
      ">
        ${count > 999 ? '999+' : count}
      </div>
    `,
    className: 'custom-crowd-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

const Footprints = () => {
  const { user } = useAuth();
  const [footprintData, setFootprintData] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('heatmap'); // heatmap, markers, statistics
  const [selectedArea, setSelectedArea] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Default map center and bounds for requested heatmap area
  const defaultCenter = [14.441781, 120.99996];
  const defaultBounds = {
    lat_min: 14.425741,
    lat_max: 14.457820,
    lng_min: 120.970614,
    lng_max: 121.029305
  };

  const fetchFootprintData = useCallback(async () => {
    try {
      setIsUpdating(true);
      
      // Fetch monitoring areas and statistics in parallel
      const [areasResponse, statsResponse] = await Promise.all([
        footprintService.getMonitoringAreas().catch(() => ({ monitoring_areas: [] })),
        footprintService.getFootprintStatistics().catch(() => ({}))
      ]);

      setFootprintData(areasResponse.monitoring_areas || []);
      setStatistics(statsResponse);
      
      // Try to fetch heatmap data
      try {
        const heatmapResponse = await footprintService.getFootprintHeatmap(defaultBounds);
        setHeatmapData(heatmapResponse.heatmap_data || []);
      } catch (heatmapError) {
        
        // Generate heatmap from monitoring areas
        const sampleHeatmapData = (areasResponse.monitoring_areas || []).map(area => ({
          lat: area.latitude,
          lng: area.longitude,
          intensity: footprintService.getCrowdLevelIntensity(area.crowd_level),
          pedestrian_count: area.pedestrian_count,
          crowd_level: area.crowd_level,
          area_name: area.area_name,
          radius: area.radius_meters
        }));
        setHeatmapData(sampleHeatmapData);
      }
      
      setLastUpdate(new Date());
      setError('');
      
    } catch (err) {
      
      setError('Failed to load footprint data. Please try again.');
    } finally {
      setIsUpdating(false);
      setLoading(false);
    }
  }, []);

  const initializeFootprintMonitoring = async () => {
    try {
      setLoading(true);
      await footprintService.initializeFootprintMonitoring();
      setIsInitialized(true);
      await fetchFootprintData();
    } catch (err) {
      
      setError('Failed to initialize footprint monitoring. Using sample data.');
      
      // Use sample data if initialization fails
      const sampleData = footprintService.generateSampleFootprintData();
      setFootprintData(sampleData);
      setIsInitialized(true);
      setLoading(false);
    }
  };

  const triggerRealtimeUpdate = async () => {
    try {
      setIsUpdating(true);
      await footprintService.updateRealtimeFootprints();
      // Fetch updated data after a short delay
      setTimeout(fetchFootprintData, 1000);
    } catch (err) {
      
      setError('Failed to trigger real-time update.');
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    initializeFootprintMonitoring();
  }, []);

  useEffect(() => {
    if (!autoRefresh || !isInitialized) return;

    const interval = setInterval(fetchFootprintData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [fetchFootprintData, autoRefresh, isInitialized]);

  // WebSocket effect for real-time updates (if available)
  useEffect(() => {
    // This would connect to WebSocket for real-time updates
    // Implementation depends on your WebSocket service
    return () => {
      // Cleanup WebSocket connection
    };
  }, []);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  const getCrowdLevelBadge = (level) => {
    const configs = {
      low: { color: 'bg-green-100 text-green-800', label: 'Low' },
      medium: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
      high: { color: 'bg-orange-100 text-orange-800', label: 'High' },
      critical: { color: 'bg-red-100 text-red-800', label: 'Critical' }
    };
    const config = configs[level] || configs.low;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedestrian Footprints</h1>
          <p className="text-gray-600">Monitor crowd levels and pedestrian traffic patterns</p>
        </div>
        <div className="card text-center py-12">
          <RefreshCw className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500">Initializing footprint monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedestrian Footprints</h1>
          <p className="text-gray-600">Real-time crowd monitoring and pedestrian traffic analysis</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={triggerRealtimeUpdate}
            disabled={isUpdating}
            className="btn btn-primary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>Update</span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn ${autoRefresh ? 'btn-secondary' : 'btn-outline'} flex items-center space-x-2`}
          >
            <Activity className="w-4 h-4" />
            <span>{autoRefresh ? 'Live' : 'Manual'}</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Pedestrians</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total_pedestrians?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapPin className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Monitoring Areas</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.total_monitoring_areas || 0}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Thermometer className="w-8 h-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Temperature</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.average_temperature || 0}Â°C</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Droplets className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Humidity</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.average_humidity || 0}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Selector */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('heatmap')}
            className={`btn ${viewMode === 'heatmap' ? 'btn-primary' : 'btn-outline'} flex items-center space-x-2`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Heatmap</span>
          </button>
          <button
            onClick={() => setViewMode('markers')}
            className={`btn ${viewMode === 'markers' ? 'btn-primary' : 'btn-outline'} flex items-center space-x-2`}
          >
            <MapPin className="w-4 h-4" />
            <span>Areas</span>
          </button>
          <button
            onClick={() => setViewMode('statistics')}
            className={`btn ${viewMode === 'statistics' ? 'btn-primary' : 'btn-outline'} flex items-center space-x-2`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map View */}
        <div className="lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="h-96 sm:h-[500px]">
              <MapContainer
                center={defaultCenter}
                zoom={13}
                className="h-full w-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* Heatmap Layer */}
                {viewMode === 'heatmap' && heatmapData.length > 0 && (
                  <HeatmapLayer data={heatmapData} />
                )}
                
                {/* Area Markers */}
                {(viewMode === 'markers' || viewMode === 'heatmap') && footprintData.map((area) => (
                  <React.Fragment key={area.id}>
                    <Marker
                      position={[area.latitude, area.longitude]}
                      icon={createCrowdIcon(area.crowd_level, area.pedestrian_count)}
                      eventHandlers={{
                        click: () => setSelectedArea(area)
                      }}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg">{area.area_name}</h3>
                          <div className="space-y-1 text-sm">
                            <p><strong>Pedestrians:</strong> {area.pedestrian_count}</p>
                            <p><strong>Crowd Level:</strong> {getCrowdLevelBadge(area.crowd_level)}</p>
                            <p><strong>Temperature:</strong> {area.temperature_celsius}Â°C</p>
                            <p><strong>Humidity:</strong> {area.humidity_percent}%</p>
                            <p><strong>Updated:</strong> {formatTimestamp(area.recorded_at)}</p>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Area Circle */}
                    <Circle
                      center={[area.latitude, area.longitude]}
                      radius={area.radius_meters}
                      fillColor={footprintService.getCrowdLevelColor(area.crowd_level)}
                      fillOpacity={0.1}
                      color={footprintService.getCrowdLevelColor(area.crowd_level)}
                      weight={2}
                    />
                  </React.Fragment>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Update Status */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Status
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Last Update:</span>
                <span className="text-gray-600">{formatTimestamp(lastUpdate)}</span>
              </div>
              <div className="flex justify-between">
                <span>Auto Refresh:</span>
                <span className={`font-medium ${autoRefresh ? 'text-green-600' : 'text-gray-600'}`}>
                  {autoRefresh ? 'On' : 'Off'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={`font-medium ${isUpdating ? 'text-blue-600' : 'text-green-600'}`}>
                  {isUpdating ? 'Updating...' : 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Most Crowded Areas */}
          {statistics?.most_crowded_areas && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Most Crowded
              </h3>
              <div className="space-y-3">
                {statistics.most_crowded_areas.slice(0, 5).map((area, index) => (
                  <div key={area.area_name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">{area.area_name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold">{area.pedestrian_count}</span>
                      {getCrowdLevelBadge(area.crowd_level)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crowd Distribution */}
          {statistics?.crowd_distribution && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Crowd Distribution
              </h3>
              <div className="space-y-2">
                {Object.entries(statistics.crowd_distribution).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCrowdLevelBadge(level)}
                    </div>
                    <span className="text-sm font-medium">{count} areas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Statistics View */}
      {viewMode === 'statistics' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Detailed Area Statistics</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Area Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pedestrians
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Crowd Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Temperature
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Humidity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {footprintData.map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {area.area_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {area.pedestrian_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getCrowdLevelBadge(area.crowd_level)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {area.temperature_celsius}Â°C
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {area.humidity_percent}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(area.recorded_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footprint Analytics Section */}
      <FootprintAnalytics 
        footprintData={footprintData}
        statistics={statistics}
      />
    </div>
  );
};

export default Footprints;
