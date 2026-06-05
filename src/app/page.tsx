'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Zap,
  RefreshCw,
} from 'lucide-react'

interface Course {
  id: string
  title: string
  slug: string
  description: string
  instructor: string
  category: string
  image_url: string
  source: string
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  scraped_at: string
}

interface Filters {
  search: string
  category: string
  source: string
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_courses: 0, udemy_courses: 0, studybullet_courses: 0 })
  const [filters, setFilters] = useState<Filters>({ search: '', category: '', source: '' })
  const [showFilters, setShowFilters] = useState(false)

  const fetchCourses = useCallback(async (p: number, f: Filters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '12',
      })
      if (f.search) params.set('search', f.search)
      if (f.category) params.set('category', f.category)
      if (f.source) params.set('source', f.source)

      const res = await fetch(`/api/courses?${params}`)
      const data = await res.json()
      setCourses(data.courses || [])
      setCategories(data.filters?.categories || [])
      setTotalPages(data.pagination?.total_pages || 1)
      setTotalCourses(data.pagination?.total || 0)
      setStats(data.stats || { total_courses: 0, udemy_courses: 0, studybullet_courses: 0 })
    } catch {
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCourses(page, filters)
  }, [page, filters, fetchCourses])

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }))
    setPage(1)
  }

  const handleCategory = (value: string) => {
    setFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }))
    setPage(1)
  }

  const handleSource = (value: string) => {
    setFilters(prev => ({ ...prev, source: value === 'all' ? '' : value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ search: '', category: '', source: '' })
    setPage(1)
  }

  const hasActiveFilters = filters.search || filters.category || filters.source

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-amber-600" />
              <h1 className="text-lg font-bold">OWL COURSE</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {stats.total_courses} كورس مجاني
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchCourses(page, filters)}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Hero / Search Section */}
        <section className="text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">
            دورات مجانية <span className="text-amber-600">عالية الجودة</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            اكتشف أفضل الدورات المجانية من يودمي — محدّثة تلقائياً
          </p>
          <div className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن دورة..."
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Filters Panel */}
        {showFilters && (
          <section className="flex flex-wrap gap-3 items-center p-4 rounded-lg border bg-card">
            <Select value={filters.category || 'all'} onValueChange={handleCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.source || 'all'} onValueChange={handleSource}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="المصدر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المصادر</SelectItem>
                <SelectItem value="udemyfreebies">UdemyFreebies</SelectItem>
                <SelectItem value="studybullet">StudyBullet</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500">
                <X className="h-3 w-3 mr-1" />
                مسح الفلاتر
              </Button>
            )}
          </section>
        )}

        {/* Active Filters Badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <Badge variant="secondary" className="gap-1">
                بحث: &quot;{filters.search}&quot;
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleSearch('')} />
              </Badge>
            )}
            {filters.category && (
              <Badge variant="secondary" className="gap-1">
                {filters.category}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleCategory('all')} />
              </Badge>
            )}
            {filters.source && (
              <Badge variant="secondary" className="gap-1">
                {filters.source}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleSource('all')} />
              </Badge>
            )}
            <span className="text-xs text-muted-foreground self-center">
              {totalCourses} نتيجة
            </span>
          </div>
        )}

        {/* Stats Bar */}
        <div className="flex gap-4 justify-center text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-500" />
            {stats.udemy_courses} من UdemyFreebies
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-green-500" />
            {stats.studybullet_courses} من StudyBullet
          </span>
        </div>

        <Separator />

        {/* Courses Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">لا توجد دورات</p>
            <p className="text-sm mt-1">جرّب تغيير الفلاتر أو عد لاحقاً</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            OWL COURSE — دورات مجانية من يودمي — محدّثة تلقائياً
          </p>
        </div>
      </footer>
    </div>
  )
}

// ===== Course Card Component =====
function CourseCard({ course }: { course: Course }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <div className="relative aspect-[16/10] bg-muted">
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
          }}
          loading="lazy"
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge variant="secondary" className="text-[10px] bg-white/90">
            {course.source === 'udemyfreebies' ? 'Udemy' : 'StudyBullet'}
          </Badge>
          {course.original_price && (
            <Badge variant="secondary" className="text-[10px] bg-red-500 text-white">
              FREE
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-amber-600 transition-colors">
          {course.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{course.category}</Badge>
          {course.instructor && <span>{course.instructor}</span>}
        </div>
        <a
          href={course.udemy_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 mt-2"
        >
          <ExternalLink className="h-3 w-3" />
          احصل على الدورة مجاناً
        </a>
      </CardContent>
    </Card>
  )
}
