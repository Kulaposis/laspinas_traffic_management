# Geocoding CORS Fix

## Problem
When clicking "Get Smart Route" in the Traffic Monitoring page, the application was encountering CORS (Cross-Origin Resource Sharing) errors. The browser was blocking requests to external geocoding APIs (OpenStreetMap Nominatim and Photon) because these services don't allow direct cross-origin requests from web applications.

### Error Messages
```
Access to fetch at 'https://nominatim.openstreetmap.org/search?...' from origin 'http://localhost:5173' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solution
Created a **backend proxy** for geocoding requests. Instead of making direct API calls from the frontend to external services, the frontend now sends requests to our backend, which then forwards them to the external geocoding services.

### Changes Made

#### 1. Backend Changes (`backend/app/routers/traffic.py`)
Added two new proxy endpoints:

**Geocoding Search Endpoint:**
```python
@router.get("/geocoding/search")
async def geocoding_search(
    q: str = Query(..., description="Search query"),
    limit: int = Query(5, le=20, description="Maximum number of results")
):
    """Proxy for Nominatim geocoding search to avoid CORS issues."""
```
- **URL**: `GET /api/traffic/geocoding/search`
- **Parameters**: 
  - `q`: Search query (e.g., "SM Southmall")
  - `limit`: Maximum number of results (default: 5, max: 20)
- **Returns**: JSON array of location results

**Reverse Geocoding Endpoint:**
```python
@router.get("/geocoding/reverse")
async def geocoding_reverse(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    """Proxy for Nominatim reverse geocoding to avoid CORS issues."""
```
- **URL**: `GET /api/traffic/geocoding/reverse`
- **Parameters**:
  - `lat`: Latitude coordinate
  - `lon`: Longitude coordinate
- **Returns**: JSON object with location details

#### 2. Frontend Changes (`frontend/src/services/geocodingService.js`)

**Updated API Configuration:**
```javascript
// Before (direct API calls - CORS blocked)
this.apis = {
  nominatim: {
    searchUrl: 'https://nominatim.openstreetmap.org/search',
    reverseUrl: 'https://nominatim.openstreetmap.org/reverse',
    enabled: true
  }
}

// After (using backend proxy)
this.apis = {
  nominatim: {
    searchUrl: '/traffic/geocoding/search',
    reverseUrl: '/traffic/geocoding/reverse',
    enabled: true
  }
}
```

**Updated Search Method:**
```javascript
// Before (using fetch)
const response = await fetch(`${this.apis.nominatim.searchUrl}?${params}`, {
  headers: {
    'User-Agent': 'LasPinasTrafficManagement/1.0'
  }
});

// After (using backend API)
const response = await api.get(this.apis.nominatim.searchUrl, {
  params: {
    q: query,
    limit: limit
  }
});
```

**Updated Reverse Geocoding Method:**
```javascript
// Before (using fetch)
const response = await fetch(`${this.apis.nominatim.reverseUrl}?${params}`, {
  headers: {
    'User-Agent': 'LasPinasTrafficManagement/1.0'
  }
});

// After (using backend API)
const response = await api.get(this.apis.nominatim.reverseUrl, {
  params: {
    lat: lat,
    lon: lng
  }
});
```

## How It Works

### Request Flow
```
Frontend (Browser)
    ↓
    | HTTP Request to Backend Proxy
    ↓
Backend (/api/traffic/geocoding/*)
    ↓
    | HTTP Request with proper headers
    ↓
External API (Nominatim)
    ↓
    | JSON Response
    ↓
Backend
    ↓
    | JSON Response (pass-through)
    ↓
Frontend (Browser)
```

### Benefits
1. **No CORS Issues**: Backend-to-backend requests don't have CORS restrictions
2. **Centralized Control**: All external API calls go through our backend
3. **Better Error Handling**: Backend can handle timeouts and errors gracefully
4. **Security**: API keys and sensitive headers are kept on the backend
5. **Rate Limiting**: Can implement rate limiting at the backend level
6. **Caching**: Backend can cache geocoding results to reduce external API calls

## Features Affected
- **Smart Routing**: Location search when selecting origin/destination
- **Geocoding**: Converting addresses to coordinates
- **Reverse Geocoding**: Converting coordinates to addresses
- **Location Autocomplete**: Search suggestions for Las Piñas locations

## Testing
To test the fix:

1. **Start the Backend**:
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Smart Routing**:
   - Go to Traffic Monitoring page
   - Click "Get Smart Route" button
   - Enter origin and destination locations
   - Search should work without CORS errors
   - Route suggestions should be displayed

## Dependencies
- **Backend**: `httpx==0.25.2` (already installed)
- **Frontend**: `axios` (already installed via api.js)

## Error Handling
The backend proxy includes comprehensive error handling:
- **Timeout Errors**: Returns 504 Gateway Timeout
- **API Errors**: Returns appropriate HTTP status codes
- **Network Errors**: Returns 500 Internal Server Error with details
- **Logging**: All errors are logged for debugging

## Performance Considerations
- **Caching**: Frontend still caches results for 30 minutes
- **Timeouts**: Backend requests timeout after 10 seconds
- **Async/Await**: Uses async operations for non-blocking requests
- **Connection Pooling**: httpx.AsyncClient manages connections efficiently

## Future Improvements
1. Add backend-level caching (Redis/Memcached)
2. Implement rate limiting per user
3. Add fallback geocoding services
4. Track geocoding usage statistics
5. Implement batch geocoding for multiple locations

## Related Files
- `backend/app/routers/traffic.py` - Backend proxy endpoints
- `frontend/src/services/geocodingService.js` - Frontend geocoding service
- `frontend/src/services/smartRoutingService.js` - Uses geocoding for routing
- `frontend/src/components/SmartRouting.jsx` - UI component for smart routing

## Notes
- Photon API is currently disabled in favor of Nominatim via proxy
- Las Piñas local locations are still used as the first search results
- The backend automatically appends "Las Piñas City, Philippines" to searches
- User-Agent header is properly set in backend requests

