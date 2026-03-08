"""
Vercel serverless function entry point.
This file handles all requests to the Flask application on Vercel.
"""
import sys
import os

# Add the backend directory to the path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

# Change working directory to backend
os.chdir(backend_path)

from app import app

def handler(request):
    """Vercel Python handler function."""
    return app(request.environ, app.start_response)

