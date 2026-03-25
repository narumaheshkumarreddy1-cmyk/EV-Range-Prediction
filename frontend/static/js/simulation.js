/**
 * EV Battery Simulation - BULLETPROOF FIX 
 * Working on ALL pages, realistic physics
 */
const carModels = {
  'Tesla Model S': { maxSpeed: 250, maxRpm: 16000 },
  'Nissan Leaf': { maxSpeed: 160, maxRpm: 10000 },
  'BMW i5': { maxSpeed: 240, maxRpm: 14000 },
  'Audi e-tron': { maxSpeed: 210, maxRpm: 12000 },
  'Generic EV': { maxSpeed: 200, maxRpm: 12000 }
};

const GAUGE_START_ANGLE = 135; // left-bottom (7-8 o'clock)
const GAUGE_SWEEP_ANGLE = 270; // clockwise to right-bottom (4-5 o'clock)

let state = {
  speed: 0,
  rpm: 0,
  displayedSpeed: 0,
  displayedRpm: 0,
  distance: 0,
  battery: 100,
  accelerating: false,
  braking: false,
  pedal: 0,
  maxSpeed: 200,
  maxRpm: 12000
};

let simulationInterval = null;
let speedCanvas, speedCtx, rpmCanvas, rpmCtx;

function computeGaugeAngle(value, max) {
  const clamped = Math.max(0, Math.min(value, max));
  return GAUGE_START_ANGLE + (clamped / max) * GAUGE_SWEEP_ANGLE;
}

function initCanvas(){
  speedCanvas = document.getElementById("speedCanvas");
  rpmCanvas = document.getElementById("rpmCanvas");

  if (speedCanvas) {
    speedCtx = speedCanvas.getContext("2d");
  }
  if (rpmCanvas) {
    rpmCtx = rpmCanvas.getContext("2d");
  }
}
  let isDragging = false;
// lockedSpeed removed per spec

function initSimulation(predictionData = null) {
  if(!predictionData || Object.keys(predictionData).length === 0){
      console.error("Simulation blocked: no data");
      return;
  }

  console.log('🚗 initSimulation called with data:', predictionData);
  
  if (simulationInterval) clearInterval(simulationInterval);
  
  initCanvas();
  
  // Reset per spec
  state.speed = 0;
  state.rpm = 0;
  state.displayedSpeed = 0;
  state.displayedRpm = 0;
  state.distance = 0;
  state.accelerating = false;
  state.braking = false;
  state.pedal = 0;
  state.battery = predictionData.battery || 100;
  state.maxSpeed = carModels['Generic EV'].maxSpeed;
  state.maxRpm = carModels['Generic EV'].maxRpm;

  // Ensure zero state is immediately rendered and visible
  updateUI();
  drawSpeedGauge(0);
  drawRpmGauge(0);
  
  // Show container if hidden
  const container = document.getElementById('simulation-container');
  if (container) container.style.display = 'block';
  
  setupControls();
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(simulationLoop, 100);
  // Logs cleaned
}

function setupControls() {
  const accelerateBtn = document.getElementById('accelerate-btn');
  const brakeBtn = document.getElementById('brake-btn');
  const carBrand = document.getElementById('car-brand');
  const brandLabel = document.getElementById('brand-label');

  if (carBrand) {
    carBrand.addEventListener('change', () => {
      const model = carBrand.value;
      const config = carModels[model] || carModels['Generic EV'];
      state.maxSpeed = config.maxSpeed;
      state.maxRpm = config.maxRpm;
      if (brandLabel) brandLabel.textContent = `Model: ${model}`;
    });

    // initialize brand
    const initialModel = carBrand.value || 'Generic EV';
    const initialConfig = carModels[initialModel] || carModels['Generic EV'];
    state.maxSpeed = initialConfig.maxSpeed;
    state.maxRpm = initialConfig.maxRpm;
    if (brandLabel) brandLabel.textContent = `Model: ${initialModel}`;
  }

  const activateAccelerator = () => {
    state.accelerating = true;
    state.braking = false;
    state.pedal = 100;
  };

  const deactivateAccelerator = () => {
    state.accelerating = false;
    state.pedal = 0;
  };

  const activateBrake = () => {
    state.braking = true;
    state.accelerating = false;
    state.pedal = 0;
  };

  const deactivateBrake = () => {
    state.braking = false;
    state.pedal = 0;
  };

  if (accelerateBtn) {
    accelerateBtn.addEventListener('mousedown', activateAccelerator);
    accelerateBtn.addEventListener('pointerdown', activateAccelerator);
    accelerateBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      activateAccelerator();
    });
    accelerateBtn.addEventListener('mouseup', deactivateAccelerator);
    accelerateBtn.addEventListener('mouseleave', deactivateAccelerator);
    accelerateBtn.addEventListener('pointerup', deactivateAccelerator);
    accelerateBtn.addEventListener('touchend', deactivateAccelerator);
  }

  if (brakeBtn) {
    brakeBtn.addEventListener('mousedown', activateBrake);
    brakeBtn.addEventListener('pointerdown', activateBrake);
    brakeBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      activateBrake();
    });
    brakeBtn.addEventListener('mouseup', deactivateBrake);
    brakeBtn.addEventListener('mouseleave', deactivateBrake);
    brakeBtn.addEventListener('pointerup', deactivateBrake);
    brakeBtn.addEventListener('touchend', deactivateBrake);
  }
}


