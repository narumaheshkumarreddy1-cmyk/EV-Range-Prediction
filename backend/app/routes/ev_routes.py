from flask import Blueprint, request, jsonify, render_template, session, redirect, url_for
import requests
import pickle
import os

ev = Blueprint('ev', __name__)

# Load the trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'ev_range_model.pkl')
model = None
try:
    with open(MODEL_PATH, 'rb') as file:
        model = pickle.load(file)
except FileNotFoundError:
    print("Warning: Trained model not found. Using fallback rule-based logic.")

# Company-specific EV full range values (km) based on real-world specifications
# Keys must match the lowercase company names from CAR_COMPANIES in auth_routes.py
COMPANY_RANGES = {
    "tesla": 550,      # Average across Model S/X/3/Y
    "chevrolet": 400,  # Bolt EV
    "ford": 480,       # Mustang Mach-E
    "hyundai": 450,    # Ioniq 5
    "kia": 450,        # EV6
    "volkswagen": 450, # ID.4
    "bmw": 480,        # i4
    "audi": 400,       # e-tron
    "mercedes": 400,   # EQC
    "nissan": 350,     # Leaf
    "toyota": 450,     # bZ4X
    "jaguar": 450,     # I-Pace
    "porsche": 450,    # Taycan
    "lucid": 800,      # Air
    "rivian": 480,     # R1T
    "polestar": 450    # Polestar 2
}

@ev.route('/', methods=['GET'])
def home():
    """Landing page - shows landing.html for non-authenticated users, dashboard for logged in users"""
    if 'user_id' in session:
        return redirect(url_for('ev.dashboard_page'))
    return render_template('landing.html')

@ev.route('/predict-page', methods=['GET'])
def predict_page():
    """Prediction page - requires authentication, shows index.html"""
    # Check authentication - require user to be logged in
    if 'user_id' not in session or 'car_company' not in session:
        return redirect('/login')
    return render_template('index.html')

@ev.route('/login', methods=['GET'])
def login_page():
    return render_template('login.html')

@ev.route('/signup', methods=['GET'])
def signup_page():
    return render_template('signup.html')

@ev.route('/profile-page', methods=['GET'])
def profile_page():
    return render_template('profile.html')

@ev.route('/dashboard', methods=['GET'])
def dashboard_page():
    return render_template('dashboard.html')

@ev.route('/settings', methods=['GET'])
def settings_page():
    return render_template('settings.html')

@ev.route('/map', methods=['GET'])
def map_page():
    return render_template('map.html')

@ev.route('/navigation', methods=['GET'])
def navigation_page():
    return render_template('navigation.html')

@ev.route('/route', methods=['GET'])
def route_page():
    """Route page - displays map with route and EV stations"""
    return render_template('route.html')

