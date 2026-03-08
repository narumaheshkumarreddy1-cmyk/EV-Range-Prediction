=// Route Page - Full Screen Map Routing Logic
// Uses Leaflet + OSRM + Overpass API for EV charging stations

var map;
var userLocation = null;
var userMarker = null;
var destMarker = null;
var routeLayer = null;

// Dedicated EV station layer
var evStationLayer = null;

// Current data
var evStations = [];

var currentDestination = null;
var currentRouteCoords = null;

// Get destination coordinates from URL query parameters
function getDestinationFromURL() {
    var urlParams = new URLSearchParams(window.location.search);
    var lat = urlParams.get('lat');
    var lng = urlParams.get('lng');
    var name = urlParams.get('name');
    
    if (lat && lng) {
        return {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            name: name ? decodeURIComponent(name) : 'Destination'
        };
    }
    return null;
}

// Show status message
function showStatus(message, type) {
    type = type || "info";
    var el = document.getElementById("route-status");
    if (!el) return;
    
    el.textContent = message;
    el.className = "route-status show " + type;
    
    if (type !== "loading") {
        setTimeout(function() {
            el.classList.remove("show");
        }, 4000);
    }
}

// Initialize Leaflet map
function initMap() {
    map = L.map("route-map", {
        zoomControl: true,
        attributionControl: true
    }).setView([0, 0], 2);
    
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    }).addTo(map);
    
    // Initialize EV station layer group
    evStationLayer = L.layerGroup().addTo(map);
    
    setupEventListeners();
    setupSearchListeners();
    requestUserLocation();
}

// Set up button event listeners
function setupEventListeners() {
    var recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
        recenterBtn.addEventListener("click", function() {
            if (userLocation) {
                map.flyTo([userLocation.lat, userLocation.lng], 14, {
                    duration: 1
                });
                showStatus("Recentered to your location", "success");
            } else {
                showStatus("Location not available", "error");
            }
        });
    }
    
    var clearBtn = document.getElementById("clear-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            clearRoute();
            showStatus("Route cleared", "success");
        });
    }
}

// Set up search functionality for user-defined places
function setupSearchListeners() {
    var searchInput = document.getElementById("place-search-input");
    var searchBtn = document.getElementById("place-search-btn");
    
    if (searchBtn) {
        searchBtn.addEventListener("click", function() {
            performPlaceSearch();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                performPlaceSearch();
            }
        });
    }
}

// Perform place search using Nominatim
async function performPlaceSearch() {
    var searchInput = document.getElementById("place-search-input");
    var query = searchInput ? searchInput.value.trim() : "";
    
    if (!query) {
        showStatus("Please enter a search term", "error");
        return;
    }
    
    showStatus("Searching for: " + query + "...", "loading");
    
    // Try Nominatim for named places
    try {
        var encodedQuery = encodeURIComponent(query);
        var nominatimUrl = "https://nominatim.openstreetmap.org/search?format=jsonv2&q=" + encodedQuery + "&limit=10";
        
        var response = await fetch(nominatimUrl, {
            headers: { "Accept-Language": "en" }
        });
        
        if (!response.ok) throw new Error("Nominatim error");
        
        var results = await response.json();
        
        if (results && results.length > 0) {
            displaySearchPlaces(results);
            showStatus("Found " + results.length + " places", "success");
            return;
        }
    } catch (err) {
        console.warn("Nominatim search failed:", err);
    }
    
    showStatus("No places found for: " + query, "info");
}

