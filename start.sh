#!/bin/bash

echo "Starting Backend..."
gnome-terminal -- bash -c "cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000; exec bash"

echo "Starting Frontend..."
gnome-terminal -- bash -c "cd frontend && npm run dev; exec bash"

# Open frontend in default browser
xdg-open http://localhost:5173

echo "All servers started!"