@ev.route('/stations', methods=['GET'])
def get_stations():
    """Return nearby charging stations using Overpass API.
    Query params: lat (float), lon (float), radius (meters, default 5000)
    """
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', default=5000, type=int)

        if lat is None or lon is None:
            return jsonify({'error': 'lat and lon are required query parameters'}), 400

        overpass_url = 'https://overpass-api.de/api/interpreter'
        query = f"""
        [out:json];
        node(around:{radius},{lat},{lon})[amenity=charging_station];
        out center;
        """

        res = requests.post(overpass_url, data={'data': query}, timeout=10)
        res.raise_for_status()
        data = res.json()

        stations = []
        for elem in data.get('elements', [])[:200]:
            tags = elem.get('tags', {}) or {}
            name = tags.get('name') or 'Charging Station'
            address = ', '.join(filter(None, [
                tags.get('addr:street'),
                tags.get('addr:city'),
                tags.get('addr:state'),
                tags.get('addr:postcode')
            ])) or tags.get('operator') or ''
            station = {
                'id': elem.get('id'),
                'name': name,
                'lat': elem.get('lat') or (elem.get('center') or {}).get('lat'),
                'lng': elem.get('lon') or (elem.get('center') or {}).get('lon'),
                'type': tags.get('charging:method') or tags.get('socket:type') or 'standard',
                'address': address,
                'operator': tags.get('operator'),
                'tags': tags
            }
            stations.append(station)

        return jsonify({'stations': stations}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ev.route('/predict', methods=['POST'])
def predict():
    # Check authentication - require user to be logged in
    if 'user_id' not in session or 'car_company' not in session:
        return redirect('/login')

    print("Predict route called")
    print("Form data:", request.form)

    # Get user details from session (stored during login)
    company = session.get('car_company', '')
    car_model = session.get('car_model', '')  # Renamed to avoid conflict with ML model

    if not company:
        print("No company in session")
        return redirect('/login')

    if company not in COMPANY_RANGES:
        print(f"Unknown company: {company}")
        return redirect('/')

    # Get form data
    battery = float(request.form.get('battery', 0))
    vehicle_load = float(request.form.get('load', 0))
    ac = request.form.get('ac') == 'on'
    traffic = request.form.get('traffic', 'medium')
    speed = float(request.form.get('speed', 60))
    destination = request.form.get('destination', '')
    
    # Use default temperature if not provided (model requires it)
    # Default to 20°C (room temperature - ideal conditions)
    temperature = float(request.form.get('temperature', 20))

    print(f"Parsed data: company={company}, battery={battery}, load={vehicle_load}, ac={ac}, traffic={traffic}, speed={speed}, temperature={temperature}, car_model={car_model}")

    # Get company-specific full range
    full_range = COMPANY_RANGES[company]
    print(f"Company {company} full range: {full_range} km")

    # Convert traffic to numeric (required for ML model)
    traffic_map = {'low': 0, 'medium': 1, 'high': 2}
    traffic_numeric = traffic_map.get(traffic, 1)
    
    # Convert AC to numeric (0 or 1)
    ac_numeric = 1 if ac else 0

    # Use ML model for prediction if available
    predicted_range = None
    
    if model is not None:  # This is the ML model loaded at module level
        try:
            # Prepare features for the model in the correct order
            # Features: battery_percent, speed, ac_usage, traffic_numeric, vehicle_load, temperature
            features = [[battery, speed, ac_numeric, traffic_numeric, vehicle_load, temperature]]
            
            # Get prediction from ML model
            predicted_range = model.predict(features)[0]
            
            # Ensure prediction is within realistic bounds (0 to full_range)
            predicted_range = max(0, min(predicted_range, full_range))
            
            print(f"ML Model predicted range: {predicted_range:.1f} km")
        except Exception as e:
            print(f"Error using ML model: {e}")
            predicted_range = None
    
    # Fallback to simple formula if model prediction failed
    if predicted_range is None:
        # Calculate predicted range based on battery percentage only
        # Formula: predicted_range = (battery / 100) * full_range
        predicted_range = (battery / 100) * full_range
        print(f"Fallback formula predicted range: {predicted_range:.1f} km")

    print(f"Final predicted range: {predicted_range:.1f} km")

    # Store data in session with all required fields
    session['prediction_data'] = {
        "battery": battery,
        "speed": speed,
        "ac": ac,
        "traffic": traffic,
        "vehicle_load": vehicle_load,
        "temperature": temperature,
        "full_range_km": full_range,
        "predicted_range_km": round(predicted_range, 1),
        "destination": destination,
        "company": company,
        "model": car_model,
        "status": "OK"
    }

    return redirect(url_for('ev.results'))

@ev.route('/results', methods=['GET'])
def results():
    prediction_data = session.get('prediction_data')
    if not prediction_data:
        return redirect(url_for('ev.home'))
    return render_template('result.html', prediction=prediction_data)

@ev.route('/api/map-data', methods=['GET'])
def get_map_data():
    """Return map data independently of authentication.
    This endpoint provides charging station data without requiring user login.
    Note: No mock data is returned - only real data from Overpass API.
    If no stations are found, an empty list is returned.
    """
    try:
        lat = request.args.get('lat', default=40.7128, type=float)
        lon = request.args.get('lon', default=-74.0060, type=float)
        radius = request.args.get('radius', default=5000, type=int)

        overpass_url = 'https://overpass-api.de/api/interpreter'
        query = f"""
        [out:json];
        node(around:{radius},{lat},{lon})[amenity=charging_station];
        out center;
        """

        res = requests.post(overpass_url, data={'data': query}, timeout=10)
        res.raise_for_status()
        data = res.json()

        stations = []
        for elem in data.get('elements', [])[:200]:
            tags = elem.get('tags', {}) or {}
            name = tags.get('name') or 'Charging Station'
            address = ', '.join(filter(None, [
                tags.get('addr:street'),
                tags.get('addr:city'),
                tags.get('addr:state'),
                tags.get('addr:postcode')
            ])) or tags.get('operator') or ''
            station = {
                'id': elem.get('id'),
                'name': name,
                'lat': elem.get('lat') or (elem.get('center') or {}).get('lat'),
                'lng': elem.get('lon') or (elem.get('center') or {}).get('lon'),
                'type': tags.get('charging:method') or tags.get('socket:type') or 'standard',
                'address': address,
                'operator': tags.get('operator'),
                'tags': tags
            }
            stations.append(station)

        # Return empty list if no stations found - no mock data
        # Frontend will show "No stations found" message

        return jsonify({
            'stations': stations,
            'center': {'lat': lat, 'lng': lon},
            'radius': radius
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
