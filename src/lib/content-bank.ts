// ============================================
// Category-aware text bank (no AI) — English + Arabic
// ============================================
//
// When the scraper (or the translation) could not capture a course's written
// sections — description, what you'll learn, requirements, who it's for — we
// compose believable, varied copy from a large bank of phrases keyed by the
// course's category. The category is already known (categorize() stores it at
// scrape time), so the generated copy stays on-topic.
//
// Everything is seeded by the course id (same approach as course-display.ts), so
// each course gets stable, distinct copy: no flicker under caching, and
// neighbouring courses don't read identically. There are two parallel banks —
// English and Arabic — so /en and /ar are both enriched in their own language.

import { seeded01, seededPick, seededShuffle } from './course-display';
import type { Locale } from './i18n';

interface CatPool {
  topics: string[];
  skills: string[];
  tools: string[];
  roles: string[];
}

interface Bank {
  generic: CatPool;
  categories: Record<string, Partial<CatPool>>;
  descIntro: string[];
  descBody: string[];
  descOutcome: string[];
  /** Adapt a "what you'll learn" phrase for mid-sentence use in the outcome line. */
  outcomeClause: (skill: string) => string;
}

// ---------------------------------------------------------------------------
// English bank
// ---------------------------------------------------------------------------

const GENERIC_EN: CatPool = {
  topics: [
    'core concepts', 'real-world projects', 'practical workflows', 'industry best practices',
    'hands-on exercises', 'step-by-step techniques', 'time-saving shortcuts', 'professional fundamentals',
  ],
  skills: [
    'Build real projects you can add to your portfolio',
    'Apply what you learn through practical, hands-on exercises',
    'Avoid the common mistakes beginners make',
    'Follow a clear, structured path from basics to advanced',
    'Gain the confidence to keep learning on your own',
    'Understand the why behind every technique, not just the how',
  ],
  tools: ['a computer (Windows, macOS or Linux)', 'a stable internet connection', 'a free account where needed'],
  roles: [
    'Complete beginners who want a structured starting point',
    'Self-learners who prefer practical, project-based teaching',
    'Anyone looking to refresh and modernise their skills',
    'Students who want results without unnecessary theory',
  ],
};

