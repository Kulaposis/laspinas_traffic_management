import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, AlertTriangle, Droplets, X, ChevronUp, ChevronDown, MapPin, Clock, Thermometer, Wind } from 'lucide-react';

const WeatherFloodAdvisory = ({ mapCenter = [14.4504, 121.0170], locationName = 'Las Piñas City', sidebarOpen = false, avoidCenter = false, shouldHide = false }) => {
  // More accurate coordinates for Las Piñas City center (City Hall area)
  const lasPinasCenter = [14.4504, 121.0170];
  // Start collapsed and closed by default - user can open manually
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed
  const [isVisible, setIsVisible] = useState(false); // Start hidden
  const [isClosed, setIsClosed] = useState(true); // Start closed
  const [advisories, setAdvisories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [dragStartY, setDragStartY] = useState(null);
  const [dragCurrentY, setDragCurrentY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [floodRisk, setFloodRisk] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const panelRef = useRef(null);
  
  // Responsive heights: smaller on desktop, larger on mobile
  // On mobile, use viewport height to ensure footer is always visible
  // Increased collapsed height on mobile to show weather metrics properly
  const collapsedHeight = isDesktop ? 140 : 240; // Increased to 240 to show weather metrics + advisory preview on mobile
  const expandedHeight = isDesktop ? 400 : Math.min(viewportHeight * 0.85, 700); // Use 85% of viewport or max 700px on mobile
  
  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Don't auto-show on page load - always start closed
  // Panel will only show when user manually clicks the reopen button
  // This prevents auto-opening on page reload or first visit

  // Fetch real-time weather from Open-Meteo with hourly data for today
  const fetchOpenMeteoWeather = useCallback(async (lat, lon) => {
    try {
      const now = new Date();
      // Get today's date in Manila timezone
      const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const today = manilaTime.toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      
      // Combine current and hourly data in a single request
      // Using precise coordinates and elevation for better accuracy
      // Las Piñas City elevation is approximately 10-15m above sea level
      const params = new URLSearchParams({
        latitude: lat.toFixed(4), // Use 4 decimal places for ~11m precision
        longitude: lon.toFixed(4),
        elevation: '12', // Approximate elevation for Las Piñas City in meters
        current: [
          'temperature_2m',
          'relative_humidity_2m',
          'precipitation',
          'weather_code',
          'cloud_cover',
          'wind_speed_10m',
          'wind_direction_10m',
          'pressure_msl'
        ].join(','),
        hourly: 'precipitation',
        timezone: 'Asia/Manila',
        forecast_days: 2 // Get 2 days to ensure we have today's full data
      });

      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch weather data: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.current) {
        return null;
      }
      
      // Calculate today's total precipitation from hourly data
      let todayPrecipitation = 0;
      if (data.hourly && data.hourly.precipitation && data.hourly.time) {
        const precipitationArray = data.hourly.precipitation;
        const timeArray = data.hourly.time;
        const currentHour = manilaTime.getHours();
        const currentMinutes = manilaTime.getMinutes();
        
        // Find all hours that belong to today and sum precipitation up to current hour
        for (let i = 0; i < timeArray.length; i++) {
          const timeStr = timeArray[i];
          if (timeStr && timeStr.startsWith(today)) {
            // Parse the hour from the time string (format: YYYY-MM-DDTHH:00)
            const hourMatch = timeStr.match(/T(\d{2}):/);
            if (hourMatch) {
              const hour = parseInt(hourMatch[1], 10);
              // Only count hours that have passed (or current hour)
              if (hour <= currentHour) {
                todayPrecipitation += precipitationArray[i] || 0;
              }
            }
          }
        }
        
        // If we're in the current hour, add a proportion of current precipitation
        // This is an estimate since we don't have minute-level data
        if (currentMinutes > 0 && data.current.precipitation) {
          // Add a portion of current precipitation based on minutes passed
          const hourFraction = currentMinutes / 60;
          todayPrecipitation += data.current.precipitation * hourFraction;
        }
      }
      
      // Fallback: if we can't calculate from hourly data, use current precipitation as estimate
      // Multiply by hours passed today as a rough estimate
      if (todayPrecipitation === 0 && data.current.precipitation) {
        const hoursPassed = manilaTime.getHours() + (manilaTime.getMinutes() / 60);
        todayPrecipitation = data.current.precipitation * Math.max(1, hoursPassed);
      }
      
      return {
        current: data.current,
        todayPrecipitation: Math.max(todayPrecipitation, data.current.precipitation || 0),
        hourly: data.hourly || null
      };
    } catch (error) {
      return null;
    }
  }, []);

  // Assess flood risk based on precipitation (using today's accumulated precipitation)
  const assessFloodRisk = useCallback((currentPrecipitation, todayPrecipitation, weatherCode) => {
    // Use today's accumulated precipitation for better flood risk assessment
    const totalPrecipitation = todayPrecipitation > 0 ? todayPrecipitation : (currentPrecipitation || 0);
    
    if (!totalPrecipitation && totalPrecipitation !== 0) return null;
    
    let risk = 'normal';
    let level = 0;
    let message = 'No flood risk - Clear conditions';
    
    // Assess based on today's total precipitation (more accurate for flooding)
    if (totalPrecipitation > 50) {
      risk = 'critical';
      level = 4;
      message = `Critical flood risk - ${totalPrecipitation.toFixed(1)}mm of rain today`;
    } else if (totalPrecipitation > 30) {
      risk = 'high';
      level = 3;
      message = `High flood risk - ${totalPrecipitation.toFixed(1)}mm of rain today`;
    } else if (totalPrecipitation > 15) {
      risk = 'moderate';
      level = 2;
      message = `Moderate flood risk - ${totalPrecipitation.toFixed(1)}mm of rain today`;
    } else if (totalPrecipitation > 5) {
      risk = 'low';
      level = 1;
      message = `Low flood risk - ${totalPrecipitation.toFixed(1)}mm of rain today`;
    } else if (totalPrecipitation > 0 || currentPrecipitation > 0) {
      risk = 'normal';
      level = 0;
      const current = currentPrecipitation > 0 ? currentPrecipitation.toFixed(1) : totalPrecipitation.toFixed(1);
      message = `Light rain - ${current}mm (Monitor conditions)`;
    }
    
    // Thunderstorms can exacerbate flooding
    if (weatherCode >= 95 && weatherCode <= 99) {
      level = Math.min(4, level + 1);
      if (risk === 'normal') risk = 'low';
      message += ' with thunderstorms';
    }
    
    return { risk, level, message, precipitation: totalPrecipitation, currentPrecipitation };
  }, []);

  // Las Piñas City barangays with coordinates
  const lasPinasBarangays = [
    { name: 'Almanza Uno', lat: 14.4083, lon: 120.9875 },
    { name: 'Almanza Dos', lat: 14.4100, lon: 120.9900 },
    { name: 'B. F. International Village', lat: 14.4200, lon: 121.0000 },
    { name: 'Daniel Fajardo', lat: 14.4300, lon: 121.0100 },
    { name: 'Elias Aldana', lat: 14.4400, lon: 121.0200 },
    { name: 'Ilaya', lat: 14.4500, lon: 121.0300 },
    { name: 'Manuyo Uno', lat: 14.4600, lon: 121.0400 },
    { name: 'Manuyo Dos', lat: 14.4700, lon: 121.0500 },
    { name: 'Pamplona Uno', lat: 14.4800, lon: 121.0600 },
    { name: 'Pamplona Dos', lat: 14.4900, lon: 121.0700 },
    { name: 'Pamplona Tres', lat: 14.5000, lon: 121.0800 },
    { name: 'Pulang Lupa Uno', lat: 14.5100, lon: 121.0900 },
    { name: 'Pulang Lupa Dos', lat: 14.5200, lon: 121.1000 },
    { name: 'Talon Uno', lat: 14.5300, lon: 121.1100 },
    { name: 'Talon Dos', lat: 14.5400, lon: 121.1200 },
    { name: 'Talon Tres', lat: 14.5500, lon: 121.1300 },
    { name: 'Talon Cuatro', lat: 14.5600, lon: 121.1400 },
    { name: 'Talon Singko', lat: 14.5700, lon: 121.1500 },
    { name: 'Zapote', lat: 14.4504, lon: 121.0170 },
    { name: 'CAA-BF International', lat: 14.4200, lon: 121.0000 },
    { name: 'Las Piñas City', lat: 14.4504, lon: 121.0170 }
  ];

  // Fetch global flood data for Las Piñas barangays
  const fetchGlobalFloodData = useCallback(async () => {
    try {
      const now = new Date();
      const floodAlerts = [];

      // Use Open-Meteo flood risk data for key flood-prone barangays
      // Only check a subset of key barangays to avoid too many API calls
      // Focus on known flood-prone areas: Zapote, Talon areas, Pulang Lupa, Manuyo
      const keyBarangays = lasPinasBarangays.filter(b => 
        b.name.includes('Zapote') || 
        b.name.includes('Talon') || 
        b.name.includes('Pulang Lupa') || 
        b.name.includes('Manuyo') ||
        b.name.includes('Ilaya')
      );
      
      // Limit to 5 barangays to avoid rate limiting
      const barangaysToCheck = keyBarangays.slice(0, 5);
      
      for (const barangay of barangaysToCheck) {
        try {
          // Get weather data for this barangay
          const weatherData = await fetchOpenMeteoWeather(barangay.lat, barangay.lon);
          
          if (weatherData && weatherData.current) {
            const currentPrecip = weatherData.current.precipitation || 0;
            const todayPrecip = weatherData.todayPrecipitation || 0;
            
            // If there's significant precipitation today, check for flood risk
            if (todayPrecip > 15 || currentPrecip > 5) {
              const risk = assessFloodRisk(currentPrecip, todayPrecip, weatherData.current.weather_code);
              
              // Only add if there's actual flood risk (not just light rain)
              if (risk && risk.level >= 2) {
                // Check if we already have an alert for this barangay
                const existingAlert = floodAlerts.find(a => a.barangay === barangay.name);
                if (!existingAlert) {
                  floodAlerts.push({
                    id: `openmeteo-${barangay.name}-${now.getTime()}`,
                    barangay: barangay.name,
                    severity: risk.risk,
                    source: 'Open-Meteo Flood Risk',
                    timestamp: now.toISOString(),
                    description: `${risk.message} - ${todayPrecip.toFixed(1)}mm total today`,
                    coordinates: { lat: barangay.lat, lon: barangay.lon },
                    precipitation: todayPrecip,
                    alertLevel: risk.level
                  });
                }
              }
            }
          }
        } catch (error) {
          // Skip barangays that fail to fetch
          continue;
        }
      }

      return floodAlerts;
    } catch (error) {
      return [];
    }
  }, [fetchOpenMeteoWeather, assessFloodRisk]);

  // Get weather condition icon and text
  const getWeatherCondition = useCallback((weatherCode) => {
    const conditions = {
      0: { icon: '☀️', text: 'Clear', color: 'text-yellow-500' },
      1: { icon: '🌤️', text: 'Mainly Clear', color: 'text-blue-400' },
      2: { icon: '⛅', text: 'Partly Cloudy', color: 'text-blue-300' },
      3: { icon: '☁️', text: 'Overcast', color: 'text-gray-400' },
      45: { icon: '🌫️', text: 'Fog', color: 'text-gray-300' },
      48: { icon: '🌫️', text: 'Depositing Rime Fog', color: 'text-gray-300' },
      51: { icon: '🌦️', text: 'Light Drizzle', color: 'text-blue-400' },
      53: { icon: '🌦️', text: 'Moderate Drizzle', color: 'text-blue-500' },
      55: { icon: '🌧️', text: 'Dense Drizzle', color: 'text-blue-600' },
      61: { icon: '🌧️', text: 'Slight Rain', color: 'text-blue-500' },
      63: { icon: '🌧️', text: 'Moderate Rain', color: 'text-blue-600' },
      65: { icon: '⛈️', text: 'Heavy Rain', color: 'text-blue-700' },
      71: { icon: '🌨️', text: 'Slight Snow', color: 'text-gray-300' },
      73: { icon: '🌨️', text: 'Moderate Snow', color: 'text-gray-400' },
      75: { icon: '🌨️', text: 'Heavy Snow', color: 'text-gray-500' },
      80: { icon: '🌦️', text: 'Slight Rain Showers', color: 'text-blue-500' },
      81: { icon: '🌧️', text: 'Moderate Rain Showers', color: 'text-blue-600' },
      82: { icon: '⛈️', text: 'Violent Rain Showers', color: 'text-blue-800' },
      95: { icon: '⛈️', text: 'Thunderstorm', color: 'text-purple-600' },
      96: { icon: '⛈️', text: 'Thunderstorm with Hail', color: 'text-purple-700' },
      99: { icon: '⛈️', text: 'Heavy Thunderstorm', color: 'text-purple-800' }
    };
    return conditions[weatherCode] || { icon: '🌤️', text: 'Unknown', color: 'text-gray-400' };
  }, []);

  // Fetch advisory data - ONLY from Open-Meteo (real-time data) + Global Flood API
  useEffect(() => {
    const fetchAdvisories = async () => {
      try {
        setLoading(true);
        
        // Fetch real-time weather from Open-Meteo (ONLY SOURCE)
        const openMeteoResponse = await fetchOpenMeteoWeather(mapCenter[0], mapCenter[1]);
        
        if (!openMeteoResponse || !openMeteoResponse.current) {
          setAdvisories([]);
          setCurrentWeather(null);
          setFloodRisk(null);
          setLastUpdate(new Date());
          setLoading(false);
          return;
        }

        const currentData = openMeteoResponse.current;
        const todayPrecipitation = openMeteoResponse.todayPrecipitation || 0;
        const currentPrecipitation = currentData.precipitation || 0;
        
        // Set current weather data
        // Round temperature to 1 decimal place for better accuracy
        const temperature = currentData.temperature_2m ? Math.round(currentData.temperature_2m * 10) / 10 : null;
        
        setCurrentWeather({
          temperature: temperature,
          humidity: currentData.relative_humidity_2m,
          precipitation: currentPrecipitation,
          currentPrecipitation: currentPrecipitation,
          todayPrecipitation: todayPrecipitation,
          weatherCode: currentData.weather_code,
          cloudCover: currentData.cloud_cover,
          windSpeed: currentData.wind_speed_10m,
          windDirection: currentData.wind_direction_10m,
          pressure: currentData.pressure_msl,
          condition: getWeatherCondition(currentData.weather_code)
        });
        
        // Assess flood risk based on today's accumulated precipitation
        const risk = assessFloodRisk(currentPrecipitation, todayPrecipitation, currentData.weather_code);
        setFloodRisk(risk);

        // Fetch global flood data for Las Piñas barangays
        const globalFloodAlerts = await fetchGlobalFloodData();

        // Build advisory list from Open-Meteo real-time data + Global Flood API
        const advisoryList = [];
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // Today's date
        
        // Add global flood alerts for barangays experiencing flooding
        for (const floodAlert of globalFloodAlerts) {
          advisoryList.push({
            id: floodAlert.id,
            type: 'flood',
            icon: '🌊',
            severity: floodAlert.severity,
            message: `${floodAlert.barangay}: ${floodAlert.description}`,
            location: floodAlert.barangay,
            timestamp: floodAlert.timestamp,
            color: floodAlert.severity === 'critical' ? 'bg-red-100 border-red-300' :
                   floodAlert.severity === 'high' ? 'bg-orange-100 border-orange-300' :
                   floodAlert.severity === 'moderate' ? 'bg-yellow-100 border-yellow-300' :
                   'bg-blue-100 border-blue-300',
            isRealtime: true,
            source: floodAlert.source,
            coordinates: floodAlert.coordinates,
            precipitation: floodAlert.precipitation
          });
        }

        // Add weather condition advisory if significant (rain, rain showers, or other significant weather)
        const condition = getWeatherCondition(currentData.weather_code);
        const weatherCode = currentData.weather_code;
        
        // Add thunderstorm warning first (highest priority, separate from regular weather)
        if (weatherCode >= 95 && weatherCode <= 99) {
              advisoryList.push({
            id: 'openmeteo-thunderstorm',
            type: 'weather',
            icon: '⛈️',
            severity: 'high',
            message: `${locationName}: Thunderstorm warning - Stay indoors`,
            location: locationName,
            timestamp: now.toISOString(),
            color: 'bg-purple-100 border-purple-300',
            isRealtime: true
          });
        }
        
        // Show advisory for: rain (61-67), rain showers (80-82), or fog (45-48)
        // Skip if already showing thunderstorm (95-99)
        if (weatherCode < 95 && 
            ((weatherCode >= 61 && weatherCode <= 67) || 
             (weatherCode >= 80 && weatherCode <= 82) || 
             (weatherCode >= 45 && weatherCode <= 48))) {
            advisoryList.push({
            id: `openmeteo-weather-${now.getTime()}`,
              type: 'weather',
            icon: condition.icon,
            severity: weatherCode >= 82 ? 'high' : 
                     (weatherCode >= 65 && weatherCode <= 67) || weatherCode >= 81 ? 'moderate' : 'low',
            message: `${locationName}: ${condition.text}${currentPrecipitation > 0 ? ` - ${currentPrecipitation.toFixed(1)}mm/h` : ''}`,
            location: locationName,
            timestamp: now.toISOString(),
            color: weatherCode >= 82 ? 'bg-red-100 border-red-300' :
                   (weatherCode >= 65 && weatherCode <= 67) ? 'bg-orange-100 border-orange-300' :
                   'bg-blue-100 border-blue-300',
            isRealtime: true
          });
        }

        // Add flood risk advisory if there's significant risk (based on today's accumulated precipitation)
        if (risk && risk.level > 0) {
          advisoryList.unshift({
            id: 'openmeteo-flood-risk',
            type: 'flood',
            icon: '🌊',
            severity: risk.risk,
            message: `${locationName}: ${risk.message}`,
            location: locationName,
            timestamp: now.toISOString(),
            color: risk.risk === 'critical' ? 'bg-red-100 border-red-300' :
                   risk.risk === 'high' ? 'bg-orange-100 border-orange-300' :
                   risk.risk === 'moderate' ? 'bg-yellow-100 border-yellow-300' :
                   'bg-blue-100 border-blue-300',
            isRealtime: true,
            precipitation: risk.precipitation
          });
        }

        // Sort by severity (critical/high first)
        advisoryList.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1, normal: 0, advisory: 0 };
          return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        });

        setAdvisories(advisoryList);
        setLastUpdate(now);
        
        // Check for high severity alerts
        const hasHighSeverityAlerts = advisoryList.some(a => a.severity === 'high' || a.severity === 'critical');
        
        // Don't auto-show panel when data loads - user must manually open it
        // Panel state is controlled by isClosed and isVisible, which start as closed
        // Removed auto-show logic to prevent panel from opening automatically
      } catch (error) {
        setAdvisories([]);
        setCurrentWeather(null);
        setFloodRisk(null);
      } finally {
        setLoading(false);
      }
    };

    // Always fetch data in background (even when hidden) so reopen button can show advisory count
    // But don't auto-show the panel when data loads
    fetchAdvisories();
    // Refresh every 5 minutes for real-time Open-Meteo data and global flood data
    const interval = setInterval(fetchAdvisories, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapCenter, locationName, fetchOpenMeteoWeather, getWeatherCondition, assessFloodRisk, fetchGlobalFloodData]);
  

  // Handle drag gestures
  const handleTouchStart = useCallback((e) => {
    // Only allow dragging on the header/drag area
    const target = e.target;
    const dragHandle = target.closest('.drag-handle') || target.closest('[data-drag-handle]');
    if (!dragHandle) {
      return;
    }
    
    // Don't prevent default immediately - allow clicks/taps to work
    // Only prevent default when actual dragging is detected
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setDragCurrentY(touch.clientY);
    setIsDragging(false); // Start as false, only set to true when movement detected
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (dragStartY === null) return;
    
    const touch = e.touches[0];
    const currentY = touch.clientY;
    const deltaY = Math.abs(currentY - dragStartY);
    
    // Only start dragging if movement exceeds a small threshold (prevents accidental drags)
    if (deltaY > 10) {
      if (!isDragging) {
        setIsDragging(true);
        // Prevent default only when actual dragging starts
        e.preventDefault();
      } else {
        e.preventDefault();
      }
      setDragCurrentY(currentY);
    }
  }, [isDragging, dragStartY]);

  const handleTouchEnd = useCallback((e) => {
    if (dragStartY === null || dragCurrentY === null) {
      setIsDragging(false);
      setDragStartY(null);
      setDragCurrentY(null);
      return;
    }

    const deltaY = dragCurrentY - dragStartY;
    const threshold = 50; // Minimum drag distance

    // Only handle drag actions if we were actually dragging
    if (isDragging) {
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
    }
    // If not dragging (just a tap), let the onClick handle it

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

  // Don't render anything if parent wants to hide it
  if (shouldHide) {
    return null;
  }

  // Don't render if closed (but show reopen button when not hidden)
  if (isClosed && !isVisible) {
    return (
      <button
        onClick={handleReopen}
        className="fixed bottom-4 z-[1000] px-4 py-2 bg-white/90 backdrop-blur-lg rounded-full shadow-lg border border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-white transition-all duration-200"
        style={{ 
          maxWidth: '90vw',
          left: avoidCenter ? '1rem' : (sidebarOpen ? 'calc(50% + 160px)' : '50%'),
          transform: avoidCenter ? 'none' : 'translateX(-50%)',
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

  // Adjust position for desktop: make it a compact card on the right side
  const panelWidth = isDesktop ? '480px' : '100%';
  const panelPosition = isDesktop ? { right: '1rem', left: 'auto', maxWidth: '480px' } : { left: sidebarOpen ? '320px' : '0px', right: '0px' };
  
  return (
    <div
      ref={panelRef}
      className={`fixed bottom-0 z-[1000] ${
        isDragging ? '' : 'transition-all duration-300 ease-out'
      } ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        height: `${panelHeight}px`,
        width: panelWidth,
        ...panelPosition,
        transform: isDragging ? `translateY(${translateY}px)` : undefined,
        transition: isDragging ? undefined : 'left 0.3s ease-out, right 0.3s ease-out, transform 0.3s ease-out'
      }}
    >
      {/* Glassmorphism Panel - Scrollable */}
      <div className="w-full h-full bg-white/98 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-x border-gray-200/30 flex flex-col overflow-hidden">
        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto" style={{ 
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}>
        {/* Drag Handle & Header */}
        <div 
          className={`flex-shrink-0 drag-handle ${!isDesktop ? 'pt-3 pb-3 px-4' : 'pt-2.5 pb-2 px-4'}`}
          data-drag-handle
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          {/* Drag Bar - Enhanced for mobile */}
          {!isDesktop && (
            <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 cursor-grab active:cursor-grabbing shadow-sm" />
          )}
          
          {/* Header - Modern Design */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`flex-shrink-0 ${!isDesktop ? 'w-12 h-12' : 'w-9 h-9'} rounded-xl flex items-center justify-center shadow-sm transition-all ${
                hasHighSeverity ? 'bg-gradient-to-br from-red-500 to-red-600' : currentWeather ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-200'
              }`}>
                {hasHighSeverity ? (
                  <AlertTriangle className={`${!isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-white`} />
                ) : currentWeather ? (
                  <span className={`${!isDesktop ? 'text-2xl' : 'text-lg'}`}>{currentWeather.condition.icon}</span>
                ) : (
                  <Cloud className={`${!isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-gray-600`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`${!isDesktop ? 'text-base' : 'text-sm'} font-bold text-gray-900 truncate`}>
                  Weather & Flood
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-500" />
                  <span className="truncate font-medium">{locationName}</span>
                </div>
              </div>
            </div>
            
            {/* Close Button - Enhanced */}
            <button
              onClick={handleClose}
              className={`flex-shrink-0 ml-2 ${!isDesktop ? 'p-2' : 'p-1'} rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all active:scale-95`}
              aria-label="Close advisory panel"
            >
              <X className={`${!isDesktop ? 'w-5 h-5' : 'w-4 h-4'} text-gray-700`} />
            </button>
          </div>
          
          {/* Current Weather Display - Compact Design */}
          {currentWeather && (
            <div className={`${!isDesktop ? 'py-2 px-2.5' : 'py-2 px-2'} bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200/50 shadow-sm`}>
              <div className={`grid grid-cols-4 ${!isDesktop ? 'gap-2' : 'gap-1.5'}`}>
                <div className="flex flex-col items-center group">
                  <div className={`${!isDesktop ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-red-100 flex items-center justify-center mb-1 group-hover:bg-red-200 transition-colors`}>
                    <Thermometer className={`${!isDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-red-600`} />
                  </div>
                  <span className={`${!isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-gray-900 mb-0.5`}>
                    {currentWeather.temperature !== null && currentWeather.temperature !== undefined 
                      ? currentWeather.temperature.toFixed(1) 
                      : '--'}°C
                  </span>
                  <span className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600`}>Temp</span>
                </div>
                <div className="flex flex-col items-center group">
                  <div className={`${!isDesktop ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-blue-100 flex items-center justify-center mb-1 group-hover:bg-blue-200 transition-colors`}>
                    <Droplets className={`${!isDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-blue-600`} />
                  </div>
                  <span className={`${!isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-gray-900 mb-0.5`}>{currentWeather.humidity}%</span>
                  <span className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600`}>Humidity</span>
                </div>
                <div className="flex flex-col items-center group">
                  <div className={`${!isDesktop ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-gray-100 flex items-center justify-center mb-1 group-hover:bg-gray-200 transition-colors`}>
                    <Cloud className={`${!isDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-gray-600`} />
                  </div>
                  <span className={`${!isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-gray-900 mb-0.5`}>
                    {currentWeather.currentPrecipitation?.toFixed(1) || currentWeather.precipitation?.toFixed(1) || '0'}mm
                  </span>
                  <span className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600`}>Rain/h</span>
                </div>
                <div className="flex flex-col items-center group">
                  <div className={`${!isDesktop ? 'w-7 h-7' : 'w-6 h-6'} rounded-lg bg-green-100 flex items-center justify-center mb-1 group-hover:bg-green-200 transition-colors`}>
                    <Wind className={`${!isDesktop ? 'w-3.5 h-3.5' : 'w-3 h-3'} text-green-600`} />
                  </div>
                  <span className={`${!isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-gray-900 mb-0.5`}>
                    {Math.round(currentWeather.windSpeed || 0)}
                  </span>
                  <span className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600`}>km/h</span>
                </div>
              </div>
              {currentWeather.todayPrecipitation > 0 && (
                <div className={`mt-2 pt-2 border-t border-blue-200/50 text-center`}>
                  <span className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full inline-block`}>
                    Today's Total: {currentWeather.todayPrecipitation.toFixed(1)}mm
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Area - Weather Updates */}
        {isExpanded && (
          <div 
            className={`${!isDesktop ? 'px-4 pb-2 mt-2' : 'px-3 pb-2 mt-1'}`}
          >
          {loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative w-12 h-12 mb-3">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-sm font-medium text-gray-700">Loading weather data...</p>
            </div>
          ) : activeAdvisoriesCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className={`${!isDesktop ? 'w-16 h-16' : 'w-12 h-12'} rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mb-3 shadow-sm`}>
                  <Cloud className={`${!isDesktop ? 'w-8 h-8' : 'w-6 h-6'} text-green-600`} />
                </div>
                <p className={`${!isDesktop ? 'text-sm' : 'text-xs'} font-semibold text-gray-800 mb-1`}>All Clear</p>
                <p className={`${!isDesktop ? 'text-xs' : 'text-[10px]'} text-gray-500`}>No active advisories</p>
            </div>
          ) : (
              <div className={!isDesktop ? 'space-y-3' : 'space-y-1.5'}>
                {advisories.slice(0, isDesktop ? 5 : 10).map((advisory) => (
                <div
                  key={advisory.id}
                    className={`${!isDesktop ? 'p-3 rounded-xl' : 'p-2 rounded-lg'} border transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-md ${advisory.color} ${advisory.isRealtime ? 'ring-2 ring-blue-400/50' : ''}`}
                >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 ${!isDesktop ? 'w-10 h-10' : 'w-8 h-8'} rounded-xl bg-white/80 flex items-center justify-center text-xl shadow-sm`}>
                        {advisory.icon}
                      </div>
                    <div className="flex-1 min-w-0">
                        <p className={`${!isDesktop ? 'text-base' : 'text-sm'} font-bold text-gray-900 leading-snug mb-2`}>
                        {advisory.message}
                      </p>
                        <div className={`flex flex-wrap items-center gap-2 ${!isDesktop ? 'text-xs' : 'text-[10px]'} text-gray-600`}>
                          {advisory.location && advisory.location !== locationName && (
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                              <MapPin className={`${!isDesktop ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} />
                          <span className="truncate font-medium">{advisory.location}</span>
                        </span>
                          )}
                          <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                            <Clock className={`${!isDesktop ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} />
                          <span className="font-medium">{formatTimestamp(advisory.timestamp)}</span>
                        </span>
                          {advisory.isRealtime && (
                            <span className={`${!isDesktop ? 'px-2 py-1 text-xs' : 'px-1 py-0.5 text-[9px]'} bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-bold shadow-sm flex items-center gap-1`}>
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                              LIVE
                            </span>
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              ))}
                {advisories.length > (isDesktop ? 5 : 10) && (
                  <div className={!isDesktop ? 'text-center py-3' : 'text-center py-1'}>
                    <p className={`${!isDesktop ? 'text-sm' : 'text-xs'} text-gray-500 font-medium bg-gray-50 px-4 py-2 rounded-full inline-block`}>
                      +{advisories.length - (isDesktop ? 5 : 10)} more advisories
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
        )}
        </div>

        {/* Collapsed View Summary - Show preview of first advisory on mobile */}
        {!isExpanded && (
          <div 
            className={`flex-shrink-0 ${!isDesktop ? 'px-4 pb-3' : 'px-3 pb-2'} drag-handle`}
            data-drag-handle
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* On mobile, show first advisory preview when collapsed */}
            {!isDesktop && advisories.length > 0 && (
              <div 
                className="mb-2 cursor-pointer"
                onClick={toggleExpand}
              >
                <div className={`p-2.5 rounded-xl border transition-all duration-300 active:scale-[0.98] shadow-sm ${advisories[0].color} ${advisories[0].isRealtime ? 'ring-1 ring-blue-400/50' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{advisories[0].icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                        {advisories[0].message}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-1">
                        {advisories[0].isRealtime && (
                          <span className="px-1.5 py-0.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full font-bold shadow-sm flex items-center gap-1">
                            <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                            LIVE
                          </span>
                        )}
                        {advisories.length > 1 && (
                          <span className="text-gray-500 font-medium">
                            +{advisories.length - 1} more
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Expand button */}
            <div 
              className="cursor-pointer"
              onClick={toggleExpand}
            >
              {activeAdvisoriesCount > 0 ? (
                <div className={`flex items-center justify-between ${!isDesktop ? 'p-2.5' : 'p-1.5'} bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200/50 hover:from-orange-100 hover:to-red-100 active:scale-[0.98] transition-all shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`${!isDesktop ? 'w-9 h-9' : 'w-8 h-8'} rounded-xl bg-orange-100 flex items-center justify-center`}>
                      <span className={`${!isDesktop ? 'text-lg' : 'text-base'}`}>{hasHighSeverity ? '⚠️' : '🌧️'}</span>
                    </div>
                    <div>
                      <span className={`${!isDesktop ? 'text-xs' : 'text-[10px]'} font-bold text-gray-900`}>
                        {activeAdvisoriesCount} {activeAdvisoriesCount === 1 ? 'alert' : 'alerts'}
                      </span>
                      <p className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600 mt-0.5`}>Tap to expand</p>
                    </div>
                  </div>
                  <ChevronUp className={`${!isDesktop ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-gray-600`} />
                </div>
              ) : currentWeather ? (
                <div className={`flex items-center justify-between ${!isDesktop ? 'p-2.5' : 'p-1.5'} bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50 hover:from-blue-100 hover:to-indigo-100 active:scale-[0.98] transition-all shadow-sm`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`${!isDesktop ? 'w-9 h-9' : 'w-8 h-8'} rounded-xl bg-blue-100 flex items-center justify-center`}>
                      <span className={`${!isDesktop ? 'text-lg' : 'text-base'}`}>{currentWeather.condition.icon}</span>
                    </div>
                    <div>
                      <span className={`${!isDesktop ? 'text-xs' : 'text-[10px]'} font-bold text-gray-900`}>
                        {currentWeather.condition.text}
                      </span>
                      <p className={`${!isDesktop ? 'text-[10px]' : 'text-[9px]'} text-gray-600 mt-0.5`}>Tap to expand</p>
                    </div>
                  </div>
                  <ChevronUp className={`${!isDesktop ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-gray-600`} />
                </div>
              ) : (
                <div className={`flex items-center justify-center ${!isDesktop ? 'p-2.5' : 'p-1.5'}`}>
                  <ChevronUp className={`${!isDesktop ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-gray-400`} />
              </div>
              )}
            </div>
          </div>
        )}

        {/* Expanded View Footer - Modern Design */}
        {isExpanded && (
          <div 
            className={`flex-shrink-0 ${!isDesktop ? 'px-4' : 'px-3'} border-t border-gray-200/50 ${!isDesktop ? 'pt-3 pb-4' : 'pt-1.5 pb-3'}`}
            style={{
              paddingBottom: !isDesktop ? 'calc(1rem + env(safe-area-inset-bottom, 0px))' : '0.75rem'
            }}
          >
            <div className={`flex items-center justify-between ${!isDesktop ? 'text-xs' : 'text-[10px]'} text-gray-600`}>
              <span className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full">
                <Clock className={`${!isDesktop ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} text-gray-500`} />
                <span className="font-medium">Updated {lastUpdate ? formatTimestamp(lastUpdate.toISOString()) : 'Just now'}</span>
              </span>
              <button
                onClick={toggleExpand}
                className={`flex items-center gap-1.5 ${!isDesktop ? 'px-4 py-2' : 'px-2 py-1'} bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-full transition-all active:scale-95 shadow-sm ${!isDesktop ? 'text-xs' : 'text-[10px]'}`}
              >
                <span>Collapse</span>
                <ChevronDown className={`${!isDesktop ? 'w-4 h-4' : 'w-2.5 h-2.5'}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherFloodAdvisory;

