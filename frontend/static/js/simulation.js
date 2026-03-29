console.log("✅ NEW GAUGE JS LOADED - FIXED VERSION");

// 🔥 CAR CONFIG - Speed limit based on selected car
// Ensure carData available
window.carData = window.carData || {topSpeed: 160, maxRPM: 8000, accel: 50};

const CAR = {
    maxSpeed: window.carData.topSpeed || 160
};

const state = {
    speed: 0,
    rpm: 0,
    battery: 80,
    tripDistance: 0,
    odometerDistance: 0,
    maxSpeed: CAR.maxSpeed,
    maxRPM: window.carData.maxRPM || 8000,
    isAccelerating: false,
    isBraking: false,
    prevTime: performance.now(),
    loopRunning: false
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

    // ✅ DYNAMIC SCALE BASED ON CAR MAX SPEED
    for (let i = 0; i <= CAR.maxSpeed; i += 20) {
        let angle = (i / CAR.maxSpeed) * 1.5 * Math.PI + 0.75 * Math.PI;

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
        ctx.fillText(Math.round(i), tx, ty);
    }

    // === NEEDLE (SMOOTH) ===
    // ✅ FIX ANGLE: DYNAMIC BASED ON CAR MAX SPEED
    let angle = (speed / CAR.maxSpeed) * 1.5 * Math.PI + 0.75 * Math.PI;

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

    console.log("RENDER RUNNING");

    const speedEl = document.getElementById("currentSpeed");
    const batteryEl = document.getElementById("batteryText");
    const distanceEl = document.getElementById("distanceText");

    if (speedEl) {
        speedEl.textContent = Math.round(state.speed) + " km/h";
        console.log(`📊 Current speed text updated to: ${Math.round(state.speed)} km/h`);
    } else {
        console.log("❌ currentSpeed NOT FOUND");
    }

    if (batteryEl) {
        batteryEl.textContent = state.battery.toFixed(1) + " %";
    } else {
        console.log("❌ batteryText NOT FOUND");
    }

    if (distanceEl) {
        distanceEl.textContent = state.tripDistance.toFixed(2) + " km";
    } else {
        console.log("❌ distanceText NOT FOUND");
    }
}

function updateCluster() {
    const speedCanvas = document.getElementById("speedCanvas");
    const rpmCanvas = document.getElementById("rpmCanvas");
    
    if (!speedCanvas || !rpmCanvas) {
        console.warn("Canvases not found - waiting for DOM");
        return;
    }
    
    const speedCtx = speedCanvas.getContext("2d");
    const rpmCtx = rpmCanvas.getContext("2d");

    console.log(`Updating gauges - Speed: ${Math.round(state.speed)} km/h, RPM: ${Math.round(state.rpm)}`);
    
    drawSpeedometer(speedCtx, state.speed);
    drawRPM(rpmCtx, state.rpm);
}


function updatePhysics(dt) {
    // 🚀 ACCELERATION
    if (state.isAccelerating) {
        const accel = (window.currentCar?.accel || window.carData?.accel || 50);
        state.speed += accel * dt;
        state.battery -= 0.02 * dt;
    }

    // 🛑 BRAKE
    if (state.isBraking) {
        state.speed -= 40 * dt;
        state.battery += 0.01 * dt;
    } else {
        // 🌀 NATURAL DRAG
        state.speed *= 0.995;
    }

    // 🚫 LIMIT SPEED
    if (state.speed > state.maxSpeed) {
        state.speed = state.maxSpeed;
    }
    if (state.speed < 0) state.speed = 0;

    // ✅ MAIN LOGIC (distance = speed × time)
    state.tripDistance += state.speed * dt / 3600;
    state.odometerDistance += state.speed * dt / 3600;

    // 🔋 BATTERY CLAMP
    state.battery = Math.max(0, Math.min(100, state.battery));

    // RPM
    state.rpm = (state.speed / state.maxSpeed) * state.maxRPM;
}

function loop() {
    console.log("LOOP RUNNING - Speed:", state.speed);

    const now = performance.now();
    const dt = (now - state.prevTime) / 1000;
    state.prevTime = now;

    updatePhysics(dt);

    state.speed = Math.max(0, Math.min(state.maxSpeed, state.speed));
    state.battery = Math.max(0, Math.min(100, state.battery));

    updateCluster();
    render();

    requestAnimationFrame(loop);
}



function initSimulation(config) {
    if (config.battery !== undefined) {
        state.battery = config.battery;
    }
    state.speed = 0;
    state.tripDistance = 0;
    state.prevTime = performance.now();

    const container = document.getElementById("simulation-container");
    if (container) {
        container.style.display = "block";
    }

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

    // ⌨️ KEYBOARD CONTROLS for easy testing
    const keys = {};
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        if (e.key === 'w' || e.key === 'ArrowUp') state.isAccelerating = true;
        if (e.key === 's' || e.key === 'ArrowDown') state.isBraking = true;
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
        if (e.key === 'w' || e.key === 'ArrowUp') state.isAccelerating = false;
        if (e.key === 's' || e.key === 'ArrowDown') state.isBraking = false;
    });

    console.log("✅ Simulation initialized - pedals active, physics ready");

    if (!state.loopRunning) {
        state.loopRunning = true;
        requestAnimationFrame(loop);
    }
}

state.loopRunning = false;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSimulation);
} else {
    initSimulation({battery: 100});
}