// Display search results (places)
function displaySearchPlaces(results) {
    evStationLayer.clearLayers();
    
    results.forEach(function(place) {
        var lat = parseFloat(place.lat);
        var lng = parseFloat(place.lon);
        var name = place.display_name || place.name || "Unknown Place";
        
        // Truncate name
        if (name.length > 40) {
            name = name.substring(0, 37) + "...";
        }
        
        var marker = L.circleMarker([lat, lng], {
            radius: 10,
            fillColor: "#9b59b6",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });
        
        var popupContent = '<div style="min-width:200px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
            '<h4 style="margin:0 0 8px 0;color:#9b59b6;font-size:14px;">' + name + '</h4>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Type:</strong> ' + (place.type || 'Place') + '</p>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Coordinates:</strong> ' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</p>' +
            '<button onclick="goToDirections(' + lat + ',' + lng + ',\'' + encodeURIComponent(name) + '\')" style="margin-top:8px;padding:6px 12px;background:#667eea;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Get Directions</button>' +
            '</div>';
        
        marker.bindPopup(popupContent);
        marker.addTo(evStationLayer);
    });
    
    // Fit bounds to search results
    if (results.length > 0) {
        var bounds = L.latLngBounds(results.map(function(r) { return [parseFloat(r.lat), parseFloat(r.lon)]; }));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Global function to navigate to directions
function goToDirections(lat, lng, name) {
    var destName = decodeURIComponent(name || "Destination");
    var routeUrl = '/route?lat=' + lat + '&lng=' + lng + '&name=' + encodeURIComponent(destName);
    window.location.href = routeUrl;
}

// Request user location
function requestUserLocation() {
    if (!navigator.geolocation) {
        showStatus("Geolocation not supported. Using default location.", "error");
        setDefaultLocation();
        return;
    }
    
    showStatus("Detecting your location...", "loading");
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            var loc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            setUserLocation(loc);
        },
        function(error) {
            console.warn("Geolocation error:", error);
            showStatus("Could not get location. Using default.", "error");
            setDefaultLocation();
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// Set default location (New York)
function setDefaultLocation() {
    var defaultLoc = { lat: 40.7128, lng: -74.0060 };
    setUserLocation(defaultLoc);
}

// Set user location on map
function setUserLocation(latlng) {
    userLocation = latlng;
    
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    var iconHtml = '<div style="width:24px;height:24px;border-radius:50%;background:#667eea;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>';
    
    var userIcon = L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    userMarker = L.marker([latlng.lat, latlng.lng], { icon: userIcon })
        .addTo(map)
        .bindTooltip("Your Location", {
            permanent: false,
            direction: "top"
        });
    
    map.setView([latlng.lat, latlng.lng], 13);
    checkForDestination();
}

// Check if destination is in URL and calculate route
function checkForDestination() {
    var destination = getDestinationFromURL();
    
    if (destination) {
        showStatus("Finding route to " + destination.name + "...", "loading");
        setDestinationMarker(destination);
        if (userLocation) {
            calculateRouteOSRM(userLocation, destination);
        }
    } else {
        // No destination - search EV stations around user location
        fetchEVStationsAroundLocation();
        showStatus("Enter a destination to get directions", "info");
    }
}

// Set destination marker on map
function setDestinationMarker(dest) {
    if (destMarker) {
        map.removeLayer(destMarker);
    }
    
    var iconHtml = '<div style="width:24px;height:24px;border-radius:50%;background:#f39c12;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>';
    
    var destIcon = L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    
    destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon })
        .addTo(map)
        .bindTooltip(dest.name || "Destination", {
            permanent: false,
            direction: "top"
        });
    
    currentDestination = dest;
}

// Calculate route using OSRM
async function calculateRouteOSRM(origin, dest) {
    showStatus("Calculating route...", "loading");
    
    clearRouteLayer();
    clearEVStationLayer();
    
    var url = "https://router.project-osrm.org/route/v1/driving/" + 
                origin.lng + "," + origin.lat + ";" + 
                dest.lng + "," + dest.lat + 
                "?overview=full&geometries=geojson";
    
    try {
        var response = await fetch(url);
        
        if (!response.ok) {
            var errorText = await response.text();
            throw new Error("OSRM error: " + response.status + " - " + errorText);
        }
        
        var data = await response.json();
        
        if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
            showStatus("No route found", "error");
            return;
        }
        
        var route = data.routes[0];
        var distanceMeters = route.distance;
        var durationSeconds = route.duration;
        var distanceKm = (distanceMeters / 1000).toFixed(1);
        var durationMin = Math.round(durationSeconds / 60);
        
        if (route.geometry && route.geometry.coordinates) {
            currentRouteCoords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
            
            routeLayer = L.polyline(currentRouteCoords, {
                color: "#007bff",
                weight: 6,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round"
            }).addTo(map);
            
            var bounds = L.latLngBounds(currentRouteCoords);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        updateRouteInfo(distanceKm, durationMin, dest.name);
        
        // Fetch EV stations along the route - using midpoint with 30km radius
        fetchEVStationsAlongRoute(currentRouteCoords);
        
        showStatus("Route calculated successfully!", "success");
        
    } catch (error) {
        console.error("Route calculation error:", error);
        showStatus("Failed to calculate route: " + error.message, "error");
    }
}

// Calculate midpoint of route coordinates
function calculateRouteMidpoint(coords) {
    if (!coords || coords.length === 0) {
        return null;
    }
    
    var totalLat = 0;
    var totalLng = 0;
    
    for (var i = 0; i < coords.length; i++) {
        totalLat += coords[i][0];
        totalLng += coords[i][1];
    }
    
    return {
        lat: totalLat / coords.length,
        lng: totalLng / coords.length
    };
}

// Fetch EV stations along the route using 30km radius from midpoint
async function fetchEVStationsAlongRoute(coords) {
    var midpoint = calculateRouteMidpoint(coords);
    
    if (!midpoint) {
        showStatus("Could not calculate route midpoint", "error");
        return;
    }
    
    showStatus("Searching for EV charging stations nearby...", "loading");
    
    // Use Overpass API with around:30000 (30km radius)
    var overpassQuery = "[out:json];node[\"amenity\"=\"charging_station\"](around:30000," + 
        midpoint.lat + "," + midpoint.lng + ");out 100;";
    
    console.log("Fetching EV stations with query:", overpassQuery);
    console.log("Midpoint coordinates:", midpoint.lat, midpoint.lng);
    
    try {
        var response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQuery
        });
        
        if (!response.ok) throw new Error("Overpass API error: " + response.status);
        
        var data = await response.json();
        console.log("Overpass response:", data);
        
        if (!data || !data.elements || data.elements.length === 0) {
            evStations = [];
            updateStationCount(0);
            showStatus("No EV stations found within 30km", "info");
            return;
        }
        
        evStations = data.elements.filter(function(el) { return el.type === "node"; });
        displayEVStations(evStations);
        updateStationCount(evStations.length);
        showStatus("Found " + evStations.length + " EV stations nearby!", "success");
        
    } catch (error) {
        console.error("Error fetching EV stations:", error);
        evStations = [];
        updateStationCount(0);
        showStatus("Could not fetch EV stations", "error");
    }
}

