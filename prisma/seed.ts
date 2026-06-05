import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL!

function createClient() {
  if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    return new PrismaClient({ adapter: new PrismaPg(connectionString) })
  }
  return new PrismaClient()
}

const prisma = createClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create categories
  const categories = [
    { name: 'Development', slug: 'development', icon: '💻' },
    { name: 'Business', slug: 'business', icon: '💼' },
    { name: 'IT & Software', slug: 'it-software', icon: '🖥️' },
    { name: 'Design', slug: 'design', icon: '🎨' },
    { name: 'Marketing', slug: 'marketing', icon: '📊' },
    { name: 'Photography', slug: 'photography', icon: '📷' },
    { name: 'Music', slug: 'music', icon: '🎵' },
    { name: 'Personal Development', slug: 'personal-development', icon: '🧠' },
    { name: 'Other', slug: 'other', icon: '📚' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
  }
  console.log(`✅ Created ${categories.length} categories`)

  // Create default settings
  const settings = [
    { id: 'site_name', value: 'OWL Course', group: 'general' },
    { id: 'site_description', value: 'أفضل الدورات المجانية من يوديمي', group: 'general' },
    { id: 'admin_password', value: 'owl2024', group: 'general' },
    { id: 'scraper_interval_minutes', value: '30', group: 'scraper' },
    { id: 'udemyfreebies_enabled', value: 'true', group: 'scraper' },
    { id: 'studybullet_enabled', value: 'true', group: 'scraper' },
    { id: 'auto_telegram_post', value: 'true', group: 'telegram' },
    { id: 'telegram_bot_token', value: '', group: 'telegram' },
    { id: 'courses_per_page', value: '12', group: 'ui' },
    { id: 'show_expired', value: 'false', group: 'ui' },
  ]

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { id: setting.id },
      update: { value: setting.value, group: setting.group },
      create: setting,
    })
  }
  console.log(`✅ Created ${settings.length} settings`)

  // Create sample courses for testing
  const sampleCourses = [
    {
      title: 'The Complete Web Developer Course 2024',
      slug: 'complete-web-developer-2024',
      description: 'Learn HTML, CSS, JavaScript, React, Node.js and more in this comprehensive course.',
      instructor: 'John Doe',
      category: 'Development',
      imageUrl: 'https://img-b.udemycdn.com/course/480x270/842096_864b_4.jpg',
      udemyUrl: 'https://www.udemy.com/course/complete-web-developer/',
      source: 'udemyfreebies',
      rating: 4.7,
      studentsCount: 150000,
      originalPrice: '$89.99',
      language: 'English',
      duration: '42 hours',
      couponCode: 'FREECOUPON1',
      couponUrl: 'https://www.udemy.com/course/complete-web-developer/?couponCode=FREECOUPON1',
      isPublished: true,
    },
    {
      title: 'Machine Learning A-Z: AI, Python & R',
      slug: 'machine-learning-a-z',
      description: 'Build strong Machine Learning models and understand how to apply them.',
      instructor: 'Jane Smith',
      category: 'IT & Software',
      imageUrl: 'https://img-b.udemycdn.com/course/480x270/958176_e828_4.jpg',
      udemyUrl: 'https://www.udemy.com/course/machinelearning/',
      source: 'studybullet',
      rating: 4.6,
      studentsCount: 200000,
      originalPrice: '$99.99',
      language: 'English',
      duration: '40 hours',
      couponCode: 'MLFREE2024',
      couponUrl: 'https://www.udemy.com/course/machinelearning/?couponCode=MLFREE2024',
      isPublished: true,
    },
    {
      title: 'Digital Marketing Masterclass',
      slug: 'digital-marketing-masterclass',
      description: 'Learn strategies to grow your business with digital marketing.',
      instructor: 'Mike Johnson',
      category: 'Marketing',
      imageUrl: 'https://img-b.udemycdn.com/course/480x270/1390810_22a6_4.jpg',
      udemyUrl: 'https://www.udemy.com/course/digital-marketing-masterclass/',
      source: 'udemyfreebies',
      rating: 4.5,
      studentsCount: 85000,
      originalPrice: '$79.99',
      language: 'English',
      duration: '23 hours',
      couponCode: '',
      couponUrl: '',
      isPublished: true,
    },
  ]

  for (const course of sampleCourses) {
    await prisma.course.upsert({
      where: { udemyUrl: course.udemyUrl },
      update: {},
      create: course,
    })
  }
  console.log(`✅ Created ${sampleCourses.length} sample courses`)

  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
