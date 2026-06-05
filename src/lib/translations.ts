// ============================================
// i18n Translations — AR / EN
// ============================================

export type Lang = 'ar' | 'en'

type T = Record<string, { ar: string; en: string }>

const t: T = {
  // Header
  siteTagline: { ar: 'دورات يودمي مجانية', en: 'Free Udemy Courses' },
  freeCourses: { ar: 'كورس مجاني', en: 'Free Courses' },
  refresh: { ar: 'تحديث', en: 'Refresh' },

  // Hero
  coursesAvailable: { ar: 'دورة متاحة الآن', en: 'courses available now' },
  autoUpdated: { ar: 'محدّثة تلقائياً', en: 'Auto updated' },
  heroTitle1: { ar: 'تعلّم بدون', en: 'Learn without' },
  heroTitle2: { ar: 'حدود', en: 'limits' },
  heroTitle3: { ar: '— دورات مجانية', en: '— Free courses' },
  heroDesc: { ar: 'كوبونات مجانية 100% لأفضل دورات يودمي — تسجيل مباشر، احتفظ بالدورة مدى الحياة', en: '100% free coupons for the best Udemy courses — sign up instantly, keep the course forever' },
  searchPlaceholder: { ar: 'ابحث عن دورة... (Python, React, Design...)', en: 'Search courses... (Python, React, Design...)' },

  // Categories
  all: { ar: 'الكل', en: 'All' },

  // Sort
  sort: { ar: 'ترتيب', en: 'Sort' },
  newest: { ar: 'الأحدث', en: 'Newest' },
  highestRated: { ar: 'الأعلى تقييماً', en: 'Top Rated' },
  mostStudents: { ar: 'الأكثر طلاباً', en: 'Most Students' },
  nameAZ: { ar: 'الاسم A-Z', en: 'Name A-Z' },
  oldest: { ar: 'الأقدم', en: 'Oldest' },

  // Filters
  clearFilters: { ar: 'مسح الفلاتر', en: 'Clear Filters' },
  searchLabel: { ar: 'بحث', en: 'Search' },
  results: { ar: 'نتيجة', en: 'results' },

  // Grid
  noCourses: { ar: 'لا توجد دورات', en: 'No courses found' },
  noCoursesDesc: { ar: 'جرّب تغيير الفلاتر أو عد لاحقاً', en: 'Try changing filters or check back later' },
  prev: { ar: 'السابق', en: 'Prev' },
  next: { ar: 'التالي', en: 'Next' },
  details: { ar: 'التفاصيل', en: 'Details' },
  free: { ar: 'مجاني', en: 'Free' },
  free100: { ar: 'مجاني 100%', en: '100% Free' },

  // Detail
  loadingDetail: { ar: 'جارٍ تحميل تفاصيل الدورة...', en: 'Loading course details...' },
  courseNotFound: { ar: 'لم يتم العثور على الدورة', en: 'Course not found' },
  backHome: { ar: 'العودة للرئيسية', en: 'Back to Home' },
  instructor: { ar: 'المدرب', en: 'Instructor' },
  rating: { ar: 'التقييم', en: 'Rating' },
  students: { ar: 'الطلاب', en: 'Students' },
  language: { ar: 'اللغة', en: 'Language' },
  duration: { ar: 'المدة', en: 'Duration' },
  originalPrice: { ar: 'السعر الأصلي', en: 'Original Price' },
  lastUpdated: { ar: 'آخر تحديث', en: 'Last Updated' },
  source: { ar: 'المصدر', en: 'Source' },
  description: { ar: 'وصف الدورة', en: 'Description' },
  requirements: { ar: 'المتطلبات', en: 'Requirements' },
  whoFor: { ar: 'لمن هذه الدورة', en: 'Who this course is for' },
  getCourseFree: { ar: 'احصل على هذه الدورة مجاناً!', en: 'Get this course for free!' },
  getCourseFreeDesc: { ar: 'كوبون مجاني 100% — تسجيل مباشر على يودمي بدون دفع', en: '100% free coupon — direct enrollment on Udemy, no payment' },
  goToCourse: { ar: 'الذهاب للدورة', en: 'Go to Course' },
  relatedCourses: { ar: 'دورات مشابهة', en: 'Related Courses' },

  // Link page
  aboutCourse: { ar: 'عن هذه الدورة', en: 'About this course' },
  importantNotes: { ar: 'ملاحظات مهمة', en: 'Important Notes' },
  note1: { ar: 'الدورة مجانية تماماً مع الكوبون — لن يُطلب منك دفع أي مبلغ', en: 'The course is completely free with the coupon — no payment required' },
  note2: { ar: 'الكوبون قد ينتهي في أي وقت — سارع بالتسجيل', en: 'The coupon may expire at any time — enroll now' },
  note3: { ar: 'بعد التسجيل المجاني، ستحتفظ بالدورة مدى الحياة', en: 'After free enrollment, you keep the course forever' },
  note4: { ar: 'إذا لم يعمل الكوبون، جرب مرة أخرى لاحقاً أو ابحث عن دورة أخرى', en: "If the coupon doesn't work, try again later or find another course" },
  preparing: { ar: 'جارٍ تجهيز رابط الدورة...', en: 'Preparing course link...' },
  getOnUdemy: { ar: 'احصل على الدورة مجاناً على Udemy', en: 'Get this course free on Udemy' },
  udemyRedirect: { ar: 'سيتم توجيهك إلى صفحة الدورة على يودمي — اشتراك مباشر بدون دفع', en: "You'll be redirected to the course page on Udemy — direct enrollment, no payment" },
  backToDetail: { ar: 'العودة لتفاصيل الدورة', en: 'Back to course details' },

  // Footer
  footerDesc: { ar: 'منصة تجمع أفضل الدورات المجانية من يودمي مع كوبونات 100% — محدّثة تلقائياً', en: 'Platform collecting the best free Udemy courses with 100% coupons — auto updated' },
  footerFree: { ar: 'مجاني بالكامل', en: 'Completely Free' },
  footerUpdated: { ar: 'محدّث تلقائياً', en: 'Auto Updated' },
  footerVerified: { ar: 'كوبونات مضمونة', en: 'Verified Coupons' },
  footerSource: { ar: 'المصدر: UdemyFreebies', en: 'Source: UdemyFreebies' },
}

