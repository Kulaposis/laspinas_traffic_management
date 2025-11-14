import React, { useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, AlertCircle, MapPin, Clock, Car, Filter, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import trafficService from '../services/trafficService';

/**
 * Filter traffic data to show recent data (today's data preferred, last 24 hours as fallback)
 * Same filtering logic as Traffic Insights for consistency
 */
const filterTodayData = (data) => {
  if (!Array.isArray(data)) return [];
  
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today (00:00:00)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow (00:00:00)
  
  const todayData = [];
  const recentData = [];
  
  data.forEach(item => {
    // Check various timestamp fields that might exist in the data
    const timestamp = item.created_at || item.timestamp || item.updated_at || item.last_updated || item.date;
    if (!timestamp) {
      recentData.push(item);
      return;
    }
    
    try {
      const itemDate = new Date(timestamp);
      
      // Validate the date is valid
      if (isNaN(itemDate.getTime())) {
        recentData.push(item);
        return;
      }
      
      // Prioritize today's data
      if (itemDate >= today && itemDate < tomorrow) {
        todayData.push(item);
      } else if (itemDate >= last24Hours) {
        // Include data from last 24 hours as fallback
        recentData.push(item);
      }
    } catch (error) {
      console.warn('Invalid date in traffic data:', timestamp, error);
      recentData.push(item);
    }
  });
  
  // Return today's data if available, otherwise return recent data (last 24 hours)
  return todayData.length > 0 ? todayData : recentData;
};

/**
 * TrafficMonitoringPanel - Modern, responsive panel for displaying real-time traffic data
 * Mobile-friendly and desktop-friendly with modern UI/UX
 */
const TrafficMonitoringPanel = ({ 
  isOpen, 
  onClose, 
  mapCenter = [14.4504, 121.0170],
  mapBounds = null 
}) => {
  const { isDarkMode } = useDarkMode();
  const [trafficData, setTrafficData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    freeFlow: 0,
    light: 0,
    moderate: 0,
    heavy: 0,
    severe: 0
  });

  // Fetch traffic data - Use same direct TomTom API as Traffic Insights
  const fetchTrafficData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the same direct TomTom API endpoint as Traffic Insights
      // This fetches real-time data directly from TomTom API (bypasses database)
      let data = [];
      
      try {
        // Build bounds from mapBounds if available (same format as Traffic Insights)
        const boundsForApi = mapBounds ? {
          minLat: mapBounds.getSouth(),
          maxLat: mapBounds.getNorth(),
          minLng: mapBounds.getWest(),
          maxLng: mapBounds.getEast()
        } : null;
        
        // Fetch directly from TomTom API (same as Traffic Insights)
        data = await trafficService.getRealtimeTrafficDirect(boundsForApi);
        console.log('✅ Traffic Monitoring: Fetched data directly from TomTom API:', data?.length || 0, 'records');
      } catch (directApiError) {
        // Handle timeout errors gracefully
        if (directApiError.message?.includes('timeout') || directApiError.code === 'ECONNABORTED') {
          console.warn('⏱️ Traffic Monitoring: Request timeout, falling back to database...');
        } else if (directApiError.response?.status !== 404) {
          console.warn('Traffic Monitoring: Failed to fetch from TomTom API directly:', directApiError.message);
        }
        
        // Fallback to database if direct API call fails
        try {
          data = await trafficService.getTrafficMonitoring({
            limit: 200
          });
          if (data?.length > 0) {
            console.log('Traffic Monitoring: Fetched data from database (fallback):', data.length, 'records');
          }
        } catch (dbError) {
          console.error('Traffic Monitoring: Failed to fetch from database as well:', dbError);
          data = [];
        }
      }
      
      // Filter to show recent data (today's data preferred, last 24 hours as fallback)
      // Use same filtering logic as Traffic Insights
      const filteredTodayData = filterTodayData(Array.isArray(data) ? data : []);
      setTrafficData(filteredTodayData);
      setLastUpdate(new Date());
    } catch (err) {
      setError('Failed to load traffic data. Please try again.');
      setTrafficData([]);
    } finally {
      setLoading(false);
    }
  }, [mapBounds]);

  // Calculate statistics
  useEffect(() => {
    const calculateStats = () => {
      const newStats = {
        total: filteredData.length,
        freeFlow: 0,
        light: 0,
        moderate: 0,
        heavy: 0,
        severe: 0
      };

      filteredData.forEach(item => {
        const status = (item.traffic_status || item.status || 'moderate').toLowerCase();
        if (status === 'free_flow' || status === 'freeflow') {
          newStats.freeFlow++;
        } else if (status === 'light') {
          newStats.light++;
        } else if (status === 'moderate') {
          newStats.moderate++;
        } else if (status === 'heavy') {
          newStats.heavy++;
        } else if (status === 'severe' || status === 'standstill') {
          newStats.severe++;
        }
      });

      setStats(newStats);
    };

    calculateStats();
  }, [filteredData]);

  // Filter data based on selected filter
  useEffect(() => {
    if (selectedFilter === 'all') {
      setFilteredData(trafficData);
    } else {
      setFilteredData(
        trafficData.filter(item => {
          const status = (item.traffic_status || item.status || 'moderate').toLowerCase();
          return status === selectedFilter;
        })
      );
    }
  }, [trafficData, selectedFilter]);

  // Fetch data only when panel is opened, then refresh every 20 minutes if auto-refresh is enabled
  useEffect(() => {
    if (!isOpen) return;

    // Fetch immediately when panel opens
    fetchTrafficData();

    // Set up auto-refresh every 20 minutes (1200000 ms) if enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchTrafficData();
      }, 20 * 60 * 1000); // 20 minutes = 1,200,000 milliseconds

      return () => clearInterval(interval);
    }
  }, [isOpen, autoRefresh, fetchTrafficData]);

  // Toggle item expansion
  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // Get traffic status color
  const getStatusColor = (status) => {
    const s = (status || 'moderate').toLowerCase();
    if (isDarkMode) {
      if (s === 'free_flow' || s === 'freeflow') return 'bg-green-900/30 text-green-300 border-green-700';
      if (s === 'light') return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
      if (s === 'moderate') return 'bg-orange-900/30 text-orange-300 border-orange-700';
      if (s === 'heavy') return 'bg-red-900/30 text-red-300 border-red-700';
      if (s === 'severe' || s === 'standstill') return 'bg-red-900/50 text-red-200 border-red-600';
      return 'bg-gray-800 text-gray-300 border-gray-700';
    } else {
      if (s === 'free_flow' || s === 'freeflow') return 'bg-green-100 text-green-800 border-green-300';
      if (s === 'light') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      if (s === 'moderate') return 'bg-orange-100 text-orange-800 border-orange-300';
      if (s === 'heavy') return 'bg-red-100 text-red-800 border-red-300';
      if (s === 'severe' || s === 'standstill') return 'bg-red-200 text-red-900 border-red-400';
      return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get traffic status icon
  const getStatusIcon = (status) => {
    const s = (status || 'moderate').toLowerCase();
    if (s === 'free_flow' || s === 'freeflow') return <TrendingDown className={`w-4 h-4 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />;
    if (s === 'light' || s === 'moderate') return <Car className={`w-4 h-4 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />;
    return <AlertCircle className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />;
  };

  // Format timestamp - only show time for today's data
  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // Validate date
      if (isNaN(date.getTime())) return 'Invalid date';
      
      // Check if it's today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const itemDate = new Date(date);
      itemDate.setHours(0, 0, 0, 0);
      const isToday = itemDate.getTime() === today.getTime();
      
      if (isToday) {
        // For today's data, show relative time
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        // If somehow more than 24 hours but still today, show time
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else {
        // For non-today data (shouldn't happen after filtering, but just in case)
        // Show full date
        return date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.warn('Error formatting timestamp:', timestamp, error);
      return 'Invalid date';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative w-full h-[85vh] sm:h-[80vh] sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto animate-slide-up ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Traffic Monitoring</h2>
                <p className="text-xs sm:text-sm text-blue-100">
                  {lastUpdate ? `Updated ${formatTime(lastUpdate)}` : 'Loading...'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-colors ${
                  autoRefresh ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 hover:bg-white/20'
                }`}
                title={autoRefresh ? 'Auto-refresh ON (every 20 min)' : 'Auto-refresh OFF'}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh ? '' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className={`flex-shrink-0 px-4 sm:px-6 py-4 border-b ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <StatCard label="Total" value={stats.total} color="blue" isDarkMode={isDarkMode} />
            <StatCard label="Free Flow" value={stats.freeFlow} color="green" isDarkMode={isDarkMode} />
            <StatCard label="Light" value={stats.light} color="yellow" isDarkMode={isDarkMode} />
            <StatCard label="Moderate" value={stats.moderate} color="orange" isDarkMode={isDarkMode} />
            <StatCard label="Heavy" value={stats.heavy + stats.severe} color="red" isDarkMode={isDarkMode} />
          </div>
        </div>

        {/* Filters */}
        <div className={`flex-shrink-0 px-4 sm:px-6 py-3 border-b ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            <Filter className={`w-4 h-4 flex-shrink-0 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`} />
            {['all', 'free_flow', 'light', 'moderate', 'heavy', 'severe'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  selectedFilter === filter
                    ? 'bg-blue-600 text-white shadow-md'
                    : (isDarkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                }`}
              >
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading && trafficData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Loading traffic data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <AlertCircle className={`w-12 h-12 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
              <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error}</p>
              <button
                onClick={fetchTrafficData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <MapPin className={`w-12 h-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <p className={`text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>No traffic data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredData.map((item, index) => {
                const isExpanded = expandedItems.has(item.id || index);
                const status = item.traffic_status || item.status || 'moderate';
                const roadName = item.road_name || item.roadName || 'Unknown Road';
                const barangay = item.barangay || 'Unknown Area';
                const roadType = item.road_type || item.roadType || 'unknown';
                
                return (
                  <div
                    key={item.id || index}
                    className={`rounded-xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${
                      isDarkMode
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => toggleExpand(item.id || index)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            {getStatusIcon(status)}
                            <h3 className={`font-semibold truncate ${
                              isDarkMode ? 'text-gray-100' : 'text-gray-900'
                            }`}>{roadName}</h3>
                          </div>
                          <div className={`flex flex-wrap items-center gap-2 text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{barangay}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(item.created_at || item.timestamp)}</span>
                            </span>
                            <span className="capitalize">{roadType.toLowerCase()}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                            {status.replace('_', ' ')}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          ) : (
                            <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className={`px-4 pb-4 border-t ${
                        isDarkMode
                          ? 'border-gray-700 bg-gray-800'
                          : 'border-gray-100 bg-gray-50'
                      }`}>
                        <div className="pt-4 space-y-3">
                          <DetailRow label="Road Type" value={roadType} isDarkMode={isDarkMode} />
                          <DetailRow label="Location" value={`${item.latitude?.toFixed(6)}, ${item.longitude?.toFixed(6)}`} isDarkMode={isDarkMode} />
                          {item.average_speed && (
                            <DetailRow label="Average Speed" value={`${item.average_speed} km/h`} isDarkMode={isDarkMode} />
                          )}
                          {item.vehicle_count && (
                            <DetailRow label="Vehicle Count" value={item.vehicle_count} isDarkMode={isDarkMode} />
                          )}
                          {item.confidence_score && (
                            <DetailRow label="Confidence" value={`${(item.confidence_score * 100).toFixed(0)}%`} isDarkMode={isDarkMode} />
                          )}
                          {item.description && (
                            <div>
                              <p className={`text-xs font-medium mb-1 ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                              }`}>Description</p>
                              <p className={`text-sm ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>{item.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex-shrink-0 px-4 sm:px-6 py-3 border-t ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <button
            onClick={fetchTrafficData}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, color, isDarkMode = false }) => {
  const colorClasses = isDarkMode
    ? {
        blue: 'bg-blue-900/30 text-blue-300 border-blue-700',
        green: 'bg-green-900/30 text-green-300 border-green-700',
        yellow: 'bg-yellow-900/30 text-yellow-300 border-yellow-700',
        orange: 'bg-orange-900/30 text-orange-300 border-orange-700',
        red: 'bg-red-900/30 text-red-300 border-red-700'
      }
    : {
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        orange: 'bg-orange-50 text-orange-700 border-orange-200',
        red: 'bg-red-50 text-red-700 border-red-200'
      };

  return (
    <div className={`p-2 sm:p-3 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
      <p className={`text-xs mb-1 ${
        isDarkMode ? 'text-gray-400' : 'text-gray-600'
      }`}>{label}</p>
      <p className={`text-lg sm:text-xl font-bold ${
        isDarkMode ? 'text-gray-100' : 'text-gray-900'
      }`}>{value}</p>
    </div>
  );
};

// Detail Row Component
const DetailRow = ({ label, value, isDarkMode = false }) => (
  <div className="flex justify-between items-center">
    <span className={`text-xs font-medium ${
      isDarkMode ? 'text-gray-400' : 'text-gray-600'
    }`}>{label}</span>
    <span className={`text-sm font-medium ${
      isDarkMode ? 'text-gray-100' : 'text-gray-900'
    }`}>{value}</span>
  </div>
);

export default TrafficMonitoringPanel;