// Fetch EV stations around user location (when no route is generated)
async function fetchEVStationsAroundLocation() {
    if (!userLocation) {
        console.warn("User location not available");
        return;
    }
    
    showStatus("Searching for EV charging stations nearby...", "loading");
    
    // Use Overpass API with around:30000 (30km radius) from user location
    var overpassQuery = "[out:json];node[\"amenity\"=\"charging_station\"](around:30000," + 
        userLocation.lat + "," + userLocation.lng + ");out 100;";
    
    console.log("Fetching EV stations around user location with query:", overpassQuery);
    console.log("User location coordinates:", userLocation.lat, userLocation.lng);
    
    try {
        var response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: overpassQuery
        });
        
        if (!response.ok) throw new Error("Overpass API error: " + response.status);
        
        var data = await response.json();
        console.log("Overpass response (user location):", data);
        
        if (!data || !data.elements || data.elements.length === 0) {
            evStations = [];
            updateStationCount(0);
            showStatus("No EV stations found within 30km", "info");
            return;
        }
        
        evStations = data.elements.filter(function(el) { return el.type === "node"; });
        displayEVStations(evStations);
        updateStationCount(evStations.length);
        showStatus("Found " + evStations.length + " EV stations nearby!", "success");
        
    } catch (error) {
        console.error("Error fetching EV stations:", error);
        evStations = [];
        updateStationCount(0);
        showStatus("Could not fetch EV stations", "error");
    }
}

