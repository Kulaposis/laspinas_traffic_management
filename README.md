# Traffic Management System

A comprehensive traffic management web application built with React.js, FastAPI, and MySQL. This system enables citizens to report traffic incidents, allows LGU staff to manage reports, and provides traffic enforcers with tools to issue violations.

## Features

### 🚦 Core Functionality
- **Traffic Reports**: Citizens can submit traffic incident reports with location and images
- **Real-time Map**: Interactive map showing traffic reports and pedestrian footprints
- **Violation Management**: Traffic enforcers can issue and manage traffic violations
- **User Roles**: Support for Citizens, LGU Staff, Traffic Enforcers, and Admins
- **Real-time Notifications**: WebSocket-based live updates and alerts

### 🗄️ Database Schema
- **Users**: Multi-role user management with JWT authentication
- **Reports**: Traffic incident reports with geolocation
- **Violations**: Traffic violation records with fine tracking
- **Schools**: School information and dismissal schedules
- **Footprints**: Pedestrian crowd level monitoring
- **Parking**: Parking space availability tracking
- **Notifications**: Real-time alert system

### 🎨 Frontend (React.js + TailwindCSS)
- Responsive design with modern UI components
- Interactive Leaflet.js maps for geospatial data
- Real-time WebSocket connections
- Role-based access control
- Mobile-friendly interface

### ⚙️ Backend (FastAPI + SQLAlchemy)
- RESTful API with automatic documentation
- JWT-based authentication and authorization
- WebSocket support for real-time features
- Database migrations with Alembic
- Comprehensive error handling

## Tech Stack

- **Frontend**: React.js 18, TailwindCSS, Leaflet.js, Axios, Lucide Icons
- **Backend**: Python FastAPI, SQLAlchemy, JWT, WebSockets, Alembic
- **Database**: MySQL 8.0
- **Deployment**: Docker, Nginx, Docker Compose

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd thesis_traffic_management
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## Manual Setup

### Prerequisites
- Node.js 18+
- Python 3.11+
- MySQL 8.0+

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Run database migrations**
   ```bash
   alembic upgrade head
   ```

6. **Start the backend server**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   # Create .env file
   echo "REACT_APP_API_URL=http://localhost:8000" > .env
   echo "REACT_APP_WS_URL=ws://localhost:8000" >> .env
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:8000

## Demo Accounts

| Role | Username | Password | Description |
|------|----------|----------|-------------|
| Admin | `admin` | `password123` | Full system access |
| LGU Staff | `staff` | `password123` | Report management |
| Traffic Enforcer | `enforcer` | `password123` | Issue violations |
| Citizen | `citizen` | `password123` | Submit reports |

## API Documentation

Once the backend is running, visit http://localhost:8000/docs for interactive API documentation powered by FastAPI's automatic OpenAPI generation.

### Key Endpoints

- **Authentication**: `/auth/login`, `/auth/register`
- **Reports**: `/reports/` (CRUD operations)
- **Violations**: `/violations/` (CRUD operations)
- **Users**: `/users/` (User management)
- **Notifications**: `/notifications/` (Real-time alerts)
- **WebSocket**: `/ws/{user_id}` (Real-time connections)

## Database Schema

### Users Table
- Multi-role support (citizen, lgu_staff, traffic_enforcer, admin)
- JWT-based authentication
- Profile management

### Reports Table
- Geolocation data (latitude, longitude)
- Status tracking (pending, in_progress, resolved, closed)
- Type categorization (accident, traffic_jam, flooding, etc.)
- Image attachment support

### Violations Table
- Unique violation numbers
- Fine amount tracking
- Payment status monitoring
- Driver and vehicle information

## Real-time Features

The application uses WebSockets for:
- Live notification updates
- Real-time report status changes
- Traffic alerts and announcements
- Location-based updates

## Deployment

### Production with Docker

1. **Update environment variables**
   ```bash
   # Update docker-compose.yml with production values
   # Set secure database passwords
   # Configure SSL certificates
   ```

2. **Deploy with production profile**
   ```bash
   docker-compose --profile production up -d
   ```

3. **Set up SSL (recommended)**
   ```bash
   # Place SSL certificates in ./ssl/ directory
   # Update nginx.prod.conf with your domain
   ```

### Cloud Deployment Options

- **AWS**: Use ECS with RDS for MySQL and CloudFront for CDN
- **GCP**: Deploy on Cloud Run with Cloud SQL
- **Azure**: Use Container Instances with Azure Database for MySQL
- **DigitalOcean**: App Platform with Managed Database

## Development

### Adding New Features

1. **Backend**: Create new models, schemas, services, and routers
2. **Frontend**: Add new pages, components, and services
3. **Database**: Create Alembic migrations for schema changes

### Code Structure

```
backend/
├── app/
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas
│   ├── routers/         # API endpoints
│   ├── services/        # Business logic
│   ├── auth.py          # Authentication
│   └── main.py          # FastAPI application
├── alembic/             # Database migrations
└── requirements.txt

frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Application pages
│   ├── services/        # API services
│   ├── context/         # React context
│   └── styles/          # TailwindCSS styles
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the API documentation at `/docs`

---

Built with ❤️ for better traffic management
users 
🟢 Citizen User
Username: testuser
Password: testpass123
Email: test@example.com
Role: citizen
ID: 1
🔴 Admin User
Username: admin
Password: admin123
Email: admin@example.com
Role: admin
ID: 2
🔵 LGU Staff
Username: lgustaff
Password: staff123
Email: staff@example.com
Role: lgu_staff
ID: 3
🟡 Traffic Enforcer
Username: enforcer
Password: enforcer123
Email: enforcer@example.com
Role: traffic_enforcer
ID: 4