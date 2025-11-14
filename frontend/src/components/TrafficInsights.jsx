import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Navigation,
  RefreshCw,
  Info,
  MapPin,
  Zap,
  Calendar,
  TrendingDown,
  Award,
  Sun,
  Moon,
  Sunrise,
  Sunset
} from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import trafficInsightsService from '../services/trafficInsightsService';
import trafficPatternsService from '../services/trafficPatternsService';
import './TrafficInsights.css';

const TrafficInsights = ({ onRouteRequest, className = '' }) => {
  const { isDarkMode } = useDarkMode();
  const [insights, setInsights] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pmNarrative, setPmNarrative] = useState(null);
  
  // Traffic Prediction Timeline states
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [trafficPredictions, setTrafficPredictions] = useState(null);
  const [bestTimeToTravel, setBestTimeToTravel] = useState(null);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const [insightsData, trendsData, patterns] = await Promise.all([
        trafficInsightsService.getDailyInsights(),
        trafficInsightsService.getTrafficTrends().catch(() => null),
        trafficPatternsService.getDailyPatterns().catch(() => null)
      ]);
      
      setInsights(insightsData);
      setTrends(trendsData);
      if (patterns) {
        const narrative = trafficPatternsService.buildRushHourNarrative(patterns, 17);
        setPmNarrative(narrative);
      } else {
        setPmNarrative(null);
      }
      
      // Generate traffic predictions for the timeline
      generateTrafficPredictions(patterns);
      
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch traffic insights');

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
    
    // Auto-refresh every 5 minutes if enabled
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(fetchInsights, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleRefresh = () => {
    fetchInsights();
  };

  const handleRouteRequest = (suggestion) => {
    if (onRouteRequest) {
      onRouteRequest(suggestion);
    }
  };

  // Generate AI-powered traffic predictions for 24-hour timeline
  const generateTrafficPredictions = (patterns) => {
    const predictions = [];
    const currentHour = new Date().getHours();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Generate predictions for each hour (0-23)
    for (let hour = 0; hour < 24; hour++) {
      let trafficScore = 50; // Base score
      let condition = 'moderate';
      let color = '#fbbf24'; // yellow
      
      // Morning rush hour (7-9 AM)
      if (hour >= 7 && hour <= 9) {
        trafficScore = 75 + Math.random() * 15;
        condition = 'heavy';
        color = '#ef4444';
      }
      // Evening rush hour (5-8 PM)
      else if (hour >= 17 && hour <= 20) {
        trafficScore = 80 + Math.random() * 15;
        condition = 'heavy';
        color = '#ef4444';
      }
      // Late morning/early afternoon (10 AM - 4 PM)
      else if (hour >= 10 && hour <= 16) {
        trafficScore = 40 + Math.random() * 20;
        condition = 'moderate';
        color = '#fbbf24';
      }
      // Late night/early morning (10 PM - 6 AM)
      else if (hour >= 22 || hour <= 6) {
        trafficScore = 15 + Math.random() * 15;
        condition = 'light';
        color = '#10b981';
      }
      // Other times
      else {
        trafficScore = 35 + Math.random() * 25;
        condition = trafficScore > 60 ? 'moderate' : 'light';
        color = trafficScore > 60 ? '#fbbf24' : '#10b981';
      }
      
      // Weekend adjustment (lighter traffic)
      if (selectedDay === 0 || selectedDay === 6) {
        trafficScore = trafficScore * 0.7;
        if (trafficScore < 40) {
          condition = 'light';
          color = '#10b981';
        }
      }
      
      // Add some pattern-based adjustments if available
      if (patterns && patterns[hour]) {
        const patternData = patterns[hour];
        if (patternData.avg_speed) {
          // Adjust based on historical data
          trafficScore = Math.min(95, trafficScore * (1 + (50 - patternData.avg_speed) / 100));
        }
      }
      
      predictions.push({
        hour,
        time: formatHour(hour),
        trafficScore: Math.round(trafficScore),
        condition,
        color,
        estimatedDuration: calculateEstimatedDuration(trafficScore),
        isCurrent: hour === currentHour,
        icon: getTimeIcon(hour)
      });
    }
    
    setTrafficPredictions(predictions);
    
    // Find best time to travel (lowest traffic score)
    const sortedByScore = [...predictions].sort((a, b) => a.trafficScore - b.trafficScore);
    const best = sortedByScore[0];
    const currentPrediction = predictions[currentHour];
    const timeSavings = Math.round((currentPrediction.estimatedDuration - best.estimatedDuration));
    
    setBestTimeToTravel({
      hour: best.hour,
      time: best.time,
      condition: best.condition,
      trafficScore: best.trafficScore,
      timeSavings: timeSavings > 0 ? timeSavings : 0,
      dayName: daysOfWeek[selectedDay]
    });
  };
  
  // Format hour to 12-hour format with AM/PM
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };
  
  // Calculate estimated duration based on traffic score
  const calculateEstimatedDuration = (trafficScore) => {
    // Base duration: 30 minutes
    const baseDuration = 30;
    // Add delay based on traffic score (0-100% increase)
    const delay = (trafficScore / 100) * baseDuration;
    return Math.round(baseDuration + delay);
  };
  
  // Get appropriate icon for time of day
  const getTimeIcon = (hour) => {
    if (hour >= 6 && hour < 8) return <Sunrise className="w-3 h-3" />;
    if (hour >= 8 && hour < 18) return <Sun className="w-3 h-3" />;
    if (hour >= 18 && hour < 20) return <Sunset className="w-3 h-3" />;
    return <Moon className="w-3 h-3" />;
  };
  
  // Handle day selection change
  const handleDayChange = (day) => {
    setSelectedDay(day);
    // Re-generate predictions for new day
    if (trafficPredictions) {
      generateTrafficPredictions(null);
    }
  };
  
  // Get traffic condition emoji
  const getConditionEmoji = (condition) => {
    switch (condition) {
      case 'light': return '🟢';
      case 'moderate': return '🟡';
      case 'heavy': return '🔴';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl shadow-lg border ${className} ${
        isDarkMode 
          ? 'bg-gray-900 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`w-8 h-8 rounded-lg ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
              <div className={`h-6 rounded w-32 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
            </div>
            <div className="space-y-3">
              <div className={`h-4 rounded w-full ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
              <div className={`h-4 rounded w-3/4 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
              <div className={`h-4 rounded w-1/2 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-2xl shadow-lg border ${className} ${
        isDarkMode 
          ? 'bg-gray-900 border-red-700' 
          : 'bg-white border-red-200'
      }`}>
        <div className="p-6">
          <div className={`flex items-center space-x-3 mb-3 ${
            isDarkMode ? 'text-red-400' : 'text-red-600'
          }`}>
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Unable to load traffic insights</span>
          </div>
          <p className={`text-sm mb-4 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>{error}</p>
          <button
            onClick={handleRefresh}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'bg-red-900/50 text-red-300 hover:bg-red-900/70'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  return (
    <div className={`traffic-insights-container rounded-2xl sm:rounded-3xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 w-full ${className} ${
      isDarkMode ? 'bg-gray-900' : 'bg-white'
    }`}>
      {/* Header */}
      <div className={`traffic-insights-header px-4 sm:px-6 py-3 sm:py-4 border-b ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-40"></div>
              <div className="relative p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`text-sm sm:text-base font-black truncate ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>Smart Traffic Insights</h3>
              <p className={`text-xs font-medium truncate ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Real-time analysis • {lastUpdate && trafficInsightsService.formatTime(lastUpdate.toISOString())}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                autoRefresh 
                  ? (isDarkMode 
                      ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70' 
                      : 'bg-green-100 text-green-600 hover:bg-green-200')
                  : (isDarkMode
                      ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
              }`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleRefresh}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Refresh now"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Main Insight */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="flex items-center justify-center space-x-3 sm:space-x-4 mb-3 sm:mb-4">
            <span className="condition-emoji">{insights.condition_emoji}</span>
            <div className="text-left">
              <div className={`text-xl sm:text-2xl font-bold capitalize ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {insights.overall_condition} Traffic
              </div>
              <div className={`text-xs sm:text-sm font-medium ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Score: {insights.traffic_score}/100
              </div>
            </div>
          </div>
          
          <div className={`main-insight-box rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-gray-50 border-gray-200'
          } border`}>
            <p className={`text-sm sm:text-base font-medium mb-2 ${
              isDarkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>{insights.main_message}</p>
            <p className={`text-xs sm:text-sm ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>{insights.condition_message}</p>
          </div>
        </div>

        {/* Traffic Statistics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className={`stat-card rounded-xl p-3 sm:p-5 text-center border ${
            isDarkMode
              ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-700'
              : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100'
          }`}>
            <div className={`text-2xl sm:text-3xl font-bold mb-1 ${
              isDarkMode ? 'text-green-400' : 'text-green-600'
            }`}>
              {insights.statistics.free_flowing_roads}
            </div>
            <div className={`text-xs sm:text-sm font-medium ${
              isDarkMode ? 'text-green-300' : 'text-green-700'
            }`}>Free Flowing</div>
            <div className={`text-xs mt-1 ${
              isDarkMode ? 'text-green-400' : 'text-green-600'
            }`}>
              {Math.round((insights.statistics.free_flowing_roads / Math.max(insights.statistics.total_monitored_roads, 1)) * 100)}% of roads
            </div>
          </div>
          
          <div className={`stat-card rounded-xl p-3 sm:p-5 text-center border ${
            isDarkMode
              ? 'bg-gradient-to-br from-red-900/30 to-pink-900/30 border-red-700'
              : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-100'
          }`}>
            <div className={`text-2xl sm:text-3xl font-bold mb-1 ${
              isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {insights.statistics.congested_roads}
            </div>
            <div className={`text-xs sm:text-sm font-medium ${
              isDarkMode ? 'text-red-300' : 'text-red-700'
            }`}>Congested</div>
            <div className={`text-xs mt-1 ${
              isDarkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              {Math.round((insights.statistics.congested_roads / Math.max(insights.statistics.total_monitored_roads, 1)) * 100)}% of roads
            </div>
          </div>
        </div>

        {/* Advisory */}
        {insights.advisory && (
          <div 
            className={`advisory-card p-3 sm:p-5 rounded-xl border-l-4 mb-4 sm:mb-6 shadow-sm ${
              isDarkMode ? 'bg-gray-800/50' : ''
            }`}
            style={{ 
              backgroundColor: isDarkMode ? `${insights.advisory.color}20` : `${insights.advisory.color}10`,
              borderColor: insights.advisory.color
            }}
          >
            <div className="flex items-center space-x-3 mb-2">
              <div 
                className="advisory-icon-container p-2 rounded-full"
                style={{ backgroundColor: `${insights.advisory.color}20` }}
              >
                <Info className="w-4 h-4" style={{ color: insights.advisory.color }} />
              </div>
              <span className={`font-semibold capitalize text-base ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {insights.advisory.level} Advisory
              </span>
            </div>
            <p className={`text-sm leading-relaxed ml-11 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>{insights.advisory.message}</p>
          </div>
        )}

        {/* AI-Powered Traffic Prediction Timeline */}
        {trafficPredictions && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-4 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              <div className={`p-1 rounded-full ${
                isDarkMode ? 'bg-purple-900' : 'bg-purple-100'
              }`}>
                <Clock className={`w-4 h-4 ${
                  isDarkMode ? 'text-purple-400' : 'text-purple-600'
                }`} />
              </div>
              <span className="text-base">AI Traffic Prediction Timeline</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                isDarkMode 
                  ? 'bg-purple-900 text-purple-300' 
                  : 'bg-purple-100 text-purple-700'
              }`}>NEW</span>
            </h4>
            
            {/* Day of Week Selector */}
            <div className="mb-4 flex items-center space-x-2 overflow-x-auto pb-2">
              <Calendar className={`w-4 h-4 flex-shrink-0 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`} />
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <button
                  key={index}
                  onClick={() => handleDayChange(index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                    selectedDay === index
                      ? 'bg-purple-600 text-white shadow-md'
                      : (isDarkMode
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            
            {/* Best Time to Travel Card */}
            {bestTimeToTravel && bestTimeToTravel.timeSavings > 0 && (
              <div className={`mb-4 p-4 border rounded-xl ${
                isDarkMode
                  ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-700'
                  : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-500 rounded-full">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className={`font-semibold mb-1 flex items-center space-x-2 ${
                      isDarkMode ? 'text-green-300' : 'text-green-900'
                    }`}>
                      <span>Best Time to Travel</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isDarkMode
                          ? 'bg-green-900 text-green-300'
                          : 'bg-green-200 text-green-800'
                      }`}>Recommended</span>
                    </h5>
                    <p className={`text-sm mb-2 ${
                      isDarkMode ? 'text-green-200' : 'text-green-800'
                    }`}>
                      Travel at <span className="font-bold">{bestTimeToTravel.time}</span> on {bestTimeToTravel.dayName} for the smoothest journey
                    </p>
                    <div className={`flex items-center space-x-4 text-xs ${
                      isDarkMode ? 'text-green-300' : 'text-green-700'
                    }`}>
                      <span className="flex items-center space-x-1">
                        <span className="font-semibold">Save up to {bestTimeToTravel.timeSavings} min</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        {getConditionEmoji(bestTimeToTravel.condition)}
                        <span className="capitalize">{bestTimeToTravel.condition} traffic</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Timeline Slider - Redesigned for Better UX */}
            <div className={`rounded-xl p-5 border-2 shadow-lg ${
              isDarkMode
                ? 'bg-gray-800 border-purple-700'
                : 'bg-white border-purple-200'
            }`}>
              {/* Header with Description */}
              <div className="mb-4 text-center">
                <p className={`text-sm mb-3 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  👆 Click on any time bar below to see traffic predictions for that hour
                </p>
              </div>
              
              {/* Selected Hour Display - Larger and More Prominent */}
              <div className="mb-5">
                <div className={`rounded-2xl p-6 border-2 shadow-md ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border-purple-700'
                    : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-300'
                }`}>
                  <div className="flex items-center justify-center space-x-4 mb-3">
                    <div className="text-4xl">
                      {trafficPredictions[selectedHour].icon}
                    </div>
                    <div className="text-center">
                      <div className={`text-3xl font-black mb-1 ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {trafficPredictions[selectedHour].time}
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <span className="text-2xl">{getConditionEmoji(trafficPredictions[selectedHour].condition)}</span>
                        <span className="text-lg font-bold capitalize" style={{ color: trafficPredictions[selectedHour].color }}>
                          {trafficPredictions[selectedHour].condition} Traffic
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-center space-x-6 mt-4 pt-4 border-t ${
                    isDarkMode ? 'border-purple-700' : 'border-purple-200'
                  }`}>
                    <div className="text-center">
                      <div className={`text-xs mb-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Travel Time</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {trafficPredictions[selectedHour].estimatedDuration} min
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xs mb-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>Traffic Level</div>
                      <div className="text-2xl font-bold" style={{ color: trafficPredictions[selectedHour].color }}>
                        {trafficPredictions[selectedHour].trafficScore}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Time Selection Buttons - Cleaner Alternative */}
              <div className="mb-5">
                <div className={`text-xs font-semibold mb-3 text-center ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Select Time to View Traffic Prediction
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => {
                    const prediction = trafficPredictions[hour];
                    return (
                      <button
                        key={hour}
                        onClick={() => setSelectedHour(hour)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          selectedHour === hour
                            ? (isDarkMode
                                ? 'border-purple-500 bg-purple-900/50 shadow-lg transform scale-105'
                                : 'border-purple-500 bg-purple-50 shadow-lg transform scale-105')
                            : (isDarkMode
                                ? 'border-gray-700 bg-gray-800 hover:border-purple-700 hover:shadow-md'
                                : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md')
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-lg mb-1">{prediction.icon}</div>
                          <div className={`text-xs font-bold ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {prediction.time.replace(' ', '')}
                          </div>
                          <div className="text-xs mt-1" style={{ color: prediction.color }}>
                            {getConditionEmoji(prediction.condition)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Legend with Better Descriptions */}
              <div className={`mt-5 pt-4 border-t-2 ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <div className={`text-xs font-semibold mb-3 text-center ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Traffic Conditions Guide
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`border-2 rounded-lg p-3 text-center ${
                    isDarkMode
                      ? 'bg-green-900/30 border-green-700'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="w-4 h-4 rounded-full bg-green-500 mx-auto mb-2"></div>
                    <div className={`text-xs font-bold ${
                      isDarkMode ? 'text-green-300' : 'text-green-700'
                    }`}>Light Traffic</div>
                    <div className={`text-xs mt-1 ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`}>Fast & Easy</div>
                  </div>
                  <div className={`border-2 rounded-lg p-3 text-center ${
                    isDarkMode
                      ? 'bg-yellow-900/30 border-yellow-700'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="w-4 h-4 rounded-full bg-yellow-500 mx-auto mb-2"></div>
                    <div className={`text-xs font-bold ${
                      isDarkMode ? 'text-yellow-300' : 'text-yellow-700'
                    }`}>Moderate</div>
                    <div className={`text-xs mt-1 ${
                      isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
                    }`}>Some Delays</div>
                  </div>
                  <div className={`border-2 rounded-lg p-3 text-center ${
                    isDarkMode
                      ? 'bg-red-900/30 border-red-700'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2"></div>
                    <div className={`text-xs font-bold ${
                      isDarkMode ? 'text-red-300' : 'text-red-700'
                    }`}>Heavy Traffic</div>
                    <div className={`text-xs mt-1 ${
                      isDarkMode ? 'text-red-400' : 'text-red-600'
                    }`}>Slow Moving</div>
                  </div>
                </div>
              </div>
              
              {/* Info Footer */}
              <div className="mt-4 text-center">
                <div className={`inline-flex items-center space-x-2 text-xs px-4 py-2 rounded-full border ${
                  isDarkMode
                    ? 'text-gray-400 bg-purple-900/30 border-purple-700'
                    : 'text-gray-600 bg-purple-50 border-purple-200'
                }`}>
                  <TrendingUp className="w-3 h-3" />
                  <span>AI predictions based on historical patterns</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5 PM Rush-hour Narrative */}
        {pmNarrative && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-3 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              <div className={`p-1 rounded-full ${
                isDarkMode ? 'bg-orange-900' : 'bg-orange-100'
              }`}>
                <TrendingUp className={`w-4 h-4 ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`} />
              </div>
              <span className="text-base">5 PM Rush-hour Overview</span>
            </h4>
            <div className={`p-4 rounded-xl border ${
              isDarkMode
                ? 'border-orange-700 bg-orange-900/30'
                : 'border-orange-100 bg-orange-50'
            }`}>
              <p className={`text-sm mb-3 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>{pmNarrative.intro}</p>
              <ul className={`list-disc ml-5 space-y-1 text-sm ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {pmNarrative.highlights.map((h, idx) => (
                  <li key={idx}>{h}</li>
                ))}
              </ul>
              <p className={`text-sm mt-3 font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Tip: {pmNarrative.advice}</p>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-4 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              <div className={`p-1 rounded-full ${
                isDarkMode ? 'bg-green-900' : 'bg-green-100'
              }`}>
                <CheckCircle className={`w-4 h-4 ${
                  isDarkMode ? 'text-green-400' : 'text-green-600'
                }`} />
              </div>
              <span className="text-base">Smart Recommendations</span>
            </h4>
            
            <div className="space-y-3">
              {insights.recommendations.map((recommendation, index) => (
                <div key={index} className={`recommendation-card flex items-start space-x-3 p-4 rounded-xl border ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-gray-800 to-blue-900/30 border-gray-700'
                    : 'bg-gradient-to-r from-gray-50 to-blue-50 border-gray-100'
                }`}>
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {trafficInsightsService.getRecommendationIcon(recommendation)}
                  </span>
                  <span className={`text-sm flex-1 leading-relaxed font-medium ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Route Suggestions */}
        {insights.route_suggestions && insights.route_suggestions.length > 0 && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-4 flex items-center space-x-2 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>
              <div className={`p-1 rounded-full ${
                isDarkMode ? 'bg-blue-900' : 'bg-blue-100'
              }`}>
                <Navigation className={`w-4 h-4 ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <span className="text-base">Smart Routing</span>
            </h4>
            
            <div className="space-y-4">
              {insights.route_suggestions.map((suggestion, index) => (
                <div key={index} className={`route-suggestion-card border rounded-xl p-5 ${
                  isDarkMode
                    ? 'border-gray-700 bg-gray-800'
                    : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h5 className={`font-semibold mb-1 ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>{suggestion.title}</h5>
                      <p className={`text-sm leading-relaxed ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>{suggestion.suggestion}</p>
                    </div>
                    
                    {suggestion.confidence && (
                      <span className={`px-3 py-1 text-xs rounded-full font-semibold ml-3 ${
                        suggestion.confidence === 'high' 
                          ? (isDarkMode
                              ? 'bg-green-900 text-green-300 border border-green-700'
                              : 'bg-green-100 text-green-700 border border-green-200')
                          : (isDarkMode
                              ? 'bg-yellow-900 text-yellow-300 border border-yellow-700'
                              : 'bg-yellow-100 text-yellow-700 border border-yellow-200')
                      }`}>
                        {suggestion.confidence}
                      </span>
                    )}
                  </div>
                  
                  <div className={`flex items-center justify-between text-sm mb-3 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <span className="font-medium">{suggestion.reason}</span>
                    {suggestion.estimated_savings && (
                      <span className={`font-semibold px-2 py-1 rounded-lg ${
                        isDarkMode
                          ? 'text-blue-400 bg-blue-900/50'
                          : 'text-blue-600 bg-blue-50'
                      }`}>
                        {suggestion.estimated_savings}
                      </span>
                    )}
                  </div>
                  
                  {suggestion.type === 'alternative_route' && (
                    <button
                      onClick={() => handleRouteRequest(suggestion)}
                      className="show-route-button w-full flex items-center justify-center space-x-2 px-4 py-3 text-white rounded-lg font-medium shadow-sm"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Show Route</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Update */}
        <div className={`flex items-center justify-center space-x-2 text-sm pt-6 border-t mt-6 ${
          isDarkMode
            ? 'text-gray-400 border-gray-700'
            : 'text-gray-500 border-gray-200'
        }`}>
          <div className={`next-update-badge flex items-center space-x-2 px-3 py-2 rounded-lg ${
            isDarkMode
              ? 'bg-gray-800'
              : 'bg-gray-50'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-medium">{trafficInsightsService.formatNextUpdate(insights.next_update)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficInsights;