// Display EV charging stations with red circle markers
function displayEVStations(stations) {
    evStationLayer.clearLayers();
    
    stations.forEach(function(station) {
        var marker = L.circleMarker([station.lat, station.lng], {
            radius: 10,
            fillColor: "#e74c3c",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });
        
        var name = station.tags && station.tags.name ? station.tags.name : "EV Charging Station";
        var operator = station.tags && station.tags.operator ? station.tags.operator : "Unknown Operator";
        
        var popupContent = '<div style="min-width:200px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
            '<h4 style="margin:0 0 8px 0;color:#e74c3c;font-size:14px;">' + name + '</h4>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Operator:</strong> ' + operator + '</p>' +
            '<p style="margin:4px 0;color:#666;font-size:12px;"><strong>Coordinates:</strong> ' + station.lat.toFixed(5) + ', ' + station.lng.toFixed(5) + '</p></div>';
        
        marker.bindPopup(popupContent);
        marker.addTo(evStationLayer);
    });
}

// Clear EV station layer
function clearEVStationLayer() {
    if (evStationLayer) {
        evStationLayer.clearLayers();
    }
    evStations = [];
}

// Update station count in info card
function updateStationCount(count) {
    var stationsEl = document.getElementById("route-stations");
    if (stationsEl) {
        stationsEl.textContent = count > 0 ? count + " found" : "0";
    }
}

// Clear route layer
function clearRouteLayer() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    currentRouteCoords = [];
}

// Update route info card
function updateRouteInfo(distanceKm, etaMinutes, destName) {
    var infoCard = document.getElementById("route-info");
    var destNameEl = document.getElementById("destination-name");
    var distanceEl = document.getElementById("route-distance");
    var etaEl = document.getElementById("route-eta");
    var trafficEl = document.getElementById("route-traffic");
    var stationsEl = document.getElementById("route-stations");
    
    if (!infoCard) return;
    
    if (destNameEl) destNameEl.textContent = destName || "Destination";
    if (distanceEl) distanceEl.textContent = distanceKm + " km";
    if (etaEl) etaEl.textContent = etaMinutes + " min";
    
    if (trafficEl) {
        var traffic;
        if (etaMinutes > 60) {
            traffic = { level: "heavy", label: "Heavy" };
        } else if (etaMinutes > 30) {
            traffic = { level: "moderate", label: "Moderate" };
        } else {
            traffic = { level: "light", label: "Light" };
        }
        trafficEl.textContent = traffic.label;
        trafficEl.className = "traffic-badge traffic-" + traffic.level;
    }
    
    // Update EV station count
    if (stationsEl) {
        stationsEl.textContent = evStations.length > 0 ? evStations.length + " found" : "0";
    }
    
    infoCard.classList.add("show");
}

// Clear route and reset
function clearRoute() {
    clearRouteLayer();
    clearEVStationLayer();
    
    if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
    }
    
    currentDestination = null;
    
    var infoCard = document.getElementById("route-info");
    if (infoCard) {
        infoCard.classList.remove("show");
    }
    
    // Reset station count
    updateStationCount(0);
    
    if (userLocation) {
        map.setView([userLocation.lat, userLocation.lng], 13);
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    initMap();
    
    // Also fetch EV stations around user location on initial load after 3 seconds
    setTimeout(function() {
        if (userLocation && evStations.length === 0) {
            fetchEVStationsAroundLocation();
        }
    }, 3000);
});
