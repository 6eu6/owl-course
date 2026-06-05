'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Database,
  Delete,
  Edit3,
  Eye,
  FileCode,
  FileText,
  GitBranch,
  Globe,
  Layers,
  LayoutDashboard,
  Lock,
  MemoryStick,
  MonitorSmartphone,
  Palette,
  Puzzle,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  XCircle,
  Zap,
  FolderTree,
  HardDrive,
  AlertCircle,
  CheckCircle,
  FileWarning,
  FileQuestion,
} from 'lucide-react'

// ===== DATA =====

const projectStats = {
  totalPythonFiles: 19,
  totalTemplateFiles: 21,
  totalStaticFiles: 9,
  totalLinesPython: 9268,
  totalRoutes: 102,
  missingPythonFiles: 5,
  missingTemplates: 19,
  brokenImports: 7,
  criticalBugs: 6,
  securityIssues: 4,
  deadCodeFiles: 4,
  duplicateCode: 8,
}

const healthScore = {
  overall: 18,
  backend: 25,
  frontend: 12,
  admin: 8,
  database: 45,
  security: 20,
}

const criticalBugs = [
  {
    id: 'bug-1',
    severity: 'critical',
    title: 'telegram_bot_new.py غير موجود',
    description: 'routes.py يستورد from telegram_bot_new import TelegramBot في السطر 7، لكن الملف غير موجود. التطبيق يبدأ بدون أي مسارات (routes).',
    location: 'routes.py:7',
    fix: 'تغيير الاستيراد إلى from telegram_bot_updated import TelegramBot',
  },
  {
    id: 'bug-2',
    severity: 'critical',
    title: 'telegram_bot.py غير موجود',
    description: 'ultra_fast_scraper.py يستورد من telegram_bot.py غير الموجود. السكرايبر سيسحق عند الاستيراد.',
    location: 'ultra_fast_scraper.py:19',
    fix: 'تغيير إلى from telegram_bot_updated import TelegramBot',
  },
  {
    id: 'bug-3',
    severity: 'critical',
    title: '19 قالب ادمن مفقود من أصل 22',
    description: 'فقط 3 قوالب ادمن موجودة على القرص. جميع صفحات الإدارة ستعطي 500 Error.',
    location: 'templates/admin/',
    fix: 'إنشاء القوالب المفقودة أو حذف المسارات غير المستخدمة',
  },
  {
    id: 'bug-4',
    severity: 'critical',
    title: 'partials/course_card.html مفقود',
    description: 'index.html و merged_base.html يحتويا على {% include "partials/course_card.html" %} لكن الملف غير موجود. الصفحة الرئيسية لن تعمل.',
    location: 'templates/partials/course_card.html',
    fix: 'إنشاء ملف course_card.html في templates/partials/',
  },
  {
    id: 'bug-5',
    severity: 'critical',
    title: 'دالة load_user معرّفة مرتين في app.py',
    description: 'app.py يعرف load_user في السطر 147 و السطر 219. الثانية تتجاوز الأولى. الصف الأول من Admin class هو كود ميت.',
    location: 'app.py:147, 219',
    fix: 'حذف التعريف الأول والأول من class Admin في app.py',
  },
  {
    id: 'bug-6',
    severity: 'critical',
    title: 'جدولان للجدولة يعملان في وقت واحد',
    description: 'advanced_scheduler.py يبدأ من app.py و scheduler_service.py يبدأ من main.py. كلاهما يشغل السكرايبرات مما يسبب تضارب.',
    location: 'app.py + main.py',
    fix: 'حذف أحد المجدولين. الاحتفاظ بـ advanced_scheduler.py فقط.',
  },
]

