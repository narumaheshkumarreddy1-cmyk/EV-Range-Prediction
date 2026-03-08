/**
 * EV Battery Simulation
 * Simulates realistic EV behavior with dynamic speed fluctuation,
 * efficiency zones, smart battery drain, and distance tracking.
 * Uses 30-second interval simulation.
 * 
 * Features:
 * - Dynamic range prediction based on speed
 * - Geolocation for current position
 * - OSRM route distance calculation
 * - Battery sufficiency analysis
 * - EV Charging stations along route
 */

// Global simulation state
var simulationInterval = null;
var simulationState = {
    battery: 0,
    predictedRange: 0,
    estimatedRange: 0,
    fullRange: 0,
    initialBattery: 0,
    initialPredictedRange: 0,
    baseSpeed: 0,
    currentSpeed: 0,
    ac: false,
    traffic: '',
    vehicleLoad: 0,
    isRunning: false,
    distanceTravelled: 0,
    efficiencyStatus: 'Optimal',
    // Destination related fields
    destination: '',
    routeDistance: 0,
    currentLat: 0,
    currentLng: 0,
    destinationLat: 0,
    destinationLng: 0,
    batterySufficient: null,
    difference: 0,
    geolocationObtained: false,
    routeCalculated: false
};

// Charging stations variables
var allStations = [];  // All stations along the route
var stationMarkers = [];  // Map markers for stations
var stationMap = null;  // Leaflet map for stations
var stationLayer = null;  // Layer group for station markers
var routeCoords = [];  // Route coordinates [lat, lng]
var userStartLocation = null;  // User's starting location

// Charging icon for Leaflet
var chargingIcon = L.divIcon({
    html: '<div style="width:28px;height:28px;border-radius:14px;background:#27ae60;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">⚡</div>',
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
});

// Distance ahead to show stations (km)
var STATIONS_AHEAD_DISTANCE = 100;

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function getDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // Earth's radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Open Google Maps navigation to a specific location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function openGoogleMaps(lat, lon) {
    var url = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lon;
    window.open(url, '_blank');
}

// Make function available globally
window.openGoogleMaps = openGoogleMaps;

/**
 * Display charging stations as a list (not on map)
 * @param {number} currentLat - Current latitude of vehicle
 * @param {number} currentLon - Current longitude of vehicle
 */
