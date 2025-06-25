#!/usr/bin/env python3
"""
Cron Script for Course Scraping
Run this script via cron jobs for automated course discovery
Usage: python3 cron_scraper.py [scraper_type]
"""

import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ultra_fast_scraper import UltraFastScraper
    from final_studybullet_scraper import FinalStudyBulletScraper
    from database_manager import DatabaseManager
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/coursegem_scraper.log'),
        logging.StreamHandler()
    ]
)

def run_udemy_scraper():
    """Run UdemyFreebies scraper"""
    try:
        logging.info("Starting UdemyFreebies scraper...")
        scraper = UltraFastScraper()
        results = scraper.scrape_courses()
        logging.info(f"UdemyFreebies scraper completed. Found {len(results)} courses")
        return results
    except Exception as e:
        logging.error(f"UdemyFreebies scraper failed: {e}")
        return []

def run_studybullet_scraper():
    """Run StudyBullet scraper"""
    try:
        logging.info("Starting StudyBullet scraper...")
        scraper = FinalStudyBulletScraper()
        results = scraper.run()
        logging.info(f"StudyBullet scraper completed")
        return results
    except Exception as e:
        logging.error(f"StudyBullet scraper failed: {e}")
        return []

def cleanup_old_courses():
    """Clean up expired courses"""
    try:
        logging.info("Starting database cleanup...")
        db_manager = DatabaseManager()
        # Add cleanup logic here if needed
        logging.info("Database cleanup completed")
    except Exception as e:
        logging.error(f"Database cleanup failed: {e}")

def main():
    """Main execution function"""
    scraper_type = sys.argv[1] if len(sys.argv) > 1 else 'both'
    
    logging.info(f"Starting cron job at {datetime.now()}")
    logging.info(f"Scraper type: {scraper_type}")
    
    if scraper_type in ['udemy', 'both']:
        run_udemy_scraper()
    
    if scraper_type in ['studybullet', 'both']:
        run_studybullet_scraper()
    
    if scraper_type == 'cleanup':
        cleanup_old_courses()
    
    logging.info(f"Cron job completed at {datetime.now()}")

if __name__ == "__main__":
    main()