const securityIssues = [
  {
    id: 'sec-1',
    title: 'بيانات MongoDB مكشوفة في الكود',
    description: 'كلمة المرور Ah251403 واسم المستخدم 6_u6 مكتوبة في app.py, slug_utils.py, final_studybullet_scraper.py, shrinkme_service.py',
    files: ['app.py:160', 'slug_utils.py', 'final_studybullet_scraper.py:19', 'shrinkme_service.py'],
  },
  {
    id: 'sec-2',
    title: 'مفتاح ShrinkMe API مكشوف',
    description: 'API Key مكتوب مباشرة في shrinkme_service.py:16',
    files: ['shrinkme_service.py:16'],
  },
  {
    id: 'sec-3',
    title: 'كلمة مرور الادمن بنص واضح',
    description: 'ADMIN_PASSWORD يتم مقارنتها بنص عادي بدون تشفير',
    files: ['routes.py:621'],
  },
  {
    id: 'sec-4',
    title: 'استيرادات دائرية تعرض البنية الداخلية',
    description: 'auto_category_generator.py يستورد من app، و smart_monetization.py يستورد من main - مخاطر أمنية',
    files: ['auto_category_generator.py:10', 'smart_monetization.py:173'],
  },
]

const filesToDelete = [
  {
    file: 'cron_scraper.py',
    lines: 87,
    reason: 'كود ميت - يستورد من database_manager.py غير الموجود + يستدعي scrape_courses() غير الموجودة. محلها المجدول في التطبيق.',
  },
  {
    file: 'cron_telegram.py',
    lines: 56,
    reason: 'كود ميت - يستورد من telegram_continuous_poster و telegram_manager غير الموجودين. محلها المجدول.',
  },
  {
    file: 'content_generator.py',
    lines: 385,
    reason: 'كود ميت - غير مستورد في أي ملف. منشئ محتوى مزيف وليس AI.',
  },
  {
    file: 'templates/free_courses_old.html',
    lines: 353,
    reason: 'نسخة قديمة غير مستخدمة - غير مرجع في routes.py.',
  },
  {
    file: 'scheduler_service.py',
    lines: 480,
    reason: 'مجدول مكرر - advanced_scheduler.py يفعل نفس الوظيفة ويعملان في وقت واحد.',
  },
  {
    file: 'static/js/live-counter.js',
    lines: 305,
    reason: 'كود ميت - غير محمل في أي قالب.',
  },
  {
    file: 'static/css/telegram-fix.css',
    lines: 156,
    reason: 'غير محمل في merged_base.html - ربما ميت.',
  },
  {
    file: 'ADMIN_DASHBOARD_COMPLETE_GUIDE.md',
    lines: 0,
    reason: 'توثيق قديم للوحة التحكم القديمة.',
  },
  {
    file: 'RENDER_DEPLOYMENT_ANALYSIS_REPORT.md',
    lines: 0,
    reason: 'تقرير نشر قديم.',
  },
  {
    file: 'DEPLOYMENT_FINAL_STATUS.md',
    lines: 0,
    reason: 'حالة نشر قديمة.',
  },
]

const filesToKeep = [
  {
    file: 'app.py',
    lines: 322,
    status: 'needs-cleanup',
    issues: ['حذف Admin class المكرر (السطر 131-151)', 'حذف load_user المكرر (السطر 219)', 'نقل بيانات MongoDB إلى env vars فقط'],
  },
  {
    file: 'routes.py',
    lines: 5236,
    status: 'needs-split',
    issues: ['5236 سطر! يجب تقسيمه إلى عدة ملفات', '102+ مسار يجب تنظيمها', 'تكرار كبير في منطق الفلترة والترقيم'],
  },
  {
    file: 'models.py',
    lines: 59,
    status: 'needs-cleanup',
    issues: ['حذف class Course غير المستخدمة'],
  },
  {
    file: 'database_system.py',
    lines: 613,
    status: 'keep',
    issues: ['إصلاح خطأ اسم العمود في clear_old_logs()', 'فقط لا مشاكل جوهرية'],
  },
  {
    file: 'ultra_fast_scraper.py',
    lines: 535,
    status: 'needs-fix',
    issues: ['إصلاح الاستيراد من telegram_bot إلى telegram_bot_updated', 'حذف البيانات المزيفة أو إضافة علامة "تقريبي"'],
  },
  {
    file: 'final_studybullet_scraper.py',
    lines: 399,
    status: 'needs-fix',
    issues: ['إزالة بيانات MongoDB المكتوبة', 'إصلاح البيانات المزيفة'],
  },
  {
    file: 'telegram_bot_updated.py',
    lines: 492,
    status: 'needs-fix',
    issues: ['إزالة النطاق المكتوب vercel.app', 'استخدام اتصال DB مشترك من app.py'],
  },
  {
    file: 'advanced_scheduler.py',
    lines: 893,
    status: 'keep',
    issues: ['إصلاح الملف المقطوع في النهاية', 'توحيد مصدر إعدادات المجدول'],
  },
  {
    file: 'utils.py',
    lines: 349,
    status: 'needs-merge',
    issues: ['دمج منطق التصنيف المكرر مع auto_category_generator.py', 'تحسين الترقيم لتجنب تحميل كل المستندات'],
  },
  {
    file: 'slug_utils.py',
    lines: 168,
    status: 'needs-fix',
    issues: ['إصلاح خطأ العداد في add_slugs_to_existing_courses()', 'استخدام اتصال DB مشترك'],
  },
  {
    file: 'auto_category_generator.py',
    lines: 350,
    status: 'needs-fix',
    issues: ['إزالة الاستيراد الدائري من app.py', 'دمج مع utils.py', 'إضافة ترقيم للعمليات'],
  },
  {
    file: 'visitor_tracking.py',
    lines: 247,
    status: 'needs-optimization',
    issues: ['3 استعلامات MongoDB لكل زيارة! يجب التقليل', 'إزالة البيانات المزيفة للدول', 'إضافة تخزين مؤقت'],
  },
  {
    file: 'shrinkme_service.py',
    lines: 213,
    status: 'needs-fix',
    issues: ['نقل API key إلى env vars', 'إزالة بيانات MongoDB المكتوبة', 'استخدام DB مشترك'],
  },
  {
    file: 'main.py',
    lines: 55,
    status: 'needs-fix',
    issues: ['حذف scheduler_service.start_service() المكرر'],
  },
]