function displayNearbyStations(currentLat, currentLon) {
    var stationList = document.getElementById('stations-list');
    if (!stationList) {
        console.warn('Stations list container not found');
        return;
    }
    
    // Show the charging stations section
    var stationsSection = document.getElementById('charging-stations-section');
    if (stationsSection) {
        stationsSection.style.display = 'block';
    }
    
    // Filter stations within 100 km of current position
    var visibleStations = allStations.filter(function(station) {
        if (station.lat && station.lon) {
            var dist = getDistance(currentLat, currentLon, station.lat, station.lon);
            return dist <= 100;
        }
        return false;
    });
    
    // Sort by distance from current position
    visibleStations.sort(function(a, b) {
        var distA = getDistance(currentLat, currentLon, a.lat, a.lon);
        var distB = getDistance(currentLat, currentLon, b.lat, b.lon);
        return distA - distB;
    });
    
    if (visibleStations.length === 0) {
        stationList.innerHTML = '<p style="text-align: center; color: #666;">No charging stations found within 100 km</p>';
        return;
    }
    
    var html = '';
    visibleStations.forEach(function(station) {
        var dist = getDistance(currentLat, currentLon, station.lat, station.lon);
        
        html += '<div class="station-card">' +
            '<div class="station-info">' +
            '<strong>⚡ ' + station.name + '</strong>' +
            '<span class="station-distance">' + dist.toFixed(1) + ' km away</span>' +
            '</div>' +
            '<button class="navigate-btn" onclick="openGoogleMaps(' + station.lat + ',' + station.lon + ')">' +
            'Navigate' +
            '</button>' +
            '</div>';
    });
    
    stationList.innerHTML = html;
    console.log('Displayed ' + visibleStations.length + ' charging stations within 100 km');
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // Earth's radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Calculate distance from a point to a route segment
 * @param {number} lat - Latitude of point
 * @param {number} lon - Longitude of point
 * @param {Array} coord1 - First coordinate [lat, lon]
 * @param {Array} coord2 - Second coordinate [lat, lon]
 * @returns {number} Minimum distance in km
 */
function pointToSegmentDistance(lat, lon, coord1, coord2) {
    var x = lon;
    var y = lat;
    var x1 = coord1[1];
    var y1 = coord1[0];
    var x2 = coord2[1];
    var y2 = coord2[0];

    var A = x - x1;
    var B = y - y1;
    var C = x2 - x1;
    var D = y2 - y1;

    var dot = A * C + B * D;
    var len_sq = C * C + D * D;
    var param = -1;
    
    if (len_sq !== 0) {
        param = dot / len_sq;
    }

    var xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    return calculateDistance(lat, lon, yy, xx);
}

/**
 * Find distance of a point along the route
 * @param {number} lat - Latitude of point
 * @param {number} lon - Longitude of point
 * @returns {number} Distance in km from start of route
 */
function getDistanceAlongRoute(lat, lon) {
    if (!routeCoords || routeCoords.length === 0) {
        return 0;
    }

    var minDistance = Infinity;
    var distanceAtMin = 0;
    var cumulativeDistance = 0;

    for (var i = 0; i < routeCoords.length - 1; i++) {
        var distToSegment = pointToSegmentDistance(lat, lon, routeCoords[i], routeCoords[i + 1]);
        
        if (distToSegment < minDistance) {
            minDistance = distToSegment;
            distanceAtMin = cumulativeDistance;
        }
        
        // Add distance between consecutive route points
        cumulativeDistance += calculateDistance(
            routeCoords[i][0], routeCoords[i][1],
            routeCoords[i + 1][0], routeCoords[i + 1][1]
        );
    }

    return distanceAtMin;
}

/**
 * Initialize the map for charging stations
 */
function initStationMap() {
    var mapContainer = document.getElementById('station-map-container');
    if (!mapContainer) {
        console.warn('Station map container not found');
        return;
    }

    // Show the map container
    mapContainer.style.display = 'block';

    // Initialize map with default view
    var defaultLat = userStartLocation ? userStartLocation.lat : 40.7128;
    var defaultLng = userStartLocation ? userStartLocation.lng : -74.0060;

    stationMap = L.map('station-map', {
        zoomControl: true,
        attributionControl: true
    }).setView([defaultLat, defaultLng], 10);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    }).addTo(stationMap);

    // Initialize station layer group
    stationLayer = L.layerGroup().addTo(stationMap);

    console.log('Station map initialized');
}

/**
 * Fetch EV charging stations along the route using Overpass API
 */
async function fetchChargingStationsAlongRoute() {
    if (!userStartLocation || !simulationState.destinationLat || !simulationState.destinationLng) {
        console.warn('Cannot fetch stations: missing route information');
        return;
    }

    // Calculate route coordinates first
    await calculateRouteCoordinates();

    if (routeCoords.length === 0) {
        console.warn('No route coordinates available');
        return;
    }

    // Get bounding box of the route
    var lats = routeCoords.map(function(c) { return c[0]; });
    var lngs = routeCoords.map(function(c) { return c[1]; });

    var minLat = Math.min.apply(null, lats);
    var maxLat = Math.max.apply(null, lngs);
    var minLng = Math.min.apply(null, lngs);
    var maxLng = Math.max.apply(null, lngs);

    // Add small padding
    var padding = 0.1;
    var south = minLat - padding;
    var west = minLng - padding;
    var north = maxLat + padding;
    var east = maxLng + padding;

    console.log('Fetching stations with bounding box:', south, west, north, east);

    // Overpass API query
    var query = "[out:json][timeout:25];" +
        "node[\"amenity\"=\"charging_station\"](" + south + "," + west + "," + north + "," + east + ");" +
        "out body;";

    try {
        var response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query
        });

        if (!response.ok) {
            throw new Error("Overpass API error: " + response.status);
        }

        var data = await response.json();
        console.log('Overpass response:', data);

        if (!data || !data.elements || data.elements.length === 0) {
            allStations = [];
            updateNearbyStationsDisplay([]);
            console.log('No EV stations found along route');
            return;
        }

        // Process stations and calculate distance along route
        allStations = [];
        data.elements.forEach(function(element) {
            if (element.type === 'node' && element.lat && element.lon) {
                var distanceAlongRoute = getDistanceAlongRoute(element.lat, element.lon);
                var station = {
                    id: element.id,
                    name: element.tags && element.tags.name ? element.tags.name : 'EV Charging Station',
                    lat: element.lat,
                    lon: element.lon,
                    operator: element.tags && element.tags.operator ? element.tags.operator : 'Unknown',
                    distanceAlongRoute: distanceAlongRoute
                };
                allStations.push(station);
            }
        });

        // Sort by distance along route
        allStations.sort(function(a, b) {
            return a.distanceAlongRoute - b.distanceAlongRoute;
        });

        console.log('Total stations found:', allStations.length);

        // Show the nearby stations section
        var stationsSection = document.getElementById('nearby-stations-section');
        if (stationsSection) {
            stationsSection.style.display = 'block';
        }

        // Initial display of stations (within first 100 km)
        updateChargingStations(0);
        
        // Also display stations using the new list-based function
        if (userStartLocation) {
            displayNearbyStations(userStartLocation.lat, userStartLocation.lng);
        }

    } catch (error) {
        console.error('Error fetching charging stations:', error);
    }
}

