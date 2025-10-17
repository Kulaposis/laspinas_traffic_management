# Google Street View Integration

## How to enable street view images

The no parking zone popups now support street view images! Here's how to set it up:

### Option 1: Use Default (No API Key Required)
- The system works out of the box with interactive buttons
- Users can click to open Google Maps and Street View
- Shows coordinates and interactive buttons

### Option 2: Enable Street View Images (Requires Google API Key)

1. **Get a Google Maps API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable "Street View Static API"
   - Create credentials (API Key)
   - Copy the API key

2. **Add the API Key to your environment:**
   Create a `.env` file in the `frontend` directory:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. **Restart the development server:**
   ```bash
   npm run dev
   ```

### Features
- ✅ Street view images when API key is available
- ✅ Interactive fallback when no API key
- ✅ Direct links to Google Maps and Street View
- ✅ Coordinate display
- ✅ Error handling and graceful degradation

### Free Usage
- Google provides $200 credit monthly
- Street View Static API: $7 per 1,000 requests
- Should be sufficient for development and moderate usage
