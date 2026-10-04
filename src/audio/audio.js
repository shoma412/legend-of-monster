// 音を鳴らす窓口。SE も BGM も、src/data/audio.js の対応表のキーで呼ぶ。
// 今は Web Audio でその場で合成している。対応表に file を書けば、そのファイルを鳴らす。
import { BGM, BGM_SYNTH, SE } from '../data/audio.js';

const SETTINGS_KEY = 'legend-of-monster/settings';
const SE_MIN_INTERVAL = 0.04; // 同じ SE を続けて鳴らすときの最短の間隔（秒）
const MASTER = 0.5;

let ctx = null;
let master = null;
let noiseBuffer = null;
let settings = null;
const lastPlayed = {};
const fileCache = {};

let bgmKey = null; // 今鳴らしている場面
let bgmTimer = null;
let bgmElement = null;
let bgmGain = null;

function loadSettings() {
  if (settings) return settings;
  settings = { muted: false };
  try {
    Object.assign(settings, JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? '{}'));
  } catch {
    // 読めなくても、初期設定で鳴らす
  }
  return settings;
}

function saveSettings() {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても、その場の設定は効く
  }
}

// ブラウザは、何か操作されるまで音を鳴らせない。最初のキーやクリックでここが呼ばれる
function ensureContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = loadSettings().muted ? 0 : MASTER;
    master.connect(ctx.destination);
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// 合成音の層を1つ鳴らす
function playLayer(layer, when, out, volume = 1) {
  const start = when + (layer.delay ?? 0);
  const end = start + layer.dur;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.vol * volume), start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(out);
  const [from, to] = layer.freq;
  if (layer.wave === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), end);
    src.connect(filter).connect(gain);
    src.start(start);
    src.stop(end + 0.02);
  } else {
    const osc = ctx.createOscillator();
    osc.type = layer.wave;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end);
    osc.connect(gain);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

function playFile(path, loop = false) {
  const el = (fileCache[path] ??= new Audio(`${import.meta.env.BASE_URL}${path}`)).cloneNode();
  el.loop = loop;
  el.volume = loadSettings().muted ? 0 : MASTER;
  el.play().catch(() => {});
  return el;
}

export function playSe(name) {
  const def = SE[name];
  if (!def || !ensureContext() || loadSettings().muted) return;
  const now = ctx.currentTime;
  if (now - (lastPlayed[name] ?? -1) < SE_MIN_INTERVAL) return;
  lastPlayed[name] = now;
  if (def.file) {
    playFile(def.file);
    return;
  }
  for (const layer of def) playLayer(layer, now, master);
}

function stopBgm() {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
  if (bgmElement) bgmElement.pause();
  bgmElement = null;
  if (bgmGain) {
    const g = bgmGain;
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    setTimeout(() => g.disconnect(), 800);
  }
  bgmGain = null;
}

// 仮の曲：16分音符の並びを、少し先まで予約しながら鳴らし続ける
function startSynth(song) {
  bgmGain = ctx.createGain();
  bgmGain.gain.value = song.vol * 0.5;
  bgmGain.connect(master);
  const out = bgmGain;
  const stepDur = 60 / song.bpm / 4;
  const hz = (semi) => song.root * 2 ** (semi / 12);
  let step = 0;
  let next = ctx.currentTime + 0.1;
  const schedule = () => {
    while (next < ctx.currentTime + 0.25) {
      const i = step % 16;
      const bar = Math.floor(step / 16);
      const bass = song.bass[i];
      if (bass != null) playLayer({ wave: 'triangle', freq: [hz(bass), hz(bass)], dur: stepDur * 1.8, vol: 0.5 }, next, out);
      // メロディは1小節おきに鳴らして、単調にならないようにする
      const lead = bar % 2 === 1 ? song.lead[i] : null;
      if (lead != null) playLayer({ wave: 'square', freq: [hz(lead), hz(lead)], dur: stepDur * 1.6, vol: 0.12 }, next, out);
      if (song.hat[i]) playLayer({ wave: 'noise', freq: [9000, 5000], dur: 0.03, vol: 0.12 }, next, out);
      next += stepDur;
      step++;
    }
  };
  schedule();
  bgmTimer = setInterval(schedule, 60);
}

// 場面の曲に切り替える。同じ曲が鳴っていれば何もしない
export function playBgm(key) {
  if (bgmKey === key && (bgmTimer || bgmElement)) return;
  bgmKey = key;
  if (!ensureContext()) return;
  stopBgm();
  const def = BGM[key];
  if (!def) return;
  if (def.file) bgmElement = playFile(def.file, true);
  else if (BGM_SYNTH[def.synth]) startSynth(BGM_SYNTH[def.synth]);
}

// 最初の操作で音を使えるようにし、止まっていた曲を鳴らし始める（各画面で1回呼ぶ）
export function unlockAudio(scene) {
  const start = () => {
    if (!ensureContext()) return;
    if (bgmKey && !bgmTimer && !bgmElement) {
      const key = bgmKey;
      bgmKey = null;
      playBgm(key);
    }
  };
  scene.input.keyboard.on('keydown', start);
  scene.input.on('pointerdown', start);
}

export function isMuted() {
  return loadSettings().muted;
}

export function toggleMute() {
  loadSettings().muted = !settings.muted;
  saveSettings();
  if (master) master.gain.value = settings.muted ? 0 : MASTER;
  if (bgmElement) bgmElement.volume = settings.muted ? 0 : MASTER;
  return settings.muted;
}
