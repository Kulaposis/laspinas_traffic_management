import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity,
  AlertTriangle,
  Clock,
  MapPin,
  Navigation,
  TrendingUp,
  TrendingDown,
  Minus,
  Car,
  Construction,
  Droplets,
  Wind,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronRight,
  X,
  Info
} from 'lucide-react';
import trafficService from '../services/trafficService';
import roadworksService from '../services/roadworksService';
import TomTomTileLayer from '../components/TomTomTileLayer';
import { TrafficMonitorSkeleton } from '../components/LoadingSkeleton';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TrafficMonitorNew = () => {
  // State management
  const [trafficData, setTrafficData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showIncidentPanel, setShowIncidentPanel] = useState(false);
  const [mapCenter] = useState([14.4504, 121.0170]); // Las Piñas center
  const [mapZoom] = useState(13);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastScrapeTime, setLastScrapeTime] = useState(null);

  // Cache management
  const cacheRef = React.useRef({
    trafficData: null,
    incidents: null,
    timestamp: null
  });
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Calculate overall traffic status
  const calculateTrafficStatus = () => {
    if (trafficData.length === 0) return { level: 0, label: 'Unknown', color: 'gray' };

    const avgCongestion = trafficData.reduce((sum, road) => {
      const congestionMap = {
        'free_flow': 0,
        'light': 20,
        'moderate': 50,
        'heavy': 75,
        'standstill': 95
      };
      return sum + (congestionMap[road.traffic_status] || 0);
    }, 0) / trafficData.length;

    if (avgCongestion < 20) return { level: 1, label: 'Smooth', color: 'green', emoji: '🟢' };
    if (avgCongestion < 40) return { level: 2, label: 'Light', color: 'yellow', emoji: '🟡' };
    if (avgCongestion < 70) return { level: 3, label: 'Moderate', color: 'orange', emoji: '🟠' };
    if (avgCongestion < 90) return { level: 4, label: 'Heavy', color: 'red', emoji: '🔴' };
    return { level: 5, label: 'Standstill', color: 'purple', emoji: '🟣' };
  };

  const trafficStatus = calculateTrafficStatus();

  // Helper function to process incidents
  const processIncidents = (scrapedData, lasPinasBounds) => {
    return (Array.isArray(scrapedData) ? scrapedData : scrapedData.roadworks || [])
      .filter(incident => {
        // Filter by date (Oct-Nov 2025)
        const incidentDate = new Date(incident.created_at || incident.reported_at || incident.date);
        const isOctNov = incidentDate.getMonth() === 9 || incidentDate.getMonth() === 10;
        const is2025 = incidentDate.getFullYear() === 2025;
        
        // Filter by Las Piñas location
        const inLasPinas = incident.latitude >= lasPinasBounds.lat_min &&
                          incident.latitude <= lasPinasBounds.lat_max &&
                          incident.longitude >= lasPinasBounds.lng_min &&
                          incident.longitude <= lasPinasBounds.lng_max;
        
        return (isOctNov && is2025) || inLasPinas;
      })
      .map(incident => ({
        id: incident.id || `scraped-${Date.now()}-${Math.random()}`,
        title: incident.title || incident.description?.substring(0, 60) || 'Traffic Incident in Las Piñas',
        description: incident.description || incident.content || 'Incident detected via web scraping',
        incident_type: incident.incident_type || incident.type || 'roadwork',
        severity: incident.severity || 'medium',
        latitude: incident.latitude || 14.4504,
        longitude: incident.longitude || 121.0170,
        reported_at: incident.created_at || incident.reported_at || incident.date || new Date().toISOString(),
        source: 'web_scraping',
        source_url: incident.source_url || incident.url,
        is_active: incident.is_active !== false,
        location: incident.location || 'Las Piñas City'
      }));
  };

  // Optimized fetch with caching and parallel loading
  const fetchData = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      // Check cache first
      const now = Date.now();
      const cache = cacheRef.current;
      
      if (cache.timestamp && (now - cache.timestamp) < CACHE_DURATION) {
        const cacheAge = Math.round((now - cache.timestamp) / 1000);
        // instant load from cache
        setTrafficData(cache.trafficData || []);
        setIncidents(cache.incidents || []);
        setLastUpdate(new Date(cache.timestamp));
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      // Define Las Piñas bounds for filtering
      const lasPinasBounds = {
        lat_min: 14.4200,
        lat_max: 14.4700,
        lng_min: 120.9800,
        lng_max: 121.0500
      };
      
      // Parallel fetch with timeout protection (max 10 seconds per call)
      const fetchWithTimeout = (promise, timeoutMs = 10000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
          )
        ]);
      };

      // Fetch traffic data and stored incidents in parallel (fast)
      const [trafficResponse, storedIncidents] = await Promise.allSettled([
        fetchWithTimeout(trafficService.getTrafficMonitoring()),
        fetchWithTimeout(roadworksService.getActiveRoadworks())
      ]);
      
      // Set traffic data immediately
      const traffic = trafficResponse.status === 'fulfilled' ? trafficResponse.value : [];
      setTrafficData(traffic);
      
      // Use stored incidents immediately (don't wait for scraping)
      const stored = storedIncidents.status === 'fulfilled' ? storedIncidents.value : [];
      
      // Check if we should scrape (only every 10 minutes to avoid overload)
      const shouldScrape = !lastScrapeTime || (now - lastScrapeTime) > 10 * 60 * 1000;
      
      let scrapedData = stored;
      
      // Scrape in background if needed (non-blocking)
      if (shouldScrape) {
        const facebookPages = [
          'https://www.facebook.com/laspinascity',
          'https://www.facebook.com/LPCityTrafficManagement',
          'https://www.facebook.com/groups/laspinasresidents'
        ];
        
        // Don't await - scrape in background
        roadworksService.scrapeRoadworks(facebookPages)
          .then(data => {

            setLastScrapeTime(Date.now());
            // Update incidents after scraping completes
            const newIncidents = processIncidents(data, lasPinasBounds);
            setIncidents(newIncidents);
            // Update cache
            cacheRef.current = {
              trafficData: traffic,
              incidents: newIncidents,
              timestamp: Date.now()
            };
          })
          .catch(() => {});
      }
      
      // Process stored incidents immediately
      const incidents = processIncidents(scrapedData, lasPinasBounds);
      setIncidents(incidents);
      setLastUpdate(new Date());
      
      // Update cache
      cacheRef.current = {
        trafficData: traffic,
        incidents,
        timestamp: now
      };
      
      const loadTime = Math.round(performance.now() - startTime);

    } catch (error) {

      // Use cache even if expired on error
      if (cacheRef.current.incidents) {

        setTrafficData(cacheRef.current.trafficData || []);
        setIncidents(cacheRef.current.incidents || []);
      }
    } finally {
      setLoading(false);
    }
  }, [lastScrapeTime, CACHE_DURATION]);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchData, autoRefresh]);

  // Calculate statistics
  const stats = {
    activeRoads: trafficData.length,
    heavyAreas: trafficData.filter(r => ['heavy', 'standstill'].includes(r.traffic_status)).length,
    avgDelay: Math.round(trafficData.reduce((sum, r) => sum + (r.delay_minutes || 0), 0) / (trafficData.length || 1)),
    activeIncidents: incidents.length
  };

  // Get color for traffic status
  const getStatusColor = (status) => {
    const colors = {
      'free_flow': 'bg-green-500',
      'light': 'bg-yellow-500',
      'moderate': 'bg-orange-500',
      'heavy': 'bg-red-500',
      'standstill': 'bg-purple-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusTextColor = (status) => {
    const colors = {
      'free_flow': 'text-green-600',
      'light': 'text-yellow-600',
      'moderate': 'text-orange-600',
      'heavy': 'text-red-600',
      'standstill': 'text-purple-600'
    };
    return colors[status] || 'text-gray-600';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'low': 'bg-green-100 text-green-800 border-green-300',
      'medium': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'high': 'bg-orange-100 text-orange-800 border-orange-300',
      'critical': 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getIncidentIcon = (type) => {
    const icons = {
      'accident': '🚗💥',
      'roadwork': '🚧',
      'flooding': '🌊',
      'breakdown': '⚠️',
      'congestion': '🚦'
    };
    return icons[type] || '⚠️';
  };

  // Format time ago
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Show loading skeleton
  if (loading) {
    return <TrafficMonitorSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Modern Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl shadow-lg">
                <Activity className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Traffic Monitor</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Las Piñas City • Live</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-200 ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                {autoRefresh ? <Eye className="w-4 h-4 sm:w-5 sm:h-5" /> : <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 sm:p-3 bg-blue-100 text-blue-600 rounded-lg sm:rounded-xl hover:bg-blue-200 transition-all duration-200 disabled:opacity-50"
                title="Refresh now"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Hero Status Card */}
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex-1">
                <p className="text-blue-100 text-xs sm:text-sm font-medium mb-2">Current Traffic Status</p>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <span className="text-4xl sm:text-5xl lg:text-6xl">{trafficStatus.emoji}</span>
                  <div>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{trafficStatus.label}</h2>
                    <p className="text-blue-100 text-xs sm:text-sm mt-0.5 sm:mt-1">Level {trafficStatus.level}/5</p>
                  </div>
                </div>
              </div>
              
              {/* Congestion Level Indicator */}
              <div className="hidden sm:flex space-x-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`w-2 sm:w-3 h-12 sm:h-16 rounded-full transition-all duration-300 ${
                      level <= trafficStatus.level
                        ? 'bg-white shadow-lg'
                        : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg sm:rounded-xl mb-2 sm:mb-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">{stats.activeRoads}</p>
                    <p className="text-blue-100 text-xs mt-0.5 sm:mt-1">Active Roads</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg sm:rounded-xl mb-2 sm:mb-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">{stats.heavyAreas}</p>
                    <p className="text-blue-100 text-xs mt-0.5 sm:mt-1">Heavy Areas</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg sm:rounded-xl mb-2 sm:mb-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">{stats.avgDelay}</p>
                    <p className="text-blue-100 text-xs mt-0.5 sm:mt-1">Avg Delay (min)</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg sm:rounded-xl mb-2 sm:mb-0">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="text-2xl sm:text-3xl font-bold">{stats.activeIncidents}</p>
                    <p className="text-blue-100 text-xs mt-0.5 sm:mt-1">Active Incidents</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Last Update */}
            <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between text-blue-100 text-xs sm:text-sm space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Live updates {autoRefresh ? 'enabled' : 'paused'}</span>
              </div>
              <span className="text-xs">Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Map */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Live Traffic Map */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-200">
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Live Traffic Map</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">Color-coded road conditions</p>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">Smooth</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span className="text-gray-600">Light</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-600">Moderate</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-gray-600">Heavy</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="h-[300px] sm:h-[400px] lg:h-[500px] relative">
                <MapContainer
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TomTomTileLayer style="main" />
                  
                  {/* Traffic Circles */}
                  {trafficData.map((road, index) => {
                    const color = road.traffic_status === 'free_flow' ? '#22c55e' :
                                  road.traffic_status === 'light' ? '#eab308' :
                                  road.traffic_status === 'moderate' ? '#f97316' :
                                  road.traffic_status === 'heavy' ? '#ef4444' : '#7c3aed';
                    
                    return (
                      <Circle
                        key={index}
                        center={[road.latitude, road.longitude]}
                        radius={200}
                        pathOptions={{
                          color: color,
                          fillColor: color,
                          fillOpacity: 0.4,
                          weight: 3
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-sm">{road.road_name}</h3>
                            <p className="text-xs text-gray-600 mt-1">
                              Status: <span className={getStatusTextColor(road.traffic_status)}>
                                {road.traffic_status.replace('_', ' ').toUpperCase()}
                              </span>
                            </p>
                            {road.delay_minutes > 0 && (
                              <p className="text-xs text-gray-600">Delay: {road.delay_minutes} min</p>
                            )}
                          </div>
                        </Popup>
                      </Circle>
                    );
                  })}

                  {/* Incident Markers */}
                  {incidents.map((incident) => (
                    <Marker
                      key={incident.id}
                      position={[incident.latitude, incident.longitude]}
                    >
                      <Popup>
                        <div className="p-2">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">{getIncidentIcon(incident.incident_type)}</span>
                            <h3 className="font-bold text-sm">{incident.title}</h3>
                          </div>
                          <p className="text-xs text-gray-600">{incident.description}</p>
                          <p className="text-xs text-gray-500 mt-1">{timeAgo(incident.reported_at)}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Road Status List */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-200">
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Road Conditions</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">Detailed status for each monitored road</p>
              </div>
              
              <div className="p-3 sm:p-6 space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto">
                {trafficData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No traffic data available</p>
                  </div>
                ) : (
                  trafficData.map((road, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl hover:shadow-md transition-all duration-200 border border-gray-200"
                    >
                      <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${getStatusColor(road.traffic_status)} rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
                          <Car className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 truncate">{road.road_name}</h3>
                          <div className="flex items-center space-x-2 sm:space-x-3 mt-1">
                            <span className={`text-xs font-semibold uppercase ${getStatusTextColor(road.traffic_status)}`}>
                              {road.traffic_status.replace('_', ' ')}
                            </span>
                            {road.delay_minutes > 0 && (
                              <span className="text-xs text-gray-500 flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>+{road.delay_minutes}m</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Incidents & Alerts */}
          <div className="space-y-6">
            {/* Active Incidents */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden border border-gray-200">
              <div className="p-4 sm:p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900">Active Incidents</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {incidents.length} active in Las Piñas (Web Scraped)
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-red-100 rounded-xl">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                  </div>
                </div>
              </div>
              
              <div className="p-3 sm:p-6 space-y-3 max-h-[600px] overflow-y-auto">
                {incidents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No active incidents</p>
                    <p className="text-sm mt-1">All clear on the roads!</p>
                  </div>
                ) : (
                  incidents.map((incident) => (
                    <div
                      key={incident.id}
                      onClick={() => {
                        setSelectedIncident(incident);
                        setShowIncidentPanel(true);
                      }}
                      className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${getSeverityColor(incident.severity)}`}
                    >
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <span className="text-xl sm:text-2xl flex-shrink-0">{getIncidentIcon(incident.incident_type)}</span>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm sm:text-base mb-1 line-clamp-2">{incident.title}</h3>
                          <p className="text-xs opacity-80 line-clamp-2">{incident.description}</p>
                          
                          <div className="flex items-center justify-between mt-2 sm:mt-3">
                            <span className="text-xs font-medium opacity-70">
                              {timeAgo(incident.reported_at)}
                            </span>
                            <span className="text-xs font-bold uppercase px-2 py-0.5 sm:py-1 bg-white/50 rounded-full">
                              {incident.severity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Traffic Tips */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white shadow-xl">
              <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="font-bold text-base sm:text-lg">Traffic Tips</h3>
              </div>
              
              <ul className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <li className="flex items-start space-x-2">
                  <span className="text-blue-200 mt-1 flex-shrink-0">•</span>
                  <span className="leading-relaxed">Avoid Alabang-Zapote Road during rush hours (7-9 AM, 5-7 PM)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-200 mt-1 flex-shrink-0">•</span>
                  <span className="leading-relaxed">Use alternative routes through BF Homes for faster travel</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-blue-200 mt-1 flex-shrink-0">•</span>
                  <span className="leading-relaxed">Check for roadworks before planning your trip</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Incident Detail Panel */}
      {showIncidentPanel && selectedIncident && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Incident Details</h2>
              <button
                onClick={() => setShowIncidentPanel(false)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-start space-x-4">
                <span className="text-4xl">{getIncidentIcon(selectedIncident.incident_type)}</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedIncident.title}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getSeverityColor(selectedIncident.severity)}`}>
                    {selectedIncident.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <h4 className="font-bold text-gray-900 mb-2">Description</h4>
                <p className="text-gray-700">{selectedIncident.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-2xl p-4">
                  <p className="text-xs text-blue-600 font-medium mb-1">Type</p>
                  <p className="font-bold text-gray-900 capitalize">{selectedIncident.incident_type.replace('_', ' ')}</p>
                </div>
                
                <div className="bg-purple-50 rounded-2xl p-4">
                  <p className="text-xs text-purple-600 font-medium mb-1">Reported</p>
                  <p className="font-bold text-gray-900">{timeAgo(selectedIncident.reported_at)}</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 text-white">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="w-5 h-5" />
                  <h4 className="font-bold">Location</h4>
                </div>
                <p className="text-sm text-blue-100">
                  {selectedIncident.latitude.toFixed(4)}, {selectedIncident.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficMonitorNew;
