import React from 'react';
import { Cloud, CloudRain, CloudSnow, CloudFog, Wind, AlertTriangle, X } from 'lucide-react';

/**
 * Weather Alert Banner Component
 * Displays weather warnings and conditions
 */
const WeatherAlertBanner = ({ weather, warnings, onDismiss }) => {
  if (!weather && (!warnings || warnings.length === 0)) {
    return null;
  }

  const getWeatherIcon = (condition) => {
    const conditionLower = condition?.toLowerCase() || '';
    
    if (conditionLower.includes('rain') || conditionLower.includes('storm')) {
      return <CloudRain className="w-5 h-5" />;
    }
    if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
      return <CloudFog className="w-5 h-5" />;
    }
    if (conditionLower.includes('snow')) {
      return <CloudSnow className="w-5 h-5" />;
    }
    if (conditionLower.includes('wind')) {
      return <Wind className="w-5 h-5" />;
    }
    return <Cloud className="w-5 h-5" />;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500 border-red-600';
      case 'medium':
        return 'bg-orange-500 border-orange-600';
      case 'low':
        return 'bg-yellow-500 border-yellow-600';
      default:
        return 'bg-blue-500 border-blue-600';
    }
  };

  const highestSeverity = warnings?.reduce((max, w) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[w.severity] > severityOrder[max] ? w.severity : max;
  }, 'low');

  return (
    <div className={`
      ${getSeverityColor(highestSeverity)}
      text-white rounded-lg shadow-lg p-4 mb-4 border-l-4
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Weather Condition */}
          {weather?.overall && (
            <div className="flex items-center space-x-2 mb-2">
              {getWeatherIcon(weather.overall.condition)}
              <span className="font-semibold">
                {weather.overall.condition}
              </span>
              {weather.overall.temperature && (
                <span className="text-sm opacity-90">
                  • {Math.round(weather.overall.temperature)}°C
                </span>
              )}
            </div>
          )}

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((warning, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-4 p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default WeatherAlertBanner;
