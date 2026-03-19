/**
 * EV Battery Simulation - BULLETPROOF FIX 
 * Working on ALL pages, realistic physics
 */
let state = {
  speed: 0,
  rpm: 0,
  distance: 0,
  battery: 100,
  pedal: 50,
  braking: false,
  maxSpeed: 160
};

let simulationInterval = null;
let canvas, ctx;

function initCanvas(){
  canvas = document.getElementById("clusterCanvas");
  if(canvas){
    ctx = canvas.getContext("2d");
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
  state.distance = 0;
  state.pedal = 50;
  state.braking = false;
  state.rpm = 0;
  state.battery = predictionData.battery || 100;
  state.maxSpeed = 160;
  
  // Show container if hidden
  const container = document.getElementById('simulation-container');
  if (container) container.style.display = 'block';
  
  setupControls();
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(simulationLoop, 100);
  // Logs cleaned
}

function setupControls() {
  // Accelerator slider - FIXED per spec
  const slider = document.getElementById('pedal-slider');
  if (slider) {
    slider.style.overflow = "hidden"; // VISUAL LOCK MANDATORY
    
    // Initial thumb position & proper positioning
    const thumb = slider.querySelector('.slider-thumb');
    if (thumb) {
      thumb.style.transition = 'all 0.2s ease';
      thumb.style.position = 'absolute';
      thumb.style.left = '50%';
      thumb.style.transform = 'translateX(-50%)';
      thumb.style.top = '50%'; // middle initial position
      
      thumb.addEventListener("pointerdown", (e) => {
        isDragging = true;
        thumb.setPointerCapture(e.pointerId);
      });

      thumb.addEventListener("pointerup", () => {
        isDragging = false;
      });

      slider.addEventListener("pointermove", (e) => {
        if(!isDragging) return;

        const rect = slider.getBoundingClientRect();

        let y = e.clientY - rect.top;

        // SMOOTH LIMITS
        y = Math.max(10, Math.min(rect.height - 10, y));

        // MOVE
        thumb.style.top = y + "px";
        thumb.style.left = "50%";

        // PEDAL VALUE
        state.pedal = 100 - (y / rect.height) * 100;
        
        updatePedalIndicator();
      });
    }
    
    // Ensure slider contains thumb
    slider.style.position = 'relative';
    slider.style.overflow = 'hidden';
    

  }
  
  // Brake button
  const brakeBtn = document.getElementById('brake-button');
  if (brakeBtn) {
    brakeBtn.onclick = () => {
      state.braking = !state.braking;
    };
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
    if(state.braking){
        state.speed -= 2;
    }
    else if(state.pedal > 60){
        state.speed += 0.5;
    }
    else if(state.pedal < 40){
        state.speed -= 0.5;
    }
    else{
        // coasting
        state.speed -= 0.05;
    }

    if(state.speed < 0) state.speed = 0;
    if(state.speed > state.maxSpeed) state.speed = state.maxSpeed;

    const deltaTime = 0.1; // 100ms loop
    state.distance += (state.speed * deltaTime) / 3600;

    state.rpm = Math.max(0, state.speed * 40);
}

function updateUI() {
  document.getElementById('distance-value') && (document.getElementById('distance-value').textContent = state.distance.toFixed(2));
  document.getElementById('current-speed') && (document.getElementById('current-speed').textContent = Math.round(state.speed));
  document.getElementById('distance-travelled') && (document.getElementById('distance-travelled').textContent = state.distance.toFixed(2));
}

function simulationLoop() {
  updatePhysics();
  drawCluster(state.speed, state.rpm);
  updateUI();
}

// EXPORTS
window.initSimulation = initSimulation;
window.state = state;

function drawCluster(speed, rpm){
  if(!ctx) return;

  ctx.clearRect(0,0,600,300);

  // LEFT RPM CIRCLE
  ctx.beginPath();
  ctx.arc(150,150,100,0,Math.PI*2);
  ctx.strokeStyle = "#ff2d75";
  ctx.lineWidth = 10;
  ctx.stroke();

  // RPM NEEDLE
  let rpmAngle = (rpm / 8000) * 270 - 135;
  let rx = 150 + 80 * Math.cos(rpmAngle * Math.PI/180);
  let ry = 150 + 80 * Math.sin(rpmAngle * Math.PI/180);

  ctx.beginPath();
  ctx.moveTo(150,150);
  ctx.lineTo(rx,ry);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.stroke();

  // RIGHT SPEED CIRCLE
  ctx.beginPath();
  ctx.arc(450,150,100,0,Math.PI*2);
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 10;
  ctx.stroke();

  // SPEED NEEDLE
  let spAngle = (speed / 160) * 270 - 135;
  let sx = 450 + 80 * Math.cos(spAngle * Math.PI/180);
  let sy = 150 + 80 * Math.sin(spAngle * Math.PI/180);

  ctx.beginPath();
  ctx.moveTo(450,150);
  ctx.lineTo(sx,sy);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.stroke();

  // DIGITAL SPEED
  ctx.fillStyle = "#00ff88";
  ctx.font = "30px Arial";
  ctx.fillText(Math.floor(speed), 420, 170);

  // DIGITAL RPM
  ctx.fillStyle = "#ff2d75";
  ctx.fillText(Math.floor(rpm), 120, 170);

  drawNumbers();
}

function drawNumbers(){
  if(!ctx) return;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "14px Arial";

  // SPEED (RIGHT)
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#00ff88";
  ctx.shadowColor = "#00ff88";

  for(let i=0; i<=160; i+=20){
      let angle = (i/160)*270 - 135;
      let x = 450 + 75 * Math.cos(angle*Math.PI/180);
      let y = 150 + 75 * Math.sin(angle*Math.PI/180);
      ctx.fillText(i, x, y);
  }

  // RPM (LEFT)
  ctx.fillStyle = "#ff2d75";
  ctx.shadowColor = "#ff2d75";

  for(let i=0; i<=8000; i+=1000){
      let angle = (i/8000)*270 - 135;
      let x = 150 + 75 * Math.cos(angle*Math.PI/180);
      let y = 150 + 75 * Math.sin(angle*Math.PI/180);
      ctx.fillText(i/1000, x, y);
  }

  ctx.shadowBlur = 0;
}

console.log('✅ BULLETPROOF EV SIMULATION LOADED');

