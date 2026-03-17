#!/bin/bash
# Ensure we are in the script directory
cd "$(dirname "$0")"

# Check if .venv exists
if [ -d ".venv" ]; then
    echo "Using existing .venv..."
    PYTHON_CMD="./.venv/bin/python3"
else
    echo "Creating .venv..."
    python3 -m venv .venv
    PYTHON_CMD="./.venv/bin/python3"
    $PYTHON_CMD -m pip install -r requirements.txt
    $PYTHON_CMD -m pip install pysocks requests
fi

# Ensure pysocks is installed (double check)
$PYTHON_CMD -c "import socks" 2>/dev/null || $PYTHON_CMD -m pip install pysocks

echo "Starting Extraction (Dual Scanner)..."
$PYTHON_CMD capture_and_vectorize.py
.gitignore
