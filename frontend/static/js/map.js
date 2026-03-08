// Leaflet + Nominatim + OSRM frontend map integration
// Using OSRM public routing API (no API key required)

let map;
let userLocation = null;
let userMarker = null;
let destMarker = null;
let stationMarkers = [];
let routeLayers = [];
let currentRoutes = [];
const STATION_API = "/api/map-data";
const DEFAULT_LOCATION = { lat: 40.7128, lng: -74.0060 };

function showStatus(message, type = "info") {
    const el = document.getElementById("status-message");
    if (el) {
        el.textContent = message;
        el.className = "status-message show " + type;
        if (type !== "loading") setTimeout(function() { el.classList.remove("show"); }, 4500);
    }
}

function initMap() {
    map = L.map("map", { zoomControl: true }).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    setupControls();
    requestUserLocation();
    fetchStations(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
}

function requestUserLocation() {
    if (!navigator.geolocation) {
        showStatus("Geolocation not supported by browser", "error");
        setFallbackLocation();
        return;
    }

    showStatus("Detecting your location...", "loading");
    navigator.geolocation.getCurrentPosition(function(pos) {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
    }, function(err) {
        console.warn("Geolocation error", err);
        showStatus("Location access denied or unavailable", "error");
        setFallbackLocation();
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function setFallbackLocation() {
    setUserLocation(DEFAULT_LOCATION);
}

function setUserLocation(latlng) {
    userLocation = latlng;
    if (userMarker) map.removeLayer(userMarker);

    const iconHtml = '<div style="width:28px;height:28px;border-radius:50%;background:#667eea;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2)"></div>';
    const myIcon = L.divIcon({ html: iconHtml, className: "" });

    userMarker = L.marker([latlng.lat, latlng.lng], { icon: myIcon }).addTo(map).bindTooltip("Your location", {permanent: false});
    map.setView([latlng.lat, latlng.lng], 13);

    fetchStations(latlng.lat, latlng.lng);
}

var nomTimeout;
function searchNominatim(query) {
    const list = document.getElementById("autocomplete-list");
    if (!query || query.length < 2) {
        list.style.display = "none";
        list.innerHTML = "";
        return;
    }

    clearTimeout(nomTimeout);
    nomTimeout = setTimeout(async function() {
        try {
            const q = encodeURIComponent(query);
            let viewbox = "";
            var b = map.getBounds();
            if (b) {
                viewbox = "&viewbox=" + b.getWest() + "," + b.getNorth() + "," + b.getEast() + "," + b.getSouth();
            }
            const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&q=" + q + "&addressdetails=1&limit=6" + viewbox;
            const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
            if (!resp.ok) throw new Error("Nominatim search failed");
            const results = await resp.json();
            renderAutocomplete(results);
        } catch (err) {
            console.error("Nominatim error", err);
            showStatus("Search failed. Try again later.", "error");
        }
    }, 300);
}

function renderAutocomplete(results) {
    const list = document.getElementById("autocomplete-list");
    list.innerHTML = "";
    if (!results || results.length === 0) {
        list.style.display = "none";
        return;
    }

    results.forEach(function(item) {
        const div = document.createElement("div");
        div.className = "autocomplete-item";
        div.innerHTML = "<strong>" + item.display_name + "</strong>";
        div.onclick = function() {
            document.getElementById("search-input").value = item.display_name;
            list.style.display = "none";
            setDestination({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), label: item.display_name });
        };
        list.appendChild(div);
    });

    list.style.display = "block";
}

function setDestination(dest) {
    if (!dest || !dest.lat || !dest.lng) {
        showStatus("Invalid destination selected", "error");
        return;
    }

    if (destMarker) map.removeLayer(destMarker);
    const iconHtml = '<div style="width:28px;height:28px;border-radius:6px;background:#f39c12;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2)"></div>';
    const destIcon = L.divIcon({ html: iconHtml, className: "" });
    destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map).bindTooltip(dest.label || "Destination", {permanent: false});
    map.panTo([dest.lat, dest.lng]);

    if (!userLocation) {
        showStatus("User location unknown; cannot compute route", "error");
        return;
    }

    generateRouteOSRM(userLocation, { lat: dest.lat, lng: dest.lng });
}

// OSRM Route function - Using public OSRM API (no API key required)
async function generateRouteOSRM(origin, dest) {
    clearRoutes();
    showStatus("Calculating route...", "loading");
    
    const routePanel = document.getElementById("route-panel");
    if (routePanel) routePanel.style.display = "block";

    // OSRM public API endpoint
    const url = "https://router.project-osrm.org/route/v1/driving/" + 
                origin.lng + "," + origin.lat + ";" + 
                dest.lng + "," + dest.lat + 
                "?overview=full&geometries=geojson";

    try {
        const resp = await fetch(url);

        if (!resp.ok) {
            const text = await resp.text();
            console.error("OSRM API Error:", resp.status, text);
            showStatus("Unable to calculate route. Please try again.", "error");
            const container = document.getElementById("routes-container");
            if (container) container.innerHTML = '<p style="color:#c62828;text-align:center;">Unable to calculate route.<br><small>Please try again</small></p>';
            return;
        }

        const data = await resp.json();
        
        if (!data || data.code !== "Ok" || !data.routes || data.routes.length === 0) {
            showStatus("No routes found", "error");
            const container = document.getElementById("routes-container");
            if (container) container.innerHTML = '<p style="color:#c62828;text-align:center;">No routes available</p>';
            return;
        }

        // Get the first (best) route
        const route = data.routes[0];
        
        // Extract distance (in meters) and duration (in seconds)
        const distanceMeters = route.distance;
        const durationSeconds = route.duration;
        
        // Convert to km and minutes
        const distanceKm = (distanceMeters / 1000).toFixed(1);
        const durationMin = Math.round(durationSeconds / 60);
        
        // Draw route polyline using OSRM geometry
        if (route.geometry && route.geometry.coordinates) {
            const coords = route.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
            const poly = L.polyline(coords, { color: "#007bff", weight: 6, opacity: 0.95 }).addTo(map);
            routeLayers.push(poly);
            
            // Fit bounds
            try {
                map.fitBounds(poly.getBounds(), { padding: [50, 50] });
            } catch (err) { console.warn(err); }
        }
        
        // Show route info in the panel
        const container = document.getElementById("routes-container");
        if (container) {
            container.innerHTML = 
                '<div class="route-card selected">' +
                '<div class="route-header"><span class="route-type">Route</span><span class="route-duration">' + durationMin + ' min</span></div>' +
                '<div class="route-details"><span>Distance: ' + distanceKm + ' km</span><span>ETA: ' + durationMin + ' min</span></div>' +
                '<div style="margin-top:10px;"><a href="https://www.google.com/maps/dir/?api=1&origin=' + origin.lat + ',' + origin.lng + '&destination=' + dest.lat + ',' + dest.lng + '" target="_blank" style="display:inline-block;padding:8px 16px;background:#4285f4;color:white;text-decoration:none;border-radius:6px;text-align:center;width:100%;box-sizing:border-box;">Open in Google Maps</a></div>' +
                '</div>';
        }
        
        showStatus("Route: " + distanceKm + " km - ETA " + durationMin + " min", "success");
        
    } catch (err) {
        console.error("OSRM routing error", err);
        showStatus("Unable to calculate route. Please try again.", "error");
        const container = document.getElementById("routes-container");
        if (container) container.innerHTML = '<p style="color:#c62828;text-align:center;">Unable to calculate route.<br><small>Please try again</small></p>';
    }
}

function clearRoutes() {
    routeLayers.forEach(function(l) { map.removeLayer(l); });
    routeLayers = [];
    currentRoutes = [];
    const container = document.getElementById("routes-container");
    if (container) container.innerHTML = "";
    const routePanel = document.getElementById("route-panel");
    if (routePanel) routePanel.style.display = "none";
    if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
}

async function fetchStations(lat, lng, radius) {
    if (radius === undefined) radius = 5000;
    try {
        showStatus("Loading charging stations...", "loading");
        const resp = await fetch(STATION_API + "?lat=" + lat + "&lng=" + lng + "&radius=" + radius);
        if (!resp.ok) throw new Error("Stations API error: " + resp.status);
        const data = await resp.json();
        const stations = data.stations || [];
        renderStations(stations);
        showStatus("Loaded " + stations.length + " stations", "success");
    } catch (err) {
        console.error("Stations fetch error", err);
        showStatus("Failed loading stations. Please try again.", "error");
        renderStations([]);
    }
}

function renderStations(stations) {
    stationMarkers.forEach(function(m) { map.removeLayer(m); });
    stationMarkers = [];

    // Show all stations without filtering
    stations.forEach(function(s) {
        const color = s.type === "fast" ? "#e74c3c" : s.type === "standard" ? "#f39c12" : "#3498db";
        const el = L.divIcon({
            className: "",
            html: '<div style="width:28px;height:28px;border-radius:14px;background:' + color + ';border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">⚡</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 28]
        });
        const marker = L.marker([s.lat, s.lng], { icon: el }).addTo(map);
        marker.on("click", function() {
            const dist = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng).toFixed(1) + " km" : "N/A";
            const html = '<div style="max-width:260px;font-family:inherit"><h4 style="margin:0 0 6px 0;color:#333">' + s.name + '</h4><div style="color:#666;font-size:13px">' + (s.address || "") + '</div><div style="color:#666;font-size:13px;margin-top:8px"><strong>Type:</strong> ' + (s.type || "standard").toUpperCase() + '</div><div style="margin-top:8px;color:#666;font-size:13px"><strong>Distance:</strong> ' + dist + '</div><div style="margin-top:8px;"><button onclick="routeToStation(' + s.lat + ', ' + s.lng + ')" style="width:100%;padding:8px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;">Get Directions</button></div></div>';
            marker.bindPopup(html).openPopup();
        });
        stationMarkers.push(marker);
    });

    const container = document.getElementById("stations-container");
    if (container) {
        container.innerHTML = "";
        if (stations.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#888">No stations found</p>';
            return;
        }
        stations.slice(0, 12).forEach(function(s) {
            const dist = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng).toFixed(1) + " km" : "N/A";
            const card = document.createElement("div");
            card.className = "station-card";
            card.innerHTML = '<div class="station-header"><h4>' + s.name + '</h4><span class="station-type ' + (s.type || "standard") + '">' + (s.type || "standard").toUpperCase() + '</span></div><div class="station-address">' + (s.address || "") + '</div><div class="station-info"><span><strong>Operator:</strong> ' + (s.operator || "N/A") + '</span><span><strong>Distance:</strong> ' + dist + '</span></div><button onclick="centerOnStation(' + s.lat + ', ' + s.lng + ')">View on Map</button><button onclick="routeToStation(' + s.lat + ', ' + s.lng + ')">Get Directions</button>';
            container.appendChild(card);
        });
    }
}

function routeToStation(lat, lng) {
    if (!userLocation) { showStatus("User location unavailable", "error"); return; }
    generateRouteOSRM(userLocation, { lat: lat, lng: lng });
}

function centerOnStation(lat, lng) { map.flyTo([lat, lng], 15); }

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function setupControls() {
    const input = document.getElementById("search-input");
    if (input) {
        input.addEventListener("input", function(e) { searchNominatim(e.target.value); });
        input.addEventListener("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); var val = e.target.value; searchNominatim(val); }});
    }

    document.addEventListener("click", function(ev) {
        const list = document.getElementById("autocomplete-list");
        if (list && !ev.target.closest("#search-input")) list.style.display = "none";
    });

    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
        recenterBtn.addEventListener("click", function() {
            if (userLocation) map.flyTo([userLocation.lat, userLocation.lng], 13);
        });
    }

    const clearBtn = document.getElementById("clear-route-btn");
    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            clearRoutes();
            showStatus("Route cleared", "success");
        });
    }

}

document.addEventListener("DOMContentLoaded", function() { initMap(); });
