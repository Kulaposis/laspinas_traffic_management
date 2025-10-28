import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Thermometer,
  Droplets,
  Wind,
  Cloud,
  Sun,
  Shield,
  MapPin,
  Activity,
  Navigation
} from 'lucide-react';

const WeatherAnalytics = ({ weatherData, floodData, weatherAlerts, barangayData }) => {
  // Calculate analytics insights
  const calculateInsights = () => {
    if (!weatherData || weatherData.length === 0) {
      return {
        temperatureTrend: 'stable',
        averageTemp: 0,
        highestTemp: 0,
        lowestTemp: 0,
        rainAreas: 0,
        floodRisk: 'low',
        mostAffectedArea: 'N/A',
        recommendation: 'Monitor weather conditions regularly.'
      };
    }

    const temps = weatherData.map(w => w.temperature_celsius);
    const humidity = weatherData.map(w => w.humidity_percent);
    const rainfall = weatherData.map(w => w.rainfall_mm);
    
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const avgHumidity = humidity.reduce((a, b) => a + b, 0) / humidity.length;
    const totalRainfall = rainfall.reduce((a, b) => a + b, 0);
    
    const highestTemp = Math.max(...temps);
    const lowestTemp = Math.min(...temps);
    const rainAreas = weatherData.filter(w => w.rainfall_mm > 0).length;
    
    // Determine temperature trend
    let temperatureTrend = 'stable';
    if (avgTemp > 30) temperatureTrend = 'rising';
    else if (avgTemp < 25) temperatureTrend = 'falling';
    
    // Calculate flood risk based on rainfall and existing flood data
    let floodRisk = 'low';
    let floodAreas = 0;
    if (floodData && floodData.length > 0) {
      floodAreas = floodData.filter(f => f.alert_level > 0).length;
      if (floodAreas > 2 || totalRainfall > 20) floodRisk = 'high';
      else if (floodAreas > 0 || totalRainfall > 5) floodRisk = 'moderate';
    }
    
    // Find most affected area
    const mostAffectedArea = weatherData.reduce((prev, current) => {
      const prevScore = prev.rainfall_mm + (prev.temperature_celsius > 32 ? 10 : 0);
      const currentScore = current.rainfall_mm + (current.temperature_celsius > 32 ? 10 : 0);
      return currentScore > prevScore ? current : prev;
    }, weatherData[0]);
    
    // Generate recommendation
    let recommendation = 'Weather conditions are normal. Continue regular monitoring.';
    if (floodRisk === 'high') {
      recommendation = '⚠️ High flood risk detected. Avoid low-lying areas and monitor evacuation centers.';
    } else if (avgTemp > 32) {
      recommendation = '🌡️ High temperatures detected. Stay hydrated and avoid prolonged outdoor activities.';
    } else if (totalRainfall > 10) {
      recommendation = '🌧️ Heavy rainfall expected. Be cautious of flooding in prone areas.';
    } else if (weatherAlerts && weatherAlerts.length > 0) {
      recommendation = '📢 Weather alerts are active. Follow official advisories and safety guidelines.';
    }
    
    return {
      temperatureTrend,
      averageTemp: Math.round(avgTemp),
      highestTemp: Math.round(highestTemp),
      lowestTemp: Math.round(lowestTemp),
      avgHumidity: Math.round(avgHumidity),
      totalRainfall: Math.round(totalRainfall),
      rainAreas,
      floodRisk,
      floodAreas,
      mostAffectedArea: mostAffectedArea.area_name,
      recommendation
    };
  };

  const insights = calculateInsights();

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'moderate': return 'text-orange-600 bg-orange-50';
      default: return 'text-green-600 bg-green-50';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'rising': return <TrendingUp className="w-5 h-5 text-red-500" />;
      case 'falling': return <TrendingDown className="w-5 h-5 text-blue-500" />;
      default: return <Wind className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="mt-8 mb-8 space-y-8 analytics-container">
      {/* Modern Header */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl border border-blue-200/50 p-8 shadow-lg">
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-900 via-indigo-800 to-purple-800 bg-clip-text text-transparent">
              Weather Analytics & Insights
            </h2>
            <p className="text-blue-700 text-lg font-medium">
              Easy-to-understand analysis of current weather conditions and their impact on daily activities.
            </p>
          </div>
        </div>
      </div>

      {/* Modern Key Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Temperature Analysis */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-white/20 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg">
              <Thermometer className="w-6 h-6 text-white" />
            </div>
            {getTrendIcon(insights.temperatureTrend)}
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Temperature Today</h3>
            <p className="text-4xl font-bold text-gray-900">{insights.averageTemp}°C</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Range: <span className="font-semibold">{insights.lowestTemp}°C - {insights.highestTemp}°C</span>
              </p>
              <p className="text-sm text-gray-600 capitalize font-medium">
                Trend: <span className="font-semibold">{insights.temperatureTrend}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Rainfall Analysis */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-white/20 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg">
              <Droplets className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Rainfall Today</h3>
            <p className="text-4xl font-bold text-gray-900">{insights.totalRainfall}mm</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{insights.rainAreas}</span> areas with rain
              </p>
              <p className="text-sm text-gray-600 font-medium">
                {insights.totalRainfall === 0 ? 'No rain' :
                 insights.totalRainfall < 2.5 ? 'Light rain' :
                 insights.totalRainfall < 7.5 ? 'Moderate rain' : 'Heavy rain'}
              </p>
            </div>
          </div>
        </div>

        {/* Humidity Analysis */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-white/20 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-gradient-to-r from-gray-500 to-blue-500 rounded-xl shadow-lg">
              <Cloud className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Humidity Level</h3>
            <p className="text-4xl font-bold text-gray-900">{insights.avgHumidity}%</p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Average across areas</p>
              <p className="text-sm text-gray-600 font-medium">
                {insights.avgHumidity < 30 ? 'Very dry' :
                 insights.avgHumidity < 60 ? 'Comfortable' :
                 insights.avgHumidity < 80 ? 'Humid' : 'Very humid'}
              </p>
            </div>
          </div>
        </div>

        {/* Flood Risk */}
        <div className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-8 border border-white/20 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Flood Risk</h3>
            <p className={`text-lg font-bold px-4 py-2 rounded-full ${getRiskColor(insights.floodRisk)}`}>
              {insights.floodRisk.toUpperCase()}
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{insights.floodAreas}</span> areas monitored
              </p>
              <p className="text-sm text-gray-600 font-medium">
                {insights.floodRisk === 'low' ? 'Safe to travel' :
                 insights.floodRisk === 'moderate' ? 'Be cautious' : 'Avoid prone areas'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* What This Means for You */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg">
              <Sun className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">What This Means for You</h3>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-l-4 border-blue-500 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-bold text-blue-800">Daily Activities</h4>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {insights.averageTemp > 32 ? 'Very hot - limit outdoor activities during midday hours.' :
                 insights.averageTemp > 28 ? 'Warm - perfect for outdoor activities with sun protection.' :
                 insights.averageTemp > 24 ? 'Comfortable - great weather for most activities.' :
                 'Cool - ideal for outdoor sports and activities.'}
              </p>
            </div>
            
            <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-l-4 border-green-500 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Navigation className="w-5 h-5 text-green-600" />
                </div>
                <h4 className="text-lg font-bold text-green-800">Transportation</h4>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {insights.floodRisk === 'high' ? 'Consider alternative routes. Avoid flood-prone areas.' :
                 insights.totalRainfall > 5 ? 'Drive carefully, roads may be slippery.' :
                 'Normal driving conditions expected.'}
              </p>
            </div>

            <div className="p-6 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl border-l-4 border-yellow-500 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Shield className="w-5 h-5 text-yellow-600" />
                </div>
                <h4 className="text-lg font-bold text-yellow-800">Health Tips</h4>
              </div>
              <p className="text-gray-700 leading-relaxed">
                {insights.avgHumidity > 80 ? 'High humidity - stay in air-conditioned areas when possible.' :
                 insights.averageTemp > 30 ? 'Drink plenty of water and wear light-colored clothing.' :
                 'Comfortable conditions for all outdoor activities.'}
              </p>
            </div>
          </div>
        </div>

        {/* Area Spotlight */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="flex items-center space-x-4 mb-8">
            <div className="p-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl shadow-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Area Spotlight</h3>
          </div>
          <div className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-2xl">
              <h4 className="text-sm font-bold text-gray-600 mb-3">Most Weather Activity</h4>
              <p className="text-xl font-bold text-gray-900">{insights.mostAffectedArea}</p>
            </div>

            {barangayData && barangayData.criticalAreas && barangayData.criticalAreas.length > 0 && (
              <div className="p-6 bg-red-50 rounded-2xl border border-red-200">
                <h4 className="text-sm font-bold text-red-800 mb-4 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  High-Risk Barangays
                </h4>
                <div className="space-y-3">
                  {barangayData.criticalAreas.slice(0, 3).map((area, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white rounded-xl border border-red-100">
                      <span className="font-semibold text-gray-700">{area.name}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        area.historical_flood_level === 'critical' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {area.historical_flood_level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weatherAlerts && weatherAlerts.length > 0 && (
              <div className="p-6 bg-orange-50 rounded-2xl border border-orange-200">
                <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Active Alerts
                </h4>
                <div className="space-y-3">
                  {weatherAlerts.slice(0, 2).map((alert) => (
                    <div key={alert.id} className="p-4 bg-white rounded-xl border border-orange-100">
                      <p className="font-bold text-orange-800">{alert.title}</p>
                      <p className="text-orange-600 text-sm font-semibold">{alert.severity.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Recommendation */}
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200/50 rounded-2xl p-8 shadow-xl">
        <div className="flex items-start space-x-6">
          <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex-shrink-0">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-blue-900 mb-4">Today's Recommendation</h3>
            <p className="text-blue-800 text-lg leading-relaxed font-medium">{insights.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherAnalytics;
