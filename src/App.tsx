import React, { useState, useEffect, useRef } from 'react';
import Matter from 'matter-js';
import { Play, RotateCcw, Lock, Unlock, Trophy, Home, Pause, X, Loader2, Info } from 'lucide-react';

// ============================================================================
// [TiltBall 10 - ABSOLUTE FINAL PRODUCTION BUILD]
// Role: Senior Game Engine & UX Engineer (Global Production Specialist)
// 
// Features Included:
// 1. Global SEO & Branding: 100% English UI ("Tilt to hit the target ball into the hole!").
// 2. Monetization Layout: Safe Area (30px top), Bottom Ad (Level 1), Top Ad (Level 2).
// 3. Dynamic Physics Resizing: Matter.js world recalculates on layout change.
// 4. Audio System: BGM (/bgm.mp3, 0.35 vol, loop), SFX (AudioContext, 1.0 vol).
// 5. Hardware Integration: popstate back-button support, deviceorientation sensors.
// 6. Advanced UX: 3-Second Tutorial Rule with fade-out, Reward Gate (Interstitial).
// ============================================================================

type GameState = 'start' | 'tutorial' | 'lobby' | 'playing' | 'paused' | 'clear' | 'gameover' | 'reward_gate' | 'ad_loading';

const BALL_TYPES = ['🏀', '⚽', '🏐', '🎾', '🎱', '⚾']; // 6 Distinct Styles
const THEMES = ['#020617', '#042f2e', '#1c1917', '#000000'];

