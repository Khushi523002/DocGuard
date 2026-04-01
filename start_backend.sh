#!/bin/bash
echo "Starting DocGuard Backend..."
cd backend
python -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt -q
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
