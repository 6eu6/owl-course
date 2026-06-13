import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isSupportedLocale, type Locale } from '@/lib/i18n'
import { StaticPage, type Block } from '@/components/static-page'

const CONTENT: Record<Locale, { title: string; blocks: Block[] }> = {
  en: {
    title: 'Privacy Policy',
    blocks: [
      { p: 'Learn Plus Courses respects your privacy. We do not require an account and we do not ask you to submit personal information to browse or start courses.' },
      { h: 'Cookies', p: 'We use a small number of cookies to keep the site working and, optionally, to understand how the site is used so we can improve it. You can change your decision at any time by clearing the cookie for this site in your browser.' },
      { h: 'Information we collect', p: 'We do not collect names, emails or passwords. Standard, aggregated and anonymous usage data may be processed to improve the experience. We do not sell your data.' },
      { h: 'External links', p: 'Starting a course may take you to a third-party learning platform. Once you leave our site, that platform’s own privacy policy applies.' },
      { h: 'Contact', p: 'If you have any questions about this policy, you can reach us through the channels listed on our site.' },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    blocks: [
      { p: 'يحترم Learn Plus Courses خصوصيتك. لا نطلب إنشاء حساب ولا نطلب أي معلومات شخصية لتصفّح الدورات أو البدء بها.' },
      { h: 'ملفات تعريف الارتباط (Cookies)', p: 'نستخدم عددًا قليلًا من ملفات الكوكيز لإبقاء الموقع يعمل، واختياريًا لفهم طريقة استخدام الموقع بهدف تحسينه. يمكنك تغيير اختيارك في أي وقت بحذف الكوكيز الخاصة بهذا الموقع من متصفّحك.' },
      { h: 'المعلومات التي نجمعها', p: 'لا نجمع أسماء أو بريدًا إلكترونيًا أو كلمات مرور. قد تُعالَج بيانات استخدام عامة ومجمّعة ومجهولة الهوية لتحسين التجربة. ولا نبيع بياناتك.' },
      { h: 'الروابط الخارجية', p: 'قد ينقلك بدء الدورة إلى منصّة تعليمية تابعة لطرف ثالث. وبمجرّد مغادرتك موقعنا تُطبَّق سياسة خصوصية تلك المنصّة.' },
      { h: 'التواصل', p: 'إن كان لديك أي استفسار حول هذه السياسة، يمكنك الوصول إلينا عبر القنوات المذكورة في موقعنا.' },
    ],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return {}
  return {
    title: CONTENT[locale].title,
    alternates: { canonical: `/${locale}/privacy`, languages: { en: '/en/privacy', ar: '/ar/privacy' } },
  }
}

export function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }]
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  return <StaticPage locale={locale} title={CONTENT[locale].title} updated blocks={CONTENT[locale].blocks} />
}