export function tx(key: keyof T, lang: Lang): string {
  return t[key]?.[lang] || t[key]?.en || key
}

// ============================================
// Category names bilingual
// ============================================

type CatT = Record<string, { ar: string; en: string; icon: string }>

export const CATEGORIES: CatT = {
  'Marketing':                { ar: 'التسويق الرقمي',  en: 'Marketing',          icon: '📢' },
  'IT & Software':            { ar: 'البرمجة و IT',    en: 'IT & Software',      icon: '⚙️' },
  'Data Science':             { ar: 'علوم البيانات',    en: 'Data Science',       icon: '🤖' },
  'Design':                   { ar: 'التصميم',         en: 'Design',             icon: '🎨' },
  'Business':                 { ar: 'إدارة الأعمال',   en: 'Business',           icon: '💼' },
  'Personal Development':     { ar: 'التطوير الشخصي',  en: 'Personal Dev',       icon: '🧠' },
  'Development':              { ar: 'تطوير الويب',     en: 'Development',        icon: '💻' },
  'Web Development':          { ar: 'تطوير الويب',     en: 'Web Dev',            icon: '💻' },
  'Mobile Development':       { ar: 'تطوير التطبيقات', en: 'Mobile Dev',         icon: '📱' },
  'Python':                   { ar: 'بايثون',          en: 'Python',             icon: '🐍' },
  'Cloud & DevOps':           { ar: 'السحابة و DevOps',en: 'Cloud & DevOps',     icon: '☁️' },
  'Cybersecurity':            { ar: 'الأمن السيبراني',  en: 'Cybersecurity',      icon: '🔒' },
  'Photography & Video':      { ar: 'التصوير والفيديو',en: 'Photography',       icon: '📷' },
  'Music':                    { ar: 'الموسيقى',        en: 'Music',              icon: '🎵' },
  'Languages':                { ar: 'اللغات',          en: 'Languages',          icon: '🌍' },
  'Finance & Accounting':     { ar: 'التمويل والمحاسبة',en:'Finance',           icon: '💰' },
  'Health & Fitness':          { ar: 'الصحة واللياقة',  en: 'Health & Fitness',   icon: '💪' },
  'Office Productivity':      { ar: 'الإنتاجية',       en: 'Productivity',       icon: '📊' },
  'Teaching & Academics':     { ar: 'التعليم',         en: 'Academics',          icon: '🎓' },
  // Arabic fallbacks
  'تطوير الويب':              { ar: 'تطوير الويب',     en: 'Web Development',   icon: '💻' },
  'تطوير التطبيقات':           { ar: 'تطوير التطبيقات', en: 'Mobile Dev',         icon: '📱' },
  'علوم البيانات والذكاء الاصطناعي': { ar: 'علوم البيانات والذكاء الاصطناعي', en: 'Data Science & AI', icon: '🤖' },
  'بايثون':                    { ar: 'بايثون',          en: 'Python',              icon: '🐍' },
  'السحابة و DevOps':         { ar: 'السحابة و DevOps',en: 'Cloud & DevOps',     icon: '☁️' },
  'الأمن السيبراني':           { ar: 'الأمن السيبراني',  en: 'Cybersecurity',      icon: '🔒' },
  'التصميم':                   { ar: 'التصميم',         en: 'Design',             icon: '🎨' },
  'التسويق الرقمي':            { ar: 'التسويق الرقمي',  en: 'Digital Marketing',  icon: '📢' },
  'إدارة الأعمال':             { ar: 'إدارة الأعمال',   en: 'Business',           icon: '💼' },
  'البرمجة و IT':              { ar: 'البرمجة و IT',    en: 'Programming & IT',   icon: '⚙️' },
  'التصوير والفيديو':           { ar: 'التصوير والفيديو',en: 'Photography',       icon: '📷' },
  'التطوير الشخصي':             { ar: 'التطوير الشخصي',  en: 'Personal Dev',       icon: '🧠' },
  'الموسيقى':                  { ar: 'الموسيقى',        en: 'Music',              icon: '🎵' },
  'اللغات':                    { ar: 'اللغات',          en: 'Languages',          icon: '🌍' },
  'التمويل والمحاسبة':          { ar: 'التمويل والمحاسبة',en:'Finance',           icon: '💰' },
  'الصحة واللياقة':            { ar: 'الصحة واللياقة',  en: 'Health & Fitness',   icon: '💪' },
  'أخرى':                     { ar: 'أخرى',            en: 'Other',              icon: '📚' },
  'علوم البيانات':              { ar: 'علوم البيانات',    en: 'Data Science',       icon: '🤖' },
}

const FALLBACK_CAT = { ar: 'أخرى', en: 'Other', icon: '📚' }

export function getCat(name: string) {
  return CATEGORIES[name] || FALLBACK_CAT
}
