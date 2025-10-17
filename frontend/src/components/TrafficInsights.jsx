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
  Zap
} from 'lucide-react';
import trafficInsightsService from '../services/trafficInsightsService';
import trafficPatternsService from '../services/trafficPatternsService';
import './TrafficInsights.css';

const TrafficInsights = ({ onRouteRequest, className = '' }) => {
  const [insights, setInsights] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pmNarrative, setPmNarrative] = useState(null);

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
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch traffic insights');
      console.error('Error fetching insights:', err);
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

  if (loading) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 ${className}`}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="h-6 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg border border-red-200 ${className}`}>
        <div className="p-6">
          <div className="flex items-center space-x-3 text-red-600 mb-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Unable to load traffic insights</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
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
    <div className={`traffic-insights-container rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 ${className}`}>
      {/* Header */}
      <div className="traffic-insights-header px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Smart Traffic Insights</h3>
              <p className="text-sm text-gray-500">
                Real-time analysis • {lastUpdate && trafficInsightsService.formatTime(lastUpdate.toISOString())}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleRefresh}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              title="Refresh now"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Main Insight */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <span className="condition-emoji">{insights.condition_emoji}</span>
            <div className="text-left">
              <div className="text-2xl font-bold text-gray-900 capitalize">
                {insights.overall_condition} Traffic
              </div>
              <div className="text-sm text-gray-500 font-medium">
                Score: {insights.traffic_score}/100
              </div>
            </div>
          </div>
          
          <div className="main-insight-box rounded-xl p-4 mb-4">
            <p className="text-base font-medium text-gray-800 mb-2">{insights.main_message}</p>
            <p className="text-sm text-gray-600">{insights.condition_message}</p>
          </div>
        </div>

        {/* Traffic Statistics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="stat-card bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 text-center border border-green-100">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {insights.statistics.free_flowing_roads}
            </div>
            <div className="text-sm font-medium text-green-700">Free Flowing</div>
            <div className="text-xs text-green-600 mt-1">
              {Math.round((insights.statistics.free_flowing_roads / Math.max(insights.statistics.total_monitored_roads, 1)) * 100)}% of roads
            </div>
          </div>
          
          <div className="stat-card bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-5 text-center border border-red-100">
            <div className="text-3xl font-bold text-red-600 mb-1">
              {insights.statistics.congested_roads}
            </div>
            <div className="text-sm font-medium text-red-700">Congested</div>
            <div className="text-xs text-red-600 mt-1">
              {Math.round((insights.statistics.congested_roads / Math.max(insights.statistics.total_monitored_roads, 1)) * 100)}% of roads
            </div>
          </div>
        </div>

        {/* Advisory */}
        {insights.advisory && (
          <div 
            className="advisory-card p-5 rounded-xl border-l-4 mb-6 shadow-sm"
            style={{ 
              backgroundColor: `${insights.advisory.color}10`,
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
              <span className="font-semibold text-gray-900 capitalize text-base">
                {insights.advisory.level} Advisory
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed ml-11">{insights.advisory.message}</p>
          </div>
        )}

        {/* 5 PM Rush-hour Narrative */}
        {pmNarrative && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <div className="p-1 bg-orange-100 rounded-full">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-base">5 PM Rush-hour Overview</span>
            </h4>
            <div className="p-4 rounded-xl border border-orange-100 bg-orange-50">
              <p className="text-sm text-gray-800 mb-3">{pmNarrative.intro}</p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700">
                {pmNarrative.highlights.map((h, idx) => (
                  <li key={idx}>{h}</li>
                ))}
              </ul>
              <p className="text-sm text-gray-700 mt-3 font-medium">Tip: {pmNarrative.advice}</p>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations && insights.recommendations.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <div className="p-1 bg-green-100 rounded-full">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-base">Smart Recommendations</span>
            </h4>
            
            <div className="space-y-3">
              {insights.recommendations.map((recommendation, index) => (
                <div key={index} className="recommendation-card flex items-start space-x-3 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-100">
                  <span className="text-xl flex-shrink-0 mt-0.5">
                    {trafficInsightsService.getRecommendationIcon(recommendation)}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 leading-relaxed font-medium">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Route Suggestions */}
        {insights.route_suggestions && insights.route_suggestions.length > 0 && (
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <div className="p-1 bg-blue-100 rounded-full">
                <Navigation className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-base">Smart Routing</span>
            </h4>
            
            <div className="space-y-4">
              {insights.route_suggestions.map((suggestion, index) => (
                <div key={index} className="route-suggestion-card border border-gray-200 rounded-xl p-5 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900 mb-1">{suggestion.title}</h5>
                      <p className="text-sm text-gray-600 leading-relaxed">{suggestion.suggestion}</p>
                    </div>
                    
                    {suggestion.confidence && (
                      <span className={`px-3 py-1 text-xs rounded-full font-semibold ml-3 ${
                        suggestion.confidence === 'high' 
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                      }`}>
                        {suggestion.confidence}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-gray-600 font-medium">{suggestion.reason}</span>
                    {suggestion.estimated_savings && (
                      <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-lg">
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
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 pt-6 border-t border-gray-200 mt-6">
          <div className="next-update-badge flex items-center space-x-2 px-3 py-2 rounded-lg">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{trafficInsightsService.formatNextUpdate(insights.next_update)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficInsights;
