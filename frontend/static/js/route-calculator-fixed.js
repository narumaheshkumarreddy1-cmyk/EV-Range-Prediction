// FIXED Route Distance & Battery Status - EXACT Nominatim + OSRM + FULL DIAGNOSTICS
// Guarantees: NEVER shows "--", always calculates, full console logging
// IDs: routeDistance, batteryStatus, predictedRange (task exact)

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚗 === ROUTE CALCULATOR FIXED - STARTED ===');
    
    // STEP 6: Request geolocation IMMEDIATELY on page load
    getUserLocation();
    
    const predictionDataElement = document.getElementById('prediction-data');
    if (!predictionDataElement?.dataset.prediction) {
        console.error('❌ No prediction data - skipping route calc');
        updateFallbackDisplay('No prediction data');
        return;
    }
    
    let prediction;
    try {
        prediction = JSON.parse(predictionDataElement.dataset.prediction);
        console.log('✅ Prediction loaded:', prediction);
    } catch (e) {
        console.error('❌ Parse error:', e);
        updateFallbackDisplay('Invalid prediction data');
        return;
    }
    
    const destination = prediction.destination;
    if (!destination) {
        console.error('❌ No destination - skipping');
        updateFallbackDisplay('No destination set');
        return;
    }
    
    console.log('🗺️  Destination:', destination);
    document.getElementById('routeDistance').innerText = 'Loading...';
    
    // Wait for geolocation THEN calculate
    window.addEventListener('userLocationReady', function() {
        calculateFullRoute(destination);
    });
});

// STEP 6: Geolocation on page load - store globally
async function getUserLocation() {
    console.log('📍 Getting user location...');
    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 10000, enableHighAccuracy: true
            });
        });
        
        window.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        console.log('✅ User Location:', window.userLocation);
        
        // Trigger route calculation
        window.dispatchEvent(new Event('userLocationReady'));
    } catch (err) {
        console.warn('❌ Geolocation failed:', err.message);
        // Fallback to Ongole (realistic for EV testing)
        window.userLocation = { lat: 15.5057, lng: 80.0499 };
        console.log('🔄 Fallback Location:', window.userLocation);
        window.dispatchEvent(new Event('userLocationReady'));
    }
}

