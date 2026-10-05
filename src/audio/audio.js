// 音を鳴らす窓口。SE も BGM も、src/data/audio.js の対応表のキーで呼ぶ。
// 今は Web Audio でその場で合成している。対応表に file を書けば、そのファイルを鳴らす。
// 音量は設定（src/game/settingsStore.js）の値を使う。
import { BGM, SE } from '../data/audio.js';
import { getSettings } from '../game/settingsStore.js';
import { startSong } from './music.js';

const SE_MIN_INTERVAL = 0.04; // 同じ SE を続けて鳴らすときの最短の間隔（秒）

let ctx = null;
let master = null; // 全体の音量
let seBus = null; // 効果音の音量
let bgmBus = null; // BGM の音量
let noiseBuffer = null;
const lastPlayed = {};
const fileCache = {};

let bgmKey = null; // 今鳴らしている場面
let bgmSong = null; // コードで鳴らしている曲
let bgmLoading = false; // ファイルの曲を読み込んでいる最中
let bgmSource = null; // ファイルで鳴らしている曲
let bgmRequest = 0; // 曲の切り替えの通し番号（読み込み中に別の曲へ切り替わったら、古いほうは鳴らさない）
const bgmBuffers = new Map(); // 読み込んで音に直した曲（直近のぶんだけ持つ）
const BGM_BUFFER_KEEP = 3;

// 設定の音量を、鳴らしている音に反映する（設定画面で変えるたびに呼ぶ）
export function applyVolume() {
  const s = getSettings();
  if (master) {
    master.gain.value = s.muted ? 0 : s.volume.master;
    seBus.gain.value = s.volume.se;
    bgmBus.gain.value = s.volume.bgm;
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
    master.connect(ctx.destination);
    seBus = ctx.createGain();
    seBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.connect(master);
    applyVolume();
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// 合成音の層を1つ鳴らす
function playLayer(layer, when, out) {
  const start = when + (layer.delay ?? 0);
  const end = start + layer.dur;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.vol), start + 0.008);
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

function playFile(path, loop, volume) {
  const el = (fileCache[path] ??= new Audio(`${import.meta.env.BASE_URL}${path}`)).cloneNode();
  el.loop = loop;
  el.volume = volume;
  el.play().catch(() => {});
  return el;
}

export function playSe(name) {
  const def = SE[name];
  const s = getSettings();
  if (!def || !ensureContext() || s.muted) return;
  const now = ctx.currentTime;
  if (now - (lastPlayed[name] ?? -1) < SE_MIN_INTERVAL) return;
  lastPlayed[name] = now;
  if (def.file) {
    playFile(def.file, false, s.volume.master * s.volume.se);
    return;
  }
  for (const layer of def) playLayer(layer, now, seBus);
}

function stopBgm() {
  bgmSong?.stop();
  bgmSong = null;
  bgmRequest += 1;
  bgmLoading = false;
  try {
    bgmSource?.stop();
  } catch {
    // すでに止まっている
  }
  bgmSource?.disconnect();
  bgmSource = null;
}

// 曲のファイルを読み込んで、鳴らせる形に直す。つなぎ目なくループさせるために Web Audio で鳴らす
async function loadBgmBuffer(path) {
  if (bgmBuffers.has(path)) return bgmBuffers.get(path);
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`BGM を読み込めない: ${path}`);
  const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
  bgmBuffers.set(path, buffer);
  // 直した曲はメモリを大きく使うので、古いものから捨てる
  while (bgmBuffers.size > BGM_BUFFER_KEEP) bgmBuffers.delete(bgmBuffers.keys().next().value);
  return buffer;
}

async function startBgmFile(def) {
  const request = bgmRequest;
  try {
    const buffer = await loadBgmBuffer(def.file);
    if (request !== bgmRequest) return; // 読み込み中に別の曲へ切り替わった
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(bgmBus);
    source.start();
    bgmSource = source;
  } catch {
    // 読み込めなかったら、コードの曲で代わりにする
    if (request === bgmRequest && def.song) bgmSong = startSong(ctx, bgmBus, noiseBuffer, def.song);
  }
}

// 場面の曲に切り替える。同じ曲が鳴っていれば何もしない
export function playBgm(key) {
  if (bgmKey === key && (bgmSong || bgmSource || bgmLoading)) return;
  bgmKey = key;
  if (!ensureContext()) return;
  stopBgm();
  const def = BGM[key];
  if (!def) return;
  if (def.file) {
    bgmLoading = true;
    const request = bgmRequest;
    startBgmFile(def).finally(() => {
      if (request === bgmRequest) bgmLoading = false;
    });
  } else {
    bgmSong = startSong(ctx, bgmBus, noiseBuffer, def.song);
  }
}

// 最初の操作で音を使えるようにし、止まっていた曲を鳴らし始める（各画面で1回呼ぶ）
export function unlockAudio(scene) {
  const start = () => {
    if (!ensureContext()) return;
    if (bgmKey && !bgmSong && !bgmSource && !bgmLoading) {
      const key = bgmKey;
      bgmKey = null;
      playBgm(key);
    }
  };
  scene.input.keyboard.on('keydown', start);
  scene.input.on('pointerdown', start);
}
