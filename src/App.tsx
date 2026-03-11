import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Lock, Unlock, Trophy, Home, Pause, X, Loader2, Info } from 'lucide-react';

// ============================================================================
// [TiltBall 10 - Targeted Production Update]
// 1. Level 1: Increased table ratio to 78% for optimal difficulty.
// 2. Level 2: Dynamic height calculation to prevent bottom line clipping in App environments.
// 3. UX: Added "How to Play" visual instruction modal on the Start screen.
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
  const [gameState, setGameState] = useState<'start' | 'lobby' | 'playing' | 'paused' | 'clear' | 'gameover' | 'reward_gate' | 'ad_loading'>('start');
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [records, setRecords] = useState<Record<number, number>>({});
  const [isLevel2Unlocked, setIsLevel2Unlocked] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState(false); // For Instruction Page
  
  const [displayTime, setDisplayTime] = useState(0);
  const accumulatedTimeRef = useRef(0);
  const sessionStartTimeRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  const player = useRef({ x: 50, y: 50, vx: 0, vy: 0, radius: 15, mass: 2.0 });
  const target = useRef({ x: 200, y: 200, vx: 0, vy: 0, radius: 20, mass: 2.0 });
  const hole = useRef({ x: 300, y: 300, radius: 30 });
  const tilt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const savedRecords = localStorage.getItem('tiltball_records_v10');
    if (savedRecords) setRecords(JSON.parse(savedRecords));
    const savedUnlock = localStorage.getItem('tiltball_level2_unlocked');
    if (savedUnlock) setIsLevel2Unlocked(JSON.parse(savedUnlock));
  }, []);

  const startStage = (stageId: number) => {
    const config = STAGES[stageId - 1];
    setCurrentStage(stageId);
    
    const LOGICAL_W = 400;
    const LOGICAL_H = 711;
    const isLevel1 = config.level === 1;

    // Fixed 1: Optimal Ratio Calculation (Level 1: 78% of screen)
    const marginX = isLevel1 ? LOGICAL_W * 0.11 : 0; 
    const marginY = isLevel1 ? LOGICAL_H * 0.11 : 0;
    const tableW = isLevel1 ? LOGICAL_W * 0.78 : LOGICAL_W;
    const tableH = isLevel1 ? LOGICAL_H * 0.78 : LOGICAL_H;

    player.current = { x: marginX + tableW * 0.5, y: marginY + tableH * 0.8, vx: 0, vy: 0, radius: config.radius, mass: config.mass };
    target.current = { x: marginX + tableW * 0.5, y: marginY + tableH * 0.2, vx: 0, vy: 0, radius: config.radius, mass: config.mass };
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

      // Ensure margins match calculation
      const marginX = isLevel1 ? w * 0.11 : 0;
      const marginY = isLevel1 ? h * 0.11 : 0;
      const tableW = isLevel1 ? w * 0.78 : w;
      const tableH = isLevel1 ? h * 0.78 : h;

      p.vx += tilt.current.x * 0.6; p.vy += tilt.current.y * 0.6;
      p.vx *= config.friction; p.vy *= config.friction;
      t.vx *= config.friction; t.vy *= config.friction;
      p.x += p.vx; p.y += p.vy;
      t.x += t.vx; t.y += t.vy;

      const walls = (ball: any) => {
        if (ball.x - ball.radius < marginX) { ball.x = marginX + ball.radius; ball.vx *= -0.8; }
        if (ball.x + ball.radius > marginX + tableW) { ball.x = marginX + tableW - ball.radius; ball.vx *= -0.8; }
        if (ball.y - ball.radius < marginY) { ball.y = marginY + ball.radius; ball.vy *= -0.8; }
        if (ball.y + ball.radius > marginY + tableH) { ball.y = marginY + tableH - ball.radius; ball.vy *= -0.8; }
      };
      walls(p); walls(t);

      const dx = t.x - p.x, dy = t.y - p.y, dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < p.radius + t.radius) {
        const nx = dx/dist, ny = dy/dist, overlap = (p.radius + t.radius - dist)/2;
        p.x -= nx*overlap; p.y -= ny*overlap;
        t.x += nx*overlap; t.y += ny*overlap;
        const kx = p.vx - t.vx, ky = p.vy - t.vy, p_val = 2.0 * (nx*kx + ny*ky) / (p.mass + t.mass);
        p.vx -= p_val * t.mass * nx; p.vy -= p_val * t.mass * ny;
        t.vx += p_val * p.mass * nx; t.vy += p_val * p.mass * ny;
      }

      if (Math.sqrt(Math.pow(p.x - hole.current.x, 2) + Math.pow(p.y - hole.current.y, 2)) < hole.current.radius * 0.5) setGameState('gameover');
      else if (Math.sqrt(Math.pow(t.x - hole.current.x, 2) + Math.pow(t.y - hole.current.y, 2)) < hole.current.radius * 0.5) setGameState('clear');
    };

    const draw = () => {
      const w = canvas.width, h = canvas.height, isLevel1 = config.level === 1;
      const marginX = isLevel1 ? w * 0.11 : 0, marginY = isLevel1 ? h * 0.11 : 0;
      const tableW = isLevel1 ? w * 0.78 : w, tableH = isLevel1 ? h * 0.78 : h;

      ctx.fillStyle = '#020617'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = config.theme.bg; ctx.fillRect(marginX, marginY, tableW, tableH);
      ctx.strokeStyle = config.theme.neon; ctx.lineWidth = 6; ctx.strokeRect(marginX+3, marginY+3, tableW-6, tableH-6);
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hole.current.x, hole.current.y, hole.current.radius, 0, Math.PI*2); ctx.fill();
      
      const drawBall = (b: any, emoji: string, isStriker: boolean) => {
        ctx.save(); ctx.translate(b.x, b.y); ctx.font = `${b.radius * 2}px Arial`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(isStriker ? '⚪' : emoji, 0, 0); ctx.restore();
      };
      drawBall(target.current, config.emoji, false); drawBall(player.current, config.emoji, true);
      setDisplayTime((accumulatedTimeRef.current + (Date.now() - sessionStartTimeRef.current))/1000);
    };

    const loop = () => { updatePhysics(); draw(); requestRef.current = requestAnimationFrame(loop); };
    requestRef.current = requestAnimationFrame(loop);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, currentStage]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans">
      <div className="relative w-full max-w-[400px] aspect-[9/16] h-[96vh] bg-slate-950 shadow-2xl overflow-hidden sm:rounded-3xl border-slate-800 flex flex-col">
        
        {/* 1. Start Screen with Instruction Button */}
        {gameState === 'start' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 bg-slate-950">
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-8 shadow-2xl animate-bounce text-5xl">🏀</div>
            <h1 className="text-4xl font-black mb-4 text-white">TiltBall 10</h1>
            <button onClick={() => setGameState('lobby')} className="w-full py-4 bg-blue-600 text-white rounded-full font-bold text-xl mb-4 shadow-lg active:scale-95">Start Game</button>
            <button onClick={() => setShowTutorial(true)} className="w-full py-3 bg-slate-800 text-slate-300 rounded-full font-bold flex items-center justify-center gap-2">
              <Info size={20} /> How to Play
            </button>
          </div>
        )}

        {/* 2. Instruction Modal (Animated Visual Tutorial) */}
        {showTutorial && (
          <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-6 text-center">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 w-full">
              <h2 className="text-2xl font-black text-white mb-8">How to Play</h2>
              <div className="flex flex-col gap-8 mb-10">
                <div className="flex items-center gap-5 text-left">
                  <div className="text-4xl animate-bounce">📱</div>
                  <div><p className="font-bold text-white uppercase">Tilt Device</p><p className="text-sm text-slate-400">Move the white ball</p></div>
                </div>
                <div className="flex items-center gap-5 text-left">
                  <div className="text-4xl animate-pulse">⚪ ➔ 🏀</div>
                  <div><p className="font-bold text-white uppercase">Hit Target</p><p className="text-sm text-slate-400">Push the target ball</p></div>
                </div>
                <div className="flex items-center gap-5 text-left">
                  <div className="text-4xl">🎯</div>
                  <div><p className="font-bold text-white uppercase">Goal</p><p className="text-sm text-slate-400">Put target in the hole!</p></div>
                </div>
              </div>
              <button onClick={() => setShowTutorial(false)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg">GOT IT!</button>
            </div>
          </div>
        )}

        {/* lobby, reward_gate... */}
        {gameState === 'lobby' && (
          <div className="absolute inset-0 z-10 p-4 bg-slate-950 overflow-y-auto scrollbar-hide">
            <h1 className="text-2xl font-bold text-white mb-6">Select Stage</h1>
            <div className="grid grid-cols-5 gap-2">
              {STAGES.map(s => (
                <button key={s.id} onClick={() => startStage(s.id)} className="aspect-square bg-slate-800 rounded-lg text-white font-bold">{s.id}</button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Game UI (Dynamic Height for Ads) */}
        {['playing', 'paused', 'clear', 'gameover', 'reward_gate'].includes(gameState) && (
          <div className="flex flex-col w-full h-full relative">
            {/* Level 2 Ad Slot (TOP) */}
            {currentStage > 10 && <div className="h-[60px] bg-[#1a1a1a] flex items-center justify-center text-[10px] text-slate-500 shrink-0 border-b border-slate-800">ADVERTISEMENT</div>}
            
            <div className="p-3 flex justify-between items-center bg-slate-900 shrink-0 z-20">
              <button onClick={() => setGameState('lobby')}><Home size={20} className="text-white"/></button>
              <span className="text-white font-bold">STAGE {currentStage}</span>
              <span className="text-white font-mono">{displayTime.toFixed(1)}s</span>
            </div>

            {/* Game Canvas - Fixed Clipping with Dynamic Calculation */}
            <div className={`w-full flex items-center justify-center bg-black relative overflow-hidden ${currentStage <= 10 ? 'h-[calc(100%-110px)]' : 'h-[calc(100%-170px)]'}`}>
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>

            {/* Level 1 Ad Slot (BOTTOM) */}
            {currentStage <= 10 && <div className="h-[60px] bg-[#1a1a1a] flex items-center justify-center text-[10px] text-slate-500 shrink-0 border-t border-slate-800">ADVERTISEMENT</div>}
          </div>
        )}

        {/* Modals for clear, gameover... */}
        {gameState === 'gameover' && (
          <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center">
            <div className="text-6xl mb-6">💀</div>
            <h2 className="text-3xl font-black text-red-500 mb-8 tracking-widest">GAME OVER</h2>
            <button onClick={() => startStage(currentStage)} className="px-10 py-4 bg-blue-600 text-white rounded-full font-bold shadow-xl">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
}
