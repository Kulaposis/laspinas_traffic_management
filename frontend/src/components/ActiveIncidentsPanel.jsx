import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Construction,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Navigation,
  ExternalLink,
  TrendingUp,
  Info,
  RefreshCw
} from 'lucide-react';
import roadworksService from '../services/roadworksService';
import trafficService from '../services/trafficService';

const ActiveIncidentsPanel = ({ 
  isOpen, 
  onClose, 
  incidents = [], 
  roadworks = [],
  onIncidentClick,
  mapRef,
  mapCenter
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'roadwork', 'incident', 'high', 'medium', 'low'
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [localRoadworks, setLocalRoadworks] = useState(roadworks || []);
  const [localIncidents, setLocalIncidents] = useState(incidents || []);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data function
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch roadworks directly
      const roadworksData = await roadworksService.getActiveRoadworks().catch(() => []);
      if (Array.isArray(roadworksData) && roadworksData.length > 0) {
        setLocalRoadworks(roadworksData);
      } else if (Array.isArray(roadworksData)) {
        // Even if empty, update to clear old data
        setLocalRoadworks([]);
      }

      // Fetch incidents if mapCenter is available
      if (mapCenter && Array.isArray(mapCenter) && mapCenter.length >= 2) {
        const incidentsData = await trafficService.getNearbyIncidents(
          { lat: mapCenter[0], lng: mapCenter[1] }, 
          10
        ).catch(() => []);
        if (Array.isArray(incidentsData) && incidentsData.length > 0) {
          setLocalIncidents(incidentsData);
        } else if (Array.isArray(incidentsData)) {
          // Even if empty, update to clear old data
          setLocalIncidents([]);
        }
      }
    } catch (error) {
      console.error('Error fetching incidents data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapCenter]);

  // Fetch data when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Update local state when props change (but prefer local fetched data)
  useEffect(() => {
    // Only update if we don't have local data yet
    if (roadworks && roadworks.length > 0 && localRoadworks.length === 0) {
      setLocalRoadworks(roadworks);
    }
    if (incidents && incidents.length > 0 && localIncidents.length === 0) {
      setLocalIncidents(incidents);
    }
  }, [roadworks, incidents, localRoadworks.length, localIncidents.length]);

  // Combine incidents and roadworks - use local state if available, otherwise props
  const allItems = useMemo(() => {
    const roadworksToUse = localRoadworks.length > 0 ? localRoadworks : (roadworks || []);
    const incidentsToUse = localIncidents.length > 0 ? localIncidents : (incidents || []);
    
    const combined = [
      ...(roadworksToUse || []).map(r => ({
        ...r,
        type: 'roadwork',
        id: r.id || `roadwork-${r.latitude}-${r.longitude}`,
        title: r.title,
        description: r.description,
        severity: r.severity || 'medium',
        latitude: r.latitude,
        longitude: r.longitude,
        created_at: r.created_at,
        incident_type: r.incident_type || 'road_work'
      })),
      ...(incidentsToUse || []).map(i => ({
        ...i,
        type: 'incident',
        id: i.id || `incident-${i.latitude}-${i.longitude}`,
        title: i.title || i.type?.replace('_', ' ') || 'Traffic Incident',
        description: i.description,
        severity: i.severity || 'medium',
        latitude: i.latitude,
        longitude: i.longitude,
        created_at: i.created_at || i.timestamp
      }))
    ];

    // Filter by selected filter
    let filtered = combined;
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'roadwork') {
        filtered = combined.filter(item => item.type === 'roadwork');
      } else if (selectedFilter === 'incident') {
        filtered = combined.filter(item => item.type === 'incident');
      } else {
        filtered = combined.filter(item => item.severity === selectedFilter);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.incident_type?.toLowerCase().includes(query)
      );
    }

    // Sort by severity (critical/high first) and then by date
    return filtered.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aSeverity = severityOrder[a.severity] || 2;
      const bSeverity = severityOrder[b.severity] || 2;
      if (aSeverity !== bSeverity) return bSeverity - aSeverity;
      const aDate = new Date(a.created_at || 0);
      const bDate = new Date(b.created_at || 0);
      return bDate - aDate;
    });
  }, [localRoadworks, localIncidents, roadworks, incidents, selectedFilter, searchQuery]);

  const getSeverityConfig = (severity) => {
    const configs = {
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-300',
        text: 'text-red-800',
        badge: 'bg-red-600 text-white',
        icon: 'bg-red-100 text-red-600',
        dot: 'bg-red-500'
      },
      high: {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        text: 'text-orange-800',
        badge: 'bg-orange-600 text-white',
        icon: 'bg-orange-100 text-orange-600',
        dot: 'bg-orange-500'
      },
      medium: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        badge: 'bg-yellow-600 text-white',
        icon: 'bg-yellow-100 text-yellow-600',
        dot: 'bg-yellow-500'
      },
      low: {
        bg: 'bg-green-50',
        border: 'border-green-300',
        text: 'text-green-800',
        badge: 'bg-green-600 text-white',
        icon: 'bg-green-100 text-green-600',
        dot: 'bg-green-500'
      }
    };
    return configs[severity] || configs.medium;
  };

  const getTypeIcon = (type, incidentType) => {
    if (type === 'roadwork' || incidentType === 'road_work') {
      return <Construction className="w-5 h-5" />;
    }
    return <AlertTriangle className="w-5 h-5" />;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleItemClick = (item) => {
    if (onIncidentClick) {
      onIncidentClick(item);
    }
    
    // Zoom to location on map
    if (mapRef?.current && item.latitude && item.longitude) {
      mapRef.current.setView([item.latitude, item.longitude], 15, {
        animate: true,
        duration: 0.5
      });
    }

    // Toggle expanded state
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(item.id)) {
      newExpanded.delete(item.id);
    } else {
      newExpanded.add(item.id);
    }
    setExpandedItems(newExpanded);
  };

  const handleNavigate = (item, e) => {
    e.stopPropagation();
    if (item.latitude && item.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
      window.open(url, '_blank');
    }
  };

  if (!isOpen) return null;

  const stats = {
    total: allItems.length,
    roadworks: allItems.filter(i => i.type === 'roadwork').length,
    incidents: allItems.filter(i => i.type === 'incident').length,
    critical: allItems.filter(i => i.severity === 'critical').length,
    high: allItems.filter(i => i.severity === 'high').length
  };

  return (
    <div
      className={`fixed left-0 right-0 sm:left-auto sm:right-4 z-[60] transition-all duration-300 ${
        isMinimized
          ? 'bottom-0 sm:bottom-4 h-14 sm:h-15'
          : 'bottom-0 sm:top-20 sm:bottom-auto h-[80vh] sm:h-[calc(100vh-6rem)]'
      } sm:w-[440px]`}
    >
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 h-full flex flex-col ${
        isMinimized ? 'rounded-b-none' : ''
      }`}>
        {/* Header - Compact on mobile */}
        <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2.5 sm:p-4 sm:p-5 rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-center justify-between mb-2 sm:mb-0">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg sm:rounded-xl flex-shrink-0">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg sm:text-xl font-bold truncate">Active Incidents</h2>
                <p className="text-[10px] sm:text-xs sm:text-sm text-blue-100 truncate">
                  {stats.total} {stats.total === 1 ? 'incident' : 'incidents'} in Las Piñas
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
                aria-label="Refresh"
                title="Refresh incidents"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors touch-manipulation"
                aria-label={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-white/20 active:bg-white/30 rounded-lg transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Stats Bar - Compact on mobile, only show when not minimized */}
          {!isMinimized && (
            <div className="mt-2 sm:mt-4 grid grid-cols-4 gap-1.5 sm:gap-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 sm:p-3 text-center">
                <div className="text-[10px] sm:text-xs text-blue-100 font-medium">Total</div>
                <div className="text-base sm:text-lg sm:text-xl font-bold leading-tight">{stats.total}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 sm:p-3 text-center">
                <div className="text-[10px] sm:text-xs text-blue-100 font-medium">Roadworks</div>
                <div className="text-base sm:text-lg sm:text-xl font-bold leading-tight">{stats.roadworks}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 sm:p-3 text-center">
                <div className="text-[10px] sm:text-xs text-blue-100 font-medium">Incidents</div>
                <div className="text-base sm:text-lg sm:text-xl font-bold leading-tight">{stats.incidents}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-1.5 sm:p-2 sm:p-3 text-center">
                <div className="text-[10px] sm:text-xs text-blue-100 font-medium">Critical</div>
                <div className="text-base sm:text-lg sm:text-xl font-bold leading-tight text-red-200">{stats.critical + stats.high}</div>
              </div>
            </div>
          )}
        </div>

        {!isMinimized && (
          <>
            {/* Search and Filters - Mobile optimized */}
            <div className="flex-shrink-0 px-3 py-2.5 sm:p-4 border-b border-gray-200 bg-gray-50">
              {/* Search */}
              <div className="mb-2.5 sm:mb-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-2.5 border border-gray-300 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base touch-manipulation"
                  />
                  <Filter className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Filter Chips - Larger touch targets on mobile */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  { id: 'all', label: 'All', count: stats.total },
                  { id: 'roadwork', label: 'Roadworks', count: stats.roadworks },
                  { id: 'incident', label: 'Incidents', count: stats.incidents },
                  { id: 'high', label: 'High Priority', count: stats.critical + stats.high }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedFilter(filter.id)}
                    className={`px-3 py-2 sm:px-3 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all touch-manipulation active:scale-95 ${
                      selectedFilter === filter.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-300 active:bg-gray-100'
                    }`}
                  >
                    <span className="hidden sm:inline">{filter.label}</span>
                    <span className="sm:hidden">{filter.label.split(' ')[0]}</span>
                    {filter.count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs ${
                        selectedFilter === filter.id ? 'bg-white/20' : 'bg-gray-100'
                      }`}>
                        {filter.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content - Mobile optimized */}
            <div className="flex-1 overflow-y-auto px-3 py-2.5 sm:p-4 space-y-2.5 sm:space-y-3 modern-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-12 text-gray-500">
                  <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500 animate-spin mb-3" />
                  <p className="font-medium text-sm sm:text-base">Loading incidents...</p>
                  <p className="text-xs sm:text-sm mt-1 text-gray-400">Fetching the latest road conditions</p>
                </div>
              ) : allItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-12 text-gray-500">
                  <div className="bg-green-100 p-3 sm:p-4 rounded-full mb-3 sm:mb-4">
                    <Info className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  </div>
                  <p className="font-semibold text-base sm:text-lg mb-1">All Clear!</p>
                  <p className="text-xs sm:text-sm text-center px-4">No active incidents in your area</p>
                </div>
              ) : (
                allItems.map((item) => {
                  const config = getSeverityConfig(item.severity);
                  const isExpanded = expandedItems.has(item.id);
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`${config.bg} ${config.border} border-2 rounded-xl sm:rounded-xl p-3 sm:p-4 cursor-pointer transition-all duration-200 active:scale-[0.98] touch-manipulation ${
                        isExpanded ? 'ring-2 ring-blue-400 shadow-lg' : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5 sm:space-x-3">
                        {/* Icon - Smaller on mobile */}
                        <div className={`${config.icon} p-2 sm:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0`}>
                          {getTypeIcon(item.type, item.incident_type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                            <div className="flex-1 min-w-0 pr-2">
                              <h3 className={`font-bold text-sm sm:text-base ${config.text} mb-1.5 sm:mb-1 line-clamp-2 leading-snug`}>
                                {item.title}
                              </h3>
                              <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-1">
                                <span className={`${config.badge} px-2 py-1 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase leading-tight`}>
                                  {item.severity}
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-600 bg-white px-2 py-1 sm:py-0.5 rounded-full leading-tight">
                                  {item.type === 'roadwork' ? '🚧 Roadwork' : '⚠️ Incident'}
                                </span>
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                            )}
                          </div>

                          {/* Description - Always show first line */}
                          {item.description && (
                            <p className={`text-xs sm:text-sm text-gray-700 mb-2 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                              {item.description}
                            </p>
                          )}

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-gray-300 space-y-2.5 sm:space-y-2">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-1 sm:space-y-0 text-xs text-gray-600">
                                <div className="flex items-center space-x-1.5">
                                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                  <span>Reported: {formatTimeAgo(item.created_at)}</span>
                                </div>
                                {item.latitude && item.longitude && (
                                  <div className="flex items-center space-x-1.5">
                                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span className="text-[10px] sm:text-xs">
                                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons - Full width on mobile */}
                              <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 pt-1 sm:pt-2">
                                {item.latitude && item.longitude && (
                                  <>
                                    <button
                                      onClick={(e) => handleNavigate(item, e)}
                                      className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg active:bg-blue-700 sm:hover:bg-blue-700 transition-colors text-sm font-medium touch-manipulation active:scale-95"
                                    >
                                      <Navigation className="w-4 h-4 flex-shrink-0" />
                                      <span>Navigate</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (mapRef?.current) {
                                          mapRef.current.setView([item.latitude, item.longitude], 16, {
                                            animate: true,
                                            duration: 0.5
                                          });
                                        }
                                        setIsMinimized(true);
                                      }}
                                      className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg active:bg-gray-300 sm:hover:bg-gray-300 transition-colors text-sm font-medium touch-manipulation active:scale-95"
                                    >
                                      <MapPin className="w-4 h-4 flex-shrink-0" />
                                      <span>View on Map</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActiveIncidentsPanel;

