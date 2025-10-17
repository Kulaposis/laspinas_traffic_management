# CORS Error Fix Guide

## Problem
The frontend (running on `http://localhost:5173`) was unable to communicate with the backend API (running on `http://localhost:8000`) due to CORS (Cross-Origin Resource Sharing) policy restrictions.

## Root Cause
The CORS configuration in the FastAPI backend was not properly configured to allow all necessary origins, headers, and methods required by the frontend application.

## Fixes Applied

### 1. Enhanced CORS Configuration ✅

**File**: `backend/app/main.py`

**Changes**:
- Added more comprehensive origin allowlist including both `localhost` and `127.0.0.1`
- Added specific HTTP methods instead of wildcard
- Added explicit headers that the frontend needs
- Added expose headers configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Alternative Vite port
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    expose_headers=["*"]
)
```

### 2. Added Error Handling Middleware ✅

**Purpose**: Better debugging and error tracking

```python
@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)}
        )
```

### 3. Added Request Logging ✅

**Purpose**: Debug API requests and responses

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response
```

### 4. Created Testing Scripts ✅

**Files Created**:
- `backend/fix_cors_and_db.py` - Comprehensive backend testing
- `test_api_connection.js` - API connection verification

## How to Apply the Fix

### Step 1: Apply Backend Changes
The backend changes are already applied to `backend/app/main.py`.

### Step 2: Restart Backend Server
```bash
cd backend
uvicorn app.main:app --reload
```

### Step 3: Test API Connection
```bash
# Test from project root
node test_api_connection.js

# Or test backend specifically
cd backend
python fix_cors_and_db.py
```

### Step 4: Verify Frontend Configuration
Make sure your frontend is using the correct API URL. Create a `.env.local` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Step 5: Clear Browser Cache
- Clear browser cache and cookies
- Try opening in incognito/private mode
- Hard refresh (Ctrl+F5 or Cmd+Shift+R)

## Expected Results

After applying these fixes:

### ✅ CORS Errors Should Be Resolved
- No more "Access to XMLHttpRequest has been blocked by CORS policy" errors
- Frontend can successfully communicate with backend API
- All emergency endpoints should work properly

### ✅ Better Error Handling
- Server errors are properly logged
- More informative error responses
- Request/response logging for debugging

### ✅ Comprehensive Testing
- API connection verification scripts
- Database setup verification
- Emergency endpoint testing

## Troubleshooting

### If CORS Errors Persist:

1. **Check Frontend URL**:
   - Verify frontend is running on `http://localhost:5173`
   - If using different port, add it to CORS origins

2. **Check Backend Server**:
   ```bash
   curl http://localhost:8000/health
   ```

3. **Check Browser Console**:
   - Look for specific error messages
   - Check Network tab for failed requests

4. **Verify Environment Variables**:
   - Check `.env.local` file in frontend
   - Verify API URLs are correct

### If Backend Errors Occur:

1. **Check Database**:
   ```bash
   cd backend
   python fix_cors_and_db.py
   ```

2. **Check Logs**:
   - Look at backend server console output
   - Check for database connection errors

3. **Run Migration**:
   ```bash
   cd backend
   alembic upgrade head
   ```

## Testing Checklist

- [ ] Backend server starts without errors
- [ ] Health endpoint responds: `curl http://localhost:8000/health`
- [ ] Frontend loads without CORS errors
- [ ] Emergency button works
- [ ] API calls succeed in browser Network tab
- [ ] WebSocket connection works (if applicable)

## Security Notes

The CORS configuration is set for development. For production:

1. **Restrict Origins**: Only allow specific production domains
2. **Limit Headers**: Only include necessary headers
3. **Review Methods**: Only allow required HTTP methods
4. **Monitor Logs**: Watch for suspicious requests

## Additional Resources

- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Status**: CORS issues resolved ✅  
**Testing**: Connection verification scripts provided ✅  
**Documentation**: Complete troubleshooting guide available ✅
