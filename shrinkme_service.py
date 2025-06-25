"""
ShrinkMe URL Shortening Service Integration
نظام دمج خدمة ShrinkMe لاختصار الروابط والربح
"""

import requests
import os
import json
import hashlib
from datetime import datetime
from pymongo import MongoClient

class ShrinkMeService:
    def __init__(self):
        """تهيئة خدمة ShrinkMe"""
        self.api_key = "0440815b0b1bee2b9f45961760d3e364fca5067b"
        self.api_url = "https://shrinkme.io/api"
        
        # اتصال قاعدة البيانات
        MONGO_URI = os.getenv('MONGO_URI', 'mongodb+srv://6_u6:Ah251403@coursegem.x2dq25t.mongodb.net/?retryWrites=true&w=majority&appName=CourseGem')
        client = MongoClient(MONGO_URI)
        self.db = client.coursegem
        self.shortened_links = self.db.shortened_links
        
        # إنشاء فهرس للروابط الأصلية لتسريع البحث
        self.shortened_links.create_index("original_url")
        
    def shorten_url(self, original_url, custom_alias=None):
        """اختصار رابط باستخدام ShrinkMe API"""
        try:
            # فحص إذا كان الرابط موجود مسبقاً
            existing_link = self.shortened_links.find_one({"original_url": original_url})
            if existing_link:
                return {
                    "success": True,
                    "shortened_url": existing_link["shortened_url"],
                    "original_url": original_url,
                    "cached": True
                }
            
            # تحضير البيانات للـ API
            params = {
                "api": self.api_key,
                "url": original_url
            }
            
            # إضافة alias مخصص إذا توفر
            if custom_alias:
                params["alias"] = custom_alias
            
            # إرسال طلب لـ ShrinkMe API
            response = requests.get(self.api_url, params=params, timeout=10)
            
            if response.status_code == 200:
                try:
                    # محاولة قراءة استجابة JSON
                    result = response.json()
                    
                    if result.get("status") == "success":
                        shortened_url = result.get("shortenedUrl")
                        
                        # حفظ الرابط في قاعدة البيانات
                        link_data = {
                            "original_url": original_url,
                            "shortened_url": shortened_url,
                            "custom_alias": custom_alias,
                            "created_at": datetime.utcnow(),
                            "click_count": 0,
                            "api_response": result
                        }
                        
                        self.shortened_links.insert_one(link_data)
                        
                        return {
                            "success": True,
                            "shortened_url": shortened_url,
                            "original_url": original_url,
                            "cached": False
                        }
                    else:
                        return {
                            "success": False,
                            "error": result.get("message", "Unknown API error"),
                            "original_url": original_url
                        }
                        
                except json.JSONDecodeError:
                    # إذا لم تكن الاستجابة JSON، قد تكون نص
                    shortened_url = response.text.strip()
                    if shortened_url.startswith("http"):
                        # حفظ الرابط
                        link_data = {
                            "original_url": original_url,
                            "shortened_url": shortened_url,
                            "custom_alias": custom_alias,
                            "created_at": datetime.utcnow(),
                            "click_count": 0,
                            "api_response": {"text_response": shortened_url}
                        }
                        
                        self.shortened_links.insert_one(link_data)
                        
                        return {
                            "success": True,
                            "shortened_url": shortened_url,
                            "original_url": original_url,
                            "cached": False
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"Invalid response: {shortened_url}",
                            "original_url": original_url
                        }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "original_url": original_url
                }
                
        except requests.RequestException as e:
            return {
                "success": False,
                "error": f"Network error: {str(e)}",
                "original_url": original_url
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "original_url": original_url
            }
    
    def get_shortened_link(self, original_url):
        """الحصول على الرابط المختصر من قاعدة البيانات"""
        link_data = self.shortened_links.find_one({"original_url": original_url})
        if link_data:
            return link_data["shortened_url"]
        return None
    
    def track_click(self, original_url):
        """تسجيل نقرة على الرابط"""
        try:
            self.shortened_links.update_one(
                {"original_url": original_url},
                {"$inc": {"click_count": 1}}
            )
        except Exception as e:
            print(f"Error tracking click: {e}")
    
    def get_link_stats(self):
        """الحصول على إحصائيات الروابط"""
        try:
            total_links = self.shortened_links.count_documents({})
            total_clicks = sum([link.get("click_count", 0) for link in self.shortened_links.find({})])
            
            return {
                "total_links": total_links,
                "total_clicks": total_clicks
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {"total_links": 0, "total_clicks": 0}
    
    def generate_course_alias(self, course_title, course_id):
        """توليد alias مخصص للدورة"""
        try:
            # تنظيف عنوان الدورة
            clean_title = ''.join(c for c in course_title if c.isalnum() or c in ' -_')
            words = clean_title.split()[:3]  # أول 3 كلمات
            alias = '-'.join(words).lower()
            
            # إضافة معرف الدورة للتفرد
            alias = f"{alias}-{course_id}"
            
            # تحديد الطول (ShrinkMe قد يكون له حد أقصى)
            if len(alias) > 20:
                alias = alias[:20]
            
            return alias
        except Exception:
            # في حالة الخطأ، استخدم معرف الدورة فقط
            return f"course-{course_id}"

# إنشاء مثيل خدمة ShrinkMe
shrinkme_service = ShrinkMeService()

def shorten_course_url(original_url, course_title=None, course_id=None):
    """دالة مساعدة لاختصار روابط الدورات"""
    custom_alias = None
    
    if course_title and course_id:
        custom_alias = shrinkme_service.generate_course_alias(course_title, course_id)
    
    return shrinkme_service.shorten_url(original_url, custom_alias)

def get_or_create_shortened_url(original_url, course_title=None, course_id=None):
    """الحصول على رابط مختصر أو إنشاء واحد جديد"""
    # فحص إذا كان موجود
    existing_url = shrinkme_service.get_shortened_link(original_url)
    if existing_url:
        shrinkme_service.track_click(original_url)
        return existing_url
    
    # إنشاء رابط جديد
    result = shorten_course_url(original_url, course_title, course_id)
    if result["success"]:
        shrinkme_service.track_click(original_url)
        return result["shortened_url"]
    else:
        print(f"Failed to shorten URL: {result['error']}")
        return original_url  # إرجاع الرابط الأصلي في حالة الفشل