import math
from datetime import datetime, timedelta
import re
from urllib.parse import urlparse

def smart_categorize_course(title, description=""):
    """
    نظام ذكي للتعرف على فئات الدورات بدلاً من 'other'
    يحلل العنوان والوصف لتحديد الفئة الأنسب
    """
    if not title:
        return "General"
    
    title_lower = title.lower()
    desc_lower = description.lower() if description else ""
    combined_text = f"{title_lower} {desc_lower}"
    
    # قاموس شامل للفئات مع كلمات مفتاحية متعددة
    category_keywords = {
        "Programming": [
            "python", "javascript", "java", "php", "c++", "c#", "ruby", "swift", "kotlin", 
            "html", "css", "sql", "nosql", "programming", "coding", "developer", "software",
            "algorithm", "data structure", "web development", "mobile development", "api",
            "framework", "library", "git", "github", "debugging", "testing", "devops"
        ],
        "Web Development": [
            "web", "website", "html", "css", "javascript", "react", "angular", "vue", 
            "node", "express", "django", "flask", "bootstrap", "jquery", "ajax", "json",
            "responsive", "frontend", "backend", "fullstack", "dom", "spa", "pwa"
        ],
        "Data Science": [
            "data", "analytics", "machine learning", "ml", "ai", "artificial intelligence",
            "pandas", "numpy", "matplotlib", "scikit", "tensorflow", "pytorch", "keras",
            "statistics", "analysis", "visualization", "big data", "mining", "prediction"
        ],
        "Business": [
            "business", "marketing", "management", "entrepreneurship", "startup", "finance",
            "accounting", "economics", "sales", "leadership", "strategy", "project management",
            "digital marketing", "social media", "branding", "customer", "revenue", "profit"
        ],
        "Design": [
            "design", "graphic", "ui", "ux", "photoshop", "illustrator", "figma", "sketch",
            "creative", "art", "visual", "logo", "brand", "typography", "color", "layout",
            "prototype", "wireframe", "adobe", "canva", "drawing", "digital art"
        ],
        "Photography": [
            "photography", "photo", "camera", "lightroom", "editing", "portrait", "landscape",
            "wedding", "studio", "lighting", "composition", "aperture", "shutter", "iso",
            "lens", "bokeh", "macro", "street photography", "photojournalism"
        ],
        "Music": [
            "music", "audio", "sound", "recording", "mixing", "mastering", "production",
            "instrument", "guitar", "piano", "vocal", "singing", "composition", "theory",
            "dj", "beat", "melody", "harmony", "rhythm", "studio", "microphone"
        ],
        "Languages": [
            "language", "english", "spanish", "french", "german", "chinese", "japanese",
            "arabic", "learning", "speaking", "grammar", "vocabulary", "pronunciation",
            "conversation", "fluency", "translation", "linguistics", "communication"
        ],
        "Health & Fitness": [
            "health", "fitness", "workout", "exercise", "yoga", "meditation", "nutrition",
            "diet", "weight", "muscle", "cardio", "strength", "wellness", "mental health",
            "therapy", "counseling", "mindfulness", "stress", "anxiety", "depression"
        ],
        "Technology": [
            "technology", "tech", "computer", "software", "hardware", "network", "security",
            "cybersecurity", "cloud", "aws", "azure", "google cloud", "server", "database",
            "system", "administration", "it", "information technology", "blockchain"
        ],
        "Marketing": [
            "marketing", "digital marketing", "seo", "social media", "advertising", "content",
            "email marketing", "affiliate", "influencer", "brand", "campaign", "analytics",
            "conversion", "traffic", "leads", "facebook", "instagram", "twitter", "linkedin"
        ],
        "Education": [
            "education", "teaching", "learning", "course", "tutorial", "training", "study",
            "academic", "school", "university", "student", "teacher", "instructor", "pedagogy",
            "curriculum", "assessment", "classroom", "online learning", "e-learning"
        ]
    }
    
    # حساب النقاط لكل فئة
    category_scores = {}
    for category, keywords in category_keywords.items():
        score = 0
        for keyword in keywords:
            # نقاط إضافية إذا كانت الكلمة في العنوان
            if keyword in title_lower:
                score += 3
            # نقاط أقل إذا كانت في الوصف
            elif keyword in desc_lower:
                score += 1
        category_scores[category] = score
    
    # العثور على أعلى نقاط
    if category_scores:
        best_category = max(category_scores, key=category_scores.get)
        max_score = category_scores[best_category]
        
        # إذا كانت النقاط أكبر من 0، استخدم الفئة المكتشفة
        if max_score > 0:
            return best_category
    
    # فئات احتياطية بناءً على كلمات عامة
    fallback_categories = {
        "course": "Education",
        "complete": "Education", 
        "guide": "Education",
        "beginner": "Education",
        "advanced": "Education",
        "master": "Education",
        "learn": "Education",
        "tutorial": "Education",
        "training": "Education",
        "certification": "Education",
        "professional": "Business",
        "career": "Business",
        "money": "Business",
        "income": "Business",
        "freelance": "Business",
        "online": "Technology",
        "digital": "Technology",
        "app": "Technology",
        "mobile": "Technology",
        "game": "Technology",
        "creative": "Design",
        "art": "Design",
        "video": "Design",
        "animation": "Design"
    }
    
    # البحث في الفئات الاحتياطية
    for keyword, category in fallback_categories.items():
        if keyword in combined_text:
            return category
    
    # إذا لم نجد أي تطابق، استخدم "General" بدلاً من "Other"
    return "General"