/**
 * Calculate route coordinates using OSRM API
 */
async function calculateRouteCoordinates() {
    if (!userStartLocation || !simulationState.destinationLat || !simulationState.destinationLng) {
        return;
    }

    var url = "https://router.project-osrm.org/route/v1/driving/" + 
                userStartLocation.lng + "," + userStartLocation.lat + ";" + 
                simulationState.destinationLng + "," + simulationState.destinationLat + 
                "?overview=full&geometries=geojson";

    try {
        var response = await fetch(url);
        
        if (!response.ok) {
            throw new Error("OSRM error: " + response.status);
        }

        var data = await response.json();
        
        if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
            console.warn('No route found');
            return;
        }

        var route = data.routes[0];
        
        // Store route distance
        simulationState.routeDistance = route.distance / 1000;

        // Convert route coordinates from [lng, lat] to [lat, lng]
        if (route.geometry && route.geometry.coordinates) {
            routeCoords = route.geometry.coordinates.map(function(c) {
                return [c[1], c[0]]; // [lat, lng]
            });
        }

        console.log('Route calculated:', routeCoords.length, 'points');
        console.log('Route distance:', simulationState.routeDistance.toFixed(2), 'km');

    } catch (error) {
        console.error('Error calculating route:', error);
    }
}

/**
 * Update charging stations display based on current distance travelled
 * @param {number} currentDistance - Current distance travelled in km
 */
function updateChargingStations(currentDistance) {
    // Filter stations within the next 100 km ahead
    var minDistance = currentDistance;
    var maxDistance = currentDistance + STATIONS_AHEAD_DISTANCE;

    var visibleStations = allStations.filter(function(station) {
        return station.distanceAlongRoute >= minDistance && station.distanceAlongRoute <= maxDistance;
    });

    console.log('Showing stations between', minDistance.toFixed(1), 'and', maxDistance.toFixed(1), 'km:', visibleStations.length, 'stations');

    // Update map markers
    updateStationMarkers(visibleStations, currentDistance);

    // Update station cards
    updateNearbyStationsDisplay(visibleStations, currentDistance);
}

/**
 * Update station markers on the map
 * @param {Array} stations - Array of visible stations
 * @param {number} currentDistance - Current distance travelled
 */
function updateStationMarkers(stations, currentDistance) {
    if (!stationMap || !stationLayer) {
        // Initialize map if not already done
        initStationMap();
    }

    if (!stationLayer) {
        return;
    }

    // Clear existing markers
    stationLayer.clearLayers();
    stationMarkers = [];

    // Add new markers
    stations.forEach(function(station) {
        var distanceFromVehicle = station.distanceAlongRoute - currentDistance;
        
        var marker = L.marker([station.lat, station.lon], {
            icon: chargingIcon
        });

        var popupContent = '<div style="min-width:200px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
            '<h4 style="margin:0 0 8px 0;color:#27ae60;font-size:14px;">⚡ ' + station.name + '</h4>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Operator:</strong> ' + station.operator + '</p>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Distance:</strong> ' + distanceFromVehicle.toFixed(1) + ' km ahead</p>' +
            '<button onclick="navigateToStation(' + station.lat + ',' + station.lng + ',\'' + encodeURIComponent(station.name) + '\')" style="margin-top:8px;padding:6px 12px;background:#667eea;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;width:100%;">Navigate</button>' +
            '</div>';

        marker.bindPopup(popupContent);
        marker.addTo(stationLayer);
        stationMarkers.push(marker);
    });

    // Fit bounds to show all stations
    if (stations.length > 0) {
        var bounds = L.latLngBounds(stations.map(function(s) { return [s.lat, s.lon]; }));
        
        // Also include current position
        if (routeCoords.length > 0 && currentDistance < routeCoords.length) {
            var currentPos = routeCoords[Math.min(Math.floor(currentDistance / (simulationState.routeDistance / routeCoords.length)), routeCoords.length - 1)];
            if (currentPos) {
                bounds.extend(currentPos);
            }
        }

        stationMap.fitBounds(bounds, { padding: [50, 50] });
    }
}

