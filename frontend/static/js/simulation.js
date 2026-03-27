console.log("✅ NEW GAUGE JS LOADED - FIXED VERSION");

const state = {
    speed: 0,
    rpm: 0,
    battery: 80,
    tripDistance: 0,
    odometerDistance: 0,
    maxSpeed: window.carData?.topSpeed || 160,
    maxRPM: window.carData?.maxRPM || 8000,
    isAccelerating: false,
    isBraking: false,
    prevTime: performance.now()
};




function drawSpeedometer(ctx, speed) {
    const cx = 150;
    const cy = 150;
    const r = 120;

    ctx.clearRect(0, 0, 300, 300);

    // === BACKGROUND GLOW ARC ===
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 10;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#00ff88";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // === INNER DARK CIRCLE (GLASS EFFECT) ===
    ctx.beginPath();
    ctx.arc(cx, cy, r - 30, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();

    // === TICKS + NUMBERS ===
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Orbitron";
    ctx.textAlign = "center";

    for (let i = 0; i <= 200; i += 20) {
        let angle = (i / 200) * 1.5 * Math.PI + 0.75 * Math.PI;

        let x1 = cx + Math.cos(angle) * (r - 10);
        let y1 = cy + Math.sin(angle) * (r - 10);

        let x2 = cx + Math.cos(angle) * (r - 25);
        let y2 = cy + Math.sin(angle) * (r - 25);

        // tick line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 2;
        ctx.stroke();

        // number
        let tx = cx + Math.cos(angle) * (r - 45);
        let ty = cy + Math.sin(angle) * (r - 45);
        ctx.fillText(i, tx, ty);
    }

    // === NEEDLE (SMOOTH) ===
    let angle = (speed / 200) * 1.5 * Math.PI + 0.75 * Math.PI;

    let nx = cx + Math.cos(angle) * (r - 50);
    let ny = cy + Math.sin(angle) * (r - 50);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00ff88";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // === CENTER VALUE ===
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 28px Orbitron";
    ctx.fillText(Math.round(speed), cx, cy);

    ctx.font = "12px Orbitron";
    ctx.fillText("km/h", cx, cy + 20);
}

function drawRPM(ctx, rpm) {
    const cx = 150;
    const cy = 150;
    const r = 120;

    ctx.clearRect(0, 0, 300, 300);

    // === GLOW ARC ===
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = "#ff2d75";
    ctx.lineWidth = 10;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#ff2d75";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // === INNER GLASS ===
    ctx.beginPath();
    ctx.arc(cx, cy, r - 30, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();

    // === TICKS + NUMBERS ===
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Orbitron";
    ctx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        let angle = (i / 10) * 1.5 * Math.PI + 0.75 * Math.PI;

        let x1 = cx + Math.cos(angle) * (r - 10);
        let y1 = cy + Math.sin(angle) * (r - 10);

        let x2 = cx + Math.cos(angle) * (r - 25);
        let y2 = cy + Math.sin(angle) * (r - 25);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "#ff2d75";
        ctx.lineWidth = 2;
        ctx.stroke();

        let tx = cx + Math.cos(angle) * (r - 45);
        let ty = cy + Math.sin(angle) * (r - 45);
        ctx.fillText(i, tx, ty);
    }

    // === NEEDLE ===
    let angle = (rpm / 10000) * 1.5 * Math.PI + 0.75 * Math.PI;

    let nx = cx + Math.cos(angle) * (r - 50);
    let ny = cy + Math.sin(angle) * (r - 50);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = "#ff2d75";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff2d75";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // === CENTER VALUE ===
    ctx.fillStyle = "#ff2d75";
    ctx.font = "bold 28px Orbitron";
    ctx.fillText((rpm / 1000).toFixed(1), cx, cy);

    ctx.font = "12px Orbitron";
    ctx.fillText("RPM x1000", cx, cy + 20);
}

function render() {
    // Update text displays
    const batteryEl = document.getElementById("batteryText");
    const distanceEl = document.getElementById("distanceText");

    if (batteryEl) {
        batteryEl.innerText = Math.round(state.battery) + "%";
    }
    if (distanceEl) {
        distanceEl.innerText = state.tripDistance.toFixed(1) + " km";
    }
}

function updateCluster() {
    const speedCtx = document.getElementById("speedCanvas")?.getContext("2d");
    const rpmCtx = document.getElementById("rpmCanvas")?.getContext("2d");

    if (speedCtx) drawSpeedometer(speedCtx, state.speed);
    if (rpmCtx) drawRPM(rpmCtx, state.rpm);
}


function loop() {
    const now = performance.now();
    const dt = (now - state.prevTime) / 1000; // seconds
    state.prevTime = now;

    // Physics updates
    if (state.isAccelerating) {
        state.speed += 50 * dt; // accel rate km/h/s
        state.battery -= 10 * dt / 60; // 10% per min
    } else if (state.isBraking) {
        state.speed -= 60 * dt; // brake rate km/h/s
        state.battery += 3 * dt / 60; // regen 3% per min
    } else {
        // coasting decay
        state.speed *= Math.pow(0.95, dt * 5); // gradual slow down
    }

    // clamps
    state.speed = Math.max(0, Math.min(state.maxSpeed, state.speed));
    state.battery = Math.max(0, Math.min(100, state.battery));
    state.rpm = (state.speed / state.maxSpeed) * state.maxRPM;

    // distance update (speed km/h * hours)
    const deltaDistance = state.speed * dt / 3600;
    state.tripDistance += deltaDistance;
    state.odometerDistance += deltaDistance;

    updateCluster();
    render();

    requestAnimationFrame(loop);
}

// initSimulation - called from HTML
function initSimulation(config) {
    if (config.battery !== undefined) {
        state.battery = config.battery;
    }
    state.speed = 0;
    state.tripDistance = 0;
    state.prevTime = performance.now();

    // Show container
    const container = document.getElementById("simulation-container");
    if (container) {
        container.style.display = "block";
    }

    // Pedal event listeners
    const accelPedal = document.querySelector(".pedal.accel");
    const brakePedal = document.querySelector(".pedal.brake");

    function setAccelerating(active) {
        state.isAccelerating = active;
    }
    function setBraking(active) {
        state.isBraking = active;
    }

    if (accelPedal) {
        accelPedal.addEventListener("mousedown", () => setAccelerating(true));
        accelPedal.addEventListener("mouseup", () => setAccelerating(false));
        accelPedal.addEventListener("touchstart", (e) => { e.preventDefault(); setAccelerating(true); });
        accelPedal.addEventListener("touchend", () => setAccelerating(false));
    }

    if (brakePedal) {
        brakePedal.addEventListener("mousedown", () => setBraking(true));
        brakePedal.addEventListener("mouseup", () => setBraking(false));
        brakePedal.addEventListener("touchstart", (e) => { e.preventDefault(); setBraking(true); });
        brakePedal.addEventListener("touchend", () => setBraking(false));
    }

    console.log("✅ Simulation initialized - pedals active, physics ready");

    // Start loop if not running
    if (!state.loopRunning) {
        state.loopRunning = true;
        requestAnimationFrame(loop);
    }
}

// Prevent multiple loops
state.loopRunning = false;

// Auto-start only if pedals ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSimulation);
} else {
    initSimulation({battery: 100});
}

