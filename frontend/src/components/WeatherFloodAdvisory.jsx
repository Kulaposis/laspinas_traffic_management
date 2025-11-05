import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, AlertTriangle, Droplets, X, ChevronUp, ChevronDown, MapPin, Clock } from 'lucide-react';
import weatherService from '../services/weatherService';
import enhancedGeocodingService from '../services/enhancedGeocodingService';

const WeatherFloodAdvisory = ({ mapCenter = [14.4504, 121.0170], locationName = 'Las Piñas City', sidebarOpen = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isClosed, setIsClosed] = useState(false);
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dragStartY, setDragStartY] = useState(null);
  const [dragCurrentY, setDragCurrentY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const collapsedHeight = 80; // Height of collapsed panel
  const expandedHeight = 400; // Max height of expanded panel

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('weatherAdvisoryClosed');
    if (savedState === 'true') {
      setIsClosed(true);
      setIsVisible(false);
    }
  }, []);

  // Fetch advisory data
  useEffect(() => {
    const fetchAdvisories = async () => {
      try {
        setLoading(true);
        const [advisoryData, floodAlerts, weatherAlerts] = await Promise.all([
          weatherService.getWeatherTrafficAdvisory(
            { lat: mapCenter[0], lng: mapCenter[1] },
            10 // 10km radius
          ).catch(() => null),
          weatherService.getFloodAlerts().catch(() => ({ flood_monitoring_alerts: [], weather_alerts: [], total_alerts: 0 })),
          weatherService.getWeatherAlerts({ is_active: true }).catch(() => [])
        ]);

        const advisoryList = [];

        // Helper function to get barangay/location name from coordinates
        const getLocationFromCoords = async (lat, lng, fallbackName) => {
          if (fallbackName && fallbackName !== 'Nearby Area' && fallbackName !== 'Unknown Location' && fallbackName !== 'Nearby Road') {
            return fallbackName;
          }
          
          try {
            const geocodeResult = await enhancedGeocodingService.reverseGeocode(lat, lng);
            if (geocodeResult && geocodeResult.length > 0) {
              const result = geocodeResult[0];
              // Try to extract barangay from address
              const address = result.address || {};
              const municipality = address.municipality || address.municipalitySubdivision || '';
              const streetName = address.streetName || '';
              const fullAddress = result.name || result.address?.full || result.address?.freeformAddress || '';
              
              // Common Las Piñas barangay names for better matching
              const lasPinasBarangays = [
                'Almanza Uno', 'Almanza Dos', 'B. F. International Village', 'Daniel Fajardo', 
                'Elias Aldana', 'Ilaya', 'Manuyo Uno', 'Manuyo Dos', 'Pamplona Uno', 
                'Pamplona Dos', 'Pamplona Tres', 'Pulang Lupa Uno', 'Pulang Lupa Dos', 
                'Talon Uno', 'Talon Dos', 'Talon Tres', 'Talon Cuatro', 'Talon Singko', 
                'Zapote', 'CAA-BF International', 'Las Piñas City'
              ];
              
              // Check if it's a barangay name (contains "Barangay" or matches known barangays)
              const barangayPatterns = [
                /Barangay\s+([^,]+)/i,
                /(?:Brgy\.?|Brg\.?)\s*([^,]+)/i,
                new RegExp(`(${lasPinasBarangays.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i')
              ];
              
              for (const pattern of barangayPatterns) {
                const match = fullAddress.match(pattern);
                if (match && match[1]) {
                  const matchedBarangay = match[1].trim();
                  // Verify it's a known barangay or contains "Barangay"
                  if (lasPinasBarangays.some(b => b.toLowerCase() === matchedBarangay.toLowerCase()) ||
                      matchedBarangay.toLowerCase().includes('barangay') ||
                      matchedBarangay.length > 3) {
                    return matchedBarangay;
                  }
                }
              }
              
              // Check if street name contains barangay info
              if (streetName) {
                const streetBarangayMatch = streetName.match(/Barangay\s+([^,]+)/i);
                if (streetBarangayMatch && streetBarangayMatch[1]) {
                  return streetBarangayMatch[1].trim();
                }
              }
              
              // Return municipality or street if available
              if (municipality && municipality !== 'Las Piñas') {
                return municipality;
              }
              if (streetName) {
                return streetName;
              }
              
              // Try to extract from full address
              if (fullAddress) {
                const parts = fullAddress.split(',');
                // Look for barangay-like patterns in address parts
                for (const part of parts) {
                  const trimmed = part.trim();
                  if (lasPinasBarangays.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
                    return trimmed;
                  }
                }
              }
            }
          } catch (error) {

          }
          
          return fallbackName;
        };

        // Process flood alerts
        if (advisoryData?.flood_alerts) {
          for (const alert of advisoryData.flood_alerts) {
            let location = alert.location_name || alert.area_name || alert.location || alert.barangay_name;
            
            // If no location name but we have coordinates, try reverse geocoding
            if ((!location || location === 'Unknown Location') && alert.latitude && alert.longitude) {
              location = await getLocationFromCoords(alert.latitude, alert.longitude, locationName);
            }
            
            // Final fallback
            if (!location || location === 'Unknown Location') {
              location = locationName;
            }
            
            advisoryList.push({
              id: `flood-${alert.id}`,
              type: 'flood',
              icon: '🌊',
              severity: alert.alert_level >= 3 ? 'high' : alert.alert_level >= 2 ? 'moderate' : 'low',
              message: `${location}: ${alert.flood_level || 'Flooding'} (Alert Level ${alert.alert_level})`,
              location: location,
              timestamp: alert.updated_at || alert.created_at,
              color: alert.alert_level >= 3 ? 'bg-red-100 border-red-300' : 
                     alert.alert_level >= 2 ? 'bg-orange-100 border-orange-300' : 
                     'bg-yellow-100 border-yellow-300'
            });
          }
        }

        // Process flood monitoring alerts from getFloodAlerts
        if (floodAlerts?.flood_monitoring_alerts) {
          for (const alert of floodAlerts.flood_monitoring_alerts) {
            if (alert.alert_level > 0) {
              let location = alert.location_name || alert.area_name || alert.location || alert.barangay_name;
              
              // If no location name but we have coordinates, try reverse geocoding
              if ((!location || location === 'Unknown Location') && alert.latitude && alert.longitude) {
                location = await getLocationFromCoords(alert.latitude, alert.longitude, locationName);
              }
              
              // Final fallback
              if (!location || location === 'Unknown Location') {
                location = locationName;
              }
              
              advisoryList.push({
                id: `flood-monitor-${alert.id}`,
                type: 'flood',
                icon: '🌊',
                severity: alert.alert_level >= 3 ? 'high' : alert.alert_level >= 2 ? 'moderate' : 'low',
                message: `${location}: ${alert.flood_level || 'Flooding'} detected`,
                location: location,
                timestamp: alert.updated_at || alert.created_at,
                color: alert.alert_level >= 3 ? 'bg-red-100 border-red-300' : 
                       alert.alert_level >= 2 ? 'bg-orange-100 border-orange-300' : 
                       'bg-yellow-100 border-yellow-300'
              });
            }
          }
        }

        // Process weather alerts
        const allWeatherAlerts = [
          ...(advisoryData?.weather_alerts || []),
          ...(weatherAlerts || []),
          ...(floodAlerts?.weather_alerts || [])
        ];

        // Remove duplicates
        const uniqueWeatherAlerts = Array.from(
          new Map(allWeatherAlerts.map(alert => [alert.id, alert])).values()
        );

        for (const alert of uniqueWeatherAlerts) {
          if (alert.is_active !== false) {
            // Parse affected_areas JSON if available
            let location = alert.area_name || locationName;
            
            try {
              if (alert.affected_areas) {
                const affectedAreas = typeof alert.affected_areas === 'string' 
                  ? JSON.parse(alert.affected_areas) 
                  : alert.affected_areas;
                
                if (Array.isArray(affectedAreas) && affectedAreas.length > 0) {
                  // Use first affected area
                  location = affectedAreas[0];
                } else if (typeof affectedAreas === 'string') {
                  location = affectedAreas;
                }
              }
            } catch (e) {

            }
            
            // If no location but we have coordinates, try reverse geocoding
            if ((!location || location === locationName) && alert.latitude && alert.longitude) {
              location = await getLocationFromCoords(alert.latitude, alert.longitude, location);
            }
            
            // Final fallback
            if (!location || location === 'Unknown Location') {
              location = locationName;
            }
            
            advisoryList.push({
              id: `weather-${alert.id}`,
              type: 'weather',
              icon: alert.alert_type === 'rain' || alert.alert_type === 'flood' ? '🌧️' : 
                    alert.alert_type === 'storm' ? '⛈️' : '⚠️',
              severity: alert.severity || 'moderate',
              message: alert.message || `${alert.alert_type || 'Weather'} alert`,
              location: location,
              timestamp: alert.updated_at || alert.created_at,
              color: alert.severity === 'critical' ? 'bg-red-100 border-red-300' :
                     alert.severity === 'warning' ? 'bg-orange-100 border-orange-300' :
                     'bg-blue-100 border-blue-300'
            });
          }
        }

        // Process traffic incidents from advisory
        if (advisoryData?.traffic_incidents) {
          for (const incident of advisoryData.traffic_incidents) {
            if (incident.is_active) {
              let location = incident.location || incident.road_name || incident.area_name;
              
              // If no location but we have coordinates, try reverse geocoding
              if ((!location || location === 'Nearby Road') && incident.latitude && incident.longitude) {
                location = await getLocationFromCoords(incident.latitude, incident.longitude, locationName);
              }
              
              // Final fallback
              if (!location || location === 'Nearby Road') {
                location = locationName;
              }
              
              advisoryList.push({
                id: `traffic-${incident.id}`,
                type: 'traffic',
                icon: '🚧',
                severity: ['high', 'critical'].includes(incident.severity) ? 'high' : 'moderate',
                message: `Traffic ${incident.incident_type?.replace('_', ' ') || 'incident'}: ${incident.description || 'Road condition may affect travel'}`,
                location: location,
                timestamp: incident.updated_at || incident.created_at,
                color: 'bg-amber-100 border-amber-300'
              });
            }
          }
        }

        // Sort by severity (critical/high first)
        advisoryList.sort((a, b) => {
          const severityOrder = { high: 3, moderate: 2, low: 1, advisory: 0 };
          return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        });

        setAdvisories(advisoryList);
        setLastUpdate(new Date());
      } catch (error) {

        // Set some default/mock data if API fails
        setAdvisories([
          {
            id: 'demo-1',
            type: 'weather',
            icon: '🌧️',
            severity: 'moderate',
            message: 'Heavy Rainfall Warning in BF International Village',
            location: 'BF International Village',
            timestamp: new Date().toISOString(),
            color: 'bg-blue-100 border-blue-300'
          },
          {
            id: 'demo-2',
            type: 'flood',
            icon: '🌊',
            severity: 'moderate',
            message: 'Flood Alert: Alabang–Zapote Road (moderate flooding)',
            location: 'Alabang–Zapote Road',
            timestamp: new Date().toISOString(),
            color: 'bg-orange-100 border-orange-300'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAdvisories();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAdvisories, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapCenter, locationName]);

  // Handle drag gestures
  const handleTouchStart = useCallback((e) => {
    // Only allow dragging on the header/drag area
    const target = e.target;
    const dragHandle = target.closest('.drag-handle') || target.closest('[data-drag-handle]');
    if (!dragHandle) {
      return;
    }
    
    e.preventDefault();
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setDragCurrentY(touch.clientY);
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || dragStartY === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDragCurrentY(touch.clientY);
  }, [isDragging, dragStartY]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || dragStartY === null || dragCurrentY === null) {
      setIsDragging(false);
      return;
    }

    const deltaY = dragCurrentY - dragStartY;
    const threshold = 50; // Minimum drag distance

    if (deltaY > threshold && isExpanded) {
      // Drag down while expanded - collapse
      setIsExpanded(false);
    } else if (deltaY < -threshold && !isExpanded) {
      // Drag up while collapsed - expand
      setIsExpanded(true);
    } else if (deltaY > threshold * 2 && !isExpanded) {
      // Strong drag down while collapsed - close
      handleClose();
    }

    setIsDragging(false);
    setDragStartY(null);
    setDragCurrentY(null);
  }, [isDragging, dragStartY, dragCurrentY, isExpanded]);

  const handleClose = () => {
    setIsClosed(true);
    setIsVisible(false);
    setIsExpanded(false);
    localStorage.setItem('weatherAdvisoryClosed', 'true');
  };

  const handleReopen = () => {
    setIsClosed(false);
    setIsVisible(true);
    setIsExpanded(true);
    localStorage.removeItem('weatherAdvisoryClosed');
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // Check if date is invalid
      if (isNaN(date.getTime())) return 'Recently';
      
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      // Check if same day
      const isToday = date.getDate() === now.getDate() && 
                     date.getMonth() === now.getMonth() && 
                     date.getFullYear() === now.getFullYear();
      
      // If less than 1 minute ago
      if (diffMins < 1) return 'Just now';
      
      // If less than 1 hour ago
      if (diffMins < 60) return `${diffMins}m ago`;
      
      // If less than 24 hours ago and today
      if (diffHours < 24 && isToday) {
        return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      
      // If less than 24 hours ago but not today (yesterday)
      if (diffHours < 24) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      
      // If same day but older than 24 hours (shouldn't happen, but handle it)
      if (isToday) {
        return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      }
      
      // If within 7 days, show day and time
      if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { 
          weekday: 'short', 
          hour: 'numeric', 
          minute: '2-digit' 
        });
      }
      
      // Otherwise show full date with time
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } catch {
      return 'Recently';
    }
  };

  const activeAdvisoriesCount = advisories.length;
  const hasHighSeverity = advisories.some(a => a.severity === 'high' || a.severity === 'critical');

  // Don't render if closed
  if (isClosed && !isVisible) {
    return (
      <button
        onClick={handleReopen}
        className="fixed bottom-4 z-[1000] px-4 py-2 bg-white/90 backdrop-blur-lg rounded-full shadow-lg border border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-white transition-all duration-200"
        style={{ 
          maxWidth: '90vw',
          left: sidebarOpen ? 'calc(50% + 160px)' : '50%',
          transform: 'translateX(-50%)',
          transition: 'left 0.3s ease-out'
        }}
      >
        <Cloud className="w-4 h-4" />
        <span>Weather</span>
        {activeAdvisoriesCount > 0 && (
          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full font-semibold">
            {activeAdvisoriesCount}
          </span>
        )}
      </button>
    );
  }

  // Calculate panel height based on drag or state
  const getPanelHeight = () => {
    if (isDragging && dragCurrentY !== null && dragStartY !== null) {
      const deltaY = dragCurrentY - dragStartY;
      if (isExpanded) {
        return Math.max(collapsedHeight, Math.min(expandedHeight, expandedHeight + deltaY));
      } else {
        return Math.max(collapsedHeight, Math.min(expandedHeight, collapsedHeight - deltaY));
      }
    }
    return isExpanded ? expandedHeight : collapsedHeight;
  };

  const panelHeight = getPanelHeight();
  const translateY = isDragging && dragCurrentY !== null && dragStartY !== null && !isExpanded
    ? Math.max(0, Math.min(expandedHeight - collapsedHeight, dragStartY - dragCurrentY))
    : 0;

  // Adjust left position when sidebar is open
  const leftOffset = sidebarOpen ? '320px' : '0px'; // 80 (w-80) = 320px, 96 (w-96) = 384px on sm, using 320px for consistency
  
  return (
    <div
      ref={panelRef}
      className={`fixed bottom-0 right-0 z-[1000] ${
        isDragging ? '' : 'transition-all duration-300 ease-out'
      } ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        height: `${panelHeight}px`,
        left: sidebarOpen ? '320px' : '0px',
        transform: isDragging ? `translateY(${translateY}px)` : undefined,
        touchAction: 'none',
        transition: isDragging ? undefined : 'left 0.3s ease-out, transform 0.3s ease-out'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Glassmorphism Panel */}
      <div className="w-full h-full bg-white/90 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-gray-200/50 flex flex-col overflow-hidden">
        {/* Drag Handle & Header */}
        <div className="flex-shrink-0 pt-3 pb-2 px-4 drag-handle" data-drag-handle>
          {/* Drag Bar */}
          <div className="w-12 h-1 bg-gray-400 rounded-full mx-auto mb-2 cursor-grab active:cursor-grabbing touch-none" />
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                hasHighSeverity ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {hasHighSeverity ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <Cloud className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  Weather & Flood Advisory
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{locationName}</span>
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="flex-shrink-0 ml-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close advisory panel"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : activeAdvisoriesCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <Cloud className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">All Clear</p>
              <p className="text-xs text-gray-500">No active weather or flood advisories</p>
            </div>
          ) : (
            <div className="space-y-2">
              {advisories.map((advisory) => (
                <div
                  key={advisory.id}
                  className={`p-3 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${advisory.color}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{advisory.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-relaxed mb-1">
                        {advisory.message}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{advisory.location}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimestamp(advisory.timestamp)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collapsed View Summary */}
        {!isExpanded && activeAdvisoriesCount > 0 && (
          <div 
            className="flex-shrink-0 px-4 pb-3 cursor-pointer drag-handle"
            onClick={toggleExpand}
            data-drag-handle
          >
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">{hasHighSeverity ? '⚠️' : '🌧️'}</span>
                <span className="text-sm font-medium text-gray-700">
                  {activeAdvisoriesCount} active {activeAdvisoriesCount === 1 ? 'advisory' : 'advisories'}
                </span>
              </div>
              <ChevronUp className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        )}

        {/* Expanded View Footer */}
        {isExpanded && (
          <div className="flex-shrink-0 px-4 pb-3 border-t border-gray-200/50 pt-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Updated {lastUpdate ? formatTimestamp(lastUpdate.toISOString()) : 'Just now'}</span>
              </span>
              <button
                onClick={toggleExpand}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <span>Less</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherFloodAdvisory;

