import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Lock, Unlock, Trophy, Volume2, VolumeX, Home, Pause, X } from 'lucide-react';

// ============================================================================
// [TiltBall 10 - High-Fidelity Global Master Build]
// 1. Striking Ball Identity: Advanced Canvas 2D drawing for realistic sports balls.
// 2. Global UI: 100% English, clean HUD with "STAGE N" display.
// 3. Strict Progression: Locks enforced, "❓" for uncleared stages.
// 4. Pure Physics: Tilt-based momentum collision, dynamic hole scaling.
// ============================================================================

// 🎨 1. Theme System (High-Contrast Themes)
type Theme = { name: string; bg: string; neon: string; comp: string };
const THEMES: Theme[] = [
  { name: 'Space',   bg: '#020617', neon: '#06b6d4', comp: '#f97316' }, // Navy + Cyan -> Orange glow
  { name: 'Ocean',   bg: '#042f2e', neon: '#10b981', comp: '#ec4899' }, // Teal + Emerald -> Pink glow
  { name: 'Volcano', bg: '#1c1917', neon: '#f59e0b', comp: '#3b82f6' }, // Charcoal + Amber -> Blue glow
  { name: 'Cyber',   bg: '#000000', neon: '#d946ef', comp: '#84cc16' }, // Black + Magenta -> Lime glow
];

// ⚽ 2. Ball Types & Physics Properties
type BallType = 'basketball' | 'soccer' | 'billiard' | 'golf' | 'tennis' | 'baseball' | 'volleyball' | 'bowling' | 'pingpong' | 'softball';

interface StageConfig {
  id: number;
  level: 1 | 2;
  type: BallType;
  emoji: string;
  mass: number;       
  radius: number;     
  friction: number;   
  basePitch: number;  
  holeMultiplier: number; 
  theme: Theme;       
}

const BALL_PROPS: { type: BallType; emoji: string; mass: number; radius: number; pitch: number }[] = [
  { type: 'basketball', emoji: '🏀', mass: 3.0, radius: 22, pitch: 150 },
  { type: 'soccer',     emoji: '⚽', mass: 2.5, radius: 20, pitch: 200 },
  { type: 'volleyball', emoji: '🏐', mass: 2.0, radius: 18, pitch: 250 },
  { type: 'softball',   emoji: '🥎', mass: 1.8, radius: 16, pitch: 300 },
  { type: 'bowling',    emoji: '🎳', mass: 5.0, radius: 22, pitch: 100 },
  { type: 'baseball',   emoji: '⚾', mass: 1.5, radius: 14, pitch: 400 },
  { type: 'tennis',     emoji: '🎾', mass: 1.2, radius: 13, pitch: 500 },
  { type: 'billiard',   emoji: '🎱', mass: 2.5, radius: 15, pitch: 350 },
  { type: 'golf',       emoji: '⛳', mass: 1.0, radius: 10, pitch: 600 },
  { type: 'pingpong',   emoji: '🏓', mass: 0.5, radius: 8,  pitch: 800 },
];

// 🗺️ 3. Generate 20 Stages (1~10: Level 1, 11~20: Level 2)
const STAGES: StageConfig[] = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1;
  const isLevel1 = id <= 10;
  const base = BALL_PROPS[i % 10];
  const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

  return {
    id,
    level: isLevel1 ? 1 : 2,
    type: base.type,
    emoji: base.emoji,
    mass: base.mass,
    radius: base.radius,
    basePitch: base.pitch,
    theme,
    friction: isLevel1 ? 0.98 : 0.99, 
    holeMultiplier: isLevel1 ? 1.7 : 1.3,
  };
});

