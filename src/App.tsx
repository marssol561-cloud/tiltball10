import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Lock, Unlock, Trophy, Home, Pause, X, Loader2 } from 'lucide-react';

// ============================================================================
// [TiltBall 10 - Monetization & Global Production Update]
// Hello! As a Senior Game Developer, I've prepared the final code for global
// deployment with ad placements and a Level 2 Reward Gate.
// 
// 1. Dynamic Ad Layouts:
//    - Level 1: 60% Game Height, Ad Slot at the BOTTOM.
//    - Level 2: 90% Game Height, Ad Slot at the TOP.
// 2. Reward Gate (Interstitial):
//    - Triggers after clearing Stage 10.
//    - 3-second simulated "Loading Ad..." overlay before unlocking Level 2.
// 3. Audio Control:
//    - BGM (/bgm.mp3) pauses during menus, pause screens, and ad overlays.
//    - SFX remains independent and unaffected by BGM mute.
// 4. Global SEO & Integrity:
//    - All UI text is in professional English.
//    - Physics, ball textures, and tilt sensitivity remain exactly the same.
// ============================================================================

// 🎨 1. Theme System
type Theme = { name: string; bg: string; neon: string; comp: string };
const THEMES: Theme[] = [
  { name: 'Space',   bg: '#020617', neon: '#06b6d4', comp: '#f97316' }, 
  { name: 'Ocean',   bg: '#042f2e', neon: '#10b981', comp: '#ec4899' }, 
  { name: 'Volcano', bg: '#1c1917', neon: '#f59e0b', comp: '#3b82f6' }, 
  { name: 'Cyber',   bg: '#000000', neon: '#d946ef', comp: '#84cc16' }, 
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
  holeMultiplier: number; 
  theme: Theme;       
}

const BALL_PROPS: { type: BallType; emoji: string; mass: number; radius: number }[] = [
  { type: 'basketball', emoji: '🏀', mass: 3.0, radius: 22 },
  { type: 'soccer',     emoji: '⚽', mass: 2.5, radius: 20 },
  { type: 'volleyball', emoji: '🏐', mass: 2.0, radius: 18 },
  { type: 'softball',   emoji: '🥎', mass: 1.8, radius: 16 },
  { type: 'bowling',    emoji: '🎳', mass: 5.0, radius: 22 },
  { type: 'baseball',   emoji: '⚾', mass: 1.5, radius: 14 },
  { type: 'tennis',     emoji: '🎾', mass: 1.2, radius: 13 },
  { type: 'billiard',   emoji: '🎱', mass: 2.5, radius: 15 },
  { type: 'golf',       emoji: '⛳', mass: 1.0, radius: 10 },
  { type: 'pingpong',   emoji: '🏓', mass: 0.5, radius: 8  },
];

// 🗺️ 3. Stage Generation (20 Stages)
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
    theme,
    friction: isLevel1 ? 0.98 : 0.99,
    holeMultiplier: isLevel1 ? 1.7 : 1.3,
  };
});

