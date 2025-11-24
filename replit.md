# Medication Label System

## Overview
A comprehensive medication label printing system with a React frontend and Express/SQLite backend. The system allows healthcare professionals to search for patients, select medications, and print medication labels with instructions in multiple languages (including Arabic).

## Project Structure
```
medication-label-system/
├── frontend/               # React application (TypeScript)
│   ├── src/
│   │   ├── App.js         # Main application component
│   │   ├── App.css        # Application styles
│   │   └── assets/        # Images and static assets
│   ├── public/            # Public assets
│   └── package.json       # Frontend dependencies
├── backend/               # Express API server
│   ├── server.js          # API server and routes
│   ├── medications.db     # SQLite database
│   └── package.json       # Backend dependencies
├── start-dev.sh           # Development startup script
└── package.json           # Root package for development
```

## Technology Stack
- **Frontend**: React 19, TypeScript, Axios
- **Backend**: Node.js, Express, SQLite3
- **Development**: React Scripts, Concurrently

## Development Setup

### Environment Configuration
The project uses environment-specific configurations:

#### Development Mode
- Frontend runs on port **5000** (accessible via webview)
- Backend runs on port **3001** (internal)
- Frontend proxies API requests to backend via `proxy` in package.json

#### Production Mode
- Single server on port **5000**
- Backend serves the built React app
- All routes handled by the Express server

### Running Locally
The workflow automatically starts both servers:
```bash
./start-dev.sh
```

This script:
1. Starts the backend server on port 3001
2. Starts the frontend dev server on port 5000
3. Both servers run concurrently

### Database
The SQLite database (`backend/medications.db`) contains:
- **tblDrugs**: Medication master data
- **tblUsageInstructions**: Medication instructions
- **tblUsers**: User authentication
- **patients_correct**: Patient records
- **tblPrintQueue**: Print basket
- **tblPrintedLabelsAudit**: Audit trail

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Medications
- `GET /api/medications` - Get all medications
- `GET /api/patients/search?patientId={id}&year={year}` - Search patient

### Basket Management
- `GET /api/basket` - Get basket items
- `POST /api/basket/add` - Add medication to basket
- `DELETE /api/basket/:id` - Remove item from basket
- `DELETE /api/basket` - Clear basket

### Audit
- `POST /api/audit` - Log printed labels

## Key Features
1. **User Authentication**: Secure login system
2. **Patient Search**: Search by Patient ID and Year
3. **Medication Selection**: Browse and search medications
4. **Print Queue**: Basket system for multiple medications
5. **Label Generation**: Custom label printing with expiry dates
6. **Audit Trail**: Local and backend audit logging
7. **Multi-language Support**: Arabic medication names and instructions

## Deployment
The project is configured for Replit deployment:
- Build command: `cd frontend && npm install && npm run build`
- Run command: `cd backend && NODE_ENV=production PORT=5000 node server.js`
- Deployment type: VM (maintains server state)

**Important**: The `NODE_ENV=production` environment variable must be set for deployment to:
- Enable static React build serving
- Activate the catch-all route for React Router
- Serve the application from a single port (5000)

## Recent Changes (2025-11-11)
- Configured for Replit environment with single-port architecture
- Set up development workflow with concurrent frontend/backend servers
- Fixed port configuration: Frontend (5000), Backend (3001)
- Added proxy configuration for API requests
- Configured deployment to serve React build from Express
- **Updated CORS to restrict access to Replit domains (*.replit.dev, *.repl.co) and localhost**
- **Fixed PORT priority to use process.env.PORT for deployment**
- Created unified startup script for development
- Configured NODE_ENV=production in deployment run command

## Architecture Decisions
- **Single Port for Production**: Backend serves static React build on port 5000
- **Dual Server Development**: Separate dev servers with proxy for hot reload
- **CORS Configuration**: Restricted to Replit domains (*.replit.dev, *.repl.co) and localhost for security
- **Database Path**: Absolute path resolution for cross-environment compatibility
- **PORT Priority**: process.env.PORT takes precedence to align with Replit's ingress routing

## Security
- CORS policy limits origins to:
  - localhost:3000, localhost:5000 (development)
  - *.replit.dev, *.repl.co (Replit domains)
  - Origin-less requests (mobile apps, direct API access)
- User authentication with password validation
- Audit trail for all printed labels
