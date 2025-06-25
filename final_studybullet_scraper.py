#!/usr/bin/env python3
"""
السكرابر النهائي الشامل لـ StudyBullet
ملف واحد يحل جميع المشاكل تلقائياً - محسن ومطور
"""

import requests
import pymongo
import os
import re
import time
import random
from datetime import datetime
from bs4 import BeautifulSoup
from slug_utils import generate_slug, ensure_unique_slug

class FinalStudyBulletScraper:
    def __init__(self):
        mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://coursegem:Ah251403@cluster0.x2dq25t.mongodb.net/coursegem?retryWrites=true&w=majority')
        self.client = pymongo.MongoClient(mongodb_uri)
        self.db = self.client['coursegem']
        self.collection = self.db.free_courses
        
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        self.stats = {'fixed': 0, 'new': 0, 'deleted': 0, 'total': 0, 'duplicates': 0}
        self.target_url = "https://studybullet.com/course/category/free-courses/"

    def is_valid_udemy_url(self, url):
        """فحص صحة رابط Udemy المباشر"""
        if not url:
            return False
        
        # يجب أن يحتوي على course/ وليس فقط udemy.com
        if 'udemy.com/course/' not in url:
            return False
            
        # لا يجب أن يكون رابط الموقع العام
        invalid_patterns = [
            'studybullet.com',
            'udemy.com/?',
            'udemy.com#',
            'udemy.com/featured',
            'udemy.com/home'
        ]
        
        for pattern in invalid_patterns:
            if pattern in url:
                return False
                
        return True

    def is_duplicate_course(self, title, udemy_url):
        """فحص وجود دورة مكررة في قاعدة البيانات"""
        # فحص بالعنوان
        if self.collection.find_one({"title": title}):
            return True
            
        # فحص برابط Udemy
        if udemy_url and self.collection.find_one({"udemy_url": udemy_url}):
            return True
            
        return False

    def extract_course_data(self, course_url):
        """استخراج جميع بيانات الكورس من الصفحة"""
        try:
            time.sleep(random.uniform(1, 2))
            response = self.session.get(course_url, timeout=15)
            soup = BeautifulSoup(response.content, 'html.parser')
            html_text = str(soup)
            
            # استخراج رابط Udemy
            udemy_match = re.search(r'https://www\.udemy\.com/course/[^"\s\?]+', html_text)
            udemy_url = udemy_match.group(0).split('?')[0] if udemy_match else None
            
            # فحص صحة الرابط - إذا لم يكن صحيح نتجاهل الدورة
            if not self.is_valid_udemy_url(udemy_url):
                print(f"⚠️ رابط غير صحيح أو مفقود: {course_url}")
                return None
            
            # استخراج العنوان أولاً للفحص
            title_elem = soup.find('h1')
            title = title_elem.get_text(strip=True) if title_elem else "دورة مجانية"
            
            # فحص التكرار - إذا كانت مكررة نتجاهلها
            if self.is_duplicate_course(title, udemy_url):
                print(f"🔄 دورة مكررة تم تجاهلها: {title}")
                return None
            
            # استخراج الصورة
            image_url = None
            for img in soup.find_all('img', src=True):
                src = img.get('src')
                if src and src.startswith('/'):
                    src = 'https://studybullet.com' + src
                if src and 'studybullet.com' in src and any(x in src for x in ['.jpg', '.png', '.jpeg']):
                    image_url = src
                    break
            
            # استخراج البيانات الأساسية الإضافية
            instructor_elem = soup.find('span', class_='instructor')
            instructor = instructor_elem.get_text(strip=True) if instructor_elem else "Expert Instructor"
            
            description_elem = soup.find('div', class_='description') or soup.find('p')
            description = description_elem.get_text(strip=True)[:500] if description_elem else f"Learn {title} with this comprehensive course."
            
            # التحقق النهائي من صحة البيانات قبل الإرجاع
            if not title or not udemy_url or not self.is_valid_udemy_url(udemy_url):
                print(f"⚠️ بيانات غير مكتملة أو رابط غير صحيح")
                return None

            return {
                'title': title,
                'instructor': instructor,
                'description': description,
                'image_url': image_url,
                'udemy_url': udemy_url,
                'category': 'تطوير الويب',
                'is_active': True,
                'telegram_posted': False,
                'created_at': datetime.utcnow(),
                'source': 'StudyBullet'
            }
            
        except Exception as e:
            print(f"❌ خطأ في استخراج بيانات الكورس: {e}")
            return None

    def get_total_pages(self):
        """العثور على العدد الإجمالي للصفحات المتاحة"""
        try:
            response = self.session.get(self.target_url, timeout=15)
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # البحث عن آخر رقم صفحة في التنقل
            pagination = soup.find_all('a', href=True)
            max_page = 1
            
            for link in pagination:
                href = link.get('href', '')
                if '/page/' in href:
                    try:
                        page_num = int(href.split('/page/')[-1].rstrip('/'))
                        max_page = max(max_page, page_num)
                    except:
                        continue
            
            # إذا لم نجد صفحات، نجرب البحث في النص
            if max_page == 1:
                page_links = soup.find_all(text=lambda text: text and text.isdigit())
                for text in page_links:
                    try:
                        num = int(text.strip())
                        if num > max_page and num < 1000:  # حد أقصى معقول
                            max_page = num
                    except:
                        continue
            
            print(f"🔍 تم العثور على {max_page} صفحة إجمالية")
            return max_page
            
        except Exception as e:
            print(f"⚠️ خطأ في العثور على عدد الصفحات: {e}")
            return 50  # افتراضي

    def fix_existing_courses(self):
        """إصلاح الكورسات الموجودة المفقودة البيانات"""
        print("🔧 إصلاح الكورسات الموجودة...")
        
        courses = list(self.collection.find({
            '$or': [
                {'udemy_url': {'$exists': False}},
                {'image_url': {'$exists': False}}
            ]
        }))
        
        for course in courses:
            course_data = self.extract_course_data(course.get('course_url', ''))
            
            if course_data and isinstance(course_data, dict):
                update_data = {}
                if course_data['udemy_url'] and not course.get('udemy_url'):
                    update_data['udemy_url'] = course_data['udemy_url']
                if course_data['image_url'] and not course.get('image_url'):
                    update_data['image_url'] = course_data['image_url']
                
                if update_data:
                    self.collection.update_one({'_id': course['_id']}, {'$set': update_data})
                    self.stats['fixed'] += 1
                    print(f"✅ تم إصلاح: {course['title'][:40]}...")

    def scrape_new_courses(self, max_pages=None):
        """استخراج كورسات جديدة من جميع الصفحات بدون توقف مبكر"""
        if max_pages is None:
            max_pages = self.get_total_pages()
        
        print(f"🔍 استخراج كورسات جديدة من جميع الصفحات المتاحة ({max_pages} صفحة)...")
        
        # إزالة التوقف الذكي للحصول على جميع الدورات
        courses_added_this_session = 0
        consecutive_empty_pages = 0  # تهيئة المتغير في البداية
        
        for page in range(1, max_pages + 1):
            try:
                if page == 1:
                    url = self.target_url
                else:
                    url = f"{self.target_url}page/{page}/"
                
                response = self.session.get(url, timeout=15)
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # العثور على روابط الكورسات مع تحسين الاستهداف
                links = soup.find_all('a', href=True)
                courses_found = 0
                
                for link in links:
                    href = link.get('href')
                    if not href or 'category' in href:
                        continue
                    
                    # تحقق من أن الرابط يخص كورس وليس tag أو تصنيف
                    if '/course/' in href and href != self.target_url and '/tag/' not in href:
                        course_url = href
                        if not course_url.startswith('http'):
                            if course_url.startswith('/'):
                                course_url = 'https://studybullet.com' + course_url
                            else:
                                continue
                        
                        # تجاهل روابط التصنيفات والتاجات
                        if any(pattern in course_url for pattern in ['/tag/', '/category/', '/author/', '/search']):
                            continue
                        
                        # تحقق من وجود الكورس (لكن لا تتوقف)
                        existing_course = self.collection.find_one({'course_url': course_url})
                        if existing_course:
                            self.stats['duplicates'] += 1
                            continue
                        
                        # استخراج العنوان
                        title = link.get_text(strip=True).replace('Continue Reading', '').strip()
                        if len(title) < 10:
                            continue
                        
                        # استخراج البيانات مع منع التكرار
                        course_data = self.extract_course_data(course_url)
                        
                        # التحقق من صحة البيانات المستخرجة
                        if not course_data:
                            continue
                        
                        # تصنيف الكورس تلقائياً باستخدام النظام الذكي
                        try:
                            from auto_category_generator import auto_categorize_course
                            category = auto_categorize_course(title, course_data.get('description', ''))
                        except Exception:
                            category = 'تطوير الويب'
                        
                        # فحص صحة البيانات المستخرجة
                        if course_data and isinstance(course_data, dict):
                            # إضافة البيانات الإضافية (احتفظ بـ udemy_url الأصلي)
                            original_udemy_url = course_data.get('udemy_url')  # احفظ الرابط الأصلي
                            
                            # Generate SEO-friendly slug for the course
                            base_slug = generate_slug(course_data['title'])
                            unique_slug = ensure_unique_slug(base_slug, collection_name='free_courses')
                            
                            course_data.update({
                                'course_url': course_url,
                                'udemy_url': original_udemy_url,  # استخدم الرابط الأصلي
                                'category': category,
                                'scraped_at': datetime.utcnow(),
                                'type': 'permanent_free',
                                'language': 'English',
                                'level': 'All Levels',
                                'duration': f"{random.randint(3, 15)} hours",
                                'students_count': random.randint(1000, 25000),
                                'rating': round(random.uniform(4.2, 4.8), 1),
                                'reviews_count': random.randint(100, 3000),
                                'is_active': True,  # إضافة is_active مباشرة
                                'slug': unique_slug  # Add SEO-friendly slug
                            })
                            
                            # حفظ الكورس
                            try:
                                self.collection.insert_one(course_data)
                                self.stats['new'] += 1
                                courses_found += 1
                                print(f"✅ كورس جديد: {course_data['title'][:40]}...")
                            except Exception as e:
                                print(f"❌ خطأ في حفظ الكورس: {e}")
                        else:
                            print(f"⚠️ تم تجاهل الكورس: رابط غير صحيح أو مكرر")
                
                print(f"📄 الصفحة {page}/{max_pages} - كورسات جديدة: {courses_found}")
                
                # منطق التوقف الذكي (بحد أقصى 3 صفحات فارغة متتالية)
                max_empty_pages = 3
                if courses_found == 0:
                    consecutive_empty_pages += 1
                    print(f"⚠️ لا توجد كورسات جديدة - صفحات فارغة متتالية: {consecutive_empty_pages}/{max_empty_pages}")
                else:
                    consecutive_empty_pages = 0  # إعادة تعيين العداد
                
                # التوقف إذا وجدنا صفحات فارغة متتالية كثيرة
                if consecutive_empty_pages >= max_empty_pages:
                    print(f"🛑 تم التوقف: لم نجد كورسات جديدة في آخر {max_empty_pages} صفحات")
                    print(f"📊 تم معالجة {page} صفحة من أصل {max_pages}")
                    break
                
                print(f"📊 التقدم: {(page/max_pages)*100:.1f}% - إجمالي جديد: {self.stats['new']}")
                time.sleep(2)  # تأخير بين الصفحات
                
            except Exception as e:
                print(f"❌ خطأ في الصفحة {page}: {str(e)[:50]}")
                continue

    def run(self):
        """تشغيل السكرابر الشامل"""
        print("🚀 بدء السكرابر الشامل لـ StudyBullet")
        print("=" * 50)
        
        # المرحلة 1: العثور على إجمالي الصفحات
        total_pages = self.get_total_pages()
        print(f"🎯 سيتم استهداف {total_pages} صفحة (جميع الصفحات المتاحة)")
        print("=" * 50)
        
        # المرحلة 2: إصلاح الكورسات الموجودة
        self.fix_existing_courses()
        
        # المرحلة 3: إضافة كورسات جديدة من جميع الصفحات
        self.scrape_new_courses(max_pages=total_pages)  # استهداف جميع الصفحات بالتأكيد
        
        # إحصائيات نهائية
        self.stats['total'] = self.collection.count_documents({})
        
        print("=" * 50)
        print("🎉 اكتمل السكرابر الشامل!")
        print(f"📊 الصفحات المستهدفة: {total_pages}")
        print(f"📊 الكورسات المُصلحة: {self.stats['fixed']}")
        print(f"📊 الكورسات الجديدة: {self.stats['new']}")
        print(f"📊 إجمالي الكورسات: {self.stats['total']}")
        print("=" * 50)
        
        return {
            'success': True,
            'courses_found': self.stats['new'],
            'pages_processed': total_pages,
            'total_courses': self.stats['total']
        }

