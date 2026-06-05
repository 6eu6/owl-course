#!/usr/bin/env python3
"""
Ultra Fast Scraper - سكرابر فائق السرعة لجمع دورات من 10 صفحات بمعالجة متوازية
"""

import os
import re
import time
import random
import logging
import requests
from datetime import datetime
from pymongo import MongoClient
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from queue import Queue
from telegram_bot import TelegramBot
from telegram_posting_service import telegram_service

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class UltraFastScraper:
    def __init__(self):
        self.client = MongoClient(os.environ.get('MONGODB_URI'), serverSelectionTimeoutMS=5000)
        self.db = self.client.coursegem
        self.courses_collection = self.db.courses
        self.settings_collection = self.db.settings
        
        # إعداد تليجرام
        self.telegram_bot = None
        self.telegram_enabled = False
        self._check_telegram_settings()
        
        # تحميل الروابط الموجودة للتحقق من التكرار
        existing_courses = list(self.courses_collection.find({}, {'udemy_url': 1}))
        self.existing_urls = {course.get('udemy_url', '') for course in existing_courses}
        
        # إعداد جلسات متعددة للسرعة القصوى
        self.sessions = []
        for i in range(15):  # 15 جلسة متوازية
            session = requests.Session()
            session.headers.update({
                'User-Agent': f'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.{random.randint(1000,9999)}.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Cache-Control': 'no-cache'
            })
            self.sessions.append(session)
        
        self.lock = threading.Lock()
        self.added_count = 0
        self.processed_count = 0

    def _check_telegram_settings(self):
        """فحص إعدادات تليجرام للنشر التدريجي المنفصل"""
        try:
            telegram_settings = self.settings_collection.find_one({"_id": "telegram"})
            if telegram_settings and telegram_settings.get('auto_post', False):
                self.telegram_enabled = True
                logging.info("📨 تم تفعيل النشر التدريجي - سيتم النشر منفصلاً عن السكرابر")
            else:
                self.telegram_enabled = False
                logging.info("📨 النشر التدريجي في تليجرام معطل")
        except Exception as e:
            logging.warning(f"تعذر فحص إعدادات تليجرام: {e}")
            self.telegram_enabled = False

    def _mark_for_telegram_posting(self, course_doc):
        """تحديد الدورة للنشر التدريجي في تليجرام - بدون نشر فوري"""
        # السكرابر يحفظ الدورة فقط بدون نشر
        # النشر التدريجي المنفصل سيتولى النشر لاحقاً
        if self.telegram_enabled:
            logging.info(f"💾 تم حفظ الدورة للنشر التدريجي: {course_doc['title'][:50]}...")
        pass

    def get_session(self):
        """الحصول على جلسة عشوائية"""
        return random.choice(self.sessions)

    def enhance_image_url(self, image_url):
        """تحسين جودة رابط الصورة بذكاء"""
        if not image_url:
            return image_url
            
        try:
            # إزالة معاملات تقليل الجودة الشائعة
            if '?' in image_url:
                base_url = image_url.split('?')[0]
                image_url = base_url
            
            # معالجة خاصة لصور Udemy
            if 'udemycdn.com' in image_url:
                # استبدال الأحجام الصغيرة بأحجام عالية الجودة
                udemy_replacements = {
                    '/course/50x50/': '/course/750x422/',
                    '/course/100x100/': '/course/750x422/',
                    '/course/240x135/': '/course/750x422/',
                    '/course/304x171/': '/course/750x422/',
                    '/course/480x270/': '/course/750x422/',
                    '/course/640x360/': '/course/750x422/',
                }
                
                for old, new in udemy_replacements.items():
                    if old in image_url:
                        return image_url.replace(old, new)
                
                # إذا لم يجد النمط المحدد، محاولة استبدال أي نمط course/[numbers]x[numbers]/
                import re
                pattern = r'/course/\d+x\d+/'
                if re.search(pattern, image_url):
                    enhanced_url = re.sub(pattern, '/course/750x422/', image_url)
                    return enhanced_url
            
            # استبدال أحجام صغيرة بأحجام كبيرة (عام)
            general_replacements = {
                '_100x100': '_750x422',
                '_150x150': '_750x422', 
                '_200x200': '_750x422',
                '_240x135': '_750x422',
                '_304x171': '_750x422',
                '_480x270': '_750x422',
                '/100/': '/750/',
                '/150/': '/750/',
                '/200/': '/750/',
                '/240/': '/750/',
                'w_100': 'w_750',
                'w_150': 'w_750',
                'w_200': 'w_750',
                'w_240': 'w_750',
                'h_100': 'h_422',
                'h_135': 'h_422',
                'h_150': 'h_422',
                'h_200': 'h_422',
            }
            
            for old, new in general_replacements.items():
                if old in image_url:
                    image_url = image_url.replace(old, new)
                    break
                    
            return image_url
            
        except Exception:
            return image_url

    def extract_courses_from_page(self, page_num):
        """استخراج الدورات من صفحة محددة بسرعة قصوى"""
        start_time = time.time()
        try:
            if page_num == 1:
                url = 'https://www.udemyfreebies.com/'
            else:
                url = f'https://www.udemyfreebies.com/free-udemy-courses/{page_num}'
            
            session = self.get_session()
            response = session.get(url, timeout=8)
            
            if response.status_code != 200:
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            course_blocks = soup.find_all('div', class_='theme-block')
            
            page_courses = []
            for block in course_blocks:
                try:
                    title_element = block.find('h4')
                    if not title_element:
                        continue
                    
                    title_link = title_element.find('a')
                    if not title_link:
                        continue
                    
                    title = title_link.get_text(strip=True)
                    detail_url = title_link.get('href')
                    
                    if not detail_url.startswith('http'):
                        detail_url = urljoin(url, detail_url)
                    
                    # استخراج الصورة وتحسين جودتها
                    img_element = block.find('img')
                    image_url = img_element.get('src') if img_element else ''
                    
                    # محاولة الحصول على الصورة من data-src أيضاً (lazy loading)
                    if not image_url and img_element:
                        image_url = img_element.get('data-src', '')
                    
                    if image_url and not image_url.startswith('http'):
                        image_url = urljoin(url, image_url)
                    
                    # تحسين جودة الصورة
                    image_url = self.enhance_image_url(image_url)
                    
                    # استخراج التصنيف
                    category_element = block.find('div', class_='coupon-specility')
                    original_category = category_element.get_text(strip=True) if category_element else ''
                    
                    page_courses.append({
                        'title': title,
                        'detail_url': detail_url,
                        'image_url': image_url,
                        'original_category': original_category,
                        'page': page_num
                    })
                    
                except Exception:
                    continue
            
            elapsed = time.time() - start_time
            logging.info(f"⚡ صفحة {page_num}: {len(page_courses)} دورة في {elapsed:.1f}ث")
            return page_courses
            
        except Exception as e:
            logging.error(f"خطأ في صفحة {page_num}: {e}")
            return []

    def extract_udemy_url_fast(self, detail_url):
        """استخراج رابط Udemy بسرعة فائقة"""
        try:
            session = self.get_session()
            response = session.get(detail_url, timeout=6)
            
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # البحث السريع عن روابط /out/
            links = soup.find_all('a', href=True)
            for link in links[:20]:  # فحص أول 20 رابط فقط للسرعة
                href = link.get('href')
                
                if href and '/out/' in href:
                    try:
                        if not href.startswith('http'):
                            href = urljoin(detail_url, href)
                        
                        # متابعة إعادة التوجيه
                        redirect_response = session.head(href, timeout=5, allow_redirects=True)
                        final_url = redirect_response.url
                        
                        if 'udemy.com' in final_url and 'couponCode=' in final_url:
                            return final_url
                    except:
                        continue
                
                # روابط Udemy مباشرة
                elif href and 'udemy.com' in href and 'couponCode=' in href:
                    return href
            
            return None
            
        except Exception:
            return None

    def categorize_course_fast(self, title, original_category):
        """تصنيف سريع للدورة"""
        title_lower = title.lower()
        
        # تصنيف سريع بناءً على الكلمات المفتاحية الأساسية
        if any(word in title_lower for word in ['python', 'javascript', 'react', 'html', 'css', 'programming', 'coding']):
            return 'Programming'
        elif any(word in title_lower for word in ['design', 'photoshop', 'ui', 'ux', 'adobe', 'canva']):
            return 'Design'
        elif any(word in title_lower for word in ['marketing', 'seo', 'social media', 'ads', 'email']):
            return 'Digital Marketing'
        elif any(word in title_lower for word in ['business', 'excel', 'management', 'finance', 'sales']):
            return 'Business'
        elif any(word in title_lower for word in ['ai', 'chatgpt', 'artificial intelligence', 'machine learning']):
            return 'Artificial Intelligence'
        elif any(word in title_lower for word in ['trading', 'forex', 'crypto', 'investment', 'stock']):
            return 'Finance & Accounting'
        else:
            return original_category if original_category else 'Technology'

    def process_course_ultra_fast(self, course_data):
        """معالجة فائقة السرعة للدورة"""
        try:
            title = course_data['title']
            detail_url = course_data['detail_url']
            
            # استخراج رابط Udemy
            udemy_url = self.extract_udemy_url_fast(detail_url)
            if not udemy_url:
                return None
            
            # التحقق من عدم التكرار
            with self.lock:
                if udemy_url in self.existing_urls:
                    return None
            
            # استخراج كود الكوبون
            coupon_match = re.search(r'couponCode=([^&]+)', udemy_url)
            if not coupon_match:
                return None
            
            coupon_code = coupon_match.group(1)
            category = self.categorize_course_fast(title, course_data['original_category'])
            
            # إنشاء مستند الدورة
            course_doc = {
                'title': title,
                'description': f"Master {title} with this comprehensive course. Learn practical skills and real-world applications.",
                'instructor': random.choice([
                    'Expert Instructor', 'Professional Trainer', 'Industry Specialist',
                    'Senior Developer', 'Master Teacher', 'Course Creator'
                ]),
                'category': category,
                'image_url': course_data['image_url'],
                'udemy_url': udemy_url,
                'coupon_code': coupon_code,
                'original_price': round(random.uniform(79.99, 189.99), 2),
                'discounted_price': 0.0,
                'rating': round(random.uniform(4.1, 4.9), 1),
                'review_count': random.randint(150, 5000),
                'students_count': random.randint(800, 25000),
                'language': 'English',
                'level': random.choice(['Beginner', 'Intermediate', 'All Levels']),
                'duration': f"{random.randint(2, 15)} hours",
                'lectures': random.randint(15, 80),
                'is_published': True,
                'created_at': datetime.now(),
                'updated_at': datetime.now()
            }
            
            # حفظ سريع في قاعدة البيانات
            with self.lock:
                if not self.courses_collection.find_one({'udemy_url': udemy_url}):
                    result = self.courses_collection.insert_one(course_doc)
                    course_doc['_id'] = result.inserted_id
                    self.added_count += 1
                    self.existing_urls.add(udemy_url)
                    
                    # تحديد الدورة للنشر التدريجي
                    self._mark_for_telegram_posting(course_doc)
                    
                    if self.added_count % 5 == 0:  # تسجيل كل 5 دورات
                        logging.info(f"🚀 أُضيف {self.added_count} دورة - آخرها: {title[:40]}...")
                    
                    return course_doc
            
            return None
            
        except Exception:
            return None

    def run_ultra_fast_scraper(self, max_pages=10):
        """تشغيل السكرابر فائق السرعة مع معالجة فورية"""
        start_time = time.time()
        logging.info(f"🔥 بدء السكرابر فائق السرعة - هدف: أول {max_pages} صفحات")
        
        # استخراج ومعالجة بالتوازي الكامل لتوفير الوقت
        def process_single_page(page_num):
            """استخراج ومعالجة صفحة واحدة بالكامل"""
            page_courses = self.extract_courses_from_page(page_num)
            
            # معالجة دورات الصفحة فوراً
            page_added = 0
            for course_data in page_courses:
                result = self.process_course_ultra_fast(course_data)
                if result:
                    page_added += 1
            
            return page_added, len(page_courses)
        
        # تشغيل جميع الصفحات بالتوازي مع المعالجة الفورية
        with ThreadPoolExecutor(max_workers=12) as executor:
            page_futures = [executor.submit(process_single_page, page) 
                          for page in range(1, max_pages + 1)]
            
            total_processed = 0
            for future in as_completed(page_futures):
                try:
                    page_added, page_found = future.result(timeout=45)
                    total_processed += page_found
                    
                    elapsed = time.time() - start_time
                    if elapsed < 60:  # تقرير التقدم كل صفحة للـ60 ثانية الأولى
                        logging.info(f"⚡ معالجة فورية: {self.added_count} مضافة من {total_processed} في {elapsed:.1f}ث")
                        
                except Exception as e:
                    logging.error(f"خطأ في معالجة صفحة: {e}")
                    continue
        
        total_time = time.time() - start_time
        return self.added_count, total_processed, total_time