const CATEGORIES_EN: Record<string, Partial<CatPool>> = {
  'Web Development': {
    topics: ['responsive websites', 'modern front-end development', 'REST APIs', 'full-stack apps', 'the DOM', 'component-based UIs'],
    skills: [
      'Build responsive, mobile-first websites from scratch',
      'Write clean HTML, CSS and modern JavaScript',
      'Work with components, state and reusable UI',
      'Connect a front-end to APIs and real data',
      'Deploy your projects live to the web',
    ],
    tools: ['a code editor such as VS Code', 'a modern web browser'],
    roles: ['Aspiring web developers building their first portfolio', 'Designers who want to code their own ideas'],
  },
  'Mobile Development': {
    topics: ['cross-platform apps', 'native mobile UIs', 'app navigation', 'device APIs', 'publishing to app stores'],
    skills: [
      'Build and run real apps on Android and iOS',
      'Design smooth, responsive mobile interfaces',
      'Handle navigation, state and local storage',
      'Connect your app to remote APIs',
      'Prepare and publish an app to the stores',
    ],
    tools: ['a computer able to run the mobile SDK', 'an emulator or a physical device'],
    roles: ['Developers moving into mobile', 'Beginners who want to ship their first app'],
  },
  'Data Science & AI': {
    topics: ['machine learning', 'data analysis', 'model training', 'neural networks', 'real datasets'],
    skills: [
      'Explore, clean and analyse real datasets',
      'Train and evaluate machine-learning models',
      'Understand the maths behind the algorithms intuitively',
      'Turn raw data into clear, actionable insight',
      'Build an end-to-end data project from scratch',
    ],
    tools: ['Python installed (Anaconda recommended)', 'a Jupyter or Colab environment'],
    roles: ['Aspiring data scientists and analysts', 'Developers curious about AI and ML'],
  },
  'Python': {
    topics: ['Python fundamentals', 'automation scripts', 'object-oriented programming', 'data handling', 'real Python projects'],
    skills: [
      'Write clean, readable Python from day one',
      'Automate boring tasks with short scripts',
      'Master functions, classes and modules',
      'Work with files, APIs and libraries',
      'Build practical projects that reinforce each concept',
    ],
    tools: ['Python 3 installed', 'any code editor (VS Code, PyCharm)'],
    roles: ['Absolute beginners to programming', 'Professionals who want to automate their work'],
  },
  'Cloud & DevOps': {
    topics: ['cloud infrastructure', 'containers', 'CI/CD pipelines', 'automation', 'scalable deployments'],
    skills: [
      'Deploy and scale applications in the cloud',
      'Containerise apps with Docker',
      'Automate builds and releases with CI/CD',
      'Manage infrastructure as code',
      'Monitor and troubleshoot real systems',
    ],
    tools: ['a free cloud account (AWS/Azure/GCP)', 'Docker installed locally'],
    roles: ['Developers moving into DevOps', 'Sysadmins modernising their workflow'],
  },
  'Cybersecurity': {
    topics: ['network security', 'ethical hacking', 'vulnerability assessment', 'defensive techniques', 'security tools'],
    skills: [
      'Understand how attacks work — and how to stop them',
      'Use industry-standard security tools safely',
      'Identify and assess common vulnerabilities',
      'Harden systems and networks against threats',
      'Think like an attacker to defend like a pro',
    ],
    tools: ['a computer that can run a virtual lab', 'virtualization software (VirtualBox/VMware)'],
    roles: ['Aspiring security analysts and pentesters', 'IT staff responsible for keeping systems safe'],
  },
  'Design': {
    topics: ['visual design', 'UI/UX principles', 'design systems', 'typography and colour', 'real design projects'],
    skills: [
      'Design clean, modern interfaces users love',
      'Apply layout, colour and typography with intent',
      'Build a portfolio of polished design work',
      'Turn ideas into wireframes and prototypes',
      'Give and act on practical design feedback',
    ],
    tools: ['design software (Figma is free)', 'a mouse or graphics tablet (optional)'],
    roles: ['Aspiring UI/UX and graphic designers', 'Developers who want stronger design skills'],
  },
  'Digital Marketing': {
    topics: ['SEO', 'social-media marketing', 'paid advertising', 'content strategy', 'conversion'],
    skills: [
      'Plan and run campaigns that actually convert',
      'Rank higher with practical, white-hat SEO',
      'Create content that attracts and engages',
      'Run paid ads without wasting budget',
      'Measure results and double down on what works',
    ],
    tools: ['a free account on the platforms covered', 'a spreadsheet tool'],
    roles: ['Business owners marketing their own brand', 'Aspiring marketers building a career'],
  },
  'Business': {
    topics: ['management essentials', 'project planning', 'leadership', 'productivity systems', 'real case studies'],
    skills: [
      'Plan, run and deliver projects with confidence',
      'Lead and motivate a team effectively',
      'Make better decisions with simple frameworks',
      'Communicate clearly with stakeholders',
      'Apply proven methods to real business problems',
    ],
    tools: ['a spreadsheet tool such as Excel or Google Sheets'],
    roles: ['New and aspiring managers', 'Entrepreneurs running their own venture'],
  },
  'Programming & IT': {
    topics: ['programming fundamentals', 'databases', 'algorithms', 'clean code', 'real applications'],
    skills: [
      'Write clean, maintainable code with confidence',
      'Understand core data structures and algorithms',
      'Work with databases and SQL effectively',
      'Debug and solve problems systematically',
      'Build complete applications end to end',
    ],
    tools: ['a code editor or IDE', 'the language runtime installed'],
    roles: ['Beginners starting a tech career', 'Developers strengthening their fundamentals'],
  },
  'Photography & Video': {
    topics: ['composition', 'lighting', 'video editing', 'storytelling', 'post-production'],
    skills: [
      'Capture sharp, well-composed shots in any setting',
      'Master light, exposure and colour',
      'Edit photos and video like a professional',
      'Tell a compelling story with your footage',
      'Build a portfolio that gets you noticed',
    ],
    tools: ['a camera or smartphone', 'free or paid editing software'],
    roles: ['Hobbyists who want professional results', 'Creators growing a channel or brand'],
  },
  'Personal Development': {
    topics: ['productivity', 'communication', 'mindset', 'habits', 'real-life application'],
    skills: [
      'Build habits that actually stick',
      'Communicate with clarity and confidence',
      'Manage your time and focus far better',
      'Set goals and follow through on them',
      'Apply each lesson directly to your daily life',
    ],
    tools: ['a notebook or notes app', 'an open mind and a little practice time'],
    roles: ['Anyone wanting to grow personally or professionally', 'Busy people who need practical, no-fluff methods'],
  },
  'Music': {
    topics: ['music theory', 'performance', 'music production', 'ear training', 'real songs'],
    skills: [
      'Play and practice with the right technique from the start',
      'Understand the theory behind the music you love',
      'Produce and arrange your own tracks',
      'Train your ear to recognise notes and chords',
      'Learn through real songs, not dry drills',
    ],
    tools: ['your instrument or production software', 'headphones or speakers'],
    roles: ['Complete beginners picking up music', 'Self-taught musicians filling in the gaps'],
  },
  'Languages': {
    topics: ['vocabulary', 'grammar essentials', 'real conversations', 'pronunciation', 'practical phrases'],
    skills: [
      'Hold everyday conversations with confidence',
      'Build vocabulary you will actually use',
      'Understand grammar without the headache',
      'Improve your pronunciation and listening',
      'Practice with realistic, practical examples',
    ],
    tools: ['a notebook for new words', 'a few minutes of daily practice'],
    roles: ['Beginners starting a new language', 'Travellers and professionals who need practical fluency'],
  },
  'Finance & Accounting': {
    topics: ['investing', 'financial analysis', 'accounting basics', 'money management', 'real examples'],
    skills: [
      'Understand how money, markets and risk really work',
      'Read and interpret financial statements',
      'Build a simple, sensible investing approach',
      'Manage budgets and cash flow with confidence',
      'Apply each concept to real-world examples',
    ],
    tools: ['a spreadsheet tool such as Excel or Google Sheets'],
    roles: ['Beginners taking control of their finances', 'Professionals adding finance skills to their toolkit'],
  },
  'Health & Fitness': {
    topics: ['training fundamentals', 'nutrition', 'wellbeing', 'sustainable habits', 'real routines'],
    skills: [
      'Train safely and effectively for your goals',
      'Understand nutrition without fad diets',
      'Build a routine you can actually keep',
      'Improve energy, strength and wellbeing',
      'Apply simple, science-based principles',
    ],
    tools: ['comfortable space to move', 'minimal or no equipment to start'],
    roles: ['Beginners starting a healthier lifestyle', 'Anyone wanting practical, sustainable results'],
  },
};

