#!/bin/bash
# ============================================================
# GITPUSH — Local run script
# Usage: bash run.sh
# ============================================================

set -e

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.10+ first."
  exit 1
fi

# Create .env if missing
if [ ! -f .env ]; then
  echo "No .env found — copying from .env.example"
  cp .env.example .env
  echo ""
  echo "  ⚠  Open .env and set your GITHUB_TOKEN before continuing."
  echo "     Then run: bash run.sh"
  echo ""
  exit 0
fi

# Create venv if missing
if [ ! -d venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Run
echo ""
echo "  ✓ GITPUSH starting at http://localhost:5000"
echo "  ✓ Press Ctrl+C to stop"
echo ""
python app.py