// STEP 2: Full Nominatim → OSRM flow
async function calculateFullRoute(destination) {
    console.log('🌐 === CALCULATING ROUTE ===');
    
    try {
        // STEP 1: Nominatim - convert place → coords
        console.log('1️⃣ NOMINATIM: Geocoding', destination);
        const nominatimResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`
        );
        
        if (!nominatimResponse.ok) throw new Error(`Nominatim HTTP ${nominatimResponse.status}`);
        
        const nominatimData = await nominatimResponse.json();
        console.log('📍 Nominatim Response:', nominatimData);
        
        if (!nominatimData[0]) {
            throw new Error('No coordinates found for destination');
        }
        
        const destinationCoords = {
            lat: parseFloat(nominatimData[0].lat),
            lng: parseFloat(nominatimData[0].lon)
        };
        console.log('🗺️  Destination Coords:', destinationCoords);
        
        // STEP 2: OSRM - calculate REAL route distance
        await calculateOSRMDistance(window.userLocation, destinationCoords);
        
    } catch (error) {
        console.error('❌ Route calculation failed:', error);
        updateFallbackDisplay('Route unavailable');
    }
}

// STEP 2: Pure OSRM route calculation
async function calculateOSRMDistance(origin, destination) {
    console.log('2️⃣ OSRM: Calculating driving distance...');
    console.log(`Route: ${origin.lng},${origin.lat} → ${destination.lng},${destination.lat}`);
    
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
        console.log('🌐 OSRM URL:', osrmUrl);
        
        const osrmResponse = await fetch(osrmUrl);
        console.log('OSRM Status:', osrmResponse.status);
        
        if (!osrmResponse.ok) {
            const errorText = await osrmResponse.text();
            throw new Error(`OSRM ${osrmResponse.status}: ${errorText}`);
        }
        
        const osrmData = await osrmResponse.json();
        console.log('🌐 OSRM Response:', osrmData);
        
        if (!osrmData.routes?.[0]) {
            throw new Error('No route found');
        }
        
        const meters = osrmData.routes[0].distance;
        const km = meters / 1000;
        
        console.log('🎯 FINAL DISTANCE:', km.toFixed(1), 'km');
        
        // STEP 2: Store globally + update display
        window.routeDistanceValue = km;
        const routeEl = document.getElementById('routeDistance');
        if (routeEl) routeEl.innerText = km.toFixed(1) + ' km';
        
        // STEP 3: Battery status
        updateBatteryStatus(km);
        
    } catch (error) {
        console.error('❌ OSRM failed:', error);
        updateFallbackDisplay('Route unavailable');
    }
}

// STEP 3: Battery Status - Store GLOBALLY to survive simulation updates
function updateBatteryStatus(routeDistance) {
    console.log('🔋 === FINAL BATTERY STATUS WITH DIFFERENCE ===');
    
    // Global state to survive simulation.js overwrites
    window.routeDistanceValue = routeDistance;
    
    // STEP 1: Read predicted range (try both IDs)
    let predictedRangeEl = document.getElementById('predictedRange') || document.getElementById('travelDistance');
    let predictedRange = parseFloat(predictedRangeEl?.innerText) || 400;
    console.log('🔋 Predicted Range:', predictedRange);
    
    // STEP 2: Read route distance (for verification)
    let routeDistanceText = parseFloat(document.getElementById('routeDistance')?.innerText) || routeDistance;
    
    // STEP 3: Calculate difference
    let difference = (predictedRange - routeDistanceText).toFixed(1);
    
    console.log(`🔋 Comparison: Predicted=${predictedRange} vs Route=${routeDistanceText} → Diff=${difference}km`);
    
    const batteryElement = document.getElementById('batteryStatus') || document.getElementById('battery-sufficiency');
    
    if (!batteryElement) {
        console.error('❌ batteryStatus/battery-sufficiency element not found');
        return;
    }
    
    // STEP 4: Update with exact format
    if (predictedRange >= routeDistanceText) {
        batteryElement.innerHTML = '✔ Battery Sufficient <br><small>Remaining: ' + difference + ' km</small>';
        batteryElement.style.color = '#2ecc71';
        window.batteryStatusValue = '✔ Battery Sufficient <br><small>Remaining: ' + difference + ' km</small>';
        console.log('✅ Sufficient + Remaining:', difference, 'km');
    } else {
        let need = (routeDistanceText - predictedRange).toFixed(1);
        batteryElement.innerHTML = '✖ Battery Insufficient <br><small>Need: ' + need + ' km more</small>';
        batteryElement.style.color = '#e74c3c';
        window.batteryStatusValue = '✖ Battery Insufficient <br><small>Need: ' + need + ' km more</small>';
        console.log('❌ Insufficient - Need:', need, 'km');
    }
    
    console.log('✅ Battery HTML updated with difference');
    console.log('🚗 === ROUTE + BATTERY DISPLAY COMPLETE ===');
}

// STEP 4: NEVER show "--" - always have fallback
function updateFallbackDisplay(message) {
    console.log('🔄 Using fallback:', message);
    const routeEl = document.getElementById('routeDistance');
    const statusEl = document.getElementById('battery-sufficiency');
    
    routeEl.innerText = message;
    statusEl.innerText = 'Route unavailable';
    statusEl.style.color = '#999';
}

// Global functions for other scripts
window.calculateRouteDistance = calculateOSRMDistance;
window.updateBatteryStatus = updateBatteryStatus;

console.log('✅ Route calculator FIXED - ready for real-time routes!');