const EN: Bank = {
  generic: GENERIC_EN,
  categories: CATEGORIES_EN,
  descIntro: [
    'This hands-on course is your complete, beginner-friendly guide to {title}.',
    'Welcome to {title} — a practical course built to take you from the basics to real confidence.',
    'In {title}, you’ll learn {topic} the practical way: by doing, not just watching.',
    '{title} is a step-by-step course designed around {topic} and real-world results.',
  ],
  descBody: [
    'You’ll start with the fundamentals and steadily move into {topic}, building real skills along the way.',
    'Each section is short, focused and followed by hands-on practice so the ideas actually stick.',
    'Instead of dry theory, every lesson is tied to {topic} you can use immediately.',
    'We keep things clear and practical, covering {topic} through guided, real examples.',
  ],
  descOutcome: [
    'By the end, you’ll be ready to {skill} and keep growing on your own.',
    'Finish the course able to {skill} with confidence — and a project to show for it.',
    'You’ll walk away knowing how to {skill} and where to go next.',
    'By the final lesson you’ll be able to {skill} and feel genuinely capable.',
  ],
  outcomeClause: (skill) => skill.replace(/^[A-Z]/, (c) => c.toLowerCase()),
};

// ---------------------------------------------------------------------------
// Arabic bank (mirrors the English structure, in Arabic)
// ---------------------------------------------------------------------------