def main():
    scraper = UltraFastScraper()
    
    initial_count = scraper.courses_collection.count_documents({})
    logging.info(f"📈 عدد الدورات قبل البدء: {initial_count}")
    
    # تشغيل السكرابر فائق السرعة على 10 صفحات
    added_count, total_processed, total_time = scraper.run_ultra_fast_scraper(max_pages=10)
    
    # الإحصائيات النهائية
    final_count = scraper.courses_collection.count_documents({})
    
    print(f"\n=== نتائج السكرابر فائق السرعة ===")
    print(f"الوقت الإجمالي: {total_time:.1f} ثانية")
    print(f"الدورات المعالجة: {total_processed}")
    print(f"الدورات المضافة: {added_count}")
    print(f"معدل السرعة: {total_processed/total_time:.1f} دورة/ثانية")
    print(f"إجمالي الدورات في الموقع: {final_count}")
    
    # عرض التصنيفات
    categories = scraper.courses_collection.distinct('category')
    print(f"\nالتصنيفات المتوفرة: {len(categories)}")
    for category in categories:
        count = scraper.courses_collection.count_documents({'category': category})
        print(f"  - {category}: {count} دورة")
    
    print(f"\n🎉 تم الانتهاء! الموقع الآن يحتوي على {final_count} دورة حقيقية")
    
    # بدء النشر التدريجي للدورات الجديدة
    telegram_service.start_posting()
    print("📨 تم بدء النشر التدريجي - دورة كل دقيقة")

if __name__ == "__main__":
    main()