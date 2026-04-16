// Procedural sound effects via Web Audio API.
// Designed to be evocative: sploosh, cannon impact on wood, explosion + sinking.

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

let masterVolume = 0.45;
let sfxVolume = 1;
let musicVolume = 0.5;
let muted = false;

export function setVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
  updateAmbientGain();
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(1, v));
}

export function setMusicVolume(v: number) {
  musicVolume = Math.max(0, Math.min(1, v));
  updateAmbientGain();
}

export function setMuted(m: boolean) {
  muted = m;
  updateAmbientGain();
}

function sfxVol(): number {
  return muted ? 0 : masterVolume * sfxVolume;
}

function musicVol(): number {
  return muted ? 0 : masterVolume * musicVolume;
}

// Keep backward compat
function vol(): number {
  return sfxVol();
}

function makeNoiseBuffer(ctx: AudioContext, duration: number, decay = 1): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, decay);
  }
  return buffer;
}

// === CANNON FIRE === Deep boom + crack
export function playCannonFire() {
  const ctx = getContext();
  const now = ctx.currentTime;

  // Sub bass thud
  const subGain = ctx.createGain();
  subGain.connect(ctx.destination);
  subGain.gain.setValueAtTime(vol() * 0.7, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now);
  sub.frequency.exponentialRampToValueAtTime(35, now + 0.4);
  sub.connect(subGain);
  sub.start(now);
  sub.stop(now + 0.6);

  // Crack noise burst
  const crackGain = ctx.createGain();
  crackGain.connect(ctx.destination);
  crackGain.gain.setValueAtTime(vol() * 0.5, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.value = 800;
  crackFilter.connect(crackGain);

  const crackSrc = ctx.createBufferSource();
  crackSrc.buffer = makeNoiseBuffer(ctx, 0.25, 4);
  crackSrc.connect(crackFilter);
  crackSrc.start(now);
}

// === MISS === "Sploosh" — water splash with descending bubble
export function playWaterSplash() {
  const ctx = getContext();
  const now = ctx.currentTime;

  // Initial splash (filtered noise sweep)
  const splashGain = ctx.createGain();
  splashGain.connect(ctx.destination);
  splashGain.gain.setValueAtTime(0, now);
  splashGain.gain.linearRampToValueAtTime(vol() * 0.5, now + 0.02);
  splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

  const splashFilter = ctx.createBiquadFilter();
  splashFilter.type = 'bandpass';
  splashFilter.Q.value = 1.5;
  splashFilter.frequency.setValueAtTime(3500, now);
  splashFilter.frequency.exponentialRampToValueAtTime(500, now + 0.45);
  splashFilter.connect(splashGain);

  const splashSrc = ctx.createBufferSource();
  splashSrc.buffer = makeNoiseBuffer(ctx, 0.55, 1.5);
  splashSrc.connect(splashFilter);
  splashSrc.start(now);

  // Watery "bloop" — descending sine
  const bloopGain = ctx.createGain();
  bloopGain.connect(ctx.destination);
  bloopGain.gain.setValueAtTime(0, now + 0.05);
  bloopGain.gain.linearRampToValueAtTime(vol() * 0.3, now + 0.08);
  bloopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  const bloop = ctx.createOscillator();
  bloop.type = 'sine';
  bloop.frequency.setValueAtTime(900, now + 0.05);
  bloop.frequency.exponentialRampToValueAtTime(180, now + 0.4);
  bloop.connect(bloopGain);
  bloop.start(now + 0.05);
  bloop.stop(now + 0.4);

  // Small bubble plops
  for (let i = 0; i < 3; i++) {
    const t = now + 0.15 + i * 0.08;
    const bg = ctx.createGain();
    bg.connect(ctx.destination);
    bg.gain.setValueAtTime(vol() * 0.15, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    const bo = ctx.createOscillator();
    bo.type = 'sine';
    bo.frequency.setValueAtTime(600 + Math.random() * 400, t);
    bo.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    bo.connect(bg);
    bo.start(t);
    bo.stop(t + 0.08);
  }
}

// === HIT === Cannonball striking ship — wood crack + metal clang + impact
export function playHitExplosion() {
  const ctx = getContext();
  const now = ctx.currentTime;

  // Heavy impact thud
  const thudGain = ctx.createGain();
  thudGain.connect(ctx.destination);
  thudGain.gain.setValueAtTime(vol() * 0.7, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  const thud = ctx.createOscillator();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(180, now);
  thud.frequency.exponentialRampToValueAtTime(45, now + 0.3);
  thud.connect(thudGain);
  thud.start(now);
  thud.stop(now + 0.5);

  // Wood splinter crack — high freq filtered noise
  const woodGain = ctx.createGain();
  woodGain.connect(ctx.destination);
  woodGain.gain.setValueAtTime(vol() * 0.5, now + 0.01);
  woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  const woodFilter = ctx.createBiquadFilter();
  woodFilter.type = 'bandpass';
  woodFilter.frequency.value = 2200;
  woodFilter.Q.value = 3;
  woodFilter.connect(woodGain);

  const woodSrc = ctx.createBufferSource();
  woodSrc.buffer = makeNoiseBuffer(ctx, 0.35, 3);
  woodSrc.connect(woodFilter);
  woodSrc.start(now + 0.01);

  // Metal clang — short bell tone
  const clangGain = ctx.createGain();
  clangGain.connect(ctx.destination);
  clangGain.gain.setValueAtTime(0, now + 0.02);
  clangGain.gain.linearRampToValueAtTime(vol() * 0.35, now + 0.04);
  clangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  const clang = ctx.createOscillator();
  clang.type = 'triangle';
  clang.frequency.setValueAtTime(420, now + 0.02);
  clang.frequency.exponentialRampToValueAtTime(180, now + 0.5);
  clang.connect(clangGain);
  clang.start(now + 0.02);
  clang.stop(now + 0.6);

  // Crackle aftermath
  const crackleGain = ctx.createGain();
  crackleGain.connect(ctx.destination);
  crackleGain.gain.setValueAtTime(vol() * 0.25, now + 0.1);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  const crackleSrc = ctx.createBufferSource();
  crackleSrc.buffer = makeNoiseBuffer(ctx, 0.6, 2);
  crackleSrc.connect(crackleGain);
  crackleSrc.start(now + 0.1);
}

// === SINK === Big explosion + extended ship-going-down sound
export function playShipSinking() {
  const ctx = getContext();
  const now = ctx.currentTime;

  // === EXPLOSION (first 0.8s) ===
  // Massive low boom
  const boomGain = ctx.createGain();
  boomGain.connect(ctx.destination);
  boomGain.gain.setValueAtTime(vol() * 0.9, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

  const boom = ctx.createOscillator();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(90, now);
  boom.frequency.exponentialRampToValueAtTime(25, now + 0.7);
  boom.connect(boomGain);
  boom.start(now);
  boom.stop(now + 1.0);

  // Explosion noise burst
  const explGain = ctx.createGain();
  explGain.connect(ctx.destination);
  explGain.gain.setValueAtTime(vol() * 0.7, now);
  explGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  const explFilter = ctx.createBiquadFilter();
  explFilter.type = 'lowpass';
  explFilter.frequency.setValueAtTime(2500, now);
  explFilter.frequency.exponentialRampToValueAtTime(300, now + 0.7);
  explFilter.Q.value = 1;
  explFilter.connect(explGain);

  const explSrc = ctx.createBufferSource();
  explSrc.buffer = makeNoiseBuffer(ctx, 0.8, 1.5);
  explSrc.connect(explFilter);
  explSrc.start(now);

  // === SHIP GROANING (0.5s - 2.5s) — wood creaking, metal stress ===
  const groanStart = now + 0.5;
  const groanGain = ctx.createGain();
  groanGain.connect(ctx.destination);
  groanGain.gain.setValueAtTime(0, groanStart);
  groanGain.gain.linearRampToValueAtTime(vol() * 0.4, groanStart + 0.3);
  groanGain.gain.linearRampToValueAtTime(vol() * 0.2, groanStart + 1.5);
  groanGain.gain.exponentialRampToValueAtTime(0.001, groanStart + 2.0);

  const groan = ctx.createOscillator();
  groan.type = 'sawtooth';
  groan.frequency.setValueAtTime(75, groanStart);
  groan.frequency.linearRampToValueAtTime(40, groanStart + 2.0);
  groan.connect(groanGain);
  groan.start(groanStart);
  groan.stop(groanStart + 2.0);

  // Slow LFO modulation for groan wobble
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 8;
  lfoGain.connect(groan.frequency);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 1.2;
  lfo.connect(lfoGain);
  lfo.start(groanStart);
  lfo.stop(groanStart + 2.0);

  // === BUBBLES (1.0s - 3.0s) — many rising bubble plops ===
  for (let i = 0; i < 14; i++) {
    const t = now + 1.0 + Math.random() * 2.0;
    const bg = ctx.createGain();
    bg.connect(ctx.destination);
    bg.gain.setValueAtTime(vol() * 0.18, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    const bo = ctx.createOscillator();
    bo.type = 'sine';
    bo.frequency.setValueAtTime(700 + Math.random() * 1500, t);
    bo.frequency.exponentialRampToValueAtTime(150, t + 0.18);
    bo.connect(bg);
    bo.start(t);
    bo.stop(t + 0.18);
  }

  // === FINAL SPLASH (3.0s) — big water splash as ship submerges ===
  const finalT = now + 2.8;
  const finalGain = ctx.createGain();
  finalGain.connect(ctx.destination);
  finalGain.gain.setValueAtTime(0, finalT);
  finalGain.gain.linearRampToValueAtTime(vol() * 0.45, finalT + 0.05);
  finalGain.gain.exponentialRampToValueAtTime(0.001, finalT + 0.7);

  const finalFilter = ctx.createBiquadFilter();
  finalFilter.type = 'bandpass';
  finalFilter.frequency.setValueAtTime(2000, finalT);
  finalFilter.frequency.exponentialRampToValueAtTime(300, finalT + 0.6);
  finalFilter.Q.value = 1.5;
  finalFilter.connect(finalGain);

  const finalSrc = ctx.createBufferSource();
  finalSrc.buffer = makeNoiseBuffer(ctx, 0.7, 1.5);
  finalSrc.connect(finalFilter);
  finalSrc.start(finalT);
}

// === ACHIEVEMENT CHIME === Bright sparkle
export function playAchievementChime() {
  const ctx = getContext();
  const now = ctx.currentTime;
  const notes = [880, 1108, 1318, 1760]; // A5, C#6, E6, A6 — major chord arpeggio

  notes.forEach((freq, i) => {
    const t = now + i * 0.08;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol() * 0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// === VICTORY FANFARE === Triumphant motif
export function playVictoryFanfare() {
  const ctx = getContext();
  const now = ctx.currentTime;
  const notes = [
    { freq: 523, dur: 0.15 }, // C5
    { freq: 659, dur: 0.15 }, // E5
    { freq: 784, dur: 0.15 }, // G5
    { freq: 1047, dur: 0.5 }, // C6
  ];

  let t = now;
  notes.forEach((n) => {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol() * 0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = n.freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + n.dur);

    t += n.dur;
  });
}

// === DEFEAT THEME === Descending minor motif
export function playDefeatTheme() {
  const ctx = getContext();
  const now = ctx.currentTime;
  const notes = [
    { freq: 440, dur: 0.3 }, // A4
    { freq: 392, dur: 0.3 }, // G4
    { freq: 349, dur: 0.3 }, // F4
    { freq: 261, dur: 0.8 }, // C4
  ];

  let t = now;
  notes.forEach((n) => {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol() * 0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = n.freq;
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + n.dur);

    t += n.dur;
  });
}

// === RICOCHET === Metallic ping + brief shimmer for Ironclad-deflected shots
export function playRicochet() {
  const ctx = getContext();
  const now = ctx.currentTime;

  // Sharp metal "ting" — high triangle wave, very short
  const tingGain = ctx.createGain();
  tingGain.connect(ctx.destination);
  tingGain.gain.setValueAtTime(0, now);
  tingGain.gain.linearRampToValueAtTime(vol() * 0.45, now + 0.01);
  tingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  const ting = ctx.createOscillator();
  ting.type = 'triangle';
  ting.frequency.setValueAtTime(2200, now);
  ting.frequency.exponentialRampToValueAtTime(1400, now + 0.3);
  ting.connect(tingGain);
  ting.start(now);
  ting.stop(now + 0.35);

  // Secondary lower ring for armor-plate resonance
  const ringGain = ctx.createGain();
  ringGain.connect(ctx.destination);
  ringGain.gain.setValueAtTime(vol() * 0.22, now + 0.02);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  const ring = ctx.createOscillator();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(800, now + 0.02);
  ring.frequency.exponentialRampToValueAtTime(420, now + 0.5);
  ring.connect(ringGain);
  ring.start(now + 0.02);
  ring.stop(now + 0.6);

  // Quick "whiz" of filtered noise for spark streak
  const sparkGain = ctx.createGain();
  sparkGain.connect(ctx.destination);
  sparkGain.gain.setValueAtTime(vol() * 0.2, now);
  sparkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  const sparkFilter = ctx.createBiquadFilter();
  sparkFilter.type = 'bandpass';
  sparkFilter.Q.value = 3;
  sparkFilter.frequency.setValueAtTime(3200, now);
  sparkFilter.frequency.exponentialRampToValueAtTime(1800, now + 0.2);
  sparkFilter.connect(sparkGain);

  const sparkSrc = ctx.createBufferSource();
  sparkSrc.buffer = makeNoiseBuffer(ctx, 0.2, 3);
  sparkSrc.connect(sparkFilter);
  sparkSrc.start(now);
}

// === ABILITY ACTIVATE === Rising synth sweep
export function playAbilityActivate() {
  const ctx = getContext();
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol() * 0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(1400, now + 0.25);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.5);
}

// ═══════════════════════════════════════════════════
// PROCEDURAL AMBIENT SOUNDTRACK
// Ocean waves, wind, mechanical clanking, creaking wood
// ═══════════════════════════════════════════════════

let ambientGain: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let ambientTimers: ReturnType<typeof setInterval>[] = [];
let ambientRunning = false;

function updateAmbientGain() {
  if (ambientGain && audioCtx) {
    ambientGain.gain.setTargetAtTime(musicVol(), audioCtx.currentTime, 0.1);
  }
}

export function startAmbientLoop() {
  if (ambientRunning) return;
  const ctx = getContext();
  ambientRunning = true;

  // Master ambient gain
  ambientGain = ctx.createGain();
  ambientGain.gain.value = musicVol();
  ambientGain.connect(ctx.destination);

  // --- Ocean waves: filtered noise with slow LFO amplitude ---
  const waveNoise = ctx.createBufferSource();
  const waveBuf = ctx.createBuffer(1, ctx.sampleRate * 8, ctx.sampleRate);
  const waveData = waveBuf.getChannelData(0);
  for (let i = 0; i < waveData.length; i++) waveData[i] = Math.random() * 2 - 1;
  waveNoise.buffer = waveBuf;
  waveNoise.loop = true;

  const waveBP = ctx.createBiquadFilter();
  waveBP.type = 'bandpass';
  waveBP.frequency.value = 350;
  waveBP.Q.value = 0.5;

  const waveGain = ctx.createGain();
  waveGain.gain.value = 0.15;

  // Slow amplitude modulation for wave rhythm
  const waveLFO = ctx.createOscillator();
  waveLFO.type = 'sine';
  waveLFO.frequency.value = 0.15; // ~7s cycle
  const waveLFOGain = ctx.createGain();
  waveLFOGain.gain.value = 0.06;
  waveLFO.connect(waveLFOGain);
  waveLFOGain.connect(waveGain.gain);
  waveLFO.start();

  waveNoise.connect(waveBP);
  waveBP.connect(waveGain);
  waveGain.connect(ambientGain);
  waveNoise.start();

  ambientNodes.push(waveNoise, waveBP, waveGain, waveLFO, waveLFOGain);

  // --- Wind: higher bandpass noise ---
  const windNoise = ctx.createBufferSource();
  const windBuf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
  const windData = windBuf.getChannelData(0);
  for (let i = 0; i < windData.length; i++) windData[i] = Math.random() * 2 - 1;
  windNoise.buffer = windBuf;
  windNoise.loop = true;

  const windBP = ctx.createBiquadFilter();
  windBP.type = 'bandpass';
  windBP.frequency.value = 1200;
  windBP.Q.value = 0.8;

  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;

  const windLFO = ctx.createOscillator();
  windLFO.type = 'sine';
  windLFO.frequency.value = 0.08;
  const windLFOGain = ctx.createGain();
  windLFOGain.gain.value = 0.03;
  windLFO.connect(windLFOGain);
  windLFOGain.connect(windGain.gain);
  windLFO.start();

  windNoise.connect(windBP);
  windBP.connect(windGain);
  windGain.connect(ambientGain);
  windNoise.start();

  ambientNodes.push(windNoise, windBP, windGain, windLFO, windLFOGain);

  // --- Mechanical clanking: periodic metallic tones ---
  const clankTimer = setInterval(() => {
    if (!ambientRunning || !ambientGain) return;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ambientGain);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(250 + Math.random() * 150, now);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    o.connect(g);
    o.start(now);
    o.stop(now + 0.3);
  }, 4000 + Math.random() * 4000);
  ambientTimers.push(clankTimer);

  // --- Creaking wood: occasional low sawtooth with vibrato ---
  const creakTimer = setInterval(() => {
    if (!ambientRunning || !ambientGain) return;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.connect(ambientGain);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55 + Math.random() * 30, now);
    o.frequency.linearRampToValueAtTime(40, now + 1.0);
    o.connect(g);

    // Vibrato
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 3 + Math.random() * 2;
    const vibG = ctx.createGain();
    vibG.gain.value = 5;
    vib.connect(vibG);
    vibG.connect(o.frequency);
    vib.start(now);
    vib.stop(now + 1.2);

    o.start(now);
    o.stop(now + 1.2);
  }, 10000 + Math.random() * 5000);
  ambientTimers.push(creakTimer);
}

export function stopAmbientLoop() {
  ambientRunning = false;
  for (const timer of ambientTimers) clearInterval(timer);
  ambientTimers = [];
  for (const node of ambientNodes) {
    try {
      if (node instanceof AudioBufferSourceNode || node instanceof OscillatorNode) {
        node.stop();
      }
      node.disconnect();
    } catch {
      // Already stopped/disconnected
    }
  }
  ambientNodes = [];
  if (ambientGain) {
    try { ambientGain.disconnect(); } catch { /* ok */ }
    ambientGain = null;
  }
}

export function isAmbientRunning(): boolean {
  return ambientRunning;
}

// Release AudioContext and all live nodes when the page unloads to prevent
// oscillator leaks in browser profiles.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopAmbientLoop();
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
  });
}