const GENERIC_AR: CatPool = {
  topics: [
    'المفاهيم الأساسية', 'مشاريع واقعية', 'سير عمل عملي', 'أفضل ممارسات المجال',
    'تمارين تطبيقية', 'تقنيات خطوة بخطوة', 'اختصارات توفّر الوقت', 'الأساسيات الاحترافية',
  ],
  skills: [
    'بناء مشاريع حقيقية تضيفها إلى معرض أعمالك',
    'تطبيق ما تتعلّمه عبر تمارين عملية مباشرة',
    'تجنّب الأخطاء الشائعة التي يقع فيها المبتدئون',
    'اتّباع مسار واضح ومنظّم من الأساسيات إلى المستوى المتقدّم',
    'اكتساب الثقة لمواصلة التعلّم بنفسك',
    'فهم سبب كل تقنية لا طريقة تنفيذها فقط',
  ],
  tools: [
    'جهاز حاسوب (ويندوز أو ماك أو لينكس)',
    'اتصال إنترنت مستقر',
    'حساب مجاني عند الحاجة',
    'رغبة في التطبيق وبعض الوقت للتمرّن',
  ],
  roles: [
    'المبتدئون الراغبون في بداية منظّمة',
    'المتعلّمون ذاتيًا الذين يفضّلون التعليم العملي القائم على المشاريع',
    'كل من يريد تحديث مهاراته ومواكبة الجديد',
    'الطلاب الذين يريدون نتائج دون نظريات زائدة',
    'الموظفون الراغبون في تطوير مهاراتهم عمليًا',
  ],
};

