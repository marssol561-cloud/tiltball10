import React, { useState, useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { Play, RotateCcw, Lock, Unlock, Home, Pause, X, Loader2, Info } from 'lucide-react';

// --- Constants & Global Config ---
const APP_ID = 'tiltball-10-production-v1';
const SAFE_AREA_TOP = 30; // Mobile status bar/notch padding
const AD_HEIGHT = 60;

const BALL_STYLES = {
  basketball: { emoji: '🏀', color: '#ff8c00', mass: 3.0, radius: 22 },
  soccer: { emoji: '⚽', color: '#ffffff', mass: 2.5, radius: 20 },
  volleyball: { emoji: '🏐', color: '#ffeb3b', mass: 2.0, radius: 18 },
  tennis: { emoji: '🎾', color: '#ccff00', mass: 1.2, radius: 14 },
  pool: { emoji: '🎱', color: '#f44336', mass: 2.5, radius: 16 },
  baseball: { emoji: '⚾', color: '#eeeeee', mass: 1.5, radius: 15 },
};

const STAGES = Array.from({ length: 20 }, (_, i) => {
  const types = Object.keys(BALL_STYLES);
  return {
    id: i + 1,
    level: i < 10 ? 1 : 2,
    type: types[i % types.length],
  };
});

const THEMES = ['#020617', '#042f2e', '#1c1917', '#000000'];

export default function App() {
  // --- States ---
  const [gameState, setGameState] = useState('start'); 
  const [currentStage, setCurrentStage] = useState(1);
  const [unlockedStage, setUnlockedStage] = useState(1);
  const [isLevel2Unlocked, setIsLevel2Unlocked] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [showHowTo, setShowHowTo] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // --- Refs ---
  const sceneRef = useRef(null);
  const engineRef = useRef(Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0.001 } }));
  const bgmRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const [positions, setPositions] = useState({ player: { x: 0, y: 0 }, target: { x: 0, y: 0 } });

  // --- Initialization & LocalStorage ---
  useEffect(() => {
    const savedStage = localStorage.getItem(`${APP_ID}-max-stage`);
    const savedL2 = localStorage.getItem(`${APP_ID}-l2-unlocked`);
    if (savedStage) setUnlockedStage(parseInt(savedStage));
    if (savedL2 === 'true') setIsLevel2Unlocked(true);

    // BGM Pre-setup
    bgmRef.current = new Audio('/bgm.mp3');
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.35;

    // Mobile Hardware Back Button Support (App Environment Specific)
    const handlePopState = (e) => {
      e.preventDefault();
      setGameState(prev => {
        if (prev === 'playing') {
            setIsPaused(true);
            return 'paused';
        }
        if (prev !== 'start' && prev !== 'lobby') return 'lobby';
        return prev;
      });
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Audio Logic ---
  const initAudioSystem = () => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
  };

  useEffect(() => {
    if (!bgmRef.current) return;
    if (gameState === 'playing' && !isPaused && bgmEnabled) {
      bgmRef.current.play().catch(() => {});
    } else {
      bgmRef.current.pause();
    }
  }, [gameState, isPaused, bgmEnabled]);

  const playSFX = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }, []);

  // --- Physics Engine Lifecycle ---
  useEffect(() => {
    if (gameState !== 'playing' || isPaused || !sceneRef.current) return;

    const engine = engineRef.current;
    const { world } = engine;
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);

    const width = sceneRef.current.clientWidth;
    const height = sceneRef.current.clientHeight;

    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width,
        height,
        background: 'transparent',
        wireframes: false,
      }
    });

    const config = STAGES[currentStage - 1];
    const ballStyle = BALL_STYLES[config.type];

    // Responsive Walls
    const wallOptions = { isStatic: true, render: { fillStyle: '#333' } };
    const walls = [
      Matter.Bodies.rectangle(width / 2, -10, width, 20, wallOptions), // Top
      Matter.Bodies.rectangle(width / 2, height + 10, width, 20, wallOptions), // Bottom
      Matter.Bodies.rectangle(-10, height / 2, 20, height, wallOptions), // Left
      Matter.Bodies.rectangle(width + 10, height / 2, 20, height, wallOptions) // Right
    ];

    // Entities
    const player = Matter.Bodies.circle(width * 0.5, height * 0.8, ballStyle.radius, {
      restitution: 0.6, friction: 0.01, render: { fillStyle: '#fff' }, label: 'player'
    });
    const target = Matter.Bodies.circle(width * 0.5, height * 0.2, ballStyle.radius, {
      restitution: 0.6, friction: 0.01, render: { fillStyle: ballStyle.color }, label: 'target'
    });
    const hole = Matter.Bodies.circle(width * 0.5 + (Math.random() * 40 - 20), height * 0.5, ballStyle.radius * 1.6, {
      isStatic: true, isSensor: true, render: { fillStyle: '#000', strokeStyle: '#06b6d4', lineWidth: 4 }, label: 'hole'
    });

    Matter.World.add(world, [...walls, player, target, hole]);
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setDisplayTime(elapsed);
      setPositions({ player: { x: player.position.x, y: player.position.y }, target: { x: target.position.x, y: target.position.y } });
    }, 50);

    const collisionHandler = (e) => {
      e.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        if ((bodyA.label === 'player' && bodyB.label === 'target') || (bodyB.label === 'player' && bodyA.label === 'target')) {
          playSFX();
        }
        if (bodyA.label === 'hole' || bodyB.label === 'hole') {
          const ball = bodyA.label === 'hole' ? bodyB : bodyA;
          const dist = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position));
          if (dist < ballStyle.radius * 0.8) {
            if (ball.label === 'player') {
                setGameState('gameover');
            } else if (ball.label === 'target') {
              if (currentStage === 10 && !isLevel2Unlocked) {
                  setGameState('reward_gate');
              } else {
                  setGameState('clear');
              }
              if (currentStage === unlockedStage) {
                const next = currentStage + 1;
                setUnlockedStage(next);
                localStorage.setItem(`${APP_ID}-max-stage`, next.toString());
              }
            }
          }
        }
      });
    };
    Matter.Events.on(engine, 'collisionStart', collisionHandler);

    const orientationHandler = (e) => {
      if (gameState !== 'playing' || isPaused) return;
      engine.world.gravity.x = Math.max(-1.5, Math.min(1.5, e.gamma / 30));
      engine.world.gravity.y = Math.max(-1.5, Math.min(1.5, e.beta / 30));
    };
    window.addEventListener('deviceorientation', orientationHandler);

    return () => {
      window.removeEventListener('deviceorientation', orientationHandler);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      clearInterval(timerRef.current);
    };
  }, [gameState, isPaused, currentStage, playSFX]);

  const isLevel1 = currentStage <= 10;

  return (
    <div className="flex flex-col h-screen bg-[#05050a] text-white font-sans overflow-hidden select-none">
      
      {/* Top Safe Area */}
      <div style={{ height: SAFE_AREA_TOP }} className="shrink-0 bg-slate-900/20" />

      {/* --- Level 2 Ad Slot: TOP (Google AdMob Compliant) --- */}
      {!isLevel1 && gameState === 'playing' && (
        <div className="h-[60px] w-full bg-[#1a1a1a] flex items-center justify-center border-b border-white/5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest border border-gray-700 px-2 py-0.5 rounded">Advertisement</span>
        </div>
      )}

      <main className="flex-grow flex flex-col relative">
        
        {/* Main Menu Layer */}
        {gameState === 'start' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
            <button onClick={() => setShowHowTo(true)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white">
              <Info size={24} />
            </button>
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(37,99,235,0.4)] animate-bounce text-5xl">🏀</div>
            <h1 className="text-5xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">TiltBall 10</h1>
            <p className="text-blue-200 font-medium mb-10">Global Physics Challenge</p>
            <button 
              onClick={() => { initAudioSystem(); setGameState('lobby'); }}
              className="px-12 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-all animate-pulse"
            >
              START GAME
            </button>
          </div>
        )}

        {/* Stage Selection Layer */}
        {gameState === 'lobby' && (
          <div className="flex-1 p-6 overflow-y-auto scrollbar-hide bg-slate-950">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black italic">Stages</h2>
              <button onClick={() => setBgmEnabled(!bgmEnabled)} className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-lg">
                {bgmEnabled ? '🎵' : '🔇'}
              </button>
            </div>
            
            <div className="space-y-12">
              <section>
                <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">🟢 Level 1 <span className="text-[10px] bg-emerald-400/20 px-2 py-0.5 rounded">Beginner</span></h3>
                <div className="grid grid-cols-5 gap-3">
                  {STAGES.slice(0, 10).map((s) => (
                    <button 
                      key={s.id}
                      disabled={s.id > unlockedStage}
                      onClick={() => { setCurrentStage(s.id); setGameState('playing'); }}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold border-b-4 transition-all ${s.id <= unlockedStage ? 'bg-white/10 border-blue-600 active:translate-y-1 shadow-md' : 'bg-white/5 opacity-30 border-transparent'}`}
                    >
                      {s.id <= unlockedStage ? s.id : <Lock size={16} />}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-orange-400 font-bold mb-4 flex items-center gap-2">🔴 Level 2 {!isLevel2Unlocked && <Lock size={14} />}</h3>
                <div className={`grid grid-cols-5 gap-3 transition-opacity duration-500 ${!isLevel2Unlocked ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                  {STAGES.slice(10, 20).map((s) => (
                    <button 
                      key={s.id}
                      disabled={s.id > unlockedStage}
                      onClick={() => { setCurrentStage(s.id); setGameState('playing'); }}
                      className={`aspect-square rounded-xl flex items-center justify-center text-lg font-bold border-b-4 transition-all ${s.id <= unlockedStage ? 'bg-white/10 border-orange-600 shadow-md' : 'bg-white/5'}`}
                    >
                      {s.id <= unlockedStage ? s.id : <Lock size={16} />}
                    </button>
                  ))}
                </div>
                {!isLevel2Unlocked && unlockedStage > 10 && (
                  <button 
                    onClick={() => setGameState('reward_gate')}
                    className="w-full mt-6 py-4 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold text-lg shadow-lg animate-pulse"
                  >
                    Unlock Level 2 🔓
                  </button>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Core Game UI Layer */}
        {['playing', 'paused', 'clear', 'gameover', 'reward_gate', 'ad_loading'].includes(gameState) && (
          <div className="flex-1 flex flex-col relative bg-black">
            <div className="p-4 flex justify-between items-center z-20">
              <button onClick={() => setGameState('lobby')} className="p-2 bg-white/5 rounded-xl"><Home size={20} /></button>
              <div className="text-center">
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Stage</p>
                <p className="text-2xl font-black italic">{currentStage}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm w-12 text-right">{displayTime.toFixed(1)}s</span>
                <button onClick={() => setIsPaused(true)} className="p-2 bg-blue-600 rounded-xl shadow-lg"><Pause size={20} fill="currentColor" /></button>
              </div>
            </div>

            {/* --- Dynamic Canvas: Calculated to solve Resolution & Clipping issues --- */}
            <div 
              ref={sceneRef} 
              className={`w-[92%] mx-auto bg-[#0a0a15] rounded-3xl border-4 border-white/5 shadow-2xl relative overflow-hidden shrink-0 transition-all duration-700 ${isLevel1 ? 'h-[70%]' : 'h-[calc(100%-120px)]'}`}
              style={{ backgroundColor: THEMES[(currentStage - 1) % THEMES.length] }}
            >
              {/* --- Stage 1-1 Tutorial (Fades out after 3 seconds) --- */}
              {gameState === 'playing' && currentStage === 1 && displayTime < 3 && (
                <div className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-1000" style={{ opacity: displayTime > 2.5 ? (3 - displayTime) * 2 : 1 }}>
                  <div className="absolute text-center" style={{ left: positions.target.x - 50, top: positions.target.y - 70 }}>
                    <div className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl whitespace-nowrap animate-bounce">PUT ME IN THE HOLE!</div>
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-orange-500 mx-auto" />
                  </div>
                  <div className="absolute text-center" style={{ left: positions.player.x - 50, top: positions.player.y - 70 }}>
                    <div className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-xl whitespace-nowrap animate-pulse">TILT TO MOVE ME!</div>
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-blue-600 mx-auto" />
                  </div>
                </div>
              )}
            </div>

            {/* Empty Space usage for better UX */}
            <div className="flex-grow flex items-center justify-center px-10 text-center opacity-40">
              <p className="text-[10px] font-medium leading-relaxed uppercase tracking-tighter">
                Control the sphere using device gravity. Aim for the black hole.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* --- Level 1 Ad Slot: BOTTOM (Safe for tilt control grip) --- */}
      {isLevel1 && gameState === 'playing' && (
        <div className="h-[60px] w-full bg-[#1a1a1a] flex items-center justify-center border-t border-white/5 shrink-0">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest border border-gray-700 px-2 py-0.5 rounded">Advertisement</span>
        </div>
      )}

      {/* --- Modals --- */}
      {showHowTo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 text-center">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl">
            <h2 className="text-3xl font-black italic text-blue-400">Tutorial</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-5 bg-white/5 p-4 rounded-2xl">
                <span className="text-4xl">📱</span>
                <div className="text-left"><p className="font-bold">MOTION SENSOR</p><p className="text-xs text-gray-400">Tilt your phone to steer.</p></div>
              </div>
              <div className="flex items-center gap-5 bg-white/5 p-4 rounded-2xl">
                <span className="text-4xl">⚽</span>
                <div className="text-left"><p className="font-bold">YOUR BALL</p><p className="text-xs text-gray-400">Control the white striker ball.</p></div>
              </div>
              <div className="flex items-center gap-5 bg-white/5 p-4 rounded-2xl">
                <span className="text-4xl">🎯</span>
                <div className="text-left"><p className="font-bold">THE GOAL</p><p className="text-xs text-gray-400">Push the target into the hole.</p></div>
              </div>
            </div>
            <button onClick={() => setShowHowTo(false)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xl shadow-lg transition-all">GOT IT!</button>
          </div>
        </div>
      )}

      {gameState === 'reward_gate' && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center p-10 text-center">
          <div className="w-full max-w-sm">
            <Unlock size={72} className="mx-auto text-emerald-400 mb-8 animate-pulse" />
            <h2 className="text-3xl font-black italic mb-4">Level 2 Locked</h2>
            <p className="text-gray-400 mb-12 leading-relaxed">Watch a short advertisement to permanently unlock all Professional stages.</p>
            <button 
              onClick={() => { setGameState('ad_loading'); setTimeout(() => { setIsLevel2Unlocked(true); localStorage.setItem(`${APP_ID}-l2-unlocked`, 'true'); setGameState('lobby'); }, 3000); }}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all"
            >
              WATCH AD & UNLOCK 🎬
            </button>
            <button onClick={() => setGameState('lobby')} className="mt-8 text-slate-500 underline underline-offset-4">Not now</button>
          </div>
        </div>
      )}

      {gameState === 'ad_loading' && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center">
          <Loader2 size={60} className="text-emerald-500 animate-spin mb-6" />
          <p className="text-emerald-500 font-black tracking-widest animate-pulse text-lg">LOADING ADVERTISEMENT...</p>
        </div>
      )}

      {gameState === 'clear' && (
        <div className="fixed inset-0 bg-emerald-600/20 backdrop-blur-sm z-[100] flex items-center justify-center p-8">
          <div className="w-full max-w-sm bg-[#05050a] border-4 border-emerald-500 rounded-3xl p-10 text-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
            <div className="text-7xl mb-6">🏆</div>
            <h2 className="text-4xl font-black text-emerald-400 mb-10 italic">STAGE CLEAR!</h2>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setGameState('lobby')} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold transition-all uppercase">Menu</button>
              <button onClick={() => { setCurrentStage(currentStage + 1); setGameState('playing'); }} className="py-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl font-bold transition-all uppercase shadow-lg">Next</button>
            </div>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-lg z-[150] flex flex-col items-center justify-center p-10">
          <h2 className="text-6xl font-black italic mb-16 tracking-tighter text-blue-400 drop-shadow-[0_0_20px_rgba(37,99,235,0.4)]">PAUSED</h2>
          <div className="w-full max-w-xs space-y-5">
            <button onClick={() => setIsPaused(false)} className="w-full py-6 bg-blue-600 hover:bg-blue-500 rounded-3xl font-black text-2xl shadow-2xl flex items-center justify-center gap-4 transition-all">
              <Play fill="currentColor" size={28} /> RESUME
            </button>
            <button onClick={() => { setIsPaused(false); setGameState('playing'); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all">
              <RotateCcw size={22} /> RESTART
            </button>
            <button onClick={() => { setIsPaused(false); setGameState('lobby'); }} className="w-full py-3 text-slate-500 hover:text-slate-300 transition-colors uppercase font-bold tracking-widest">Quit to Lobby</button>
          </div>
        </div>
      )}

    </div>
  );
}
