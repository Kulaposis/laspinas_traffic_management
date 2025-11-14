import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Zap,
  Info
} from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import trafficService from '../services/trafficService';

const TrafficPredictionsPanel = ({
  isOpen,
  onClose,
  selectedRoute = null,
  selectedOrigin = null,
  selectedDestination = null
}) => {
  const { isDarkMode } = useDarkMode();
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('predictions'); // 'predictions', 'best-time', 'history'
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop viewport
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Fetch traffic patterns when panel opens
  useEffect(() => {
    if (isOpen && !patterns) {
      loadTrafficPatterns();
    }
  }, [isOpen]);

  const loadTrafficPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trafficService.getTrafficPatterns();
      setPatterns(data);
      if (data.roads && data.roads.length > 0) {
        setSelectedRoad(data.roads[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load traffic patterns');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format time range
  const formatTimeRange = (startHour, endHour) => {
    const formatHour = (hour) => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  };

  // Calculate predictions for different time periods
  const timeBasedPredictions = useMemo(() => {
    if (!patterns || !patterns.data) return null;

    const timePeriods = {
      morning: { start: 6, end: 9, label: 'Morning Rush', color: 'bg-red-500' },
      lunch: { start: 11, end: 14, label: 'Lunch Period', color: 'bg-yellow-500' },
      evening: { start: 16, end: 19, label: 'Evening Rush', color: 'bg-orange-500' }
    };

    const predictions = {};

    Object.entries(timePeriods).forEach(([key, period]) => {
      const periodData = patterns.data.filter(point => {
        const hour = new Date(point.timestamp).getHours();
        return hour >= period.start && hour < period.end;
      });

      if (periodData.length > 0) {
        const avgSpeed = periodData.reduce((sum, p) => sum + p.average_speed_kph, 0) / periodData.length;
        const heavyCongestion = periodData.filter(p => p.congestion_level === 'heavy').length;
        const moderateCongestion = periodData.filter(p => p.congestion_level === 'moderate').length;
        const totalPoints = periodData.length;
        
        const congestionLevel = heavyCongestion / totalPoints > 0.3 ? 'heavy' :
                               moderateCongestion / totalPoints > 0.3 ? 'moderate' : 'low';
        
        const congestionPercentage = ((heavyCongestion + moderateCongestion) / totalPoints) * 100;

        predictions[key] = {
          ...period,
          avgSpeed: Math.round(avgSpeed),
          congestionLevel,
          congestionPercentage: Math.round(congestionPercentage),
          vehicleCount: Math.round(periodData.reduce((sum, p) => sum + p.vehicle_count, 0) / periodData.length),
          timeRange: formatTimeRange(period.start, period.end)
        };
      }
    });

    return predictions;
  }, [patterns]);

  // Calculate best time to leave
  const bestTimeRecommendations = useMemo(() => {
    if (!patterns || !selectedRoute) return null;

    const recommendations = trafficService.calculateBestTimeToLeave(patterns, selectedRoute);
    
    if (!recommendations || !recommendations.recommendations) return null;

    // Get all time slots and find optimal times
    const allTimeSlots = [];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    hours.forEach(hour => {
      const hourData = patterns.data.filter(point => {
        const pointHour = new Date(point.timestamp).getHours();
        return pointHour === hour;
      });

      if (hourData.length > 0) {
        const avgSpeed = hourData.reduce((sum, p) => sum + p.average_speed_kph, 0) / hourData.length;
        const congestionCount = hourData.filter(p => p.congestion_level === 'heavy' || p.congestion_level === 'moderate').length;
        const congestionLevel = congestionCount / hourData.length > 0.5 ? 'heavy' :
                               congestionCount / hourData.length > 0.3 ? 'moderate' : 'low';
        
        allTimeSlots.push({
          hour,
          avgSpeed: Math.round(avgSpeed),
          congestionLevel,
          congestionScore: congestionCount / hourData.length,
          label: `${hour}:00`
        });
      }
    });

    // Find best times (low congestion, good speed)
    const bestTimes = allTimeSlots
      .filter(slot => slot.congestionLevel === 'low' || (slot.congestionLevel === 'moderate' && slot.congestionScore < 0.4))
      .sort((a, b) => b.avgSpeed - a.avgSpeed)
      .slice(0, 3);

    return {
      bestTimes,
      recommendations: recommendations.recommendations
    };
  }, [patterns, selectedRoute]);

  // Get historical pattern data for selected road
  const historicalData = useMemo(() => {
    if (!patterns || !selectedRoad) return null;

    const roadData = patterns.data
      .filter(point => point.road_name === selectedRoad)
      .map(point => ({
        time: new Date(point.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        hour: new Date(point.timestamp).getHours(),
        speed: point.average_speed_kph,
        congestion: point.congestion_level,
        vehicles: point.vehicle_count
      }))
      .sort((a, b) => a.hour - b.hour);

    return roadData;
  }, [patterns, selectedRoad]);

  if (!isOpen) {
    return null;
  }

  const panelContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 transition-opacity duration-300"
        style={{ zIndex: 10001, position: 'fixed' }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      
      {/* Panel - Glassmorphism (matching Weather & Flood) */}
      <div 
        className={`fixed inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:right-4 md:top-20 backdrop-blur-xl rounded-t-3xl md:rounded-2xl shadow-2xl border-t border-x md:border md:max-w-md md:w-96 transform transition-transform duration-300 ease-out ${
          isDarkMode
            ? 'bg-gray-900/98 border-gray-700/30'
            : 'bg-white/98 border-gray-200/30'
        }`}
        style={{ 
          maxHeight: isExpanded ? (isDesktop ? '75vh' : '90vh') : '200px',
          zIndex: 10002,
          position: 'fixed'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
      {/* Header - Glassmorphism */}
      <div className="flex items-center justify-between p-3 md:p-3 border-b border-white/20 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center space-x-2 md:space-x-2">
          <BarChart3 className="w-5 h-5 md:w-5 md:h-5" />
          <h2 className="text-lg md:text-base font-bold">Traffic Predictions</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose(e);
            }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="overflow-y-auto" style={{ maxHeight: isDesktop ? 'calc(75vh - 60px)' : 'calc(90vh - 80px)' }}>
          {loading && (
            <div className="p-6 md:p-4 text-center">
              <div className="animate-spin rounded-full h-10 w-10 md:h-8 md:w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className={`mt-3 md:mt-2 text-sm md:text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>Loading traffic patterns...</p>
            </div>
          )}

          {error && (
            <div className={`p-4 m-4 backdrop-blur-md border rounded-lg shadow-lg ${
              isDarkMode
                ? 'bg-red-900/30 border-red-700/50'
                : 'bg-red-50/70 border-red-200/50'
            }`}>
              <div className="flex items-center space-x-2">
                <AlertCircle className={`w-5 h-5 ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
                <p className={isDarkMode ? 'text-red-300' : 'text-red-800'}>{error}</p>
              </div>
              <button
                onClick={loadTrafficPatterns}
                className={`mt-2 text-sm underline ${
                  isDarkMode
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-red-600 hover:text-red-800'
                }`}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && patterns && (
            <div className="p-4 md:p-3">
              {/* Tabs - Glassmorphism */}
              <div className={`flex space-x-1 md:space-x-1 mb-3 md:mb-2 border-b ${
                isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
              }`}>
                <button
                  onClick={() => setActiveTab('predictions')}
                  className={`px-3 py-1.5 md:px-2 md:py-1.5 text-sm md:text-xs font-medium transition-all rounded-t-lg ${
                    activeTab === 'predictions'
                      ? (isDarkMode
                          ? 'border-b-2 border-blue-500 text-blue-400 bg-blue-900/50 backdrop-blur-sm'
                          : 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/50 backdrop-blur-sm')
                      : (isDarkMode
                          ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/50 backdrop-blur-sm'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50/50 backdrop-blur-sm')
                  }`}
                >
                  Time Predictions
                </button>
                <button
                  onClick={() => setActiveTab('best-time')}
                  className={`px-3 py-1.5 md:px-2 md:py-1.5 text-sm md:text-xs font-medium transition-all rounded-t-lg ${
                    activeTab === 'best-time'
                      ? (isDarkMode
                          ? 'border-b-2 border-blue-500 text-blue-400 bg-blue-900/50 backdrop-blur-sm'
                          : 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/50 backdrop-blur-sm')
                      : (isDarkMode
                          ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/50 backdrop-blur-sm'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50/50 backdrop-blur-sm')
                  }`}
                >
                  Best Time
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 md:px-2 md:py-1.5 text-sm md:text-xs font-medium transition-all rounded-t-lg ${
                    activeTab === 'history'
                      ? (isDarkMode
                          ? 'border-b-2 border-blue-500 text-blue-400 bg-blue-900/50 backdrop-blur-sm'
                          : 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/50 backdrop-blur-sm')
                      : (isDarkMode
                          ? 'text-gray-300 hover:text-gray-100 hover:bg-gray-800/50 backdrop-blur-sm'
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50/50 backdrop-blur-sm')
                  }`}
                >
                  Historical Patterns
                </button>
              </div>

              {/* Time-Based Predictions Tab */}
              {activeTab === 'predictions' && timeBasedPredictions && (
                <div className="space-y-3 md:space-y-2">
                  <h3 className={`text-base md:text-sm font-semibold mb-3 md:mb-2 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>Expected Traffic by Time Period</h3>
                  
                  {Object.entries(timeBasedPredictions).map(([key, prediction]) => (
                    <div key={key} className={`backdrop-blur-md rounded-xl md:rounded-lg p-3 md:p-2.5 border shadow-lg hover:shadow-xl transition-all duration-300 ${
                      isDarkMode
                        ? 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800/70'
                        : 'bg-white/60 border-gray-200/50 hover:bg-white/70'
                    }`}>
                      <div className="flex items-center justify-between mb-2 md:mb-1.5">
                        <div className="flex items-center space-x-2 md:space-x-1.5">
                          <div className={`w-3 h-3 md:w-2.5 md:h-2.5 rounded-full ${prediction.color}`}></div>
                          <div>
                            <h4 className={`text-sm md:text-xs font-semibold ${
                              isDarkMode ? 'text-gray-100' : 'text-gray-900'
                            }`}>{prediction.label}</h4>
                            <p className={`text-[10px] md:text-[9px] mt-0.5 ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>{prediction.timeRange}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 md:space-x-1">
                          {prediction.congestionLevel === 'heavy' && (
                            <span className={`px-2 py-0.5 md:px-1.5 md:py-0.5 backdrop-blur-sm rounded-full text-xs md:text-[10px] font-medium border shadow-sm ${
                              isDarkMode
                                ? 'bg-red-900/50 text-red-300 border-red-700/50'
                                : 'bg-red-100/70 text-red-800 border-red-200/50'
                            }`}>
                              Heavy
                            </span>
                          )}
                          {prediction.congestionLevel === 'moderate' && (
                            <span className={`px-2 py-0.5 md:px-1.5 md:py-0.5 backdrop-blur-sm rounded-full text-xs md:text-[10px] font-medium border shadow-sm ${
                              isDarkMode
                                ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50'
                                : 'bg-yellow-100/70 text-yellow-800 border-yellow-200/50'
                            }`}>
                              Moderate
                            </span>
                          )}
                          {prediction.congestionLevel === 'low' && (
                            <span className={`px-2 py-0.5 md:px-1.5 md:py-0.5 backdrop-blur-sm rounded-full text-xs md:text-[10px] font-medium border shadow-sm ${
                              isDarkMode
                                ? 'bg-green-900/50 text-green-300 border-green-700/50'
                                : 'bg-green-100/70 text-green-800 border-green-200/50'
                            }`}>
                              Light
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 md:gap-1.5 mt-2 md:mt-1.5">
                        <div>
                          <p className={`text-[10px] md:text-[9px] mb-0.5 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>Avg Speed</p>
                          <p className={`text-base md:text-sm font-bold ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>{prediction.avgSpeed} km/h</p>
                        </div>
                        <div>
                          <p className={`text-[10px] md:text-[9px] mb-0.5 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>Congestion</p>
                          <p className={`text-base md:text-sm font-bold ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>{prediction.congestionPercentage}%</p>
                        </div>
                        <div>
                          <p className={`text-[10px] md:text-[9px] mb-0.5 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>Vehicles</p>
                          <p className={`text-base md:text-sm font-bold ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>{prediction.vehicleCount.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Congestion bar */}
                      <div className="mt-2 md:mt-1.5">
                        <div className={`w-full rounded-full h-1.5 md:h-1 ${
                          isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                        }`}>
                          <div
                            className={`h-1.5 md:h-1 rounded-full transition-all ${
                              prediction.congestionLevel === 'heavy' ? 'bg-red-500' :
                              prediction.congestionLevel === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${prediction.congestionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Best Time to Leave Tab */}
              {activeTab === 'best-time' && (
                <div className="space-y-3 md:space-y-2">
                  <h3 className={`text-base md:text-sm font-semibold mb-3 md:mb-2 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>Best Time to Leave</h3>
                  
                  {bestTimeRecommendations && bestTimeRecommendations.bestTimes && bestTimeRecommendations.bestTimes.length > 0 ? (
                    <>
                      <div className={`backdrop-blur-md rounded-xl md:rounded-lg p-3 md:p-2.5 border-2 shadow-lg ${
                        isDarkMode
                          ? 'bg-green-900/30 border-green-700/50'
                          : 'bg-green-50/70 border-green-200/50'
                      }`}>
                        <div className="flex items-center space-x-2 mb-2 md:mb-1.5">
                          <CheckCircle className={`w-4 h-4 md:w-3.5 md:h-3.5 ${
                            isDarkMode ? 'text-green-400' : 'text-green-600'
                          }`} />
                          <h4 className={`text-sm md:text-xs font-semibold ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>Recommended Departure Times</h4>
                        </div>
                        <p className={`text-xs md:text-[10px] mb-3 md:mb-2 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Based on historical traffic patterns, these times typically have lighter traffic
                        </p>
                        
                        <div className="space-y-2 md:space-y-1.5">
                          {bestTimeRecommendations.bestTimes.map((time, index) => (
                            <div key={index} className={`backdrop-blur-sm rounded-lg md:rounded p-2.5 md:p-2 border shadow-sm hover:shadow-md transition-all ${
                              isDarkMode
                                ? 'bg-gray-800/80 border-gray-700/50 hover:bg-gray-800/90'
                                : 'bg-white/80 border-gray-200/50 hover:bg-white/90'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 md:space-x-1.5">
                                  <div className={`w-8 h-8 md:w-7 md:h-7 rounded-full backdrop-blur-sm flex items-center justify-center border ${
                                    isDarkMode
                                      ? 'bg-green-900/80 border-green-700/50'
                                      : 'bg-green-100/80 border-green-200/50'
                                  }`}>
                                    <Clock className={`w-4 h-4 md:w-3.5 md:h-3.5 ${
                                      isDarkMode ? 'text-green-400' : 'text-green-600'
                                    }`} />
                                  </div>
                                  <div>
                                    <p className={`text-sm md:text-xs font-semibold ${
                                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                                    }`}>{time.label}</p>
                                    <p className={`text-xs md:text-[10px] ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      {time.avgSpeed} km/h avg • {time.congestionLevel === 'low' ? 'Light' : 'Moderate'} traffic
                                    </p>
                                  </div>
                                </div>
                                {index === 0 && (
                                  <span className={`px-2 py-0.5 md:px-1.5 md:py-0.5 backdrop-blur-sm rounded-full text-xs md:text-[10px] font-medium border shadow-sm ${
                                    isDarkMode
                                      ? 'bg-green-900 text-green-300 border-green-700/50'
                                      : 'bg-green-100/70 text-green-800 border-green-200/50'
                                  }`}>
                                    Best
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Time Period Comparison */}
                      {bestTimeRecommendations.recommendations && bestTimeRecommendations.recommendations.length > 0 && (
                        <div className="mt-6">
                          <h4 className={`font-semibold mb-3 ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>Period Comparison</h4>
                          <div className="space-y-2">
                            {bestTimeRecommendations.recommendations.map((rec, index) => (
                              <div key={index} className={`backdrop-blur-sm rounded-lg p-3 border shadow-sm hover:shadow-md transition-all ${
                                isDarkMode
                                  ? 'bg-gray-800/60 border-gray-700/50 hover:bg-gray-800/70'
                                  : 'bg-white/60 border-gray-200/50 hover:bg-white/70'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className={`font-medium ${
                                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                                    }`}>{rec.label}</p>
                                    <p className={`text-sm ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      {rec.avgSpeed} km/h • {rec.congestionPercentage}% congestion
                                    </p>
                                  </div>
                                  <div className={`px-3 py-1 rounded-full text-sm font-medium border backdrop-blur-sm shadow-sm ${
                                    rec.congestionLevel === 'heavy'
                                      ? (isDarkMode
                                          ? 'bg-red-900/50 text-red-300 border-red-700/50'
                                          : 'bg-red-100/70 text-red-800 border-red-200/50')
                                      : rec.congestionLevel === 'moderate'
                                      ? (isDarkMode
                                          ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700/50'
                                          : 'bg-yellow-100/70 text-yellow-800 border-yellow-200/50')
                                      : (isDarkMode
                                          ? 'bg-green-900/50 text-green-300 border-green-700/50'
                                          : 'bg-green-100/70 text-green-800 border-green-200/50')
                                  }`}>
                                    {rec.congestionLevel}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={`backdrop-blur-md border rounded-lg p-4 shadow-sm ${
                      isDarkMode
                        ? 'bg-yellow-900/30 border-yellow-700/50'
                        : 'bg-yellow-50/70 border-yellow-200/50'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <AlertCircle className={`w-5 h-5 ${
                          isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                        }`} />
                        <p className={isDarkMode ? 'text-yellow-300' : 'text-yellow-800'}>
                          {selectedRoute ? 'No route selected. Select a route to see best departure times.' : 'Select a route to see personalized departure time recommendations.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Historical Patterns Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>How Busy is This Road?</h3>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>See typical traffic patterns throughout the day</p>
                    </div>
                    {patterns && patterns.roads && (
                      <select
                        value={selectedRoad || ''}
                        onChange={(e) => setSelectedRoad(e.target.value)}
                        className={`px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 backdrop-blur-sm shadow-sm ${
                          isDarkMode
                            ? 'border-gray-700/50 bg-gray-800/80 text-gray-100'
                            : 'border-gray-300/50 bg-white/80 text-gray-900'
                        }`}
                      >
                        {patterns.roads.map(road => (
                          <option key={road} value={road}>{road}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {historicalData && historicalData.length > 0 ? (
                    <div className="space-y-4">
                      {/* Simple Time Period Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(() => {
                          const timePeriods = [
                            { name: 'Early Morning', hours: [0, 1, 2, 3, 4, 5], icon: '🌙', color: 'blue' },
                            { name: 'Morning Rush', hours: [6, 7, 8, 9], icon: '🌅', color: 'red' },
                            { name: 'Midday', hours: [10, 11, 12, 13, 14], icon: '☀️', color: 'yellow' },
                            { name: 'Afternoon', hours: [15, 16], icon: '🌤️', color: 'yellow' },
                            { name: 'Evening Rush', hours: [17, 18, 19], icon: '🌆', color: 'red' },
                            { name: 'Night', hours: [20, 21, 22, 23], icon: '🌃', color: 'blue' }
                          ];

                          return timePeriods.map((period, idx) => {
                            const periodData = historicalData.filter(d => period.hours.includes(d.hour));
                            if (periodData.length === 0) return null;

                            const avgSpeed = periodData.reduce((sum, d) => sum + d.speed, 0) / periodData.length;
                            const heavyCount = periodData.filter(d => d.congestion === 'heavy').length;
                            const moderateCount = periodData.filter(d => d.congestion === 'moderate').length;
                            const total = periodData.length;
                            const congestionLevel = heavyCount / total > 0.4 ? 'heavy' :
                                                  moderateCount / total > 0.3 ? 'moderate' : 'light';

                            const statusText = congestionLevel === 'heavy' ? 'Very Busy' :
                                              congestionLevel === 'moderate' ? 'Moderately Busy' : 'Light Traffic';
                            
                            const statusColor = isDarkMode
                              ? (congestionLevel === 'heavy'
                                  ? 'bg-red-900/30 backdrop-blur-md text-red-300 border-red-700/50'
                                  : congestionLevel === 'moderate'
                                  ? 'bg-yellow-900/30 backdrop-blur-md text-yellow-300 border-yellow-700/50'
                                  : 'bg-green-900/30 backdrop-blur-md text-green-300 border-green-700/50')
                              : (congestionLevel === 'heavy'
                                  ? 'bg-red-100/70 backdrop-blur-md text-red-800 border-red-200/50'
                                  : congestionLevel === 'moderate'
                                  ? 'bg-yellow-100/70 backdrop-blur-md text-yellow-800 border-yellow-200/50'
                                  : 'bg-green-100/70 backdrop-blur-md text-green-800 border-green-200/50');

                            return (
                              <div key={idx} className={`rounded-xl p-4 border-2 ${statusColor} transition-all hover:shadow-lg`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-2xl">{period.icon}</span>
                                    <h4 className={`font-semibold ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-200' : congestionLevel === 'moderate' ? 'text-yellow-200' : 'text-green-200')
                                        : 'text-gray-900'
                                    }`}>{period.name}</h4>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-200' : congestionLevel === 'moderate' ? 'text-yellow-200' : 'text-green-200')
                                        : 'text-gray-700'
                                    }`}>Traffic Status:</span>
                                    <span className={`font-bold text-sm ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-100' : congestionLevel === 'moderate' ? 'text-yellow-100' : 'text-green-100')
                                        : ''
                                    }`}>{statusText}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-200' : congestionLevel === 'moderate' ? 'text-yellow-200' : 'text-green-200')
                                        : 'text-gray-700'
                                    }`}>Average Speed:</span>
                                    <span className={`font-bold text-sm ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-100' : congestionLevel === 'moderate' ? 'text-yellow-100' : 'text-green-100')
                                        : ''
                                    }`}>{Math.round(avgSpeed)} km/h</span>
                                  </div>
                                  <div className={`mt-2 pt-2 border-t ${
                                    isDarkMode
                                      ? (congestionLevel === 'heavy' ? 'border-red-700/50' : congestionLevel === 'moderate' ? 'border-yellow-700/50' : 'border-green-700/50')
                                      : 'border-gray-300'
                                  }`}>
                                    <div className={`text-xs ${
                                      isDarkMode
                                        ? (congestionLevel === 'heavy' ? 'text-red-300' : congestionLevel === 'moderate' ? 'text-yellow-300' : 'text-green-300')
                                        : 'text-gray-600'
                                    }`}>
                                      {period.hours[0]}:00 - {period.hours[period.hours.length - 1] + 1}:00
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Simple Visual Timeline */}
                      <div className={`backdrop-blur-md rounded-xl p-5 border shadow-lg ${
                        isDarkMode
                          ? 'bg-blue-900/30 border-blue-700/50'
                          : 'bg-blue-50/70 border-blue-200/50'
                      }`}>
                        <h4 className={`font-semibold mb-4 flex items-center space-x-2 ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          <Clock className={`w-5 h-5 ${
                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          }`} />
                          <span>Traffic Throughout the Day</span>
                        </h4>
                        <div className="space-y-3">
                          {(() => {
                            // Group hours into 4-hour periods for simplicity
                            const periods = [
                              { label: '12 AM - 6 AM', hours: [0, 1, 2, 3, 4, 5], labelShort: 'Night' },
                              { label: '6 AM - 10 AM', hours: [6, 7, 8, 9], labelShort: 'Morning' },
                              { label: '10 AM - 2 PM', hours: [10, 11, 12, 13], labelShort: 'Midday' },
                              { label: '2 PM - 6 PM', hours: [14, 15, 16, 17], labelShort: 'Afternoon' },
                              { label: '6 PM - 10 PM', hours: [18, 19, 20, 21], labelShort: 'Evening' },
                              { label: '10 PM - 12 AM', hours: [22, 23], labelShort: 'Late Night' }
                            ];

                            return periods.map((period, idx) => {
                              const periodData = historicalData.filter(d => period.hours.includes(d.hour));
                              if (periodData.length === 0) return null;

                              const avgCongestion = periodData.reduce((sum, d) => {
                                const level = d.congestion === 'heavy' ? 3 : d.congestion === 'moderate' ? 2 : 1;
                                return sum + level;
                              }, 0) / periodData.length;

                              const congestionLevel = avgCongestion >= 2.5 ? 'heavy' :
                                                    avgCongestion >= 1.5 ? 'moderate' : 'light';

                              const barColor = congestionLevel === 'heavy' ? 'bg-red-500' :
                                              congestionLevel === 'moderate' ? 'bg-yellow-500' : 'bg-green-500';
                              
                              const barWidth = Math.min(100, (avgCongestion / 3) * 100);

                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className={`font-medium ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>{period.labelShort}</span>
                                    <span className={`text-xs ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>{period.label}</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <div className={`flex-1 rounded-full h-4 overflow-hidden ${
                                      isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                                    }`}>
                                      <div 
                                        className={`h-4 rounded-full transition-all ${barColor}`}
                                        style={{ width: `${barWidth}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-medium w-20 text-right ${
                                      congestionLevel === 'heavy'
                                        ? (isDarkMode ? 'text-red-300' : 'text-red-700')
                                        : congestionLevel === 'moderate'
                                        ? (isDarkMode ? 'text-yellow-300' : 'text-yellow-700')
                                        : (isDarkMode ? 'text-green-300' : 'text-green-700')
                                    }`}>
                                      {congestionLevel === 'heavy' ? 'Very Busy' :
                                       congestionLevel === 'moderate' ? 'Moderate' : 'Light'}
                                    </span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className={`backdrop-blur-md border-l-4 rounded-lg p-4 shadow-sm ${
                        isDarkMode
                          ? 'bg-blue-900/30 border-blue-500/80'
                          : 'bg-blue-50/70 border-blue-500/80'
                      }`}>
                        <div className="flex items-start space-x-3">
                          <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          }`} />
                          <div>
                            <h4 className={`font-semibold mb-1 ${
                              isDarkMode ? 'text-blue-300' : 'text-blue-900'
                            }`}>💡 Travel Tips</h4>
                            <ul className={`text-sm space-y-1 ${
                              isDarkMode ? 'text-blue-200' : 'text-blue-800'
                            }`}>
                              <li>• <strong>Best times to travel:</strong> Early morning (before 6 AM) or late night (after 10 PM)</li>
                              <li>• <strong>Avoid rush hours:</strong> 6-9 AM and 5-7 PM are typically busiest</li>
                              <li>• <strong>Plan ahead:</strong> Add extra 15-20 minutes during rush hours</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`backdrop-blur-md rounded-lg p-6 border text-center shadow-sm ${
                      isDarkMode
                        ? 'bg-gray-800/60 border-gray-700/50'
                        : 'bg-white/60 border-gray-200/50'
                    }`}>
                      <AlertCircle className={`w-12 h-12 mx-auto mb-3 ${
                        isDarkMode ? 'text-gray-500' : 'text-gray-400'
                      }`} />
                      <p className={`font-medium ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>No traffic data available for this road yet</p>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>Check back later for historical patterns</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );

  // Render using Portal to escape the parent stacking context
  return createPortal(panelContent, document.body);
};

export default TrafficPredictionsPanel;