const filesMissing = [
  'telegram_bot_new.py',
  'telegram_bot.py',
  'telegram_continuous_poster.py',
  'telegram_manager.py',
  'database_manager.py',
  'coupon_checker.py (commented out)',
]

const templatesMissing = [
  'admin/login.html',
  'admin/dashboard.html',
  'admin/courses.html',
  'admin/telegram.html',
  'admin/telegram_messages.html',
  'admin/telegram_delete.html',
  'admin/pending_courses.html',
  'admin/settings.html',
  'admin/ads.html',
  'admin/ads_create.html',
  'admin/ads_google.html',
  'admin/scrapers.html',
  'admin/database_stats.html',
  'admin/security_logs.html',
  'admin/performance_monitor.html',
  'admin/edit_course.html',
  'admin_base.html',
  'partials/course_card.html',
]

const cssIssues = [
  { file: 'main.css', issue: '~15+ تعريف CSS مكرر', impact: 'عالي' },
  { file: 'main.css', issue: 'متغيرات --gray-* غير معرفة', impact: 'متوسط' },
  { file: 'main.css + owl-course-theme.css', issue: 'قيمتين مختلفتين لـ --warm-brown', impact: 'عالي' },
  { file: 'universal-responsive.css', issue: 'تكرار كامل لقواعد main.css', impact: 'عالي' },
  { file: 'main.js + universal-responsive.js', issue: 'منطق البحث والفلاتر مكرر مرتين', impact: 'عالي' },
  { file: 'course_detail.html', issue: 'JS التقييم والمشاركة مكرر مرتين', impact: 'متوسط' },
]

