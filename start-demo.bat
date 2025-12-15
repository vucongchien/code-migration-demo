@echo off
echo ===============================================
echo   Demo Code Migration - 5 May Setup
echo ===============================================
echo.

echo [May 1] Khoi dong Coordinator Server...
start "Coordinator" cmd /k "npm run coordinator"
timeout /t 3 >nul

echo [May 2] Khoi dong Worker A...
start "Worker A" cmd /k "set WORKER_ID=worker-a&& set WORKER_NAME=Worker A&& npx tsx server/worker.ts"
timeout /t 2 >nul

echo [May 3] Khoi dong Worker B...
start "Worker B" cmd /k "set WORKER_ID=worker-b&& set WORKER_NAME=Worker B&& npx tsx server/worker.ts"
timeout /t 2 >nul

echo [May 5] Khoi dong Dashboard Monitor...
start "Dashboard" cmd /k "npm run dev"

echo.
echo ===============================================
echo   Tat ca services da khoi dong!
echo   Dashboard: http://localhost:3000
echo   Coordinator: http://localhost:3001
echo ===============================================
echo.
pause
