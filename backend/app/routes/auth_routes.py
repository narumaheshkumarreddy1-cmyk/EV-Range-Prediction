from flask import Blueprint, request, jsonify, session
from ..models.user import User, db
import os
from werkzeug.utils import secure_filename
from datetime import datetime

auth = Blueprint('auth', __name__)

UPLOAD_FOLDER = 'frontend/static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Car company database
CAR_COMPANIES = {
    'tesla': ['Model S', 'Model 3', 'Model X', 'Model Y'],
    'chevrolet': ['Bolt EV', 'Bolt EUV', 'Equinox EV'],
    'ford': ['Mustang Mach-E', 'F-150 Lightning'],
    'hyundai': ['Ioniq 5', 'Ioniq 6', 'Kona Electric'],
    'kia': ['EV6', 'Niro EV', 'Soul EV'],
    'volkswagen': ['ID.4', 'ID.5', 'ID. Buzz'],
    'bmw': ['iX', 'i4', 'i3'],
    'audi': ['e-tron GT', 'Q4 e-tron'],
    'mercedes': ['EQE', 'EQS', 'EQC'],
    'nissan': ['Leaf', 'Ariya'],
    'toyota': ['bZ4X', 'RAV4 Prime'],
    'jaguar': ['I-PACE'],
    'porsche': ['Taycan'],
    'lucid': ['Air'],
    'rivian': ['R1T', 'R1S'],
    'polestar': ['3', '2', '1']
}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@auth.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        
        # Validate input
        if not data.get('username') or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email'],
            phone=data.get('phone'),
            location=data.get('location'),
            car_company=data.get('car_company'),
            car_model=data.get('car_model')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Store user ID in session
        session['user_id'] = user.id
        session['username'] = user.username
        session['user'] = user.username
        session['car_company'] = user.car_company
        session['car_model'] = user.car_model
        
        return jsonify({
            'message': 'Signup successful',
            'user': user.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password are required'}), 400
        
        user = User.query.filter_by(username=data['username']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Store user ID and car details in session
        session['user_id'] = user.id
        session['username'] = user.username
        session['user'] = user.username
        session['car_company'] = user.car_company
        session['car_model'] = user.car_model
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth.route('/logout', methods=['POST'])
def logout():
    try:
        session.clear()
        return jsonify({'message': 'Logout successful'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth.route('/profile', methods=['GET'])
def get_profile():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        user = User.query.get(session['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user.to_dict()), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth.route('/profile', methods=['PUT'])
def update_profile():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.get_json()
        user = User.query.get(session['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if 'car_company' in data:
            user.car_company = data['car_company']
        if 'car_model' in data:
            user.car_model = data['car_model']
        if 'email' in data:
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        if 'location' in data:
            user.location = data['location']
        if 'bio' in data:
            user.bio = data['bio']
        if 'photo_url' in data:
            user.photo_url = data['photo_url']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth.route('/change-password', methods=['POST'])
def change_password():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        data = request.get_json()
        user = User.query.get(session['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password
        if not user.check_password(data.get('current_password', '')):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Check if new passwords match
        if data.get('new_password') != data.get('confirm_password'):
            return jsonify({'error': 'New passwords do not match'}), 400
        
        # Set new password
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth.route('/upload-photo', methods=['POST'])
def upload_photo():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only image files are allowed'}), 400
        
        # Create upload folder if it doesn't exist
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Generate unique filename
        filename = secure_filename(f"{session['user_id']}_{datetime.utcnow().timestamp()}_{file.filename}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save file
        file.save(filepath)
        
        # Update user photo URL
        user = User.query.get(session['user_id'])
        photo_url = f'/static/uploads/{filename}'
        user.photo_url = photo_url
        db.session.commit()
        
        return jsonify({
            'message': 'Photo uploaded successfully',
            'photo_url': photo_url
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth.route('/check-auth', methods=['GET'])
def check_auth():
    try:
        if 'user_id' in session:
            user = User.query.get(session['user_id'])
            if user:
                return jsonify({
                    'authenticated': True,
                    'user': user.to_dict()
                }), 200
        
        return jsonify({'authenticated': False}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth.route('/car-companies', methods=['GET'])
def get_car_companies():
    return jsonify({'car_companies': list(CAR_COMPANIES.keys())}), 200

@auth.route('/car-models/<company>', methods=['GET'])
def get_car_models(company):
    company = company.lower()
    if company in CAR_COMPANIES:
        return jsonify({'car_models': CAR_COMPANIES[company]}), 200
    return jsonify({'error': 'Company not found'}), 404
