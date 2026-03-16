// Fixed backup of original route-calculator.js - Resolves TypeScript syntax errors
// Preserves original Google Maps preference + demo fallback logic
// Adds haversine for better fallback accuracy

// Haversine formula for straight-line distance (km)
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
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 5000,
            enableHighAccuracy: true 
        });
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
            diffEl.textContent = `Remaining: ${diff.toFixed(1)} km`;
            diffEl.style.color = '#28a745';
        }
    } else {
        statusEl.innerHTML = '❌ Battery Insufficient';
        statusEl.style.color = '#dc3545';
        if (diffEl) {
            diffEl.textContent = `Need: ${Math.abs(diff).toFixed(1)} km more`;
            diffEl.style.color = '#dc3545';
        }
    }
}

function fallbackDistance(start, destination, predictedRange, routeEl) {
    let km;
    
    // Parse start as coords if possible
    const coordMatch = start.match(/(-?\\d+(?:\\.\\d+)?),(-?\\d+(?:\\.\\d+)?)/);
    if (coordMatch) {
        const startLat = parseFloat(coordMatch[1]);
        const startLon = parseFloat(coordMatch[2]);
        // Demo dest coords: Yerragondapalem ~ Ongole
        const destCoords = destination.toLowerCase().includes('yerragondapalem') ? [16.31, 79.28] : [16.5, 80.05];
        km = haversineDistance(startLat, startLon, destCoords[0], destCoords[1]);
        km *= 1.3; // Road factor
        routeEl.textContent = `${km.toFixed(1)} km (Haversine est.)`;
    } else {
        // Original demo fallback
        km = destination.toLowerCase().includes('yerragondapalem') ? 850 : 500;
        routeEl.textContent = `${km} km (Demo)`;
    }
    
    updateBatteryStatus(km, predictedRange);
}

function calculateRoute(start, destination, predictedRange) {
    const routeEl = document.getElementById('routeDistance');
    if (!routeEl) {
        console.warn('Route distance element not found');
        return;
    }

    // Original: Try Google Maps first
    if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route({
            origin: start,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING
        }, (response, status) => {
            if (status === 'OK' && response.routes[0]) {
                const km = response.routes[0].legs[0].distance.value / 1000;
                routeEl.textContent = `${km.toFixed(1)} km (Google)`;
                updateBatteryStatus(km, predictedRange);
            } else {
                console.warn('Google failed:', status);
                fallbackDistance(start, destination, predictedRange, routeEl);
            }
        });
    } else {
        fallbackDistance(start, destination, predictedRange, routeEl);
    }
}

// Main entry - Properly structured, no syntax errors
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
        console.error('Route calculation error:', e);
        return;
    }
    
    const predictedRange = prediction.predicted_range_km || 400;
    const destination = prediction.destination || 'Yerragondapalem';
    
    let startLocation = '16.50,80.05'; // Ongole fallback
    try {
        const position = await getCurrentPosition();
        startLocation = `${position.coords.latitude},${position.coords.longitude}`;
        console.log('Using GPS:', startLocation);
    } catch (err) {
        console.warn('GPS failed:', err.message);
    }
    
    calculateRoute(startLocation, destination, predictedRange);
});

