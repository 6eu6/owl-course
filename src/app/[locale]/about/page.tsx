import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isSupportedLocale, type Locale } from '@/lib/i18n'
import { StaticPage, type Block } from '@/components/static-page'

const CONTENT: Record<Locale, { title: string; blocks: Block[] }> = {
  en: {
    title: 'About Learn Plus Courses',
    blocks: [
      { p: 'Learn Plus Courses is a free learning hub. We surface high-quality online courses across development, business, design, data, marketing, personal growth and more, and make them easy to browse, search and start.' },
      { p: 'Our goal is simple: remove the friction between you and learning. The catalogue is refreshed automatically so there is always something new to learn. The experience stays fast, clean and easy to use on any device.' },
      {
        h: 'What we offer',
        list: [
          'A constantly updated library of free online courses.',
          'Clear course details with what you will learn, requirements and level.',
          'A minimal, distraction-free interface that works on any device.',
          'One-tap sharing so you can pass great courses to friends.',
        ],
      },
      { p: 'Learning should be open to everyone. We hope Learn Plus Courses helps you find your next skill and enjoy the journey of getting there.' },
    ],
  },
  ar: {
    title: 'عن Learn Plus Courses',
    blocks: [
      { p: 'Learn Plus Courses منصّة تعلّم مجانية. نجمع دورات أونلاين عالية الجودة في البرمجة والأعمال والتصميم والبيانات والتسويق وتطوير الذات وغيرها، ونجعلها سهلة التصفّح والبحث والبدء.' },
      { p: 'هدفنا بسيط: إزالة الحواجز بينك وبين التعلّم. يُحدَّث الكتالوج تلقائيًا فهناك دائمًا جديد لتتعلّمه، مع تجربة سريعة ونظيفة وسهلة على أي جهاز.' },
      {
        h: 'ماذا نقدّم',
        list: [
          'مكتبة دورات مجانية تتحدّث باستمرار.',
          'تفاصيل واضحة لكل دورة: ماذا ستتعلّم، المتطلبات، والمستوى.',
          'واجهة بسيطة خالية من التشتّت تعمل على أي جهاز.',
          'مشاركة بنقرة واحدة لتمرير الدورات المميّزة لأصدقائك.',
        ],
      },
      { p: 'التعلّم حقٌّ للجميع. نتمنّى أن يساعدك Learn Plus Courses في إيجاد مهارتك التالية والاستمتاع برحلة الوصول إليها.' },
    ],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return {}
  return {
    title: CONTENT[locale].title,
    alternates: { canonical: `/${locale}/about`, languages: { en: '/en/about', ar: '/ar/about' } },
  }
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }]
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  return <StaticPage locale={locale} title={CONTENT[locale].title} blocks={CONTENT[locale].blocks} />
}