/**
 * Update the nearby stations list in the UI
 * @param {Array} stations - Array of visible stations
 * @param {number} currentDistance - Current distance travelled
 */
function updateNearbyStationsDisplay(stations, currentDistance) {
    var listContainer = document.getElementById('nearby-stations-list');
    if (!listContainer) {
        return;
    }

    if (!stations || stations.length === 0) {
        listContainer.innerHTML = '<p style="text-align: center; color: #666;">No charging stations found in the next ' + STATIONS_AHEAD_DISTANCE + ' km</p>';
        return;
    }

    var html = '';
    stations.forEach(function(station) {
        var distanceFromVehicle = station.distanceAlongRoute - currentDistance;
        
        html += '<div class="nearby-station-card">' +
            '<div class="station-info">' +
            '<div class="station-name">⚡ ' + station.name + '</div>' +
            '<div class="station-operator">Operator: ' + station.operator + '</div>' +
            '</div>' +
            '<div class="station-distance">' + distanceFromVehicle.toFixed(1) + ' km</div>' +
            '<button class="station-nav-btn" onclick="navigateToStation(' + station.lat + ',' + station.lng + ',\'' + encodeURIComponent(station.name) + '\')">Navigate</button>' +
            '</div>';
    });

    listContainer.innerHTML = html;
}

/**
 * Navigate to a charging station using Google Maps
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} name - Station name
 */
function navigateToStation(lat, lng, name) {
    var stationName = decodeURIComponent(name || "Charging Station");
    var googleUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
    window.open(googleUrl, '_blank');
}

// Make function available globally
window.navigateToStation = navigateToStation;

/**
 * Initialize and start the battery simulation
 * @param {Object} predictionData - Data from session prediction_data
 */
function initSimulation(predictionData) {
    if (!predictionData) {
        console.error('No prediction data available for simulation');
        return false;
    }

    // Validate required fields
    if (!predictionData.estimated_range_km && !predictionData.full_range_km) {
        console.error('No range data available for simulation');
        return false;
    }

    // Initialize simulation state from prediction data
    simulationState.battery = parseFloat(predictionData.battery) || 100;
    simulationState.estimatedRange = parseFloat(predictionData.estimated_range_km) || parseFloat(predictionData.full_range_km) || 0;
    
    // Store initial values for remaining range calculation
    simulationState.initialBattery = simulationState.battery;
    simulationState.initialPredictedRange = simulationState.estimatedRange;
    
    simulationState.predictedRange = simulationState.estimatedRange;
    simulationState.fullRange = parseFloat(predictionData.full_range_km) || simulationState.estimatedRange;
    simulationState.baseSpeed = parseFloat(predictionData.speed) || 60;
    simulationState.currentSpeed = simulationState.baseSpeed;
    simulationState.ac = Boolean(predictionData.ac);
    simulationState.traffic = String(predictionData.traffic || 'medium').toLowerCase();
    simulationState.vehicleLoad = parseFloat(predictionData.vehicle_load) || 0;
    simulationState.isRunning = true;
    simulationState.distanceTravelled = 0;
    simulationState.efficiencyStatus = 'Optimal';
    
    // Store destination
    simulationState.destination = predictionData.destination || '';
    
    // Reset destination-related state
    simulationState.routeDistance = 0;
    simulationState.batterySufficient = null;
    simulationState.difference = 0;
    simulationState.geolocationObtained = false;
    simulationState.routeCalculated = false;

    // Show simulation UI
    var container = document.getElementById('simulation-container');
    if (container) {
        container.style.display = 'block';
    }
    
    // Update initial display
    updateSimulationDisplay();

    // Start the simulation interval (every 30 seconds)
    if (simulationInterval) {
        clearInterval(simulationInterval);
    }
    
    simulationInterval = setInterval(runSimulationStep, 20000);
    
    // Update status message immediately
    updateSimulationStatus('Simulation running (Updates every 20 seconds)');
    
    console.log('EV Live Adaptive Range simulation started:', simulationState);
    
    // Initialize geolocation and route calculation
    if (simulationState.destination) {
        initGeolocation();
    }
    
    return true;
}

