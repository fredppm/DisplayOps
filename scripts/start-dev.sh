#!/bin/bash

echo "Starting Office TV Management System - Development Mode"
echo

echo "Installing dependencies..."
echo

echo "[1/3] Installing host-agent dependencies..."
cd host-agent
npm install
if [ $? -ne 0 ]; then
    echo "Error installing host-agent dependencies"
    exit 1
fi

echo "[2/3] Installing web-controller dependencies..."
cd ../web-controller
npm install
if [ $? -ne 0 ]; then
    echo "Error installing web-controller dependencies"
    exit 1
fi

echo "[3/3] Starting development servers..."
echo

echo "Starting web controller (NextJS)..."
gnome-terminal --title="Web Controller" -- bash -c "cd ../web-controller && npm run dev; exec bash" &

sleep 3

echo "Starting host agent (Electron)..."
gnome-terminal --title="Host Agent" -- bash -c "cd ../host-agent && npm run dev; exec bash" &

echo
echo "Both services are starting..."
echo "Web Controller: http://localhost:3000"
echo "Host Agent API: http://localhost:8080"
echo
echo "Press Enter to continue..."
read
