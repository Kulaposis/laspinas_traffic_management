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
  MapPin
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
      averageTemp: Math.round(avgTemp * 10) / 10,
      highestTemp: Math.round(highestTemp * 10) / 10,
      lowestTemp: Math.round(lowestTemp * 10) / 10,
      avgHumidity: Math.round(avgHumidity),
      totalRainfall: Math.round(totalRainfall * 10) / 10,
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
    <div className="mt-8 mb-8 space-y-6 analytics-container">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h2 className="text-2xl font-bold text-blue-900 mb-2 flex items-center">
          <TrendingUp className="w-6 h-6 mr-3 text-blue-600" />
          Weather Analytics & Insights
        </h2>
        <p className="text-blue-700 text-sm">
          Easy-to-understand analysis of current weather conditions and their impact on daily activities.
        </p>
      </div>

      {/* Key Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Temperature Analysis */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Temperature Today</h3>
            {getTrendIcon(insights.temperatureTrend)}
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{insights.averageTemp}°C</p>
            <p className="text-xs text-gray-500">
              Range: {insights.lowestTemp}°C - {insights.highestTemp}°C
            </p>
            <p className="text-xs text-gray-600 capitalize font-medium">
              Trend: {insights.temperatureTrend}
            </p>
          </div>
        </div>

        {/* Rainfall Analysis */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rainfall Today</h3>
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{insights.totalRainfall}mm</p>
            <p className="text-xs text-gray-500">
              {insights.rainAreas} areas with rain
            </p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.totalRainfall === 0 ? 'No rain' :
               insights.totalRainfall < 2.5 ? 'Light rain' :
               insights.totalRainfall < 7.5 ? 'Moderate rain' : 'Heavy rain'}
            </p>
          </div>
        </div>

        {/* Humidity Analysis */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Humidity Level</h3>
            <Cloud className="w-5 h-5 text-gray-500" />
          </div>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{insights.avgHumidity}%</p>
            <p className="text-xs text-gray-500">Average across areas</p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.avgHumidity < 30 ? 'Very dry' :
               insights.avgHumidity < 60 ? 'Comfortable' :
               insights.avgHumidity < 80 ? 'Humid' : 'Very humid'}
            </p>
          </div>
        </div>

        {/* Flood Risk */}
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Flood Risk</h3>
            <Shield className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <p className={`text-sm font-medium px-3 py-2 rounded-full ${getRiskColor(insights.floodRisk)}`}>
              {insights.floodRisk.toUpperCase()}
            </p>
            <p className="text-xs text-gray-500">
              {insights.floodAreas} areas monitored
            </p>
            <p className="text-xs text-gray-600 font-medium">
              {insights.floodRisk === 'low' ? 'Safe to travel' :
               insights.floodRisk === 'moderate' ? 'Be cautious' : 'Avoid prone areas'}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* What This Means for You */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Sun className="w-6 h-6 mr-3 text-yellow-500" />
            What This Means for You
          </h3>
          <div className="space-y-5">
            <div className="p-4 bg-blue-50 rounded-xl border-l-4 border-blue-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-blue-800">Daily Activities:</strong> {
                  insights.averageTemp > 32 ? 'Very hot - limit outdoor activities during midday hours.' :
                  insights.averageTemp > 28 ? 'Warm - perfect for outdoor activities with sun protection.' :
                  insights.averageTemp > 24 ? 'Comfortable - great weather for most activities.' :
                  'Cool - ideal for outdoor sports and activities.'
                }
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-xl border-l-4 border-green-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-green-800">Transportation:</strong> {
                  insights.floodRisk === 'high' ? 'Consider alternative routes. Avoid flood-prone areas.' :
                  insights.totalRainfall > 5 ? 'Drive carefully, roads may be slippery.' :
                  'Normal driving conditions expected.'
                }
              </p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-xl border-l-4 border-yellow-400">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-yellow-800">Health Tips:</strong> {
                  insights.avgHumidity > 80 ? 'High humidity - stay in air-conditioned areas when possible.' :
                  insights.averageTemp > 30 ? 'Drink plenty of water and wear light-colored clothing.' :
                  'Comfortable conditions for all outdoor activities.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Area Spotlight */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-6 h-6 mr-3 text-red-500" />
            Area Spotlight
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">Most Weather Activity:</p>
              <p className="text-lg font-semibold text-gray-900">{insights.mostAffectedArea}</p>
            </div>

            {barangayData && barangayData.criticalAreas && barangayData.criticalAreas.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">High-Risk Barangays:</p>
                <div className="space-y-1">
                  {barangayData.criticalAreas.slice(0, 3).map((area, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-700">{area.name}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
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
              <div>
                <p className="text-sm text-gray-600 mb-2">Active Alerts:</p>
                <div className="space-y-1">
                  {weatherAlerts.slice(0, 2).map((alert) => (
                    <div key={alert.id} className="p-2 bg-red-50 rounded text-xs">
                      <p className="font-medium text-red-800">{alert.title}</p>
                      <p className="text-red-600">{alert.severity.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 shadow-lg">
        <div className="flex items-start space-x-4">
          <AlertTriangle className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-xl font-bold text-blue-900 mb-3">Today's Recommendation</h3>
            <p className="text-blue-800 text-base leading-relaxed">{insights.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherAnalytics;
