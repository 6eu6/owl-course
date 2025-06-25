# OWL COURSE - Free Course Discovery Platform

🦉 **OWL COURSE** is an advanced educational platform that aggregates and publishes free courses from various sources, featuring intelligent web scraping, automated Telegram publishing, and comprehensive admin dashboard.

## 🚀 Features

### Core Functionality
- **Dual Scraping System**: UdemyFreebies + StudyBullet integration
- **Smart Course Management**: 20+ admin pages with bulk operations
- **Telegram Automation**: Multi-channel posting with priority system
- **Hybrid Database**: PostgreSQL + MongoDB for optimal performance
- **Smart Monetization**: ShrinkMe integration with user-friendly approach
- **Responsive Design**: Mobile-first with OWL COURSE natural theme

### Advanced Systems
- **Auto Categorization**: AI-powered course classification
- **Performance Monitoring**: Real-time system health tracking
- **Content Generation**: Intelligent course descriptions and metadata
- **SEO Optimization**: Dynamic URLs, structured data, Google Analytics
- **Security**: Protected admin panel with session management

## 🛠️ Technology Stack

- **Backend**: Python 3.11+ with Flask 3.1.1
- **Databases**: PostgreSQL (settings/fast data) + MongoDB Atlas (large datasets)
- **Web Scraping**: Beautiful Soup, Trafilatura, Requests
- **Scheduling**: APScheduler with advanced automation
- **External APIs**: Telegram Bot, OpenAI, ShrinkMe
- **Frontend**: Bootstrap 5.3 with custom responsive CSS

## 📦 Quick Deployment on Render.com

### 1. Fork & Deploy
```bash
# Fork this repository to your GitHub account
# Connect to Render.com and create new Web Service
# Use these settings:
```

### 2. Environment Variables (Required)
```env
# Database
DATABASE_URL=postgresql://...          # Render PostgreSQL
MONGODB_URI=mongodb+srv://...          # MongoDB Atlas

# Security
SESSION_SECRET=your_random_secret_here
ADMIN_PASSWORD=your_admin_password

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=@your_channel

# External Services (Optional)
SHRINKME_API_KEY=your_shrinkme_key
OPENAI_API_KEY=your_openai_key
```

### 3. Automatic Configuration
- **Build Command**: `pip install -r requirements_production.txt`
- **Start Command**: `gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 300 main:app`
- **Health Check**: `/health`

## 🔧 Local Development

### Prerequisites
- Python 3.11+
- PostgreSQL
- MongoDB Atlas account

### Installation
```bash
# Clone repository
git clone https://github.com/6eu6/owl-course.git
cd owl-course

# Install dependencies
pip install -r requirements_production.txt

# Configure environment
cp .env.example .env
# Edit .env with your configurations

# Run application
python main.py
```

### Access Points
- **Website**: http://localhost:5000
- **Admin Panel**: http://localhost:5000/eu6a-admin
- **Health Check**: http://localhost:5000/health

## 📊 Admin Dashboard

### Main Features
- **Dashboard**: Real-time statistics and quick actions
- **Course Management**: 1000+ courses with advanced filtering
- **Scrapers Control**: UdemyFreebies (hourly) + StudyBullet (daily)
- **Telegram Manager**: Multi-channel automation with smart posting
- **Performance Monitor**: System health and database metrics
- **Settings Manager**: Site configuration and integrations

### Course Operations
- Bulk edit/delete/hide operations
- Auto-categorization with 8+ categories
- SEO slug generation
- Content quality reporting system
- Image optimization and validation

## 🤖 Automation Systems

### Intelligent Scraping
- **UdemyFreebies**: Every 3 hours, temporary coupon courses
- **StudyBullet**: Weekly, permanent free courses
- **Smart Filtering**: Duplicate detection, URL validation
- **Image Enhancement**: Auto-upgrade to 750x422 resolution

### Telegram Publishing
- **Priority System**: UdemyFreebies first, then StudyBullet
- **Multi-Channel**: Unlimited channels support
- **Smart Timing**: 60 courses/hour with rest periods
- **Template System**: Customizable message formats
- **Recycling**: Permanent courses auto-recycled

## 🎨 Design System

### OWL COURSE Theme
- **Primary Color**: Natural Brown (#8B4513)
- **Background**: Clean White with subtle gradients
- **Typography**: Responsive with Arabic RTL support
- **Components**: Modern cards, animated hero, floating counters
- **Mobile-First**: Perfect display on all devices

### User Experience
- **Live Statistics**: Real-time course counters
- **Smart Search**: Instant results with category filtering
- **Social Integration**: WhatsApp, Telegram, Twitter sharing
- **Accessibility**: Screen reader friendly, keyboard navigation

## 📈 Performance Optimizations

### Database Architecture
- **Hybrid System**: PostgreSQL (0.12s) + MongoDB (1.02s)
- **Connection Pooling**: Optimized for concurrent requests
- **Lazy Loading**: On-demand collection initialization
- **Cache Strategy**: Smart caching for frequently accessed data

### Production Ready
- **Gunicorn**: Multi-worker WSGI server
- **Error Handling**: Comprehensive error pages and logging
- **Security**: Session management, input validation, CSRF protection
- **Monitoring**: Health checks, performance metrics, alerts

## 🔐 Security Features

- **Admin Protection**: Secure `/eu6a-admin` routes
- **Session Management**: Cryptographically secure sessions
- **Input Validation**: Sanitized user input throughout
- **Environment Security**: Sensitive data in environment variables
- **Rate Limiting**: Built-in protection against abuse

## 📞 Support & Documentation

### Documentation Files
- `ADMIN_DASHBOARD_COMPLETE_GUIDE.md` - Complete admin reference
- `RENDER_DEPLOYMENT_ANALYSIS_REPORT.md` - Deployment troubleshooting
- `OWL_COURSE_PROJECT_DESCRIPTION.md` - Detailed project overview

### Support Channels
- **Issues**: GitHub Issues for bug reports
- **Features**: GitHub Discussions for feature requests
- **Documentation**: In-repo markdown files

## 🌟 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Project Stats

- **20+ Admin Pages**: Complete management interface
- **80+ API Endpoints**: RESTful architecture
- **1000+ Courses**: Real course database
- **Multi-Language**: English with Google Translate support
- **Production Ready**: Deployed on Render.com with 99.9% uptime

---

**Built with ❤️ by the OWL COURSE Team**

*Transform education through intelligent course discovery and automated distribution*