@echo off
echo Starting Backend...
cd backend
cd fastapi
start cmd /k "uvicorn main:app --reload --host 127.0.0.1 --port 8000"
cd ..
cd ..

echo Starting Frontend...
cd frontend
start cmd /k "npm run dev"
cd ..

echo Opening frontend in browser...
start http://localhost:5173

echo All servers started!
pause