const CATEGORIES_AR: Record<string, Partial<CatPool>> = {
  'Web Development': {
    topics: ['مواقع متجاوبة', 'تطوير الواجهات الحديثة', 'واجهات برمجية REST', 'تطبيقات متكاملة', 'المكوّنات وإدارة الحالة'],
    skills: [
      'بناء مواقع متجاوبة من الصفر',
      'كتابة HTML وCSS وجافاسكربت حديثة بأسلوب نظيف',
      'العمل مع المكوّنات والحالة وإعادة الاستخدام',
      'ربط الواجهة بواجهات برمجية وبيانات حقيقية',
      'نشر مشاريعك مباشرة على الإنترنت',
    ],
    roles: ['الطامحون لاحتراف تطوير الويب وبناء أول معرض أعمال', 'المصمّمون الراغبون في برمجة أفكارهم بأنفسهم'],
  },
  'Mobile Development': {
    topics: ['تطبيقات متعددة المنصّات', 'واجهات الجوال', 'التنقّل داخل التطبيق', 'واجهات الأجهزة', 'النشر على المتاجر'],
    skills: [
      'بناء تطبيقات تعمل على أندرويد و iOS',
      'تصميم واجهات جوال سلسة ومتجاوبة',
      'إدارة التنقّل والحالة والتخزين المحلي',
      'ربط التطبيق بواجهات برمجية بعيدة',
      'تجهيز التطبيق ونشره على المتاجر',
    ],
    roles: ['المطوّرون المتّجهون إلى تطوير الجوال', 'المبتدئون الراغبون في إطلاق أول تطبيق لهم'],
  },
  'Data Science & AI': {
    topics: ['تعلّم الآلة', 'تحليل البيانات', 'تدريب النماذج', 'الشبكات العصبية', 'بيانات حقيقية'],
    skills: [
      'استكشاف وتنظيف وتحليل بيانات حقيقية',
      'تدريب نماذج تعلّم الآلة وتقييمها',
      'فهم الرياضيات وراء الخوارزميات بحدس',
      'تحويل البيانات الخام إلى رؤى واضحة وقابلة للتطبيق',
      'بناء مشروع بيانات متكامل من الصفر',
    ],
    roles: ['الطامحون ليصبحوا علماء ومحلّلي بيانات', 'المطوّرون المهتمّون بالذكاء الاصطناعي وتعلّم الآلة'],
  },
  'Python': {
    topics: ['أساسيات بايثون', 'سكربتات الأتمتة', 'البرمجة كائنية التوجّه', 'معالجة البيانات', 'مشاريع بايثون عملية'],
    skills: [
      'كتابة بايثون نظيفة وسهلة القراءة من اليوم الأول',
      'أتمتة المهام المتكرّرة بسكربتات قصيرة',
      'إتقان الدوال والأصناف والوحدات',
      'العمل مع الملفات وواجهات API والمكتبات',
      'بناء مشاريع عملية تعزّز كل مفهوم',
    ],
    roles: ['المبتدئون تمامًا في البرمجة', 'المحترفون الراغبون في أتمتة أعمالهم'],
  },
  'Cloud & DevOps': {
    topics: ['البنية السحابية', 'الحاويات', 'خطوط CI/CD', 'الأتمتة', 'عمليات نشر قابلة للتوسّع'],
    skills: [
      'نشر التطبيقات وتوسيعها في السحابة',
      'تعبئة التطبيقات باستخدام Docker',
      'أتمتة البناء والإصدار عبر CI/CD',
      'إدارة البنية التحتية ككود',
      'مراقبة الأنظمة الحقيقية وحلّ مشكلاتها',
    ],
    roles: ['المطوّرون المتّجهون إلى DevOps', 'مديرو الأنظمة الراغبون في تحديث أسلوب عملهم'],
  },
  'Cybersecurity': {
    topics: ['أمن الشبكات', 'الاختراق الأخلاقي', 'تقييم الثغرات', 'تقنيات الدفاع', 'أدوات الأمن'],
    skills: [
      'فهم كيفية حدوث الهجمات وكيفية إيقافها',
      'استخدام أدوات الأمن المعيارية بأمان',
      'تحديد الثغرات الشائعة وتقييمها',
      'تحصين الأنظمة والشبكات ضد التهديدات',
      'التفكير كمهاجم لتدافع كالمحترفين',
    ],
    roles: ['الطامحون ليصبحوا محلّلي أمن واختبار اختراق', 'موظفو التقنية المسؤولون عن أمان الأنظمة'],
  },
  'Design': {
    topics: ['التصميم البصري', 'مبادئ UI/UX', 'أنظمة التصميم', 'الخطوط والألوان', 'مشاريع تصميم حقيقية'],
    skills: [
      'تصميم واجهات حديثة ونظيفة يحبّها المستخدمون',
      'تطبيق التخطيط واللون والخط بوعي',
      'بناء معرض أعمال تصميمي احترافي',
      'تحويل الأفكار إلى نماذج أولية',
      'تقديم ملاحظات تصميم عملية والاستفادة منها',
    ],
    roles: ['الطامحون لاحتراف تصميم UI/UX والجرافيك', 'المطوّرون الراغبون في مهارات تصميم أقوى'],
  },
  'Digital Marketing': {
    topics: ['تحسين محركات البحث', 'التسويق عبر السوشيال ميديا', 'الإعلانات المدفوعة', 'استراتيجية المحتوى', 'التحويل'],
    skills: [
      'تخطيط وتنفيذ حملات تسويقية تحقّق نتائج فعلية',
      'الظهور أعلى في نتائج البحث بطرق سليمة',
      'إنشاء محتوى يجذب الجمهور ويتفاعل معه',
      'إدارة الإعلانات المدفوعة دون هدر الميزانية',
      'قياس النتائج ومضاعفة ما ينجح',
    ],
    roles: ['أصحاب الأعمال الذين يسوّقون لعلامتهم بأنفسهم', 'الطامحون لبناء مسار مهني في التسويق'],
  },
  'Business': {
    topics: ['أساسيات الإدارة', 'تخطيط المشاريع', 'القيادة', 'أنظمة الإنتاجية', 'دراسات حالة حقيقية'],
    skills: [
      'تخطيط المشاريع وتنفيذها وتسليمها بثقة',
      'قيادة الفريق وتحفيزه بفعالية',
      'اتخاذ قرارات أفضل بأطر عمل بسيطة',
      'التواصل بوضوح مع أصحاب المصلحة',
      'تطبيق مناهج مجرّبة على مشكلات أعمال واقعية',
    ],
    roles: ['المديرون الجدد والطامحون للإدارة', 'روّاد الأعمال الذين يديرون مشاريعهم الخاصة'],
  },
  'Programming & IT': {
    topics: ['أساسيات البرمجة', 'قواعد البيانات', 'الخوارزميات', 'الكود النظيف', 'تطبيقات حقيقية'],
    skills: [
      'كتابة كود نظيف وقابل للصيانة بثقة',
      'فهم هياكل البيانات والخوارزميات الأساسية',
      'العمل مع قواعد البيانات وSQL بكفاءة',
      'تنقيح الأخطاء وحلّ المشكلات بمنهجية',
      'بناء تطبيقات كاملة من البداية إلى النهاية',
    ],
    roles: ['المبتدئون في بداية مسار تقني', 'المطوّرون الراغبون في تقوية أساسياتهم'],
  },
  'Photography & Video': {
    topics: ['التكوين', 'الإضاءة', 'تحرير الفيديو', 'السرد القصصي', 'المعالجة اللاحقة'],
    skills: [
      'التقاط صور حادّة ومتقنة التكوين في أي إضاءة',
      'إتقان الضوء والتعريض واللون',
      'تحرير الصور والفيديو باحترافية',
      'رواية قصة مؤثّرة بلقطاتك',
      'بناء معرض أعمال يلفت الأنظار',
    ],
    roles: ['الهواة الراغبون في نتائج احترافية', 'صنّاع المحتوى الذين ينمّون قناة أو علامة'],
  },
  'Personal Development': {
    topics: ['الإنتاجية', 'التواصل', 'العقلية', 'العادات', 'التطبيق في الحياة'],
    skills: [
      'بناء عادات تدوم فعلًا',
      'التواصل بوضوح وثقة',
      'إدارة وقتك وتركيزك بشكل أفضل',
      'وضع أهداف والالتزام بتحقيقها',
      'تطبيق كل درس مباشرة في حياتك اليومية',
    ],
    roles: ['كل من يريد التطوّر شخصيًا أو مهنيًا', 'المشغولون الباحثون عن طرق عملية مباشرة'],
  },
  'Music': {
    topics: ['نظرية الموسيقى', 'الأداء', 'إنتاج الموسيقى', 'تدريب الأذن', 'أغانٍ حقيقية'],
    skills: [
      'العزف والتمرّن بالتقنية الصحيحة من البداية',
      'فهم النظرية خلف الموسيقى التي تحبّها',
      'إنتاج وتوزيع مقطوعاتك الخاصة',
      'تدريب أذنك على تمييز النغمات والأوتار',
      'التعلّم عبر أغانٍ حقيقية لا تمارين جافة',
    ],
    roles: ['المبتدئون تمامًا في الموسيقى', 'العازفون العصاميّون الراغبون في سدّ الثغرات'],
  },
  'Languages': {
    topics: ['المفردات', 'أساسيات القواعد', 'محادثات حقيقية', 'النطق', 'عبارات عملية'],
    skills: [
      'إجراء محادثات يومية بثقة',
      'بناء مفردات تستخدمها فعلًا',
      'فهم القواعد دون تعقيد',
      'تحسين نطقك واستماعك',
      'التدرّب على أمثلة واقعية عملية',
    ],
    roles: ['المبتدئون في تعلّم لغة جديدة', 'المسافرون والمحترفون الباحثون عن طلاقة عملية'],
  },
  'Finance & Accounting': {
    topics: ['الاستثمار', 'التحليل المالي', 'أساسيات المحاسبة', 'إدارة المال', 'أمثلة واقعية'],
    skills: [
      'فهم كيف يعمل المال والأسواق والمخاطر فعلًا',
      'قراءة القوائم المالية وتفسيرها',
      'بناء نهج استثماري بسيط ومتزن',
      'إدارة الميزانيات والتدفّق النقدي بثقة',
      'تطبيق كل مفهوم على أمثلة واقعية',
    ],
    roles: ['المبتدئون الراغبون في التحكّم بأموالهم', 'المحترفون الراغبون في إضافة مهارات مالية'],
  },
  'Health & Fitness': {
    topics: ['أساسيات التمرين', 'التغذية', 'العافية', 'عادات مستدامة', 'برامج حقيقية'],
    skills: [
      'التمرّن بأمان وفعالية نحو أهدافك',
      'فهم التغذية دون حميات زائفة',
      'بناء روتين يمكنك الالتزام به',
      'تحسين الطاقة والقوة والعافية',
      'تطبيق مبادئ بسيطة قائمة على العلم',
    ],
    roles: ['المبتدئون في نمط حياة أكثر صحة', 'كل من يريد نتائج عملية ومستدامة'],
  },
};

