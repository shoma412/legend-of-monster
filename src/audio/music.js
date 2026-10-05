// コードで曲を鳴らす仕組み。曲の中身（src/data/audio.js の SONGS）を、少し先まで予約しながら鳴らし続ける。
import { ARP, BASS, DRUMS, SONGS } from '../data/audio.js';

const MINOR = [0, 2, 3, 5, 7, 8, 10]; // 短調の音階（半音いくつぶん上か）
const STEPS_PER_BAR = 16;
const BARS_PER_SECTION = 4;

// 音階の n 番目の音が、基準の音から半音いくつぶん上か
function semitone(n) {
  const octave = Math.floor(n / 7);
  return MINOR[((n % 7) + 7) % 7] + octave * 12;
}

const hz = (key, n) => key * 2 ** (semitone(n) / 12);

// メロディの1小節ぶんの文字列を、数字の並びに直す（'.' は休み）
function parseBar(text) {
  return text.split(/\s+/).map((t) => (t === '.' ? null : Number(t)));
}

// 曲のデータを、鳴らしやすい形に直す
export function compileSong(name) {
  const song = SONGS[name];
  if (!song) return null;
  const sections = {};
  for (const [id, sec] of Object.entries(song.sections)) {
    sections[id] = { ...sec, lead: sec.lead ? sec.lead.map(parseBar) : null };
  }
  return { ...song, sections };
}

// 1つの音。wave の音を freq の高さで dur 秒。cutoff を書くと、こもった音になる
function tone(ctx, out, when, { wave, freq, dur, vol, attack = 0.01, cutoff = null, detune = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, when);
  osc.detune.value = detune;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(vol, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.connect(filter).connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.03);
}

function noise(ctx, out, buffer, when, { dur, vol, type, freq }) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(filter).connect(gain).connect(out);
  src.start(when);
  src.stop(when + dur + 0.02);
}

function kick(ctx, out, when) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(130, when);
  osc.frequency.exponentialRampToValueAtTime(42, when + 0.12);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + 0.2);
}

// 曲を鳴らし始める。返ってくる stop() で止める
export function startSong(ctx, out, noiseBuffer, name) {
  const song = compileSong(name);
  if (!song) return null;
  const bus = ctx.createGain();
  bus.gain.value = 0.0001;
  bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.6); // 入りはふわっと
  bus.connect(out);

  const stepDur = 60 / song.bpm / 4;
  const sectionSteps = STEPS_PER_BAR * BARS_PER_SECTION;
  let step = 0;
  let next = ctx.currentTime + 0.1;

  const playStep = (when) => {
    const sec = song.sections[song.arrangement[Math.floor(step / sectionSteps) % song.arrangement.length]];
    const bar = Math.floor((step % sectionSteps) / STEPS_PER_BAR);
    const i = step % STEPS_PER_BAR;
    const root = sec.chords[bar];
    const chord = [root, root + 2, root + 4, root + 7]; // 和音の音（音階の何番目か）

    // 和音を伸ばした音（小節の頭で鳴らし、次の小節まで伸ばす）
    if (sec.pad && i === 0) {
      for (const n of chord.slice(0, 3)) {
        for (const detune of [-7, 7]) tone(ctx, bus, when, { wave: 'sawtooth', freq: hz(song.key, n + 7), dur: stepDur * 17, vol: 0.022, attack: stepDur * 3, cutoff: 900, detune });
      }
    }
    const bass = sec.bass ? BASS[sec.bass][i] : null;
    if (bass != null) tone(ctx, bus, when, { wave: 'sawtooth', freq: hz(song.key, root + bass), dur: stepDur * 1.7, vol: 0.2, cutoff: 520 });

    const arp = sec.arp ? ARP[sec.arp][i] : null;
    if (arp != null) tone(ctx, bus, when, { wave: song.arpWave, freq: hz(song.key, chord[arp] + 14), dur: stepDur * 1.4, vol: 0.05, cutoff: 2600 });

    const lead = sec.lead ? sec.lead[bar][i] : null;
    if (lead != null) {
      tone(ctx, bus, when, { wave: song.leadWave, freq: hz(song.key, lead + 7), dur: stepDur * 2.6, vol: 0.085, cutoff: 3200 });
    }

    const drums = sec.drums ? DRUMS[sec.drums] : null;
    if (drums) {
      if (drums.k[i] === 'x') kick(ctx, bus, when);
      if (drums.s[i] === 'x') {
        noise(ctx, bus, noiseBuffer, when, { dur: 0.13, vol: 0.22, type: 'bandpass', freq: 1800 });
        tone(ctx, bus, when, { wave: 'triangle', freq: 190, dur: 0.09, vol: 0.12 });
      }
      if (drums.h[i] === 'x') noise(ctx, bus, noiseBuffer, when, { dur: 0.035, vol: 0.07, type: 'highpass', freq: 7000 });
    }
  };

  const schedule = () => {
    while (next < ctx.currentTime + 0.3) {
      playStep(next);
      next += stepDur;
      step++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 70);

  return {
    stop() {
      clearInterval(timer);
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
      setTimeout(() => bus.disconnect(), 900);
    },
  };
}