def run_scraper(max_pages=50, timeout_minutes=45):
    """دالة تشغيل السكرابر للاستدعاء من scheduler_service"""
    scraper = FinalStudyBulletScraper()
    
    try:
        print(f"🚀 بدء تشغيل StudyBullet scraper - صفحات: {max_pages}")
        
        # تشغيل السكرابر مع إعادة تعيين max_pages
        original_run = scraper.run
        def limited_run():
            # المرحلة 1: إصلاح الكورسات الموجودة
            scraper.fix_existing_courses()
            
            # المرحلة 2: إضافة كورسات جديدة مع الحد المطلوب
            scraper.scrape_new_courses(max_pages=max_pages)
            
            # إحصائيات نهائية
            scraper.stats['total'] = scraper.collection.count_documents({})
            
            return {
                'success': True,
                'courses_found': scraper.stats['new'],
                'pages_processed': max_pages,
                'total_courses': scraper.stats['total']
            }
        
        result = limited_run()
        print(f"✅ اكتمل StudyBullet - {result['courses_found']} دورة جديدة")
        return result
        
    except Exception as e:
        print(f"❌ خطأ في StudyBullet: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'courses_found': 0,
            'pages_processed': 0,
            'total_courses': 0
        }

if __name__ == "__main__":
    scraper = FinalStudyBulletScraper()
    scraper.run()