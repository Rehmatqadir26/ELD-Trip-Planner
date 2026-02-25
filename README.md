# ELD Trip Planner

A full-stack web application for planning trucking routes with Hours of Service (HOS) compliance. This application helps truck drivers and fleet managers plan compliant routes and automatically generates Electronic Logging Device (ELD) logs.

## 📹 Demo Video

Watch the project walkthrough and demonstration:

**[Loom Video: https://www.loom.com/share/37ad09eb139045ab9d215ce927a05a56](https://www.loom.com/share/37ad09eb139045ab9d215ce927a05a56)**

## 🏗️ Project Architecture

### Overview

The ELD Trip Planner follows a **client-server architecture** with a React frontend and Django REST API backend. The application is stateless and does not require a database, making it lightweight and easy to deploy.

```
┌─────────────────┐         HTTP/REST API         ┌─────────────────┐
│                 │◄─────────────────────────────►│                 │
│  React Frontend  │                                │  Django Backend │
│  (Vite + React)  │                                │  (DRF API)      │
│                 │                                │                 │
│  - Trip Form    │                                │  - Trip Planning│
│  - Route Map    │                                │  - HOS Engine   │
│  - ELD Logs     │                                │  - Route Calc   │
└─────────────────┘                                └─────────────────┘
         │                                                  │
         │                                                  │
         ▼                                                  ▼
┌─────────────────┐                                ┌─────────────────┐
│  Leaflet Maps   │                                │  External APIs  │
│  (OpenStreetMap)│                                │  - OSRM Routing │
│                 │                                │  - Nominatim    │
└─────────────────┘                                └─────────────────┘
```

### Architecture Components

#### Frontend (Client)
- **Framework**: React 18 with Vite
- **Maps**: Leaflet & React-Leaflet for interactive route visualization
- **HTTP Client**: Axios for API communication
- **Build Tool**: Vite for fast development and optimized production builds

#### Backend (Server)
- **Framework**: Django 4.2 with Django REST Framework
- **Architecture**: Stateless API (no database required)
- **CORS**: Configured for cross-origin requests
- **Routing**: OSRM (Open Source Routing Machine) for route calculation
- **Geocoding**: OpenStreetMap Nominatim for location lookup

### Data Flow

1. **User Input**: User enters current location, pickup, and dropoff locations via the React form
2. **Geocoding**: Backend geocodes all locations using Nominatim API
3. **Route Calculation**: Backend calculates optimal routes using OSRM
4. **HOS Compliance Engine**: Backend generates HOS-compliant schedule with required breaks and rest periods
5. **ELD Log Generation**: Backend creates daily ELD log sheets
6. **Visualization**: Frontend displays route on map, shows stops, and renders ELD logs

## 🛠️ Tech Stack

### Frontend
- **React** 18.3.1 - UI framework
- **Vite** 5.3.4 - Build tool and dev server
- **Leaflet** 1.9.4 - Map library
- **React-Leaflet** 4.2.1 - React bindings for Leaflet
- **Axios** 1.7.2 - HTTP client

### Backend
- **Django** 4.2.16 - Web framework
- **Django REST Framework** 3.15.2 - API framework
- **django-cors-headers** 4.4.0 - CORS handling
- **requests** 2.32.3 - HTTP library for external APIs
- **gunicorn** 22.0.0 - WSGI server (production)

### External Services
- **OSRM** - Open Source Routing Machine for route calculation
- **Nominatim** - OpenStreetMap geocoding service

## 📁 Project Structure

```
tracking-system-assessment/
├── client/                      # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── TripForm.jsx     # Trip input form with autocomplete
│   │   │   ├── TripResults.jsx  # Results display component
│   │   │   ├── RouteMap.jsx     # Interactive map visualization
│   │   │   └── ELDLogSheet.jsx   # Daily ELD log display
│   │   ├── App.jsx              # Main application component
│   │   ├── App.css              # Application styles
│   │   └── main.jsx             # Application entry point
│   ├── public/                  # Static assets
│   ├── package.json             # Frontend dependencies
│   └── vite.config.js           # Vite configuration
│
├── server/                      # Django backend
│   ├── config/                  # Django project settings
│   │   ├── settings.py          # Application settings
│   │   ├── urls.py              # Root URL configuration
│   │   ├── wsgi.py              # WSGI configuration
│   │   └── asgi.py              # ASGI configuration
│   ├── trips/                   # Trip planning app
│   │   ├── views.py             # API endpoints
│   │   ├── services.py          # Core business logic (HOS engine)
│   │   └── urls.py              # App URL routes
│   ├── manage.py                # Django management script
│   └── requirements.txt         # Python dependencies
│
└── README.md                    # This file
```

## ✨ Features

### Route Planning
- **Multi-leg Routing**: Plan routes from current location → pickup → dropoff
- **Real-time Route Calculation**: Uses OSRM for accurate driving routes
- **Location Autocomplete**: Smart location search with Nominatim integration
- **Interactive Map**: Visualize route with Leaflet maps

### Hours of Service (HOS) Compliance
The application enforces property-carrying driver HOS rules:
- **11-hour driving limit** after 10 consecutive hours off duty
- **14-hour on-duty window** (runs continuously after coming on duty)
- **30-minute break** required after 8 cumulative hours of driving
- **70-hour/8-day cycle limit** with tracking
- **34-hour restart** option to reset the 70-hour cycle
- **Fuel stops** automatically scheduled every 1,000 miles
- **Pickup/Dropoff time**: 1 hour allocated for each (on-duty not driving)

### ELD Log Generation
- **Daily Log Sheets**: Automatically generated for each day of the trip
- **Status Segments**: Tracks driving, on-duty not driving, sleeper berth, and off-duty time
- **Compliance Tracking**: Ensures all HOS rules are met
- **Visual Display**: Easy-to-read log format

### Stop Management
- **Automatic Stop Scheduling**: Fuel stops, rest breaks, and mandatory rest periods
- **Stop Mapping**: All stops mapped to GPS coordinates along the route
- **Stop Types**: Pickup, dropoff, fuel, rest, break, and restart stops

## 🚀 Setup Instructions

### Prerequisites
- **Node.js** 16+ and npm
- **Python** 3.9+
- **pip** (Python package manager)

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, for custom API URL):
```bash
VITE_API_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run migrations (not required for this stateless app, but Django may require it):
```bash
python manage.py migrate
```

5. Start the development server:
```bash
python manage.py runserver
```

The backend API will be available at `http://localhost:8000`