/**
 * Initialize geolocation to get current position
 */
function initGeolocation() {
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        updateSimulationStatus('Geolocation not supported. Enter destination manually.');
        return;
    }
    
    updateSimulationStatus('Getting current location...');
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            simulationState.currentLat = position.coords.latitude;
            simulationState.currentLng = position.coords.longitude;
            simulationState.geolocationObtained = true;
            
            // Store user start location for charging stations
            userStartLocation = {
                lat: simulationState.currentLat,
                lng: simulationState.currentLng
            };
            
            console.log('Current position:', simulationState.currentLat, simulationState.currentLng);
            
            // Now geocode the destination
            geocodeDestination(simulationState.destination);
        },
        function(error) {
            console.error('Geolocation error:', error);
            updateSimulationStatus('Could not get current location. Using default location.');
            // Use default location (New York)
            simulationState.currentLat = 40.7128;
            simulationState.currentLng = -74.0060;
            simulationState.geolocationObtained = true;
            
            // Store default user start location
            userStartLocation = {
                lat: simulationState.currentLat,
                lng: simulationState.currentLng
            };
            
            // Try to geocode destination anyway
            geocodeDestination(simulationState.destination);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/**
 * Geocode destination address to coordinates using Nominatim
 * @param {string} destination - Destination address
 */
function geocodeDestination(destination) {
    if (!destination) {
        console.warn('No destination provided');
        return;
    }
    
    updateSimulationStatus('Calculating route to ' + destination + '...');
    
    var encodedDest = encodeURIComponent(destination);
    var nominatimUrl = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodedDest;
    
    fetch(nominatimUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                simulationState.destinationLat = parseFloat(data[0].lat);
                simulationState.destinationLng = parseFloat(data[0].lon);
                
                console.log('Destination coordinates:', simulationState.destinationLat, simulationState.destinationLng);
                
                // Fetch route distance from OSRM
                fetchRouteDistance();
            } else {
                console.warn('Could not geocode destination');
                updateSimulationStatus('Could not find destination. Please check address.');
            }
        })
        .catch(error => {
            console.error('Geocoding error:', error);
            updateSimulationStatus('Error calculating route. Please try again.');
        });
}

/**
 * Fetch route distance using OSRM API
 */
function fetchRouteDistance() {
    if (!simulationState.geolocationObtained) {
        console.warn('Geolocation not obtained yet');
        return;
    }
    
    if (!simulationState.destinationLat || !simulationState.destinationLng) {
        console.warn('Destination coordinates not available');
        return;
    }
    
    var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + 
                  simulationState.currentLng + ',' + simulationState.currentLat + ';' + 
                  simulationState.destinationLng + ',' + simulationState.destinationLat + 
                  '?overview=false';
    
    console.log('Fetching route from OSRM:', osrmUrl);
    
    fetch(osrmUrl)
        .then(response => response.json())
        .then(data => {
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                // Distance is in meters, convert to km
                simulationState.routeDistance = data.routes[0].distance / 1000;
                simulationState.routeCalculated = true;
                
                console.log('Route distance:', simulationState.routeDistance.toFixed(2), 'km');
                
                // Update display with route distance
                updateBatterySufficiency();
                updateSimulationDisplay();
                
                updateSimulationStatus('Route calculated: ' + simulationState.routeDistance.toFixed(1) + ' km');
                
                // Fetch charging stations along the route
                fetchChargingStationsAlongRoute();
            } else {
                console.warn('Could not get route from OSRM');
                updateSimulationStatus('Could not calculate route. Please try again.');
            }
        })
        .catch(error => {
            console.error('OSRM API error:', error);
            updateSimulationStatus('Error fetching route. Please try again.');
        });
}

/**
 * Update battery sufficiency status based on predicted range and route distance
 */
function updateBatterySufficiency() {
    if (!simulationState.routeCalculated || simulationState.routeDistance <= 0) {
        simulationState.batterySufficient = null;
        simulationState.difference = 0;
        return;
    }
    
    // Calculate difference: predicted range - route distance
    simulationState.difference = simulationState.predictedRange - simulationState.routeDistance;
    
    if (simulationState.difference >= 0) {
        simulationState.batterySufficient = true;
    } else {
        simulationState.batterySufficient = false;
    }
    
    console.log('Battery sufficiency:', simulationState.batterySufficient);
    console.log('Difference:', simulationState.difference.toFixed(2), 'km');
}

