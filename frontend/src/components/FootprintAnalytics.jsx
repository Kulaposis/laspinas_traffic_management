import React from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  MapPin,
  Clock,
  Activity,
  BarChart3,
  Shield,
  Navigation,
  ThermometerSun
} from 'lucide-react';

const FootprintAnalytics = ({ footprintData, statistics }) => {
  // Calculate analytics insights
  const calculateInsights = () => {
    if (!footprintData || footprintData.length === 0) {
      return {
        totalPeople: 0,
        crowdTrend: 'stable',
        busiestArea: 'N/A',
        safestArea: 'N/A',
        averageTemp: 0,
        congestionLevel: 'low',
        recommendation: 'No crowd data available. Monitor areas regularly.',
        peakHours: 'Unknown',
        safetyStatus: 'normal'
      };
    }

    const totalPeople = footprintData.reduce((sum, area) => sum + area.pedestrian_count, 0);
    const temperatures = footprintData.map(area => area.temperature_celsius);
    const averageTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    
    // Find busiest and safest areas
    const busiestArea = footprintData.reduce((prev, current) => 
      current.pedestrian_count > prev.pedestrian_count ? current : prev
    );
    
    const safestArea = footprintData.reduce((prev, current) => 
      current.pedestrian_count < prev.pedestrian_count ? current : prev
    );
    
    // Determine crowd trend
    const highCrowdAreas = footprintData.filter(area => 
      area.crowd_level === 'high' || area.crowd_level === 'critical'
    ).length;
    
    let crowdTrend = 'stable';
    let congestionLevel = 'low';
    if (highCrowdAreas > footprintData.length * 0.5) {
      crowdTrend = 'increasing';
      congestionLevel = 'high';
    } else if (highCrowdAreas > footprintData.length * 0.3) {
      congestionLevel = 'moderate';
    }
    
    // Safety assessment
    const criticalAreas = footprintData.filter(area => area.crowd_level === 'critical').length;
    let safetyStatus = 'normal';
    if (criticalAreas > 0) safetyStatus = 'caution';
    if (criticalAreas > 2) safetyStatus = 'warning';
    
    // Generate recommendation
    let recommendation = 'Crowd levels are manageable. Normal operations can continue.';
    if (congestionLevel === 'high') {
      recommendation = '⚠️ High congestion detected in multiple areas. Consider crowd management measures.';
    } else if (averageTemp > 32 && totalPeople > 1000) {
      recommendation = '🌡️ Hot weather with high foot traffic. Ensure adequate ventilation and hydration stations.';
    } else if (criticalAreas > 0) {
      recommendation = '🚨 Critical crowd levels detected. Implement crowd control measures immediately.';
    } else if (congestionLevel === 'moderate') {
      recommendation = '📊 Moderate congestion observed. Monitor closely for any increases.';
    }
    
    // Estimate peak hours based on current data
    const currentHour = new Date().getHours();
    let peakHours = 'Unknown';
    if (totalPeople > 500) {
      if (currentHour >= 6 && currentHour <= 9) peakHours = 'Morning Rush (6-9 AM)';
      else if (currentHour >= 11 && currentHour <= 14) peakHours = 'Lunch Time (11 AM-2 PM)';
      else if (currentHour >= 17 && currentHour <= 20) peakHours = 'Evening Rush (5-8 PM)';
      else peakHours = 'Off-Peak Hours';
    }
    
    return {
      totalPeople,
      crowdTrend,
      busiestArea: busiestArea.area_name,
      safestArea: safestArea.area_name,
      averageTemp: Math.round(averageTemp * 10) / 10,
      congestionLevel,
      recommendation,
      peakHours,
      safetyStatus,
      criticalAreas,
      highCrowdAreas
    };
  };

  const insights = calculateInsights();

  const getCongestionColor = (level) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'moderate': return 'text-orange-600 bg-orange-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getSafetyColor = (status) => {
    switch (status) {
      case 'warning': return 'text-red-600 bg-red-50 border-red-200';
      case 'caution': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'decreasing': return <TrendingDown className="w-5 h-5 text-green-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatCrowdLevel = (level) => {
    const displays = {
      low: { label: 'Light Crowd', color: 'bg-green-100 text-green-800' },
      medium: { label: 'Moderate Crowd', color: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'Heavy Crowd', color: 'bg-orange-100 text-orange-800' },
      critical: { label: 'Critical Crowd', color: 'bg-red-100 text-red-800' }
    };
    return displays[level] || displays.low;
  };

  return (
    <div className="mt-8 mb-8 space-y-6 analytics-container">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-6">
        <h2 className="text-2xl font-bold text-purple-900 mb-2 flex items-center">
          <BarChart3 className="w-6 h-6 mr-3 text-purple-600" />
          Crowd Analytics & Insights
        </h2>
        <p className="text-purple-700 text-sm">
          Real-time analysis of pedestrian traffic patterns and crowd safety recommendations.
        </p>
      </div>

      {/* Safety Status Banner */}
      <div className={`rounded-xl border-2 p-6 shadow-lg ${getSafetyColor(insights.safetyStatus)}`}>
        <div className="flex items-center space-x-4">
          <Shield className="w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-xl">
              Safety Status: {insights.safetyStatus.toUpperCase()}
            </h3>
            <p className="text-sm mt-1 leading-relaxed">
              {insights.safetyStatus === 'warning' ? 
                'Multiple critical areas detected. Immediate attention required.' :
                insights.safetyStatus === 'caution' ?
                'Some areas have high crowd density. Monitor closely.' :
                'All areas within safe crowd limits.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total People */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total People</h3>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{insights.totalPeople.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Across all areas</p>
            <div className="flex items-center space-x-1">
              {getTrendIcon(insights.crowdTrend)}
              <span className="text-xs text-gray-600 capitalize font-medium">{insights.crowdTrend}</span>
            </div>
          </div>
        </div>

        {/* Congestion Level */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Congestion</h3>
            <Navigation className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-2">
            <p className={`text-sm font-medium px-3 py-2 rounded-full ${getCongestionColor(insights.congestionLevel)}`}>
              {insights.congestionLevel.toUpperCase()}
            </p>
            <p className="text-xs text-gray-500">
              {insights.highCrowdAreas} high-density areas
            </p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.congestionLevel === 'low' ? 'Free-flowing traffic' :
               insights.congestionLevel === 'moderate' ? 'Moderate delays' : 'Significant delays'}
            </p>
          </div>
        </div>

        {/* Temperature Impact */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Avg Temperature</h3>
            <ThermometerSun className="w-5 h-5 text-red-500" />
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{insights.averageTemp}°C</p>
            <p className="text-xs text-gray-500">Environmental factor</p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.averageTemp > 32 ? 'Very hot - affects comfort' :
               insights.averageTemp > 28 ? 'Warm - comfortable' :
               'Pleasant temperature'}
            </p>
          </div>
        </div>

        {/* Peak Hours */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Peak Activity</h3>
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900">{insights.peakHours}</p>
            <p className="text-xs text-gray-500">Current period</p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.totalPeople > 500 ? 'High activity' : 'Normal activity'}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Area Spotlight */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-6 h-6 mr-3 text-red-500" />
            Area Analysis
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Busiest Area:</p>
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-900">{insights.busiestArea}</p>
                {footprintData && footprintData.length > 0 && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formatCrowdLevel(footprintData.find(a => a.area_name === insights.busiestArea)?.crowd_level).color
                  }`}>
                    {formatCrowdLevel(footprintData.find(a => a.area_name === insights.busiestArea)?.crowd_level).label}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Least Crowded:</p>
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-900">{insights.safestArea}</p>
                {footprintData && footprintData.length > 0 && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    formatCrowdLevel(footprintData.find(a => a.area_name === insights.safestArea)?.crowd_level).color
                  }`}>
                    {formatCrowdLevel(footprintData.find(a => a.area_name === insights.safestArea)?.crowd_level).label}
                  </span>
                )}
              </div>
            </div>

            {statistics && statistics.crowd_distribution && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Crowd Distribution:</p>
                <div className="space-y-1">
                  {Object.entries(statistics.crowd_distribution).map(([level, count]) => {
                    const display = formatCrowdLevel(level);
                    return (
                      <div key={level} className="flex justify-between items-center text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${display.color}`}>
                          {display.label}
                        </span>
                        <span className="font-medium">{count} areas</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* What This Means */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Users className="w-6 h-6 mr-3 text-blue-500" />
            What This Means
          </h3>
          <div className="space-y-5">
            <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-blue-800">For Pedestrians:</strong> {
                  insights.congestionLevel === 'high' ? 'Expect crowds and longer travel times. Consider alternative routes.' :
                  insights.congestionLevel === 'moderate' ? 'Some areas may be busy. Plan accordingly.' :
                  'Normal walking conditions. Most areas are comfortable.'
                }
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-xl border-l-4 border-green-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-green-800">For Businesses:</strong> {
                  insights.totalPeople > 1000 ? 'High foot traffic - great for business, ensure adequate staff.' :
                  insights.totalPeople > 500 ? 'Good customer flow expected.' :
                  'Light foot traffic - normal operations.'
                }
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-xl border-l-4 border-orange-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-orange-800">Safety Considerations:</strong> {
                  insights.criticalAreas > 0 ? 'Critical density in some areas. Enhanced monitoring needed.' :
                  insights.congestionLevel === 'high' ? 'Keep emergency paths clear. Monitor crowd flow.' :
                  'Normal safety conditions. Standard protocols sufficient.'
                }
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-xl border-l-4 border-purple-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-purple-800">Best Times to Visit:</strong> {
                  insights.peakHours !== 'Unknown' ? 
                    `Current period is ${insights.peakHours.includes('Rush') || insights.peakHours.includes('Lunch') ? 'busy' : 'quiet'}. ` :
                    ''
                }
                {insights.congestionLevel === 'low' ? 'Great time for comfortable travel.' : 'Consider visiting during off-peak hours.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-8 shadow-lg">
        <div className="flex items-start space-x-4">
          <AlertTriangle className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-purple-900 mb-3">Crowd Management Recommendation</h3>
            <p className="text-purple-800 text-base leading-relaxed">{insights.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FootprintAnalytics;