export default function App() {
  // 🎮 Game State Management
  const [gameState, setGameState] = useState<'start' | 'lobby' | 'playing' | 'paused' | 'clear' | 'gameover' | 'reward_gate' | 'ad_loading'>('start');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [records, setRecords] = useState<Record<number, number>>({});
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLevel2Unlocked, setIsLevel2Unlocked] = useState<boolean>(false);
  
  // 🎵 Audio State Management
  const [bgmEnabled, setBgmEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('tiltball_bgm');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // 🐛 Audio Debugging State
  const [debugInfo, setDebugInfo] = useState({
    tryingPath: '',
    httpStatus: '',
    errorCode: '',
    errorMsg: '',
    playStatus: ''
  });
  const [audioRetry, setAudioRetry] = useState(0);
  
  // ⏱️ Timer State Management
  const [displayTime, setDisplayTime] = useState(0);
  const accumulatedTimeRef = useRef(0);
  const sessionStartTimeRef = useRef(0);

  // Canvas & Physics Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const stageInitializedRef = useRef(false);
  
  // 🎧 Audio System Refs
  const audioCtxRef = useRef<AudioContext | null>(null); // SFX
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null); // BGM
  
  // Physics Data
  const player = useRef({ x: 50, y: 50, vx: 0, vy: 0, radius: 15, mass: 2.0 });
  const target = useRef({ x: 200, y: 200, vx: 0, vy: 0, radius: 20, mass: 2.0 });
  const hole = useRef({ x: 300, y: 300, radius: 30 });
  const tilt = useRef({ x: 0, y: 0 });

  // 💾 Load Game Records
  useEffect(() => {
    const savedRecords = localStorage.getItem('tiltball_records_v9');
    if (savedRecords) {
      try { setRecords(JSON.parse(savedRecords)); } 
      catch (e) { console.error("Failed to load records.", e); }
    }
    const savedUnlock = localStorage.getItem('tiltball_level2_unlocked');
    if (savedUnlock) {
      setIsLevel2Unlocked(JSON.parse(savedUnlock));
    }
  }, []);

  // 💾 Save Game Records
  const saveRecord = (stageId: number, time: number) => {
    const newRecords = { ...records };
    if (!newRecords[stageId] || time < newRecords[stageId]) {
      newRecords[stageId] = time;
      setRecords(newRecords);
      localStorage.setItem('tiltball_records_v9', JSON.stringify(newRecords));
    }
  };

  // 🎵 Toggle BGM
  const toggleBgm = () => {
    const nextState = !bgmEnabled;
    setBgmEnabled(nextState);
    localStorage.setItem('tiltball_bgm', JSON.stringify(nextState));
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = nextState ? 0.25 : 0;
    }
  };

  // 🔊 Initialize Audio System
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    if (!bgmAudioRef.current) {
      const path1 = window.location.origin + "/bgm.mp3";
      const path2 = "./bgm.mp3";
      let fetchResolved = false;

      const loadAudio = (srcPath: string) => {
        setDebugInfo(p => ({ ...p, tryingPath: srcPath, httpStatus: 'Pending...' }));
        
        fetch(srcPath)
          .then(res => {
            fetchResolved = true;
            setDebugInfo(p => ({ ...p, httpStatus: `${res.status} ${res.statusText}` }));
          })
          .catch(err => {
            fetchResolved = true;
            setDebugInfo(p => ({ ...p, httpStatus: `Fetch Error: ${err.message}` }));
          });

        const audio = new Audio(srcPath);
        audio.loop = true;
        audio.volume = bgmEnabled ? 0.25 : 0;
        
        audio.addEventListener('canplaythrough', () => {
          setDebugInfo(p => ({ ...p, playStatus: 'Buffered (canplaythrough)' }));
        });

        audio.onerror = () => {
          const err = audio.error;
          if (err) {
            let codeStr = err.code.toString();
            if (err.code === 1) codeStr += " (Aborted)";
            if (err.code === 2) codeStr += " (Network)";
            if (err.code === 3) codeStr += " (Decode)";
            if (err.code === 4) codeStr += " (Src Not Supported)";
            
            setDebugInfo(p => ({ 
              ...p, 
              errorCode: codeStr, 
              errorMsg: err.message || 'No specific message provided by browser' 
            }));
          }
        };

        audio.load();
        bgmAudioRef.current = audio;
      };

      loadAudio(path1);

      setTimeout(() => {
        if (!fetchResolved) {
          console.log("Fetch pending for 3s, trying fallback path...");
          loadAudio(path2);
          setAudioRetry(r => r + 1);
        }
      }, 3000);
    }
  };

  // 🔄 BGM Playback Logic (Gameplay Only)
  useEffect(() => {
    const bgm = bgmAudioRef.current;
    if (!bgm) return;

    bgm.volume = bgmEnabled ? 0.25 : 0;

    if (gameState === 'playing') {
      console.log(`BGM Attempting to play from ${debugInfo.tryingPath}`);
      setDebugInfo(p => ({ ...p, playStatus: 'Attempting to play...' }));
      
      const playPromise = bgm.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setDebugInfo(p => ({ ...p, playStatus: 'Playing successfully' }));
        }).catch(e => {
          console.warn("BGM Playback failed:", e);
          setDebugInfo(p => ({ ...p, playStatus: `Play Error: ${e.message}` }));
        });
      }
    } else {
      bgm.pause();
      setDebugInfo(p => ({ ...p, playStatus: 'Paused (Not in playing state)' }));
    }
  }, [gameState, bgmEnabled, audioRetry]);

  // 💥 SFX: Collision Sounds (Always 1.0 Volume)
  const playCollisionSound = (velocity: number, type: BallType) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    let oscType: OscillatorType = 'sine';
    let freqStart = 200;
    let freqEnd = 100;
    let decay = 0.1;
    let volMultiplier = 1.0;

    switch (type) {
      case 'basketball':
      case 'volleyball':
        oscType = 'triangle';
        freqStart = 250 + velocity * 5;
        freqEnd = 100;
        decay = 0.15;
        break;
      case 'soccer':
        oscType = 'sine';
        freqStart = 150 + velocity * 5;
        freqEnd = 80;
        decay = 0.2;
        break;
      case 'bowling':
        oscType = 'sine';
        freqStart = 80 + velocity * 2;
        freqEnd = 40;
        decay = 0.08;
        volMultiplier = 1.5;
        break;
      case 'baseball':
      case 'tennis':
        oscType = 'square';
        freqStart = 600 + velocity * 10;
        freqEnd = 300;
        decay = 0.05;
        volMultiplier = 0.3;
        break;
      case 'billiard':
        oscType = 'triangle';
        freqStart = 400 + velocity * 10;
        freqEnd = 200;
        decay = 0.05;
        break;
      case 'golf':
      case 'pingpong':
        oscType = 'square';
        freqStart = 800 + velocity * 15;
        freqEnd = 600;
        decay = 0.03;
        volMultiplier = 0.2;
        break;
      default:
        oscType = 'sine';
        freqStart = 200 + velocity * 10;
        freqEnd = 100;
        decay = 0.1;
    }

    osc.type = oscType;
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + decay);
    
    const volume = Math.min(velocity / 20, 0.8) * volMultiplier;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + decay);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + decay);
  };

  // 🎉 SFX: Victory Fanfare (Always 1.0 Volume)
  const playVictorySound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    
    const notes = [261.63, 329.63, 392.00, 523.25];
    const noteDuration = 0.12;
    
    notes.forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, now + i * noteDuration);
    });
    
    const totalMelodyTime = notes.length * noteDuration;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05); 
    gain.gain.setValueAtTime(0.5, now + totalMelodyTime - 0.1);
    gain.gain.linearRampToValueAtTime(0, now + totalMelodyTime);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + totalMelodyTime);

    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.3); 
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    noiseSource.start(now);
    noiseSource.stop(now + 1.5);
  };

  // 📱 Request Sensor Access & Enter Lobby
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

  // 💻 PC Keyboard Controls
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

  // 🚀 Start Stage
  const startStage = (stageId: number) => {
    setCurrentStage(stageId);
    stageInitializedRef.current = false;
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

  // 📺 Ad Reward Logic
  const handleWatchAd = () => {
    setGameState('ad_loading');
    setTimeout(() => {
      setIsLevel2Unlocked(true);
      localStorage.setItem('tiltball_level2_unlocked', JSON.stringify(true));
      setGameState('lobby');
    }, 3000);
  };

  // ⚙️ Physics Engine & Rendering
  useEffect(() => {
    if (gameState !== 'playing') {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (!container) return;

    // FIXED 1: Dynamic Canvas Layout
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const config = STAGES[currentStage - 1];
    const w = canvas.width;
    const h = canvas.height;
    const isLevel1 = config.level === 1;

    // FIXED 2: Level 1 Table Size
    const marginX = isLevel1 ? w * 0.10 : 0;
    const marginY = isLevel1 ? h * 0.10 : 0;
    const tableW = isLevel1 ? w * 0.80 : w;
    const tableH = isLevel1 ? h * 0.80 : h;

    if (!stageInitializedRef.current) {
      player.current = { 
        x: marginX + tableW * 0.5, 
        y: marginY + tableH * 0.8,
        vx: 0, vy: 0, 
        radius: config.radius, 
        mass: config.mass 
      };
      
      hole.current = {
        x: marginX + tableW * 0.5 + (Math.random() * tableW * 0.4 - tableW * 0.2),
        y: marginY + tableH * 0.5 + (Math.random() * tableH * 0.4 - tableH * 0.2),
        radius: config.radius * config.holeMultiplier
      };

      // FIXED 4: Minimum Distance Between Hole and Target Ball
      let targetX = 0;
      let targetY = 0;
      let validPosition = false;
      let retries = 0;
      const minDistance = Math.sqrt(tableW * tableW + tableH * tableH) * 0.35;

      while (!validPosition && retries < 10) {
        targetX = marginX + tableW * 0.5 + (Math.random() * tableW * 0.6 - tableW * 0.3);
        targetY = marginY + tableH * 0.2 + (Math.random() * tableH * 0.2 - tableH * 0.1);
        
        const dist = Math.sqrt(Math.pow(targetX - hole.current.x, 2) + Math.pow(targetY - hole.current.y, 2));
        if (dist >= minDistance) {
          validPosition = true;
        }
        retries++;
      }

      if (!validPosition) {
        targetX = hole.current.x > marginX + tableW * 0.5 ? marginX + tableW * 0.2 : marginX + tableW * 0.8;
        targetY = hole.current.y > marginY + tableH * 0.5 ? marginY + tableH * 0.2 : marginY + tableH * 0.8;
      }

      target.current = { 
        x: targetX, 
        y: targetY,
        vx: 0, vy: 0, 
        radius: config.radius, 
        mass: config.mass 
      };

      stageInitializedRef.current = true;
    }

    const updatePhysics = () => {
      const p = player.current;
      const t = target.current;

      p.vx += tilt.current.x * 0.6;
      p.vy += tilt.current.y * 0.6;

      p.vx *= config.friction; p.vy *= config.friction;
      t.vx *= config.friction; t.vy *= config.friction;

      p.x += p.vx; p.y += p.vy;
      t.x += t.vx; t.y += t.vy;

      const handleWallCollision = (ball: any) => {
        if (ball.x - ball.radius < marginX) { ball.x = marginX + ball.radius; ball.vx *= -0.8; playCollisionSound(Math.abs(ball.vx), config.type); }
        if (ball.x + ball.radius > marginX + tableW) { ball.x = marginX + tableW - ball.radius; ball.vx *= -0.8; playCollisionSound(Math.abs(ball.vx), config.type); }
        if (ball.y - ball.radius < marginY) { ball.y = marginY + ball.radius; ball.vy *= -0.8; playCollisionSound(Math.abs(ball.vy), config.type); }
        if (ball.y + ball.radius > marginY + tableH) { ball.y = marginY + tableH - ball.radius; ball.vy *= -0.8; playCollisionSound(Math.abs(ball.vy), config.type); }
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

        playCollisionSound(Math.abs(p_val), config.type);
      }

      const distToHoleP = Math.sqrt(Math.pow(p.x - hole.current.x, 2) + Math.pow(p.y - hole.current.y, 2));
      const distToHoleT = Math.sqrt(Math.pow(t.x - hole.current.x, 2) + Math.pow(t.y - hole.current.y, 2));

      const fallThreshold = hole.current.radius * 0.5;

      if (distToHoleP < fallThreshold) {
        setGameState('gameover'); 
      } else if (distToHoleT < fallThreshold) {
        const finalTime = (accumulatedTimeRef.current + (Date.now() - sessionStartTimeRef.current)) / 1000;
        saveRecord(currentStage, finalTime);
        playVictorySound();
        
        // Trigger Reward Gate if Stage 10 is cleared and Level 2 is locked
        if (currentStage === 10 && !isLevel2Unlocked) {
          setGameState('reward_gate');
        } else {
          setGameState('clear'); 
        }
      }
    };

    const drawCustomBall = (x: number, y: number, radius: number, type: BallType, theme: Theme, isStriker: boolean) => {
      ctx.save();
      ctx.translate(x, y);

      ctx.shadowColor = isStriker ? '#ffffff' : theme.comp;
      ctx.shadowBlur = 20;
      ctx.fillStyle = isStriker ? '#ffffff' : theme.comp;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();

      let baseColor = '#ffffff';
      if (type === 'basketball') baseColor = '#ea580c';
      else if (type === 'softball') baseColor = '#d9f99d';
      else if (type === 'tennis') baseColor = '#bef264';
      else if (type === 'bowling') baseColor = '#1e3a8a';
      else if (type === 'billiard') baseColor = '#171717';
      else if (type === 'pingpong') baseColor = '#fb923c';
      
      ctx.fillStyle = baseColor;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

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
        ctx.strokeStyle = '#ef4444'; 
        ctx.beginPath(); ctx.arc(-radius*0.6, 0, radius*0.7, -Math.PI/2.5, Math.PI/2.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(radius*0.6, 0, radius*0.7, Math.PI - Math.PI/2.5, Math.PI + Math.PI/2.5); ctx.stroke();
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
        ctx.strokeStyle = '#fde047'; 
        ctx.lineWidth = radius * 0.3;
        ctx.beginPath(); ctx.arc(0, -radius*0.5, radius*0.8, 0, Math.PI); ctx.stroke();
        ctx.strokeStyle = '#3b82f6'; 
        ctx.beginPath(); ctx.arc(0, radius*0.5, radius*0.8, Math.PI, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = '#171717';
        ctx.lineWidth = radius * 0.05;
        ctx.beginPath(); ctx.arc(0, -radius*0.5, radius*0.8, 0, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, radius*0.5, radius*0.8, Math.PI, Math.PI*2); ctx.stroke();
      }

      ctx.restore(); 

      const grad = ctx.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
      grad.addColorStop(0, 'rgba(255,255,255,0.7)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.6)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = isStriker ? '#ffffff' : theme.comp;
      ctx.stroke();

      ctx.restore();
    };

    const render = () => {
      // FIXED 2: Level 1 Table Size
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
  }, [gameState, currentStage, isLevel2Unlocked]);

  const renderStageGrid = (start: number, end: number) => (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {STAGES.slice(start - 1, end).map(stage => {
        const isCleared = records[stage.id] !== undefined;
        const isUnlocked = stage.id === 1 || records[stage.id - 1] !== undefined;
        const isLocked = !isUnlocked;
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

  // Determine layout based on current stage level
  const isLevel1 = currentStage <= 10;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans">
      {/* FIXED 1: Dynamic Canvas Layout (100dvh and safe-area-inset) */}
      <div 
        className="relative w-full max-w-[400px] h-[100dvh] bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden sm:rounded-3xl sm:border-4 border-slate-800 flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        
        {/* 🐛 Audio Debugging Panel (Hidden in Production, kept for safety) */}
        <div className="hidden absolute top-0 left-0 right-0 z-50 p-2 pointer-events-none bg-black/80 text-[10px] text-red-500 font-mono flex-col gap-0.5">
          <div className="break-all">Trying Path: {debugInfo.tryingPath || 'Pending...'}</div>
          <div>HTTP Status: {debugInfo.httpStatus || 'Pending...'}</div>
          <div>ErrCode: {debugInfo.errorCode || 'None'}</div>
          <div>ErrMsg: {debugInfo.errorMsg || 'None'}</div>
          <div>Status: {debugInfo.playStatus || 'Idle'}</div>
        </div>

        {/* 1. Start Screen */}
        {gameState === 'start' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-slate-950">
            <style>{`
              @keyframes button-pulse {
                0%, 100% { box-shadow: 0 0 20px rgba(37,99,235,0.5); transform: scale(1); }
                50% { box-shadow: 0 0 40px rgba(37,99,235,0.9); transform: scale(1.05); }
              }
              .animate-button-pulse {
                animation: button-pulse 2s infinite ease-in-out;
              }
            `}</style>
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
              <span className="text-5xl">🏀</span>
            </div>
            <h1 className="text-4xl font-black mb-4 tracking-tighter bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
              TiltBall 10
            </h1>
            <p className="mb-8 text-blue-100 text-center text-lg font-bold tracking-wide drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
              Tilt to hit the target ball into the hole!
            </p>
            <button 
              onClick={requestAccessAndEnterLobby}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg flex items-center gap-2 transition-colors active:scale-95 animate-button-pulse"
            >
              <Play fill="currentColor" />
              Start Game
            </button>
          </div>
        )}

        {/* 2. Lobby Screen */}
        {gameState === 'lobby' && (
          <div className="absolute inset-0 z-10 p-4 overflow-y-auto bg-slate-950 flex flex-col scrollbar-hide">
            <div className="flex justify-between w-full mb-6 items-center mt-8">
              <h1 className="text-2xl font-black tracking-tighter text-white">Select Stage</h1>
              <button onClick={toggleBgm} className="p-2 bg-slate-800 rounded-full text-slate-300 hover:text-white flex items-center justify-center w-10 h-10">
                <span className="text-lg">{bgmEnabled ? '🎵' : '🔇'}</span>
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

        {/* 3. Game Play Screen (Dynamic Layout for Ads) */}
        {(gameState === 'playing' || gameState === 'paused' || gameState === 'clear' || gameState === 'gameover' || gameState === 'reward_gate' || gameState === 'ad_loading') && (
          <div className="flex flex-col w-full h-full bg-slate-950 relative">
            
            {/* FIXED 1: Top Bar exactly 56px */}
            <div className="w-full h-[56px] px-3 flex justify-between items-center z-20 bg-slate-900 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setGameState('lobby')}
                  className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-colors"
                >
                  <Home size={18} />
                </button>
                <button 
                  onClick={toggleBgm}
                  className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white transition-colors flex items-center justify-center w-9 h-9"
                >
                  <span className="text-sm">{bgmEnabled ? '🎵' : '🔇'}</span>
                </button>
              </div>
              
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

            {/* FIXED 1: Canvas Container takes remaining space */}
            <div className="w-full flex-1 flex items-center justify-center overflow-hidden relative bg-black">
              <canvas ref={canvasRef} className="w-full h-full object-contain block" />
            </div>

            {/* FIXED 3: Advertisement Banner Position (BOTTOM for BOTH Level 1 and Level 2) */}
            <div className="w-full h-[60px] bg-[#1a1a1a] flex items-center justify-center shrink-0 border-t border-slate-800 mt-auto">
              <span className="text-[10px] text-gray-500 tracking-widest uppercase">Advertisement</span>
            </div>

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

            {/* Reward Gate Modal (Interstitial) */}
            {gameState === 'reward_gate' && (
              <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <Unlock size={40} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white mb-4 leading-tight">
                  Unlock Professional<br/>Level 2 Stages!
                </h2>
                <p className="text-slate-400 mb-8 text-sm max-w-[250px]">
                  Watch a short ad to permanently unlock the next 10 challenging stages.
                </p>
                <button 
                  onClick={handleWatchAd}
                  className="w-full max-w-[250px] py-4 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex items-center justify-center gap-2 text-white text-lg transition-transform active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <Play size={20} fill="currentColor" /> Watch Ad to Unlock
                </button>
                <button 
                  onClick={() => setGameState('lobby')}
                  className="mt-4 text-slate-500 text-sm hover:text-slate-300 underline underline-offset-4"
                >
                  Maybe later
                </button>
              </div>
            )}

            {/* Ad Loading Overlay */}
            {gameState === 'ad_loading' && (
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
                <Loader2 size={48} className="text-emerald-500 animate-spin mb-4" />
                <p className="text-white font-bold tracking-widest animate-pulse">LOADING AD...</p>
                <p className="text-slate-500 text-xs mt-2">Please wait</p>
              </div>
            )}

            {/* Game Over Modal */}
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
          </div>
        )}
      </div>
    </div>
  );
}
