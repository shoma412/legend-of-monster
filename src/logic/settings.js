// 設定（音量、表示の大きさ、画質）。セーブ枠とは別に、ブラウザごとに1つだけ持つ。
// 保存先（storage）は外から渡すので、テストでは偽物を使える。

export const SETTINGS_KEY = 'legend-of-monster/settings';
export const VOLUME_STEPS = 10; // 音量ゲージの段階

// 表示の大きさ。fit は画面（ウィンドウ）いっぱいに合わせる
export const DISPLAY_SIZES = [
  { id: 'fit', label: '画面に合わせる', width: null, height: null },
  { id: '960', label: '960×540', width: 960, height: 540 },
  { id: '1280', label: '1280×720', width: 1280, height: 720 },
  { id: '1600', label: '1600×900', width: 1600, height: 900 },
];

// 画質（描画の細かさ）。数字は、基準の 960×540 に対する倍率（2 = 1920×1080, 3 = 2880×1620 で描く）
export const QUALITIES = [
  { id: 1, label: '標準' },
  { id: 2, label: '高' },
  { id: 3, label: '最高' },
];

// フレームレート（1秒に画面を描き直す回数）の上限。0 は制限なし（モニターの速さに合わせる）
export const FRAME_RATES = [
  { id: 0, label: '制限なし' },
  { id: 30, label: '30' },
  { id: 60, label: '60' },
  { id: 120, label: '120' },
];

export function createSettings() {
  return {
    volume: { master: 0.7, bgm: 0.6, se: 0.8 }, // 0〜1
    muted: false,
    displaySize: 'fit',
    quality: 1,
    frameRate: 0,
  };
}

const clamp01 = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback);

// 壊れた値や知らない値は、初期値に戻す
export function normalizeSettings(data) {
  const base = createSettings();
  if (!data || typeof data !== 'object') return base;
  return {
    volume: {
      master: clamp01(data.volume?.master, base.volume.master),
      bgm: clamp01(data.volume?.bgm, base.volume.bgm),
      se: clamp01(data.volume?.se, base.volume.se),
    },
    muted: data.muted === true,
    displaySize: DISPLAY_SIZES.some((d) => d.id === data.displaySize) ? data.displaySize : base.displaySize,
    quality: QUALITIES.some((q) => q.id === data.quality) ? data.quality : base.quality,
    frameRate: FRAME_RATES.some((r) => r.id === data.frameRate) ? data.frameRate : base.frameRate,
  };
}

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return createSettings();
  }
}

export function storeSettings(storage, settings) {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return !!storage;
  } catch {
    return false;
  }
}

// 音量を1段階ぶん上げ下げする（0〜1 に収める）
export function stepVolume(value, delta) {
  const step = Math.round(value * VOLUME_STEPS) + delta;
  return Math.max(0, Math.min(VOLUME_STEPS, step)) / VOLUME_STEPS;
}
