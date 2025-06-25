"""
خدمة الجدولة المتقدمة - OWL COURSE Scheduler Service
نظام مستقل يعمل في الخلفية لإدارة جميع العمليات المجدولة
يقرأ الإعدادات من PostgreSQL ويتحكم في السكرابرز والخدمات
"""

import time
import threading
import logging
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import traceback
import json

# إعداد نظام السجلات
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SchedulerService')

class SchedulerService:
    def __init__(self):
        """تهيئة خدمة الجدولة المستقلة"""
        self.db_connection = None
        self.running = False
        self.thread = None
        self.services_status = {}
        
        # إعدادات الاتصال بقاعدة البيانات
        self.db_config = {
            'host': os.environ.get('PGHOST', 'localhost'),
            'port': os.environ.get('PGPORT', '5432'),
            'database': os.environ.get('PGDATABASE', 'postgres'),
            'user': os.environ.get('PGUSER', 'postgres'),
            'password': os.environ.get('PGPASSWORD', ''),
            'sslmode': 'prefer',
            'connect_timeout': 10,
            'keepalives_idle': 600,
            'keepalives_interval': 30,
            'keepalives_count': 3
        }
        
        logger.info("🔧 خدمة الجدولة المتقدمة - تم التهيئة")
        
    def _ensure_connection(self):
        """ضمان الاتصال بقاعدة البيانات مع إعادة الاتصال التلقائي"""
        try:
            if self.db_connection is None or self.db_connection.closed:
                self.db_connection = psycopg2.connect(**self.db_config)
                logger.info("✅ تم الاتصال بـ PostgreSQL")
                self._create_tables()
                return True
                
            # اختبار الاتصال
            with self.db_connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                
            return True
            
        except Exception as e:
            logger.error(f"❌ خطأ في الاتصال بقاعدة البيانات: {e}")
            self.db_connection = None
            
            # محاولة إعادة الاتصال
            try:
                time.sleep(2)
                self.db_connection = psycopg2.connect(**self.db_config)
                logger.info("✅ تم إعادة الاتصال بـ PostgreSQL")
                self._create_tables()
                return True
            except Exception as e2:
                logger.error(f"❌ فشل في إعادة الاتصال: {e2}")
                return False
                
    def _create_tables(self):
        """إنشاء الجداول المطلوبة إذا لم تكن موجودة"""
        try:
            with self.db_connection.cursor() as cursor:
                # جدول حالة الخدمات
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS scheduler_status (
                        service_name VARCHAR(50) PRIMARY KEY,
                        status VARCHAR(20) DEFAULT 'stopped',
                        last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_execution TIMESTAMP,
                        next_execution TIMESTAMP,
                        execution_count INTEGER DEFAULT 0,
                        error_count INTEGER DEFAULT 0,
                        last_error TEXT,
                        metadata JSON
                    )
                """)
                
                # جدول الإعدادات (إذا لم يكن موجوداً)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS settings (
                        key VARCHAR(100) PRIMARY KEY,
                        value TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # جدول إعدادات الجدولة
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS scheduler_settings (
                        setting_key VARCHAR(100) PRIMARY KEY,
                        setting_value TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                self.db_connection.commit()
                logger.info("✅ جداول قاعدة البيانات جاهزة")
                
        except Exception as e:
            logger.error(f"❌ خطأ في إنشاء الجداول: {e}")
            
    def get_setting(self, key: str, default: Any = None) -> Any:
        """الحصول على إعداد من قاعدة البيانات"""
        if not self._ensure_connection():
            return default
            
        try:
            with self.db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT value FROM settings WHERE key = %s", (key,))
                result = cursor.fetchone()
                
                if result:
                    value = result['value']
                    # محاولة تحويل القيم المنطقية والأرقام
                    if value.lower() in ['true', 'false']:
                        return value.lower() == 'true'
                    elif value.isdigit():
                        return int(value)
                    elif value.replace('.', '').isdigit():
                        return float(value)
                    else:
                        return value
                        
                return default
                
        except Exception as e:
            logger.error(f"❌ خطأ في قراءة الإعداد {key}: {e}")
            return default
            
    def get_scheduler_setting(self, key: str, default: Any = None) -> Any:
        """الحصول على إعداد جدولة من قاعدة البيانات"""
        if not self._ensure_connection():
            return default
            
        try:
            with self.db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("SELECT setting_value FROM scheduler_settings WHERE setting_key = %s", (key,))
                result = cursor.fetchone()
                
                if result:
                    value = result['setting_value']
                    # محاولة تحويل القيم المنطقية والأرقام
                    if value.lower() in ['true', 'false']:
                        return value.lower() == 'true'
                    elif value.isdigit():
                        return int(value)
                    elif value.replace('.', '').isdigit():
                        return float(value)
                    else:
                        return value
                        
                return default
                
        except Exception as e:
            logger.error(f"❌ خطأ في قراءة إعداد الجدولة {key}: {e}")
            return default
            
    def update_service_status(self, service_name: str, status: str, metadata: Dict = None):
        """تحديث حالة الخدمة في قاعدة البيانات"""
        if not self._ensure_connection():
            return
            
        try:
            with self.db_connection.cursor() as cursor:
                metadata_json = json.dumps(metadata) if metadata else None
                
                cursor.execute("""
                    INSERT INTO scheduler_status 
                    (service_name, status, last_heartbeat, metadata)
                    VALUES (%s, %s, CURRENT_TIMESTAMP, %s)
                    ON CONFLICT (service_name) 
                    DO UPDATE SET 
                        status = EXCLUDED.status,
                        last_heartbeat = EXCLUDED.last_heartbeat,
                        metadata = EXCLUDED.metadata
                """, (service_name, status, metadata_json))
                
                self.db_connection.commit()
                
        except Exception as e:
            logger.error(f"❌ خطأ في تحديث حالة الخدمة {service_name}: {e}")
            
    def update_execution_info(self, service_name: str, success: bool = True, error: str = None):
        """تحديث معلومات التنفيذ للخدمة"""
        if not self._ensure_connection():
            return
            
        try:
            with self.db_connection.cursor() as cursor:
                if success:
                    cursor.execute("""
                        UPDATE scheduler_status 
                        SET last_execution = CURRENT_TIMESTAMP,
                            execution_count = execution_count + 1
                        WHERE service_name = %s
                    """, (service_name,))
                else:
                    cursor.execute("""
                        UPDATE scheduler_status 
                        SET error_count = error_count + 1,
                            last_error = %s
                        WHERE service_name = %s
                    """, (error, service_name))
                
                self.db_connection.commit()
                
        except Exception as e:
            logger.error(f"❌ خطأ في تحديث معلومات التنفيذ {service_name}: {e}")
            
    def should_run_udemy(self) -> bool:
        """فحص ما إذا كان حان وقت تشغيل UdemyFreebies"""
        try:
            # فحص حالة النظام العامة
            system_active = self.get_setting('system_active', True)
            if not system_active:
                return False
                
            # فحص إعدادات UdemyFreebies
            udemy_enabled = self.get_scheduler_setting('udemy_enabled', True)
            if not udemy_enabled:
                return False
                
            # الحصول على الفترة الزمنية
            interval_hours = self.get_scheduler_setting('udemy_interval_hours', 3)
            
            # الحصول على آخر تشغيل
            if not self._ensure_connection():
                return False
                
            with self.db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT last_execution FROM scheduler_status 
                    WHERE service_name = 'udemy_scraper'
                """)
                result = cursor.fetchone()
                
                if not result or not result['last_execution']:
                    # أول تشغيل
                    return True
                    
                last_run = result['last_execution']
                next_run = last_run + timedelta(hours=interval_hours)
                
                return datetime.now() >= next_run
                
        except Exception as e:
            logger.error(f"❌ خطأ في فحص جدولة UdemyFreebies: {e}")
            return False
            
    def should_run_studybullet(self) -> bool:
        """فحص ما إذا كان حان وقت تشغيل StudyBullet"""
        try:
            # فحص حالة النظام العامة
            system_active = self.get_setting('system_active', True)
            if not system_active:
                return False
                
            # فحص إعدادات StudyBullet
            studybullet_enabled = self.get_scheduler_setting('studybullet_enabled', True)
            if not studybullet_enabled:
                return False
                
            # الحصول على الإعدادات
            interval_days = self.get_scheduler_setting('studybullet_interval_days', 1)
            run_time = self.get_scheduler_setting('studybullet_run_time', '09:00')
            
            # تحويل وقت التشغيل
            run_hour, run_minute = map(int, run_time.split(':'))
            
            # الحصول على آخر تشغيل
            if not self._ensure_connection():
                return False
                
            with self.db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT last_execution FROM scheduler_status 
                    WHERE service_name = 'studybullet_scraper'
                """)
                result = cursor.fetchone()
                
                now = datetime.now()
                today_run_time = now.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0)
                
                if not result or not result['last_execution']:
                    # أول تشغيل - تشغيل إذا حان الوقت اليوم أو فات
                    return now >= today_run_time
                    
                last_run = result['last_execution']
                next_run = last_run.replace(hour=run_hour, minute=run_minute, second=0, microsecond=0) + timedelta(days=interval_days)
                
                return now >= next_run
                
        except Exception as e:
            logger.error(f"❌ خطأ في فحص جدولة StudyBullet: {e}")
            return False
            
    def run_udemy_scraper(self):
        """تشغيل سكرابر UdemyFreebies"""
        try:
            logger.info("🚀 بدء تشغيل UdemyFreebies scraper")
            self.update_service_status('udemy_scraper', 'running', {'started_at': datetime.now().isoformat()})
            
            # استيراد وتشغيل السكرابر
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            import ultra_fast_scraper
            
            # الحصول على الإعدادات
            max_pages = self.get_scheduler_setting('udemy_max_pages', 10)
            timeout_minutes = self.get_scheduler_setting('udemy_timeout_minutes', 30)
            
            # تشغيل السكرابر مع الإعدادات
            result = ultra_fast_scraper.run_scraper(max_pages=max_pages, timeout_minutes=timeout_minutes)
            
            if not result.get('success', False):
                raise Exception(result.get('error', 'Unknown error'))
            
            self.update_service_status('udemy_scraper', 'completed', {
                'completed_at': datetime.now().isoformat(),
                'courses_found': result.get('courses_found', 0),
                'pages_processed': result.get('pages_processed', 0)
            })
            
            self.update_execution_info('udemy_scraper', success=True)
            logger.info(f"✅ اكتمل تشغيل UdemyFreebies - {result.get('courses_found', 0)} دورة جديدة")
            
        except Exception as e:
            error_msg = f"خطأ في تشغيل UdemyFreebies: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.update_service_status('udemy_scraper', 'error', {'error': error_msg})
            self.update_execution_info('udemy_scraper', success=False, error=error_msg)
            
    def run_studybullet_scraper(self):
        """تشغيل سكرابر StudyBullet"""
        try:
            logger.info("🚀 بدء تشغيل StudyBullet scraper")
            self.update_service_status('studybullet_scraper', 'running', {'started_at': datetime.now().isoformat()})
            
            # استيراد وتشغيل السكرابر
            sys.path.append(os.path.dirname(os.path.abspath(__file__)))
            import final_studybullet_scraper
            
            # الحصول على الإعدادات
            max_pages = self.get_scheduler_setting('studybullet_max_pages', 50)
            timeout_minutes = self.get_scheduler_setting('studybullet_timeout_minutes', 45)
            
            # تشغيل السكرابر مع الإعدادات
            result = final_studybullet_scraper.run_scraper(max_pages=max_pages, timeout_minutes=timeout_minutes)
            
            self.update_service_status('studybullet_scraper', 'completed', {
                'completed_at': datetime.now().isoformat(),
                'courses_found': result.get('courses_found', 0),
                'pages_processed': result.get('pages_processed', 0)
            })
            
            self.update_execution_info('studybullet_scraper', success=True)
            logger.info(f"✅ اكتمل تشغيل StudyBullet - {result.get('courses_found', 0)} دورة جديدة")
            
        except Exception as e:
            error_msg = f"خطأ في تشغيل StudyBullet: {str(e)}"
            logger.error(f"❌ {error_msg}")
            self.update_service_status('studybullet_scraper', 'error', {'error': error_msg})
            self.update_execution_info('studybullet_scraper', success=False, error=error_msg)
            
    def start(self):
        """بدء خدمة الجدولة"""
        if self.running:
            logger.warning("⚠️ الخدمة تعمل بالفعل")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._main_loop, daemon=True)
        self.thread.start()
        logger.info("🟢 تم بدء خدمة الجدولة المتقدمة")
        
    def stop(self):
        """إيقاف خدمة الجدولة"""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        logger.info("🔴 تم إيقاف خدمة الجدولة")
        
    def _main_loop(self):
        """الحلقة الرئيسية للخدمة"""
        logger.info("🔄 بدء الحلقة الرئيسية للجدولة")
        
        while self.running:
            try:
                # إرسال heartbeat
                self.update_service_status('scheduler_service', 'running', {
                    'loop_time': datetime.now().isoformat(),
                    'system_active': self.get_setting('system_active', True)
                })
                
                # فحص النظام العام
                system_active = self.get_setting('system_active', True)
                if not system_active:
                    logger.info("⏸️ النظام متوقف مؤقتاً")
                    time.sleep(30)
                    continue
                
                # فحص UdemyFreebies
                if self.should_run_udemy():
                    logger.info("⏰ حان وقت تشغيل UdemyFreebies")
                    threading.Thread(target=self.run_udemy_scraper, daemon=True).start()
                
                # فحص StudyBullet
                if self.should_run_studybullet():
                    logger.info("⏰ حان وقت تشغيل StudyBullet")
                    threading.Thread(target=self.run_studybullet_scraper, daemon=True).start()
                
                # انتظار 30 ثانية
                time.sleep(30)
                
            except Exception as e:
                logger.error(f"❌ خطأ في الحلقة الرئيسية: {e}")
                logger.error(traceback.format_exc())
                time.sleep(30)
                
        logger.info("🏁 انتهت الحلقة الرئيسية للجدولة")

# إنشاء مثيل عام للخدمة
scheduler_service = SchedulerService()

def start_service():
    """بدء خدمة الجدولة"""
    scheduler_service.start()
    
def stop_service():
    """إيقاف خدمة الجدولة"""
    scheduler_service.stop()
    
def get_service_status():
    """الحصول على حالة الخدمة"""
    return {
        'running': scheduler_service.running,
        'thread_alive': scheduler_service.thread.is_alive() if scheduler_service.thread else False
    }

if __name__ == "__main__":
    # تشغيل الخدمة كبرنامج مستقل
    logger.info("🚀 بدء تشغيل خدمة الجدولة كبرنامج مستقل")
    
    try:
        scheduler_service.start()
        
        # إبقاء البرنامج يعمل
        while True:
            time.sleep(60)
            
    except KeyboardInterrupt:
        logger.info("⚠️ تم إيقاف البرنامج بواسطة المستخدم")
        scheduler_service.stop()
        
    except Exception as e:
        logger.error(f"❌ خطأ عام في البرنامج: {e}")
        logger.error(traceback.format_exc())
        scheduler_service.stop()