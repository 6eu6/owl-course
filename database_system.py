"""
نظام قواعد البيانات الهجين المحسن - OWL COURSE
PostgreSQL (محلي - سريع) + MongoDB Atlas (سحابي - للبيانات الكبيرة)
"""
import os
import time
import psycopg2
import psycopg2.extras
from pymongo import MongoClient
import logging
from datetime import datetime, timedelta
import json

class DatabaseSystem:
    def __init__(self):
        """تهيئة النظام الهجين المحسن"""
        self.pg_conn = None
        self.mongo_db = None
        self._init_postgresql()
        self._init_mongodb()
        self._create_tables()
    
    def _init_postgresql(self):
        """تهيئة PostgreSQL المحلي للبيانات السريعة مع إعدادات مقاومة للانقطاع"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # إعدادات محسنة لمنع انقطاع SSL
                self.pg_conn = psycopg2.connect(
                    os.environ.get('DATABASE_URL'),
                    cursor_factory=psycopg2.extras.RealDictCursor,
                    # إعدادات SSL محسنة
                    sslmode='prefer',         # تفضيل SSL مع التراجع للعادي
                    application_name='owl_course_app',
                    # إعدادات مقاومة الانقطاع
                    keepalives_idle=300,      # فحص الاتصال كل 5 دقائق
                    keepalives_interval=10,   # إعادة المحاولة كل 10 ثواني
                    keepalives_count=3,       # 3 محاولات قبل اعتبار الاتصال مُنقطع
                    connect_timeout=15        # مهلة الاتصال 15 ثانية
                )
                self.pg_conn.autocommit = True
                print("✅ PostgreSQL connected with enhanced stability settings")
                break
                
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"PostgreSQL connection attempt {attempt + 1} failed, retrying in 2 seconds...")
                    time.sleep(2)
                else:
                    print(f"❌ PostgreSQL connection failed after {max_retries} attempts: {e}")
                    self.pg_conn = None
            
    def _init_mongodb(self):
        """تهيئة MongoDB للبيانات الكبيرة"""
        try:
            mongo_uri = os.environ.get('MONGODB_URI')
            if mongo_uri:
                client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
                self.mongo_db = client['coursegem']
                # اختبار الاتصال
                self.mongo_db.command('ping')
                print("✅ MongoDB connected for big data")
            else:
                print("⚠️ MONGODB_URI not found")
                self.mongo_db = None
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            self.mongo_db = None
    
    def _create_tables(self):
        """إنشاء جداول PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()
            
            # جدول الإعدادات العامة
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # جدول سجلات تشغيل السكرابر
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS execution_logs (
                    id SERIAL PRIMARY KEY,
                    execution_id VARCHAR(100) NOT NULL,
                    scraper_type VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    courses_found INTEGER DEFAULT 0,
                    pages_processed INTEGER DEFAULT 0,
                    duration_seconds FLOAT DEFAULT 0,
                    error_message TEXT,
                    details JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # جدول إعدادات الجدولة المتقدمة
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS scheduler_settings (
                    setting_key VARCHAR(100) PRIMARY KEY,
                    setting_value TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # جدول التقارير
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id SERIAL PRIMARY KEY,
                    course_id VARCHAR(100) NOT NULL,
                    course_title TEXT NOT NULL,
                    collection_name VARCHAR(50) NOT NULL,
                    report_type VARCHAR(50) NOT NULL,
                    report_reason TEXT,
                    user_ip VARCHAR(45),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending'
                )
            """)
            
            # جدول إحصائيات الاستخدام
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS usage_stats (
                    id SERIAL PRIMARY KEY,
                    stat_type VARCHAR(100) NOT NULL,
                    count INTEGER DEFAULT 1,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # جدول تاريخ الأداء
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS performance_history (
                    id SERIAL PRIMARY KEY,
                    cpu_percent FLOAT NOT NULL,
                    memory_percent FLOAT NOT NULL,
                    disk_percent FLOAT NOT NULL,
                    db_response_ms FLOAT NOT NULL,
                    status VARCHAR(50) DEFAULT 'normal',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # فهرس لتسريع استعلامات التاريخ
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_performance_history_created_at 
                ON performance_history(created_at DESC)
            """)
            
            cursor.close()
            print("✅ PostgreSQL tables created")
            
            # إضافة الإعدادات الافتراضية بعد إنشاء الجداول
            self._ensure_default_settings()
            
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
    
    def _ensure_default_settings(self):
        """ضمان وجود الإعدادات الافتراضية في PostgreSQL"""
        try:
            if not self.pg_conn or self.pg_conn.closed:
                return
                
            cursor = self.pg_conn.cursor()
            
            # الإعدادات الافتراضية الأساسية
            default_settings = {
                'site_title': 'OWL COURSE',
                'site_description': 'Free Course Discovery Platform',
                'courses_per_page': '12',
                'system_active': 'true',
                'telegram_enabled': 'true',
                'auto_post_enabled': 'false',
                'analytics_head_code': '',
                'analytics_body_code': '',
                'join_channel_username': 'CourseGem',
                'contact_username': 'CourseGem'
            }
            
            for key, value in default_settings.items():
                cursor.execute("""
                    INSERT INTO settings (key, value, updated_at) 
                    VALUES (%s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (key) DO NOTHING
                """, (key, value))
            
            # إعدادات الجدولة الافتراضية
            default_scheduler_settings = {
                'udemy_enabled': 'true',
                'udemy_interval_hours': '3',
                'udemy_max_pages': '10',
                'udemy_timeout_minutes': '30',
                'studybullet_enabled': 'true',
                'studybullet_interval_days': '1',
                'studybullet_run_time': '14:00',
                'studybullet_max_pages': '50',
                'studybullet_timeout_minutes': '45'
            }
            
            for key, value in default_scheduler_settings.items():
                cursor.execute("""
                    INSERT INTO scheduler_settings (setting_key, setting_value, updated_at) 
                    VALUES (%s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (setting_key) DO NOTHING
                """, (key, value))
            
            cursor.close()
            print("✅ الإعدادات الافتراضية تم تأكيدها")
            
        except Exception as e:
            print(f"❌ خطأ في تأكيد الإعدادات الافتراضية: {e}")
    
    # === إدارة الإعدادات (PostgreSQL) ===
    def get_setting(self, key, default=None):
        """الحصول على إعداد بسرعة فائقة"""
        try:
            if not self._ensure_connection():
                return default
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = %s", (key,))
            result = cursor.fetchone()
            cursor.close()
            return result['value'] if result else default
        except Exception as e:
            print(f"Error getting setting {key}: {e}")
            return default
    
    def set_setting(self, key, value):
        """حفظ إعداد بسرعة فائقة"""
        try:
            if not self._ensure_connection():
                return False
            cursor = self.pg_conn.cursor()
            cursor.execute("""
                INSERT INTO settings (key, value, updated_at) 
                VALUES (%s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET 
                value = EXCLUDED.value,
                updated_at = CURRENT_TIMESTAMP
            """, (key, str(value)))
            cursor.close()
            return True
        except Exception as e:
            print(f"Error saving setting: {e}")
            return False
    
    def get_all_settings(self):
        """الحصول على جميع الإعدادات"""
        try:
            if not self._ensure_connection():
                return {}
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT key, value FROM settings")
            settings = {row['key']: row['value'] for row in cursor.fetchall()}
            cursor.close()
            return settings
        except Exception as e:
            print(f"Error getting all settings: {e}")
            return {}
    
    # === إدارة سجلات التشغيل (PostgreSQL) ===
    def log_execution(self, execution_id, scraper_type, status, details=None):
        """تسجيل تفاصيل تشغيل السكرابر"""
        try:
            if not self._ensure_connection():
                return
            cursor = self.pg_conn.cursor()
            
            # Handle both string and dict details
            if isinstance(details, str):
                details_dict = {'message': details}
                details_json = json.dumps(details_dict)
                courses_found = 0
                pages_processed = 0
                duration = 0
                error_message = None
            elif isinstance(details, dict):
                details_dict = details
                details_json = json.dumps(details_dict)
                courses_found = details_dict.get('courses_found', 0)
                pages_processed = details_dict.get('pages_processed', 0)
                duration = details_dict.get('duration', 0)
                error_message = details_dict.get('error')
            else:
                details_json = None
                courses_found = 0
                pages_processed = 0
                duration = 0
                error_message = None
            
            cursor.execute("""
                INSERT INTO execution_logs 
                (execution_id, scraper_type, status, courses_found, pages_processed, 
                 duration_seconds, error_message, details)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                execution_id, scraper_type, status,
                courses_found, pages_processed, duration,
                error_message, details_json
            ))
            self.pg_conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error logging execution: {e}")
            return False
    
    def get_execution_logs(self, scraper_type=None, limit=50):
        """الحصول على سجلات التشغيل"""
        try:
            if not self._ensure_connection():
                return []
            cursor = self.pg_conn.cursor()
            if scraper_type:
                cursor.execute("""
                    SELECT execution_id, scraper_type, status, courses_found, 
                           pages_processed, duration_seconds, error_message, 
                           details, created_at FROM execution_logs 
                    WHERE scraper_type = %s 
                    ORDER BY created_at DESC LIMIT %s
                """, (scraper_type, limit))
            else:
                cursor.execute("""
                    SELECT execution_id, scraper_type, status, courses_found, 
                           pages_processed, duration_seconds, error_message, 
                           details, created_at FROM execution_logs 
                    ORDER BY created_at DESC LIMIT %s
                """, (limit,))
            
            logs = cursor.fetchall()
            cursor.close()
            
            # Handle PostgreSQL RealDictRow objects
            result = []
            for log in logs:
                # Check if it's a RealDictRow (dict-like) or tuple
                if hasattr(log, 'keys'):
                    # It's a dict-like object
                    log_dict = {
                        'execution_id': log.get('execution_id'),
                        'scraper_type': log.get('scraper_type'),
                        'status': log.get('status'),
                        'courses_found': log.get('courses_found', 0),
                        'pages_processed': log.get('pages_processed', 0),
                        'duration_seconds': log.get('duration_seconds', 0),
                        'error_message': log.get('error_message'),
                        'details': log.get('details'),
                        'timestamp': log.get('created_at').isoformat() if log.get('created_at') else None
                    }
                else:
                    # It's a tuple - handle by index
                    log_dict = {
                        'execution_id': log[0] if len(log) > 0 else None,
                        'scraper_type': log[1] if len(log) > 1 else None,
                        'status': log[2] if len(log) > 2 else None,
                        'courses_found': log[3] if len(log) > 3 else 0,
                        'pages_processed': log[4] if len(log) > 4 else 0,
                        'duration_seconds': log[5] if len(log) > 5 else 0,
                        'error_message': log[6] if len(log) > 6 else None,
                        'details': log[7] if len(log) > 7 else None,
                        'timestamp': log[8].isoformat() if len(log) > 8 and log[8] else None
                    }
                result.append(log_dict)
            return result
        except Exception as e:
            print(f"Error getting execution logs: {e}")
            return []
    
    def clear_old_logs(self, days_to_keep=30):
        """حذف السجلات القديمة"""
        try:
            if not self._ensure_connection():
                return 0
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            cursor = self.pg_conn.cursor()
            cursor.execute("""
                DELETE FROM execution_logs 
                WHERE executed_at < %s
            """, (cutoff_date,))
            deleted_count = cursor.rowcount
            cursor.close()
            return deleted_count
        except Exception as e:
            print(f"Error clearing old logs: {e}")
            return 0
    
    # === إدارة الجدولة (PostgreSQL) ===
    def _ensure_connection(self):
        """ضمان وجود اتصال PostgreSQL صالح مع إعادة الاتصال التلقائي"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # فحص حالة الاتصال
                if not self.pg_conn or self.pg_conn.closed:
                    print(f"PostgreSQL connection lost, attempting reconnection {attempt + 1}/{max_retries}")
                    self._init_postgresql()
                
                # اختبار الاتصال
                if self.pg_conn and not self.pg_conn.closed:
                    cursor = self.pg_conn.cursor()
                    cursor.execute("SELECT 1")
                    cursor.close()
                    return True
                    
            except Exception as e:
                print(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)  # انتظار ثانية واحدة قبل المحاولة التالية
                else:
                    print("All reconnection attempts failed")
                    
        return False

    def get_scheduler_setting(self, setting_name, default=None):
        """الحصول على إعداد الجدولة"""
        try:
            if not self._ensure_connection():
                return default
                
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT setting_value FROM scheduler_settings WHERE setting_key = %s", (setting_name,))
            result = cursor.fetchone()
            cursor.close()
            
            if result:
                value = result['setting_value'] if isinstance(result, dict) else result[0]
                # تحويل القيم النصية إلى النوع المناسب
                if isinstance(value, str):
                    if value.lower() == 'true':
                        return True
                    elif value.lower() == 'false':
                        return False
                    elif value.isdigit():
                        return int(value)
                    else:
                        return value
                return value
            return default
        except Exception as e:
            print(f"خطأ في جلب الإعداد {setting_name}: {e}")
            return default
    
    def set_scheduler_setting(self, setting_name, setting_value):
        """حفظ إعداد الجدولة"""
        try:
            if not self._ensure_connection():
                return False
                
            cursor = self.pg_conn.cursor()
            cursor.execute("""
                INSERT INTO scheduler_settings (setting_key, setting_value, updated_at)
                VALUES (%s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = EXCLUDED.setting_value,
                updated_at = CURRENT_TIMESTAMP
            """, (setting_name, str(setting_value)))
            self.pg_conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"خطأ في حفظ الإعداد {setting_name}: {e}")
            return False
    
    def get_all_scheduler_settings(self):
        """الحصول على جميع إعدادات الجدولة"""
        try:
            if not self._ensure_connection():
                return {}
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT setting_key, setting_value FROM scheduler_settings")
            settings = {row[0]: row[1] for row in cursor.fetchall()}
            cursor.close()
            return settings
        except Exception as e:
            print(f"Error getting scheduler settings: {e}")
            return {}
    
    # === إدارة التقارير (PostgreSQL) ===
    def save_report(self, course_id, course_title, collection_name, report_type, user_ip, report_reason=None):
        """حفظ تقرير مستخدم"""
        try:
            if not self._ensure_connection():
                return False
            cursor = self.pg_conn.cursor()
            cursor.execute("""
                INSERT INTO reports 
                (course_id, course_title, collection_name, report_type, report_reason, user_ip)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (course_id, course_title, collection_name, report_type, report_reason, user_ip))
            self.pg_conn.commit()
            cursor.close()
            return True
        except Exception as e:
            print(f"Error saving report: {e}")
            return False
    
    def get_reports_count(self):
        """عدد التقارير"""
        try:
            if not self._ensure_connection():
                return 0
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'")
            result = cursor.fetchone()
            cursor.close()
            return result['count'] if result else 0
        except Exception as e:
            print(f"Error getting reports count: {e}")
            return 0
    
    # === مجموعات MongoDB للبيانات الكبيرة ===
    def get_courses_collection(self):
        """الحصول على مجموعة الدورات الرئيسية (UdemyFreebies)"""
        if self.mongo_db:
            return self.mongo_db['courses']
        return None
    
    def get_free_courses_collection(self):
        """الحصول على مجموعة الدورات المجانية (StudyBullet)"""
        if self.mongo_db:
            return self.mongo_db['free_courses']
        return None
    
    def get_telegram_messages_collection(self):
        """الحصول على مجموعة رسائل Telegram"""
        if self.mongo_db:
            return self.mongo_db['telegram_messages']
        return None
    
    def get_ads_collection(self):
        """الحصول على مجموعة الإعلانات"""
        if self.mongo_db:
            return self.mongo_db['ads']
        return None
    
    # === إحصائيات سريعة ===
    def get_quick_stats(self):
        """إحصائيات سريعة من كلا قاعدتي البيانات"""
        stats = {}
        
        # إحصائيات من PostgreSQL
        try:
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM execution_logs")
            stats['total_executions'] = cursor.fetchone()['count']
            
            cursor.execute("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'")
            stats['pending_reports'] = cursor.fetchone()['count']
            
            cursor.close()
        except:
            stats['total_executions'] = 0
            stats['pending_reports'] = 0
        
        # إحصائيات من MongoDB
        if self.mongo_db:
            try:
                stats['total_courses'] = self.mongo_db['courses'].count_documents({})
                stats['free_courses'] = self.mongo_db['free_courses'].count_documents({})
                stats['telegram_messages'] = self.mongo_db['telegram_messages'].count_documents({})
            except:
                stats['total_courses'] = 0
                stats['free_courses'] = 0
                stats['telegram_messages'] = 0
        
        return stats
    
    # === دوال الإحصائيات المطلوبة ===
    def get_courses_count(self):
        """عدد دورات UdemyFreebies"""
        if self.mongo_db:
            return self.mongo_db['courses'].count_documents({})
        return 0
    
    def get_free_courses_count(self):
        """عدد دورات StudyBullet المجانية"""
        if self.mongo_db:
            return self.mongo_db['free_courses'].count_documents({})
        return 0
    
    def get_ads_count(self):
        """عدد الإعلانات"""
        if self.mongo_db:
            return self.mongo_db['ads'].count_documents({})
        return 0
    
    def get_telegram_messages_count(self):
        """عدد رسائل تليجرام"""
        if self.mongo_db:
            return self.mongo_db['telegram_messages'].count_documents({})
        return 0

# مثيل وحيد من النظام
_db_system = None

def get_database_system():
    """الحصول على مثيل النظام الهجين"""
    global _db_system
    if _db_system is None:
        _db_system = DatabaseSystem()
    return _db_system

def quick_setting(key, default=None):
    """دالة سريعة للحصول على الإعدادات"""
    return get_database_system().get_setting(key, default)

def save_setting(key, value):
    """دالة سريعة لحفظ الإعدادات"""
    return get_database_system().set_setting(key, value)