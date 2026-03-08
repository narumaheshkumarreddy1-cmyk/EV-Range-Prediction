"""
Script to fix None values in updated_at field for existing users
Run this once to populate updated_at with created_at for all existing users
"""

from app import create_app
from app.models.user import db, User
from datetime import datetime

def fix_updated_at():
    app = create_app()
    with app.app_context():
        # Get all users with None updated_at
        users = User.query.filter(User.updated_at == None).all()
        
        if not users:
            print("✅ No users with None updated_at found. Database is clean!")
            return
        
        print(f"Found {len(users)} users with None updated_at")
        
        for user in users:
            user.updated_at = user.created_at or datetime.utcnow()
            print(f"  Updated user: {user.username}")
        
        db.session.commit()
        print(f"\n✅ Successfully updated {len(users)} users with created_at as updated_at")

if __name__ == '__main__':
    fix_updated_at()