const restructurePlan = [
  {
    phase: 'المرحلة 1: إصلاحات حرجة (تمنع التطبيق من العمل)',
    steps: [
      'إصلاح الاستيراد المكسور: telegram_bot_new.py → telegram_bot_updated.py في routes.py',
      'إصلاح الاستيراد المكسور: telegram_bot.py → telegram_bot_updated.py في ultra_fast_scraper.py',
      'حذف load_user المكرر و Admin class الميت من app.py',
      'إنشاء templates/partials/course_card.html (حتى ملف بسيط)',
      'حذف استدعاء scheduler_service من main.py (الاحتفاظ بـ advanced_scheduler فقط)',
    ],
    color: 'bg-red-500',
    icon: AlertTriangle,
  },
  {
    phase: 'المرحلة 2: تنظيف ملفات ميتة',
    steps: [
      'حذف: cron_scraper.py (كود ميت بالكامل)',
      'حذف: cron_telegram.py (كود ميت بالكامل)',
      'حذف: content_generator.py (غير مستورد)',
      'حذف: scheduler_service.py (مكرر مع advanced_scheduler.py)',
      'حذف: free_courses_old.html (غير مستخدم)',
      'حذف: live-counter.js (غير محمل)',
      'حذف: telegram-fix.css (غير محمل)',
      'حذف: ملفات .md القديمة (3 ملفات)',
    ],
    color: 'bg-orange-500',
    icon: Trash2,
  },
  {
    phase: 'المرحلة 3: تقسيم routes.py (5236 سطر)',
    steps: [
      'إنشاء blueprints/routes و تقسيم المسارات:',
      '  → routes/public.py (الصفحات العامة: /, /category, /free-courses, /course)',
      '  → routes/course_detail.py (تفاصيل الدورة + الدخول)',
      '  → routes/admin.py (لوحة التحكم: /eu6a-admin/*)',
      '  → routes/admin_courses.py (إدارة الكورسات)',
      '  → routes/admin_telegram.py (إدارة التليجرام)',
      '  → routes/admin_settings.py (الإعدادات والإعلانات)',
      '  → routes/admin_scrapers.py (السكرايبرات)',
      '  → routes/api.py (API endpoints)',
      '  → routes/helpers.py (دوال مساعدة مشتركة)',
      'نقل المنطق المكرر (فلترة، ترقيم، دمج مجموعات) إلى helpers.py',
    ],
    color: 'bg-yellow-500',
    icon: FolderTree,
  },
  {
    phase: 'المرحلة 4: تنظيف القوالب',
    steps: [
      'تقسيم merged_base.html إلى: base.html + partials/navbar.html + partials/footer.html + partials/hero.html',
      'إصلاح HTML المكسور في privacy_policy.html و terms_of_service.html',
      'حذف مراجع CSS مفقودة من merged_base.html (4 ملفات)',
      'إصلاح اسم admin/courses_pending.html → admin/pending_courses.html أو العكس',
      'دمج css المكرر في main.css + universal-responsive.css',
      'حذف js المكرر بين main.js و universal-responsive.js',
    ],
    color: 'bg-green-500',
    icon: LayoutDashboard,
  },
  {
    phase: 'المرحلة 5: إصلاح الأمان',
    steps: [
      'نقل جميع بيانات MongoDB إلى متغيرات بيئة (.env)',
      'نقل ShrinkMe API key إلى .env',
      'تشفير كلمة مرور الادمن (باستخدام bcrypt/werkzeug)',
      'إصلاح الاستيرادات الدائرية في auto_category_generator و smart_monetization',
    ],
    color: 'bg-blue-500',
    icon: ShieldCheck,
  },
  {
    phase: 'المرحلة 6: تحسين الأداء',
    steps: [
      'تقليل استعلامات visitor_tracking من 3 إلى 1 لكل زيارة (دمجها)',
      'إضافة caching للفئات (categories) في Redis أو في الذاكرة',
      'استخدام cursor-based pagination بدلاً من تحميل كل المستندات في الذاكرة',
      'مشاركة اتصال MongoDB واحد بين كل الوحدات',
    ],
    color: 'bg-purple-500',
    icon: Zap,
  },
  {
    phase: 'المرحلة 7: تنظيف البيانات المزيفة',
    steps: [
      'السكرايبرات تولد بيانات مزيفة (تقييمات، عدد طلاب، أسعار)',
      'إما: حذف البيانات المزيفة وعرض "غير متوفر"',
      'أو: إضافة علامة is_estimated=True في قاعدة البيانات',
      'إصلاح visitor_tracking.py الذي يولد دول عشوائية',
    ],
    color: 'bg-pink-500',
    icon: Eye,
  },
]

