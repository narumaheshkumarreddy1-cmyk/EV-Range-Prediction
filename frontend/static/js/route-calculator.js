// Fixed Google Maps route calculator for EV prediction - Syntax & Logic Corrected
// Calculates real route distance (Google > Haversine > fallback), updates battery status

// Haversine formula for distance between lat/lng points (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
    });
}

function updateBatteryStatus(routeKm, predictedKm) {
    const statusEl = document.getElementById('battery-sufficiency');
    const diffEl = document.getElementById('differenceDistance');
    if (!statusEl) {
        console.warn('Battery status element not found');
        return;
    }
    const diff = predictedKm - routeKm;
    if (predictedKm >= routeKm) {
        statusEl.innerHTML = '✔ Battery Sufficient';
        statusEl.style.color = '#28a745';
        if (diffEl) {
            diffEl.textContent = `Remaining: +${diff.toFixed(1)} km`;
            diffEl.style.color = '#28a745';
        }
    } else {
        statusEl.innerHTML = '❌ Battery Insufficient - Consider charging stations';
        statusEl.style.color = '#dc3545';
        if (diffEl) {
            diffEl.textContent = `Need: ${Math.abs(diff).toFixed(1)} km more`;
            diffEl.style.color = '#dc3545';
        }
    }
}

function calculateRoute(start, destination, predictedRange) {
    const routeEl = document.getElementById('routeDistance');
    if (!routeEl) {
        console.warn('Route distance element not found');
        return;
    }

    // Try Google Maps Directions API first
    if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
            origin: start,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
        }, (response, status) => {
            if (status === 'OK' && response.routes[0]) {
                const km = response.routes[0].legs[0].distance.value / 1000;
                routeEl.textContent = `${km.toFixed(1)} km (Google Maps)`;
                updateBatteryStatus(km, predictedRange);
            } else {
                console.warn('Google Directions failed:', status);
                fallbackDistance(start, destination, predictedRange, routeEl);
            }
        });
        return;
    }

    // Fallback to haversine if coords available
    fallbackDistance(start, destination, predictedRange, routeEl);
}

function fallbackDistance(start, destination, predictedRange, routeEl) {
    let km;
    
    // Parse start as coords if possible
    const coordMatch = start.match(/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
        // Dummy destination coords for demo (Ongole to Yerragondapalem ~250km real)
        const destCoords = destination.toLowerCase().includes('yerragondapalem') ? [16.31, 79.28] : [16.5, 80.05];
        const startLat = parseFloat(coordMatch[1]);
        const startLon = parseFloat(coordMatch[2]);
        km = haversineDistance(startLat, startLon, destCoords[0], destCoords[1]);
        km *= 1.3; // Approximate road factor
        routeEl.textContent = `${km.toFixed(1)} km (Haversine est.)`;
    } else {
        // Final hardcoded fallback based on dest name
        km = destination.toLowerCase().includes('yerragondapalem') ? 250 : 150;
        routeEl.textContent = `${km} km (Fallback)`;
    }
    
    updateBatteryStatus(km, predictedRange);
}

// Main initialization
document.addEventListener('DOMContentLoaded', async function() {
    const predictionDataElement = document.getElementById('prediction-data');
    if (!predictionDataElement || !predictionDataElement.dataset.prediction) {
        console.warn('No prediction data found');
        return;
    }

    let prediction;
    try {
        prediction = JSON.parse(predictionDataElement.dataset.prediction);
    } catch (e) {
        console.error('Failed to parse prediction data:', e);
        return;
    }

    const predictedRange = prediction.predicted_range_km || 400;
    const destination = prediction.destination || 'Yerragondapalem';
    
    // Get real-time location or fallback
    let startLocation = '16.50,80.05'; // Ongole fallback coords
    try {
        const position = await getCurrentPosition();
        startLocation = `${position.coords.latitude},${position.coords.longitude}`;
        console.log('Using real location:', startLocation);
    } catch (err) {
        console.warn('Geolocation failed, using fallback:', err.message);
    }
    
    calculateRoute(startLocation, destination, predictedRange);
});

