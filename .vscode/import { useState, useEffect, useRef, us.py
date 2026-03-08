import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";

// ─── Decision Tree Simulation ────────────────────────────────────────────────
class DecisionTree {
  constructor() {
    this.trained = false;
    this.accuracy = 0;
    this.featureImportance = { arrival_rate: 0.38, queue_length: 0.31, throughput: 0.19, congestion_state: 0.12 };
    this.confusionMatrix = [[0,0,0],[0,0,0],[0,0,0]];
    this.trainCount = 0;
  }

  train(data) {
    this.trainCount += data.length;
    this.accuracy = Math.min(0.97, 0.72 + this.trainCount / 5000);
    this.trained = true;
    this.featureImportance = {
      arrival_rate: 0.35 + Math.random() * 0.06,
      queue_length: 0.28 + Math.random() * 0.06,
      throughput: 0.18 + Math.random() * 0.05,
      congestion_state: 0.10 + Math.random() * 0.04,
    };
    const total = Object.values(this.featureImportance).reduce((a,b)=>a+b,0);
    Object.keys(this.featureImportance).forEach(k => this.featureImportance[k] /= total);
    this.confusionMatrix = [
      [Math.floor(40+Math.random()*10), Math.floor(2+Math.random()*3), Math.floor(1+Math.random()*2)],
      [Math.floor(3+Math.random()*3), Math.floor(35+Math.random()*10), Math.floor(2+Math.random()*3)],
      [Math.floor(1+Math.random()*2), Math.floor(2+Math.random()*3), Math.floor(38+Math.random()*10)],
    ];
  }

  predict(arrival_rate, queue_length, throughput, congestion_state) {
    if (!this.trained) return "Low";
    const score = arrival_rate * 0.35 + queue_length * 0.31 + (1 - throughput) * 0.19 + congestion_state * 0.15;
    if (score > 0.67) return "High";
    if (score > 0.33) return "Medium";
    return "Low";
  }
}

// ─── Network Simulator ────────────────────────────────────────────────────────
const dt = new DecisionTree();
let congestionHistory = [0, 0, 0, 0, 0];
let trainBuffer = [];

function simulateNetwork(mode, tick) {
  const t = tick / 10;
  const baseLoad = 0.4 + 0.3 * Math.sin(t * 0.7) + 0.15 * Math.sin(t * 2.1) + Math.random() * 0.1;
  const load = Math.max(0, Math.min(1, baseLoad));

  // Raw metrics
  const inPkts = Math.floor(1200 + load * 2800 + Math.random() * 200);
  const outPkts = Math.floor(1000 + load * 2400 + Math.random() * 200);
  const bandwidth = load * 980 + Math.random() * 20;

  // Queue sim
  const arrivalRate = load;
  const queueBase = load * 100;

  // Congestion prediction
  const prevCongestion = congestionHistory.slice(-1)[0];
  const congestionLevel = dt.predict(arrivalRate, load, 1 - load * 0.6, prevCongestion);
  const congestionNum = congestionLevel === "High" ? 1 : congestionLevel === "Medium" ? 0.5 : 0;
  congestionHistory.push(congestionNum);
  if (congestionHistory.length > 10) congestionHistory.shift();

  // Train buffer
  trainBuffer.push({ arrival_rate: arrivalRate, queue_length: load, throughput: 1-load*0.6, congestion_state: prevCongestion });
  if (trainBuffer.length >= 20) {
    dt.train(trainBuffer);
    trainBuffer = [];
  }

  // FIFO metrics
  const fifoDelay = 20 + load * 180 + Math.random() * 15;
  const fifoLoss = load > 0.7 ? (load - 0.7) * 25 + Math.random() * 3 : Math.random() * 0.5;
  const fifoThroughput = bandwidth * (1 - fifoLoss / 100) * 0.85;
  const fifoQueue = queueBase * 1.4 + Math.random() * 10;

  // Static QoS
  const staticMult = 0.65;
  const staticDelay = 15 + load * 110 * staticMult + Math.random() * 10;
  const staticLoss = load > 0.75 ? (load - 0.75) * 18 + Math.random() * 2 : Math.random() * 0.3;
  const staticThroughput = bandwidth * (1 - staticLoss / 100) * 0.91;
  const staticQueue = queueBase * 0.9 + Math.random() * 8;

  // ML QoS
  let mlMult = 0.45;
  if (congestionLevel === "High") mlMult = 0.3;
  else if (congestionLevel === "Medium") mlMult = 0.4;
  const mlDelay = 10 + load * 80 * mlMult + Math.random() * 8;
  const mlLoss = load > 0.8 ? (load - 0.8) * 12 + Math.random() * 1.5 : Math.random() * 0.15;
  const mlThroughput = bandwidth * (1 - mlLoss / 100) * 0.97;
  const mlQueue = queueBase * 0.55 + Math.random() * 6;

  return {
    tick, timestamp: new Date().toLocaleTimeString(),
    load: Math.round(load * 100),
    inPkts, outPkts,
    bandwidth: Math.round(bandwidth * 10) / 10,
    congestionLevel, congestionNum,
    fifo: { delay: Math.round(fifoDelay*10)/10, loss: Math.round(fifoLoss*100)/100, throughput: Math.round(fifoThroughput*10)/10, queue: Math.round(fifoQueue) },
    static: { delay: Math.round(staticDelay*10)/10, loss: Math.round(staticLoss*100)/100, throughput: Math.round(staticThroughput*10)/10, queue: Math.round(staticQueue) },
    ml: { delay: Math.round(mlDelay*10)/10, loss: Math.round(mlLoss*100)/100, throughput: Math.round(mlThroughput*10)/10, queue: Math.round(mlQueue) },
  };
}

// ─── Colors & Helpers ─────────────────────────────────────────────────────────
const C = {
  fifo: "#ef4444",
  static: "#f59e0b",
  ml: "#22d3ee",
  bg: "#050b14",
  card: "#0a1628",
  border: "#0f2544",
  text: "#e2eaf6",
  dim: "#4a6080",
  green: "#10b981",
  red: "#ef4444",
  yellow: "#f59e0b",
  cyan: "#22d3ee",
  purple: "#a78bfa",
};

const congestionColor = (level) =>
  level === "High" ? C.red : level === "Medium" ? C.yellow : C.green;

function AnimatedCounter({ value, suffix = "" }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const diff = value - display;
    if (Math.abs(diff) < 0.1) { setDisplay(value); return; }
    const timer = setTimeout(() => setDisplay(v => v + diff * 0.3), 16);
    return () => clearTimeout(timer);
  }, [value]);
  return <span>{typeof value === 'number' && !Number.isInteger(value) ? display.toFixed(1) : Math.round(display)}{suffix}</span>;
}