const architectureSuggestion = {
  current: [
    'app.py (إعداد التطبيق + Admin + DB)',
    'routes.py (5236 سطر - كل شيء)',
    '19 ملف Python منفصلة',
    'MongoDB + PostgreSQL هجين',
    'بدون تنظيم وحدات',
  ],
  proposed: [
    'app.py (إعداد التطبيق فقط)',
    'routes/ (مجلد منظم بالـ blueprints)',
    '  ├── __init__.py',
    '  ├── public.py (صفحات عامة)',
    '  ├── admin.py (لوحة تحكم)',
    '  ├── api.py (API endpoints)',
    '  └── helpers.py (دوال مشتركة)',
    'services/ (خدمات)',
    '  ├── scraper.py (سكرايبر Udemy)',
    '  ├── studybullet_scraper.py (سكرايبر StudyBullet)',
    '  ├── telegram_bot.py (بوت تليجرام)',
    '  └── scheduler.py (مجدول واحد)',
    'utils/ (أدوات)',
    '  ├── database.py (اتصال DB مشترك)',
    '  ├── categories.py (تصنيف موحد)',
    '  └── slugs.py (slug موحد)',
    'templates/ (قوالب نظيفة)',
    '  ├── base.html',
    '  ├── partials/',
    '  ├── public/',
    '  └── admin/',
  ],
}

// ===== COMPONENTS =====

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
    critical: { label: 'حرج', variant: 'destructive' },
    high: { label: 'عالي', variant: 'default' },
    medium: { label: 'متوسط', variant: 'secondary' },
    low: { label: 'منخفض', variant: 'outline' },
  }
  const c = config[severity] || config.low
  return <Badge variant={c.variant}>{c.label}</Badge>
}

