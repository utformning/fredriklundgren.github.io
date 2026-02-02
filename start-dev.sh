#!/bin/bash
# Development server starter for Linux/Mac
# Automatically installs dependencies and starts live reload server

echo "========================================"
echo "  Discgolf Dev Server - Live Reload"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3 first"
    exit 1
fi

# Install/upgrade dependencies
echo "Installing dependencies..."
python3 -m pip install --upgrade pip > /dev/null 2>&1
python3 -m pip install -r requirements-dev.txt

echo ""
echo "Starting development server..."
echo ""

# Start the dev server
python3 dev-server.py