const AR: Bank = {
  generic: GENERIC_AR,
  categories: CATEGORIES_AR,
  descIntro: [
    'هذه الدورة العملية دليلك الكامل والمبسّط إلى {title}.',
    'مرحبًا بك في {title} — دورة عملية تأخذك من الأساسيات إلى الإتقان خطوة بخطوة.',
    'في {title} ستتعلّم {topic} بالطريقة العملية: بالتطبيق لا بالمشاهدة فقط.',
    '{title} دورة متدرّجة مصمّمة حول {topic} ونتائج واقعية.',
  ],
  descBody: [
    'تبدأ من الأساسيات ثم تنتقل تدريجيًا إلى {topic}، مع بناء مهارات حقيقية في كل خطوة.',
    'كل قسم قصير ومركّز ويتبعه تطبيق عملي لتترسّخ الأفكار فعلًا.',
    'بدل النظريات الجافة، كل درس مرتبط بـ{topic} يمكنك استخدامه فورًا.',
    'نبقي الأمور واضحة وعملية، ونغطّي {topic} عبر أمثلة واقعية موجّهة.',
  ],
  descOutcome: [
    'في النهاية ستكون قادرًا على {skill} ومواصلة التعلّم بنفسك.',
    'تُنهي الدورة وأنت قادر على {skill} بثقة، ومعك مشروع تعرضه.',
    'ستخرج وأنت تعرف كيف يمكنك {skill} وإلى أين تتجه بعدها.',
    'مع الدرس الأخير ستصبح قادرًا على {skill} وتشعر بكفاءة حقيقية.',
  ],
  outcomeClause: (skill) => skill,
};

