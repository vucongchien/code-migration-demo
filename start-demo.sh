#!/bin/bash

echo "==============================================="
echo "  Demo Code Migration - 5 May Setup"
echo "==============================================="
echo ""

# Start Coordinator
echo "[May 1] Khoi dong Coordinator Server..."
npm run coordinator &
sleep 3

# Start Worker A
echo "[May 2] Khoi dong Worker A..."
WORKER_ID=worker-a WORKER_NAME="Worker A" npx tsx server/worker.ts &
sleep 2

# Start Worker B
echo "[May 3] Khoi dong Worker B..."
WORKER_ID=worker-b WORKER_NAME="Worker B" npx tsx server/worker.ts &
sleep 2

# Start Dashboard
echo "[May 5] Khoi dong Dashboard Monitor..."
npm run dev &

echo ""
echo "==============================================="
echo "  Tat ca services da khoi dong!"
echo "  Dashboard: http://localhost:3000"
echo "  Coordinator: http://localhost:3001"
echo "==============================================="
echo ""
echo "Press Ctrl+C to stop all services"
wait