function updatePedalIndicator() {
  const indicator = document.getElementById('pedal-indicator');
  if (indicator) {
    if (state.pedal > 60) {
      indicator.textContent = `ACCEL`;
      indicator.style.color = '#22c55e';
      indicator.className = 'accel';
    } else if (state.pedal < 40) {
      indicator.textContent = `DECEL`;
      indicator.style.color = '#ef4444';
      indicator.className = 'brake';
    } else {
      indicator.textContent = 'COAST';
      indicator.style.color = '#f59e0b';
      indicator.className = 'neutral';
    }
  }
}

function updatePhysics(){
    if (state.braking) {
        state.speed -= 12;
    } else if (state.accelerating) {
        state.speed += 2.4;
    } else {
        // coasting slowdown
        state.speed -= 0.3;
    }

    if (state.speed < 0) state.speed = 0;
    if (state.speed > state.maxSpeed) state.speed = state.maxSpeed;

    const deltaTime = 0.1; // 100ms loop
    state.distance += (state.speed * deltaTime) / 3600;

    state.rpm = Math.max(0, Math.round((state.speed / state.maxSpeed) * state.maxRpm));

    // battery drain simulation
    let drain = (state.speed / state.maxSpeed) * 0.05 + (state.pedal / 100) * 0.015;
    if(state.braking){
      drain = Math.max(drain * 0.5, 0.01);
    }

    state.battery = Math.max(0, state.battery - drain);
}

function updateUI() {
  const distanceValue = document.getElementById('distance-value');
  const currentSpeedValue = document.getElementById('current-speed');
  const distanceTravelledValue = document.getElementById('distanceTravelled');
  const batteryText = document.getElementById('battery-text');
  const carBrandText = document.getElementById('brand-label');
  const acceleratorValue = document.getElementById('accelerator-value');
  const brakeValue = document.getElementById('brake-value');

  if (distanceValue) distanceValue.textContent = state.distance.toFixed(2);
  if (currentSpeedValue) currentSpeedValue.textContent = Math.round(state.speed);
  if (distanceTravelledValue) distanceTravelledValue.textContent = state.distance.toFixed(2);
  if (batteryText) batteryText.textContent = `${Math.max(0, state.battery.toFixed(0))}%`;
  const brandElement = document.getElementById('car-brand');
  if (carBrandText) {
    carBrandText.textContent = brandElement ? `Model: ${brandElement.value}` : 'Model: Generic EV';
  }

  if (acceleratorValue) acceleratorValue.textContent = state.accelerating ? 'Acc: Pressed' : 'Acc: Release';
  if (brakeValue) brakeValue.textContent = state.braking ? 'Brake: Active' : 'Brake: Idle';

  const brakePedalImage = document.getElementById('brake-pedal-image');
  const acceleratorPedalImage = document.getElementById('accelerator-pedal-image');


  if (brakePedalImage) {
    brakePedalImage.classList.toggle('pedal-active', state.braking);
  }

  if (acceleratorPedalImage) {
    acceleratorPedalImage.classList.toggle('pedal-active', state.pedal > 60 && !state.braking);
    acceleratorPedalImage.classList.toggle('pedal-coast', state.pedal >= 40 && state.pedal <= 60 && !state.braking);
  }
}

function simulationLoop() {
  updatePhysics();

  // smooth gauge motion (lerp) for realistic behavior
  const smoothing = 0.18;
  state.displayedSpeed += (state.speed - state.displayedSpeed) * smoothing;
  state.displayedRpm += (state.rpm - state.displayedRpm) * smoothing;

  drawSpeedGauge(state.displayedSpeed);
  drawRpmGauge(state.displayedRpm);
  updateUI();
}

// EXPORTS
window.initSimulation = initSimulation;
window.state = state;

