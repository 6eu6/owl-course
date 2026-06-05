'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  BookOpen,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Filter,
  X,
  RefreshCw,
  User,
  Star,
  Users,
  Globe,
  Clock,
  Loader2,
  ArrowRight,
  Gift,
  ArrowLeft,
  AlertTriangle,
  Shield,
  CheckCircle,
  Calendar,
  TrendingUp,
  Sparkles,
  Tag,
  Heart,
  Flame,
} from 'lucide-react'

// ============================================
// Types
// ============================================

interface Course {
  id: string
  title: string
  slug: string
  description: string
  instructor: string
  category: string
  image_url: string
  udemy_url?: string
  source: string
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  scraped_at: string
}

interface CourseDetail {
  id: string
  title: string
  slug: string
  description: string
  instructor: string
  category: string
  image_url: string
  udemy_url: string
  udemyUrl: string
  source: string
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  duration: string | null
  requirements: string
  whoFor: string
  whatLearn: string
  lastUpdated: string | null
  couponCode: string | null
  scraped_at: string
}

interface CategoryInfo {
  name: string
  count: number
}

type View = 'grid' | 'detail' | 'link'

// ============================================
// English → Arabic category mapping
// ============================================

const CATEGORY_TRANSLATE: Record<string, { ar: string; icon: string; color: string }> = {
  'Marketing': { ar: 'التسويق الرقمي', icon: '📢', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  'IT & Software': { ar: 'البرمجة و IT', icon: '⚙️', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  'Data Science': { ar: 'علوم البيانات', icon: '🤖', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  'Design': { ar: 'التصميم', icon: '🎨', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  'Business': { ar: 'إدارة الأعمال', icon: '💼', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'Personal Development': { ar: 'التطوير الشخصي', icon: '🧠', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'Development': { ar: 'تطوير الويب', icon: '💻', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Web Development': { ar: 'تطوير الويب', icon: '💻', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Mobile Development': { ar: 'تطوير التطبيقات', icon: '📱', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  'Python': { ar: 'بايثون', icon: '🐍', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  'Cloud & DevOps': { ar: 'السحابة و DevOps', icon: '☁️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  'Cybersecurity': { ar: 'الأمن السيبراني', icon: '🔒', color: 'bg-red-50 text-red-700 border-red-200' },
  'Photography & Video': { ar: 'التصوير والفيديو', icon: '📷', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  'Music': { ar: 'الموسيقى', icon: '🎵', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'Languages': { ar: 'اللغات', icon: '🌍', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'Finance & Accounting': { ar: 'التمويل والمحاسبة', icon: '💰', color: 'bg-green-50 text-green-700 border-green-200' },
  'Health & Fitness': { ar: 'الصحة واللياقة', icon: '💪', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  'Office Productivity': { ar: 'الإنتاجية', icon: '📊', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'Teaching & Academics': { ar: 'التعليم', icon: '🎓', color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// Fallback for unknown categories
const DEFAULT_CAT = { ar: 'أخرى', icon: '📚', color: 'bg-gray-50 text-gray-700 border-gray-200' }

// Also support direct Arabic keys (backward compat)
const ARABIC_CATEGORY_MAP: Record<string, { ar: string; icon: string; color: string }> = {
  'تطوير الويب': { ar: 'تطوير الويب', icon: '💻', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'تطوير التطبيقات': { ar: 'تطوير التطبيقات', icon: '📱', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'علوم البيانات والذكاء الاصطناعي': { ar: 'علوم البيانات والذكاء الاصطناعي', icon: '🤖', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  'بايثون': { ar: 'بايثون', icon: '🐍', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'السحابة وال devops': { ar: 'السحابة و DevOps', icon: '☁️', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  'الأمن السيبراني': { ar: 'الأمن السيبراني', icon: '🔒', color: 'bg-red-50 text-red-700 border-red-200' },
  'التصميم': { ar: 'التصميم', icon: '🎨', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  'التسويق الرقمي': { ar: 'التسويق الرقمي', icon: '📢', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  'إدارة الأعمال': { ar: 'إدارة الأعمال', icon: '💼', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  'البرمجة و IT': { ar: 'البرمجة و IT', icon: '⚙️', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  'التصوير والفيديو': { ar: 'التصوير والفيديو', icon: '📷', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  'التطوير الشخصي': { ar: 'التطوير الشخصي', icon: '🧠', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  'الموسيقى': { ar: 'الموسيقى', icon: '🎵', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200' },
  'اللغات': { ar: 'اللغات', icon: '🌍', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'التمويل والمحاسبة': { ar: 'التمويل والمحاسبة', icon: '💰', color: 'bg-green-50 text-green-700 border-green-200' },
  'الصحة واللياقة': { ar: 'الصحة واللياقة', icon: '💪', color: 'bg-lime-50 text-lime-700 border-lime-200' },
  'أخرى': { ar: 'أخرى', icon: '📚', color: 'bg-gray-50 text-gray-700 border-gray-200' },
  'علوم البيانات': { ar: 'علوم البيانات', icon: '🤖', color: 'bg-rose-50 text-rose-700 border-rose-200' },
}

function getCatInfo(name: string) {
  return CATEGORY_TRANSLATE[name] || ARABIC_CATEGORY_MAP[name] || DEFAULT_CAT
}

// ============================================
// Main Component
// ============================================

export default function Home() {
  // Grid view state
  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)

  // View state
  const [view, setView] = useState<View>('grid')
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null)
  const [relatedCourses, setRelatedCourses] = useState<Course[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // ============================================
  // Fetch courses
  // ============================================

  const fetchCourses = useCallback(async (p: number, s: string, cat: string, sortVal: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '12',
      })
      if (s) params.set('search', s)
      if (cat) params.set('category', cat)
      if (sortVal) params.set('sort', sortVal)

      const res = await fetch(`/api/courses?${params}`)
      const data = await res.json()
      setCourses(data.courses || [])
      setCategories((data.filters?.categories || []).map((c: { name: string; count: number }) => ({
        name: typeof c === 'string' ? c : c.name,
        count: typeof c === 'string' ? 0 : c.count,
      })))
      setTotalPages(data.pagination?.total_pages || 1)
      setTotalCourses(data.pagination?.total || 0)
      setTotal(data.stats?.total_courses || 0)
    } catch {
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCourses(page, search, selectedCategory, sort)
  }, [page, search, selectedCategory, sort, fetchCourses])

  // Debounced search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      fetchCourses(1, value, selectedCategory, sort)
    }, 300)
  }

  const handleCategory = (value: string) => {
    const cat = value === 'all' ? '' : value
    setSelectedCategory(cat)
    setPage(1)
    fetchCourses(1, search, cat, sort)
  }

  const handleSort = (value: string) => {
    setSort(value)
    setPage(1)
    fetchCourses(1, search, selectedCategory, value)
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedCategory('')
    setSort('newest')
    setPage(1)
    fetchCourses(1, '', '', 'newest')
  }

  const hasActiveFilters = search || selectedCategory || sort !== 'newest'

  // ============================================
  // Course detail
  // ============================================

  const openCourseDetail = async (slug: string) => {
    setDetailLoading(true)
    setView('detail')
    setSelectedCourse(null)
    setRelatedCourses([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch(`/api/courses/${slug}`)
      const data = await res.json()
      if (data.course) {
        setSelectedCourse(data.course)
        setRelatedCourses(data.related || [])
      } else {
        setView('grid')
      }
    } catch {
      setView('grid')
    } finally {
      setDetailLoading(false)
    }
  }

  const goToLinkPage = () => {
    setView('link')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBackToGrid = () => {
    setView('grid')
    setSelectedCourse(null)
    setRelatedCourses([])
  }

  const goBackToDetail = () => {
    setView('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ===== HEADER ===== */}
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={view !== 'grid' ? (view === 'link' ? goBackToDetail : goBackToGrid) : undefined}
              className="flex items-center gap-2.5 group"
            >
              {view !== 'grid' && (
                <div className="bg-muted rounded-lg p-1.5 hover:bg-muted/80 transition-colors">
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
              <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl p-2 shadow-sm">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-amber-700" />
              </div>
              <div className="text-right">
                <h1 className="text-base sm:text-lg font-extrabold leading-tight tracking-tight">
                  OWL<span className="text-amber-600">COURSE</span>
                </h1>
                <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">دورات يودمي مجانية</p>
              </div>
            </button>
            <div className="flex items-center gap-2">
              {total > 0 && view === 'grid' && (
                <Badge variant="secondary" className="text-xs font-medium bg-amber-50 text-amber-700 border-amber-200 hidden sm:inline-flex">
                  <Gift className="h-3 w-3 ml-1" />
                  {total} كورس مجاني
                </Badge>
              )}
              {view === 'grid' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchCourses(page, search, selectedCategory, sort)}
                  className="text-xs"
                  title="تحديث"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1">
        {view === 'grid' && (
          <div className="view-enter">
            <GridPage
              courses={courses}
              categories={categories}
              totalCourses={totalCourses}
              totalPages={totalPages}
              page={page}
              loading={loading}
              search={search}
              selectedCategory={selectedCategory}
              sort={sort}
              showFilters={showFilters}
              hasActiveFilters={hasActiveFilters}
              onSearch={handleSearch}
              onCategory={handleCategory}
              onSort={handleSort}
              onClearFilters={clearFilters}
              onShowFilters={() => setShowFilters(!showFilters)}
              onPageChange={setPage}
              onCardClick={openCourseDetail}
              total={total}
            />
          </div>
        )}

        {view === 'detail' && (
          <div className="view-enter">
            <DetailPage
              course={selectedCourse}
              relatedCourses={relatedCourses}
              loading={detailLoading}
              onGoToLink={goToLinkPage}
              onBack={goBackToGrid}
              onCardClick={openCourseDetail}
            />
          </div>
        )}

        {view === 'link' && (
          <div className="view-enter">
            <LinkPage
              course={selectedCourse}
              onBack={goBackToDetail}
            />
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t bg-card/50 mt-auto">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg p-1.5">
                <GraduationCap className="h-4 w-4 text-amber-700" />
              </div>
              <span className="font-bold text-sm tracking-tight">
                OWL<span className="text-amber-600">COURSE</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-md leading-relaxed">
              منصة تجمع أفضل الدورات المجانية من يودمي مع كوبونات 100% — محدّثة تلقائياً
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-rose-400" />
                مجاني بالكامل
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                محدّث تلقائياً
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3 text-green-500" />
                كوبونات مضمونة
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================
// GRID PAGE VIEW
// ============================================

function GridPage({
  courses, categories, totalCourses, totalPages, page, loading, search, selectedCategory, sort,
  showFilters, hasActiveFilters, onSearch, onCategory, onSort, onClearFilters, onShowFilters,
  onPageChange, onCardClick, total,
}: {
  courses: Course[]
  categories: CategoryInfo[]
  totalCourses: number
  totalPages: number
  page: number
  loading: boolean
  search: string
  selectedCategory: string
  sort: string
  showFilters: boolean
  hasActiveFilters: boolean
  onSearch: (v: string) => void
  onCategory: (v: string) => void
  onSort: (v: string) => void
  onClearFilters: () => void
  onShowFilters: () => void
  onPageChange: (p: number) => void
  onCardClick: (slug: string) => void
  total: number
}) {
  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100/60 p-6 sm:p-8 text-center space-y-3">
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-orange-200/20 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200/60 shadow-sm">
            <Flame className="h-3 w-3" />
            <span>{total > 0 ? `${total} دورة متاحة الآن` : 'محدّثة تلقائياً'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 text-foreground">
            تعلّم بدون <span className="text-gradient">حدود</span> — دورات مجانية
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            كوبونات مجانية 100% لأفضل دورات يودمي — تسجيل مباشر، احتفظ بالدورة مدى الحياة
          </p>
        </div>
        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن دورة... (Python, React, Design...)"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                className="pl-9 h-11 bg-white/80 backdrop-blur-sm border-amber-200/50 focus:border-amber-300"
              />
              {search && (
                <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onShowFilters}
              className={`h-11 w-11 bg-white/80 backdrop-blur-sm border-amber-200/50 ${showFilters ? 'bg-amber-100 border-amber-300 text-amber-700' : 'hover:border-amber-300'}`}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Category Chips */}
      {categories.length > 0 && (
        <section>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-0.5">
            <button
              onClick={() => onCategory('all')}
              className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                !selectedCategory
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                  : 'bg-white text-muted-foreground border-border hover:border-amber-200 hover:text-amber-700'
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => {
              const info = getCatInfo(cat.name)
              const isActive = selectedCategory === cat.name
              return (
                <button
                  key={cat.name}
                  onClick={() => onCategory(cat.name)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isActive
                      ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                      : 'bg-white text-muted-foreground border-border hover:border-amber-200 hover:text-amber-700'
                  }`}
                >
                  <span className="text-sm">{info.icon}</span>
                  <span>{info.ar}</span>
                  <span className="text-[10px] opacity-50">{cat.count}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <section className="flex flex-wrap gap-3 items-center p-4 rounded-xl border bg-card shadow-sm animate-in fade-in slide-in-from-top-2">
          <Select value={sort} onValueChange={onSort}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="ترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="rating">الأعلى تقييماً</SelectItem>
              <SelectItem value="students">الأكثر طلاباً</SelectItem>
              <SelectItem value="title">الاسم A-Z</SelectItem>
              <SelectItem value="oldest">الأقدم</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-red-500 hover:text-red-600 hover:bg-red-50">
              <X className="h-3 w-3 ml-1" />
              مسح الفلاتر
            </Button>
          )}
        </section>
      )}

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-muted transition-colors" onClick={() => onSearch('')}>
              <Search className="h-3 w-3" />
              {search}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-muted transition-colors" onClick={() => onCategory('all')}>
              <Tag className="h-3 w-3" />
              {getCatInfo(selectedCategory).ar}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {sort !== 'newest' && (
            <Badge variant="secondary" className="gap-1.5 cursor-pointer hover:bg-muted transition-colors" onClick={() => onSort('newest')}>
              {sort === 'rating' ? 'الأعلى تقييماً' : sort === 'students' ? 'الأكثر طلاباً' : sort === 'oldest' ? 'الأقدم' : 'الاسم'}
              <X className="h-3 w-3" />
            </Badge>
          )}
          <span className="text-xs text-muted-foreground self-center mr-auto">
            {totalCourses} نتيجة
          </span>
        </div>
      )}

      <Separator />

      {/* Course Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-44 w-full" />
              <CardContent className="p-4 space-y-2.5">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-4 w-full rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-15" />
          <p className="text-lg font-semibold">لا توجد دورات</p>
          <p className="text-sm mt-1">جرّب تغيير الفلاتر أو عد لاحقاً</p>
          {hasActiveFilters && (
            <Button variant="outline" onClick={onClearFilters} className="mt-4">
              <X className="h-3.5 w-3.5 ml-1" />
              مسح الفلاتر
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} onClick={() => onCardClick(course.slug)} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="h-9 px-3"
              >
                <ChevronRight className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">السابق</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(pageNum)}
                      className="w-9 h-9 p-0 text-xs"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="h-9 px-3"
              >
                <span className="hidden sm:inline">التالي</span>
                <ChevronLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================
// COURSE CARD COMPONENT
// ============================================

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const catInfo = getCatInfo(course.category)

  return (
    <Card
      className="overflow-hidden card-hover group cursor-pointer border bg-card hover:shadow-md hover:border-amber-200/80"
      onClick={onClick}
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
          }}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Top-right: FREE badge */}
        <div className="absolute top-2.5 right-2.5">
          <Badge className="text-[10px] font-bold bg-green-600 text-white border-0 shadow-sm">
            <Gift className="h-2.5 w-2.5 ml-0.5" />
            FREE
          </Badge>
        </div>

        {/* Top-left: Category */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border shadow-sm backdrop-blur-sm ${catInfo.color}`}>
            {catInfo.icon} {catInfo.ar}
          </span>
        </div>

        {/* Bottom: Stats overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
          {course.rating && (
            <Badge className="text-[10px] font-medium bg-black/50 text-white border-0 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 ml-0.5 text-amber-400" />
              {course.rating}
            </Badge>
          )}
          {course.students_count && course.students_count > 0 && (
            <Badge className="text-[10px] font-medium bg-black/50 text-white border-0 backdrop-blur-sm">
              <Users className="h-2.5 w-2.5 ml-0.5" />
              {course.students_count >= 1000 ? `${(course.students_count / 1000).toFixed(1)}k` : course.students_count}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-3.5 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-amber-700 transition-colors leading-snug">
          {course.title}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {course.instructor && (
            <span className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{course.instructor}</span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          {course.original_price ? (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="line-through text-muted-foreground">{course.original_price}</span>
              <Badge variant="secondary" className="text-[10px] font-bold bg-green-50 text-green-700 border-green-200 px-1.5 py-0">مجاني</Badge>
            </div>
          ) : (
            <Badge variant="secondary" className="text-[10px] font-bold bg-green-50 text-green-700 border-green-200">
              مجاني 100%
            </Badge>
          )}
          <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 group-hover:text-amber-700">
            التفاصيل
            <ArrowLeft className="h-3 w-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// COURSE DETAIL PAGE VIEW
// ============================================

function DetailPage({
  course, relatedCourses, loading, onGoToLink, onBack, onCardClick,
}: {
  course: CourseDetail | null
  relatedCourses: Course[]
  loading: boolean
  onGoToLink: () => void
  onBack: () => void
  onCardClick: (slug: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل تفاصيل الدورة...</p>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">لم يتم العثور على الدورة</p>
          <Button variant="outline" onClick={onBack}>
            <ArrowRight className="h-4 w-4 ml-1" />
            العودة للرئيسية
          </Button>
        </div>
      </div>
    )
  }

  const catInfo = getCatInfo(course.category)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Hero Image */}
      <div className="relative aspect-[16/7] sm:aspect-[16/8] bg-muted rounded-2xl overflow-hidden shadow-sm">
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-4 right-4 flex gap-2">
          <Badge className="text-xs bg-white/90 text-foreground backdrop-blur-sm border-0 shadow-sm font-medium">
            Udemy
          </Badge>
          <Badge className="text-xs bg-green-600 text-white border-0 shadow-sm font-bold">
            <Gift className="h-3 w-3 ml-1" />
            FREE 100%
          </Badge>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border shadow-sm ${catInfo.color}`}>
            {catInfo.icon} {catInfo.ar}
          </span>
          <h2 className="text-white font-bold text-lg sm:text-2xl leading-tight mt-2.5 drop-shadow-md line-clamp-2">
            {course.title}
          </h2>
        </div>
      </div>

      {/* Meta Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {course.instructor && (
          <InfoCard icon={<User className="h-4 w-4 text-amber-600" />} label="المدرب" value={course.instructor} />
        )}
        <InfoCard icon={<Star className="h-4 w-4 text-amber-500" />} label="التقييم" value={course.rating ? `${course.rating} / 5` : '—'} />
        {course.students_count && course.students_count > 0 && (
          <InfoCard icon={<TrendingUp className="h-4 w-4 text-green-600" />} label="الطلاب" value={course.students_count.toLocaleString()} />
        )}
        {course.language && (
          <InfoCard icon={<Globe className="h-4 w-4 text-teal-600" />} label="اللغة" value={course.language} />
        )}
        {course.duration && (
          <InfoCard icon={<Clock className="h-4 w-4 text-orange-600" />} label="المدة" value={course.duration} />
        )}
        {course.original_price && (
          <InfoCard icon={<Tag className="h-4 w-4 text-rose-600" />} label="السعر الأصلي" value={<span className="line-through">{course.original_price}</span>} />
        )}
        {course.lastUpdated && (
          <InfoCard icon={<Calendar className="h-4 w-4 text-violet-600" />} label="آخر تحديث" value={course.lastUpdated} />
        )}
        <InfoCard icon={<Sparkles className="h-4 w-4 text-amber-600" />} label="المصدر" value="UdemyFreebies" />
      </div>

      {/* Description */}
      {course.description && (
        <Card className="p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" />
            وصف الدورة
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.description}
          </p>
        </Card>
      )}

      {/* Requirements */}
      {course.requirements && (
        <Card className="p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            المتطلبات
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.requirements}
          </p>
        </Card>
      )}

      {/* Who this course is for */}
      {course.whoFor && (
        <Card className="p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-2.5 flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-600" />
            لمن هذه الدورة
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.whoFor}
          </p>
        </Card>
      )}

      {/* CTA Section */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-right">
            <h3 className="font-bold text-lg text-green-800">احصل على هذه الدورة مجاناً!</h3>
            <p className="text-sm text-green-700/80 mt-1">
              كوبون مجاني 100% — تسجيل مباشر على يودمي بدون دفع
            </p>
          </div>
          <Button
            onClick={onGoToLink}
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 text-sm gap-2 rounded-xl shadow-lg shadow-green-600/20 transition-all hover:shadow-xl hover:shadow-green-600/30"
          >
            <ExternalLink className="h-4 w-4" />
            الذهاب للدورة
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Related Courses */}
      {relatedCourses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            دورات مشابهة
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {relatedCourses.map(rc => {
              const rcCat = getCatInfo(rc.category)
              return (
                <Card
                  key={rc.id}
                  className="overflow-hidden cursor-pointer card-hover group"
                  onClick={() => onCardClick(rc.slug)}
                >
                  <div className="relative aspect-[16/9] bg-muted">
                    <img
                      src={rc.image_url}
                      alt={rc.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
                      }}
                      loading="lazy"
                    />
                  </div>
                  <CardContent className="p-2.5">
                    <h5 className="text-[13px] font-medium line-clamp-2 group-hover:text-amber-700 transition-colors leading-snug">{rc.title}</h5>
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${rcCat.color}`}>
                        {rcCat.icon} {rcCat.ar}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// INFO CARD COMPONENT
// ============================================

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 p-3 bg-card rounded-xl border shadow-sm text-xs">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px] leading-tight">{label}</p>
        <p className="font-medium truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ============================================
// LINK PAGE VIEW
// ============================================

function LinkPage({ course, onBack }: { course: CourseDetail | null; onBack: () => void }) {
  const [countdown, setCountdown] = useState(5)
  const showButton = countdown <= 0

  const lastCourseId = useRef(course?.id)
  if (lastCourseId.current !== course?.id) {
    lastCourseId.current = course?.id
    setCountdown(5)
  }

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">لم يتم العثور على الدورة</p>
          <Button variant="outline" onClick={onBack}>
            <ArrowRight className="h-4 w-4 ml-1" />
            العودة
          </Button>
        </div>
      </div>
    )
  }

  const udemyUrl = course.udemy_url || course.udemyUrl || '#'
  const catInfo = getCatInfo(course.category)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Course Preview Card */}
      <Card className="overflow-hidden shadow-sm">
        <div className="relative aspect-[16/7] bg-muted">
          <img
            src={course.image_url}
            alt={course.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <h2 className="text-white font-bold text-sm sm:text-base line-clamp-2 drop-shadow-md">{course.title}</h2>
            <Badge className={`text-[10px] shrink-0 ${catInfo.color}`}>
              {catInfo.icon} {catInfo.ar}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4 space-y-2.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            {course.instructor && (
              <span className="flex items-center gap-1"><User className="h-3 w-3" />{course.instructor}</span>
            )}
            {course.rating && (
              <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{course.rating}/5</span>
            )}
            {course.students_count && course.students_count > 0 && (
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{course.students_count.toLocaleString()} طالب</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Section - warm tones instead of blue */}
      <Card className="p-5 space-y-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/60 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 rounded-lg p-2 shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-amber-900">عن هذه الدورة</h3>
            <p className="text-xs text-amber-800/70 mt-1 leading-relaxed">
              {course.description}
            </p>
          </div>
        </div>
      </Card>

      {/* Important Notes */}
      <Card className="p-5 space-y-3 shadow-sm">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-600" />
          ملاحظات مهمة
        </h3>
        <div className="space-y-2.5">
          <NoteItem
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
            text="الدورة مجانية تماماً مع الكوبون — لن يُطلب منك دفع أي مبلغ"
          />
          <NoteItem
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            text="الكوبون قد ينتهي في أي وقت — سارع بالتسجيل"
          />
          <NoteItem
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
            text="بعد التسجيل المجاني، ستحتفظ بالدورة مدى الحياة"
          />
          <NoteItem
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            text="إذا لم يعمل الكوبون، جرب مرة أخرى لاحقاً أو ابحث عن دورة أخرى"
          />
        </div>
      </Card>

      {/* Countdown / CTA */}
      <div className="text-center space-y-4 pt-2">
        {!showButton ? (
          <>
            <div className="relative w-20 h-20 mx-auto">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-green-100"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${((5 - countdown) / 5) * 100}, 100`}
                  className="text-green-600"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-green-700">
                {countdown}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">جارٍ تجهيز رابط الدورة...</p>
          </>
        ) : (
          <>
            <a
              href={udemyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-14 text-base gap-3 rounded-xl shadow-xl shadow-green-600/25 transition-all hover:shadow-2xl hover:shadow-green-600/30 hover:scale-[1.01] active:scale-[0.99]">
                <Gift className="h-5 w-5" />
                احصل على الدورة مجاناً على Udemy
                <ExternalLink className="h-5 w-5" />
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground">
              سيتم توجيهك إلى صفحة الدورة على يودمي — اشتراك مباشر بدون دفع
            </p>
          </>
        )}

        <Button variant="ghost" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
          العودة لتفاصيل الدورة
        </Button>
      </div>
    </div>
  )
}

// ============================================
// NOTE ITEM COMPONENT
// ============================================

function NoteItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <p className="leading-relaxed">{text}</p>
    </div>
  )
}