/**
 * Generate dynamic speed with fluctuation (±10 variation from base speed)
 * Speed is clamped between 20 and 120 km/h
 */
function calculateDynamicSpeed() {
    var variation = (Math.random() * 20) - 10;
    var newSpeed = simulationState.baseSpeed + variation;
    // Clamp speed between 20 and 120 km/h
    newSpeed = Math.max(20, Math.min(newSpeed, 120));
    return newSpeed;
}

/**
 * Determine efficiency status for display
 */
function getEfficiencyStatus(speed, efficiencyFactor) {
    if (efficiencyFactor >= 0.9) {
        return 'Optimal';
    } else if (efficiencyFactor >= 0.75) {
        return 'Normal';
    } else {
        return 'High Consumption';
    }
}

/**
 * Run a single simulation step (called every 30 seconds)
 * Uses realistic EV physics:
 * - Range depends directly on actual energy consumption
 * - Battery drop matches distance travelled mathematically
 */
function runSimulationStep() {
    if (!simulationState.isRunning || simulationState.battery <= 0) {
        stopSimulation();
        return;
    }

    // Step 1: Generate dynamic speed with fluctuation
    simulationState.currentSpeed = calculateDynamicSpeed();
    var currentSpeed = simulationState.currentSpeed;
    
    console.log('Dynamic Speed: ' + currentSpeed.toFixed(1) + ' km/h');
    
    // Step 2: Calculate efficiency factor for display purposes only
    // Efficiency affects speed perception, NOT the final range calculation
    var efficiencyFactor = 1;

    // Speed impact: efficiency decreases with speed
    efficiencyFactor -= currentSpeed * 0.0012;

    // AC impact
    if (simulationState.ac) {
        efficiencyFactor -= 0.04;
    }

    // Traffic impact
    if (simulationState.traffic === 'high') {
        efficiencyFactor -= 0.06;
    } else if (simulationState.traffic === 'medium') {
        efficiencyFactor -= 0.03;
    }

    // Load impact
    efficiencyFactor -= (simulationState.vehicleLoad / 1000) * 0.05;

    // Prevent unrealistic drop - minimum efficiency factor is 0.6
    if (efficiencyFactor < 0.6) {
        efficiencyFactor = 0.6;
    }

    simulationState.efficiencyStatus = getEfficiencyStatus(currentSpeed, efficiencyFactor);
    
    console.log('Efficiency Factor: ' + efficiencyFactor);
    console.log('Efficiency Status: ' + simulationState.efficiencyStatus);
    
    // Step 3: Calculate km per 1% battery dynamically
    // This ensures mathematical consistency: if 100% gives fullRange km, then 1% gives fullRange/100 km
    var kmPerPercent = simulationState.fullRange / 100;
    
    console.log('km per 1% battery: ' + kmPerPercent.toFixed(2) + ' km');
    
    // Step 4: Calculate distance travelled in this interval (30 seconds)
    // intervalSeconds = 30, convert hours: 30/3600
    var intervalSeconds = 30;
    var distanceStep = currentSpeed * (intervalSeconds / 3600);
    
    console.log('Distance travelled in this interval: ' + distanceStep.toFixed(2) + ' km');
    
    // Step 5: Calculate battery drop based on distance travelled
    // batteryDrop = distanceStep / kmPerPercent
    // This ensures: if 1% battery gives 4km, then 4km travelled = 1% battery drop
    var batteryDrop = distanceStep / kmPerPercent;
    
    console.log('Battery drop: ' + batteryDrop.toFixed(4) + '%');
    
    // Step 6: Update distance travelled (cumulative)
    simulationState.distanceTravelled += distanceStep;
    
    console.log('Total distance travelled: ' + simulationState.distanceTravelled.toFixed(2) + ' km');
    
    // Step 7: Update battery level
    simulationState.battery -= batteryDrop;
    
    // Safety clamp: prevent negative battery
    if (simulationState.battery < 0) {
        simulationState.battery = 0;
    }
    
    console.log('Live battery: ' + simulationState.battery.toFixed(2) + '%');
    
    // Step 8: Calculate predicted range based on remaining battery
    // predictedRange = liveBattery * kmPerPercent
    // This ensures mathematical consistency: 50% battery = 50% of full range
    simulationState.predictedRange = simulationState.battery * kmPerPercent;
    
    console.log('Predicted range (mathematically consistent): ' + simulationState.predictedRange.toFixed(2) + ' km');
    
    // Update battery sufficiency analysis
    updateBatterySufficiency();
    
    // Update the charging stations display based on distance travelled
    if (allStations.length > 0) {
        updateChargingStations(simulationState.distanceTravelled);
        
        // Also call the new displayNearbyStations function with current position
        if (simulationState.currentLat && simulationState.currentLng) {
            displayNearbyStations(simulationState.currentLat, simulationState.currentLng);
        }
    }
    
    // Update the display
    updateSimulationDisplay();
    
    // Step 9: Check for low battery warning (≤ 5%)
    if (simulationState.battery <= 5 && simulationState.battery > 0) {
        updateSimulationStatus('⚠️ Battery critically low. Navigate to charging station.');
        showLowBatteryAlert();
    }
    
    // Step 10: Check if battery is empty (stop condition)
    if (simulationState.battery <= 0) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        simulationState.isRunning = false;
        updateSimulationStatus('Battery critically low. Navigate to charging station.');
        showCriticalBatteryAlert();
    }
}