### Running the Full Application

1. Start the backend server (Terminal 1):
```bash
cd server
source venv/bin/activate
python manage.py runserver
```

2. Start the frontend server (Terminal 2):
```bash
cd client
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## 📡 API Documentation

### Endpoint: `POST /api/trip/plan/`

Plan a trip with HOS compliance.

**Request Body:**
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Indianapolis, IN",
  "dropoff_location": "Nashville, TN",
  "current_cycle_used": 20
}
```

**Response:**
```json
{
  "locations": {
    "current": { "lat": 41.8781, "lon": -87.6298, "name": "Chicago, IL" },
    "pickup": { "lat": 39.7684, "lon": -86.1581, "name": "Indianapolis, IN" },
    "dropoff": { "lat": 36.1627, "lon": -86.7816, "name": "Nashville, TN" }
  },
  "route": {
    "geometry": [[lat, lng], ...],
    "total_distance_miles": 450.5,
    "total_duration_hours": 8.2,
    "legs": [...]
  },
  "stops": [...],
  "schedule": [...],
  "daily_logs": [...]
}
```

## 📋 HOS Rules Implementation

The application implements the following HOS rules for property-carrying drivers:

| Rule | Limit | Implementation |
|------|-------|----------------|
| Driving Limit | 11 hours | After 10 consecutive hours off duty |
| On-Duty Window | 14 hours | Continuous window after coming on duty |
| Break Requirement | 30 minutes | After 8 cumulative hours of driving |
| Cycle Limit | 70 hours | Over 8 consecutive days |
| Restart | 34 hours | Resets the 70-hour cycle |
| Fuel Stop | Every 1,000 miles | 30-minute on-duty not driving |

## 🔧 Configuration

### Environment Variables

**Backend** (optional):
- `DJANGO_SECRET_KEY` - Django secret key (defaults to dev key)
- `DJANGO_DEBUG` - Debug mode (defaults to True)
- `DJANGO_ALLOWED_HOSTS` - Allowed hosts (defaults to *)
- `CORS_ALLOWED_ORIGINS` - CORS origins (defaults to localhost)

**Frontend** (optional):
- `VITE_API_URL` - Backend API URL (defaults to empty string for relative URLs)

## 📦 Production Deployment

### Frontend Build
```bash
cd client
npm run build
```
The production build will be in `client/dist/`

### Backend Deployment
Use gunicorn for production:
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

## 🤝 Contributing

This is an assessment project. For questions or issues, please refer to the repository.

## 📄 License

This project is created for assessment purposes.

---

**Built with ❤️ for trucking compliance and route planning**
