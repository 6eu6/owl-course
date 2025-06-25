import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

from app import app

# Load routes with error protection
try:
    import routes
    print("✅ Routes loaded successfully")
except ImportError as e:
    print(f"❌ Routes loading failed: {e}")
    sys.exit(1)

# Load scheduler with error protection (optional service)
try:
    import scheduler_service
    scheduler_service.start_service()
    print("✅ Scheduler service started")
except Exception as e:
    print(f"⚠️ Scheduler service failed to start: {e}")
    print("   Application will continue without scheduler")

# Add health check endpoint
@app.route('/health')
def health_check():
    """Health check endpoint for Render.com"""
    try:
        from datetime import datetime
        return {
            'status': 'healthy', 
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        }
    except Exception as e:
        return {'status': 'unhealthy', 'error': str(e)}, 500

# Error handlers for production
@app.errorhandler(500)
def internal_error(error):
    return {'error': 'Internal server error'}, 500

@app.errorhandler(404)
def not_found(error):
    return {'error': 'Not found'}, 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get('FLASK_ENV') != 'production'
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
