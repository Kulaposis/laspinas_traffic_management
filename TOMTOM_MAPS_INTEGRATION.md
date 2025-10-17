# TomTom Maps Integration Guide

## Overview

This guide explains how to integrate TomTom Maps into your traffic monitoring system while managing usage limits effectively. The integration provides high-quality map tiles, geocoding, and routing services with intelligent fallback to free alternatives.

## ✅ Features Implemented

### 🗺️ Dynamic Map Tiles
- **TomTom Map Styles**: Main, Night, and Satellite views
- **Automatic Fallback**: Falls back to OpenStreetMap when limits are reached
- **Usage Tracking**: Real-time monitoring of API usage
- **Style Switcher**: Easy switching between map providers and styles

### 🔍 Enhanced Geocoding
- **TomTom Geocoding**: High-quality address search and reverse geocoding
- **Intelligent Fallback**: Uses OpenStreetMap Nominatim when TomTom is unavailable
- **Caching**: 30-minute cache to reduce API calls
- **Debounced Search**: Optimized for autocomplete functionality

### 🚦 Traffic Data Integration
- **TomTom Traffic Flow**: Real-time traffic speed and congestion data
- **Backend Integration**: Uses your existing traffic monitoring system as fallback
- **Caching**: 1-minute cache for traffic data to balance freshness and efficiency

### 🛣️ Routing Services
- **TomTom Routing**: High-quality route calculation with traffic awareness
- **OSRM Fallback**: Uses free OSRM service when TomTom is unavailable
- **Route Optimization**: Multiple route options with traffic considerations

## 🚀 Quick Start

### 1. Get TomTom API Key

