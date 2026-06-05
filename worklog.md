---
Task ID: 1
Agent: Main Agent
Task: Complete analysis and restructuring plan for owl-course project

Work Log:
- Cloned repository from GitHub to /home/z/owl-course-analysis
- Analyzed ALL 19 Python files (app.py, routes.py [5236 lines], models.py, database_system.py, scrapers, telegram bot, schedulers, utilities, etc.)
- Analyzed ALL 21 template files (14 public, 3 admin existing, 4 orphaned)
- Analyzed ALL static files (5 CSS, 3 JS, 1 SVG)
- Analyzed config files (requirements, render.yaml, runtime.txt, README.md)
- Identified critical missing files, broken imports, security issues, code duplication
- Created comprehensive restructuring plan

Stage Summary:
- Project is a Flask-based Udemy/StudyBullet free course scraper with MongoDB + PostgreSQL
- routes.py is a 5236-line god-file with 102+ routes
- 19 of 22 admin templates are MISSING - admin panel is almost entirely broken
- Multiple missing Python imports (telegram_bot_new, telegram_bot, telegram_continuous_poster, telegram_manager, database_manager)
- Hardcoded credentials in multiple files
- Duplicate schedulers running simultaneously
- Massive code duplication across CSS, JS, and Python
- Complete restructuring plan generated