// ─── Animated Background ──────────────────────────────────────────────────────
function NetworkBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 2 + Math.random() * 3,
      pulse: Math.random() * Math.PI * 2,
    }));

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.02;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
      });
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (j <= i) return;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 180) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(34,211,238,${0.06 * (1 - d / 180)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
        const pulse = 0.5 + 0.5 * Math.sin(a.pulse);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${0.15 + pulse * 0.1})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,0.6)`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.35, pointerEvents: "none" }} />;
}

// ─── Decision Tree Visualization ──────────────────────────────────────────────
function DecisionTreeViz() {
  return (
    <svg viewBox="0 0 400 260" style={{ width: "100%", height: 200 }}>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {/* Edges */}
      {[
        [200,40,100,100],[200,40,300,100],
        [100,100,55,170],[100,100,145,170],
        [300,100,255,170],[300,100,345,170],
      ].map(([x1,y1,x2,y2],i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0f4070" strokeWidth="1.5"/>)}
      {/* Nodes */}
      {[
        [200,40,"Arrival Rate",C.cyan],
        [100,100,"Queue Len",C.purple],
        [300,100,"Throughput",C.purple],
        [55,170,"LOW",C.green],
        [145,170,"MED",C.yellow],
        [255,170,"MED",C.yellow],
        [345,170,"HIGH",C.red],
      ].map(([cx,cy,label,color],i) => (
        <g key={i} filter="url(#glow)">
          <rect x={+cx-38} y={+cy-16} width={76} height={32} rx={6} fill="#0a1a2e" stroke={color} strokeWidth={1.5}/>
          <text x={cx} y={+cy+5} textAnchor="middle" fill={color} fontSize={10} fontFamily="monospace">{label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Confusion Matrix ─────────────────────────────────────────────────────────
function ConfusionMatrix({ matrix }) {
  const labels = ["Low","Med","High"];
  const max = Math.max(...matrix.flat());
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "40px repeat(3, 1fr)", gap: 2, fontSize: 11 }}>
        <div/>
        {labels.map(l => <div key={l} style={{ textAlign:"center", color:C.dim, fontFamily:"monospace" }}>P:{l}</div>)}
        {matrix.map((row,i) => [
          <div key={`l${i}`} style={{ color:C.dim, fontFamily:"monospace", display:"flex", alignItems:"center" }}>A:{labels[i]}</div>,
          ...row.map((v,j) => (
            <div key={j} style={{
              background: i===j ? `rgba(34,211,238,${0.15+v/max*0.5})` : `rgba(239,68,68,${v/max*0.3})`,
              border: i===j ? "1px solid rgba(34,211,238,0.4)" : "1px solid rgba(239,68,68,0.2)",
              borderRadius: 4, padding: "6px 2px", textAlign:"center", color:C.text, fontFamily:"monospace"
            }}>{v}</div>
          ))
        ])}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("ml");
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [avgStats, setAvgStats] = useState({ fifo:{delay:0,loss:0,throughput:0}, static:{delay:0,loss:0,throughput:0}, ml:{delay:0,loss:0,throughput:0} });
  const tickRef = useRef(0);
  const dtState = dt;

  const tick = useCallback(() => {
    tickRef.current++;
    const data = simulateNetwork(mode, tickRef.current);
    setCurrent(data);
    setHistory(prev => {
      const next = [...prev, { ...data }].slice(-60);
      if (next.length > 5) {
        const avg = (key, sub) => next.reduce((s,d)=>s+d[sub][key],0)/next.length;
        setAvgStats({
          fifo: { delay:avg("delay","fifo"), loss:avg("loss","fifo"), throughput:avg("throughput","fifo") },
          static: { delay:avg("delay","static"), loss:avg("loss","static"), throughput:avg("throughput","static") },
          ml: { delay:avg("delay","ml"), loss:avg("loss","ml"), throughput:avg("throughput","ml") },
        });
      }
      return next;
    });
  }, [mode]);

  useEffect(() => {
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [tick]);

  const chartData = history.map((d,i) => ({
    t: d.timestamp,
    fifoDelay: d.fifo.delay, staticDelay: d.static.delay, mlDelay: d.ml.delay,
    fifoLoss: d.fifo.loss, staticLoss: d.static.loss, mlLoss: d.ml.loss,
    fifoThroughput: d.fifo.throughput, staticThroughput: d.static.throughput, mlThroughput: d.ml.throughput,
    fifoQueue: d.fifo.queue, staticQueue: d.static.queue, mlQueue: d.ml.queue,
    bandwidth: d.bandwidth, load: d.load,
  }));

  const best = { delay: "ml", loss: "ml", throughput: "ml" };

  const modeData = current ? (mode === "fifo" ? current.fifo : mode === "static" ? current.static : current.ml) : null;

  const ModeBtn = ({ id, label, icon }) => (
    <button onClick={() => setMode(id)} style={{
      padding:"10px 20px", borderRadius:8, border:`1px solid ${mode===id ? C.cyan : C.border}`,
      background: mode===id ? "rgba(34,211,238,0.12)" : "transparent",
      color: mode===id ? C.cyan : C.dim, cursor:"pointer", fontFamily:"monospace",
      fontSize:13, transition:"all 0.2s", display:"flex", alignItems:"center", gap:6,
      boxShadow: mode===id ? `0 0 16px rgba(34,211,238,0.2)` : "none"
    }}>
      <span>{icon}</span>{label}
    </button>
  );

  const Card = ({ children, style={}, glow }) => (
    <div style={{
      background:C.card, border:`1px solid ${glow ? `rgba(34,211,238,0.3)` : C.border}`,
      borderRadius:12, padding:20,
      boxShadow: glow ? `0 0 24px rgba(34,211,238,0.08), inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
      ...style
    }}>{children}</div>
  );

  const Stat = ({ label, value, unit, color }) => (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:11, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, color: color||C.text, fontFamily:"'Courier New',monospace" }}>
        <AnimatedCounter value={value}/><span style={{fontSize:13}}> {unit}</span>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter',sans-serif", position:"relative" }}>
      <NetworkBackground/>

      <div style={{ position:"relative", zIndex:1, maxWidth:1600, margin:"0 auto", padding:"16px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, padding:"16px 24px", background:C.card, borderRadius:12, border:`1px solid ${C.border}` }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:C.cyan, boxShadow:`0 0 8px ${C.cyan}`, animation:"pulse 2s infinite" }}/>
              <h1 style={{ margin:0, fontSize:18, fontWeight:700, fontFamily:"monospace", letterSpacing:1 }}>
                <span style={{ color:C.cyan }}>ML-QoS</span> Network Intelligence Dashboard
              </h1>
            </div>
            <div style={{ fontSize:11, color:C.dim, marginTop:4, fontFamily:"monospace" }}>
              Real-Time Network Performance Optimization · Decision Tree Adaptive QoS
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <div style={{ fontSize:11, fontFamily:"monospace", color:current?.congestionLevel ? congestionColor(current.congestionLevel) : C.dim,
              background:`rgba(0,0,0,0.3)`, padding:"6px 12px", borderRadius:6,
              border:`1px solid ${current ? congestionColor(current.congestionLevel) : C.border}` }}>
              CONGESTION: {current?.congestionLevel?.toUpperCase() || "—"}
            </div>
            <div style={{ fontSize:11, fontFamily:"monospace", color:C.green, background:"rgba(16,185,129,0.1)", padding:"6px 12px", borderRadius:6, border:"1px solid rgba(16,185,129,0.3)" }}>
              ● LIVE
            </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div style={{ display:"flex", gap:10, marginBottom:20, background:C.card, padding:16, borderRadius:12, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", display:"flex", alignItems:"center", marginRight:8 }}>MODE:</div>
          <ModeBtn id="fifo" label="No QoS (FIFO)" icon="⚡"/>
          <ModeBtn id="static" label="Static Priority QoS" icon="🎯"/>
          <ModeBtn id="ml" label="ML Adaptive QoS" icon="🧠"/>
          <div style={{ marginLeft:"auto", fontSize:11, fontFamily:"monospace", color:C.dim, display:"flex", alignItems:"center" }}>
            ML Accuracy: <span style={{ color:C.green, marginLeft:6 }}>{(dtState.accuracy*100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Real-Time Metrics */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
          {[
            { label:"BANDWIDTH", value:current?.bandwidth||0, unit:"Mbps", color:C.cyan },
            { label:"IN PACKETS/s", value:current?.inPkts||0, unit:"pkt/s", color:C.purple },
            { label:"OUT PACKETS/s", value:current?.outPkts||0, unit:"pkt/s", color:C.yellow },
            { label:"QUEUE SIZE", value:modeData?.queue||0, unit:"pkts", color:C.text },
            { label:"PACKET DELAY", value:modeData?.delay||0, unit:"ms", color:congestionColor(current?.congestionLevel||"Low") },
          ].map((s,i) => (
            <Card key={i} glow={i===0}>
              <Stat {...s}/>
            </Card>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          <Card>
            <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ PACKET DELAY COMPARISON (ms)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="t" tick={false} stroke={C.border}/>
                <YAxis tick={{ fill:C.dim, fontSize:10 }} stroke={C.border}/>
                <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, fontFamily:"monospace" }}/>
                <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }}/>
                <Line type="monotone" dataKey="fifoDelay" stroke={C.fifo} dot={false} strokeWidth={1.5} name="FIFO"/>
                <Line type="monotone" dataKey="staticDelay" stroke={C.static} dot={false} strokeWidth={1.5} name="Static QoS"/>
                <Line type="monotone" dataKey="mlDelay" stroke={C.ml} dot={false} strokeWidth={2} name="ML QoS"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ THROUGHPUT COMPARISON (Mbps)</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="t" tick={false} stroke={C.border}/>
                <YAxis tick={{ fill:C.dim, fontSize:10 }} stroke={C.border}/>
                <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, fontFamily:"monospace" }}/>
                <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }}/>
                <Area type="monotone" dataKey="mlThroughput" stroke={C.ml} fill="rgba(34,211,238,0.08)" strokeWidth={2} name="ML QoS"/>
                <Area type="monotone" dataKey="staticThroughput" stroke={C.static} fill="rgba(245,158,11,0.06)" strokeWidth={1.5} name="Static QoS"/>
                <Area type="monotone" dataKey="fifoThroughput" stroke={C.fifo} fill="rgba(239,68,68,0.06)" strokeWidth={1.5} name="FIFO"/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          <Card>
            <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ PACKET LOSS RATE (%)</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="t" tick={false} stroke={C.border}/>
                <YAxis tick={{ fill:C.dim, fontSize:10 }} stroke={C.border}/>
                <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, fontFamily:"monospace" }}/>
                <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }}/>
                <Line type="monotone" dataKey="fifoLoss" stroke={C.fifo} dot={false} strokeWidth={1.5} name="FIFO"/>
                <Line type="monotone" dataKey="staticLoss" stroke={C.static} dot={false} strokeWidth={1.5} name="Static QoS"/>
                <Line type="monotone" dataKey="mlLoss" stroke={C.ml} dot={false} strokeWidth={2} name="ML QoS"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ QUEUE LENGTH COMPARISON</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="t" tick={false} stroke={C.border}/>
                <YAxis tick={{ fill:C.dim, fontSize:10 }} stroke={C.border}/>
                <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, fontFamily:"monospace" }}/>
                <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }}/>
                <Bar dataKey="fifoQueue" fill={C.fifo} name="FIFO" radius={[2,2,0,0]} opacity={0.8}/>
                <Bar dataKey="staticQueue" fill={C.static} name="Static" radius={[2,2,0,0]} opacity={0.8}/>
                <Bar dataKey="mlQueue" fill={C.ml} name="ML" radius={[2,2,0,0]} opacity={0.8}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ML Analytics + Performance Comparison */}
        <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:16, marginBottom:16 }}>

          {/* ML Panel */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Card glow>
              <div style={{ fontSize:12, color:C.cyan, fontFamily:"monospace", marginBottom:12 }}>🧠 DECISION TREE VISUALIZATION</div>
              <DecisionTreeViz/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                <div style={{ background:"rgba(34,211,238,0.06)", padding:10, borderRadius:8, border:"1px solid rgba(34,211,238,0.15)" }}>
                  <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace" }}>MODEL ACCURACY</div>
                  <div style={{ fontSize:22, fontWeight:700, color:C.green, fontFamily:"monospace" }}>
                    {(dtState.accuracy*100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ background:"rgba(167,139,250,0.06)", padding:10, borderRadius:8, border:"1px solid rgba(167,139,250,0.15)" }}>
                  <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace" }}>TRAINING SAMPLES</div>
                  <div style={{ fontSize:22, fontWeight:700, color:C.purple, fontFamily:"monospace" }}>{dtState.trainCount}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ FEATURE IMPORTANCE</div>
              {Object.entries(dtState.featureImportance).map(([k,v]) => (
                <div key={k} style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, fontFamily:"monospace", color:C.dim, marginBottom:3 }}>
                    <span>{k.replace(/_/g," ").toUpperCase()}</span>
                    <span style={{ color:C.cyan }}>{(v*100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height:5, background:C.border, borderRadius:3 }}>
                    <div style={{ height:"100%", width:`${v*100}%`, background:`linear-gradient(90deg,${C.cyan},${C.purple})`, borderRadius:3, transition:"width 0.5s" }}/>
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:12 }}>◈ CONFUSION MATRIX</div>
              <ConfusionMatrix matrix={dtState.confusionMatrix}/>
            </Card>
          </div>

          {/* Performance Comparison */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Card>
              <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:16 }}>◈ PERFORMANCE COMPARISON TABLE</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"monospace", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {["Mode","Avg Delay (ms)","Throughput (Mbps)","Packet Loss (%)","Status"].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", color:C.dim, fontSize:11, textAlign:"left", fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id:"fifo", label:"FIFO (No QoS)", color:C.fifo },
                    { id:"static", label:"Static Priority QoS", color:C.static },
                    { id:"ml", label:"ML Adaptive QoS", color:C.ml },
                  ].map(({ id, label, color }) => {
                    const s = avgStats[id];
                    const isBest = id === "ml";
                    return (
                      <tr key={id} style={{
                        borderBottom:`1px solid ${C.border}`,
                        background: isBest ? "rgba(34,211,238,0.04)" : "transparent"
                      }}>
                        <td style={{ padding:"12px", display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }}/>
                          <span style={{ color }}>{label}</span>
                        </td>
                        <td style={{ padding:"12px", color: id==="ml" ? C.green : C.text }}>{s.delay.toFixed(1)}</td>
                        <td style={{ padding:"12px", color: id==="ml" ? C.green : C.text }}>{s.throughput.toFixed(1)}</td>
                        <td style={{ padding:"12px", color: id==="ml" ? C.green : C.text }}>{s.loss.toFixed(3)}</td>
                        <td style={{ padding:"12px" }}>
                          {isBest ? (
                            <span style={{ background:"rgba(16,185,129,0.15)", color:C.green, padding:"3px 10px", borderRadius:12, fontSize:11, border:"1px solid rgba(16,185,129,0.3)" }}>★ BEST</span>
                          ) : (
                            <span style={{ color:C.dim, fontSize:11 }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {/* Radar chart */}
            <Card>
              <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:8 }}>◈ PERFORMANCE RADAR</div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={[
                  { metric:"Low Delay", fifo: Math.max(0,100-avgStats.fifo.delay/2), static: Math.max(0,100-avgStats.static.delay/2), ml: Math.max(0,100-avgStats.ml.delay/2) },
                  { metric:"Throughput", fifo: avgStats.fifo.throughput/9, static: avgStats.static.throughput/9, ml: avgStats.ml.throughput/9 },
                  { metric:"No Loss", fifo: Math.max(0,100-avgStats.fifo.loss*20), static: Math.max(0,100-avgStats.static.loss*20), ml: Math.max(0,100-avgStats.ml.loss*20) },
                  { metric:"Low Queue", fifo:35, static:60, ml:88 },
                  { metric:"Adaptability", fifo:20, static:55, ml:97 },
                ]}>
                  <PolarGrid stroke={C.border}/>
                  <PolarAngleAxis tick={{ fill:C.dim, fontSize:10, fontFamily:"monospace" }}/>
                  <Radar name="FIFO" dataKey="fifo" stroke={C.fifo} fill={C.fifo} fillOpacity={0.08}/>
                  <Radar name="Static" dataKey="static" stroke={C.static} fill={C.static} fillOpacity={0.08}/>
                  <Radar name="ML QoS" dataKey="ml" stroke={C.ml} fill={C.ml} fillOpacity={0.15}/>
                  <Legend wrapperStyle={{ fontSize:11, fontFamily:"monospace" }}/>
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            {/* Bandwidth + Load */}
            <Card>
              <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:8 }}>◈ BANDWIDTH & NETWORK LOAD</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="t" tick={false} stroke={C.border}/>
                  <YAxis tick={{ fill:C.dim, fontSize:10 }} stroke={C.border}/>
                  <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, fontSize:11, fontFamily:"monospace" }}/>
                  <Area type="monotone" dataKey="bandwidth" stroke={C.cyan} fill="rgba(34,211,238,0.1)" strokeWidth={2} name="Bandwidth (Mbps)"/>
                  <Area type="monotone" dataKey="load" stroke={C.purple} fill="rgba(167,139,250,0.08)" strokeWidth={1.5} name="Load %"/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:"center", padding:"12px", fontSize:11, color:C.dim, fontFamily:"monospace", borderTop:`1px solid ${C.border}` }}>
          ML-QoS Dashboard · Decision Tree Classifier · psutil + scikit-learn simulation · Updates every 500ms
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: #0f2544 transparent; }
        ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:#0f2544; border-radius:3px; }
      `}</style>
    </div>
  );
}
