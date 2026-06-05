'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Sparkles,
  Tag,
  Heart,
  Moon,
  Sun,
  Languages,
  Infinity,
  Timer,
  Zap,
  Gift,
} from 'lucide-react'
import { tx, getCat } from '@/lib/translations'
import type { Lang } from '@/lib/translations'

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
  source: string
  sourceDetail: string | null
  rating: number | null
  students_count: number | null
  original_price: string | null
  language: string | null
  duration: string | null
  couponExpiresAt: string | null
  isFreeForever: boolean
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
  scraped_at: string
}

interface CategoryInfo {
  name: string
  count: number
}

type View = 'grid' | 'detail' | 'link'

// ============================================
// Constants
// ============================================

interface SourceInfo {
  ar: string
  en: string
  color: string
}

const SOURCE_LABELS: Record<string, SourceInfo> = {
  udemyfreebies: {
    ar: 'UdemyFreebies',
    en: 'UdemyFreebies',
    color:
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  discudemy: {
    ar: 'DiscUdemy',
    en: 'DiscUdemy',
    color:
      'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  },
  freebiesglobal: {
    ar: 'FreebiesGlobal',
    en: 'FreebiesGlobal',
    color:
      'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  },
  manual: {
    ar: '\u064A\u062F\u0648\u064A',
    en: 'Manual',
    color:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
}

const PLACEHOLDER_IMG =
  'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

// ============================================
// Helper: class name builder (avoids template literals in JSX)
// ============================================

function cn(
  ...args: Array<string | false | null | undefined>
): string {
  return args.filter(Boolean).join(' ')
}

// ============================================
// Translation shorthand
// ============================================

type TxFn = (key: string) => string

function createTx(lang: Lang): TxFn {
  return function (key: string): string {
    return tx(key as Parameters<typeof tx>[0], lang)
  }
}

// ============================================
// Source Badge Component
// ============================================

function SourceBadge(props: { source: string; lang: Lang }) {
  const info = SOURCE_LABELS[props.source] || SOURCE_LABELS.manual
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-medium border', info.color)}
    >
      {info[props.lang]}
    </Badge>
  )
}

// ============================================
// Coupon Badge Component
// ============================================

function CouponBadge(props: {
  isFreeForever: boolean
  couponExpiresAt: string | null
  lang: Lang
}) {
  const { isFreeForever, couponExpiresAt, lang } = props

  if (isFreeForever) {
    return (
      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
        <Infinity className="h-2.5 w-2.5 ml-0.5" />
        {lang === 'ar' ? '\u0645\u062C\u0627\u0646\u064A \u0644\u0644\u0623\u0628\u062F' : 'Free Forever'}
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

    const badgeClass = isExpired
      ? 'text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
      : 'text-[10px] bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'

    const label = isExpired
      ? lang === 'ar'
        ? '\u0645\u0646\u062A\u0647\u064A'
        : 'Expired'
      : daysLeft +
        'd ' +
        (lang === 'ar' ? '\u0645\u062A\u0628\u0642\u064A' : 'left')

    return (
      <Badge className={badgeClass}>
        <Timer className="h-2.5 w-2.5 ml-0.5" />
        {label}
      </Badge>
    )
  }

  return null
}

// ============================================
// Info Card Component
// ============================================

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

// ============================================
// Course Card Component
// ============================================

function CourseCard(props: {
  course: Course
  lang: Lang
  t: TxFn
  onClick: () => void
}) {
  const { course, lang, t, onClick } = props
  const info = getCat(course.category)
  const isRtl = lang === 'ar'

  const topLeftClass = isRtl
    ? 'absolute top-2 right-2 flex flex-col gap-1'
    : 'absolute top-2 left-2 flex flex-col gap-1'

  const topRightClass = isRtl
    ? 'absolute top-2 left-2 flex flex-col gap-1 items-end'
    : 'absolute top-2 right-2 flex flex-col gap-1 items-end'

  const arrowClass = isRtl
    ? 'inline h-2.5 w-2.5'
    : 'inline h-2.5 w-2.5 rotate-180'

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
      className="overflow-hidden group cursor-pointer border bg-card hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all"
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
          <Badge className="text-[10px] font-bold bg-green-600 text-white border-0">
            <Gift className="h-2.5 w-2.5 ml-0.5" />
            FREE
          </Badge>
          {course.isFreeForever && (
            <Badge className="text-[9px] bg-emerald-500 text-white border-0">
              <Infinity className="h-2 w-2 ml-0.5" />
              &infin;
            </Badge>
          )}
        </div>

        <div className={topRightClass}>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm">
            {info.icon} {info[lang]}
          </span>
        </div>

        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
          {course.rating != null && course.rating > 0 && (
            <Badge className="text-[10px] bg-black/50 text-white border-0 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 text-amber-400" />
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
        <h3 className="font-medium text-[13px] line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors leading-snug">
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
            <SourceBadge source={course.source} lang={lang} />
            <CouponBadge
              isFreeForever={course.isFreeForever}
              couponExpiresAt={course.couponExpiresAt}
              lang={lang}
            />
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {t('details')} <ArrowLeft className={arrowClass} />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Grid Page Component
// ============================================

interface GridPageProps {
  lang: Lang
  dir: string
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
    lang,
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
    ? 'h-10 w-10 bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800'
    : 'h-10 w-10'

  function catChipClass(isActive: boolean): string {
    return cn(
      'shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
      isActive
        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
        : 'bg-card text-muted-foreground border-border hover:border-amber-200'
    )
  }

  function chevronClass(isPrev: boolean): string {
    return lang === 'en'
      ? 'h-3.5 w-3.5 rotate-180'
      : 'h-3.5 w-3.5'
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
      {/* Search bar */}
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

      {/* Category chips */}
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
                <span>{info[lang]}</span>
                <span className="text-[10px] opacity-40">{cat.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Sort panel */}
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
              className="text-red-500 h-9 text-xs"
            >
              <X className="h-3 w-3 ml-1" />
              {t('clearFilters')}
            </Button>
          )}
        </div>
      )}

      {/* Active filter badges */}
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
              {getCat(selectedCategory).icon} {getCat(selectedCategory)[lang]}{' '}
              <X className="h-2.5 w-2.5" />
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground self-center">
            {totalCourses} {t('results')}
          </span>
        </div>
      )}

      <Separator />

      {/* Grid content */}
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
                lang={lang}
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
                <ChevronRight className={chevronClass(true)} /> {t('prev')}
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
                {t('next')} <ChevronLeft className={chevronClass(false)} />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================
// Detail Page Component
// ============================================

interface DetailPageProps {
  lang: Lang
  dir: string
  t: TxFn
  course: CourseDetail | null
  relatedCourses: Course[]
  loading: boolean
  onGoToLink: () => void
  onBack: () => void
  onCardClick: (slug: string) => void
}

function DetailPage(props: DetailPageProps) {
  const {
    lang,
    t,
    course,
    relatedCourses,
    loading,
    onGoToLink,
    onBack,
    onCardClick,
  } = props

  const backArrowClass =
    lang === 'en' ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'
  const ctaArrowClass =
    lang === 'en' ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    e.currentTarget.src = PLACEHOLDER_IMG
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 mx-auto" />
        <p className="text-sm text-muted-foreground ms-3">
          {t('loadingDetail')}
        </p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">{t('courseNotFound')}</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowRight className={backArrowClass} />
            {t('backHome')}
          </Button>
        </div>
      </div>
    )
  }

  const catInfo = getCat(course.category)

  const badgesPositionClass =
    lang === 'ar'
      ? 'absolute top-3 right-3 flex gap-1.5 flex-wrap'
      : 'absolute top-3 left-3 flex gap-1.5 flex-wrap'

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
      {/* Hero */}
      <div className="relative aspect-[16/7] bg-muted rounded-xl overflow-hidden">
        <img
          src={course.image_url}
          alt={course.title}
          className="w-full h-full object-cover"
          onError={handleImgError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className={badgesPositionClass}>
          <SourceBadge source={course.source} lang={lang} />
          <CouponBadge
            isFreeForever={course.isFreeForever}
            couponExpiresAt={course.couponExpiresAt}
            lang={lang}
          />
          <Badge className="text-[11px] bg-green-600 text-white border-0 font-bold">
            <Gift className="h-2.5 w-2.5 ml-1" />
            FREE 100%
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <span className="text-[10px] px-2 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm">
            {catInfo.icon} {catInfo[lang]}
          </span>
          <h2 className="text-white font-bold text-base sm:text-xl leading-tight mt-1.5 drop-shadow-md line-clamp-2">
            {course.title}
          </h2>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {course.instructor && (
          <InfoCard
            icon={<User className="h-3.5 w-3.5 text-amber-600" />}
            label={t('instructor')}
            value={course.instructor}
          />
        )}
        <InfoCard
          icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
          label={t('rating')}
          value={course.rating ? course.rating + '/5' : '-'}
        />
        {course.students_count != null && course.students_count > 0 && (
          <InfoCard
            icon={<TrendingUp className="h-3.5 w-3.5 text-green-600" />}
            label={t('students')}
            value={course.students_count.toLocaleString()}
          />
        )}
        {course.language && (
          <InfoCard
            icon={<Globe className="h-3.5 w-3.5 text-teal-600" />}
            label={t('language')}
            value={course.language}
          />
        )}
        {course.duration && (
          <InfoCard
            icon={<Clock className="h-3.5 w-3.5 text-orange-600" />}
            label={t('duration')}
            value={course.duration}
          />
        )}
        {course.original_price && (
          <InfoCard
            icon={<Tag className="h-3.5 w-3.5 text-rose-600" />}
            label={t('originalPrice')}
            value={<span className="line-through">{course.original_price}</span>}
          />
        )}
        {course.lastUpdated && (
          <InfoCard
            icon={<Calendar className="h-3.5 w-3.5 text-violet-600" />}
            label={t('lastUpdated')}
            value={course.lastUpdated}
          />
        )}
        <InfoCard
          icon={<Zap className="h-3.5 w-3.5 text-amber-600" />}
          label={t('source')}
          value={course.sourceDetail || course.source}
        />
      </div>

      {/* Free forever banner */}
      {course.isFreeForever && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900">
          <Infinity className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            {lang === 'ar'
              ? '\u0647\u0630\u0647 \u0627\u0644\u062F\u0648\u0631\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0644\u0644\u0623\u0628\u062F - \u0633\u062A\u062D\u062A\u0641\u0638 \u0628\u0647\u0627 \u0645\u062F\u0649 \u0627\u0644\u062D\u064A\u0627\u0629 \u0628\u0639\u062F \u0627\u0644\u062A\u0633\u062C\u064A\u0644'
              : 'This course is free forever - you keep it for life after enrolling'}
          </p>
        </div>
      )}

      {/* Description */}
      {course.description && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-amber-600" />
            {t('description')}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.description}
          </p>
        </Card>
      )}

      {/* Requirements */}
      {course.requirements && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
            {t('requirements')}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.requirements}
          </p>
        </Card>
      )}

      {/* Who this course is for */}
      {course.whoFor && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-teal-600" />
            {t('whoFor')}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {course.whoFor}
          </p>
        </Card>
      )}

      {/* CTA */}
      <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 text-center sm:text-right">
            <h3 className="font-bold text-sm text-green-800 dark:text-green-300">
              {t('getCourseFree')}
            </h3>
            <p className="text-[11px] text-green-700 dark:text-green-400 mt-0.5">
              {t('getCourseFreeDesc')}
            </p>
          </div>
          <Button
            onClick={onGoToLink}
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-11 px-6 text-xs gap-2 rounded-lg"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('goToCourse')}
            <ArrowLeft className={ctaArrowClass} />
          </Button>
        </div>
      </Card>

      {/* Related courses */}
      {relatedCourses.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            {t('relatedCourses')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {relatedCourses.map((rc) => (
              <Card
                key={rc.id}
                className="overflow-hidden cursor-pointer group"
                onClick={() => onCardClick(rc.slug)}
              >
                <div className="relative aspect-[16/9] bg-muted">
                  <img
                    src={rc.image_url}
                    alt={rc.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    onError={handleImgError}
                    loading="lazy"
                  />
                  {rc.isFreeForever && (
                    <Badge className="absolute top-1 left-1 text-[9px] bg-emerald-500 text-white border-0">
                      <Infinity className="h-2 w-2 ml-0.5" />
                      &infin;
                    </Badge>
                  )}
                </div>
                <CardContent className="p-2">
                  <h5 className="text-[11px] font-medium line-clamp-2 group-hover:text-amber-700 dark:group-hover:text-amber-400 leading-snug">
                    {rc.title}
                  </h5>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[10px] px-1 py-0.5 rounded border bg-muted">
                      {getCat(rc.category).icon} {getCat(rc.category)[lang]}
                    </span>
                    <SourceBadge source={rc.source} lang={lang} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Link Page Component
// ============================================

interface LinkPageProps {
  lang: Lang
  dir: string
  t: TxFn
  course: CourseDetail | null
  onBack: () => void
}

function LinkPage(props: LinkPageProps) {
  const { lang, t, course, onBack } = props
  const [countdown, setCountdown] = useState(5)
  const lastCourseId = useRef(course?.id)

  // Reset countdown when course changes
  if (lastCourseId.current !== course?.id) {
    lastCourseId.current = course?.id
    setCountdown(5)
  }

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((p) => p - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const isRtl = lang === 'ar'
  const backArrowClass = isRtl ? 'h-3 w-3' : 'h-3 w-3 rotate-180'

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    e.currentTarget.src = PLACEHOLDER_IMG
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground">{t('courseNotFound')}</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowRight className={backArrowClass} />
            {t('backToDetail')}
          </Button>
        </div>
      </div>
    )
  }

  const udemyUrl = course.udemy_url || course.udemyUrl || '#'

  // SVG circle dash array for countdown
  const dashOffset = ((5 - countdown) / 5) * 100
  const strokeDashArray = dashOffset + ', 100'

  const notes = [
    {
      icon: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
      text: t('note1'),
    },
    {
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
      text: t('note2'),
    },
    {
      icon: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
      text: t('note3'),
    },
    {
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
      text: t('note4'),
    },
  ]

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      {/* Preview card */}
      <Card className="overflow-hidden">
        <div className="relative aspect-[16/7] bg-muted">
          <img
            src={course.image_url}
            alt={course.title}
            className="w-full h-full object-cover"
            onError={handleImgError}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2.5 left-2.5 right-2.5">
            <h2 className="text-white font-bold text-sm line-clamp-2 drop-shadow-md">
              {course.title}
            </h2>
          </div>
        </div>
        <CardContent className="p-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {course.instructor && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {course.instructor}
            </span>
          )}
          {course.rating && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              {course.rating}/5
            </span>
          )}
          {course.students_count != null && course.students_count > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {course.students_count.toLocaleString()}
            </span>
          )}
          <span className="flex items-center gap-1">
            <SourceBadge source={course.source} lang={lang} />
          </span>
          {course.isFreeForever && (
            <span className="flex items-center gap-1">
              <CouponBadge isFreeForever={course.isFreeForever} lang={lang} />
            </span>
          )}
        </CardContent>
      </Card>

      {/* About course */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900">
        <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
          {t('aboutCourse')}
        </h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {course.description}
        </p>
      </Card>

      {/* Important notes */}
      <Card className="p-4 space-y-2">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-amber-600" />
          {t('importantNotes')}
        </h3>
        {notes.map((n, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-[11px] text-muted-foreground"
          >
            <div className="shrink-0 mt-0.5">{n.icon}</div>
            <p className="leading-relaxed">{n.text}</p>
          </div>
        ))}
      </Card>

      {/* Countdown / CTA */}
      <div className="text-center space-y-3 pt-1">
        {countdown > 0 ? (
          <>
            <div className="relative w-16 h-16 mx-auto">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-green-100 dark:text-green-900"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={strokeDashArray}
                  className="text-green-600 dark:text-green-400"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-400">
                {countdown}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{t('preparing')}</p>
          </>
        ) : (
          <>
            <a
              href={udemyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-sm gap-2 rounded-lg">
                <Gift className="h-4 w-4" />
                {t('getOnUdemy')}
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground">
              {t('udemyRedirect')}
            </p>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-xs text-muted-foreground"
        >
          <ArrowRight className={backArrowClass} />
          {t('backToDetail')}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// Main Component (Exported)
// ============================================

export default function Home() {
  const [lang, setLang] = useState<Lang>('ar')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleLang = () => setLang((l) => (l === 'ar' ? 'en' : 'ar'))
  const dir = lang === 'ar' ? 'rtl' : 'ltr'

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
  const [selectedCourse, setSelectedCourse] = useState<CourseDetail | null>(
    null
  )
  const [relatedCourses, setRelatedCourses] = useState<Course[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const t = createTx(lang)

  const fetchCourses = useCallback(
    async (p: number, s: string, cat: string, sortVal: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: '12',
        })
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

  const openCourseDetail = async (slug: string) => {
    setDetailLoading(true)
    setView('detail')
    setSelectedCourse(null)
    setRelatedCourses([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const res = await fetch('/api/courses/' + slug)
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

  if (!mounted) return null

  const backBtnArrowClass =
    lang === 'en' ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'

  return (
    <div className={cn('min-h-screen bg-background flex flex-col', dir)}>
      {/* ===== HEADER ===== */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={
              view !== 'grid'
                ? view === 'link'
                  ? goBackToDetail
                  : goBackToGrid
                : undefined
            }
            className="flex items-center gap-2"
          >
            {view !== 'grid' && (
              <div className="bg-muted rounded-md p-1 hover:bg-muted/80">
                <ArrowRight className={backBtnArrowClass} />
              </div>
            )}
            <GraduationCap className="h-5 w-5 text-amber-600" />
            <span className="font-bold text-sm tracking-tight">
              OWL<span className="text-amber-600">COURSE</span>
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            {total > 0 && view === 'grid' && (
              <Badge
                variant="secondary"
                className="text-[11px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
              >
                <Gift className="h-3 w-3 ml-1" />
                {total} {t('freeCourses')}
              </Badge>
            )}
            {view === 'grid' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchCourses(page, search, selectedCategory, sort)}
                className="h-8 w-8"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLang}
              className="h-8 w-8"
              title={lang === 'ar' ? 'English' : '\u0639\u0631\u0628\u064A'}
            >
              <Languages className="h-3.5 w-3.5" />
            </Button>
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

      {/* ===== MAIN ===== */}
      <main className="flex-1">
        {view === 'grid' && (
          <div className="view-enter">
            <GridPage
              lang={lang}
              dir={dir}
              t={t}
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
              lang={lang}
              dir={dir}
              t={t}
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
              lang={lang}
              dir={dir}
              t={t}
              course={selectedCourse}
              onBack={goBackToDetail}
            />
          </div>
        )}
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t bg-card/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-amber-600" />
            <span className="font-bold text-xs">
              OWL<span className="text-amber-600">COURSE</span>
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground text-center max-w-sm">
            {t('footerDesc')}
          </p>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-rose-400" />
              {t('footerFree')}
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              {t('footerUpdated')}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-green-500" />
              {t('footerVerified')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
