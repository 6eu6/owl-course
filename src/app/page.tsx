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
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Shield,
  CheckCircle,
  Calendar,
  TrendingUp,
  Tag,
  Moon,
  Sun,
  Infinity,
  Timer,
  Zap,
  Gift,
} from 'lucide-react'
import { tx, getCat } from '@/lib/translations'
import { LogoMark } from '@/components/logo'

interface Course {
  id: string
  title: string
  slug: string
  description: string
  instructor: string
  category: string
  image_url: string
  source: string
  sourceDetail: string | null
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
  sourceDetail: string | null
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
  couponUrl: string | null
  couponExpiresAt: string | null
  isFreeForever: boolean
  couponVerified: boolean
  scraped_at: string
}

interface CategoryInfo {
  name: string
  count: number
}

type View = 'grid' | 'detail' | 'link'

const PLACEHOLDER_IMG =
  'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

function cn(
  ...args: Array<string | false | null | undefined>
): string {
  return args.filter(Boolean).join(' ')
}

type TxFn = (key: string) => string

function CouponBadge(props: {
  isFreeForever: boolean
  couponExpiresAt: string | null
  couponVerified: boolean
}) {
  const { isFreeForever, couponExpiresAt, couponVerified } = props

  const solid = 'text-[10px] bg-foreground text-background border-0'
  const outline = 'text-[10px] bg-transparent text-foreground border border-border'
  const faded = 'text-[10px] bg-transparent text-muted-foreground border border-border line-through'

  if (isFreeForever) {
    return (
      <Badge className={solid}>
        <Infinity className="h-2.5 w-2.5 ml-0.5" />
        Free Forever
      </Badge>
    )
  }

  if (couponExpiresAt) {
    const expiryDate = new Date(couponExpiresAt)
    const now = new Date()
    const isExpired = expiryDate < now
    const daysLeft = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    const badgeClass = isExpired ? faded : daysLeft <= 1 ? solid : outline

    const label = isExpired
      ? 'Expired'
      : daysLeft <= 1
        ? '1d left'
        : daysLeft + 'd left'

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
      Coupon
    </Badge>
  )
}

function InfoCard(props: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
      <div className="shrink-0">{props.icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[10px]">{props.label}</p>
        <p className="font-medium truncate">{props.value}</p>
      </div>
    </div>
  )
}

function CourseCard(props: {
  course: Course
  t: TxFn
  onClick: () => void
}) {
  const { course, t, onClick } = props
  const info = getCat(course.category)

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
            {course.isFreeForever ? 'FREE' : 'COUPON'}
          </Badge>
          {course.isFreeForever && (
            <Badge className="text-[9px] bg-foreground text-background border-0">
              <Infinity className="h-2 w-2 ml-0.5" />
              &infin;
            </Badge>
          )}
        </div>

        <div className={topRightClass}>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm">
            {info.icon} {info.name}
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

      <CardContent className="p-3 space-y-1.5">
        <h3 className="font-medium text-[13px] line-clamp-2 group-hover:text-muted-foreground dark:group-hover:text-muted-foreground transition-colors leading-snug">
          {course.title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {course.instructor && (
            <span className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{course.instructor}</span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1">
            <CouponBadge
              isFreeForever={course.isFreeForever}
              couponExpiresAt={course.couponExpiresAt}
              couponVerified={course.couponVerified}
            />
          </div>
          <span className="text-[11px] text-muted-foreground dark:text-muted-foreground font-medium">
            {t('details')} <ArrowLeft className={arrowClass} />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

interface GridPageProps {
  t: TxFn
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
}

function GridPage(props: GridPageProps) {
  const {
    t,
    courses,
    categories,
    totalCourses,
    totalPages,
    page,
    loading,
    search,
    selectedCategory,
    sort,
    showFilters,
    hasActiveFilters,
    onSearch,
    onCategory,
    onSort,
    onClearFilters,
    onShowFilters,
    onPageChange,
    onCardClick,
  } = props

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
      if (totalPages <= 5) {
        pn = i + 1
      } else if (page <= 3) {
        pn = i + 1
      } else if (page >= totalPages - 2) {
        pn = totalPages - 4 + i
      } else {
        pn = page - 2 + i
      }
      pages.push(pn)
    }
    return pages
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">
      <div className="flex gap-2 max-w-lg mx-auto">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground left-3" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute top-1/2 -translate-y-1/2 right-3"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onShowFilters}
          className={filterBtnClass}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide">
          <button
            onClick={() => onCategory('all')}
            className={catChipClass(!selectedCategory)}
          >
            {t('all')}
          </button>
          {categories.map((cat) => {
            const info = getCat(cat.name)
            return (
              <button
                key={cat.name}
                onClick={() => onCategory(cat.name)}
                className={catChipClass(selectedCategory === cat.name)}
              >
                <span>{info.icon}</span>
                <span>{info.name}</span>
                <span className="text-[10px] opacity-40">{cat.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {showFilters && (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
          <Select value={sort} onValueChange={onSort}>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground h-9 text-xs"
            >
              <X className="h-3 w-3 ml-1" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {search && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() => onSearch('')}
            >
              {t('searchLabel')}: {search} <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          {selectedCategory && (
            <Badge
              variant="secondary"
              className="gap-1 text-xs cursor-pointer"
              onClick={() => onCategory('all')}
            >
              {getCat(selectedCategory).icon} {getCat(selectedCategory).name}{' '}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground self-center">
            {totalCourses} {t('results')}
          </span>
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
              <CourseCard
                key={course.id}
                course={course}
                t={t}
                onClick={() => onCardClick(course.slug)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="h-8 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> {t('prev')}
              </Button>
              <div className="flex items-center gap-0.5">
                {getPaginationNumbers().map((pn) => (
                  <Button
                    key={pn}
                    variant={page === pn ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onPageChange(pn)}
                    className="w-8 h-8 p-0 text-xs"
                  >
                    {pn}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="h-8 text-xs"
              >
                {t('next')} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

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

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchCourses = useCallback(
    async (p: number, s: string, cat: string, sortVal: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(p), limit: '12' })
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
        setTotal(data.stats?.total_courses || 0)
      } catch {
        setCourses([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchCourses(page, search, selectedCategory, sort)
  }, [page, search, selectedCategory, sort, fetchCourses])

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(
      () => fetchCourses(1, value, selectedCategory, sort),
      300
    )
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

  const openCourseDetail = (slug: string) => {
    router.push('/course/' + slug)
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <LogoMark className="h-6 w-6" />
            <span className="font-bold text-sm tracking-tight">
              Learn<span className="text-muted-foreground"> Plus</span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8"
            >
              {theme === 'dark' ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="view-enter">
          <GridPage
            t={tx}
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
      </main>

      <footer className="border-t bg-card/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <LogoMark className="h-4 w-4" />
            <span className="font-bold text-xs">
              Learn<span className="text-muted-foreground"> Plus</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground text-center max-w-sm">
            {tx('footerDesc')}
          </p>
          <a
            href="https://t.me/+AU8JJ85DUswzOGNi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[11px] font-medium hover:bg-muted transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
            Join our community
          </a>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
            <a href="/about" className="hover:text-foreground">About</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="https://t.me/FreeLearningHub_P_bot" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Contact</a>
            <a href="https://x.com/learnplusfree" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">X</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
