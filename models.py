from flask_login import UserMixin
from datetime import datetime
import uuid

class Admin(UserMixin):
    def __init__(self):
        self.id = "admin"
        self.username = "eu6"

    def get_id(self):
        return self.id

class Course:
    def __init__(self, **kwargs):
        self._id = kwargs.get('_id', str(uuid.uuid4()))
        self.title = kwargs.get('title', '')
        self.description = kwargs.get('description', '')
        self.image_url = kwargs.get('image_url', '')
        self.language = kwargs.get('language', 'English')
        self.rating = kwargs.get('rating', 0.0)
        self.original_price = kwargs.get('original_price', '$0')
        self.current_price = kwargs.get('current_price', 'Free')
        self.category = kwargs.get('category', 'Development')
        self.udemy_url = kwargs.get('udemy_url', '')
        self.instructor = kwargs.get('instructor', '')
        self.duration = kwargs.get('duration', '')
        self.level = kwargs.get('level', 'Beginner')
        self.students = kwargs.get('students', 0)
        self.is_published = kwargs.get('is_published', True)
        self.created_at = kwargs.get('created_at', datetime.utcnow())
        self.scraped_at = kwargs.get('scraped_at', datetime.utcnow())
        self.telegram_posted = kwargs.get('telegram_posted', False)

    def to_dict(self):
        return {
            '_id': self._id,
            'title': self.title,
            'description': self.description,
            'image_url': self.image_url,
            'language': self.language,
            'rating': self.rating,
            'original_price': self.original_price,
            'current_price': self.current_price,
            'category': self.category,
            'udemy_url': self.udemy_url,
            'instructor': self.instructor,
            'duration': self.duration,
            'level': self.level,
            'students': self.students,
            'is_published': self.is_published,
            'created_at': self.created_at,
            'scraped_at': self.scraped_at,
            'telegram_posted': self.telegram_posted
        }

    @classmethod
    def from_dict(cls, data):
        return cls(**data)
