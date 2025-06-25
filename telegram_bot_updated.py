#!/usr/bin/env python3
"""
Telegram Bot - Multi-Channel Support System
نظام بوت تليجرام مع دعم متعدد القنوات
"""

import requests
import json
import os
import logging
from datetime import datetime
from pymongo import MongoClient
import psycopg2
from dotenv import load_dotenv

# تحميل متغيرات البيئة
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramBot:
    def __init__(self):
        """تهيئة بوت تليجرام مع دعم متعدد القنوات"""
        
        # الاتصال بـ MongoDB للدورات
        self.client = MongoClient(os.environ.get('MONGODB_URI'))
        self.db = self.client.coursegem
        
        # الاتصال بـ PostgreSQL للإعدادات
        self.pg_conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
        
        # الحصول على إعدادات تليجرام من PostgreSQL
        self.bot_token, self.channels = self._load_telegram_settings()
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}"
    
    def _load_telegram_settings(self):
        """تحميل إعدادات التليجرام من PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()
            
            # قراءة bot_token
            cursor.execute("SELECT setting_value FROM telegram_settings WHERE setting_key = 'bot_token'")
            token_result = cursor.fetchone()
            bot_token = token_result[0] if token_result else os.environ.get('TELEGRAM_BOT_TOKEN', '')
            
            # قراءة channels
            cursor.execute("SELECT setting_value FROM telegram_settings WHERE setting_key = 'channels'")
            channels_result = cursor.fetchone()
            
            if channels_result and channels_result[0]:
                channels = json.loads(channels_result[0])
            else:
                # القيم الافتراضية
                channels = [{'name': 'القناة الرئيسية', 'id': '@owlcourses', 'active': True}]
            
            cursor.close()
            return bot_token, channels
            
        except Exception as e:
            logger.error(f"خطأ في تحميل إعدادات التليجرام: {e}")
            # استخدام القيم الافتراضية
            return os.environ.get('TELEGRAM_BOT_TOKEN', ''), [{'name': 'القناة الرئيسية', 'id': '@owlcourses', 'active': True}]
    
    def get_active_channels(self):
        """الحصول على جميع القنوات النشطة من PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT setting_value FROM telegram_settings WHERE setting_key = 'channels'")
            channels_result = cursor.fetchone()
            cursor.close()
            
            if channels_result and channels_result[0]:
                channels = json.loads(channels_result[0])
                # إرجاع القنوات النشطة فقط
                active_channels = [ch for ch in channels if ch.get('active', False)]
                logger.info(f"Found {len(active_channels)} active channels out of {len(channels)} total")
                return active_channels
            else:
                logger.warning("No channels found in PostgreSQL telegram_settings")
                return []
        except Exception as e:
            logger.error(f"Error getting active channels from PostgreSQL: {e}")
            return []
    
    def test_connection(self):
        """اختبار اتصال البوت"""
        try:
            response = requests.get(f"{self.api_url}/getMe")
            if response.status_code == 200:
                bot_info = response.json()['result']
                logger.info(f"Bot connected: @{bot_info['username']}")
                return True
            else:
                logger.error(f"Bot connection failed: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Bot test error: {e}")
            return False
    
    def test_channel_access(self, channel_id):
        """اختبار الوصول لقناة محددة"""
        try:
            response = requests.get(f"{self.api_url}/getChat", params={'chat_id': channel_id})
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Channel access test failed for {channel_id}: {e}")
            return False
    
    def get_approved_template(self):
        """الحصول على القالب المعتمد من PostgreSQL"""
        try:
            cursor = self.pg_conn.cursor()
            cursor.execute("SELECT setting_value FROM telegram_settings WHERE setting_key = 'template_id'")
            template_result = cursor.fetchone()
            cursor.close()
            
            if template_result and template_result[0]:
                template_id = template_result[0]
                # البحث عن القالب في MongoDB
                approved_template = self.db.telegram_messages.find_one({
                    '_id': template_id,
                    'type': 'template',
                    'approved': True
                })
                
                if approved_template and approved_template.get('content'):
                    logger.info(f"✅ تم العثور على قالب معتمد: {template_id}")
                    return approved_template.get('content', '')
            
            # البحث عن أي قالب معتمد كبديل
            approved_template = self.db.telegram_messages.find_one({
                'type': 'template',
                'approved': True
            }, sort=[('created_at', -1)])
            
            if approved_template and approved_template.get('content'):
                logger.info(f"✅ تم العثور على قالب معتمد بديل: {approved_template.get('_id')}")
                return approved_template.get('content', '')
            
            logger.warning("⚠️ لم يتم العثور على قالب معتمد، استخدام القالب الافتراضي")
            return self.get_default_template()
            
        except Exception as e:
            logger.error(f"❌ خطأ في الحصول على القالب المعتمد: {e}")
            return self.get_default_template()
    
    def get_default_template(self):
        """القالب الافتراضي"""
        return """🇺🇸 {title}

📝 {description}

📚 Course: {title}
🎯 Category: {category}
⭐ Rating: {rating}
👥 Students: {students_display}

🎓 Advance your career with this comprehensive course!

#FreeCourse #Learning #OnlineEducation"""
    
    def format_course_message(self, course):
        """تنسيق رسالة الدورة باستخدام القالب المعتمد"""
        # استخراج عدد الطلاب من الحقول المختلفة
        students_count = course.get('students_count', course.get('students', 'N/A'))
        if students_count and students_count != 'N/A':
            try:
                # تنسيق العدد إذا كان رقم
                if isinstance(students_count, (int, float)):
                    if students_count >= 1000:
                        students_display = f"{students_count/1000:.1f}K"
                    else:
                        students_display = str(int(students_count))
                else:
                    students_display = str(students_count)
            except:
                students_display = str(students_count)
        else:
            students_display = "N/A"
        
        # الحصول على القالب المعتمد
        template = self.get_approved_template()
        
        # تطبيق المتغيرات على القالب مع إصلاح المدة والتاريخ
        try:
            # Fix duration - get actual duration from database
            duration = course.get('duration', course.get('content_duration', 'N/A'))
            if not duration or duration == 'N/A':
                duration = course.get('total_duration', course.get('course_duration', 'Multiple hours'))
            
            # Fix update date - get actual update date
            from datetime import datetime
            update_date = course.get('updated_at', course.get('last_updated', course.get('created_at')))
            if update_date:
                if isinstance(update_date, str):
                    update_date = update_date[:7] if len(update_date) > 7 else update_date
                else:
                    update_date = update_date.strftime('%m/%Y')
            else:
                update_date = datetime.now().strftime('%m/%Y')
            
            message = template.format(
                title=course.get('title', 'Unknown Course'),
                description=course.get('description', 'Professional course to enhance your skills')[:200] + "...",
                category=course.get('category', 'Professional Development'),
                rating=course.get('rating', 'N/A'),
                students_count=students_display,
                students_display=students_display,  # للتوافق مع القوالب القديمة
                instructor=course.get('instructor', 'Unknown'),
                language=course.get('language', 'English'),
                level=course.get('level', 'All Levels'),
                duration=duration,
                update_date=update_date
            )
        except Exception as e:
            logger.error(f"Error formatting template: {e}")
            # استخدام القالب الافتراضي في حالة الخطأ
            message = f"""🇺🇸 {course.get('title', 'Unknown Course')}

📝 {course.get('description', 'Professional course to enhance your skills')}

📚 Course: {course.get('title', 'Unknown Course')}
🎯 Category: {course.get('category', 'Professional Development')}
⭐ Rating: {course.get('rating', 'N/A')}
👥 Students: {students_display}

🎓 Advance your career with this comprehensive course!

#FreeCourse #Learning #OnlineEducation"""
        
        return message
    
    def create_inline_keyboard(self, course):
        """إنشاء لوحة المفاتيح للدورة"""
        course_slug = course.get('slug', str(course['_id']))
        website_url = f"https://coursegem-zeta.vercel.app/course/{course_slug}"
        
        return {
            "inline_keyboard": [
                [
                    {"text": "🎓 Get Course", "url": website_url},
                    {"text": "📖 How to Register", "url": "https://coursegem-zeta.vercel.app/faq#how-to-register"}
                ]
            ]
        }
    
    def send_message_to_channel(self, channel_id, channel_name, message_text, image_url=None, inline_keyboard=None):
        """إرسال رسالة إلى قناة محددة"""
        try:
            if image_url:
                payload = {
                    'chat_id': channel_id,
                    'photo': image_url,
                    'caption': message_text,
                    'parse_mode': 'HTML'
                }
                if inline_keyboard:
                    payload['reply_markup'] = json.dumps(inline_keyboard)
                
                response = requests.post(f"{self.api_url}/sendPhoto", json=payload)
            else:
                payload = {
                    'chat_id': channel_id,
                    'text': message_text,
                    'parse_mode': 'HTML'
                }
                if inline_keyboard:
                    payload['reply_markup'] = json.dumps(inline_keyboard)
                
                response = requests.post(f"{self.api_url}/sendMessage", json=payload)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('ok'):
                    message_id = result.get('result', {}).get('message_id')
                    logger.info(f"Message sent successfully to {channel_name}, message_id: {message_id}")
                    return {
                        'success': True,
                        'message_id': message_id,
                        'channel_id': channel_id,
                        'channel_name': channel_name
                    }
                else:
                    logger.error(f"Failed to send message to {channel_name}: {result.get('description', 'Unknown error')}")
                    return {'success': False, 'error': result.get('description', 'Unknown error')}
            else:
                logger.error(f"Failed to send message to {channel_name}: {response.status_code}")
                return {'success': False, 'error': f'HTTP {response.status_code}'}
                
        except Exception as e:
            logger.error(f"Error sending message to {channel_name}: {e}")
            return False
    
    def send_course_to_all_channels(self, course, collection_name):
        """إرسال دورة إلى جميع القنوات النشطة"""
        active_channels = self.get_active_channels()
        
        if not active_channels:
            logger.warning("No active channels found")
            return False
        
        message_text = self.format_course_message(course)
        image_url = course.get('image_url', course.get('image', ''))
        inline_keyboard = self.create_inline_keyboard(course)
        
        success_count = 0
        
        for channel in active_channels:
            channel_id = channel.get('id')
            channel_name = channel.get('name', 'Unknown')
            
            if self.send_message_to_channel(channel_id, channel_name, message_text, image_url, inline_keyboard):
                success_count += 1
                
                # حفظ سجل الرسالة
                message_record = {
                    'course_id': str(course['_id']),
                    'course_title': course['title'],
                    'collection': collection_name,
                    'channel_id': channel_id,
                    'channel_name': channel_name,
                    'message_type': 'course_announcement',
                    'sent_at': datetime.now(),
                    'status': 'sent'
                }
                
                self.db.telegram_messages.insert_one(message_record)
        
        # تحديث حالة النشر للدورة
        if success_count > 0:
            self.db[collection_name].update_one(
                {'_id': course['_id']},
                {
                    '$set': {
                        'telegram_posted': True,
                        'telegram_posted_at': datetime.now(),
                        'posted_to_channels': success_count
                    }
                }
            )
        
        logger.info(f"Course posted to {success_count}/{len(active_channels)} channels")
        return success_count > 0
    
    def send_test_message_to_all_channels(self):
        """إرسال رسالة اختبار لجميع القنوات"""
        active_channels = self.get_active_channels()
        
        if not active_channels:
            logger.warning("No active channels found")
            return False
        
        test_message = f"""🧪 Test Message from CourseGem

⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
✅ Multi-channel system is working correctly

#Test #CourseGem"""
        
        success_count = 0
        
        for channel in active_channels:
            channel_id = channel.get('id')
            channel_name = channel.get('name', 'Unknown')
            
            if self.send_message_to_channel(channel_id, channel_name, test_message):
                success_count += 1
        
        logger.info(f"Test message sent to {success_count}/{len(active_channels)} channels")
        return success_count > 0
    
    def get_next_course_to_post(self):
        """الحصول على الدورة التالية للنشر"""
        # محاولة من free_courses أولاً
        course = self.db.free_courses.find_one({'telegram_posted': {'$ne': True}})
        if course:
            return course, 'free_courses'
        
        # محاولة من courses
        course = self.db.courses.find_one({'telegram_posted': {'$ne': True}})
        if course:
            return course, 'courses'
        
        return None, None
    
    def post_next_course(self):
        """نشر الدورة التالية لجميع القنوات"""
        course, collection = self.get_next_course_to_post()
        
        if not course:
            logger.info("No pending courses to post")
            return False
        
        logger.info(f"Posting course: {course['title'][:50]}...")
        return self.send_course_to_all_channels(course, collection)
    
    def get_pending_courses_count(self):
        """عد الدورات المعلقة للنشر"""
        udemy_pending = self.db.courses.count_documents({'telegram_posted': {'$ne': True}})
        studybullet_pending = self.db.free_courses.count_documents({'telegram_posted': {'$ne': True}})
        
        return {
            'udemy_pending': udemy_pending,
            'studybullet_pending': studybullet_pending,
            'total_pending': udemy_pending + studybullet_pending
        }
    
    def delete_message(self, channel_id, message_id):
        """حذف رسالة محددة من قناة"""
        try:
            response = requests.post(f"{self.api_url}/deleteMessage", {
                'chat_id': channel_id,
                'message_id': message_id
            })
            
            if response.status_code == 200:
                result = response.json()
                if result.get('ok'):
                    logger.info(f"Message {message_id} deleted from {channel_id}")
                    return True
                else:
                    logger.error(f"Failed to delete message {message_id}: {result.get('description')}")
            else:
                logger.error(f"HTTP error deleting message: {response.status_code}")
            
            return False
            
        except Exception as e:
            logger.error(f"Error deleting message {message_id} from {channel_id}: {e}")
            return False

    def get_status(self):
        """الحصول على حالة النظام"""
        active_channels = self.get_active_channels()
        pending_counts = self.get_pending_courses_count()
        
        return {
            'bot_connected': self.test_connection(),
            'active_channels': len(active_channels),
            'channels': active_channels,
            'pending_courses': pending_counts,
            'last_update': datetime.now()
        }
    
    def close(self):
        """إغلاق الاتصالات"""
        if self.client:
            self.client.close()

# دوال مساعدة للتوافق مع النظام الحالي
def get_telegram_bot():
    """الحصول على instance من البوت"""
    return TelegramBot()

def test_telegram_connection():
    """اختبار اتصال تليجرام"""
    bot = get_telegram_bot()
    try:
        result = bot.test_connection()
        bot.close()
        return result
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return False

def post_course_to_telegram(course, collection_name):
    """نشر دورة إلى تليجرام"""
    bot = get_telegram_bot()
    try:
        result = bot.send_course_to_all_channels(course, collection_name)
        bot.close()
        return result
    except Exception as e:
        logger.error(f"Course posting failed: {e}")
        return False

if __name__ == "__main__":
    # اختبار النظام
    bot = TelegramBot()
    try:
        print("Testing Telegram multi-channel system...")
        status = bot.get_status()
        print(f"Bot connected: {status['bot_connected']}")
        print(f"Active channels: {status['active_channels']}")
        print(f"Pending courses: {status['pending_courses']['total_pending']}")
        
        if status['bot_connected'] and status['active_channels'] > 0:
            print("Sending test message...")
            bot.send_test_message_to_all_channels()
    finally:
        bot.close()