function drawSpeedGauge(speed) {
  if (!speedCtx) return;
  const w = speedCanvas.width;
  const h = speedCanvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = 105;

  speedCtx.clearRect(0, 0, w, h);

  // glow outer ring
  speedCtx.beginPath();
  speedCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  speedCtx.strokeStyle = 'rgba(34, 255, 160, 0.35)';
  speedCtx.lineWidth = 8;
  speedCtx.shadowBlur = 24;
  speedCtx.shadowColor = '#00ff90';
  speedCtx.stroke();
  speedCtx.shadowBlur = 0;

  // inner background
  speedCtx.beginPath();
  speedCtx.arc(centerX, centerY, radius - 12, 0, Math.PI * 2);
  speedCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  speedCtx.fill();

  const maxSpeed = state.maxSpeed;

  // colored speed zones (green/yellow/red)
  const zoneOuter = radius - 9;
  const zoneInner = radius - 17;
  const zoneRanges = [
    { from: 0, to: maxSpeed * 0.4, color: 'rgba(46, 255, 133, 0.7)' },
    { from: maxSpeed * 0.4, to: maxSpeed * 0.7, color: 'rgba(255, 205, 73, 0.7)' },
    { from: maxSpeed * 0.7, to: maxSpeed, color: 'rgba(255, 72, 102, 0.7)' }
  ];

  // ensure needle position is zero-based when speed is 0
  if (speed === 0) {
    state.speed = 0;
    state.rpm = 0;
  }

  zoneRanges.forEach(({ from, to, color }) => {
    const start = computeGaugeAngle(from, maxSpeed);
    const end = computeGaugeAngle(to, maxSpeed);
    speedCtx.beginPath();
    speedCtx.arc(centerX, centerY, (zoneOuter + zoneInner) / 2, start * Math.PI / 180, end * Math.PI / 180);
    speedCtx.strokeStyle = color;
    speedCtx.lineWidth = zoneOuter - zoneInner;
    speedCtx.lineCap = 'round';
    speedCtx.stroke();
  });

  // tick marks
  for (let sp = 0; sp <= maxSpeed; sp += maxSpeed / 10) {
    const angle = computeGaugeAngle(sp, maxSpeed);
    const rad = angle * Math.PI / 180;
    const inR = radius - 20;
    const outR = radius - 7;

    const x1 = centerX + inR * Math.cos(rad);
    const y1 = centerY + inR * Math.sin(rad);
    const x2 = centerX + outR * Math.cos(rad);
    const y2 = centerY + outR * Math.sin(rad);
    speedCtx.beginPath();
    speedCtx.moveTo(x1, y1);
    speedCtx.lineTo(x2, y2);
    speedCtx.strokeStyle = sp % 40 === 0 ? '#00ffca' : 'rgba(152,255,215,0.8)';
    speedCtx.lineWidth = sp % 40 === 0 ? 3 : 1;
    speedCtx.stroke();

    if (sp % 40 === 0) {
      speedCtx.fillStyle = '#aff';
      speedCtx.font = '13px Inter, Arial';
      const labelR = radius - 35;
      const lx = centerX + labelR * Math.cos(rad);
      const ly = centerY + labelR * Math.sin(rad);
      speedCtx.fillText(sp.toString(), lx, ly);
    }
  }

  // needle
  const needleAngle = computeGaugeAngle(speed, maxSpeed);
  const needleRad = needleAngle * Math.PI / 180;
  const nx = centerX + (radius - 38) * Math.cos(needleRad);
  const ny = centerY + (radius - 38) * Math.sin(needleRad);

  speedCtx.beginPath();
  speedCtx.moveTo(centerX, centerY);
  speedCtx.lineTo(nx, ny);
  speedCtx.strokeStyle = 'rgba(8, 255, 155, 0.95)';
  speedCtx.lineWidth = 4;
  speedCtx.shadowColor = '#29f9ff';
  speedCtx.shadowBlur = 18;
  speedCtx.stroke();
  speedCtx.shadowBlur = 0;

  // centre dot
  speedCtx.beginPath();
  speedCtx.arc(centerX, centerY, 8, 0, Math.PI * 2);
  speedCtx.fillStyle = '#19ffd8';
  speedCtx.fill();

  // digital speed text
  speedCtx.fillStyle = '#a4ffdc';
  speedCtx.font = 'bold 24px Inter, Arial';
  speedCtx.textAlign = 'center';
  speedCtx.fillText(`${Math.round(speed)} km/h`, centerX, centerY + 80);

  // small decorative indicator text (visual style with professional cluster)
  speedCtx.fillStyle = 'rgba(176, 255, 230, 0.75)';
  speedCtx.font = '11px Inter, Arial';
  speedCtx.fillText('DRIVING', centerX, centerY - 70);
}