def paginate_courses(courses, page, per_page):
    """Paginate courses list"""
    total = len(courses)
    start = (page - 1) * per_page
    end = start + per_page
    
    return {
        'courses': courses[start:end],
        'total': total,
        'pages': math.ceil(total / per_page),
        'current_page': page,
        'has_prev': page > 1,
        'has_next': page < math.ceil(total / per_page),
        'prev_num': page - 1 if page > 1 else None,
        'next_num': page + 1 if page < math.ceil(total / per_page) else None
    }

def search_courses(courses, query):
    """Search courses by title, description, or instructor"""
    if not query:
        return courses
    
    query = query.lower()
    filtered_courses = []
    
    for course in courses:
        if (query in course.get('title', '').lower() or 
            query in course.get('description', '').lower() or 
            query in course.get('instructor', '').lower() or
            query in course.get('category', '').lower()):
            filtered_courses.append(course)
    
    return filtered_courses

def get_related_courses(courses, current_course, limit=4):
    """Get related courses based on category"""
    current_category = current_course.get('category', '')
    current_id = current_course.get('_id', '')
    
    related = []
    for course in courses:
        if (course.get('category', '') == current_category and 
            course.get('_id', '') != current_id and
            course.get('is_published', True)):
            related.append(course)
            if len(related) >= limit:
                break
    
    return related

def format_price(price_str):
    """Format price string"""
    if not price_str:
        return "Free"
    
    # Extract numeric value
    price_match = re.search(r'(\d+(?:\.\d{2})?)', str(price_str))
    if price_match:
        price = float(price_match.group(1))
        if price == 0:
            return "Free"
        return f"${price:.2f}"
    
    return str(price_str)

def format_rating(rating):
    """Format rating for display"""
    try:
        rating_val = float(rating)
        return f"{rating_val:.1f}"
    except (ValueError, TypeError):
        return "4.0"

def format_students_count(count):
    """Format students count for display"""
    try:
        count = int(count)
        if count >= 1000000:
            return f"{count/1000000:.1f}M"
        elif count >= 1000:
            return f"{count/1000:.1f}K"
        else:
            return str(count)
    except (ValueError, TypeError):
        return "New"

def clean_description(description):
    """Clean and truncate description"""
    if not description:
        return ""
    
    # Remove HTML tags
    cleaned = re.sub(r'<[^>]+>', '', description)
    
    # Remove extra whitespace
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    # Truncate if too long
    if len(cleaned) > 300:
        cleaned = cleaned[:297] + "..."
    
    return cleaned

def is_valid_url(url):
    """Check if URL is valid"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def time_ago(date):
    """Return human-readable time ago string"""
    if not isinstance(date, datetime):
        return "Unknown"
    
    now = datetime.utcnow()
    diff = now - date
    
    if diff.days > 30:
        return f"{diff.days // 30} month{'s' if diff.days // 30 > 1 else ''} ago"
    elif diff.days > 0:
        return f"{diff.days} day{'s' if diff.days > 1 else ''} ago"
    elif diff.seconds > 3600:
        hours = diff.seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    elif diff.seconds > 60:
        minutes = diff.seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    else:
        return "Just now"

def generate_course_slug(title):
    """Generate URL-friendly slug from course title"""
    # Convert to lowercase and replace spaces with hyphens
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')

def extract_udemy_course_id(url):
    """Extract course ID from Udemy URL"""
    try:
        # Pattern for Udemy course URLs
        pattern = r'udemy\.com/course/([^/?]+)'
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    except Exception:
        pass
    return None

def validate_course_data(course_data):
    """Validate course data before saving"""
    required_fields = ['title']
    
    for field in required_fields:
        if not course_data.get(field):
            return False, f"Missing required field: {field}"
    
    # Validate URLs if present
    for url_field in ['image_url', 'udemy_url']:
        url = course_data.get(url_field)
        if url and not is_valid_url(url):
            return False, f"Invalid URL in field: {url_field}"
    
    # Validate rating
    rating = course_data.get('rating', 0)
    try:
        rating = float(rating)
        if rating < 0 or rating > 5:
            return False, "Rating must be between 0 and 5"
    except (ValueError, TypeError):
        return False, "Rating must be a valid number"
    
    return True, "Valid"

def safe_int(value, default=0):
    """Safely convert value to integer"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_float(value, default=0.0):
    """Safely convert value to float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def truncate_text(text, length=100, suffix="..."):
    """Truncate text to specified length"""
    if not text:
        return ""
    
    if len(text) <= length:
        return text
    
    return text[:length - len(suffix)] + suffix

def get_students_count(course):
    """Get students count from course data"""
    # Use actual students_count if available
    if course.get('students_count') and course['students_count'] > 0:
        return course['students_count']
    
    # If no data available, return None to hide the field
    return None
