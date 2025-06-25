import os
import logging
from flask import Flask, request, session, g
from flask_login import LoginManager
from flask_compress import Compress
from werkzeug.middleware.proxy_fix import ProxyFix
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging based on environment
if os.environ.get('FLASK_ENV') == 'production':
    logging.basicConfig(level=logging.ERROR)
else:
    logging.basicConfig(level=logging.INFO)

# تقليل logs من MongoDB لتحسين الأداء
logging.getLogger('pymongo').setLevel(logging.WARNING)
logging.getLogger('pymongo.topology').setLevel(logging.WARNING)
logging.getLogger('pymongo.connection').setLevel(logging.WARNING)
logging.getLogger('pymongo.command').setLevel(logging.WARNING)
logging.getLogger('pymongo.serverSelection').setLevel(logging.WARNING)

# Initialize Flask app
app = Flask(__name__)
# Generate secure secret key
secret_key = os.environ.get("SESSION_SECRET")
if not secret_key:
    if os.environ.get('FLASK_ENV') == 'production':
        raise ValueError("SESSION_SECRET environment variable is required in production")
    else:
        secret_key = "dev_secret_key_2024"  # Only for development
app.secret_key = secret_key
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Fix Arabic text encoding in JSON responses
app.config['JSON_AS_ASCII'] = False

# Smart Site URL Detection - Automatic domain detection
def get_dynamic_site_url():
    """
    Automatically detect the site URL based on the current request
    Falls back to environment variable, then localhost for development
    """
    if request and hasattr(request, 'url_root'):
        # Remove trailing slash and return the dynamic URL from request
        return request.url_root.rstrip('/')
    
    # Fallback to environment variable
    env_url = os.environ.get("SITE_URL")
    if env_url:
        return env_url.rstrip('/')
    
    # Final fallback for development
    return "http://localhost:5000"

# Set initial site URL - will be dynamically updated per request
app.config['SITE_URL'] = os.environ.get("SITE_URL", "http://localhost:5000")

# Initialize compression for 60-80% bandwidth reduction
compress = Compress(app)
app.config['COMPRESS_MIMETYPES'] = [
    'text/html', 'text/css', 'text/xml', 'application/json',
    'application/javascript', 'text/javascript', 'image/svg+xml'
]

# Cache headers for static assets
@app.after_request
def add_cache_headers(response):
    """Add cache headers for performance optimization"""
    if request.endpoint == 'static':
        # Cache static files for 30 days
        response.cache_control.max_age = 2592000
        response.cache_control.public = True
    elif '/api/' in request.path:
        if '/api/live-stats' in request.path:
            response.cache_control.max_age = 30  # Cache live stats for 30 seconds
        else:
            response.cache_control.no_cache = True
    return response

# Removed language system - now using English-only with Google Translate support

@app.context_processor
def inject_global_data():
    """Inject global data for all templates with dynamic site URL detection"""
    try:
        from routes import get_all_categories
        # Get settings for analytics codes
        settings = settings_collection.find_one({'_id': 'main'}) or {}
        # Get telegram settings for global use
        telegram_settings = settings_collection.find_one({'_id': 'telegram'}) or {}
        return {
            'all_categories': get_all_categories(),
            'site_url': get_dynamic_site_url(),
            'settings': settings,
            'telegram_settings': telegram_settings
        }
    except Exception as e:
        print(f"Error injecting global data: {e}")
        return {
            'all_categories': [],
            'site_url': get_dynamic_site_url(),
            'settings': {}
        }

# Initialize Login Manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'admin_login'
login_manager.login_message = 'Please log in to access the admin panel.'

# تتبع الزوار التلقائي
@app.before_request
def track_visitors():
    """تتبع الزوار تلقائياً في الصفحات العامة"""
    try:
        # تتبع فقط في الصفحات العامة (ليس الإدارة أو الملفات الثابتة)
        if (request.endpoint and 
            not request.endpoint.startswith('static') and 
            not request.endpoint.startswith('eu6a-admin') and
            request.method == 'GET'):
            
            from visitor_tracking import track_visitor
            track_visitor()
    except Exception as e:
        print(f"خطأ في تتبع الزائر: {str(e)}")

class Admin:
    def __init__(self):
        self.id = 'admin'
        
    def is_authenticated(self):
        return True
        
    def is_active(self):
        return True
        
    def is_anonymous(self):
        return False
        
    def get_id(self):
        return self.id

@login_manager.user_loader
def load_user(user_id):
    if user_id:
        return Admin()
    return None

# New Hybrid Database System - PostgreSQL (local fast) + MongoDB (big data)
try:
    from database_system import get_database_system, quick_setting
    db_system = get_database_system()
    print("✅ New hybrid database system initialized")
    
    # MongoDB connection for big data only (optimized)
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://6_u6:Ah251403@coursegem.x2dq25t.mongodb.net/coursegem?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000&socketTimeoutMS=2000&maxPoolSize=2&minPoolSize=1&maxIdleTimeMS=3000&retryWrites=false&w=1&compressors=zstd')
    client = MongoClient(MONGO_URI)
    db = client.coursegem
    
