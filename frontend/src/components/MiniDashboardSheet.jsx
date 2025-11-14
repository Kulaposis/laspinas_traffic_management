import React, { useState, useMemo, useEffect } from 'react';
import { Car, TrendingUp, TrendingDown, AlertCircle, Clock, X } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import enhancedGeocodingService from '../services/enhancedGeocodingService';

/**
 * Filter traffic data to show only today's data
 * Removes any data from past dates to ensure only current/present day data is shown
 */
const filterTodayData = (data) => {
  if (!Array.isArray(data)) return [];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today (00:00:00)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow (00:00:00)
  
  return data.filter(item => {
    // Check various timestamp fields that might exist in the data
    const timestamp = item.created_at || item.timestamp || item.updated_at || item.last_updated || item.date;
    if (!timestamp) return false;
    
    try {
      const itemDate = new Date(timestamp);
      
      // Validate the date is valid
      if (isNaN(itemDate.getTime())) return false;
      
      // Only include items from today (between start of today and start of tomorrow)
      // This ensures we only show current day data, not past dates
      return itemDate >= today && itemDate < tomorrow;
    } catch (error) {
      console.warn('Invalid date in traffic data:', timestamp, error);
      return false;
    }
  });
};

const MiniDashboardSheet = ({
  isOpen,
  onClose,
  onOpenDashboard,
  stats = {},
  updates = [],
  trafficData = [], // Traffic monitoring data
  align = 'left', // 'left' | 'center' | 'right'
  isLive = true,
  lastUpdated = null,
  onSelectUpdate = null,
  isLoading = false, // Loading state when fetching traffic data
}) => {
  const {
    activeIncidents = 0,
    totalReports = 0,
    trafficCondition = 'normal',
  } = stats;

  // Calculate traffic insights and generate analytical insights
  const { insights: trafficInsights, analyticalInsights } = useMemo(() => {
    // Use all traffic data passed in (already filtered on TrafficMap side)
    // This ensures we show all available traffic data in insights
    const dataToAnalyze = trafficData || [];
    
    if (!dataToAnalyze || dataToAnalyze.length === 0) {
      return {
        insights: {
          total: 0,
          freeFlow: 0,
          light: 0,
          moderate: 0,
          heavy: 0,
          severe: 0,
          averageSpeed: 0,
          peakHours: [],
          congestionPercentage: 0,
        },
        analyticalInsights: [
          {
            type: 'info',
            message: 'Insufficient traffic data available. Check back later for insights.',
          },
        ],
      };
    }
    const total = dataToAnalyze.length;

    const insights = {
      total,
      freeFlow: 0,
      light: 0,
      moderate: 0,
      heavy: 0,
      severe: 0,
      averageSpeed: 0,
      peakHours: [],
      congestionPercentage: 0,
    };

    const speeds = [];
    const hourCounts = {};
    const statusCounts = {};

    dataToAnalyze.forEach(item => {
      const status = (item.traffic_status || item.status || 'moderate').toLowerCase();
      if (status === 'free_flow' || status === 'freeflow') {
        insights.freeFlow++;
        statusCounts['free_flow'] = (statusCounts['free_flow'] || 0) + 1;
      } else if (status === 'light') {
        insights.light++;
        statusCounts['light'] = (statusCounts['light'] || 0) + 1;
      } else if (status === 'moderate') {
        insights.moderate++;
        statusCounts['moderate'] = (statusCounts['moderate'] || 0) + 1;
      } else if (status === 'heavy') {
        insights.heavy++;
        statusCounts['heavy'] = (statusCounts['heavy'] || 0) + 1;
      } else if (status === 'severe' || status === 'standstill') {
        insights.severe++;
        statusCounts['severe'] = (statusCounts['severe'] || 0) + 1;
      }

      // Collect speed data
      if (item.average_speed && typeof item.average_speed === 'number') {
        speeds.push(item.average_speed);
      }

      // Track peak hours
      const timestamp = item.created_at || item.timestamp || Date.now();
      const hour = new Date(timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Calculate average speed
    if (speeds.length > 0) {
      insights.averageSpeed = Math.round(speeds.reduce((sum, s) => sum + s, 0) / speeds.length);
    }

    // Calculate congestion percentage (heavy + severe)
    const congestionCount = insights.heavy + insights.severe;
    insights.congestionPercentage = total > 0 ? Math.round((congestionCount / total) * 100) : 0;

    // Find peak hours (top 3 hours with most traffic data)
    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => {
        const h = parseInt(hour);
        return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      });
    insights.peakHours = sortedHours;

    // Generate analytical insights
    const analyticalInsights = [];

    // Overall traffic condition insight
    const dominantStatus = Object.entries(statusCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'moderate';
    
    if (dominantStatus === 'heavy' || dominantStatus === 'severe') {
      analyticalInsights.push({
        type: 'warning',
        icon: '⚠️',
        message: `Traffic is ${dominantStatus === 'severe' ? 'severely congested' : 'heavy'} today. ${insights.congestionPercentage}% of monitored roads are experiencing heavy to severe traffic conditions.`,
        metrics: {
          congestionRate: `${insights.congestionPercentage}%`,
          affectedRoads: congestionCount,
        },
      });
    } else if (dominantStatus === 'moderate') {
      analyticalInsights.push({
        type: 'info',
        icon: '📊',
        message: `Traffic conditions are moderate today. Most roads are flowing normally with occasional slowdowns.`,
        metrics: {
          normalFlow: `${Math.round(((insights.freeFlow + insights.light) / total) * 100)}%`,
          moderateTraffic: insights.moderate,
        },
      });
    } else {
      analyticalInsights.push({
        type: 'success',
        icon: '✅',
        message: `Traffic is flowing smoothly today. Most monitored roads are experiencing free flow or light traffic conditions.`,
        metrics: {
          smoothFlow: `${Math.round(((insights.freeFlow + insights.light) / total) * 100)}%`,
          freeFlowRoads: insights.freeFlow + insights.light,
        },
      });
    }

    // Peak hours insight
    if (insights.peakHours.length > 0) {
      const peakHoursText = insights.peakHours.length === 1
        ? insights.peakHours[0]
        : insights.peakHours.length === 2
        ? `${insights.peakHours[0]} and ${insights.peakHours[1]}`
        : `${insights.peakHours[0]}, ${insights.peakHours[1]}, and ${insights.peakHours[2]}`;
      
      analyticalInsights.push({
        type: 'info',
        icon: '🕐',
        message: `Peak traffic congestion observed at ${peakHoursText}. Plan your travel accordingly to avoid delays.`,
        metrics: {
          peakHours: insights.peakHours.join(', '),
        },
      });
    }

    // Speed insight
    if (insights.averageSpeed > 0) {
      const speedCategory = insights.averageSpeed < 20 ? 'very slow' 
        : insights.averageSpeed < 35 ? 'slow'
        : insights.averageSpeed < 50 ? 'moderate'
        : 'good';
      
      analyticalInsights.push({
        type: speedCategory === 'very slow' || speedCategory === 'slow' ? 'warning' : 'info',
        icon: '🚗',
        message: `Average traffic speed is ${insights.averageSpeed} km/h (${speedCategory}). ${speedCategory === 'very slow' || speedCategory === 'slow' ? 'Expect longer travel times.' : 'Traffic is moving at a reasonable pace.'}`,
        metrics: {
          avgSpeed: `${insights.averageSpeed} km/h`,
          speedCategory,
        },
      });
    }

    // Traffic distribution insight
    const heavyTrafficCount = insights.heavy + insights.severe;
    if (heavyTrafficCount > 0 && total > 0) {
      const heavyPercentage = Math.round((heavyTrafficCount / total) * 100);
      if (heavyPercentage >= 30) {
        analyticalInsights.push({
          type: 'warning',
          icon: '🚨',
          message: `${heavyPercentage}% of monitored roads are experiencing heavy or severe congestion. Consider alternative routes or adjust travel times.`,
          metrics: {
            heavyTraffic: `${heavyPercentage}%`,
            affectedRoads: heavyTrafficCount,
          },
        });
      }
    }

    return { insights, analyticalInsights };
  }, [trafficData]);

  const { isDarkMode } = useDarkMode();
  const [heightMode, setHeightMode] = useState('peek'); // 'peek' | 'half' | 'full'
  const [locationNames, setLocationNames] = useState(new Map()); // Cache for reverse geocoded names

  // Reverse geocode locations that don't have names
  useEffect(() => {
    if (!trafficData || trafficData.length === 0) return;

    const isGenericName = (name) => {
      if (!name) return true;
      const lower = String(name).toLowerCase().trim();
      return lower.includes('road segment') || 
             lower.includes('segment 0') || 
             lower === 'unknown road' ||
             lower === 'unknown location' ||
             lower === 'unknown area' ||
             lower === '' ||
             lower.startsWith('location (');
    };

    // Find items that need reverse geocoding
    setLocationNames(prevNames => {
      const itemsToGeocode = trafficData.slice(0, 3).filter(item => {
        const roadName = item.road_name || item.roadName;
        const barangay = item.barangay;
        const locationName = item.location_name || item.area_name;
        const lat = item.latitude || item.lat;
        const lng = item.longitude || item.lng;
        
        // Check if we already have a good name
        if (roadName && !isGenericName(roadName)) return false;
        if (barangay && !isGenericName(barangay)) return false;
        if (locationName && !isGenericName(locationName)) return false;
        
        // Need to geocode if we have coordinates but no good name and not already cached
        if (lat && lng) {
          const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
          return !prevNames.has(coordKey);
        }
        
        return false;
      });

      // Reverse geocode each item
      itemsToGeocode.forEach(item => {
        const lat = item.latitude || item.lat;
        const lng = item.longitude || item.lng;
        if (!lat || !lng) return;

        const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        
        enhancedGeocodingService.reverseGeocode(lat, lng)
          .then((results) => {
            if (results && results.length > 0) {
              const result = results[0];
              let name = result.name || 
                        result.address?.freeformAddress ||
                        result.address?.streetName ||
                        (result.address?.municipality || result.address?.city 
                          ? `Traffic Point in ${result.address.municipality || result.address.city}`
                          : null);
              
              if (!name) {
                // Try to build from address parts
                const parts = [];
                if (result.address?.streetName) parts.push(result.address.streetName);
                if (result.address?.municipality) parts.push(result.address.municipality);
                if (parts.length > 0) {
                  name = parts.join(', ');
                } else {
                  name = `Traffic Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                }
              }
              
              // Update cache
              setLocationNames(prev => {
                const newMap = new Map(prev);
                newMap.set(coordKey, name);
                return newMap;
              });
            }
          })
          .catch(() => {
            // On error, set a fallback name
            setLocationNames(prev => {
              const newMap = new Map(prev);
              newMap.set(coordKey, `Traffic Point (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
              return newMap;
            });
          });
      });
      
      return prevNames; // Return unchanged if no new items to geocode
    });
  }, [trafficData]); // Only depend on trafficData, not locationNames to avoid infinite loops

  const containerAlignment = useMemo(() => {
    if (align === 'left') return 'mx-3 sm:ml-4 sm:mr-auto sm:mx-0';
    if (align === 'right') return 'mx-3 sm:mr-4 sm:ml-auto sm:mx-0';
    return 'mx-3 md:mx-auto';
  }, [align]);

  const heightStyle = useMemo(() => {
    // Non-scrollable; include safe area padding for mobile
    const basePad = 12;
    return { paddingBottom: `calc(${basePad}px + env(safe-area-inset-bottom, 0px))` };
  }, [heightMode]);

  const cycleHeight = () => {
    setHeightMode((m) => (m === 'peek' ? 'half' : m === 'half' ? 'full' : 'peek'));
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[60] pointer-events-none`}
      role="dialog"
      aria-modal={isOpen ? 'true' : 'false'}
    >
      {/* Sheet - Glassmorphism (matching Weather & Flood exactly) */}
      <div
        className={`pointer-events-auto relative ${containerAlignment} w-[calc(100%-1.5rem)] sm:w-auto sm:max-w-lg md:max-w-2xl rounded-t-2xl backdrop-blur-xl shadow-2xl border-t border-x transition-transform duration-300 ease-out overflow-hidden ${
          isDarkMode
            ? 'bg-gray-900/98 border-gray-700/30'
            : 'bg-white/98 border-gray-200/30'
        } ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={isOpen ? heightStyle : { minHeight: 0 }}
      >
        {/* Grab handle */}
        <button onClick={cycleHeight} className="flex items-center justify-center w-full py-2 select-none active:opacity-80">
          <div className={`h-1.5 w-12 rounded-full ${
            isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
          }`} />
        </button>

        {/* Header with Gradient Background (matching Weather & Flood) */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg sm:text-xl font-bold">Traffic Insights</h3>
                {isLive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-blue-100">
                {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : `Today • ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 120px)' }}>
          {/* Loading State */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative w-16 h-16">
                <div className={`absolute inset-0 border-4 rounded-full ${
                  isDarkMode ? 'border-blue-800' : 'border-blue-200'
                }`}></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div className="text-center">
                <p className={`text-sm sm:text-base font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>Fetching traffic data...</p>
                <p className={`text-xs mt-1 ${
                  isDarkMode ? 'text-gray-500' : 'text-gray-500'
                }`}>Please wait while we gather the latest insights</p>
              </div>
            </div>
          ) : (
            <>
          {/* Analytical Insights Section - Top Section with Pill Tags */}
          <div className="space-y-3 mb-4">
            {analyticalInsights.map((insight, idx) => {
              // Show main traffic condition insight first with pill tags
              if (idx === 0) {
                return (
                  <div key={idx} className="space-y-2">
                    {/* Pill-shaped metric tags */}
                    {insight.metrics && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {Object.entries(insight.metrics).map(([key, value]) => (
                          <span
                            key={key}
                            className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold ${
                              isDarkMode
                                ? 'bg-blue-900/50 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {key === 'normalFlow' && `Normal flow: ${value}`}
                            {key === 'moderateTraffic' && `${value} roads moderate`}
                            {key === 'smoothFlow' && `Smooth flow: ${value}`}
                            {key === 'freeFlowRoads' && `${value} roads clear`}
                            {key === 'congestionRate' && `Congestion: ${value}`}
                            {key === 'affectedRoads' && `${value} roads affected`}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Main insight message */}
                    <p className={`text-sm sm:text-base font-medium ${
                      insight.type === 'warning'
                        ? (isDarkMode ? 'text-red-300' : 'text-red-900')
                        : insight.type === 'success'
                        ? (isDarkMode ? 'text-green-300' : 'text-green-900')
                        : (isDarkMode ? 'text-gray-100' : 'text-gray-900')
                    }`}>
                      {insight.message}
                    </p>
                  </div>
                );
              }
              
              // Peak hours insight in a card
              if (insight.icon === '🕐') {
                return (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 sm:p-4 ${
                      isDarkMode
                        ? 'bg-blue-900/30 border-blue-700'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Clock className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm sm:text-base font-medium mb-2 ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {insight.message}
                        </p>
                        {insight.metrics && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(insight.metrics).map(([key, value]) => (
                              <span
                                key={key}
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  isDarkMode
                                    ? 'bg-blue-900 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                }`}
                              >
                                {key === 'peakHours' && `Peak: ${value}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Other insights (speed, heavy traffic warnings)
              return (
                <div
                  key={idx}
                  className={`rounded-xl border-l-4 p-3 sm:p-4 ${
                    insight.type === 'warning'
                      ? (isDarkMode
                          ? 'bg-red-900/30 border-red-500'
                          : 'bg-red-50 border-red-400')
                      : (isDarkMode
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-blue-50 border-blue-400')
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{insight.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm sm:text-base font-medium ${
                        insight.type === 'warning'
                          ? (isDarkMode ? 'text-red-300' : 'text-red-900')
                          : (isDarkMode ? 'text-blue-300' : 'text-blue-900')
                      }`}>
                        {insight.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Supporting Data Section */}
          {trafficInsights.total > 0 && (
            <div className={`mt-4 rounded-xl border p-3 sm:p-4 ${
              isDarkMode
                ? 'border-gray-700 bg-gray-800'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <p className={`text-xs sm:text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Supporting Data</p>
              
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-3">
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>{trafficInsights.total}</div>
                  <div className={`text-[10px] sm:text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>Total Roads</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {trafficInsights.averageSpeed > 0 ? `${trafficInsights.averageSpeed}` : 'N/A'}
                  </div>
                  <div className={`text-[10px] sm:text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>Avg km/h</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>{trafficInsights.congestionPercentage}%</div>
                  <div className={`text-[10px] sm:text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>Congested</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl sm:text-2xl font-bold ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    {trafficInsights.freeFlow + trafficInsights.light}
                  </div>
                  <div className={`text-[10px] sm:text-xs mt-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>Clear Roads</div>
                </div>
              </div>
              
              {/* Traffic Status Breakdown - Horizontal Bars */}
              <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                <div className={`flex-1 rounded-lg border p-2 sm:p-2.5 text-center min-w-0 ${
                  isDarkMode
                    ? 'border-green-700 bg-green-900/30'
                    : 'border-green-200 bg-green-50'
                }`}>
                  <div className={`text-base sm:text-lg font-bold ${
                    isDarkMode ? 'text-green-300' : 'text-green-700'
                  }`}>{trafficInsights.freeFlow}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`}>Free</div>
                </div>
                <div className={`flex-1 rounded-lg border p-2 sm:p-2.5 text-center min-w-0 ${
                  isDarkMode
                    ? 'border-yellow-700 bg-yellow-900/30'
                    : 'border-yellow-200 bg-yellow-50'
                }`}>
                  <div className={`text-base sm:text-lg font-bold ${
                    isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                  }`}>{trafficInsights.light}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${
                    isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>Light</div>
                </div>
                <div className={`flex-1 rounded-lg border p-2 sm:p-2.5 text-center min-w-0 ${
                  isDarkMode
                    ? 'border-orange-700 bg-orange-900/30'
                    : 'border-orange-200 bg-orange-50'
                }`}>
                  <div className={`text-base sm:text-lg font-bold ${
                    isDarkMode ? 'text-orange-300' : 'text-orange-700'
                  }`}>{trafficInsights.moderate}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${
                    isDarkMode ? 'text-orange-400' : 'text-orange-600'
                  }`}>Mod</div>
                </div>
                <div className={`flex-1 rounded-lg border p-2 sm:p-2.5 text-center min-w-0 ${
                  isDarkMode
                    ? 'border-red-700 bg-red-900/30'
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className={`text-base sm:text-lg font-bold ${
                    isDarkMode ? 'text-red-300' : 'text-red-700'
                  }`}>{trafficInsights.heavy}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${
                    isDarkMode ? 'text-red-400' : 'text-red-600'
                  }`}>Heavy</div>
                </div>
                <div className={`flex-1 rounded-lg border p-2 sm:p-2.5 text-center min-w-0 ${
                  isDarkMode
                    ? 'border-red-600 bg-red-900/50'
                    : 'border-red-300 bg-red-100'
                }`}>
                  <div className={`text-base sm:text-lg font-bold ${
                    isDarkMode ? 'text-red-200' : 'text-red-800'
                  }`}>{trafficInsights.severe}</div>
                  <div className={`text-[10px] sm:text-xs mt-0.5 ${
                    isDarkMode ? 'text-red-300' : 'text-red-700'
                  }`}>Severe</div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Traffic Updates */}
          <div className="mt-4">
            <p className={`text-xs sm:text-sm font-semibold mb-3 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>Recent traffic updates</p>
            {(() => {
              // Use traffic data as-is (already filtered on TrafficMap side)
              const displayTrafficData = trafficData || [];
              if (updates.length === 0 && (!displayTrafficData || displayTrafficData.length === 0)) {
                return (
                  <div className={`rounded-lg border border-dashed p-4 text-xs sm:text-sm text-center ${
                    isDarkMode
                      ? 'border-gray-700 text-gray-400'
                      : 'border-gray-200 text-gray-500'
                  }`}>
                    No recent traffic updates available.
                  </div>
                );
              }
              return (
                <div className="space-y-2 sm:space-y-3">
                  {/* Show traffic updates if available, otherwise show regular updates */}
                  {displayTrafficData && displayTrafficData.length > 0 ? (
                    displayTrafficData.slice(0, 3).map((item, idx) => {
                    const status = (item.traffic_status || item.status || 'moderate').toLowerCase();
                    
                    // Get a better name for the location - prioritize actual place/road names
                    const getLocationName = () => {
                      const isGenericName = (name) => {
                        if (!name) return true;
                        const lower = String(name).toLowerCase().trim();
                        return lower.includes('road segment') || 
                               lower.includes('segment 0') || 
                               lower === 'unknown road' ||
                               lower === 'unknown location' ||
                               lower === 'unknown area' ||
                               lower === '' ||
                               lower.startsWith('location (');
                      };
                      
                      // Try to combine road name with barangay for better context
                      const roadName = item.road_name || item.roadName;
                      const barangay = item.barangay;
                      const locationName = item.location_name || item.area_name;
                      
                      // Best case: road name + barangay
                      if (roadName && !isGenericName(roadName) && barangay && !isGenericName(barangay)) {
                        return `${roadName}, ${barangay}`;
                      }
                      
                      // Good case: just road name (if not generic)
                      if (roadName && !isGenericName(roadName)) {
                        return roadName;
                      }
                      
                      // Use location/area name if available
                      if (locationName && !isGenericName(locationName)) {
                        return locationName;
                      }
                      
                      // Use barangay if available
                      if (barangay && !isGenericName(barangay)) {
                        return barangay;
                      }
                      
                      // Try street name
                      if (item.street_name && !isGenericName(item.street_name)) {
                        return item.street_name;
                      }
                      
                      // Try address fields
                      if (item.address) {
                        const addr = typeof item.address === 'string' 
                          ? item.address 
                          : item.address.full || item.address.freeformAddress || item.address.streetName;
                        if (addr && !isGenericName(addr)) {
                          return addr;
                        }
                      }
                      
                      // Try description
                      if (item.description && !isGenericName(item.description)) {
                        return item.description;
                      }
                      
                      // If we have coordinates, try to use cached reverse geocoded name
                      const lat = item.latitude || item.lat;
                      const lng = item.longitude || item.lng;
                      if (lat && lng) {
                        const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                        const cachedName = locationNames.get(coordKey);
                        if (cachedName) {
                          return cachedName;
                        }
                        
                        // Try to get municipality or area from address if available
                        const municipality = item.address?.municipality || item.address?.city;
                        if (municipality && !isGenericName(municipality)) {
                          return `Traffic Point in ${municipality}`;
                        }
                        
                        // Return null to trigger reverse geocoding
                        return null;
                      }
                      
                      // Last resort
                      return 'Traffic Monitoring Point';
                    };
                    
                    let roadName = getLocationName();
                    
                    // If no name found and we have coordinates, use cached reverse geocoded name
                    const lat = item.latitude || item.lat;
                    const lng = item.longitude || item.lng;
                    if (!roadName && lat && lng) {
                      const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                      const cachedName = locationNames.get(coordKey);
                      if (cachedName) {
                        roadName = cachedName;
                      } else {
                        // Show a temporary name while geocoding
                        roadName = 'Loading location...';
                      }
                    }
                    const getStatusColor = (s) => {
                      if (isDarkMode) {
                        if (s === 'free_flow' || s === 'freeflow') return 'bg-green-900/30 border-green-500';
                        if (s === 'light') return 'bg-yellow-900/30 border-yellow-500';
                        if (s === 'moderate') return 'bg-orange-900/30 border-orange-500';
                        if (s === 'heavy') return 'bg-red-900/30 border-red-500';
                        if (s === 'severe' || s === 'standstill') return 'bg-red-900/50 border-red-600';
                        return 'bg-blue-900/30 border-blue-500';
                      } else {
                        if (s === 'free_flow' || s === 'freeflow') return 'bg-green-50 border-green-400';
                        if (s === 'light') return 'bg-yellow-50 border-yellow-400';
                        if (s === 'moderate') return 'bg-orange-50 border-orange-400';
                        if (s === 'heavy') return 'bg-red-50 border-red-400';
                        if (s === 'severe' || s === 'standstill') return 'bg-red-100 border-red-500';
                        return 'bg-blue-50 border-blue-400';
                      }
                    };
                    const getStatusIcon = (s) => {
                      if (s === 'free_flow' || s === 'freeflow') return <TrendingDown className={`w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} />;
                      if (s === 'light' || s === 'moderate') return <Car className={`w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`} />;
                      return <AlertCircle className={`w-5 h-5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />;
                    };
                    const getStatusTextColor = (s) => {
                      if (isDarkMode) {
                        if (s === 'free_flow' || s === 'freeflow') return 'text-green-300';
                        if (s === 'light') return 'text-yellow-300';
                        if (s === 'moderate') return 'text-orange-300';
                        if (s === 'heavy') return 'text-red-300';
                        if (s === 'severe' || s === 'standstill') return 'text-red-200';
                        return 'text-gray-300';
                      } else {
                        if (s === 'free_flow' || s === 'freeflow') return 'text-green-700';
                        if (s === 'light') return 'text-yellow-700';
                        if (s === 'moderate') return 'text-orange-700';
                        if (s === 'heavy') return 'text-red-700';
                        if (s === 'severe' || s === 'standstill') return 'text-red-800';
                        return 'text-gray-700';
                      }
                    };
                    return (
                      <div
                        key={item.id || idx}
                        className={`flex items-center gap-3 rounded-xl border-l-4 p-3 sm:p-4 shadow-sm ${getStatusColor(status)}`}
                      >
                        <div className="flex-shrink-0">{getStatusIcon(status)}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm sm:text-base font-semibold truncate ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>{roadName}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs sm:text-sm font-medium capitalize ${getStatusTextColor(status)}`}>
                              {status.replace('_', ' ')}
                            </span>
                            {item.average_speed && (
                              <span className={`text-xs ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>• {item.average_speed} km/h</span>
                            )}
                            <span className={`text-xs ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {item.created_at || item.timestamp ? new Date(item.created_at || item.timestamp).toLocaleTimeString() : ''}
                            </span>
                          </div>
                        </div>
                        {onSelectUpdate && (
                          <button
                            onClick={() => onSelectUpdate({ ...item, type: 'traffic', id: item.id || idx })}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors active:scale-95"
                          >
                            View
                          </button>
                        )}
                      </div>
                    );
                  })
                  ) : (
                  updates.slice(0, 3).map((u) => (
                    <div
                      key={u.id || `${u.type}-${u.timestamp}`}
                      className={`flex items-center gap-3 rounded-xl border-l-4 p-3 sm:p-4 shadow-sm ${
                        u.priority === 'high'
                          ? (isDarkMode ? 'bg-red-900/30 border-red-500' : 'bg-red-50 border-red-400')
                          : u.priority === 'medium'
                          ? (isDarkMode ? 'bg-amber-900/30 border-amber-500' : 'bg-amber-50 border-amber-400')
                          : (isDarkMode ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-400')
                      }`}
                    >
                      <span className="text-lg sm:text-xl flex-shrink-0">{u.icon || '📢'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm sm:text-base font-medium truncate ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>{u.message}</p>
                        <p className={`text-xs mt-1 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {u.timestamp ? new Date(u.timestamp).toLocaleTimeString() : ''}
                        </p>
                      </div>
                      {onSelectUpdate && (
                        <button
                          onClick={() => onSelectUpdate(u)}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors active:scale-95"
                        >
                          View
                        </button>
                      )}
                    </div>
                  ))
                )}
                </div>
              );
            })()}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MiniDashboardSheet;


