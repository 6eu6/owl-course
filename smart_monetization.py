"""
Smart Monetization System - نظام الربح الذكي
يوازن بين ShrinkMe وAdSense لتحسين تجربة المستخدم والربح
"""

import os
import random
from datetime import datetime, timedelta
from pymongo import MongoClient
from shrinkme_service import ShrinkMeService

class SmartMonetization:
    def __init__(self):
        """تهيئة النظام الذكي للربح"""
        DATABASE_URL = os.getenv('DATABASE_URL', 'mongodb+srv://6_u6:Ah251403@coursegem.x2dq25t.mongodb.net/?retryWrites=true&w=majority&appName=CourseGem')
        client = MongoClient(DATABASE_URL)
        self.db = client.coursegem
        self.settings = self.db.settings
        self.user_sessions = self.db.user_sessions
        
        # إعدادات النظام الذكي
        self.init_smart_settings()
        
    def init_smart_settings(self):
        """إعداد الإعدادات الافتراضية للنظام الذكي"""
        # فحص الإعدادات الموجودة
        existing = self.settings.find_one({"_id": "smart_monetization"})
        if not existing:
            default_settings = {
                "_id": "smart_monetization",
                "enabled": True,
                "shrinkme_percentage": 30,  # نسبة استخدام ShrinkMe (30% من الروابط)
                "direct_link_percentage": 70,  # نسبة الروابط المباشرة (70%)
                "high_value_courses_only": True,  # فقط للدورات عالية القيمة
                "exclude_mobile": False,  # استثناء المحمول
                "min_page_views": 3,  # الحد الأدنى لمشاهدات الصفحة قبل ShrinkMe
                "cooldown_hours": 24,  # فترة الانتظار بين استخدامات ShrinkMe للمستخدم الواحد
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            
            self.settings.insert_one(default_settings)
    
    def should_use_shrinkme(self, user_ip, course_data, user_agent=None):
        """تحديد ما إذا كان يجب استخدام ShrinkMe أم لا"""
        settings = self.get_settings()
        
        # فحص إذا كان النظام مفعل - هذا هو الأهم
        if not settings.get("enabled", True):
            return False
        
        # فحص المحمول إذا كان مستثنى
        if settings.get("exclude_mobile", False) and user_agent:
            mobile_indicators = ["Mobile", "Android", "iPhone", "iPad"]
            if any(indicator in user_agent for indicator in mobile_indicators):
                return False
        
        # فحص إذا كان المستخدم في فترة الانتظار
        if self.is_user_in_cooldown(user_ip, settings.get("cooldown_hours", 24)):
            return False
        
        # فحص عدد مشاهدات الصفحة للمستخدم
        page_views = self.get_user_page_views(user_ip)
        if page_views < settings.get("min_page_views", 3):
            return False
        
        # فحص إذا كانت الدورة عالية القيمة
        if settings.get("high_value_courses_only", True):
            if not self.is_high_value_course(course_data):
                return False
        
        # قرار عشوائي بناءً على النسبة المحددة
        shrinkme_percentage = settings.get("shrinkme_percentage", 30)
        return random.randint(1, 100) <= shrinkme_percentage
    
    def is_high_value_course(self, course_data):
        """تحديد إذا كانت الدورة عالية القيمة"""
        # معايير الدورة عالية القيمة
        high_value_indicators = [
            course_data.get("rating", 0) >= 4.0,  # تقييم عالي
            course_data.get("students_count", 0) >= 1000,  # عدد طلاب كبير
            course_data.get("price_value", 0) >= 50,  # سعر أصلي عالي
            "bestseller" in course_data.get("title", "").lower(),
            "advanced" in course_data.get("title", "").lower(),
            "professional" in course_data.get("title", "").lower(),
        ]
        
        # يجب تحقيق معيارين على الأقل
        return sum(high_value_indicators) >= 2
    
    def is_user_in_cooldown(self, user_ip, cooldown_hours):
        """فحص إذا كان المستخدم في فترة الانتظار"""
        cutoff_time = datetime.now() - timedelta(hours=cooldown_hours)
        recent_usage = self.user_sessions.find_one({
            "user_ip": user_ip,
            "shrinkme_used": True,
            "timestamp": {"$gte": cutoff_time}
        })
        return recent_usage is not None
    
    def get_user_page_views(self, user_ip):
        """حساب عدد مشاهدات الصفحة للمستخدم"""
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        views = self.user_sessions.count_documents({
            "user_ip": user_ip,
            "timestamp": {"$gte": today}
        })
        return views
    
    def track_user_interaction(self, user_ip, course_id, action, shrinkme_used=False):
        """تتبع تفاعل المستخدم"""
        self.user_sessions.insert_one({
            "user_ip": user_ip,
            "course_id": course_id,
            "action": action,
            "shrinkme_used": shrinkme_used,
            "timestamp": datetime.now()
        })
    
    def get_smart_link(self, user_ip, course_data, user_agent=None):
        """الحصول على الرابط الذكي (ShrinkMe أو مباشر)"""
        course_id = str(course_data.get("_id", ""))
        
        # تسجيل زيارة الصفحة
        self.track_user_interaction(user_ip, course_id, "page_view")
        
        # تحديد نوع الرابط
        use_shrinkme = self.should_use_shrinkme(user_ip, course_data, user_agent)
        
        if use_shrinkme:
            # استخدام ShrinkMe
            shrinkme_service = ShrinkMeService()
            original_url = self.get_course_url(course_data)
            
            result = shrinkme_service.shorten_url(original_url)
            
            if result.get("success"):
                # تسجيل استخدام ShrinkMe
                self.track_user_interaction(user_ip, course_id, "shrinkme_redirect", True)
                
                return {
                    "type": "shrinkme",
                    "url": result["shortened_url"],
                    "original_url": original_url,
                    "monetized": True
                }
        
        # استخدام الرابط المباشر
        original_url = self.get_course_url(course_data)
        self.track_user_interaction(user_ip, course_id, "direct_redirect", False)
        
        return {
            "type": "direct",
            "url": original_url,
            "original_url": original_url,
            "monetized": False
        }
    
    def get_course_url(self, course_data):
        """الحصول على رابط الدورة النهائي"""
        if course_data.get('udemy_url') and course_data.get('coupon_code'):
            udemy_url = course_data['udemy_url']
            coupon_code = course_data['coupon_code']
            separator = '&' if '?' in udemy_url else '?'
            return f"{udemy_url}{separator}couponCode={coupon_code}"
        
        return course_data.get('udemy_url') or course_data.get('course_url', '')
    
    def get_settings(self):
        """الحصول على إعدادات النظام الذكي من إعدادات الإعلانات"""
        try:
            # استخدام اتصال MongoDB الموجود
            from main import db
            settings_doc = db.settings.find_one({"type": "ads_settings"})
            
            if settings_doc and "settings" in settings_doc:
                ads_settings = settings_doc["settings"]
                
                # تحويل إعدادات الإعلانات إلى إعدادات النظام الذكي
                smart_settings = {
                    "enabled": ads_settings.get("shrinkme_enabled", True),
                    "shrinkme_percentage": ads_settings.get("shrinkme_percentage", 30),
                    "high_value_courses_only": ads_settings.get("smart_targeting", True),
                    "exclude_mobile": ads_settings.get("mobile_strategy", "reduced_shrinkme") == "no_shrinkme",
                    "min_page_views": ads_settings.get("min_page_views", 2),
                    "cooldown_hours": ads_settings.get("cooldown_hours", 24)
                }
                
                print(f"Smart monetization settings loaded: enabled={smart_settings['enabled']}, percentage={smart_settings['shrinkme_percentage']}")
                return smart_settings
            else:
                print("No ads settings found, using default settings")
                default_settings = {
                    "enabled": True,
                    "shrinkme_percentage": 30,
                    "high_value_courses_only": True,
                    "exclude_mobile": False,
                    "min_page_views": 2,
                    "cooldown_hours": 24
                }
                return default_settings
                
        except Exception as e:
            print(f"Error loading smart monetization settings: {e}")
            default_settings = {
                "enabled": True,
                "shrinkme_percentage": 30,
                "high_value_courses_only": True,
                "exclude_mobile": False,
                "min_page_views": 2,
                "cooldown_hours": 24
            }
            return default_settings
    
    def update_settings(self, new_settings):
        """تحديث إعدادات النظام الذكي"""
        new_settings["updated_at"] = datetime.now()
        self.settings.update_one(
            {"_id": "smart_monetization"},
            {"$set": new_settings},
            upsert=True
        )
    
    def get_analytics(self):
        """إحصائيات النظام الذكي بناءً على البيانات الفعلية"""
        try:
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            week_ago = today - timedelta(days=7)
            month_ago = today - timedelta(days=30)
            
            # الحصول على الإعدادات الحالية
            settings = self.get_settings()
            
            # إحصائيات اليوم الفعلية
            today_total = self.user_sessions.count_documents({
                "timestamp": {"$gte": today}
            })
            
            today_shrinkme = self.user_sessions.count_documents({
                "timestamp": {"$gte": today},
                "shrinkme_used": True
            })
            
            # إحصائيات الأسبوع الفعلية
            week_total = self.user_sessions.count_documents({
                "timestamp": {"$gte": week_ago}
            })
            
            week_shrinkme = self.user_sessions.count_documents({
                "timestamp": {"$gte": week_ago},
                "shrinkme_used": True
            })
            
            # إحصائيات الشهر الفعلية
            month_total = self.user_sessions.count_documents({
                "timestamp": {"$gte": month_ago}
            })
            
            month_shrinkme = self.user_sessions.count_documents({
                "timestamp": {"$gte": month_ago},
                "shrinkme_used": True
            })
            
            # حساب النسب الفعلية
            today_shrinkme_rate = (today_shrinkme / today_total * 100) if today_total > 0 else 0
            week_shrinkme_rate = (week_shrinkme / week_total * 100) if week_total > 0 else 0
            month_shrinkme_rate = (month_shrinkme / month_total * 100) if month_total > 0 else 0
            
            # إحصائيات اليوم
            today_stats = {
                "total_interactions": today_total,
                "shrinkme_uses": today_shrinkme,
                "direct_links": today_total - today_shrinkme,
                "shrinkme_rate": round(today_shrinkme_rate, 1)
            }
            
            # إحصائيات الأسبوع
            week_stats = {
                "total_interactions": week_total,
                "shrinkme_uses": week_shrinkme,
                "direct_links": week_total - week_shrinkme,
                "shrinkme_rate": round(week_shrinkme_rate, 1)
            }
            
            # إحصائيات الشهر
            month_stats = {
                "total_interactions": month_total,
                "shrinkme_uses": month_shrinkme,
                "direct_links": month_total - month_shrinkme,
                "shrinkme_rate": round(month_shrinkme_rate, 1)
            }
            
            # إحصائيات متقدمة
            unique_users_today = len(self.user_sessions.distinct("user_ip", {
                "timestamp": {"$gte": today}
            }))
            
            unique_users_week = len(self.user_sessions.distinct("user_ip", {
                "timestamp": {"$gte": week_ago}
            }))
            
            # حساب معدل التحويل
            conversion_rate = round(today_shrinkme_rate, 2) if today_total > 0 else 0
            target_rate = settings.get("shrinkme_percentage", 30)
            performance_score = round((conversion_rate / target_rate * 100), 1) if target_rate > 0 else 0
            
            return {
                "settings": settings,
                "today": today_stats,
                "week": week_stats,
                "month": month_stats,
                "advanced": {
                    "unique_users_today": unique_users_today,
                    "unique_users_week": unique_users_week,
                    "conversion_rate": conversion_rate,
                    "target_rate": target_rate,
                    "performance_score": min(performance_score, 100),
                    "system_health": "Active" if settings.get("enabled", True) else "Disabled"
                },
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
        except Exception as e:
            # في حالة خطأ، عرض بيانات أساسية
            settings = self.get_settings()
            return {
                "settings": settings,
                "today": {"total_interactions": 0, "shrinkme_uses": 0, "direct_links": 0, "shrinkme_rate": 0},
                "week": {"total_interactions": 0, "shrinkme_uses": 0, "direct_links": 0, "shrinkme_rate": 0},
                "month": {"total_interactions": 0, "shrinkme_uses": 0, "direct_links": 0, "shrinkme_rate": 0},
                "advanced": {
                    "unique_users_today": 0,
                    "unique_users_week": 0,
                    "conversion_rate": 0,
                    "target_rate": settings.get("shrinkme_percentage", 30),
                    "performance_score": 0,
                    "system_health": "Error" 
                },
                "error": str(e),
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

# Standalone functions for easy import
def get_smart_course_link(user_ip, course_data, user_agent=None):
    """الحصول على رابط ذكي للدورة"""
    smart_system = SmartMonetization()
    return smart_system.get_smart_link(user_ip, course_data, user_agent)