function HealthMeter({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const color =
    value >= 70 ? 'text-green-500' : value >= 40 ? 'text-yellow-500' : value >= 20 ? 'text-orange-500' : 'text-red-500'
  const barColor =
    value >= 70
      ? 'bg-green-500'
      : value >= 40
        ? 'bg-yellow-500'
        : value >= 20
          ? 'bg-orange-500'
          : 'bg-red-500'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="font-medium">{label}</span>
        </div>
        <span className={`font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className={`h-2 ${barColor}`} />
    </div>
  )
}

function FileCard({ file, lines, status, issues }: { file: string; lines: number; status?: string; issues?: string[] }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    'keep': { label: 'يُحتفظ به', color: 'bg-green-100 text-green-800' },
    'needs-cleanup': { label: 'يحتاج تنظيف', color: 'bg-yellow-100 text-yellow-800' },
    'needs-split': { label: 'يحتاج تقسيم', color: 'bg-red-100 text-red-800' },
    'needs-fix': { label: 'يحتاج إصلاح', color: 'bg-orange-100 text-orange-800' },
    'needs-merge': { label: 'يحتاج دمج', color: 'bg-blue-100 text-blue-800' },
    'needs-optimization': { label: 'يحتاج تحسين', color: 'bg-purple-100 text-purple-800' },
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-mono">{file}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{lines} سطر</Badge>
            {status && <Badge className={`text-xs ${statusConfig[status]?.color}`}>{statusConfig[status]?.label}</Badge>}
          </div>
        </div>
      </CardHeader>
      {issues && issues.length > 0 && (
        <CardContent className="pt-0">
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ChevronDown className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}

function StatCard({ icon: Icon, label, value, description, color }: { icon: React.ElementType; label: string; value: string | number; description: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

// ===== MAIN PAGE =====

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">OWL COURSE</h1>
                <p className="text-sm text-muted-foreground">خطة إصلاح وهيكلة شاملة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {projectStats.criticalBugs} أخطاء حرجة
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                تحليل كامل
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto bg-muted p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1">
              <Eye className="h-3.5 w-3.5" />
              نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="bugs" className="text-xs sm:text-sm gap-1">
              <Bug className="h-3.5 w-3.5" />
              الأخطاء الحرجة
              <Badge variant="destructive" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
                {criticalBugs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm gap-1">
              <Lock className="h-3.5 w-3.5" />
              الأمان
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="text-xs sm:text-sm gap-1">
              <Trash2 className="h-3.5 w-3.5" />
              التنظيف
            </TabsTrigger>
            <TabsTrigger value="files" className="text-xs sm:text-sm gap-1">
              <FolderTree className="h-3.5 w-3.5" />
              الملفات
            </TabsTrigger>
            <TabsTrigger value="frontend" className="text-xs sm:text-sm gap-1">
              <MonitorSmartphone className="h-3.5 w-3.5" />
              الواجهة
            </TabsTrigger>
            <TabsTrigger value="plan" className="text-xs sm:text-sm gap-1">
              <Wrench className="h-3.5 w-3.5" />
              خطة العمل
            </TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs sm:text-sm gap-1">
              <Layers className="h-3.5 w-3.5" />
              الهيكلة
            </TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={FileCode} label="ملفات Python" value={projectStats.totalPythonFiles} description="19 ملف، 9268 سطر إجمالي" color="bg-blue-500" />
              <StatCard icon={LayoutDashboard} label="مسارات (Routes)" value={projectStats.totalRoutes} description="102 مسار في ملف واحد!" color="bg-purple-500" />
              <StatCard icon={FileWarning} label="ملفات مفقودة" value={projectStats.missingPythonFiles + projectStats.missingTemplates} description={`${projectStats.missingPythonFiles} Python + ${projectStats.missingTemplates} قالب`} color="bg-red-500" />
              <StatCard icon={AlertCircle} label="أخطاء حرجة" value={projectStats.criticalBugs} description="تمنع التطبيق من العمل" color="bg-orange-500" />
            </div>

            {/* Health Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5" />
                  صحة المشروع
                </CardTitle>
                <CardDescription>تقييم عام لكل مكون من مكونات المشروع</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <HealthMeter label="الصحة العامة" value={healthScore.overall} icon={Activity} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <HealthMeter label="الباك إند" value={healthScore.backend} icon={Server} />
                  <HealthMeter label="الفرانت إند" value={healthScore.frontend} icon={Globe} />
                  <HealthMeter label="لوحة الإدارة" value={healthScore.admin} icon={Users} />
                  <HealthMeter label="قاعدة البيانات" value={healthScore.database} icon={Database} />
                  <HealthMeter label="الأمان" value={healthScore.security} icon={Lock} />
                </div>
              </CardContent>
            </Card>

            {/* Quick Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  ملخص التشخيص
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-2">
                      <XCircle className="h-4 w-4" /> المشاكل الحرجة
                    </h3>
                    <ul className="space-y-2 text-sm text-red-700">
                      <li className="flex items-start gap-2">
                        <Bug className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>استيراد مكسور في routes.py (telegram_bot_new.py) — التطبيق يبدأ بدون مسارات</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bug className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>19 من 22 قالب ادمن مفقود — لوحة التحكم لا تعمل</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bug className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>ملف course_card.html مفقود — الصفحة الرئيسية لا تعمل</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bug className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>مجدولان يعملان معاً — تضارب وتكرار</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> المشاكل الهيكلية
                    </h3>
                    <ul className="space-y-2 text-sm text-amber-700">
                      <li className="flex items-start gap-2">
                        <Code2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>routes.py: 5236 سطر — ملف واحد يحتوي كل شيء</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Puzzle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>4 ملفات كود ميت (cron_scraper, cron_telegram, content_generator, scheduler_service)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <HardDrive className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>اتصالات MongoDB متعددة بدلاً من واحد مشترك</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <RefreshCw className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>تكرار كبير في CSS و JS و منطق Python</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CRITICAL BUGS TAB ===== */}
          <TabsContent value="bugs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-red-500" />
                  الأخطاء الحرجة
                </CardTitle>
                <CardDescription>أخطاء تمنع التطبيق من العمل أو تسبب crashes</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {criticalBugs.map((bug) => (
                    <AccordionItem key={bug.id} value={bug.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <SeverityBadge severity={bug.severity} />
                          <span className="font-semibold text-sm">{bug.title}</span>
                          <code className="text-xs text-muted-foreground">{bug.location}</code>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">{bug.description}</p>
                          <div className="flex items-start gap-2 rounded-md bg-green-50 border border-green-200 p-3">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-green-800">الحل:</p>
                              <p className="text-sm text-green-700">{bug.fix}</p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            {/* Missing Python Files */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5 text-orange-500" />
                  ملفات Python مفقودة (مستوردة لكن غير موجودة)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {filesMissing.map((file) => (
                    <div key={file} className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                      <XCircle className="h-4 w-4 text-orange-500" />
                      <code className="text-sm font-mono">{file}</code>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== SECURITY TAB ===== */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-red-500" />
                  مشاكل أمنية
                </CardTitle>
                <CardDescription>ثغرات أمنية يجب إصلاحها فوراً</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {securityIssues.map((issue) => (
                    <AccordionItem key={issue.id} value={issue.id}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-semibold">{issue.title}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">{issue.description}</p>
                          <div>
                            <p className="text-xs font-semibold mb-2">الملفات المتأثرة:</p>
                            <div className="flex flex-wrap gap-1">
                              {issue.files.map((f) => (
                                <Badge key={f} variant="destructive" className="text-xs font-mono">
                                  {f}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== CLEANUP TAB ===== */}
          <TabsContent value="cleanup" className="space-y-4">
            {/* Files to Delete */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-red-500" />
                  ملفات للحذف
                </CardTitle>
                <CardDescription>ملفات كود ميت أو مكررة يجب حذفها</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filesToDelete.map((item) => (
                    <div key={item.file} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <Delete className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-semibold">{item.file}</code>
                          {item.lines > 0 && (
                            <Badge variant="outline" className="text-xs">{item.lines} سطر</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CSS/JS Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-purple-500" />
                  مشاكل CSS و JS
                </CardTitle>
                <CardDescription>تكرار وتعارضات في ملفات الواجهة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cssIssues.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md border p-3">
                      <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-mono">{item.file}</code>
                          <Badge variant={item.impact === 'عالي' ? 'destructive' : 'secondary'} className="text-xs">
                            {item.impact}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.issue}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== FILES TAB ===== */}
          <TabsContent value="files" className="space-y-4">
            {/* Files to Keep */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  الملفات المهمة (يُحتفظ بها)
                </CardTitle>
                <CardDescription>14 ملف Python أساسي + التعديلات المطلوبة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filesToKeep.map((item) => (
                    <FileCard key={item.file} file={item.file} lines={item.lines} status={item.status} issues={item.issues} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Missing Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-orange-500" />
                  القوالب المفقودة ({templatesMissing.length} قالب)
                </CardTitle>
                <CardDescription>قوالب مرجعية في routes.py لكنها غير موجودة على القرص</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {templatesMissing.map((t) => (
                      <div key={t} className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-2">
                        <XCircle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                        <code className="text-xs font-mono">{t}</code>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== FRONTEND TAB ===== */}
          <TabsContent value="frontend" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorSmartphone className="h-5 w-5 text-blue-500" />
                  تحليل الواجهة الأمامية
                </CardTitle>
                <CardDescription>مشاكل القوالب، CSS، JS، والصور</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Template Issues */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> مشاكل القوالب
                    </h3>
                    <div className="space-y-2">
                      {[
                        { issue: 'merged_base.html (749 سطر): ملف عملاق يحتوي كل شيء - يجب تقسيمه', severity: 'high' },
                        { issue: 'privacy_policy.html + terms_of_service.html: HTML مكسور في كل عناوين h3', severity: 'critical' },
                        { issue: 'course_detail.html (1047+ سطر): CSS و JS مكرر مرتين داخل الملف', severity: 'high' },
                        { issue: 'course_access.html (895 سطر): صور مفقودة + CSS متغيرات غير معرفة', severity: 'medium' },
                        { issue: '404.html (506 سطر): صفحة خطأ مبالغ في تصميمها', severity: 'low' },
                        { issue: 'about.html: إحصائيات ثابتة وليست ديناميكية', severity: 'low' },
                        { issue: 'admin/courses_pending.html: اسم الملف لا يطابق ما في routes.py', severity: 'critical' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                          <SeverityBadge severity={item.severity} />
                          <span className="text-sm">{item.issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Missing Static Assets */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <FileWarning className="h-4 w-4" /> ملفات ثابتة مفقودة
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { file: 'css/course-cards-enhanced.css', type: 'CSS' },
                        { file: 'css/search-filter-theme-fix.css', type: 'CSS' },
                        { file: 'css/simple-filter-design.css', type: 'CSS' },
                        { file: 'css/telegram-unified.css', type: 'CSS' },
                        { file: 'css/admin.css', type: 'CSS' },
                        { file: 'images/owl_course_logo_hd.png', type: 'صورة' },
                        { file: 'images/animated_header.gif', type: 'صورة' },
                        { file: 'images/owl_learn_logo_hd.png', type: 'صورة' },
                        { file: 'images/how-to-get-course-instructions.svg', type: 'SVG' },
                        { file: 'images/thanks-for-visiting.gif', type: 'صورة' },
                      ].map((item) => (
                        <div key={item.file} className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 p-2">
                          <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                          <code className="text-xs font-mono">{item.file}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* JS Issues */}
                  <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Code2 className="h-4 w-4" /> مشاكل JavaScript
                    </h3>
                    <div className="space-y-2">
                      {[
                        'main.js: 3 دوال معرفة لكن غير مستدعاة (initializeCourseCards, initializeSmoothScrolling, initializeFormValidation)',
                        'main.js + universal-responsive.js: منطق البحث والفلاتر مكرر - كلاهما يعمل عند تحميل الصفحة',
                        'universal-responsive.js: handleResponsiveChanges يسبب وميض مرئي عند تغيير الاتجاه',
                        'course_detail.html: دالتين للتقييم pointing to API endpoints مختلفة (/api/rate-course vs /api/course-rating)',
                        'main.js: fetchSearchSuggestions يطلب /api/courses/search غير الموجود',
                        'console.log متروك في كود الإنتاج (course_detail.html, course_access.html)',
                      ].map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{issue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PLAN TAB ===== */}
          <TabsContent value="plan" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-500" />
                  خطة العمل: 7 مراحل
                </CardTitle>
                <CardDescription>تنفيذ بالترتيب - كل مرحلة تعتمد على سابقتها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {restructurePlan.map((phase, idx) => (
                  <div key={idx} className="rounded-lg border overflow-hidden">
                    <div className={`flex items-center gap-3 px-4 py-3 ${phase.color} text-white`}>
                      <phase.icon className="h-5 w-5" />
                      <span className="font-semibold">{phase.phase}</span>
                    </div>
                    <div className="p-4">
                      <ul className="space-y-2">
                        {phase.steps.map((step, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-2 text-sm">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold flex-shrink-0 mt-0.5">
                              {sIdx + 1}
                            </div>
                            <span className={step.startsWith('  ') ? 'font-mono text-xs text-muted-foreground' : ''}>
                              {step.trim()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== ARCHITECTURE TAB ===== */}
          <TabsContent value="architecture" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    الهيكل الحالي (فوضوي)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md bg-red-50 border border-red-200 p-4">
                    <div className="space-y-1 font-mono text-sm">
                      {architectureSuggestion.current.map((line, i) => (
                        <div key={i} className={line.includes('5236') ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    الهيكل المقترح (منظم)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md bg-green-50 border border-green-200 p-4">
                    <div className="space-y-1 font-mono text-sm">
                      {architectureSuggestion.proposed.map((line, i) => (
                        <div key={i} className={
                          line.startsWith('  ├──') || line.startsWith('  └──') ? 'text-green-700' :
                          line.startsWith('routes/') || line.startsWith('services/') || line.startsWith('utils/') || line.startsWith('templates/') ? 'text-green-800 font-semibold' :
                          'text-muted-foreground'
                        }>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Key Improvements Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  ملخص التحسينات المتوقعة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: 'ملفات أقل', desc: 'من 19 إلى 12 ملف Python', icon: FileText },
                    { label: 'تنظيم المسارات', desc: 'من 1 ملف (5236 سطر) إلى 8 ملفات', icon: FolderTree },
                    { label: 'لا كود ميت', desc: 'حذف 4 ملفات + تنظيف القوالب', icon: Trash2 },
                    { label: 'أمان أفضل', desc: 'لا بيانات مكشوفة في الكود', icon: Lock },
                    { label: 'أداء أسرع', desc: '1 اتصال DB مشترك + caching', icon: Zap },
                    { label: 'صيانة أسهل', desc: 'هيكل واضح ومنظم', icon: Wrench },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 flex-shrink-0">
                        <item.icon className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-xs text-muted-foreground">
              تحليل مشروع OWL COURSE — تم إنشاء هذا التقرير تلقائياً
            </p>
            <p className="text-xs text-muted-foreground">
              {projectStats.totalPythonFiles + projectStats.totalTemplateFiles + projectStats.totalStaticFiles} ملف تم تحليله • {projectStats.totalLinesPython} سطر Python
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Activity icon for HealthMeter
function Activity({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  )
}