function drawRpmGauge(rpm) {
  if (!rpmCtx) return;

  const w = rpmCanvas.width;
  const h = rpmCanvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = 105;

  rpmCtx.clearRect(0, 0, w, h);

  rpmCtx.beginPath();
  rpmCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  rpmCtx.strokeStyle = 'rgba(38, 153, 255, 0.32)';
  rpmCtx.lineWidth = 8;
  rpmCtx.shadowBlur = 22;
  rpmCtx.shadowColor = '#3cd6ff';
  rpmCtx.stroke();
  rpmCtx.shadowBlur = 0;

  rpmCtx.beginPath();
  rpmCtx.arc(centerX, centerY, radius - 12, 0, Math.PI * 2);
  rpmCtx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  rpmCtx.fill();

  const maxRpm = state.maxRpm;
  const rpmZones = [
    { from: 0, to: maxRpm * 0.35, color: 'rgba(46, 255, 133, 0.7)' },
    { from: maxRpm * 0.35, to: maxRpm * 0.75, color: 'rgba(255, 205, 73, 0.7)' },
    { from: maxRpm * 0.75, to: maxRpm, color: 'rgba(255, 72, 102, 0.7)' }
  ];

  rpmZones.forEach(({ from, to, color }) => {
    const start = computeGaugeAngle(from, maxRpm);
    const end = computeGaugeAngle(to, maxRpm);
    rpmCtx.beginPath();
    rpmCtx.arc(centerX, centerY, radius - 9.5, start * Math.PI / 180, end * Math.PI / 180);
    rpmCtx.strokeStyle = color;
    rpmCtx.lineWidth = 7;
    rpmCtx.lineCap = 'round';
    rpmCtx.stroke();
  });

  for (let r = 0; r <= maxRpm; r += maxRpm / 12) {
    const angle = computeGaugeAngle(r, maxRpm);
    const rad = angle * Math.PI / 180;
    const inR = radius - 22;
    const outR = radius - 7;
    const x1 = centerX + inR * Math.cos(rad);
    const y1 = centerY + inR * Math.sin(rad);
    const x2 = centerX + outR * Math.cos(rad);
    const y2 = centerY + outR * Math.sin(rad);

    rpmCtx.beginPath();
    rpmCtx.moveTo(x1, y1);
    rpmCtx.lineTo(x2, y2);
    rpmCtx.strokeStyle = r % 2000 === 0 ? '#00ffcc' : 'rgba(204, 255, 255, 0.84)';
    rpmCtx.lineWidth = r % 2000 === 0 ? 3 : 1;
    rpmCtx.stroke();

    if (r % 3000 === 0) {
      rpmCtx.fillStyle = '#b6f1ff';
      rpmCtx.font = '13px Inter, Arial';
      const labelR = radius - 35;
      const lx = centerX + labelR * Math.cos(rad);
      const ly = centerY + labelR * Math.sin(rad);
      rpmCtx.fillText((r / 1000).toString(), lx, ly);
    }
  }

  const needleAngle = computeGaugeAngle(rpm, maxRpm);
  const needleRad = needleAngle * Math.PI / 180;
  const nx = centerX + (radius - 40) * Math.cos(needleRad);
  const ny = centerY + (radius - 40) * Math.sin(needleRad);

  rpmCtx.beginPath();
  rpmCtx.moveTo(centerX, centerY);
  rpmCtx.lineTo(nx, ny);
  rpmCtx.strokeStyle = '#71f2ff';
  rpmCtx.lineWidth = 4;
  rpmCtx.shadowColor = '#6bcdff';
  rpmCtx.shadowBlur = 18;
  rpmCtx.stroke();
  rpmCtx.shadowBlur = 0;

  rpmCtx.beginPath();
  rpmCtx.arc(centerX, centerY, 8, 0, Math.PI * 2);
  rpmCtx.fillStyle = '#2ef2ff';
  rpmCtx.fill();

  rpmCtx.fillStyle = '#8eeaff';
  rpmCtx.font = 'bold 22px Inter, Arial';
  rpmCtx.textAlign = 'center';
  rpmCtx.fillText(`${Math.round(rpm / 1000)}k RPM`, centerX, centerY + 80);

  rpmCtx.fillStyle = '#55dfff';
  rpmCtx.font = '14px Inter, Arial';
  rpmCtx.fillText('x1000', centerX, centerY + 98);

  // small label for professional dashboard styling
  rpmCtx.fillStyle = 'rgba(176, 255, 230, 0.75)';
  rpmCtx.font = '11px Inter, Arial';
  rpmCtx.fillText('PERFORMANCE', centerX, centerY - 70);
}

console.log('✅ BULLETPROOF EV SIMULATION LOADED');

