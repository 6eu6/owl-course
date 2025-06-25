"""
Auto Category Generator - مولد الفئات التلقائي
نظام ذكي لتوليد وإدارة فئات الدورات تلقائياً بناءً على محتوى العناوين والأوصاف
"""

import re
from collections import Counter
from typing import List, Dict, Set, Tuple
import pymongo
from app import courses_collection, free_courses_collection

class AutoCategoryGenerator:
    def __init__(self):
        """تهيئة مولد الفئات التلقائي"""
        
        # الكلمات المفتاحية الأساسية لكل فئة
        self.base_categories = {
            'Web Development': [
                'html', 'css', 'javascript', 'react', 'vue', 'angular', 'node',
                'web development', 'frontend', 'backend', 'fullstack', 'wordpress',
                'bootstrap', 'jquery', 'php', 'laravel', 'django', 'flask'
            ],
            'Programming': [
                'python', 'java', 'c++', 'c#', 'programming', 'coding', 'algorithm',
                'data structures', 'software development', 'object oriented',
                'functional programming', 'mobile development', 'app development'
            ],
            'Data Science': [
                'data science', 'machine learning', 'artificial intelligence', 'ai',
                'deep learning', 'data analysis', 'statistics', 'pandas', 'numpy',
                'tensorflow', 'pytorch', 'data visualization', 'big data', 'analytics'
            ],
            'Business': [
                'business', 'management', 'leadership', 'entrepreneurship', 'marketing',
                'sales', 'finance', 'accounting', 'project management', 'strategy',
                'operations', 'human resources', 'consulting', 'negotiation'
            ],
            'Design': [
                'design', 'graphic design', 'ui design', 'ux design', 'photoshop',
                'illustrator', 'figma', 'sketch', 'web design', 'logo design',
                'branding', 'typography', 'color theory', 'user experience'
            ],
            'Digital Marketing': [
                'digital marketing', 'seo', 'social media', 'content marketing',
                'email marketing', 'ppc', 'google ads', 'facebook ads', 'affiliate',
                'influencer', 'brand management', 'conversion optimization'
            ],
            'IT & Software': [
                'cybersecurity', 'network', 'linux', 'windows', 'server', 'cloud',
                'aws', 'azure', 'devops', 'docker', 'kubernetes', 'database',
                'sql', 'mongodb', 'system administration', 'it support'
            ],
            'Photography': [
                'photography', 'photo editing', 'lightroom', 'camera', 'portrait',
                'landscape', 'wedding photography', 'street photography', 'composition',
                'lighting', 'post processing', 'digital photography'
            ],
            'Health & Fitness': [
                'fitness', 'yoga', 'meditation', 'nutrition', 'health', 'wellness',
                'weight loss', 'muscle building', 'cardio', 'strength training',
                'mental health', 'mindfulness', 'diet', 'lifestyle'
            ],
            'Music': [
                'music', 'guitar', 'piano', 'singing', 'music production', 'audio',
                'recording', 'mixing', 'mastering', 'composition', 'music theory',
                'instrument', 'vocals', 'songwriting'
            ],
            'Language Learning': [
                'english', 'spanish', 'french', 'german', 'chinese', 'japanese',
                'language learning', 'grammar', 'vocabulary', 'pronunciation',
                'conversation', 'ielts', 'toefl', 'fluency', 'speaking'
            ],
            'Personal Development': [
                'personal development', 'self improvement', 'productivity', 'motivation',
                'confidence', 'communication skills', 'time management', 'goal setting',
                'success', 'mindset', 'habits', 'life coaching', 'career development'
            ]
        }
        
        # كلمات يجب تجاهلها في التصنيف
        self.ignore_words = {
            'course', 'tutorial', 'guide', 'learn', 'complete', 'beginner',
            'advanced', 'master', 'training', 'class', 'lesson', 'step',
            'ultimate', 'comprehensive', 'practical', 'hands-on', '2024', '2025'
        }
    
    def clean_text(self, text: str) -> str:
        """تنظيف النص وتحضيره للتحليل"""
        if not text:
            return ""
        
        # تحويل للأحرف الصغيرة وإزالة الرموز الخاصة
        text = re.sub(r'[^\w\s]', ' ', text.lower())
        text = re.sub(r'\s+', ' ', text.strip())
        
        return text
    
    def extract_keywords(self, title: str, description: str = "") -> List[str]:
        """استخراج الكلمات المفتاحية من العنوان والوصف"""
        combined_text = f"{title} {description}".lower()
        cleaned_text = self.clean_text(combined_text)
        
        # تقسيم النص إلى كلمات
        words = cleaned_text.split()
        
        # إزالة الكلمات المتجاهلة
        keywords = [word for word in words if word not in self.ignore_words and len(word) > 2]
        
        # إضافة العبارات المركبة (bigrams)
        bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
        keywords.extend(bigrams)
        
        return keywords
    
    def categorize_course(self, title: str, description: str = "") -> Tuple[str, float]:
        """تصنيف دورة واحدة وإرجاع الفئة مع درجة الثقة"""
        keywords = self.extract_keywords(title, description)
        
        # حساب نقاط كل فئة
        category_scores = {}
        
        for category, category_keywords in self.base_categories.items():
            score = 0
            for keyword in keywords:
                for cat_keyword in category_keywords:
                    if cat_keyword in keyword or keyword in cat_keyword:
                        # إعطاء نقاط أعلى للمطابقة التامة
                        if keyword == cat_keyword:
                            score += 3
                        else:
                            score += 1
            
            if score > 0:
                category_scores[category] = score
        
        if not category_scores:
            return "General", 0.0
        
        # اختيار الفئة بأعلى نقاط
        best_category = max(category_scores.items(), key=lambda x: x[1])
        
        # حساب درجة الثقة (0-1)
        total_score = sum(category_scores.values())
        confidence = best_category[1] / total_score if total_score > 0 else 0.0
        
        return best_category[0], confidence
    
    def discover_new_categories(self, min_courses: int = 5) -> Dict[str, List[str]]:
        """اكتشاف فئات جديدة من الدورات الموجودة"""
        print("🔍 Analyzing courses to discover new categories...")
        
        # جمع جميع الكلمات المفتاحية من الدورات
        all_keywords = []
        
        # تحليل دورات UdemyFreebies
        udemy_courses = list(courses_collection.find({}, {"title": 1, "description": 1}))
        for course in udemy_courses:
            keywords = self.extract_keywords(
                course.get('title', ''), 
                course.get('description', '')
            )
            all_keywords.extend(keywords)
        
        # تحليل دورات StudyBullet
        study_courses = list(free_courses_collection.find({}, {"title": 1, "description": 1}))
        for course in study_courses:
            keywords = self.extract_keywords(
                course.get('title', ''), 
                course.get('description', '')
            )
            all_keywords.extend(keywords)
        
        # إحصاء الكلمات المفتاحية
        keyword_counts = Counter(all_keywords)
        
        # البحث عن أنماط جديدة
        potential_categories = {}
        
        # التركيز على الكلمات الأكثر تكراراً
        common_keywords = keyword_counts.most_common(100)
        
        for keyword, count in common_keywords:
            if count >= min_courses:
                # تحقق من أن الكلمة ليست في الفئات الموجودة
                is_new = True
                for existing_keywords in self.base_categories.values():
                    if any(keyword in existing or existing in keyword for existing in existing_keywords):
                        is_new = False
                        break
                
                if is_new and len(keyword) > 3:
                    # إنشاء اسم فئة محتمل
                    category_name = self.generate_category_name(keyword)
                    if category_name not in potential_categories:
                        potential_categories[category_name] = []
                    potential_categories[category_name].append(keyword)
        
        print(f"✅ Discovered {len(potential_categories)} potential new categories")
        return potential_categories
    
    def generate_category_name(self, keyword: str) -> str:
        """توليد اسم فئة من الكلمة المفتاحية"""
        # تحويل الكلمة إلى اسم فئة مناسب
        if 'crypto' in keyword or 'blockchain' in keyword:
            return 'Cryptocurrency & Blockchain'
        elif 'excel' in keyword or 'spreadsheet' in keyword:
            return 'Office Productivity'
        elif 'game' in keyword or 'unity' in keyword:
            return 'Game Development'
        elif 'video' in keyword or 'editing' in keyword:
            return 'Video Production'
        elif 'trading' in keyword or 'forex' in keyword:
            return 'Trading & Investment'
        elif 'real estate' in keyword:
            return 'Real Estate'
        elif 'automation' in keyword or 'bot' in keyword:
            return 'Automation & Bots'
        else:
            # تحويل أول حرف لكبير
            return keyword.title().replace('_', ' ')
    
    def update_course_categories(self, dry_run: bool = True) -> Dict[str, int]:
        """تحديث فئات جميع الدورات"""
        print(f"🔄 {'Analyzing' if dry_run else 'Updating'} course categories...")
        
        stats = {
            'udemy_updated': 0,
            'studybullet_updated': 0,
            'udemy_total': 0,
            'studybullet_total': 0,
            'categories_used': set()
        }
        
        # تحديث دورات UdemyFreebies
        udemy_courses = list(courses_collection.find({}))
        stats['udemy_total'] = len(udemy_courses)
        
        for course in udemy_courses:
            category, confidence = self.categorize_course(
                course.get('title', ''),
                course.get('description', '')
            )
            
            # تحديث الفئة إذا كانت الثقة عالية أو لا توجد فئة
            if confidence > 0.3 or not course.get('category'):
                if not dry_run:
                    courses_collection.update_one(
                        {'_id': course['_id']},
                        {'$set': {'category': category, 'category_confidence': confidence}}
                    )
                stats['udemy_updated'] += 1
                stats['categories_used'].add(category)
        
        # تحديث دورات StudyBullet
        study_courses = list(free_courses_collection.find({}))
        stats['studybullet_total'] = len(study_courses)
        
        for course in study_courses:
            category, confidence = self.categorize_course(
                course.get('title', ''),
                course.get('description', '')
            )
            
            # تحديث الفئة إذا كانت الثقة عالية أو لا توجد فئة
            if confidence > 0.3 or not course.get('category'):
                if not dry_run:
                    free_courses_collection.update_one(
                        {'_id': course['_id']},
                        {'$set': {'category': category, 'category_confidence': confidence}}
                    )
                stats['studybullet_updated'] += 1
                stats['categories_used'].add(category)
        
        stats['categories_used'] = list(stats['categories_used'])
        
        action = "Would update" if dry_run else "Updated"
        print(f"✅ {action} {stats['udemy_updated']}/{stats['udemy_total']} UdemyFreebies courses")
        print(f"✅ {action} {stats['studybullet_updated']}/{stats['studybullet_total']} StudyBullet courses")
        print(f"📊 Categories used: {len(stats['categories_used'])}")
        
        return stats
    
    def get_category_distribution(self) -> Dict[str, Dict[str, int]]:
        """الحصول على توزيع الفئات الحالي"""
        print("📊 Analyzing current category distribution...")
        
        distribution = {
            'udemy': {},
            'studybullet': {},
            'total': {}
        }
        
        # تحليل دورات UdemyFreebies
        udemy_pipeline = [
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        for result in courses_collection.aggregate(udemy_pipeline):
            category = result['_id'] or 'Uncategorized'
            distribution['udemy'][category] = result['count']
        
        # تحليل دورات StudyBullet
        study_pipeline = [
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        for result in free_courses_collection.aggregate(study_pipeline):
            category = result['_id'] or 'Uncategorized'
            distribution['studybullet'][category] = result['count']
        
        # حساب الإجمالي
        all_categories = set(distribution['udemy'].keys()) | set(distribution['studybullet'].keys())
        for category in all_categories:
            distribution['total'][category] = (distribution['udemy'].get(category, 0) + 
                                             distribution['studybullet'].get(category, 0))
        
        return distribution
    
    def add_new_category(self, category_name: str, keywords: List[str]) -> bool:
        """إضافة فئة جديدة إلى النظام"""
        if category_name in self.base_categories:
            print(f"⚠️ Category '{category_name}' already exists")
            return False
        
        self.base_categories[category_name] = keywords
        print(f"✅ Added new category: {category_name} with {len(keywords)} keywords")
        return True

# دوال المساعدة للاستخدام في routes.py
def get_auto_category_generator():
    """الحصول على مثيل مولد الفئات"""
    return AutoCategoryGenerator()

def auto_categorize_course(title: str, description: str = "") -> str:
    """تصنيف دورة تلقائياً"""
    generator = AutoCategoryGenerator()
    category, confidence = generator.categorize_course(title, description)
    return category

def update_all_categories(dry_run: bool = True) -> Dict[str, int]:
    """تحديث جميع فئات الدورات"""
    generator = AutoCategoryGenerator()
    return generator.update_course_categories(dry_run)

def get_categories_stats() -> Dict[str, Dict[str, int]]:
    """الحصول على إحصائيات الفئات"""
    generator = AutoCategoryGenerator()
    return generator.get_category_distribution()