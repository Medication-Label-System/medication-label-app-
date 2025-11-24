#!/bin/bash

# Start backend server
cd backend
BACKEND_PORT=3001 node server.js &
BACKEND_PID=$!
cd ..

# Start frontend server
cd frontend
PORT=5000 HOST=0.0.0.0 DANGEROUSLY_DISABLE_HOST_CHECK=true npm start &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
