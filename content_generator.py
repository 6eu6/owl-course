"""
نظام توليد المحتوى الموحد - OWL COURSE Content Generator
ملف واحد شامل لتوليد محتوى متنوع وفريد لجميع الدورات
"""

import random
import hashlib
from typing import Dict, List, Any

class ContentGenerator:
    def __init__(self):
        """تهيئة مولد المحتوى الموحد"""
        
        # قوالب متنوعة للمقدمات
        self.intro_templates = [
            "Discover the transformative power of {title} through this comprehensive educational journey designed to elevate your expertise and unlock new professional opportunities in {category}.",
            "Embark on an enriching learning adventure with {title}, where cutting-edge knowledge meets practical application in the dynamic field of {category}.",
            "Transform your professional trajectory with {title}, a meticulously crafted learning experience that bridges theoretical foundations with real-world {category} mastery.",
            "Unlock your potential through {title}, an innovative educational program that combines industry insights with hands-on expertise in {category}.",
            "Experience excellence in education with {title}, where comprehensive learning meets professional growth in the ever-evolving landscape of {category}.",
            "Advance your career with {title}, a strategic learning initiative designed to provide deep insights and practical skills in {category}.",
            "Master the art and science of {category} through {title}, an immersive educational experience crafted by industry experts.",
            "Elevate your professional standing with {title}, a comprehensive program that transforms theoretical knowledge into practical {category} expertise."
        ]
        
        # مرادفات متقدمة وموسعة للكلمات الشائعة
        self.synonyms = {
            "comprehensive": ["extensive", "thorough", "complete", "all-encompassing", "detailed", "in-depth", "holistic", "wide-ranging", "exhaustive", "systematic", "encyclopedic", "panoramic", "full-spectrum", "encompassing", "overarching"],
            "practical": ["hands-on", "applied", "real-world", "actionable", "implementable", "pragmatic", "operational", "workable", "functional", "realistic", "utilitarian", "executable", "deployable", "field-tested", "solution-oriented"],
            "advanced": ["sophisticated", "cutting-edge", "progressive", "innovative", "state-of-the-art", "modern", "next-level", "pioneering", "breakthrough", "revolutionary", "avant-garde", "forward-thinking", "futuristic", "next-generation", "bleeding-edge"],
            "professional": ["industry-standard", "expert-level", "career-focused", "workplace-ready", "commercial", "enterprise-grade", "business-oriented", "corporate", "vocational", "specialized", "executive-level", "institutional", "organizational", "commercial-grade", "professional-caliber"],
            "skills": ["competencies", "abilities", "expertise", "proficiencies", "capabilities", "talents", "aptitudes", "techniques", "methods", "approaches", "acumen", "dexterity", "finesse", "prowess", "mastery"],
            "knowledge": ["understanding", "insights", "expertise", "wisdom", "information", "learning", "awareness", "comprehension", "mastery", "intelligence", "cognition", "perception", "enlightenment", "scholarship", "erudition"],
            "develop": ["cultivate", "enhance", "build", "strengthen", "improve", "advance", "refine", "expand", "evolve", "foster", "nurture", "hone", "sharpen", "amplify", "elevate"],
            "learn": ["master", "acquire", "discover", "explore", "understand", "grasp", "absorb", "study", "investigate", "examine", "comprehend", "internalize", "assimilate", "digest", "familiarize"],
            "course": ["program", "curriculum", "training", "educational journey", "learning path", "study program", "workshop", "bootcamp", "certification", "specialization", "academy", "masterclass", "seminar", "intensive", "expedition"],
            "experience": ["expertise", "background", "exposure", "practice", "familiarity", "involvement", "engagement", "participation", "immersion", "interaction", "encounter", "journey", "exploration", "adventure", "odyssey"],
            "programming": ["coding", "software development", "application building", "system design", "algorithm creation", "computational thinking", "software engineering", "code crafting", "digital architecture", "solution engineering", "system programming"],
            "through": ["via", "using", "by means of", "utilizing", "employing", "leveraging", "with the help of", "by way of", "by virtue of", "through the medium of", "courtesy of", "facilitated by", "enabled by", "powered by", "guided by"],
            "industry": ["sector", "field", "domain", "marketplace", "business world", "commercial sphere", "professional arena", "market segment", "vertical", "ecosystem", "landscape", "territory", "frontier", "realm", "province"],
            "essential": ["crucial", "vital", "fundamental", "critical", "important", "necessary", "key", "primary", "core", "pivotal", "indispensable", "paramount", "requisite", "imperative", "cornerstone"],
            "real": ["actual", "genuine", "authentic", "practical", "concrete", "tangible", "live", "working", "legitimate", "bona fide", "substantive", "material", "factual", "veritable", "legitimate"],
            "world": ["environment", "setting", "context", "landscape", "sphere", "realm", "domain", "space", "universe", "ecosystem", "habitat", "milieu", "arena", "theater", "stage"],
            "create": ["build", "construct", "develop", "design", "craft", "engineer", "fabricate", "generate", "produce", "establish", "forge", "architect", "formulate", "conceive", "originate"],
            "system": ["framework", "structure", "architecture", "platform", "infrastructure", "mechanism", "methodology", "approach", "protocol", "schema", "blueprint", "paradigm", "model", "foundation", "scaffold"],
            "solution": ["answer", "resolution", "approach", "method", "strategy", "technique", "remedy", "fix", "response", "pathway", "formula", "blueprint", "roadmap", "framework", "protocol"],
            "technology": ["tech", "innovation", "advancement", "tool", "platform", "system", "framework", "methodology", "technique", "approach", "mechanism", "apparatus", "infrastructure", "ecosystem", "paradigm"]
        }
        
        # قوالب متنوعة ومحسنة لنتائج التعلم
        self.learning_outcome_templates = [
            "Achieve {skill_level} mastery in {specific_area} using modern frameworks and methodologies",
            "Navigate complex {specific_area} challenges with confidence and systematic approaches",
            "Implement cutting-edge {specific_area} solutions for contemporary workplace demands",
            "Synthesize {specific_area} theory into practical applications across diverse scenarios",
            "Engineer robust {specific_area} systems following enterprise-grade standards",
            "Optimize {specific_area} workflows using data-driven performance techniques",
            "Architect scalable {specific_area} solutions with innovative design patterns",
            "Troubleshoot sophisticated {specific_area} problems using analytical methodologies",
            "Construct efficient {specific_area} frameworks tailored to specific requirements",
            "Accelerate {specific_area} development using automation and optimization tools",
            "Decode advanced {specific_area} concepts through interactive learning experiences",
            "Refine {specific_area} expertise with mentor-guided professional development",
            "Unlock {specific_area} potential through structured skill-building exercises",
            "Establish {specific_area} foundations while advancing toward expert-level competency",
            "Streamline {specific_area} processes using contemporary productivity methodologies"
        ]
        
        # قوالب الفوائد المحسنة
        self.benefit_templates = [
            "Amplify your {benefit_type} impact using innovative {category} methodologies",
            "Distinguish yourself professionally with specialized {category} certifications",
            "Elevate career trajectory through {category} expertise and practical application",
            "Position yourself as {category} leader in competitive marketplace environments",
            "Diversify skillset portfolio with contemporary {category} frameworks and tools",
            "Capitalize on emerging {category} trends for sustained professional growth",
            "Strengthen market value through verified {category} competencies and achievements",
            "Leverage {category} mastery for entrepreneurial ventures and consulting opportunities",
            "Command higher compensation through demonstrated {category} excellence",
            "Access exclusive {category} networks and mentorship opportunities",
            "Future-proof career path with adaptable {category} skills and knowledge",
            "Establish thought leadership position in {category} communities and forums",
            "Optimize workflow efficiency using {category} automation and optimization techniques",
            "Bridge technical gaps with cross-functional {category} communication abilities",
            "Generate measurable business value through strategic {category} implementations"
        ]
        
        # مناطق متخصصة موسعة حسب الفئة مع مستويات متدرجة
        self.category_specializations = {
            "Programming": {
                "beginner": ["coding fundamentals", "programming logic", "syntax mastery", "basic algorithms", "problem solving", "code structure"],
                "intermediate": ["software development", "object-oriented programming", "data structures", "debugging techniques", "version control", "testing methodologies"],
                "advanced": ["system architecture", "design patterns", "performance optimization", "advanced algorithms", "code review", "software engineering principles"],
                "expert": ["distributed systems", "microservices architecture", "scalability design", "advanced optimization", "technical leadership", "innovation strategy"]
            },
            "Web Development": {
                "beginner": ["HTML basics", "CSS styling", "responsive design", "web fundamentals", "browser compatibility", "user interface basics"],
                "intermediate": ["frontend frameworks", "backend development", "database integration", "API development", "web security", "performance optimization"],
                "advanced": ["full-stack architecture", "microservices", "cloud deployment", "advanced security", "scalability patterns", "modern frameworks"],
                "expert": ["enterprise architecture", "distributed systems", "advanced optimization", "technical strategy", "platform engineering", "innovation leadership"]
            },
            "Data Science": {
                "beginner": ["data analysis", "statistical basics", "data visualization", "spreadsheet skills", "basic reporting", "data interpretation"],
                "intermediate": ["machine learning", "statistical modeling", "data mining", "predictive analytics", "data processing", "visualization tools"],
                "advanced": ["deep learning", "advanced analytics", "big data technologies", "model optimization", "feature engineering", "advanced statistics"],
                "expert": ["AI research", "advanced algorithms", "distributed computing", "model architecture", "research methodology", "innovation strategy"]
            },
            "Business": {
                "beginner": ["business fundamentals", "basic planning", "communication skills", "team collaboration", "problem solving", "analytical thinking"],
                "intermediate": ["strategic planning", "project management", "leadership skills", "financial analysis", "market research", "operations management"],
                "advanced": ["executive strategy", "organizational transformation", "advanced analytics", "change management", "strategic innovation", "performance optimization"],
                "expert": ["corporate strategy", "digital transformation", "executive leadership", "strategic vision", "organizational excellence", "industry disruption"]
            },
            "Design": {
                "beginner": ["design principles", "color theory", "typography basics", "layout fundamentals", "creative thinking", "visual communication"],
                "intermediate": ["user interface design", "user experience", "design tools", "branding concepts", "digital design", "design systems"],
                "advanced": ["advanced UX/UI", "design strategy", "brand architecture", "design leadership", "innovation design", "design thinking"],
                "expert": ["design direction", "creative strategy", "design innovation", "design transformation", "creative leadership", "design excellence"]
            },
            "Languages": {
                "beginner": ["basic vocabulary", "pronunciation", "grammar fundamentals", "simple conversation", "reading comprehension", "listening skills"],
                "intermediate": ["conversational fluency", "advanced grammar", "cultural understanding", "professional communication", "writing skills", "comprehension"],
                "advanced": ["business language", "advanced communication", "cultural nuances", "professional writing", "presentation skills", "negotiation"],
                "expert": ["native proficiency", "specialized terminology", "cross-cultural communication", "linguistic expertise", "translation skills", "language mastery"]
            },
            "Technology": {
                "beginner": ["technology basics", "computer fundamentals", "software usage", "digital literacy", "basic troubleshooting", "system navigation"],
                "intermediate": ["system administration", "network basics", "cybersecurity fundamentals", "cloud basics", "automation introduction", "technical skills"],
                "advanced": ["enterprise systems", "advanced security", "cloud architecture", "automation engineering", "infrastructure design", "technical leadership"],
                "expert": ["technology strategy", "enterprise architecture", "innovation leadership", "technical vision", "digital transformation", "technology excellence"]
            },
            "Education": {
                "beginner": ["teaching basics", "classroom management", "lesson planning", "student engagement", "educational tools", "learning assessment"],
                "intermediate": ["curriculum development", "instructional design", "educational technology", "assessment strategies", "learning theories", "teaching methods"],
                "advanced": ["educational leadership", "curriculum innovation", "advanced pedagogy", "educational research", "program development", "institutional design"],
                "expert": ["educational strategy", "institutional transformation", "educational innovation", "academic leadership", "educational excellence", "systemic change"]
            },
            "Other": {
                "beginner": ["professional basics", "skill development", "career foundation", "workplace skills", "personal development", "professional communication"],
                "intermediate": ["career advancement", "professional expertise", "industry knowledge", "specialized skills", "leadership development", "performance improvement"],
                "advanced": ["expert-level mastery", "thought leadership", "innovation strategies", "advanced specialization", "professional excellence", "industry expertise"],
                "expert": ["mastery achievement", "industry leadership", "strategic expertise", "professional transformation", "excellence standards", "innovation mastery"]
            }
        }
        
        # مستويات المهارات
        self.skill_levels = ["fundamental", "intermediate", "advanced", "expert", "specialized", "comprehensive"]
        
        # أنواع الفوائد
        self.benefit_types = ["career", "professional", "personal", "technical", "industry", "leadership", "strategic", "creative"]

    def get_random_synonym(self, word: str) -> str:
        """الحصول على مرادف عشوائي للكلمة"""
        if word in self.synonyms:
            return random.choice(self.synonyms[word])
        return word

    def generate_unique_seed(self, title: str, category: str, content_type: str) -> int:
        """توليد بذرة فريدة للمحتوى"""
        combined_string = f"{title}_{category}_{content_type}"
        return int(hashlib.md5(combined_string.encode()).hexdigest()[:8], 16)

    def diversify_text(self, text: str) -> str:
        """تنويع النص باستخدام المرادفات"""
        words = text.split()
        diversified_words = []
        
        for word in words:
            clean_word = word.strip('.,!?;:')
            replacement = self.get_random_synonym(clean_word.lower())
            if replacement != clean_word.lower():
                diversified_words.append(replacement.capitalize() if clean_word[0].isupper() else replacement)
            else:
                diversified_words.append(word)
        
        return ' '.join(diversified_words)

    def detect_course_level(self, title: str) -> str:
        """كشف مستوى الدورة من العنوان"""
        title_lower = title.lower()
        
        # مؤشرات المستوى المتقدم
        expert_indicators = ["expert", "mastery", "advanced professional", "enterprise", "architect", "senior", "lead", "master"]
        advanced_indicators = ["advanced", "pro", "deep dive", "comprehensive", "complete guide", "full course"]
        intermediate_indicators = ["intermediate", "practical", "hands-on", "real-world", "project-based", "applied"]
        beginner_indicators = ["beginner", "basics", "fundamentals", "introduction", "getting started", "crash course", "101", "starter"]
        
        # تحليل العنوان بدقة
        for indicator in expert_indicators:
            if indicator in title_lower:
                return "expert"
        
        for indicator in advanced_indicators:
            if indicator in title_lower:
                return "advanced"
                
        for indicator in intermediate_indicators:
            if indicator in title_lower:
                return "intermediate"
                
        for indicator in beginner_indicators:
            if indicator in title_lower:
                return "beginner"
        
        # افتراضي: متوسط
        return "intermediate"

    def get_smart_specializations(self, category: str, level: str) -> List[str]:
        """الحصول على التخصصات الذكية حسب الفئة والمستوى"""
        if category in self.category_specializations:
            if level in self.category_specializations[category]:
                return self.category_specializations[category][level]
            else:
                return self.category_specializations[category]["intermediate"]
        else:
            return self.category_specializations["Other"][level]

    def generate_learning_outcomes(self, title: str, category: str, count: int = 8) -> List[str]:
        """توليد نتائج تعلم ذكية ومخصصة حسب المستوى"""
        seed = self.generate_unique_seed(title, category, "learning_outcomes")
        random.seed(seed)
        
        # كشف مستوى الدورة تلقائياً
        course_level = self.detect_course_level(title)
        
        # الحصول على التخصصات المناسبة للمستوى
        specializations = self.get_smart_specializations(category, course_level)
        
        outcomes = []
        
        for i in range(count):
            template = random.choice(self.learning_outcome_templates)
            skill_level = random.choice(self.skill_levels)
            specific_area = random.choice(specializations)
            
            outcome = template.format(
                skill_level=skill_level,
                specific_area=specific_area,
                category=category.lower()
            )
            
            outcome = self.diversify_text(outcome)
            outcomes.append(outcome)
        
        return outcomes

    def generate_course_benefits(self, title: str, category: str, count: int = 8) -> List[str]:
        """توليد فوائد متنوعة للدورة"""
        seed = self.generate_unique_seed(title, category, "benefits")
        random.seed(seed)
        
        benefits = []
        
        for i in range(count):
            template = random.choice(self.benefit_templates)
            benefit_type = random.choice(self.benefit_types)
            
            benefit = template.format(
                benefit_type=benefit_type,
                category=category.lower()
            )
            
            benefit = self.diversify_text(benefit)
            benefits.append(benefit)
        
        return benefits

    def generate_comprehensive_overview(self, title: str, category: str) -> str:
        """توليد نظرة عامة شاملة ومتنوعة"""
        seed = self.generate_unique_seed(title, category, "overview")
        random.seed(seed)
        
        intro = random.choice(self.intro_templates).format(title=title, category=category)
        intro = self.diversify_text(intro)
        
        # إضافة محتوى إضافي متنوع
        additional_content = [
            f"This {self.get_random_synonym('comprehensive')} learning experience integrates theoretical foundations with practical applications.",
            f"Students will engage with {self.get_random_synonym('advanced')} methodologies while developing essential {category.lower()} competencies.",
            f"The curriculum emphasizes real-world problem-solving and professional skill development.",
            f"Expert instructors provide personalized guidance throughout your learning journey."
        ]
        
        random.shuffle(additional_content)
        selected_content = random.sample(additional_content, 2)
        
        overview = intro + " " + " ".join(selected_content)
        return self.diversify_text(overview)

    def generate_course_structure(self, title: str, category: str, count: int = 6) -> List[str]:
        """توليد هيكل الدورة"""
        seed = self.generate_unique_seed(title, category, "structure")
        random.seed(seed)
        
        # كشف مستوى الدورة واختيار التخصصات المناسبة
        course_level = self.detect_course_level(title)
        specializations = self.get_smart_specializations(category, course_level)
        
        # التأكد من أن specializations هي قائمة
        if isinstance(specializations, dict):
            specializations = specializations.get("intermediate", ["professional development", "skill enhancement"])
        
        structure_templates = [
            "Introduction to {area} fundamentals and core principles",
            "Advanced {area} techniques and best practices",
            "Practical {area} implementation and real-world applications",
            "Industry insights and {area} case studies",
            "Hands-on {area} projects and portfolio development",
            "Expert {area} strategies and professional development",
            "Assessment and certification in {area} competencies"
        ]
        
        structure = []
        used_areas = []
        
        for i in range(count):
            template = random.choice(structure_templates)
            # التأكد من وجود تخصصات متاحة
            available_specs = [spec for spec in specializations if spec not in used_areas]
            if not available_specs:
                # إعادة تعيين القائمة إذا تم استنفاد جميع التخصصات
                used_areas = []
                available_specs = specializations
            
            area = random.choice(available_specs)
            used_areas.append(area)
            
            module = template.format(area=area)
            structure.append(self.diversify_text(module))
        
        return structure

    def generate_key_features(self, title: str, category: str, count: int = 6) -> List[str]:
        """توليد الميزات الرئيسية"""
        seed = self.generate_unique_seed(title, category, "features")
        random.seed(seed)
        
        feature_templates = [
            "Comprehensive {category} curriculum designed by industry experts",
            "Interactive learning modules with practical exercises",
            "Real-world projects to build your professional portfolio",
            "Expert instructor support and personalized feedback",
            "Flexible learning schedule that fits your lifestyle",
            "Industry-recognized certification upon completion",
            "Access to exclusive {category} resources and tools",
            "Lifetime access to course materials and updates"
        ]
        
        features = []
        
        for i in range(count):
            template = random.choice(feature_templates)
            feature = template.format(category=category.lower())
            features.append(self.diversify_text(feature))
        
        return features

    def generate_course_content(self, course: Dict[str, Any]) -> Dict[str, Any]:
        """الوظيفة الرئيسية لتوليد محتوى شامل للدورة"""
        title = course.get('title', 'Professional Development Course')
        category = course.get('category', 'General')
        
        # توليد المحتوى الشامل
        content = {
            "overview": self.generate_comprehensive_overview(title, category),
            "description": self.generate_comprehensive_overview(title, category)[:200] + "...",
            "what_you_learn": self.generate_learning_outcomes(title, category, 8),
            "course_benefits": self.generate_course_benefits(title, category, 6),
            "course_structure": self.generate_course_structure(title, category, 5),
            "key_features": self.generate_key_features(title, category, 6),
            "target_audience": [
                f"Professionals seeking to advance their {category.lower()} expertise",
                f"Students pursuing {category.lower()} education and career development",
                f"Entrepreneurs looking to enhance their {category.lower()} knowledge",
                f"Career changers transitioning into {category.lower()} fields"
            ]
        }
        
        return content

# دالة الواجهة الرئيسية
def generate_course_content(course):
    """دالة موحدة لتوليد محتوى الدورة"""
    generator = ContentGenerator()
    return generator.generate_course_content(course)