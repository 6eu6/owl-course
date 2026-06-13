// ============================================
// Category-aware text bank (no AI)
// ============================================
//
// When the scraper cannot pull a course's written sections (description, what
// you'll learn, requirements, who it's for), we compose believable, varied text
// from a large bank of phrases keyed by the course's category. The category is
// already known (categorize() stores it at scrape time), so the generated copy
// stays on-topic — a Python course never reads like a marketing course.
//
// Everything is seeded by the course id, so each course gets stable, distinct
// copy (same approach as course-display.ts): no flicker under caching, and
// neighbouring/recent courses don't read identically — the seeded shuffle draws
// different phrases and orders for each one. No external service is involved.

import { seeded01, seededPick, seededShuffle } from './course-display';

interface CatPool {
  /** Short domain nouns used inside description sentences. */
  topics: string[];
  /** Full "what you'll learn" bullet phrases. */
  skills: string[];
  /** Tools/technologies referenced in requirements. */
  tools: string[];
  /** Audience descriptors for "who this is for". */
  roles: string[];
}

// Shared phrases merged under every category so each pool stays rich even when a
// category only specialises a few fields.
const GENERIC: CatPool = {
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

const CATEGORIES: Record<string, Partial<CatPool>> = {
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

// Description sentence frames. {title}/{topic}/{skill_lc}/{category} are filled
// from the course and the category pool.
const DESC_INTRO = [
  'This hands-on course is your complete, beginner-friendly guide to {title}.',
  'Welcome to {title} — a practical course built to take you from the basics to real confidence.',
  'In {title}, you’ll learn {topic} the practical way: by doing, not just watching.',
  '{title} is a step-by-step course designed around {topic} and real-world results.',
];
const DESC_BODY = [
  'You’ll start with the fundamentals and steadily move into {topic}, building real skills along the way.',
  'Each section is short, focused and followed by hands-on practice so the ideas actually stick.',
  'Instead of dry theory, every lesson is tied to {topic} you can use immediately.',
  'We keep things clear and practical, covering {topic} through guided, real examples.',
];
const DESC_OUTCOME = [
  'By the end, you’ll be ready to {skill_lc} and keep growing on your own.',
  'Finish the course able to {skill_lc} with confidence — and a project to show for it.',
  'You’ll walk away knowing how to {skill_lc} and where to go next.',
  'By the final lesson you’ll {skill_lc} and feel genuinely capable.',
];

function pool(category: string): CatPool {
  const cat = CATEGORIES[category] ?? {};
  return {
    topics: [...(cat.topics ?? []), ...GENERIC.topics],
    skills: [...(cat.skills ?? []), ...GENERIC.skills],
    tools: [...(cat.tools ?? []), ...GENERIC.tools],
    roles: [...(cat.roles ?? []), ...GENERIC.roles],
  };
}

function fill(frame: string, vars: Record<string, string>): string {
  return frame.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Lower-case the first word of a "What you'll learn" phrase for mid-sentence use. */
function toClause(skill: string): string {
  const s = skill.replace(/^[A-Z]/, (c) => c.toLowerCase());
  return s;
}

export interface GeneratedContent {
  description: string;
  whatLearn: string;
  requirements: string;
  whoFor: string;
}

/**
 * Compose stable, category-appropriate copy for a course. Pass the course's id
 * (seed), title and category. Bullet fields are newline-separated to match the
 * BulletList renderer.
 */
export function generateCourseContent(input: { id: string; title: string; category: string }): GeneratedContent {
  const id = input.id || input.title || 'seed';
  const title = (input.title || 'this course').trim();
  const p = pool(input.category || 'Other');

  const topic = seededPick(p.topics, id, 'desc-topic');
  const skillForOutcome = seededPick(p.skills, id, 'desc-skill');
  const description = [
    fill(seededPick(DESC_INTRO, id, 'desc-intro'), { title, topic, category: input.category }),
    fill(seededPick(DESC_BODY, id, 'desc-body'), { topic }),
    fill(seededPick(DESC_OUTCOME, id, 'desc-outcome'), { skill_lc: toClause(skillForOutcome) }),
  ].join(' ');

  const whatLearn = seededShuffle(p.skills, id, 'learn')
    .slice(0, Math.min(5, p.skills.length))
    .join('\n');

  const requirements = seededShuffle(p.tools, id, 'req')
    .slice(0, Math.min(3, p.tools.length))
    .join('\n');

  const whoFor = seededShuffle(p.roles, id, 'who')
    .slice(0, Math.min(3, p.roles.length))
    .join('\n');

  return { description, whatLearn, requirements, whoFor };
}

// Re-exported so callers can vary copy without importing the helper directly.
export { seeded01 };
