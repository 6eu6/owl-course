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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  User,
  Star,
  Users,
  Globe,
  Clock,
  Tag,
  Loader2,
  ArrowRight,
  Gift,
  TrendingUp,
} from 'lucide-react'

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
  source: string
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  duration: string | null
  couponCode: string | null
  scraped_at: string
}

interface Filters {
  search: string
  category: string
  sort: string
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Filters>({ search: '', category: '', sort: 'newest' })
  const [showFilters, setShowFilters] = useState(false)

  // Course detail dialog state
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(null)
  const [relatedCourses, setRelatedCourses] = useState<Array<{ id: string; title: string; slug: string; image_url: string; category: string }>>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchCourses = useCallback(async (p: number, f: Filters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: '12',
      })
      if (f.search) params.set('search', f.search)
      if (f.category) params.set('category', f.category)
      if (f.sort) params.set('sort', f.sort)

      const res = await fetch(`/api/courses?${params}`)
      const data = await res.json()
      setCourses(data.courses || [])
      setCategories(data.filters?.categories || [])
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

  const handleSort = (value: string) => {
    setFilters(prev => ({ ...prev, sort: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters({ search: '', category: '', sort: 'newest' })
    setPage(1)
  }

  const hasActiveFilters = filters.search || filters.category || filters.sort !== 'newest'

  const openCourseDetail = async (slug: string) => {
    setDetailLoading(true)
    setDetailOpen(true)
    setSelectedCourse(null)
    setRelatedCourses([])
    try {
      const res = await fetch(`/api/courses/${slug}`)
      const data = await res.json()
      if (data.course) {
        setSelectedCourse(data.course)
        setRelatedCourses(data.related || [])
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setSelectedCourse(null)
    setRelatedCourses([])
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-amber-100 rounded-lg p-1.5">
                <GraduationCap className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">OWL COURSE</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">دورات يودمي مجانية</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <Badge variant="secondary" className="text-xs font-medium">
                  <Gift className="h-3 w-3 mr-1" />
                  {total} كورس
                </Badge>
              )}
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
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-200">
            <Zap className="h-3 w-3" />
            <span>محدّثة تلقائياً من UdemyFreebies</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold">
            دورات مجانية <span className="text-amber-600">عالية الجودة</span>
          </h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            اكتشف أفضل الدورات المجانية من يودمي مع كوبونات 100% مجانية — تسجيل مباشر
          </p>
          <div className="flex gap-2 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث عن دورة... (Python, React, Design...)"
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-amber-50 border-amber-200' : ''}
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

            <Select value={filters.sort} onValueChange={handleSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="ترتيب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">الأحدث</SelectItem>
                <SelectItem value="rating">الأعلى تقييماً</SelectItem>
                <SelectItem value="students">الأكثر طلاباً</SelectItem>
                <SelectItem value="title">الاسم A-Z</SelectItem>
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
            {filters.sort !== 'newest' && (
              <Badge variant="secondary" className="gap-1">
                {filters.sort === 'rating' ? 'الأعلى تقييماً' : filters.sort === 'students' ? 'الأكثر طلاباً' : 'الاسم'}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleSort('newest')} />
              </Badge>
            )}
            <span className="text-xs text-muted-foreground self-center">
              {totalCourses} نتيجة
            </span>
          </div>
        )}

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
            <p className="text-lg font-medium">لا توجد دورات</p>
            <p className="text-sm mt-1">جرّب تغيير الفلاتر أو عد لاحقاً</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} onClick={() => openCourseDetail(course.slug)} />
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
                  <ChevronLeft className="h-4 w-4" />
                  التالي
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
            OWL COURSE — دورات مجانية من يودمي مع كوبونات 100% — المصدر: UdemyFreebies
          </p>
        </div>
      </footer>

      {/* ===== COURSE DETAIL DIALOG ===== */}
      <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
          {detailLoading ? (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">جارٍ التحميل...</DialogTitle>
              </DialogHeader>
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <span className="mr-3 text-sm">جارٍ تحميل تفاصيل الدورة...</span>
              </div>
            </>
          ) : selectedCourse ? (
            <>
              {/* Course Image */}
              <div className="relative aspect-[16/7] bg-muted w-full">
                <img
                  src={selectedCourse.image_url}
                  alt={selectedCourse.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <Badge className="text-xs bg-white/90 text-foreground backdrop-blur-sm">
                    Udemy
                  </Badge>
                  <Badge className="text-xs bg-green-600 text-white">
                    <Gift className="h-3 w-3 mr-1" />
                    FREE 100%
                  </Badge>
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-white font-bold text-base leading-tight line-clamp-2 drop-shadow-md">
                    {selectedCourse.title}
                  </h3>
                </div>
              </div>

              {/* Course Details */}
              <ScrollArea className="max-h-[60vh]">
                <div className="p-6 space-y-5">
                  <DialogHeader>
                    <DialogTitle className="sr-only">{selectedCourse.title}</DialogTitle>
                  </DialogHeader>

                  {/* Meta Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {selectedCourse.instructor && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                        <User className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span className="truncate">{selectedCourse.instructor}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="truncate">{selectedCourse.category}</span>
                    </div>
                    {selectedCourse.rating ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                        <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span className="font-medium">{selectedCourse.rating}/5</span>
                      </div>
                    ) : null}
                    {selectedCourse.students_count ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        <span>{selectedCourse.students_count.toLocaleString()} طالب</span>
                      </div>
                    ) : null}
                    {selectedCourse.language && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        <span>{selectedCourse.language}</span>
                      </div>
                    )}
                    {selectedCourse.original_price && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-muted/50 rounded-lg">
                        <Zap className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        <span className="line-through">{selectedCourse.original_price}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {selectedCourse.description && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">وصف الدورة</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedCourse.description}
                      </p>
                    </div>
                  )}

                  {/* CTA - Get Course Link */}
                  <Separator />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={selectedCourse.udemy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1"
                    >
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-12 text-sm gap-2 rounded-lg">
                        <ExternalLink className="h-4 w-4" />
                        احصل على الدورة مجاناً على Udemy
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button variant="outline" onClick={closeDetail} className="h-12 rounded-lg">
                      رجوع
                    </Button>
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground">
                    سيتم توجيهك إلى صفحة الدورة على يودمي مع كوبون مجاني 100% — اشتراك مباشر بدون دفع
                  </p>

                  {/* Related Courses */}
                  {relatedCourses.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold mb-3">دورات مشابهة</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {relatedCourses.map(rc => (
                            <Card
                              key={rc.id}
                              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                closeDetail()
                                setTimeout(() => openCourseDetail(rc.slug), 200)
                              }}
                            >
                              <div className="relative aspect-[16/9] bg-muted">
                                <img
                                  src={rc.image_url}
                                  alt={rc.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'
                                  }}
                                  loading="lazy"
                                />
                              </div>
                              <CardContent className="p-2.5">
                                <h5 className="text-xs font-medium line-clamp-2">{rc.title}</h5>
                                <Badge variant="outline" className="text-[10px] mt-1">{rc.category}</Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="p-8">
              <DialogHeader className="sr-only">
                <DialogTitle>Error</DialogTitle>
              </DialogHeader>
              <p className="text-center text-muted-foreground">Could not load course details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== Course Card Component =====
function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all group cursor-pointer border hover:border-amber-200"
      onClick={onClick}
    >
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className="text-[10px] bg-green-600 text-white">
            <Gift className="h-2.5 w-2.5 mr-0.5" />
            FREE
          </Badge>
        </div>
        {/* Quick info overlay on hover */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {course.rating && (
            <Badge className="text-[10px] bg-white/90 text-foreground">
              <Star className="h-2.5 w-2.5 mr-0.5 text-amber-500" />
              {course.rating}
            </Badge>
          )}
          {course.students_count && (
            <Badge className="text-[10px] bg-white/90 text-foreground">
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              {course.students_count.toLocaleString()}
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="p-4 space-y-2.5">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-amber-600 transition-colors leading-snug">
          {course.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px] shrink-0">{course.category}</Badge>
          {course.instructor && (
            <span className="truncate text-[11px]">{course.instructor}</span>
          )}
        </div>
        {course.original_price && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="line-through text-muted-foreground">{course.original_price}</span>
            <span className="font-semibold text-green-600">Free</span>
          </div>
        )}
        <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 pt-1">
          <BookOpen className="h-3 w-3" />
          عرض التفاصيل
          <ArrowRight className="h-3 w-3" />
        </div>
      </CardContent>
    </Card>
  )
}
