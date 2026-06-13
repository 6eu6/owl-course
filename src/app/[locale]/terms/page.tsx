import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isSupportedLocale, type Locale } from '@/lib/i18n'
import { StaticPage, type Block } from '@/components/static-page'

const CONTENT: Record<Locale, { title: string; blocks: Block[] }> = {
  en: {
    title: 'Terms of Use',
    blocks: [
      { p: 'By using Learn Plus Courses you agree to these terms. The site helps you discover online courses and open the original course provider page.' },
      { h: 'Use of the site', p: 'You may browse, search and share course listings for personal use. Please do not attempt to disrupt, scrape or misuse the service.' },
      { h: 'Course availability', p: 'Course offers are time-limited and provided by third-party learning platforms. Availability can change at any time and is outside our control. If a course offer changes when you reach it, please check back later. The catalogue updates regularly.' },
      { h: 'No warranty', p: 'The site and its content are provided “as is”, without warranties of any kind. We are not responsible for the content, quality or availability of courses hosted on external platforms.' },
      { h: 'Changes', p: 'We may update these terms from time to time. Continued use of the site means you accept the latest version.' },
    ],
  },
  ar: {
    title: 'شروط الاستخدام',
    blocks: [
      { p: 'باستخدامك Learn Plus Courses فإنك توافق على هذه الشروط. يساعدك الموقع على اكتشاف الدورات وفتح صفحة مزوّد الدورة الأصلي.' },
      { h: 'استخدام الموقع', p: 'يمكنك تصفّح قوائم الدورات والبحث فيها ومشاركتها للاستخدام الشخصي. يُرجى عدم محاولة تعطيل الخدمة أو سحب بياناتها أو إساءة استخدامها.' },
      { h: 'توفّر الدورات', p: 'عروض الدورات محدودة بوقت ومقدَّمة من منصّات تعليمية تابعة لأطراف ثالثة. قد يتغيّر التوفّر في أي وقت وهو خارج عن سيطرتنا. إذا تغيّر العرض عند وصولك إليه فعُد لاحقًا؛ فالكتالوج يُحدَّث بانتظام.' },
      { h: 'إخلاء المسؤولية', p: 'يُقدَّم الموقع ومحتواه «كما هو» دون أي ضمانات من أي نوع. ولسنا مسؤولين عن محتوى أو جودة أو توفّر الدورات المستضافة على منصّات خارجية.' },
      { h: 'التغييرات', p: 'قد نُحدّث هذه الشروط من وقت لآخر. واستمرارك في استخدام الموقع يعني قبولك بأحدث نسخة.' },
    ],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return {}
  return {
    title: CONTENT[locale].title,
    alternates: { canonical: `/${locale}/terms`, languages: { en: '/en/terms', ar: '/ar/terms' } },
  }
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }]
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  return <StaticPage locale={locale} title={CONTENT[locale].title} updated blocks={CONTENT[locale].blocks} />
}