except Exception as e:
    print(f"⚠️ Hybrid system error: {e}")
    # Fallback to MongoDB only
    MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://6_u6:Ah251403@coursegem.x2dq25t.mongodb.net/coursegem?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000&socketTimeoutMS=2000&maxPoolSize=2&minPoolSize=1&maxIdleTimeMS=3000&retryWrites=false&w=1&compressors=zstd')
    client = MongoClient(MONGO_URI)
    db = client.coursegem
    db_system = None

# Only load essential collections at startup
settings_collection = db.settings

# Lazy loading for other collections to speed up startup
_courses_collection = None
_free_courses_collection = None
_ads_collection = None
_telegram_messages_collection = None

def get_courses_collection():
    global _courses_collection
    if _courses_collection is None:
        _courses_collection = db.courses
    return _courses_collection

def get_free_courses_collection():
    global _free_courses_collection
    if _free_courses_collection is None:
        _free_courses_collection = db.free_courses
    return _free_courses_collection

def get_ads_collection():
    global _ads_collection
    if _ads_collection is None:
        _ads_collection = db.ads
    return _ads_collection

def get_telegram_messages_collection():
    global _telegram_messages_collection
    if _telegram_messages_collection is None:
        _telegram_messages_collection = db.telegram_messages
    return _telegram_messages_collection

# Backward compatibility aliases
courses_collection = get_courses_collection()
free_courses_collection = get_free_courses_collection()
ads_collection = get_ads_collection()
telegram_messages_collection = get_telegram_messages_collection()

# Make utility functions available in templates
from utils import format_students_count
# Removed translation system - now using English only with Google Translate

app.jinja_env.globals.update(
    format_students_count=format_students_count
)

@login_manager.user_loader
def load_user(user_id):
    from models import Admin
    if user_id == "admin":
        return Admin()
    return None

# Initialize default settings - hybrid system optimized
def init_default_settings():
    try:
        # Try new database system first (instant)
        if db_system is not None:
            site_name = db_system.get_setting('site_name')
            if not site_name:
                # Create basic default settings using set_setting method
                db_system.set_setting('site_name', 'OWL COURSE')
                db_system.set_setting('site_description', 'Free Online Courses Platform')
                db_system.set_setting('scraper_enabled', 'true')
            return
    except Exception as e:
        logging.error(f"Error with hybrid system: {e}")
        
        # Fallback to MongoDB with fast timeout
        try:
            existing = settings_collection.find_one({"_id": "main"}, max_time_ms=500)
            if existing is None:
                default_settings = {
                    "_id": "main",
                    "scraper_enabled": True,
                "auto_scraper": True,
                "telegram_enabled": True,
                "auto_telegram_post": True,
                "courses_per_page": 12,
                "max_courses_scrape": 100
                }
                settings_collection.insert_one(default_settings)
        except Exception as e:
            logging.error(f"Error initializing default settings: {e}")

# Import routes to register them with Flask app
try:
    import routes
    print("✅ Routes loaded successfully")
except Exception as e:
    print(f"⚠️ Error loading routes: {e}")

# Background initialization - delay non-critical startup tasks
def init_background_services():
    """Initialize non-critical services in background after startup"""
    from threading import Thread
    import time
    
    def background_init():
        try:
            # Wait 5 seconds after startup before initializing heavy services
            time.sleep(5)
            
            # 1. بدء نظام الجدولة المتقدم
            try:
                from advanced_scheduler import get_advanced_scheduler, start_advanced_scheduler
                scheduler = get_advanced_scheduler()
                if scheduler:
                    start_advanced_scheduler()
                    logging.info("✅ نظام الجدولة المتقدم بدأ بنجاح")
                else:
                    logging.warning("⚠️ فشل تهيئة نظام الجدولة المتقدم")
            except Exception as e:
                logging.error(f"خطأ في بدء نظام الجدولة: {e}")
            
            # 2. فحص إعدادات التليجرام (بدون تشغيل تلقائي)
            try:
                # فحص الإعدادات من PostgreSQL بدلاً من MongoDB
                if db_system:
                    auto_post_enabled = db_system.get_setting('auto_telegram_post', 'false')
                    telegram_enabled = db_system.get_setting('telegram_enabled', 'false')
                    
                    if auto_post_enabled == 'true' and telegram_enabled == 'true':
                        logging.info("ℹ️ إعدادات التليجرام: مفعلة (تحكم من لوحة الإدارة)")
                    else:
                        logging.info("ℹ️ إعدادات التليجرام: معطلة")
                else:
                    logging.info("ℹ️ نظام الإعدادات الهجين غير متاح")
                    
            except Exception as e:
                logging.error(f"خطأ في فحص إعدادات التليجرام: {e}")
            
            logging.info("✅ جميع الخدمات الخلفية تم تهيئتها")
            
        except Exception as e:
            logging.error(f"Background init error: {e}")
    
    # Start background thread for non-critical services
    Thread(target=background_init, daemon=True).start()

if __name__ == "__main__":
    with app.app_context():
        init_default_settings()
        init_background_services()  # Non-blocking startup
    app.run(host="0.0.0.0", port=5000, debug=True)
else:
    # For production (gunicorn) - minimal startup for speed
    with app.app_context():
        init_default_settings()
        init_background_services()  # Non-blocking background init