export default function App() {
  // 🎮 Game State Management
  const [gameState, setGameState] = useState<'start' | 'lobby' | 'playing' | 'paused' | 'clear' | 'gameover'>('start');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [records, setRecords] = useState<Record<number, number>>({});
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // ⏱️ Timer State
  const [displayTime, setDisplayTime] = useState(0);
  const accumulatedTimeRef = useRef(0);
  const sessionStartTimeRef = useRef(0);

  // Canvas & Physics Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  const player = useRef({ x: 50, y: 50, vx: 0, vy: 0, radius: 15, mass: 2.0 });
  const target = useRef({ x: 200, y: 200, vx: 0, vy: 0, radius: 20, mass: 2.0 });
  const hole = useRef({ x: 300, y: 300, radius: 30 });
  const tilt = useRef({ x: 0, y: 0 });

  // 💾 Load Records
  useEffect(() => {
    const saved = localStorage.getItem('tiltball_records_v6');
    if (saved) {
      try { setRecords(JSON.parse(saved)); } 
      catch (e) { console.error("Failed to load records.", e); }
    }
  }, []);

  const saveRecord = (stageId: number, time: number) => {
    const newRecords = { ...records };
    if (!newRecords[stageId] || time < newRecords[stageId]) {
      newRecords[stageId] = time;
      setRecords(newRecords);
      localStorage.setItem('tiltball_records_v6', JSON.stringify(newRecords));
    }
  };

  // 🎵 Procedural Audio System
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  const playCollisionSound = (velocity: number, basePitch: number) => {
    if (!soundEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(basePitch + velocity * 10, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, ctx.currentTime + 0.1);
    
    const volume = Math.min(velocity / 20, 0.5);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  // 📱 Device Orientation Request
  const requestAccessAndEnterLobby = async () => {
    initAudio();
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          window.addEventListener('deviceorientation', handleOrientation);
        } else {
          alert('Sensor permission is required. Use arrow keys on PC.');
        }
      } catch (error) { console.error(error); }
    } else {
      setPermissionGranted(true);
      window.addEventListener('deviceorientation', handleOrientation);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    setGameState('lobby');
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (!e.beta || !e.gamma) return;
    let beta = e.beta;
    let gamma = e.gamma;
    if (beta > 90) beta = 90;
    if (beta < -90) beta = -90;
    tilt.current = { x: gamma / 45, y: beta / 45 };
  };

  // 💻 PC Fallback Controls
  const keys = useRef<{ [key: string]: boolean }>({});
  const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.key] = true; updateTiltFromKeys(); };
  const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key] = false; updateTiltFromKeys(); };
  const updateTiltFromKeys = () => {
    let tx = 0, ty = 0;
    if (keys.current['ArrowUp']) ty = -1.0;
    if (keys.current['ArrowDown']) ty = 1.0;
    if (keys.current['ArrowLeft']) tx = -1.0;
    if (keys.current['ArrowRight']) tx = 1.0;
    tilt.current = { x: tx, y: ty };
  };

  // 🚀 Initialize Stage
  const startStage = (stageId: number) => {
    const config = STAGES[stageId - 1];
    setCurrentStage(stageId);
    
    const LOGICAL_W = 400;
    const LOGICAL_H = 711;

    const isLevel1 = config.level === 1;
    const marginX = isLevel1 ? LOGICAL_W * 0.2 : 0;
    const marginY = isLevel1 ? LOGICAL_H * 0.2 : 0;
    const tableW = isLevel1 ? LOGICAL_W * 0.6 : LOGICAL_W;
    const tableH = isLevel1 ? LOGICAL_H * 0.6 : LOGICAL_H;

    player.current = { 
      x: marginX + tableW * 0.5, 
      y: marginY + tableH * 0.8,
      vx: 0, vy: 0, 
      radius: config.radius, 
      mass: config.mass 
    };
    
    target.current = { 
      x: marginX + tableW * 0.5, 
      y: marginY + tableH * 0.2,
      vx: 0, vy: 0, 
      radius: config.radius, 
      mass: config.mass 
    };

    hole.current = {
      x: marginX + tableW * 0.5 + (Math.random() * tableW * 0.4 - tableW * 0.2),
      y: marginY + tableH * 0.5 + (Math.random() * tableH * 0.4 - tableH * 0.2),
      radius: config.radius * config.holeMultiplier
    };

    accumulatedTimeRef.current = 0;
    sessionStartTimeRef.current = Date.now();
    setDisplayTime(0);
    
    setGameState('playing');
  };

  const togglePause = () => {
    if (gameState === 'playing') {
      accumulatedTimeRef.current += (Date.now() - sessionStartTimeRef.current);
      setGameState('paused');
    } else if (gameState === 'paused') {
      sessionStartTimeRef.current = Date.now();
      setGameState('playing');
    }
  };

  // ⚙️ Physics Engine & Render Loop (60fps)
  useEffect(() => {
    if (gameState !== 'playing') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 711;

    const config = STAGES[currentStage - 1];

    const updatePhysics = () => {
      const p = player.current;
      const t = target.current;
      const w = canvas.width;
      const h = canvas.height;

      const isLevel1 = config.level === 1;
      const marginX = isLevel1 ? w * 0.2 : 0;
      const marginY = isLevel1 ? h * 0.2 : 0;
      const tableW = isLevel1 ? w * 0.6 : w;
      const tableH = isLevel1 ? h * 0.6 : h;

      p.vx += tilt.current.x * 0.6;
      p.vy += tilt.current.y * 0.6;

      p.vx *= config.friction; p.vy *= config.friction;
      t.vx *= config.friction; t.vy *= config.friction;

      p.x += p.vx; p.y += p.vy;
      t.x += t.vx; t.y += t.vy;

      const handleWallCollision = (ball: any) => {
        if (ball.x - ball.radius < marginX) { ball.x = marginX + ball.radius; ball.vx *= -0.8; playCollisionSound(Math.abs(ball.vx), 400); }
        if (ball.x + ball.radius > marginX + tableW) { ball.x = marginX + tableW - ball.radius; ball.vx *= -0.8; playCollisionSound(Math.abs(ball.vx), 400); }
        if (ball.y - ball.radius < marginY) { ball.y = marginY + ball.radius; ball.vy *= -0.8; playCollisionSound(Math.abs(ball.vy), 400); }
        if (ball.y + ball.radius > marginY + tableH) { ball.y = marginY + tableH - ball.radius; ball.vy *= -0.8; playCollisionSound(Math.abs(ball.vy), 400); }
      };
      handleWallCollision(p);
      handleWallCollision(t);

      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < p.radius + t.radius) {
        const nx = dx / dist;
        const ny = dy / dist;
        
        const overlap = (p.radius + t.radius - dist) / 2;
        p.x -= nx * overlap; p.y -= ny * overlap;
        t.x += nx * overlap; t.y += ny * overlap;

        const kx = p.vx - t.vx;
        const ky = p.vy - t.vy;
        const p_val = 2.0 * (nx * kx + ny * ky) / (p.mass + t.mass);
        
        p.vx -= p_val * t.mass * nx;
        p.vy -= p_val * t.mass * ny;
        t.vx += p_val * p.mass * nx;
        t.vy += p_val * p.mass * ny;

        playCollisionSound(Math.abs(p_val), config.basePitch);
      }

      const distToHoleP = Math.sqrt(Math.pow(p.x - hole.current.x, 2) + Math.pow(p.y - hole.current.y, 2));
      const distToHoleT = Math.sqrt(Math.pow(t.x - hole.current.x, 2) + Math.pow(t.y - hole.current.y, 2));

      const fallThreshold = hole.current.radius * 0.5;

      if (distToHoleP < fallThreshold) {
        setGameState('gameover'); 
      } else if (distToHoleT < fallThreshold) {
        const finalTime = (accumulatedTimeRef.current + (Date.now() - sessionStartTimeRef.current)) / 1000;
        saveRecord(currentStage, finalTime);
        setGameState('clear'); 
      }
    };

    // 🎨 Advanced Canvas Drawing for Distinct Ball Identities
    const drawCustomBall = (x: number, y: number, radius: number, type: BallType, theme: Theme, isStriker: boolean) => {
      ctx.save();
      ctx.translate(x, y);

      // 1. Dynamic Neon Glow
      ctx.shadowColor = isStriker ? '#ffffff' : theme.comp;
      ctx.shadowBlur = 20;
      ctx.fillStyle = isStriker ? '#ffffff' : theme.comp;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 2. Draw Specific Ball Patterns
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip(); // Clip everything inside the ball

      // Base Colors
      let baseColor = '#ffffff';
      if (type === 'basketball') baseColor = '#ea580c';
      else if (type === 'softball') baseColor = '#d9f99d';
      else if (type === 'tennis') baseColor = '#bef264';
      else if (type === 'bowling') baseColor = '#1e3a8a';
      else if (type === 'billiard') baseColor = '#171717';
      else if (type === 'pingpong') baseColor = '#fb923c';
      
      ctx.fillStyle = baseColor;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

      // Patterns
      ctx.lineWidth = radius * 0.1;
      
      if (type === 'basketball') {
        ctx.strokeStyle = '#290c0c';
        ctx.beginPath(); ctx.moveTo(0, -radius); ctx.lineTo(0, radius); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-radius, 0); ctx.lineTo(radius, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(-radius*0.7, 0, radius*0.7, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.beginPath(); ctx.arc(radius*0.7, 0, radius*0.7, Math.PI/2, Math.PI*1.5); ctx.stroke();
      } 
      else if (type === 'soccer') {
        ctx.fillStyle = '#171717';
        ctx.strokeStyle = '#171717';
        // Center pentagon
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(angle) * radius * 0.35;
          const py = Math.sin(angle) * radius * 0.35;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Radiating lines
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          const px1 = Math.cos(angle) * radius * 0.35;
          const py1 = Math.sin(angle) * radius * 0.35;
          const px2 = Math.cos(angle) * radius;
          const py2 = Math.sin(angle) * radius;
          ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
        }
      } 
      else if (type === 'baseball' || type === 'softball') {
        ctx.strokeStyle = '#ef4444'; // Red stitches
        ctx.beginPath(); ctx.arc(-radius*0.6, 0, radius*0.7, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(radius*0.6, 0, radius*0.7, Math.PI - Math.PI/2.5, Math.PI + Math.PI/2.5); ctx.stroke();
        // Stitch dashes
        ctx.setLineDash([radius*0.1, radius*0.15]);
        ctx.lineWidth = radius * 0.15;
        ctx.beginPath(); ctx.arc(-radius*0.6, 0, radius*0.7, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(radius*0.6, 0, radius*0.7, Math.PI - Math.PI/2.5, Math.PI + Math.PI/2.5); ctx.stroke();
        ctx.setLineDash([]);
      } 
      else if (type === 'tennis') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = radius * 0.15;
        ctx.beginPath(); ctx.arc(-radius*0.6, 0, radius*0.7, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(radius*0.6, 0, radius*0.7, Math.PI - Math.PI/2.5, Math.PI + Math.PI/2.5); ctx.stroke();
      } 
      else if (type === 'bowling') {
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(-radius*0.2, -radius*0.3, radius*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(radius*0.2, -radius*0.3, radius*0.15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, radius*0.1, radius*0.15, 0, Math.PI*2); ctx.fill();
      } 
      else if (type === 'billiard') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, radius*0.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${radius*0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', 0, radius*0.05);
      } 
      else if (type === 'golf') {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        for(let dx = -radius; dx < radius; dx += radius*0.35) {
          for(let dy = -radius; dy < radius; dy += radius*0.35) {
            if (dx*dx + dy*dy < radius*radius*0.8) {
              ctx.beginPath(); ctx.arc(dx, dy, radius*0.08, 0, Math.PI*2); ctx.fill();
            }
          }
        }
      } 
      else if (type === 'volleyball') {
        ctx.strokeStyle = '#fde047'; // Yellow panel
        ctx.lineWidth = radius * 0.3;
        ctx.beginPath(); ctx.arc(0, -radius*0.5, radius*0.8, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = '#3b82f6'; // Blue panel
        ctx.beginPath(); ctx.arc(0, radius*0.5, radius*0.8, Math.PI, Math.PI*2); ctx.stroke();
        // Panel borders
        ctx.strokeStyle = '#171717';
        ctx.lineWidth = radius * 0.05;
        ctx.beginPath(); ctx.arc(0, -radius*0.5, radius*0.8, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, radius*0.5, radius*0.8, Math.PI, Math.PI*2); ctx.stroke();
      }

      ctx.restore(); // Remove clipping

      // 3. 3D Sphere Radial Gradient Overlay (Glossy finish)
      const grad = ctx.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255,255,255,0.7)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // 4. Sharp border for visibility
      ctx.lineWidth = 2;
      ctx.strokeStyle = isStriker ? '#ffffff' : theme.comp;
      ctx.stroke();

      ctx.restore();
    };

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const isLevel1 = config.level === 1;
      const marginX = isLevel1 ? w * 0.2 : 0;
      const marginY = isLevel1 ? h * 0.2 : 0;
      const tableW = isLevel1 ? w * 0.6 : w;
      const tableH = isLevel1 ? h * 0.6 : h;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = config.theme.bg;
      ctx.fillRect(marginX, marginY, tableW, tableH);

      ctx.strokeStyle = config.theme.neon;
      ctx.lineWidth = 6;
      ctx.shadowColor = config.theme.neon;
      ctx.shadowBlur = 20;
      ctx.strokeRect(marginX + 3, marginY + 3, tableW - 6, tableH - 6);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000000';
      ctx.shadowColor = config.theme.neon;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(hole.current.x, hole.current.y, hole.current.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = config.theme.neon;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw Custom Balls
      drawCustomBall(target.current.x, target.current.y, target.current.radius, config.type, config.theme, false);
      drawCustomBall(player.current.x, player.current.y, player.current.radius, config.type, config.theme, true);

      const currentTotalTime = accumulatedTimeRef.current + (Date.now() - sessionStartTimeRef.current);
      setDisplayTime(currentTotalTime / 1000);
    };

    const loop = () => {
      updatePhysics();
      render();
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, currentStage]);

  // --- UI Rendering ---
  const isLevel2Unlocked = records[10] !== undefined;

  const renderStageGrid = (start: number, end: number) => (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {STAGES.slice(start - 1, end).map(stage => {
        const isCleared = records[stage.id] !== undefined;
        const isUnlocked = stage.id === 1 || records[stage.id - 1] !== undefined;
        const isLocked = !isUnlocked;
        
        // Mystery Reveal: Show actual emoji in lobby ONLY if cleared. Otherwise, show "❓".
        const displayIcon = isCleared ? stage.emoji : '❓';

        return (
          <button
            key={stage.id}
            disabled={isLocked}
            onClick={() => startStage(stage.id)}
            className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border-2 transition-all aspect-square
              ${isLocked 
                ? 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed' 
                : isCleared 
                  ? 'bg-slate-800 border-emerald-500 hover:bg-slate-700' 
                  : 'bg-slate-800 border-blue-500 hover:bg-slate-700 shadow-[0_0_15px_rgba(59,130,246,0.5)]'
              }
            `}
          >
            <span className="text-[10px] sm:text-xs text-slate-400 mb-1">S{stage.id}</span>
            <span className="text-2xl sm:text-3xl mb-1 filter drop-shadow-lg">
              {displayIcon}
            </span>
            {isCleared && (
              <div className="flex items-center text-[9px] sm:text-[10px] text-emerald-400 font-mono">
                <Trophy size={10} className="mr-1" />
                {records[stage.id].toFixed(1)}s
              </div>
            )}
            {isLocked && <Lock size={14} className="absolute top-1 right-1 text-slate-500" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans">
      <div className="relative w-full max-w-[400px] aspect-[9/16] max-h-screen bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden sm:rounded-3xl sm:border-4 border-slate-800 flex flex-col">
        
        {/* Start Screen */}
        {gameState === 'start' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950">
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
              <span className="text-5xl">🎱</span>
            </div>
            <h1 className="text-4xl font-black mb-4 tracking-tighter bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
              TiltBall 10
            </h1>
            <p className="mb-8 text-slate-400 text-center text-sm leading-relaxed">
              Tilt your device to steer!<br/>
              Push the target ball (colored glow)<br/>
              into the hole using your ball (white glow) to win.
            </p>
            <button 
              onClick={requestAccessAndEnterLobby}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.5)]"
            >
              <Play fill="currentColor" />
              Start Game
            </button>
          </div>
        )}

        {/* Lobby Screen */}
        {gameState === 'lobby' && (
          <div className="absolute inset-0 z-10 p-4 overflow-y-auto bg-slate-950 flex flex-col scrollbar-hide">
            <div className="flex justify-between w-full mb-6 items-center mt-2">
              <h1 className="text-2xl font-black tracking-tighter text-white">Select Stage</h1>
              <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white">
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>

            <div className="w-full mb-8">
              <h2 className="text-lg font-bold mb-3 text-blue-300 border-b border-blue-900 pb-2">
                Level 1
              </h2>
              {renderStageGrid(1, 10)}
            </div>

            <div className={`w-full pb-8 transition-opacity duration-500 ${isLevel2Unlocked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-lg font-bold mb-3 text-emerald-300 border-b border-emerald-900 pb-2 flex items-center gap-2">
                Level 2
                {!isLevel2Unlocked && <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 ml-auto">🔒 Clear S10</span>}
                {isLevel2Unlocked && <Unlock size={14} className="text-emerald-400 ml-auto" />}
              </h2>
              {renderStageGrid(11, 20)}
            </div>
          </div>
        )}

        {/* Game Playing Screen */}
        {(gameState === 'playing' || gameState === 'paused' || gameState === 'clear' || gameState === 'gameover') && (
          <>
            {/* Top UI Bar */}
            <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
              <button 
                onClick={() => setGameState('lobby')}
                className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-colors"
              >
                <Home size={18} />
              </button>
              
              {/* In-Game HUD: Stage N */}
              <div className="text-lg font-black text-white tracking-widest">
                STAGE {currentStage}
              </div>

              <div className="flex items-center gap-2">
                <div className="text-lg font-mono font-bold text-white w-14 text-right">
                  {displayTime.toFixed(1)}s
                </div>
                <button 
                  onClick={togglePause}
                  className="p-2 bg-blue-600 rounded-full hover:bg-blue-500 text-white transition-colors shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                >
                  <Pause size={18} fill="currentColor" />
                </button>
              </div>
            </div>

            {/* Canvas */}
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Pause Modal */}
            {gameState === 'paused' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <h2 className="text-3xl font-black text-white mb-8 tracking-widest">PAUSED</h2>
                <div className="flex flex-col gap-4 w-48">
                  <button onClick={togglePause} className="py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold flex items-center justify-center gap-2 text-white">
                    <Play size={18} fill="currentColor" /> Resume
                  </button>
                  <button onClick={() => startStage(currentStage)} className="py-3 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex items-center justify-center gap-2 text-white">
                    <RotateCcw size={18} /> Restart
                  </button>
                  <button onClick={() => setGameState('lobby')} className="py-3 bg-slate-700 hover:bg-slate-600 rounded-full font-bold flex items-center justify-center gap-2 text-white">
                    <X size={18} /> Exit Game
                  </button>
                </div>
              </div>
            )}

            {/* Clear Modal */}
            {gameState === 'clear' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <div className="text-5xl mb-4 animate-bounce">🎉</div>
                <h2 className="text-3xl font-black text-emerald-400 mb-2">STAGE CLEAR!</h2>
                <p className="text-lg text-white mb-8 font-mono">Time: {displayTime.toFixed(1)}s</p>
                <div className="flex gap-3">
                  <button onClick={() => setGameState('lobby')} className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-white text-sm">
                    Lobby
                  </button>
                  {currentStage < 20 && (
                    <button onClick={() => startStage(currentStage + 1)} className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex items-center gap-2 text-white text-sm">
                      Next <Play size={16} fill="currentColor" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* GameOver Modal */}
            {gameState === 'gameover' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <div className="text-5xl mb-4">💀</div>
                <h2 className="text-3xl font-black text-red-500 mb-2">GAME OVER</h2>
                <p className="text-slate-400 mb-8 text-sm">Your ball fell into the hole!</p>
                <div className="flex gap-3">
                  <button onClick={() => setGameState('lobby')} className="px-5 py-3 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-white text-sm">
                    Lobby
                  </button>
                  <button onClick={() => startStage(currentStage)} className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold flex items-center gap-2 text-white text-sm">
                    <RotateCcw size={16} /> Retry
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
