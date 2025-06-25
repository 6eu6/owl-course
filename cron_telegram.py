#!/usr/bin/env python3
"""
Cron Script for Telegram Auto-posting
Run this script via cron jobs for automated course posting
Usage: python3 cron_telegram.py
"""

import sys
import os
import logging
from datetime import datetime

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from telegram_continuous_poster import TelegramContinuousPoster
    from telegram_manager import TelegramManager
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/coursegem_telegram.log'),
        logging.StreamHandler()
    ]
)

def main():
    """Main execution function for Telegram posting"""
    try:
        logging.info(f"Starting Telegram poster at {datetime.now()}")
        
        # Initialize poster
        poster = TelegramContinuousPoster()
        
        # Post one course if available
        result = poster.post_next_course()
        
        if result:
            logging.info("Successfully posted course to Telegram")
        else:
            logging.info("No courses available for posting")
            
        logging.info(f"Telegram posting completed at {datetime.now()}")
        
    except Exception as e:
        logging.error(f"Telegram posting failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()