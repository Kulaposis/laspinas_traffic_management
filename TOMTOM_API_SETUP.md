# TomTom API Setup Guide

This guide explains how to set up the TomTom Maps API for enhanced search functionality in the Traffic Management System.

## 🚀 Quick Setup

### 1. Get Your TomTom API Key

1. **Sign up/Login** at [TomTom Developer Portal](https://developer.tomtom.com/)
2. **Create a new application** or use an existing one
3. **Copy your API key** from the dashboard

### 2. Configure Environment Variables

Create a `.env` file in the `frontend` directory with your TomTom API key:

```env
# TomTom Maps API Configuration
# Get your API key from: https://developer.tomtom.com/
VITE_TOMTOM_API_KEY=your_actual_tomtom_api_key_here
VITE_TOMTOM_DAILY_LIMIT=2500
VITE_TOMTOM_ENABLED=true
```

### 3. Restart Development Server

After adding the API key, restart your development server:

```bash
cd frontend
npm run dev
```

## 🔧 TomTom API Features

When properly configured, the search functionality will use:

- ✅ **TomTom Geocoding API** for accurate place search
- ✅ **TomTom Routing API** for route calculation
- ✅ **TomTom Traffic API** for real-time traffic data
- ✅ **Automatic fallback** to OpenStreetMap if TomTom is unavailable

## 🛠️ Troubleshooting

### Check API Status

Open browser console and look for these messages:

```
TomTom Service initialized: { apiKey: 'Set (length: 32)', enabled: true, baseUrl: 'https://api.tomtom.com' }
Enhanced Geocoding Service - Using TomTom API
```

### If TomTom API is not working:

1. **Check API Key**: Ensure your API key is valid and has quota remaining
2. **Check Console**: Look for error messages about API limits or invalid keys
3. **Fallback Mode**: The app will automatically use OpenStreetMap as fallback

### API Limits (Free Tier)

- **2,500 requests/day** for geocoding and routing
- **Rate limiting**: 2-3 hour intervals between requests
- **Automatic fallback** when limits are reached

## 📊 Search Provider Indicator

The search results now show which API is being used:

- 🔵 **TomTom** (blue) - Premium geocoding service
- 🟢 **OpenStreetMap** (green) - Free fallback service

## 🎯 Benefits of TomTom API

- **More accurate results** for Philippine locations
- **Better address formatting** and standardization
- **Real-time traffic data** integration
- **Advanced routing options** with traffic optimization

## 💡 Tips

1. **Test with common locations** like "SM Mall", "Ayala Avenue", "Makati City"
2. **Monitor API usage** in browser console
3. **Configure production keys** when deploying

## 🔗 Resources

- [TomTom Developer Portal](https://developer.tomtom.com/)
- [TomTom API Documentation](https://developer.tomtom.com/documentation)
- [Pricing Information](https://developer.tomtom.com/pricing)