/**
 * Show low battery warning alert
 */
function showLowBatteryAlert() {
    // Create alert element if not exists
    var existingAlert = document.getElementById('lowBatteryAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    var alertDiv = document.createElement('div');
    alertDiv.id = 'lowBatteryAlert';
    alertDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #ffc107; color: #000; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; animation: slideIn 0.3s ease-out;';
    alertDiv.innerHTML = '<strong>⚠️ Low Battery Warning!</strong><br>Battery is at ' + simulationState.battery.toFixed(1) + '%. Please find a charging station soon!';
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(function() {
        var el = document.getElementById('lowBatteryAlert');
        if (el) {
            el.remove();
        }
    }, 5000);
}

/**
 * Show critical battery alert when battery reaches 0
 */
function showCriticalBatteryAlert() {
    // Remove any existing alerts
    var existingAlert = document.getElementById('lowBatteryAlert');
    if (existingAlert) {
        existingAlert.remove();
    }
    
    var alertDiv = document.createElement('div');
    alertDiv.id = 'lowBatteryAlert';
    alertDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; animation: slideIn 0.3s ease-out;';
    alertDiv.innerHTML = '<strong>🔋 Battery Critically Low!</strong><br>Battery is at 0%. Navigate to charging station immediately.';
    
    document.body.appendChild(alertDiv);
    
    // Keep the alert visible
    setTimeout(function() {
        var el = document.getElementById('lowBatteryAlert');
        if (el) {
            el.remove();
        }
    }, 10000);
}

/**
 * Update the simulation display elements
 */
function updateSimulationDisplay() {
    // Update battery percentage
    var batteryEl = document.getElementById('live-battery');
    if (batteryEl) {
        batteryEl.textContent = simulationState.battery.toFixed(1);
        
        // Update color based on battery level
        if (simulationState.battery > 50) {
            batteryEl.style.color = '#28a745'; // Green
        } else if (simulationState.battery > 20) {
            batteryEl.style.color = '#ffc107'; // Yellow
        } else {
            batteryEl.style.color = '#dc3545'; // Red
        }
    }
    
    // Update current speed display
    var speedEl = document.getElementById('current-speed');
    if (speedEl) {
        speedEl.textContent = simulationState.currentSpeed.toFixed(1);
        
        // Update color based on speed (Optimal = green, High = red, Normal = blue)
        if (simulationState.efficiencyStatus === 'Optimal') {
            speedEl.style.color = '#28a745';
        } else if (simulationState.efficiencyStatus === 'High Consumption') {
            speedEl.style.color = '#dc3545';
        } else {
            speedEl.style.color = '#667eea';
        }
    }
    
    // Update efficiency status display
    var efficiencyEl = document.getElementById('efficiency-status');
    if (efficiencyEl) {
        efficiencyEl.textContent = simulationState.efficiencyStatus;
        
        // Update color based on efficiency status
        if (simulationState.efficiencyStatus === 'Optimal') {
            efficiencyEl.style.color = '#28a745';
        } else if (simulationState.efficiencyStatus === 'High Consumption') {
            efficiencyEl.style.color = '#dc3545';
        } else {
            efficiencyEl.style.color = '#667eea';
        }
    }
    
    // Update distance travelled
    var distanceEl = document.getElementById('distanceTravelled');
    if (distanceEl) {
        distanceEl.textContent = simulationState.distanceTravelled.toFixed(2);
    }
    
    // Update available travel distance (dynamic predicted range)
    var travelDistanceEl = document.getElementById('travelDistance');
    if (travelDistanceEl) {
        travelDistanceEl.textContent = simulationState.predictedRange.toFixed(1);
    }
    
    // Update route distance display
    var routeDistanceEl = document.getElementById('routeDistance');
    if (routeDistanceEl) {
        if (simulationState.routeCalculated) {
            routeDistanceEl.textContent = simulationState.routeDistance.toFixed(1);
        } else {
            routeDistanceEl.textContent = '--';
        }
    }
    
    // Update battery sufficiency status
    var sufficiencyEl = document.getElementById('battery-sufficiency');
    if (sufficiencyEl) {
        if (simulationState.routeCalculated && simulationState.batterySufficient !== null) {
            if (simulationState.batterySufficient) {
                sufficiencyEl.innerHTML = '✔ Battery Sufficient';
                sufficiencyEl.style.color = '#28a745';
            } else {
                sufficiencyEl.innerHTML = '❌ Battery Insufficient';
                sufficiencyEl.style.color = '#dc3545';
            }
        } else {
            sufficiencyEl.textContent = '--';
            sufficiencyEl.style.color = '#666';
        }
    }
    
    // Update remaining/deficit distance
    var differenceEl = document.getElementById('differenceDistance');
    if (differenceEl) {
        if (simulationState.routeCalculated && simulationState.batterySufficient !== null) {
            if (simulationState.batterySufficient) {
                differenceEl.textContent = 'Remaining: ' + Math.abs(simulationState.difference).toFixed(1) + ' km';
                differenceEl.style.color = '#28a745';
            } else {
                differenceEl.textContent = 'Need: ' + Math.abs(simulationState.difference).toFixed(1) + ' km more';
                differenceEl.style.color = '#dc3545';
            }
        } else {
            differenceEl.textContent = '--';
            differenceEl.style.color = '#666';
        }
    }
}

/**
 * Update the simulation status message
 * @param {string} message - Status message to display
 */
function updateSimulationStatus(message) {
    var statusEl = document.getElementById('simulation-status');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

/**
 * Stop the simulation and clear the interval
 */
function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    simulationState.isRunning = false;
    
    if (simulationState.battery <= 0) {
        updateSimulationStatus('Battery Empty - Simulation Stopped');
    }
    
    console.log('Simulation stopped');
}

/**
 * Check if simulation is currently running
 * @returns {boolean} - True if simulation is running
 */
function isSimulationRunning() {
    return simulationState.isRunning && simulationInterval !== null;
}

/**
 * Get current simulation state
 * @returns {Object} - Current simulation state
 */
function getSimulationState() {
    return {
        battery: simulationState.battery,
        predictedRange: simulationState.predictedRange,
        estimatedRange: simulationState.estimatedRange,
        initialBattery: simulationState.initialBattery,
        initialPredictedRange: simulationState.initialPredictedRange,
        baseSpeed: simulationState.baseSpeed,
        currentSpeed: simulationState.currentSpeed,
        ac: simulationState.ac,
        traffic: simulationState.traffic,
        vehicleLoad: simulationState.vehicleLoad,
        isRunning: simulationState.isRunning,
        distanceTravelled: simulationState.distanceTravelled,
        efficiencyStatus: simulationState.efficiencyStatus,
        destination: simulationState.destination,
        routeDistance: simulationState.routeDistance,
        batterySufficient: simulationState.batterySufficient,
        difference: simulationState.difference
    };
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.initSimulation = initSimulation;
    window.runSimulationStep = runSimulationStep;
    window.stopSimulation = stopSimulation;
    window.isSimulationRunning = isSimulationRunning;
    window.getSimulationState = getSimulationState;
    window.showLowBatteryAlert = showLowBatteryAlert;
    window.showCriticalBatteryAlert = showCriticalBatteryAlert;
    window.calculateDynamicSpeed = calculateDynamicSpeed;
    window.initGeolocation = initGeolocation;
    window.geocodeDestination = geocodeDestination;
    window.fetchRouteDistance = fetchRouteDistance;
    window.updateBatterySufficiency = updateBatterySufficiency;
}
