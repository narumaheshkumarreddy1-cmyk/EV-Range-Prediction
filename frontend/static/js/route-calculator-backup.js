// Backup of original route-calculator.js before fixes
// Simple Google Maps route calculator for EV prediction
document.addEventListener('DOMContentLoaded', function() {
    const predictionDataElement = document.getElementById('prediction-data');
    if (!predictionDataElement || !predictionDataElement.dataset.prediction) return;

    try {
        const prediction = JSON.parse(predictionDataElement.dataset.prediction);
        const predictedRange = prediction.predicted_range_km || 400;
        const destination = prediction.destination || 'Yerragondapalem';
        
        // Get current location with geolocation fallback
        let startLocation = 'Ongole, Andhra Pradesh'; // fallback
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    startLocation = `${position.coords.latitude},${position.coords.longitude}`;
                    calculateRoute(startLocation, destination);
                },
                () => {
                    calculateRoute(startLocation, destination);
                },
                { timeout: 5000 }
            );
        } else {
            calculateRoute(startLocation, destination);
        }
        
        } // close geolocation callbacks
        
        function calculateRoute(start, dest) {
        
        // Google Maps Directions API
        if (typeof google !== 'undefined' && google.maps) {
            const directionsService = new google.maps.DirectionsService();
            directionsService.route({
                origin: startLocation,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            }, function(response, status) {
                if (status === 'OK') {
                    const km = response.routes[0].legs[0].distance.value / 1000;
                    document.getElementById('routeDistance').textContent = km.toFixed(1) + ' km';
                    updateBatteryStatus(km, predictedRange);
                } else {
                    // Fallback demo
                    const demoKm = destination.toLowerCase().includes('yerragondapalem') ? 850 : 500;
                    document.getElementById('routeDistance').textContent = demoKm + ' km';
                    updateBatteryStatus(demoKm, predictedRange);
                }
            });
        } else {
            // Fallback without Google
            const demoKm = destination.toLowerCase().includes('yerragondapalem') ? 850 : 500;
            document.getElementById('routeDistance').textContent = demoKm + ' km';
            updateBatteryStatus(demoKm, predictedRange);
        }
    } catch (e) {
        console.error('Route calculation error:', e);
    }
});

function updateBatteryStatus(routeKm, predictedKm) {
    const statusEl = document.getElementById('battery-sufficiency');
    const diffEl = document.getElementById('differenceDistance');
    if (statusEl) {
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
}

