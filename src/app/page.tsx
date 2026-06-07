import { HomeClient } from '@/components/home-client'

// Root home stays English and links to the existing /course/[slug] routes so
// nothing breaks during the i18n rollout. Localized homes live at /en and /ar.
export default function Home() {
  return <HomeClient locale="en" basePath="" />
}
