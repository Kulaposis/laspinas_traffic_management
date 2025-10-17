import React, { useState, useEffect } from 'react';
import tomtomService from '../services/tomtomService';

/**
 * Map Style Switcher Component
 * Allows users to switch between different map styles and providers
 */
const MapStyleSwitcher = ({ onStyleChange, currentStyle = 'main' }) => {
  const [selectedStyle, setSelectedStyle] = useState(currentStyle);
  const [usageStats, setUsageStats] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Get initial usage stats
    setUsageStats(tomtomService.getUsageStats());
    
    // Update usage stats every minute
    const interval = setInterval(() => {
      setUsageStats(tomtomService.getUsageStats());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // While menu is open, temporarily disable map pointer events so Leaflet
  // doesn't capture clicks beneath the dropdown.
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('map-style-open');
    } else {
      document.body.classList.remove('map-style-open');
    }
    return () => document.body.classList.remove('map-style-open');
  }, [isOpen]);

  const mapStyles = [
    {
      id: 'main',
      name: 'TomTom Main',
      description: 'Standard TomTom map style',
      provider: 'TomTom',
      preview: '🗺️',
      requiresApi: true
    },
    {
      id: 'night',
      name: 'TomTom Night',
      description: 'Dark theme for night viewing',
      provider: 'TomTom',
      preview: '🌙',
      requiresApi: true
    },
    {
      id: 'satellite',
      name: 'TomTom Satellite',
      description: 'Satellite imagery',
      provider: 'TomTom',
      preview: '🛰️',
      requiresApi: true
    },
    {
      id: 'osm',
      name: 'OpenStreetMap',
      description: 'Free open-source map',
      provider: 'OpenStreetMap',
      preview: '🌍',
      requiresApi: false
    }
  ];

  const handleStyleChange = (style) => {
    setSelectedStyle(style.id);
    setIsOpen(false);
    
    if (onStyleChange) {
      onStyleChange(style);
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage < 50) return 'text-green-600';
    if (percentage < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUsageBarColor = (percentage) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative z-[1000]" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
      {/* Style Switcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
        title="Switch map style"
      >
        <span className="text-lg">
          {mapStyles.find(s => s.id === selectedStyle)?.preview || '🗺️'}
        </span>
        <span className="text-sm font-medium text-gray-700">
          {mapStyles.find(s => s.id === selectedStyle)?.name || 'Map Style'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-[1001] pointer-events-auto"
          onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); }}
          onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); }}
          tabIndex={-1}
          role="menu"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Map Style</h3>
            <p className="text-sm text-gray-500">Choose your preferred map style</p>
          </div>

          {/* Usage Stats */}
          {usageStats && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">TomTom API Usage</span>
                <span className={`text-sm font-medium ${getUsageColor(usageStats.usagePercentage)}`}>
                  {usageStats.requests}/{usageStats.dailyLimit}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${getUsageBarColor(usageStats.usagePercentage)}`}
                  style={{ width: `${Math.min(usageStats.usagePercentage, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {usageStats.remainingRequests} requests remaining today
              </p>
            </div>
          )}

          {/* Style Options */}
          <div className="py-2">
            {mapStyles.map((style) => {
              const isSelected = selectedStyle === style.id;
              const isAvailable = !style.requiresApi || tomtomService.canMakeRequest();
              
              return (
                <button
                  key={style.id}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); handleStyleChange(style); }}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation?.(); handleStyleChange(style); }}
                  disabled={!isAvailable}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{style.preview}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{style.name}</span>
                        {!isAvailable && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            Limit Reached
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{style.description}</p>
                      <p className="text-xs text-gray-400">Provider: {style.provider}</p>
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              TomTom styles require API key and have usage limits. 
              OpenStreetMap is always available as a free alternative.
            </p>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default MapStyleSwitcher;
