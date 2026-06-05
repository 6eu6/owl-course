// ============================================
// Translations — English Only
// ============================================

type T = Record<string, string>

const t: T = {
  // Header
  siteTagline: 'Free Udemy Courses',
  freeCourses: 'Free Courses',
  refresh: 'Refresh',

  // Hero
  coursesAvailable: 'courses available now',
  autoUpdated: 'Auto updated',
  heroTitle1: 'Learn without',
  heroTitle2: 'limits',
  heroTitle3: '— Free courses',
  heroDesc: '100% free coupons for the best Udemy courses — sign up instantly, keep the course forever',
  searchPlaceholder: 'Search courses... (Python, React, Design...)',

  // Categories
  all: 'All',

  // Sort
  sort: 'Sort',
  newest: 'Newest',
  highestRated: 'Top Rated',
  mostStudents: 'Most Students',
  nameAZ: 'Name A-Z',
  oldest: 'Oldest',

  // Filters
  clearFilters: 'Clear Filters',
  searchLabel: 'Search',
  results: 'results',

  // Grid
  noCourses: 'No courses found',
  noCoursesDesc: 'Try changing filters or check back later',
  prev: 'Prev',
  next: 'Next',
  details: 'Details',
  free: 'Free',
  free100: '100% Free',

  // Detail
  loadingDetail: 'Loading course details...',
  courseNotFound: 'Course not found',
  backHome: 'Back to Home',
  instructor: 'Instructor',
  rating: 'Rating',
  students: 'Students',
  language: 'Language',
  duration: 'Duration',
  originalPrice: 'Original Price',
  lastUpdated: 'Last Updated',
  source: 'Source',
  description: 'Description',
  requirements: 'Requirements',
  whoFor: 'Who this course is for',
  getCourseFree: 'Get this course for free!',
  getCourseFreeDesc: '100% free coupon — direct enrollment on Udemy, no payment',
  goToCourse: 'Go to Course',
  relatedCourses: 'Related Courses',

  // Link page
  aboutCourse: 'About this course',
  importantNotes: 'Important Notes',
  note1: 'The course is completely free with the coupon — no payment required',
  note2: 'The coupon may expire at any time — enroll now',
  note3: 'After free enrollment, you keep the course forever',
  note4: "If the coupon doesn't work, try again later or find another course",
  preparing: 'Preparing course link...',
  getOnUdemy: 'Get this course free on Udemy',
  udemyRedirect: "You'll be redirected to the course page on Udemy — direct enrollment, no payment",
  backToDetail: 'Back to course details',

  // Footer
  footerDesc: 'Platform collecting the best free Udemy courses with 100% coupons — auto updated',
  footerFree: 'Completely Free',
  footerUpdated: 'Auto Updated',
  footerVerified: 'Verified Coupons',
  footerSource: 'Source: UdemyFreebies',
}

export function tx(key: string): string {
  return t[key] || key
}

// ============================================
// Category names
// ============================================

type CatT = Record<string, { name: string; icon: string }>

export const CATEGORIES: CatT = {
  'Marketing':                { name: 'Marketing',          icon: '📢' },
  'IT & Software':            { name: 'IT & Software',      icon: '⚙️' },
  'Data Science':             { name: 'Data Science',       icon: '🤖' },
  'Design':                   { name: 'Design',             icon: '🎨' },
  'Business':                 { name: 'Business',           icon: '💼' },
  'Personal Development':     { name: 'Personal Dev',       icon: '🧠' },
  'Development':              { name: 'Development',        icon: '💻' },
  'Python':                   { name: 'Python',             icon: '🐍' },
  'Cloud & DevOps':           { name: 'Cloud & DevOps',     icon: '☁️' },
  'Cybersecurity':            { name: 'Cybersecurity',      icon: '🔒' },
  'Photography & Video':      { name: 'Photography',       icon: '📷' },
  'Music':                    { name: 'Music',              icon: '🎵' },
  'Languages':                { name: 'Languages',          icon: '🌍' },
  'Finance & Accounting':     { name: 'Finance',            icon: '💰' },
  'Health & Fitness':         { name: 'Health & Fitness',   icon: '💪' },
  'Office Productivity':      { name: 'Productivity',       icon: '📊' },
  'Teaching & Academics':     { name: 'Academics',          icon: '🎓' },
  'Web Development':          { name: 'Web Development',    icon: '💻' },
  'Mobile Development':       { name: 'Mobile Development', icon: '📱' },
  'Data Science & AI':        { name: 'Data Science & AI',  icon: '🤖' },
  'Programming & IT':         { name: 'Programming & IT',   icon: '⚙️' },
  'Digital Marketing':         { name: 'Digital Marketing',  icon: '📢' },
  'Other':                   { name: 'Other',              icon: '📚' },
}

const FALLBACK_CAT: { name: string; icon: string } = { name: 'Other', icon: '📚' }

export function getCat(name: string): { name: string; icon: string } {
  return CATEGORIES[name] || FALLBACK_CAT
}