1. Visit [TomTom Developer Portal](https://developer.tomtom.com/)
2. Sign up for a free account
3. Create a new project
4. Copy your API key

### 2. Configure Environment Variables

Create a `.env` file in your frontend directory:

```env
# TomTom Maps API Configuration
VITE_TOMTOM_API_KEY=your_tomtom_api_key_here
VITE_TOMTOM_DAILY_LIMIT=2500
VITE_TOMTOM_ENABLED=true
```

### 3. Usage Limits Management

The system automatically manages TomTom API usage limits:

- **Free Tier**: 2,500 requests per day
- **Automatic Tracking**: Monitors daily usage
- **Smart Fallback**: Switches to free alternatives when limits are reached
- **Usage Display**: Shows current usage in the map style switcher

## 📊 Usage Statistics

The system tracks and displays:

- **Daily Requests**: Current usage vs. daily limit
- **Usage Percentage**: Visual progress bar
- **Remaining Requests**: How many requests are left today
- **Provider Status**: Whether TomTom is available or using fallback

## 🎛️ Map Style Switcher

The map style switcher provides:

### TomTom Styles
- **Main**: Standard TomTom map style with clear road information
- **Night**: Dark theme optimized for night viewing
- **Satellite**: High-resolution satellite imagery

### Fallback Options
- **OpenStreetMap**: Always available free alternative
- **Automatic Switching**: Seamlessly falls back when limits are reached

## 🔧 Configuration Options

### TomTom Service Configuration

```javascript
// frontend/src/config/tomtom.js
export const tomtomConfig = {
  apiKey: 'your_api_key',
  dailyLimit: 2500,
  enabled: true,
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  trafficCacheTimeout: 60 * 1000, // 1 minute
  fallbackToOSM: true,
  fallbackToBackend: true
};
```

### Usage Limit Management

```javascript
// Check if TomTom is available
if (tomtomService.canMakeRequest()) {
  // Use TomTom API
  const result = await tomtomService.geocode(query);
} else {
  // Use fallback
  const result = await fallbackGeocode(query);
}
```

## 📈 Performance Optimization

### Caching Strategy
- **Geocoding**: 30-minute cache for address searches
- **Traffic Data**: 1-minute cache for real-time data
- **Map Tiles**: Browser-level caching
- **Usage Stats**: Daily reset with localStorage persistence

### Request Optimization
- **Debounced Search**: 300ms delay for autocomplete
- **Batch Requests**: Combine multiple operations when possible
- **Error Handling**: Graceful fallback on API failures
- **Retry Logic**: Automatic retry with exponential backoff

## 🛡️ Error Handling & Fallbacks

### Automatic Fallbacks
1. **TomTom API Unavailable** → OpenStreetMap Nominatim
2. **Rate Limit Reached** → Cached results or OSM
3. **Network Error** → Local cache or backend service
4. **Invalid API Key** → Disable TomTom, use OSM only

### Error Recovery
- **Automatic Retry**: Failed requests are retried with backoff
- **Graceful Degradation**: System continues working with reduced features
- **User Notification**: Clear indication when using fallback services

## 💡 Best Practices

### Usage Optimization
1. **Enable Caching**: Always use cached results when available
2. **Batch Operations**: Combine multiple geocoding requests
3. **Debounce Search**: Avoid excessive API calls during typing
4. **Monitor Usage**: Check usage stats regularly

### Development Tips
1. **Test Fallbacks**: Ensure system works without TomTom
2. **Monitor Logs**: Watch for API errors and fallback usage
3. **Cache Management**: Clear cache when testing new features
4. **Usage Alerts**: Set up monitoring for approaching limits

## 🔍 Troubleshooting

### Common Issues

#### TomTom Tiles Not Loading
```javascript
// Check API key
console.log('TomTom API Key:', tomtomService.apiKey);

// Check usage limits
console.log('Usage Stats:', tomtomService.getUsageStats());

// Check network connectivity
fetch('https://api.tomtom.com/map/1/tile/main/10/512/512.png?key=YOUR_KEY')
  .then(response => console.log('TomTom API accessible:', response.ok));
```

#### Fallback Not Working
```javascript
// Test OpenStreetMap fallback
fetch('https://nominatim.openstreetmap.org/search?q=Manila&format=json&limit=1')
  .then(response => console.log('OSM fallback working:', response.ok));
```

#### Usage Limit Issues
```javascript
// Reset usage counter (for testing)
tomtomService.resetUsage();

// Check current usage
const stats = tomtomService.getUsageStats();
console.log(`Usage: ${stats.requests}/${stats.dailyLimit} (${stats.usagePercentage.toFixed(1)}%)`);
```

## 📚 API Reference

### TomTom Service Methods

```javascript
// Geocoding
const results = await tomtomService.geocode('Manila, Philippines');

// Reverse Geocoding
const address = await tomtomService.reverseGeocode(14.5995, 120.9842);

// Traffic Flow
const traffic = await tomtomService.getTrafficFlow(14.5995, 120.9842);

// Route Calculation
const route = await tomtomService.calculateRoute(
  { lat: 14.5995, lng: 120.9842 },
  { lat: 14.6042, lng: 120.9822 }
);

// Usage Statistics
const stats = tomtomService.getUsageStats();
```

### Enhanced Geocoding Service

```javascript
// Search with fallback
const results = await enhancedGeocodingService.searchLocations('Las Piñas');

// Debounced search for autocomplete
const suggestions = await enhancedGeocodingService.getSuggestions('Alabang');

// Reverse geocoding with fallback
const address = await enhancedGeocodingService.reverseGeocode(14.4504, 121.0170);
```

## 🎯 Integration Examples

### Basic Map Integration

```jsx
import TomTomTileLayer from '../components/TomTomTileLayer';
import MapStyleSwitcher from '../components/MapStyleSwitcher';

function MyMap() {
  const [mapStyle, setMapStyle] = useState('main');
  const [useTomTom, setUseTomTom] = useState(true);

  return (
    <MapContainer center={[14.4504, 121.0170]} zoom={13}>
      {useTomTom ? (
        <TomTomTileLayer
          style={mapStyle}
          onError={() => setUseTomTom(false)}
        />
      ) : (
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      )}
      
      <MapStyleSwitcher
        onStyleChange={(style) => {
          setMapStyle(style.id);
          setUseTomTom(style.provider === 'TomTom');
        }}
        currentStyle={mapStyle}
      />
    </MapContainer>
  );
}
```

### Geocoding Integration

```jsx
import enhancedGeocodingService from '../services/enhancedGeocodingService';

function LocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async (searchQuery) => {
    const searchResults = await enhancedGeocodingService.searchLocations(searchQuery);
    setResults(searchResults);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyUp={(e) => handleSearch(e.target.value)}
        placeholder="Search for a location..."
      />
      <ul>
        {results.map(result => (
          <li key={result.id}>
            {result.name} ({result.provider})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 🚀 Advanced Features

### Custom Map Styles
You can extend the system with additional TomTom map styles:

```javascript
// Add to tomtomConfig.mapStyles
custom: {
  name: 'Custom Style',
  description: 'Your custom map style',
  preview: '🎨'
}
```

### Usage Analytics
Track detailed usage patterns:

```javascript
// Get detailed usage stats
const analytics = {
  dailyUsage: tomtomService.getUsageStats(),
  cacheStats: enhancedGeocodingService.getCacheStats(),
  fallbackUsage: getFallbackUsageStats()
};
```

### Performance Monitoring
Monitor API performance and optimize usage:

```javascript
// Track response times
const startTime = Date.now();
const result = await tomtomService.geocode(query);
const responseTime = Date.now() - startTime;

console.log(`Geocoding took ${responseTime}ms`);
```

## 📞 Support

For issues with TomTom integration:

1. **Check API Key**: Ensure your TomTom API key is valid
2. **Monitor Usage**: Check if you've reached daily limits
3. **Test Fallbacks**: Verify OpenStreetMap fallback is working
4. **Review Logs**: Check browser console for error messages

## 🔄 Updates & Maintenance

### Regular Maintenance
- **Clear Cache**: Periodically clear cached data
- **Update API Key**: Renew API keys before expiration
- **Monitor Usage**: Track daily usage patterns
- **Test Fallbacks**: Ensure fallback services are working

### Future Enhancements
- **Additional Map Styles**: More TomTom map variants
- **Advanced Routing**: Turn-by-turn navigation
- **Real-time Updates**: WebSocket integration for live data
- **Offline Support**: Cached map tiles for offline use

---

**Note**: This integration is designed to work seamlessly with your existing traffic monitoring system. TomTom provides enhanced map quality and features, while the fallback system ensures your application remains functional even when API limits are reached.
