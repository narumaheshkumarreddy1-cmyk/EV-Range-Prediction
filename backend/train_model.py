import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import pickle
import os

# Step 1: Generate synthetic dataset
def generate_synthetic_data(n_samples=10000):
    np.random.seed(42)

    # Features
    battery_percent = np.random.uniform(10, 100, n_samples)
    speed = np.random.uniform(20, 120, n_samples)  # km/h
    ac_usage = np.random.choice([0, 1], n_samples)  # 0=OFF, 1=ON
    traffic_level = np.random.choice(['low', 'medium', 'high'], n_samples)
    vehicle_load = np.random.uniform(1000, 2000, n_samples)  # kg
    temperature = np.random.uniform(-10, 40, n_samples)  # Celsius

    # Convert categorical to numerical
    traffic_map = {'low': 0, 'medium': 1, 'high': 2}
    traffic_numeric = [traffic_map[t] for t in traffic_level]

    # Realistic range calculation (base range around 400-500 km at 100% battery)
    base_range = 450  # km at 100% battery, ideal conditions

    # Factors affecting range
    battery_factor = battery_percent / 100
    speed_factor = 1 - (speed - 60)**2 / (60**2)  # Optimal around 60 km/h
    ac_factor = 1 - ac_usage * 0.15  # AC reduces range by 15%
    traffic_factor = 1 - np.array(traffic_numeric) * 0.1  # Traffic reduces range
    load_factor = 1 - (vehicle_load - 1500) / 1500 * 0.1  # Extra load reduces range
    temp_factor = 1 - np.abs(temperature - 20) / 50 * 0.2  # Temperature deviation reduces range

    # Calculate realistic range
    estimated_range = (base_range * battery_factor * speed_factor * ac_factor *
                      traffic_factor * load_factor * temp_factor)

    # Add some noise
    noise = np.random.normal(0, 10, n_samples)
    estimated_range = np.maximum(estimated_range + noise, 10)  # Minimum 10 km

    # Create DataFrame
    data = pd.DataFrame({
        'battery_percent': battery_percent,
        'speed': speed,
        'ac_usage': ac_usage,
        'traffic_level': traffic_level,
        'vehicle_load': vehicle_load,
        'temperature': temperature,
        'estimated_range': estimated_range
    })

    return data

# Step 2: Preprocess data
def preprocess_data(data):
    # Convert categorical variables
    traffic_map = {'low': 0, 'medium': 1, 'high': 2}
    data['traffic_numeric'] = data['traffic_level'].map(traffic_map)

    # Select features
    features = ['battery_percent', 'speed', 'ac_usage', 'traffic_numeric', 'vehicle_load', 'temperature']
    X = data[features]
    y = data['estimated_range']

    return X, y

# Step 3: Train model
def train_model(X, y):
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train Random Forest model
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    # Evaluate model
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print(f"Model Performance:")
    print(f"Mean Absolute Error: {mae:.2f} km")
    print(f"R² Score: {r2:.4f}")

    return model, X_test, y_test

# Step 4: Save model
def save_model(model, filename='ev_range_model.pkl'):
    with open(filename, 'wb') as file:
        pickle.dump(model, file)
    print(f"Model saved as {filename}")

# Main execution
if __name__ == "__main__":
    print("Step 1: Generating synthetic dataset...")
    data = generate_synthetic_data(10000)
    print(f"Generated {len(data)} samples")
    print(data.head())

    print("\nStep 2: Preprocessing data...")
    X, y = preprocess_data(data)

    print("\nStep 3: Training model...")
    model, X_test, y_test = train_model(X, y)

    print("\nStep 4: Saving model...")
    save_model(model, 'ev_range_model.pkl')

    print("\nTraining completed successfully!")
