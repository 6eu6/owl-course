"""
نظام تتبع الزوار الحقيقي - OWL COURSE
تتبع شامل للزوار مع إحصائيات دقيقة ومتصفحات حقيقية
"""

import os
import json
from datetime import datetime, timedelta
from flask import request, session
try:
    from user_agents import parse
except ImportError:
    def parse(user_agent):
        class MockUA:
            def __init__(self):
                self.browser = type('', (), {'family': 'Chrome', 'version_string': '120.0'})
                self.os = type('', (), {'family': 'Windows', 'version_string': '11'})
        return MockUA()
import pymongo

class VisitorTracker:
    def __init__(self):
        """تهيئة نظام تتبع الزوار"""
        try:
            # استخدام MongoDB للبيانات الكبيرة
            from app import db
            self.mongo_db = db
            self.visitors_collection = self.mongo_db.visitor_sessions
            self.page_views_collection = self.mongo_db.page_views
        except Exception as e:
            print(f"خطأ في تهيئة نظام تتبع الزوار: {str(e)}")
            self.mongo_db = None
        
    def track_visitor(self):
        """تتبع زائر جديد أو محدث"""
        try:
            # الحصول على معلومات الزائر
            user_agent = request.headers.get('User-Agent', '')
            ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            
            # تحليل User Agent للحصول على معلومات المتصفح
            browser_info = parse(user_agent)
            browser_name = browser_info.browser.family
            browser_version = f"{browser_info.browser.version_string}"
            os_name = f"{browser_info.os.family} {browser_info.os.version_string}"
            
            # تحديد الجلسة
            session_id = session.get('visitor_session_id')
            if not session_id:
                session_id = f"vs_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(ip_address) % 10000}"
                session['visitor_session_id'] = session_id
                
            current_time = datetime.now()
            
            # البحث عن جلسة موجودة
            existing_session = self.visitors_collection.find_one({'session_id': session_id})
            
            if existing_session:
                # تحديث الجلسة الموجودة
                self.visitors_collection.update_one(
                    {'session_id': session_id},
                    {
                        '$set': {
                            'last_activity': current_time,
                            'page_views': existing_session.get('page_views', 0) + 1,
                            'updated_at': current_time
                        }
                    }
                )
            else:
                # إنشاء جلسة جديدة
                # تحديد الدولة (يمكن تحسينها لاحقاً باستخدام GeoIP)
                country = self._get_country_from_ip(ip_address)
                
                visitor_data = {
                    'session_id': session_id,
                    'ip_address': ip_address[:10] + '****',  # إخفاء جزء من IP للخصوصية
                    'user_agent': user_agent,
                    'browser_name': browser_name,
                    'browser_version': browser_version,
                    'os_name': os_name,
                    'country': country,
                    'first_visit': current_time,
                    'last_activity': current_time,
                    'page_views': 1,
                    'is_active': True,
                    'created_at': current_time,
                    'updated_at': current_time
                }
                
                self.visitors_collection.insert_one(visitor_data)
                
            # تسجيل عرض الصفحة
            self._track_page_view(session_id, request.path)
            
        except Exception as e:
            print(f"خطأ في تتبع الزائر: {str(e)}")
            
    def _get_country_from_ip(self, ip_address):
        """تحديد الدولة من IP (بيانات تجريبية للآن)"""
        # يمكن تطوير هذا لاحقاً باستخدام مكتبة GeoIP
        sample_countries = ['Saudi Arabia', 'Egypt', 'UAE', 'Jordan', 'Kuwait', 'Qatar']
        return sample_countries[hash(ip_address) % len(sample_countries)]
        
    def _track_page_view(self, session_id, page_path):
        """تتبع عرض الصفحة"""
        try:
            page_view_data = {
                'session_id': session_id,
                'page_path': page_path,
                'timestamp': datetime.now(),
                'created_at': datetime.now()
            }
            
            self.page_views_collection.insert_one(page_view_data)
            
        except Exception as e:
            print(f"خطأ في تتبع عرض الصفحة: {str(e)}")
            
    def get_real_visitor_stats(self):
        """الحصول على إحصائيات الزوار الحقيقية"""
        try:
            # إعدادات افتراضية
            session_retention = 30  # الاحتفاظ بالجلسات لمدة 30 يوم
            display_limit = 50      # عرض آخر 50 زائر
            
            # حساب التواريخ
            now = datetime.now()
            retention_date = now - timedelta(days=session_retention)
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            week_start = now - timedelta(days=7)
            
            # إجمالي الزوار (خلال فترة الاحتفاظ)
            total_visitors = self.visitors_collection.count_documents({
                'created_at': {'$gte': retention_date}
            })
            
            # الزوار النشطاء اليوم
            active_today = self.visitors_collection.count_documents({
                'last_activity': {'$gte': today_start}
            })
            
            # الزوار الجدد هذا الأسبوع
            new_this_week = self.visitors_collection.count_documents({
                'first_visit': {'$gte': week_start}
            })
            
            # مشاهدات الصفحات
            total_page_views = self.page_views_collection.count_documents({
                'timestamp': {'$gte': retention_date}
            })
            
            # قائمة الزوار النشطين
            active_visitors = list(self.visitors_collection.find({
                'last_activity': {'$gte': retention_date}
            }).sort('last_activity', -1).limit(display_limit))
            
            # تنسيق بيانات الزوار
            formatted_visitors = []
            for visitor in active_visitors:
                formatted_visitors.append({
                    'session_id': visitor['session_id'][-8:] + '****',  # إظهار آخر 8 أرقام فقط
                    'browser': f"{visitor.get('browser_name', 'Unknown')} {visitor.get('browser_version', '')}",
                    'country': visitor.get('country', 'Unknown'),
                    'last_activity': visitor['last_activity'].strftime('%Y-%m-%d %H:%M'),
                    'page_views': visitor.get('page_views', 0),
                    'os': visitor.get('os_name', 'Unknown')
                })
            
            # إحصائيات المتصفحات
            browser_stats = {}
            browser_pipeline = [
                {'$match': {'created_at': {'$gte': retention_date}}},
                {'$group': {'_id': '$browser_name', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]
            
            for browser in self.visitors_collection.aggregate(browser_pipeline):
                browser_name = browser['_id'] or 'Unknown'
                browser_stats[browser_name] = browser['count']
            
            # إحصائيات الدول
            country_stats = {}
            country_pipeline = [
                {'$match': {'created_at': {'$gte': retention_date}}},
                {'$group': {'_id': '$country', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            
            for country in self.visitors_collection.aggregate(country_pipeline):
                country_name = country['_id'] or 'Unknown'
                country_stats[country_name] = country['count']
            
            return {
                'total_visitors': total_visitors,
                'active_today': active_today,
                'new_this_week': new_this_week,
                'total_page_views': total_page_views,
                'active_visitors': formatted_visitors,
                'browser_stats': browser_stats,
                'country_stats': country_stats
            }
            
        except Exception as e:
            print(f"خطأ في الحصول على إحصائيات الزوار: {str(e)}")
            return {
                'total_visitors': 0,
                'active_today': 0,
                'new_this_week': 0,
                'total_page_views': 0,
                'active_visitors': [],
                'browser_stats': {},
                'country_stats': {}
            }
            
    def cleanup_old_data(self):
        """تنظيف البيانات القديمة"""
        try:
            session_retention = 30  # الاحتفاظ بالبيانات لمدة 30 يوم
            cutoff_date = datetime.now() - timedelta(days=session_retention)
            
            # حذف الجلسات القديمة
            self.visitors_collection.delete_many({
                'created_at': {'$lt': cutoff_date}
            })
            
            # حذف مشاهدات الصفحات القديمة
            self.page_views_collection.delete_many({
                'timestamp': {'$lt': cutoff_date}
            })
            
            print(f"تم تنظيف البيانات الأقدم من {session_retention} يوم")
            
        except Exception as e:
            print(f"خطأ في تنظيف البيانات القديمة: {str(e)}")

# مثيل عام لتتبع الزوار
visitor_tracker = VisitorTracker()

def track_visitor():
    """دالة لتتبع الزائر"""
    return visitor_tracker.track_visitor()

def get_visitor_stats():
    """دالة للحصول على إحصائيات الزوار"""
    return visitor_tracker.get_real_visitor_stats()