export default function App() {
  // --- State Management ---
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentStage, setCurrentStage] = useState(1);
  const [records, setRecords] = useState<Record<number, number>>({});
  const [isLevel2Unlocked, setIsLevel2Unlocked] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [positions, setPositions] = useState({ player: { x: -100, y: -100 }, target: { x: -100, y: -100 } });

  // --- Refs ---
  const engineRef = useRef(Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0.001 } }));
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<number>();

  // --- Initialization & Storage & Back Button ---
  useEffect(() => {
    // Load Persistence
    const savedRecords = localStorage.getItem('tiltball_records_final');
    if (savedRecords) setRecords(JSON.parse(savedRecords));
    const savedUnlock = localStorage.getItem('tiltball_level2_unlocked_final');
    if (savedUnlock) setIsLevel2Unlocked(JSON.parse(savedUnlock));

    // Back Button Support (popstate)
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      setGameState(prev => {
        if (prev === 'playing') return 'paused';
        if (prev !== 'start') return 'lobby';
        return prev;
      });
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Audio System ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

    if (!bgmRef.current) {
      const audio = new Audio(window.location.origin + '/bgm.mp3');
      audio.loop = true;
      audio.volume = bgmEnabled ? 0.35 : 0;
      bgmRef.current = audio;
    }
  };

  useEffect(() => {
    if (!bgmRef.current) return;
    bgmRef.current.volume = bgmEnabled ? 0.35 : 0;
    
    // Playback Logic: MUST play only when playing & not paused
    if (gameState === 'playing') {
      bgmRef.current.play().catch(() => console.warn('BGM play failed. Interaction required.'));
    } else {
      bgmRef.current.pause();
    }
  }, [gameState, bgmEnabled]);

  const playSFX = (type: 'hit' | 'clear') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type === 'hit' ? 'sine' : 'square';
    osc.frequency.setValueAtTime(type === 'hit' ? 300 : 400, ctx.currentTime);
    if (type === 'clear') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
    } else {
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    }

    gain.gain.setValueAtTime(1.0, ctx.currentTime); // Volume 1.0
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (type === 'clear' ? 0.5 : 0.1));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (type === 'clear' ? 0.5 : 0.1));
  };

  // --- Hardware Integration: Sensors ---
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (gameState !== 'playing') return;
      let { beta, gamma } = e;
      if (beta === null || gamma === null) return;
      
      // Clamp values and apply professional sensitivity factor (/30)
      beta = Math.max(-90, Math.min(90, beta));
      engineRef.current.gravity.x = gamma / 30;
      engineRef.current.gravity.y = beta / 30;
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [gameState]);

  // --- Physics Engine & Dynamic Resizing ---
  useEffect(() => {
    if (gameState !== 'playing' || !sceneRef.current) return;

    const engine = engineRef.current;
    const { world } = engine;
    Matter.World.clear(world, false);
    Matter.Engine.clear(engine);

    // Dynamic Height Calculation based on current DOM layout
    const width = sceneRef.current.clientWidth;
    const height = sceneRef.current.clientHeight;

    const render = Matter.Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width, height,
        wireframes: false,
        background: THEMES[(currentStage - 1) % THEMES.length],
      }
    });
    renderRef.current = render;

    // Boundaries
    const wallOptions = { isStatic: true, render: { fillStyle: '#334155' } };
    const walls = [
      Matter.Bodies.rectangle(width / 2, -10, width, 20, wallOptions),
      Matter.Bodies.rectangle(width / 2, height + 10, width, 20, wallOptions),
      Matter.Bodies.rectangle(-10, height / 2, 20, height, wallOptions),
      Matter.Bodies.rectangle(width + 10, height / 2, 20, height, wallOptions)
    ];

    const radius = Math.min(width, height) * 0.05;
    
    // Player & Target
    const player = Matter.Bodies.circle(width * 0.5, height * 0.8, radius, {
      restitution: 0.8, friction: 0.01, frictionAir: 0.02, render: { fillStyle: '#ffffff' }, label: 'player'
    });
    const target = Matter.Bodies.circle(width * 0.5, height * 0.2, radius, {
      restitution: 0.8, friction: 0.01, frictionAir: 0.02, render: { fillStyle: '#f97316' }, label: 'target'
    });
    
    // Hole
    const hole = Matter.Bodies.circle(width * 0.5 + (Math.random() * 100 - 50), height * 0.5 + (Math.random() * 100 - 50), radius * 1.5, {
      isStatic: true, isSensor: true, render: { fillStyle: '#000000', strokeStyle: '#06b6d4', lineWidth: 4 }, label: 'hole'
    });

    Matter.World.add(world, [...walls, player, target, hole]);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setDisplayTime((Date.now() - startTimeRef.current) / 1000);
      setPositions({
        player: { x: player.position.x, y: player.position.y },
        target: { x: target.position.x, y: target.position.y }
      });
    }, 30); // 33fps update for smooth React overlay

    const handleCollision = (e: Matter.IEventCollision<Matter.Engine>) => {
      e.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        
        // Hit Sound
        if ((bodyA.label === 'player' && bodyB.label === 'target') || (bodyB.label === 'player' && bodyA.label === 'target')) {
          if (pair.collision.depth > 1) playSFX('hit');
        }
        
        // Hole Logic
        if (bodyA.label === 'hole' || bodyB.label === 'hole') {
          const other = bodyA.label === 'hole' ? bodyB : bodyA;
          const dist = Matter.Vector.magnitude(Matter.Vector.sub(bodyA.position, bodyB.position));
          
          if (dist < radius) {
            if (other.label === 'player') {
              setGameState('gameover');
            } else if (other.label === 'target') {
              const time = (Date.now() - startTimeRef.current) / 1000;
              saveRecord(currentStage, time);
              playSFX('clear');
              
              // Reward Gate Trigger
              if (currentStage === 10 && !isLevel2Unlocked) {
                setGameState('reward_gate');
              } else {
                setGameState('clear');
              }
            }
          }
        }
      });
    };
    
    Matter.Events.on(engine, 'collisionStart', handleCollision);
    Matter.Events.on(engine, 'collisionActive', handleCollision);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      Matter.Events.off(engine, 'collisionStart', handleCollision);
      Matter.Events.off(engine, 'collisionActive', handleCollision);
      clearInterval(timerRef.current);
    };
  }, [gameState, currentStage]);

  // --- Handlers ---
  const saveRecord = (stageId: number, time: number) => {
    const newRecords = { ...records };
    if (!newRecords[stageId] || time < newRecords[stageId]) {
      newRecords[stageId] = time;
      setRecords(newRecords);
      localStorage.setItem('tiltball_records_final', JSON.stringify(newRecords));
    }
  };

  const startGame = async () => {
    initAudio();
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const perm = await (DeviceOrientationEvent as any).requestPermission();
        if (perm !== 'granted') alert('Sensor permission required to play.');
      } catch (e) { console.error(e); }
    }
    setGameState('lobby');
  };

  const handleWatchAd = () => {
    setGameState('ad_loading');
    setTimeout(() => {
      setIsLevel2Unlocked(true);
      localStorage.setItem('tiltball_level2_unlocked_final', 'true');
      setGameState('lobby');
    }, 3000);
  };

  const isLevel1 = currentStage <= 10;

  // --- Reusable Ad Slot Component ---
  const AdSlot = () => (
    <div className="w-full h-[60px] bg-[#1a1a1a] border-y border-cyan-900/50 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center shrink-0">
      <span className="text-[10px] text-gray-500 uppercase tracking-widest border border-gray-700/50 px-3 py-1 rounded-sm">
        Advertisement
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-sans text-white select-none">
      {/* Safe Area: pt-[30px] */}
      <div className="relative w-full max-w-[400px] h-screen max-h-[900px] bg-slate-950 overflow-hidden flex flex-col pt-[30px] shadow-[0_0_50px_rgba(0,0,0,0.8)] sm:rounded-3xl sm:border-4 border-slate-800">
        
        {/* 1. Start Screen */}
        {gameState === 'start' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 z-10">
            <button onClick={() => setGameState('tutorial')} className="absolute top-10 right-6 p-2 text-slate-400 hover:text-white transition-colors">
              <Info size={28} />
            </button>
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(59,130,246,0.5)]">
              <span className="text-5xl">🏀</span>
            </div>
            <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text text-center">
              TiltBall 10
            </h1>
            <p className="mb-8 text-blue-100 text-center font-bold text-lg">
              Tilt to hit the target ball into the hole!
            </p>
            <button onClick={startGame} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-lg flex items-center gap-2 transition-transform active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Play fill="currentColor" /> Start Game
            </button>
          </div>
        )}

        {/* 2. Tutorial Modal */}
        {gameState === 'tutorial' && (
          <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 pt-[30px]">
            <h2 className="text-3xl font-black mb-8 text-blue-400">How to Play</h2>
            <div className="flex flex-col gap-8 w-full max-w-xs bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-4"><span className="text-4xl">📱</span><p className="text-lg font-medium text-slate-300">Tilt your device to move the white ball.</p></div>
              <div className="flex items-center gap-4"><span className="text-4xl">🏀</span><p className="text-lg font-medium text-slate-300">Hit the colored target ball.</p></div>
              <div className="flex items-center gap-4"><span className="text-4xl">🎯</span><p className="text-lg font-medium text-slate-300">Push the target ball into the black hole to win!</p></div>
            </div>
            <button onClick={() => setGameState('start')} className="mt-10 px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-lg shadow-lg">
              Got it!
            </button>
          </div>
        )}

        {/* 3. Lobby Screen */}
        {gameState === 'lobby' && (
          <div className="flex-1 p-4 overflow-y-auto scrollbar-hide flex flex-col z-10">
            <div className="flex justify-between items-center mb-6 mt-4">
              <h1 className="text-3xl font-black tracking-tighter">Select Stage</h1>
              <button onClick={() => setBgmEnabled(!bgmEnabled)} className="p-3 bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors">
                <span className="text-xl">{bgmEnabled ? '🎵' : '🔇'}</span>
              </button>
            </div>
            
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 text-blue-300 border-b border-blue-900 pb-2">Level 1</h2>
              <div className="grid grid-cols-5 gap-3">
                {Array.from({length: 10}).map((_, i) => {
                  const id = i + 1;
                  const isCleared = records[id] !== undefined;
                  const isUnlocked = id === 1 || records[id - 1] !== undefined;
                  return (
                    <button key={id} disabled={!isUnlocked} onClick={() => { setCurrentStage(id); setGameState('playing'); }}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${!isUnlocked ? 'bg-slate-800 border-slate-700 opacity-40' : isCleared ? 'bg-slate-800 border-emerald-500 hover:bg-slate-700' : 'bg-slate-800 border-blue-500 hover:bg-slate-700 shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}>
                      <span className="text-xs text-slate-400 font-mono mb-1">S{id}</span>
                      <span className="text-2xl drop-shadow-md">{isCleared ? BALL_TYPES[i % 6] : '❓'}</span>
                      {!isUnlocked && <Lock size={14} className="absolute top-1 right-1 text-slate-500" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`transition-opacity duration-500 ${isLevel2Unlocked ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h2 className="text-xl font-bold mb-4 text-emerald-300 border-b border-emerald-900 pb-2 flex items-center justify-between">
                Level 2 {!isLevel2Unlocked ? <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">🔒 Clear S10</span> : <Unlock size={16} className="text-emerald-400" />}
              </h2>
              <div className="grid grid-cols-5 gap-3">
                {Array.from({length: 10}).map((_, i) => {
                  const id = i + 11;
                  const isCleared = records[id] !== undefined;
                  const isUnlocked = id === 11 || records[id - 1] !== undefined;
                  return (
                    <button key={id} disabled={!isUnlocked} onClick={() => { setCurrentStage(id); setGameState('playing'); }}
                      className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all ${!isUnlocked ? 'bg-slate-800 border-slate-700 opacity-40' : isCleared ? 'bg-slate-800 border-emerald-500 hover:bg-slate-700' : 'bg-slate-800 border-blue-500 hover:bg-slate-700 shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`}>
                      <span className="text-xs text-slate-400 font-mono mb-1">S{id}</span>
                      <span className="text-2xl drop-shadow-md">{isCleared ? BALL_TYPES[i % 6] : '❓'}</span>
                      {!isUnlocked && <Lock size={14} className="absolute top-1 right-1 text-slate-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 4. Game Screen (Playing & Overlays) */}
        {['playing', 'paused', 'clear', 'gameover', 'reward_gate', 'ad_loading'].includes(gameState) && (
          <div className="flex flex-col flex-1 relative bg-slate-950">
            
            {/* Level 2 Ad Slot (Top) */}
            {!isLevel1 && <AdSlot />}

            {/* Top Bar (60px height) */}
            <div className="w-full h-[60px] px-4 flex justify-between items-center bg-slate-900 border-b border-slate-800 shrink-0 z-20">
              <button onClick={() => setGameState('lobby')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors">
                <Home size={20} />
              </button>
              <div className="text-xl font-black tracking-widest text-white">STAGE {currentStage}</div>
              <div className="flex items-center gap-3">
                <div className="font-mono font-bold text-lg w-14 text-right text-emerald-400">{displayTime.toFixed(1)}s</div>
                <button onClick={() => setGameState('paused')} className="p-2 bg-blue-600 hover:bg-blue-500 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-colors">
                  <Pause size={20} fill="currentColor" />
                </button>
              </div>
            </div>

            {/* Game Canvas (Dynamic Height) */}
            <div className={`w-full relative ${isLevel1 ? 'h-[70%]' : 'flex-grow'}`}>
              <div ref={sceneRef} className="absolute inset-0" />
              
              {/* Emojis Overlay */}
              {gameState === 'playing' && (
                <>
                  <div className="absolute text-3xl pointer-events-none drop-shadow-lg" style={{ left: positions.player.x, top: positions.player.y, transform: 'translate(-50%, -50%)' }}>⚪</div>
                  <div className="absolute text-3xl pointer-events-none drop-shadow-lg" style={{ left: positions.target.x, top: positions.target.y, transform: 'translate(-50%, -50%)' }}>{BALL_TYPES[(currentStage - 1) % 6]}</div>
                  
                  {/* Stage 1-1 Visual Aid (3-Second Rule with CSS Fade-out) */}
                  {currentStage === 1 && (
                    <>
                      <div className={`absolute text-xs font-bold bg-blue-600/90 text-white px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap shadow-lg border border-blue-400 transition-opacity duration-1000 ${displayTime < 3 ? 'opacity-100' : 'opacity-0'}`} style={{ left: positions.player.x, top: positions.player.y - 40, transform: 'translate(-50%, -100%)' }}>
                        Tilt to move me!
                      </div>
                      <div className={`absolute text-xs font-bold bg-orange-600/90 text-white px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap shadow-lg border border-orange-400 transition-opacity duration-1000 ${displayTime < 3 ? 'opacity-100' : 'opacity-0'}`} style={{ left: positions.target.x, top: positions.target.y - 40, transform: 'translate(-50%, -100%)' }}>
                        Put me in the hole!
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Level 1 Ad Slot (Bottom) */}
            {isLevel1 && (
              <div className="mt-auto">
                <AdSlot />
              </div>
            )}

            {/* Overlays */}
            {gameState === 'paused' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <h2 className="text-4xl font-black mb-8 tracking-widest text-white">PAUSED</h2>
                <div className="flex flex-col gap-4 w-56">
                  <button onClick={() => setGameState('playing')} className="py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"><Play size={20} fill="currentColor" /> Resume</button>
                  <button onClick={() => { setGameState('playing'); setCurrentStage(currentStage); }} className="py-4 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"><RotateCcw size={20} /> Restart</button>
                  <button onClick={() => setGameState('lobby')} className="py-4 bg-slate-700 hover:bg-slate-600 rounded-full font-bold flex justify-center items-center gap-2 text-lg transition-transform active:scale-95"><X size={20} /> Exit Game</button>
                </div>
              </div>
            )}

            {gameState === 'clear' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <div className="text-6xl mb-6 animate-bounce">🎉</div>
                <h2 className="text-4xl font-black text-emerald-400 mb-2">STAGE CLEAR!</h2>
                <p className="mb-10 font-mono text-xl text-slate-300">Time: {displayTime.toFixed(1)}s</p>
                <div className="flex gap-4">
                  <button onClick={() => setGameState('lobby')} className="px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-lg transition-transform active:scale-95">Lobby</button>
                  {currentStage < 20 && <button onClick={() => { setCurrentStage(currentStage + 1); setGameState('playing'); }} className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex items-center gap-2 text-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform active:scale-95">Next <Play size={20} fill="currentColor" /></button>}
                </div>
              </div>
            )}

            {gameState === 'gameover' && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                <div className="text-6xl mb-6">💀</div>
                <h2 className="text-4xl font-black text-red-500 mb-2">GAME OVER</h2>
                <p className="text-slate-400 mb-10 text-lg">Your ball fell into the hole!</p>
                <div className="flex gap-4">
                  <button onClick={() => setGameState('lobby')} className="px-6 py-4 bg-slate-700 hover:bg-slate-600 rounded-full font-bold text-lg transition-transform active:scale-95">Lobby</button>
                  <button onClick={() => { setGameState('playing'); setCurrentStage(currentStage); }} className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-full font-bold flex items-center gap-2 text-lg shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform active:scale-95"><RotateCcw size={20} /> Retry</button>
                </div>
              </div>
            )}

            {gameState === 'reward_gate' && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-40 p-6 text-center">
                <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 border border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                  <Unlock size={48} className="text-emerald-400" />
                </div>
                <h2 className="text-3xl font-black text-white mb-4 leading-tight">Unlock Pro Level 2!</h2>
                <p className="text-slate-400 mb-10 text-lg max-w-[280px]">Watch a short ad to continue your journey.</p>
                <button onClick={handleWatchAd} className="w-full max-w-[280px] py-5 bg-emerald-600 hover:bg-emerald-500 rounded-full font-bold flex justify-center items-center gap-3 text-xl transition-transform active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <Play size={24} fill="currentColor" /> Watch Ad to Unlock
                </button>
                <button onClick={() => setGameState('lobby')} className="mt-6 text-slate-500 text-base hover:text-slate-300 underline underline-offset-4">Maybe later</button>
              </div>
            )}

            {gameState === 'ad_loading' && (
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
                <Loader2 size={56} className="text-emerald-500 animate-spin mb-6" />
                <p className="text-xl font-bold tracking-widest text-white animate-pulse">LOADING AD...</p>
                <p className="text-slate-500 text-sm mt-3">Please wait 3 seconds</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
