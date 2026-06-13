'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  User,
  Star,
  Users,
  ArrowLeft,
  Tag,
  Moon,
  Sun,
  Infinity,
  Timer,
  Gift,
} from 'lucide-react'
import { LogoMark } from '@/components/logo'
import { LocaleSwitch } from '@/components/locale-switch'
import { SiteFooter } from '@/components/site-chrome'
import { makeT, getLocalizedCategory } from '@/lib/locale-text'
import { localeDir, type Locale } from '@/lib/i18n'

interface Course {
  id: string
  title: string
  slug: string
  description: string
  instructor: string
  category: string
  image_url: string
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  duration: string | null
  couponExpiresAt: string | null
  isFreeForever: boolean
  couponVerified: boolean
  scraped_at: string
}

interface CategoryInfo {
  name: string
  count: number
}

type TxFn = (key: string, vars?: Record<string, string | number>) => string

const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

function cn(...args: Array<string | false | null | undefined>): string {
  return args.filter(Boolean).join(' ')
}

function CouponBadge(props: {
  isFreeForever: boolean
  couponExpiresAt: string | null
  t: TxFn
}) {
  const { isFreeForever, couponExpiresAt, t } = props

  const solid = 'text-[10px] bg-foreground text-background border-0'
  const outline = 'text-[10px] bg-transparent text-foreground border border-border'
  const faded = 'text-[10px] bg-transparent text-muted-foreground border border-border line-through'

  if (isFreeForever) {
    return (
      <Badge className={solid}>
        <Infinity className="h-2.5 w-2.5 ml-0.5" />
        {t('freeForever')}
      </Badge>
    )
  }

  if (couponExpiresAt) {
    const expiryDate = new Date(couponExpiresAt)
    const now = new Date()
    const isExpired = expiryDate < now
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    const badgeClass = isExpired ? faded : daysLeft <= 1 ? solid : outline
    const label = isExpired ? t('expired') : daysLeft <= 1 ? t('dayLeft') : t('daysLeft', { n: daysLeft })

    return (
      <Badge className={badgeClass}>
        <Timer className="h-2.5 w-2.5 ml-0.5" />
        {label}
      </Badge>
    )
  }

  return (
    <Badge className={outline}>
      <Tag className="h-2.5 w-2.5 ml-0.5" />
      {t('coupon')}
    </Badge>
  )
}

