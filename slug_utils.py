"""
SEO Slug Generation Utilities
يولد URL-friendly slugs من عناوين الدورات للـ SEO
"""
import re
import unicodedata
from pymongo import MongoClient
import os

# MongoDB connection
mongodb_uri = os.environ.get('MONGODB_URI', 'mongodb+srv://coursegem:Ah251403@cluster0.x2dq25t.mongodb.net/coursegem?retryWrites=true&w=majority')
client = MongoClient(mongodb_uri)
db = client['coursegem']


def generate_slug(title):
    """
    توليد slug من عنوان الدورة
    يدعم الأحرف الإنجليزية والعربية والأرقام
    """
    if not title:
        return "untitled-course"
    
    # تحويل للأحرف الصغيرة
    slug = title.lower()
    
    # إزالة الأحرف الخاصة والاحتفاظ بالأحرف والأرقام والمسافات
    slug = re.sub(r'[^\w\s\u0600-\u06FF-]', '', slug)
    
    # استبدال المسافات بـ dash
    slug = re.sub(r'\s+', '-', slug)
    
    # إزالة الـ dashes الزائدة
    slug = re.sub(r'-+', '-', slug)
    
    # إزالة الـ dashes من البداية والنهاية
    slug = slug.strip('-')
    
    # التأكد من عدم كون الـ slug فارغ
    if not slug:
        slug = "course"
    
    # تحديد الطول الأقصى
    if len(slug) > 100:
        slug = slug[:100].rstrip('-')
    
    return slug


def ensure_unique_slug(slug, course_id=None, collection_name='courses'):
    """
    التأكد من أن الـ slug فريد في قاعدة البيانات
    إضافة رقم في حالة التكرار
    """
    collection = db[collection_name]
    original_slug = slug
    counter = 1
    
    while True:
        # البحث عن slug موجود (باستثناء الدورة الحالية)
        query = {'slug': slug}
        if course_id:
            query['_id'] = {'$ne': course_id}
        
        existing = collection.find_one(query)
        
        if not existing:
            return slug
        
        # إضافة رقم للـ slug
        slug = f"{original_slug}-{counter}"
        counter += 1


def add_slugs_to_existing_courses():
    """
    إضافة slugs لجميع الدورات الموجودة في قاعدة البيانات
    """
    print("بدء إضافة slugs للدورات الموجودة...")
    
    # معالجة دورات UdemyFreebies
    courses_collection = db['courses']
    courses_updated = 0
    
    for course in courses_collection.find({'slug': {'$exists': False}}):
        title = course.get('title', 'Untitled Course')
        slug = generate_slug(title)
        unique_slug = ensure_unique_slug(slug, course['_id'], 'courses')
        
        courses_collection.update_one(
            {'_id': course['_id']},
            {'$set': {'slug': unique_slug}}
        )
        courses_updated += 1
        print(f"دورة UdemyFreebies: {title[:50]}... → {unique_slug}")
    
    # معالجة دورات StudyBullet
    free_courses_collection = db['free_courses']
    free_courses_updated = 0
    
    for course in free_courses_collection.find({'slug': {'$exists': False}}):
        title = course.get('title', 'Untitled Course')
        slug = generate_slug(title)
        unique_slug = ensure_unique_slug(slug, course['_id'], 'free_courses')
        
        free_courses_collection.update_one(
            {'_id': course['_id']},
            {'$set': {'slug': unique_slug}}
        )
        free_courses_updated += 0
        print(f"دورة StudyBullet: {title[:50]}... → {unique_slug}")
    
    print(f"\n✅ تم تحديث {courses_updated} دورة من UdemyFreebies")
    print(f"✅ تم تحديث {free_courses_updated} دورة من StudyBullet")
    print("✅ انتهى إنشاء الـ slugs للدورات الموجودة")
    
    return courses_updated + free_courses_updated


def find_course_by_slug(slug):
    """
    البحث عن دورة باستخدام الـ slug
    يبحث في كلا المجموعتين
    """
    # البحث في دورات UdemyFreebies
    course = db['courses'].find_one({'slug': slug})
    if course:
        course['collection'] = 'courses'
        return course
    
    # البحث في دورات StudyBullet
    course = db['free_courses'].find_one({'slug': slug})
    if course:
        course['collection'] = 'free_courses'
        return course
    
    return None


def find_course_by_id(course_id):
    """
    البحث عن دورة باستخدام الـ ID للـ redirect القديم
    """
    from bson import ObjectId
    
    try:
        obj_id = ObjectId(course_id)
    except:
        return None
    
    # البحث في دورات UdemyFreebies
    course = db['courses'].find_one({'_id': obj_id})
    if course:
        course['collection'] = 'courses'
        return course
    
    # البحث في دورات StudyBullet
    course = db['free_courses'].find_one({'_id': obj_id})
    if course:
        course['collection'] = 'free_courses'
        return course
    
    return None


if __name__ == "__main__":
    # تشغيل إضافة الـ slugs للدورات الموجودة
    add_slugs_to_existing_courses()