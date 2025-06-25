"""
نظام الجدولة المتقدم - Advanced Scheduler System
يدعم جدولة UdemyFreebies بالساعات و StudyBullet بالأيام
يعمل على أي استضافة بما في ذلك Render.com
"""

import os
import logging
import threading
import time
from datetime import datetime, timedelta
from pymongo import MongoClient
from ultra_fast_scraper import UltraFastScraper
import importlib.util

# استيراد النظام الهجين
try:
    from database_system import DatabaseSystem
    HYBRID_AVAILABLE = True
except ImportError:
    HYBRID_AVAILABLE = False
    print("⚠️  النظام الهجين غير متاح - استخدام MongoDB فقط")

# إعداد التسجيل
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class AdvancedScheduler:
    def __init__(self):
        """تهيئة النظام المتقدم للجدولة"""
        # تهيئة النظام الهجين
        if HYBRID_AVAILABLE:
            self.db_manager = DatabaseSystem()
            print("✅ نظام الجدولة: استخدام النظام الهجين")
        else:
            self.db_manager = None
            print("⚠️  نظام الجدولة: استخدام MongoDB فقط")
        
        # الاتصال بقاعدة البيانات MongoDB للدورات
        self.client = MongoClient(os.environ.get('MONGODB_URI'))
        self.db = self.client.coursegem
        self.settings_collection = self.db.settings
        
        # حالة النظام
        self.running = False
        self.thread = None
        
        # السكرابرز
        self.udemy_scraper = UltraFastScraper()
        self.studybullet_scraper = None
        
        # مجموعة سجلات التشغيل
        self.logs_collection = self.db.scheduler_logs
        
        # تهيئة الإعدادات الافتراضية
        self.init_scheduler_settings()
        
        logging.info("🚀 تم تهيئة نظام الجدولة المتقدم بنجاح")

    def init_scheduler_settings(self):
        """إعداد الجدولة الافتراضية للموقعين"""
        try:
            # استخدام النظام الهجين للإعدادات
            if self.db_manager:
                # إضافة إعداد حالة النظام الافتراضية
                system_active = self.db_manager.get_scheduler_setting('system_active')
                if system_active is None:
                    self.db_manager.set_scheduler_setting('system_active', False)
                    logging.info("✅ تم تهيئة حالة النظام: معطل افتراضياً")
                
                # إعدادات UdemyFreebies (بالساعات)
                udemy_enabled = self.db_manager.get_scheduler_setting('udemy_enabled')
                if udemy_enabled is None:
                    self.db_manager.set_scheduler_setting('udemy_enabled', True)
                    self.db_manager.set_scheduler_setting('udemy_interval_hours', 3)
                    self.db_manager.set_scheduler_setting('udemy_last_run', None)
                    self.db_manager.set_scheduler_setting('udemy_runs_count', 0)
                    self.db_manager.set_scheduler_setting('udemy_success_rate', 100.0)
                    logging.info("✅ تم إنشاء إعدادات UdemyFreebies في PostgreSQL")
            else:
                # العودة لـ MongoDB في حالة عدم توفر النظام الهجين
                udemy_settings = self.settings_collection.find_one({'name': 'udemy_scheduler'})
                if not udemy_settings:
                    self.settings_collection.insert_one({
                        'name': 'udemy_scheduler',
                        'enabled': True,
                        'interval_hours': 3,
                        'last_run': None,
                        'next_run': None,
                        'runs_count': 0,
                        'success_rate': 100.0,
                        'created_at': datetime.now(),
                        'updated_at': datetime.now()
                    })
                    logging.info("✅ تم إنشاء إعدادات UdemyFreebies في MongoDB")

            # إعدادات StudyBullet (بالأيام)
            if self.db_manager:
                studybullet_enabled = self.db_manager.get_scheduler_setting('studybullet_enabled')
                if studybullet_enabled is None:
                    self.db_manager.set_scheduler_setting('studybullet_enabled', False)
                    self.db_manager.set_scheduler_setting('studybullet_interval_days', 7)
                    self.db_manager.set_scheduler_setting('studybullet_run_time', '02:00')
                    self.db_manager.set_scheduler_setting('studybullet_last_run', None)
                    self.db_manager.set_scheduler_setting('studybullet_runs_count', 0)
                    self.db_manager.set_scheduler_setting('studybullet_success_rate', 100.0)
                    self.db_manager.set_scheduler_setting('studybullet_max_pages', 50)
                    self.db_manager.set_scheduler_setting('studybullet_timeout_minutes', 60)
                    logging.info("✅ تم إنشاء إعدادات StudyBullet في PostgreSQL")
            else:
                studybullet_settings = self.settings_collection.find_one({'name': 'studybullet_scheduler'})
                if not studybullet_settings:
                    self.settings_collection.insert_one({
                        'name': 'studybullet_scheduler',
                        'enabled': False,
                        'interval_days': 7,
                        'run_time': '02:00',
                        'last_run': None,
                        'next_run': None,
                        'runs_count': 0,
                        'success_rate': 100.0,
                        'max_pages': 50,
                        'timeout_minutes': 60,
                        'target_categories': ['free-courses'],
                        'created_at': datetime.now(),
                        'updated_at': datetime.now()
                    })
                    logging.info("✅ تم إنشاء إعدادات StudyBullet في MongoDB")

        except Exception as e:
            logging.error(f"خطأ في إعداد الجدولة: {e}")

    def _log_execution(self, execution_id, scraper_type, status, details=None):
        """تسجيل تفاصيل تشغيل السكرابر في قاعدة البيانات"""
        try:
            # استخدام النظام الهجين لتسجيل العمليات
            if self.db_manager:
                self.db_manager.log_execution(execution_id, scraper_type, status, details)
                logging.info(f"تم تسجيل العملية في PostgreSQL: {execution_id}")
            else:
                # العودة لـ MongoDB
                log_entry = {
                    'execution_id': execution_id,
                    'scraper_type': scraper_type,
                    'status': status,
                    'timestamp': datetime.now(),
                    'details': details or {}
                }
                self.logs_collection.insert_one(log_entry)
                logging.info(f"تم تسجيل العملية في MongoDB: {execution_id}")
            
        except Exception as e:
            logging.error(f"خطأ في تسجيل العملية: {e}")

    def get_execution_logs(self, scraper_type=None, limit=50):
        """استرجاع سجلات التشغيل للمراجعة"""
        try:
            # استخدام النظام الهجين لاسترجاع السجلات
            if self.db_manager:
                logs = self.db_manager.get_execution_logs(scraper_type, limit)
                return logs
            else:
                # العودة لـ MongoDB
                query = {}
                if scraper_type:
                    query['scraper_type'] = scraper_type
                    
                logs = list(self.logs_collection.find(query)
                           .sort('timestamp', -1)
                           .limit(limit))
                
                return logs
            
        except Exception as e:
            logging.error(f"خطأ في استرجاع السجلات: {e}")
            return []

    def clear_old_logs(self, days_to_keep=30):
        """حذف السجلات القديمة للحفاظ على مساحة قاعدة البيانات"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            result = self.logs_collection.delete_many({'timestamp': {'$lt': cutoff_date}})
            logging.info(f"تم حذف {result.deleted_count} سجل قديم")
            return result.deleted_count
            
        except Exception as e:
            logging.error(f"خطأ في حذف السجلات القديمة: {e}")
            return 0

    def load_studybullet_scraper(self):
        """تحميل سكرابر StudyBullet ديناميكياً"""
        try:
            if os.path.exists('final_studybullet_scraper.py'):
                spec = importlib.util.spec_from_file_location("studybullet", "final_studybullet_scraper.py")
                if spec and spec.loader:
                    studybullet_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(studybullet_module)
                    
                    if hasattr(studybullet_module, 'FinalStudyBulletScraper'):
                        self.studybullet_scraper = studybullet_module.FinalStudyBulletScraper()
                        logging.info("✅ تم تحميل سكرابر StudyBullet")
                        return True
            
            logging.warning("⚠️ لم يتم العثور على سكرابر StudyBullet")
            return False
            
        except Exception as e:
            logging.error(f"خطأ في تحميل سكرابر StudyBullet: {e}")
            return False

    def start_scheduler(self):
        """بدء النظام الشامل للجدولة"""
        if self.running:
            logging.info("⚠️ النظام يعمل بالفعل")
            return {'success': True, 'message': 'النظام يعمل بالفعل'}

        try:
            # تحديث حالة النظام في PostgreSQL أولاً
            if self.db_manager:
                self.db_manager.set_scheduler_setting('system_active', True)
                logging.info("✅ تم حفظ حالة التشغيل في PostgreSQL")
            
            self.running = True
            
            # تحديث حالة النظام في MongoDB
            self.update_system_status(active=True)
            
            # بدء Thread الرئيسي
            self.thread = threading.Thread(target=self._main_scheduler_loop, daemon=True)
            self.thread.start()
            
            logging.info("🚀 تم بدء نظام الجدولة المتقدم")
            return {'success': True, 'message': 'تم بدء النظام بنجاح'}
            
        except Exception as e:
            logging.error(f"خطأ في بدء النظام: {e}")
            self.running = False
            return {'success': False, 'message': f'خطأ: {str(e)}'}

    def stop_scheduler(self):
        """إيقاف النظام الشامل للجدولة"""
        try:
            # تحديث حالة النظام في PostgreSQL أولاً
            if self.db_manager:
                self.db_manager.set_scheduler_setting('system_active', False)
                logging.info("✅ تم حفظ حالة الإيقاف في PostgreSQL")
            
            self.running = False
            self.update_system_status(active=False)
            
            if self.thread and self.thread.is_alive():
                self.thread.join(timeout=3)
            
            logging.info("⏹️ تم إيقاف النظام")
            return {'success': True, 'message': 'تم إيقاف النظام بنجاح'}
            
        except Exception as e:
            logging.error(f"خطأ في إيقاف النظام: {e}")
            return {'success': False, 'message': f'خطأ: {str(e)}'}

    def _main_scheduler_loop(self):
        """الحلقة الرئيسية للجدولة"""
        logging.info("🔄 بدء الحلقة الرئيسية للجدولة")
        
        while self.running:
            try:
                current_time = datetime.now()
                
                # فحص حالة النظام من قاعدة البيانات كل دقيقة
                system_active = self._check_system_status_from_db()
                logging.debug(f"🔍 فحص حالة النظام: {system_active}")
                
                if not system_active:
                    logging.info("⏸️ النظام معطل من قاعدة البيانات - إيقاف مؤقت")
                    # انتظار 30 ثانية قبل الفحص مرة أخرى
                    for _ in range(30):
                        if not self.running:
                            break
                        time.sleep(1)
                    continue
                
                # فحص جدولة UdemyFreebies (كل دقيقة)
                self._check_udemy_schedule(current_time)
                
                # فحص جدولة StudyBullet (كل 10 دقائق)
                if current_time.minute % 10 == 0:
                    self._check_studybullet_schedule(current_time)
                
                # فحص النشر التلقائي للتليجرام (فقط إذا مفعل من لوحة التحكم)
                if current_time.second % 30 == 0:
                    # فحص الإعدادات من PostgreSQL أولاً
                    if self.db_manager:
                        auto_post_enabled = self.db_manager.get_setting('auto_telegram_post', 'false')
                        if auto_post_enabled == 'true':
                            self._check_telegram_posting(current_time)
                
                # انتظار دقيقة مع فحص التوقف
                for _ in range(60):
                    if not self.running:
                        break
                    time.sleep(1)
                    
            except Exception as e:
                logging.error(f"خطأ في الحلقة الرئيسية: {e}")
                time.sleep(60)  # انتظار دقيقة عند الخطأ
        
        logging.info("⏹️ انتهت الحلقة الرئيسية")

    def _check_system_status_from_db(self):
        """فحص حالة النظام من قاعدة البيانات PostgreSQL"""
        try:
            if self.db_manager:
                # فحص من PostgreSQL
                system_active = self.db_manager.get_scheduler_setting('system_active')
                if system_active is not None:
                    return bool(system_active)
            
            # فحص من MongoDB كبديل
            if hasattr(self, 'settings_collection') and self.settings_collection:
                settings = self.settings_collection.find_one({'name': 'system_status'})
                if settings:
                    return settings.get('active', True)
            
            # القيمة الافتراضية
            return True
            
        except Exception as e:
            logging.error(f"خطأ في فحص حالة النظام من قاعدة البيانات: {e}")
            return True  # الافتراضي: النظام نشط

    def _check_udemy_schedule(self, current_time):
        """فحص وتنفيذ جدولة UdemyFreebies"""
        try:
            settings = self.settings_collection.find_one({'name': 'udemy_scheduler'})
            if not settings or not settings.get('enabled', False):
                return

            next_run = settings.get('next_run')
            if next_run and current_time >= next_run:
                logging.info("🎯 حان وقت تشغيل UdemyFreebies")
                self._run_udemy_scraper(settings)

        except Exception as e:
            logging.error(f"خطأ في فحص جدولة UdemyFreebies: {e}")

    def _check_studybullet_schedule(self, current_time):
        """فحص وتنفيذ جدولة StudyBullet"""
        try:
            if self.db_manager:
                enabled = self.db_manager.get_scheduler_setting('studybullet_enabled')
                if not enabled:
                    return
                
                next_run = self.db_manager.get_scheduler_setting('studybullet_next_run')
                if next_run and current_time >= next_run:
                    logging.info("🎯 حان وقت تشغيل StudyBullet")
                    self._run_studybullet_scraper({})
            else:
                settings = self.settings_collection.find_one({'name': 'studybullet_scheduler'})
                if not settings or not settings.get('enabled', False):
                    return

                next_run = settings.get('next_run')
                if next_run and current_time >= next_run:
                    logging.info("🎯 حان وقت تشغيل StudyBullet")
                    self._run_studybullet_scraper(settings)

        except Exception as e:
            logging.error(f"خطأ في فحص جدولة StudyBullet: {e}")

    def _run_udemy_scraper(self, settings):
        """تشغيل سكرابر UdemyFreebies مع التحكم المتقدم بالإعدادات"""
        execution_id = f"udemy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            start_time = datetime.now()
            
            # قراءة الإعدادات الفعلية من قاعدة البيانات
            current_settings = {}
            if self.db_manager:
                max_pages = self.db_manager.get_scheduler_setting('udemy_max_pages') or 10
                timeout_minutes = self.db_manager.get_scheduler_setting('udemy_timeout_minutes') or 30
                current_settings = {'max_pages': max_pages, 'timeout_minutes': timeout_minutes}
            else:
                current_settings = self.settings_collection.find_one({'name': 'udemy_scheduler'}) or {}
                max_pages = current_settings.get('max_pages', 10)
                timeout_minutes = current_settings.get('timeout_minutes', 30)
            
            # تسجيل بداية التشغيل
            self._log_execution(execution_id, 'udemy', 'started', {
                'max_pages': max_pages,
                'timeout_minutes': timeout_minutes,
                'settings_version': current_settings.get('updated_at')
            })
            
            logging.info(f"🔄 بدء تشغيل UdemyFreebies - التنفيذ: {execution_id}")
            logging.info(f"📋 الإعدادات: {max_pages} صفحة، مهلة زمنية: {timeout_minutes} دقيقة")
            
            # تشغيل السكرابر مع الإعدادات الفعلية
            courses_found = 0
            pages_processed = 0
            
            try:
                # استخدام إعدادات مخصصة للسكرابر
                result = self.udemy_scraper.run_ultra_fast_scraper(max_pages=max_pages)
                
                # استخراج الإحصائيات من النتيجة
                if isinstance(result, dict):
                    courses_found = result.get('courses_added', 0)
                    pages_processed = result.get('pages_processed', 0)
                elif result:
                    courses_found = 1  # إذا كانت النتيجة موجودة فقط
                    
            except Exception as scraper_error:
                self._log_execution(execution_id, 'udemy', 'scraper_error', {
                    'error': str(scraper_error),
                    'pages_processed': pages_processed
                })
                raise scraper_error
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # حساب التوقيت التالي
            interval_hours = current_settings.get('interval_hours', 3)
            next_run = start_time + timedelta(hours=interval_hours)
            
            # تحديث الإحصائيات مع تفاصيل التشغيل
            runs_count = current_settings.get('runs_count', 0) + 1
            success = result is not None and courses_found >= 0
            
            execution_stats = {
                'courses_found': courses_found,
                'pages_processed': pages_processed,
                'duration_seconds': duration,
                'success_rate': (courses_found / max(pages_processed, 1)) * 100 if pages_processed > 0 else 0
            }
            
            # تحديث قاعدة البيانات مع إحصائيات مفصلة
            self.settings_collection.update_one(
                {'name': 'udemy_scheduler'},
                {
                    '$set': {
                        'last_run': start_time,
                        'next_run': next_run,
                        'runs_count': runs_count,
                        'last_result': 'نجح' if success else 'فشل',
                        'last_execution_id': execution_id,
                        'last_stats': execution_stats,
                        'updated_at': datetime.now()
                    }
                }
            )
            
            # تسجيل نهاية التشغيل
            self._log_execution(execution_id, 'udemy', 'completed', {
                'success': success,
                'courses_found': courses_found,
                'pages_processed': pages_processed,
                'duration_seconds': duration,
                'next_run': next_run.isoformat()
            })
            
            status = "✅ نجح" if success else "❌ فشل"
            logging.info(f"{status} تشغيل UdemyFreebies - {courses_found} دورة في {pages_processed} صفحة")
            logging.info(f"⏰ مدة التشغيل: {duration:.1f} ثانية - التشغيل التالي: {next_run}")
            
        except Exception as e:
            # تسجيل الخطأ
            self._log_execution(execution_id, 'udemy', 'failed', {
                'error': str(e),
                'error_type': type(e).__name__
            })
            logging.error(f"❌ خطأ في تشغيل UdemyFreebies: {e}")
            
            # تحديث حالة الفشل
            self.settings_collection.update_one(
                {'name': 'udemy_scheduler'},
                {
                    '$set': {
                        'last_result': f'فشل: {str(e)[:100]}',
                        'last_execution_id': execution_id,
                        'updated_at': datetime.now()
                    }
                }
            )

    def _run_studybullet_scraper(self, settings):
        """تشغيل سكرابر StudyBullet مع التحكم المتقدم بالإعدادات"""
        execution_id = f"studybullet_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            if not self.studybullet_scraper:
                if not self.load_studybullet_scraper():
                    self._log_execution(execution_id, 'studybullet', 'failed', {
                        'error': 'لا يمكن تحميل سكرابر StudyBullet'
                    })
                    logging.error("❌ لا يمكن تحميل سكرابر StudyBullet")
                    return

            start_time = datetime.now()
            
            # قراءة الإعدادات الفعلية من قاعدة البيانات
            current_settings = self.settings_collection.find_one({'name': 'studybullet_scheduler'}) or {}
            max_pages = current_settings.get('max_pages', 50)
            timeout_minutes = current_settings.get('timeout_minutes', 60)
            target_categories = current_settings.get('target_categories', ['free-courses'])
            
            # تسجيل بداية التشغيل
            self._log_execution(execution_id, 'studybullet', 'started', {
                'max_pages': max_pages,
                'timeout_minutes': timeout_minutes,
                'target_categories': target_categories,
                'settings_version': current_settings.get('updated_at')
            })
            
            logging.info(f"🔄 بدء تشغيل StudyBullet - التنفيذ: {execution_id}")
            logging.info(f"📋 الإعدادات: {max_pages} صفحة، مهلة زمنية: {timeout_minutes} دقيقة")
            
            # تشغيل السكرابر مع الإعدادات الفعلية
            courses_found = 0
            pages_processed = 0
            duplicates_skipped = 0
            
            try:
                # تشغيل السكرابر مع المراقبة المفصلة
                if self.studybullet_scraper:
                    # تحديث إعدادات السكرابر إذا كان يدعم ذلك
                    if hasattr(self.studybullet_scraper, 'update_settings'):
                        self.studybullet_scraper.update_settings({
                            'max_pages': max_pages,
                            'timeout_seconds': timeout_minutes * 60,
                            'target_categories': target_categories
                        })
                    
                    # تشغيل السكرابر بأفضل طريقة متاحة
                    if hasattr(self.studybullet_scraper, 'scrape_with_details'):
                        # استخدام طريقة مفصلة إذا كانت متاحة
                        result = self.studybullet_scraper.scrape_with_details(
                            max_pages=max_pages,
                            timeout_seconds=timeout_minutes * 60
                        )
                    elif hasattr(self.studybullet_scraper, 'scrape_new_courses'):
                        # استخدام الطريقة العادية
                        result = self.studybullet_scraper.scrape_new_courses(max_pages=max_pages)
                    else:
                        # تشغيل أساسي
                        result = self.studybullet_scraper.run()
                else:
                    result = None
                
                # استخراج الإحصائيات من النتيجة
                if isinstance(result, dict):
                    courses_found = result.get('courses_added', 0)
                    pages_processed = result.get('pages_processed', 0)
                    duplicates_skipped = result.get('duplicates_skipped', 0)
                elif result:
                    courses_found = 1  # إذا كانت النتيجة موجودة فقط
                    
            except Exception as scraper_error:
                self._log_execution(execution_id, 'studybullet', 'scraper_error', {
                    'error': str(scraper_error),
                    'pages_processed': pages_processed
                })
                raise scraper_error
            
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()
            
            # حساب التوقيت التالي (بالأيام)
            interval_days = current_settings.get('interval_days', 7)
            run_time = current_settings.get('run_time', '02:00')
            
            # حساب التاريخ التالي مع نفس الوقت
            next_date = start_time.date() + timedelta(days=interval_days)
            next_run = datetime.combine(next_date, datetime.strptime(run_time, '%H:%M').time())
            
            # تحديث الإحصائيات مع تفاصيل التشغيل
            runs_count = current_settings.get('runs_count', 0) + 1
            success = result is not None and courses_found >= 0
            
            execution_stats = {
                'courses_found': courses_found,
                'pages_processed': pages_processed,
                'duplicates_skipped': duplicates_skipped,
                'duration_seconds': duration,
                'success_rate': (courses_found / max(pages_processed, 1)) * 100 if pages_processed > 0 else 0,
                'efficiency': (courses_found / max(courses_found + duplicates_skipped, 1)) * 100 if (courses_found + duplicates_skipped) > 0 else 0
            }
            
            # تحديث قاعدة البيانات مع إحصائيات مفصلة
            self.settings_collection.update_one(
                {'name': 'studybullet_scheduler'},
                {
                    '$set': {
                        'last_run': start_time,
                        'next_run': next_run,
                        'runs_count': runs_count,
                        'last_result': 'نجح' if success else 'فشل',
                        'last_execution_id': execution_id,
                        'last_stats': execution_stats,
                        'updated_at': datetime.now()
                    }
                }
            )
            
            # تسجيل نهاية التشغيل
            self._log_execution(execution_id, 'studybullet', 'completed', {
                'success': success,
                'courses_found': courses_found,
                'pages_processed': pages_processed,
                'duplicates_skipped': duplicates_skipped,
                'duration_seconds': duration,
                'next_run': next_run.isoformat()
            })
            
            status = "✅ نجح" if success else "❌ فشل"
            logging.info(f"{status} تشغيل StudyBullet - {courses_found} دورة جديدة، {duplicates_skipped} مكررة")
            logging.info(f"📊 {pages_processed} صفحة في {duration:.1f} ثانية - التشغيل التالي: {next_run}")
            
        except Exception as e:
            # تسجيل الخطأ
            self._log_execution(execution_id, 'studybullet', 'failed', {
                'error': str(e),
                'error_type': type(e).__name__
            })
            logging.error(f"❌ خطأ في تشغيل StudyBullet: {e}")
            
            # تحديث حالة الفشل
            self.settings_collection.update_one(
                {'name': 'studybullet_scheduler'},
                {
                    '$set': {
                        'last_result': f'فشل: {str(e)[:100]}',
                        'last_execution_id': execution_id,
                        'updated_at': datetime.now()
                    }
                }
            )

    def _check_telegram_posting(self, current_time):
        """فحص وتشغيل النشر التلقائي للتليجرام"""
        try:
            # فحص إعدادات النشر التلقائي من PostgreSQL
            if self.db_manager:
                auto_post_enabled = self.db_manager.get_setting('auto_post_enabled')
                if auto_post_enabled != 'true':
                    return
                
                # البحث عن دورة غير منشورة
                course_to_post = self._find_next_course_to_post()
                if not course_to_post:
                    return
                
                # تشغيل النشر
                self._post_course_to_telegram(course_to_post)
                
        except Exception as e:
            logging.error(f"خطأ في فحص النشر التلقائي للتليجرام: {e}")

    def _find_next_course_to_post(self):
        """البحث عن دورة غير منشورة للنشر (أولوية لـ UdemyFreebies)"""
        try:
            # أولوية لدورات UdemyFreebies
            udemy_course = self.db.courses.find_one(
                {'telegram_posted': {'$ne': True}},
                sort=[('created_at', 1)]
            )
            if udemy_course:
                return {'course': udemy_course, 'source': 'udemy'}
            
            # إذا لم توجد دورات UdemyFreebies، استخدم StudyBullet
            studybullet_course = self.db.free_courses.find_one(
                {'telegram_posted': {'$ne': True}},
                sort=[('created_at', 1)]
            )
            if studybullet_course:
                return {'course': studybullet_course, 'source': 'studybullet'}
            
            # إذا انتهت جميع الدورات، إعادة تدوير StudyBullet
            recycled_course = self.db.free_courses.find_one(
                {'telegram_posted': True},
                sort=[('telegram_posted_at', 1)]
            )
            if recycled_course:
                return {'course': recycled_course, 'source': 'studybullet_recycled'}
            
            return None
            
        except Exception as e:
            logging.error(f"خطأ في البحث عن دورة للنشر: {e}")
            return None

    def _post_course_to_telegram(self, course_data):
        """نشر دورة في التليجرام"""
        try:
            from telegram_bot_updated import TelegramBot
            
            course = course_data['course']
            source = course_data['source']
            
            # تهيئة بوت التليجرام
            telegram_bot = TelegramBot()
            
            # نشر الدورة باستخدام الوظيفة الصحيحة
            success = telegram_bot.send_course_to_all_channels(course, source)
            
            if success:
                # تحديث حالة النشر
                collection = self.db.courses if 'udemy' in source else self.db.free_courses
                update_data = {
                    'telegram_posted': True,
                    'telegram_posted_at': datetime.now()
                }
                
                # في حالة إعادة التدوير، إضافة عداد
                if 'recycled' in source:
                    recycling_count = course.get('recycling_count', 0) + 1
                    update_data['recycling_count'] = recycling_count
                
                collection.update_one(
                    {'_id': course['_id']},
                    {'$set': update_data}
                )
                
                # تسجيل النشر
                if self.db_manager:
                    self.db_manager.log_execution(
                        f"telegram_post_{datetime.now().timestamp()}",
                        'telegram_posting',
                        'success',
                        {
                            'course_title': course.get('title', 'Unknown'),
                            'source': source,
                            'course_id': str(course['_id'])
                        }
                    )
                
                logging.info(f"✅ تم نشر دورة في التليجرام: {course.get('title', 'Unknown')[:50]}...")
            else:
                logging.warning(f"⚠️ فشل نشر دورة في التليجرام: {course.get('title', 'Unknown')[:50]}...")
                
        except Exception as e:
            logging.error(f"خطأ في نشر دورة في التليجرام: {e}")

    def update_system_status(self, active=None):
        """تحديث حالة النظام العامة"""
        try:
            update_data = {'updated_at': datetime.now()}
            if active is not None:
                update_data['active'] = active
                self.running = active

            self.settings_collection.update_one(
                {'name': 'advanced_scheduler'},
                {'$set': update_data},
                upsert=True
            )
        except Exception as e:
            logging.error(f"خطأ في تحديث حالة النظام: {e}")

    def get_system_status(self):
        """الحصول على حالة النظام الشاملة"""
        try:
            # حالة النظام العامة
            system_status = self.settings_collection.find_one({'name': 'advanced_scheduler'}) or {}
            
            # إعدادات UdemyFreebies
            udemy_settings = self.settings_collection.find_one({'name': 'udemy_scheduler'}) or {}
            
            # إعدادات StudyBullet
            studybullet_settings = self.settings_collection.find_one({'name': 'studybullet_scheduler'}) or {}
            
            return {
                'system_active': system_status.get('active', False) and self.running,
                'thread_alive': self.thread.is_alive() if self.thread else False,
                'udemy': {
                    'enabled': udemy_settings.get('enabled', False),
                    'interval_hours': udemy_settings.get('interval_hours', 3),
                    'last_run': udemy_settings.get('last_run'),
                    'next_run': udemy_settings.get('next_run'),
                    'runs_count': udemy_settings.get('runs_count', 0),
                    'last_result': udemy_settings.get('last_result', 'لم يتم التشغيل بعد')
                },
                'studybullet': {
                    'enabled': studybullet_settings.get('enabled', False),
                    'interval_days': studybullet_settings.get('interval_days', 7),
                    'run_time': studybullet_settings.get('run_time', '02:00'),
                    'last_run': studybullet_settings.get('last_run'),
                    'next_run': studybullet_settings.get('next_run'),
                    'runs_count': studybullet_settings.get('runs_count', 0),
                    'max_pages': studybullet_settings.get('max_pages', 50),
                    'last_result': studybullet_settings.get('last_result', 'لم يتم التشغيل بعد')
                }
            }
            
        except Exception as e:
            logging.error(f"خطأ في الحصول على حالة النظام: {e}")
            return {
                'system_active': False,
                'thread_alive': False,
                'udemy': {},
                'studybullet': {}
            }

    def update_udemy_settings(self, interval_hours, enabled=True):
        """تحديث إعدادات UdemyFreebies"""
        try:
            interval_hours = max(1, min(24, int(interval_hours)))
            
            # حساب التوقيت التالي
            next_run = datetime.now() + timedelta(hours=interval_hours) if enabled else None
            
            result = self.settings_collection.update_one(
                {'name': 'udemy_scheduler'},
                {
                    '$set': {
                        'enabled': enabled,
                        'interval_hours': interval_hours,
                        'next_run': next_run,
                        'updated_at': datetime.now()
                    }
                },
                upsert=True
            )
            
            return result.modified_count > 0 or result.upserted_id
            
        except Exception as e:
            logging.error(f"خطأ في تحديث إعدادات UdemyFreebies: {e}")
            return False

    def update_studybullet_settings(self, interval_days, run_time, max_pages=50, enabled=True):
        """تحديث إعدادات StudyBullet"""
        try:
            interval_days = max(1, min(30, int(interval_days)))
            max_pages = max(10, min(200, int(max_pages)))
            
            # التحقق من صيغة الوقت
            datetime.strptime(run_time, '%H:%M')
            
            # حساب التوقيت التالي
            if enabled:
                next_date = datetime.now().date() + timedelta(days=interval_days)
                next_run = datetime.combine(next_date, datetime.strptime(run_time, '%H:%M').time())
            else:
                next_run = None
            
            result = self.settings_collection.update_one(
                {'name': 'studybullet_scheduler'},
                {
                    '$set': {
                        'enabled': enabled,
                        'interval_days': interval_days,
                        'run_time': run_time,
                        'max_pages': max_pages,
                        'next_run': next_run,
                        'updated_at': datetime.now()
                    }
                },
                upsert=True
            )
            
            return result.modified_count > 0 or result.upserted_id
            
        except Exception as e:
            logging.error(f"خطأ في تحديث إعدادات StudyBullet: {e}")
            return False

# مثيل عام للنظام المتقدم
_advanced_scheduler = None
_lock = threading.Lock()

def get_advanced_scheduler():
    """الحصول على مثيل النظام المتقدم"""
    global _advanced_scheduler
    with _lock:
        if _advanced_scheduler is None:
            _advanced_scheduler = AdvancedScheduler()
        return _advanced_scheduler

# وظائف عامة للتحكم في النظام
def start_advanced_scheduler():
    """بدء النظام المتقدم"""
    scheduler = get_advanced_scheduler()
    return scheduler.start_scheduler()

def stop_advanced_scheduler():
    """إيقاف النظام المتقدم"""
    scheduler = get_advanced_scheduler()
    return scheduler.stop_scheduler()

def get_advanced_status():
    """الحصول على حالة النظام المتقدم"""
    scheduler = get_advanced_scheduler()
    return scheduler.get_system_status()

def update_udemy_schedule(interval_hours, enabled=True):
    """تحديث جدولة UdemyFreebies"""
    scheduler = get_advanced_scheduler()
    return scheduler.update_udemy_settings(interval_hours, enabled)

def update_studybullet_schedule(interval_days, run_time, max_pages=50, enabled=True):
    """تحديث جدولة StudyBullet"""
    scheduler = get_advanced_scheduler()
    return scheduler.update_studybullet_settings(interval_days, run_time, max_pages, enabled)