function CourseCard(props: { course: Course; t: TxFn; locale: Locale; onClick: () => void }) {
  const { course, t, locale, onClick } = props
  const catName = getLocalizedCategory(locale, course.category)

  const topLeftClass = 'absolute top-2 left-2 flex flex-col gap-1'
  const topRightClass = 'absolute top-2 right-2 flex flex-col gap-1 items-end'
  const arrowClass = 'inline h-2.5 w-2.5 rotate-180'

  const studentsLabel =
    course.students_count != null && course.students_count > 0
      ? course.students_count >= 1000
        ? (course.students_count / 1000).toFixed(1) + 'k'
        : String(course.students_count)
      : null

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    e.currentTarget.src = PLACEHOLDER_IMG
  }

  return (
    <Card
      className="overflow-hidden group cursor-pointer border bg-card hover:shadow-md hover:border-border dark:hover:border-border transition-all"
      onClick={onClick}
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          onError={handleImgError}
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        <div className={topLeftClass}>
          <Badge className="text-[10px] font-bold bg-foreground text-background border-0">
            <Gift className="h-2.5 w-2.5 ml-0.5" />
            {course.isFreeForever ? t('free') : t('coupon')}
          </Badge>
        </div>

        <div className={topRightClass}>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm">
            {catName}
          </span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
          {course.rating != null && course.rating > 0 && (
            <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 text-muted-foreground" />
              {course.rating}
            </Badge>
          )}
          {studentsLabel && (
            <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur-sm">
              <Users className="h-2.5 w-2.5" />
              {studentsLabel}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-3 space-y-2">
        <h3 className="font-medium text-[13px] line-clamp-2 group-hover:text-muted-foreground dark:group-hover:text-muted-foreground transition-colors leading-snug">
          {course.title}
        </h3>
        <div className="flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground">
          {course.instructor && (
            <span className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{course.instructor}</span>
            </span>
          )}
          <CouponBadge isFreeForever={course.isFreeForever} couponExpiresAt={course.couponExpiresAt} t={t} />
        </div>
        <span className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground py-2 text-xs font-semibold text-background transition-opacity group-hover:opacity-90">
          {t('details')} <ArrowLeft className={arrowClass} />
        </span>
      </CardContent>
    </Card>
  )
}

export function HomeClient({ locale, basePath }: { locale: Locale; basePath: string }) {
  const t = makeT(locale)
  const dir = localeDir(locale)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  const [courses, setCourses] = useState<Course[]>([])
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [totalCourses, setTotalCourses] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchCourses = useCallback(
    async (p: number, s: string, cat: string, sortVal: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p), limit: '12', locale })
        if (s) params.set('search', s)
        if (cat) params.set('category', cat)
        if (sortVal) params.set('sort', sortVal)

        const res = await fetch('/api/courses?' + params.toString())
        const data = await res.json()

        setCourses(data.courses || [])
        const cats = data.filters?.categories || []
        setCategories(
          cats.map((c: { name: string; count: number }) => ({
            name: typeof c === 'string' ? c : c.name,
            count: typeof c === 'string' ? 0 : c.count,
          }))
        )
        setTotalPages(data.pagination?.total_pages || 1)
        setTotalCourses(data.pagination?.total || 0)
      } catch {
        setCourses([])
      } finally {
        setLoading(false)
      }
    },
    [locale]
  )

  useEffect(() => {
    fetchCourses(page, search, selectedCategory, sort)
  }, [page, search, selectedCategory, sort, fetchCourses])

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => fetchCourses(1, value, selectedCategory, sort), 300)
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

  const hasActiveFilters = !!(search || selectedCategory || sort !== 'newest')
  const homeHref = basePath || '/'
  const openCourseDetail = (slug: string) => router.push(`${basePath}/course/${slug}`)

  const filterBtnClass = showFilters
    ? 'h-10 w-10 bg-muted border-border text-muted-foreground dark:bg-muted dark:border-border'
    : 'h-10 w-10'

  function catChipClass(isActive: boolean): string {
    return cn(
      'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
      isActive
        ? 'bg-muted text-muted-foreground border-border dark:bg-muted dark:text-muted-foreground dark:border-border'
        : 'bg-card text-muted-foreground border-border hover:border-border'
    )
  }

  function getPaginationNumbers(): number[] {
    const maxPages = Math.min(totalPages, 5)
    const pages: number[] = []
    for (let i = 0; i < maxPages; i++) {
      let pn: number
      if (totalPages <= 5) pn = i + 1
      else if (page <= 3) pn = i + 1
      else if (page >= totalPages - 2) pn = totalPages - 4 + i
      else pn = page - 2 + i
      pages.push(pn)
    }
    return pages
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col" lang={locale} dir={dir}>
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => router.push(homeHref)} className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-bold text-sm tracking-tight">
              Learn<span className="text-muted-foreground"> Plus</span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <LocaleSwitch locale={locale} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8"
            >
              {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
          <div className="flex gap-2 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground left-3" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-10"
              />
              {search && (
                <button onClick={() => handleSearch('')} className="absolute top-1/2 -translate-y-1/2 right-3">
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)} className={filterBtnClass}>
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
              <button onClick={() => handleCategory('all')} className={catChipClass(!selectedCategory)}>
                {t('all')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategory(cat.name)}
                  className={catChipClass(selectedCategory === cat.name)}
                >
                  <span>{getLocalizedCategory(locale, cat.name)}</span>
                  <span className="text-[10px] opacity-40">{cat.count}</span>
                </button>
              ))}
            </div>
          )}

          {showFilters && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
              <Select value={sort} onValueChange={handleSort}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder={t('sort')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t('newest')}</SelectItem>
                  <SelectItem value="rating">{t('highestRated')}</SelectItem>
                  <SelectItem value="students">{t('mostStudents')}</SelectItem>
                  <SelectItem value="title">{t('nameAZ')}</SelectItem>
                  <SelectItem value="oldest">{t('oldest')}</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground h-9 text-xs">
                  <X className="h-3 w-3 ml-1" />
                  {t('clearFilters')}
                </Button>
              )}
            </div>
          )}

          <Separator />

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-40 w-full" />
                  <CardContent className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-15" />
              <p className="font-medium">{t('noCourses')}</p>
              <p className="text-sm mt-1">{t('noCoursesDesc')}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} t={t} locale={locale} onClick={() => openCourseDetail(course.slug)} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 text-xs">
                    <ChevronLeft className="h-3.5 w-3.5" /> {t('prev')}
                  </Button>
                  <div className="flex items-center gap-0.5">
                    {getPaginationNumbers().map((pn) => (
                      <Button
                        key={pn}
                        variant={page === pn ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPage(pn)}
                        className="w-8 h-8 p-0 text-xs"
                      >
                        {pn}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="h-8 text-xs">
                    {t('next')} <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}
