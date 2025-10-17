# Environment Setup

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory with the following variables:

```bash
# API Configuration
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000

# Application Configuration
VITE_APP_NAME="Traffic Management System"
VITE_APP_VERSION="1.0.0"

# Development
VITE_ENABLE_DEBUG=false
```

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
# Database Configuration
DATABASE_URL=mysql+pymysql://traffic_user:traffic_password@localhost:3306/traffic_management

# JWT Configuration
SECRET_KEY=your-super-secret-jwt-key-here-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Configuration
ENVIRONMENT=development

# External API Keys (if needed)
WEATHER_API_KEY=your_weather_api_key_here
MAP_API_KEY=your_map_api_key_here
SMS_API_KEY=your_sms_api_key_here
```

## Note

- **Frontend**: Uses `import.meta.env.VITE_*` for Vite environment variables
- **Backend**: Uses `os.getenv()` for Python environment variables
- Never commit `.env` files to version control
- Use `.env.example` files to document required variables
