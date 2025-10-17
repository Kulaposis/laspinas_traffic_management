import React from 'react';
import { Activity, Clock, AlertTriangle, Navigation, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Traffic Info Card Component
 * Displays traffic summary and route information in bottom sheet
 */
const TrafficInfoCard = ({ 
  trafficData = [],
  incidents = [],
  selectedRoute = null,
  onStartMonitoring,
  onViewDetails
}) => {
  // Calculate traffic statistics
  const calculateStats = () => {
    if (trafficData.length === 0) {
      return {
        avgCongestion: 0,
        condition: 'Unknown',
        conditionColor: 'gray',
        activeIncidents: incidents.length,
        trend: 0
      };
    }

    const avgCongestion = trafficData.reduce((sum, t) => sum + (t.congestion_percentage || 0), 0) / trafficData.length;
    
    let condition = 'Light';
    let conditionColor = 'green';
    
    if (avgCongestion > 70) {
      condition = 'Heavy';
      conditionColor = 'red';
    } else if (avgCongestion > 40) {
      condition = 'Moderate';
      conditionColor = 'yellow';
    }

    return {
      avgCongestion: Math.round(avgCongestion),
      condition,
      conditionColor,
      activeIncidents: incidents.length,
      trend: Math.random() > 0.5 ? 5 : -5 // Mock trend
    };
  };

  const stats = calculateStats();

  // Get condition color classes
  const getConditionColorClasses = (color) => {
    const colors = {
      green: 'bg-green-100 text-green-800 border-green-300',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      red: 'bg-red-100 text-red-800 border-red-300',
      gray: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="space-y-4">
      {/* Traffic Condition Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Traffic Conditions</h3>
          <p className="text-sm text-gray-500">Las Piñas City</p>
        </div>
        <div className={`px-4 py-2 rounded-full border-2 font-semibold ${getConditionColorClasses(stats.conditionColor)}`}>
          {stats.condition}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {/* Average Congestion */}
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <Activity className="w-4 h-4 text-gray-600" />
            {stats.trend !== 0 && (
              stats.trend > 0 ? 
                <TrendingUp className="w-4 h-4 text-red-500" /> : 
                <TrendingDown className="w-4 h-4 text-green-500" />
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.avgCongestion}%</p>
          <p className="text-xs text-gray-600">Congestion</p>
        </div>

        {/* Active Incidents */}
        <div className="bg-gray-50 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-orange-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">{stats.activeIncidents}</p>
          <p className="text-xs text-gray-600">Incidents</p>
        </div>

        {/* Estimated Time */}
        <div className="bg-gray-50 rounded-xl p-3">
          <Clock className="w-4 h-4 text-blue-600 mb-1" />
          <p className="text-2xl font-bold text-gray-900">
            {selectedRoute ? Math.round(selectedRoute.travelTime / 60) : '--'}
          </p>
          <p className="text-xs text-gray-600">Minutes</p>
        </div>
      </div>

      {/* Route Summary (if route selected) */}
      {selectedRoute && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">Suggested Route</h4>
              <p className="text-sm text-gray-600">
                {selectedRoute.distance ? `${(selectedRoute.distance / 1000).toFixed(1)} km` : 'Calculating...'}
                {' • '}
                {selectedRoute.travelTime ? `${Math.round(selectedRoute.travelTime / 60)} min` : 'Calculating...'}
              </p>
            </div>
            <Navigation className="w-5 h-5 text-blue-600" />
          </div>
          
          {selectedRoute.warnings && selectedRoute.warnings.length > 0 && (
            <div className="space-y-2">
              {selectedRoute.warnings.slice(0, 2).map((warning, index) => (
                <div key={index} className="flex items-start text-sm">
                  <AlertTriangle className="w-4 h-4 text-orange-600 mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{warning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Incidents */}
      {incidents.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Recent Incidents</h4>
          <div className="space-y-2">
            {incidents.slice(0, 3).map((incident) => (
              <div 
                key={incident.id}
                className="flex items-start bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => onViewDetails && onViewDetails(incident)}
              >
                <div className={`p-2 rounded-full mr-3 flex-shrink-0 ${
                  incident.severity === 'high' ? 'bg-red-100' :
                  incident.severity === 'medium' ? 'bg-yellow-100' :
                  'bg-green-100'
                }`}>
                  <AlertTriangle className={`w-4 h-4 ${
                    incident.severity === 'high' ? 'text-red-600' :
                    incident.severity === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {incident.title || incident.incident_type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {incident.location_name || `${incident.latitude?.toFixed(4)}, ${incident.longitude?.toFixed(4)}`}
                  </p>
                </div>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {incident.created_at ? new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onStartMonitoring}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center shadow-lg"
      >
        <Navigation className="w-5 h-5 mr-2" />
        Start Monitoring
      </button>

      {/* Last Updated */}
      <p className="text-xs text-gray-400 text-center">
        Updated {new Date().toLocaleTimeString()}
      </p>
    </div>
  );
};

export default TrafficInfoCard;