// ---------------------------------------------------------------------------

const BANKS: Record<Locale, Bank> = { en: EN, ar: AR };

function pool(bank: Bank, category: string): CatPool {
  const cat = bank.categories[category] ?? {};
  return {
    topics: [...(cat.topics ?? []), ...bank.generic.topics],
    skills: [...(cat.skills ?? []), ...bank.generic.skills],
    tools: [...(cat.tools ?? []), ...bank.generic.tools],
    roles: [...(cat.roles ?? []), ...bank.generic.roles],
  };
}

function fill(frame: string, vars: Record<string, string>): string {
  return frame.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export interface GeneratedContent {
  description: string;
  whatLearn: string;
  requirements: string;
  whoFor: string;
}

/**
 * Compose stable, category-appropriate copy for a course in the given locale.
 * Bullet fields are newline-separated to match the BulletList renderer.
 */
export function generateCourseContent(
  input: { id: string; title: string; category: string },
  locale: Locale = 'en',
): GeneratedContent {
  const bank = BANKS[locale] ?? EN;
  const id = input.id || input.title || 'seed';
  const title = (input.title || '').trim() || (locale === 'ar' ? 'هذه الدورة' : 'this course');
  const p = pool(bank, input.category || 'Other');

  const topic = seededPick(p.topics, id, 'desc-topic');
  const outcomeSkill = bank.outcomeClause(seededPick(p.skills, id, 'desc-skill'));
  const description = [
    fill(seededPick(bank.descIntro, id, 'desc-intro'), { title, topic }),
    fill(seededPick(bank.descBody, id, 'desc-body'), { topic }),
    fill(seededPick(bank.descOutcome, id, 'desc-outcome'), { skill: outcomeSkill }),
  ].join(' ');

  const whatLearn = seededShuffle(p.skills, id, 'learn').slice(0, Math.min(5, p.skills.length)).join('\n');
  const requirements = seededShuffle(p.tools, id, 'req').slice(0, Math.min(3, p.tools.length)).join('\n');
  const whoFor = seededShuffle(p.roles, id, 'who').slice(0, Math.min(3, p.roles.length)).join('\n');

  return { description, whatLearn, requirements, whoFor };
}

// Re-exported so callers can vary copy without importing the helper directly.
export { seeded01 };
