// 部屋の背景。エリアごとの特色を、4px の四角を並べたドット絵風の模様でコードから描く（画像素材は使わない）。
// 戦闘の邪魔にならないよう、どれも暗めで薄く描く。部屋ごとに seed を変えると、置き場所が変わる。
import { ROOM, SCREEN } from '../data/balance.js';

const PX = 4; // ドット1つの大きさ

// seed から決まる乱数（同じ部屋なら、いつも同じ背景になる）
function seeded(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const snap = (v) => Math.round(v / PX) * PX;

// ドットの四角（位置と大きさは 4px 刻みにそろえる）
function block(g, x, y, w, h, color, alpha = 1) {
  g.fillStyle(color, alpha).fillRect(snap(x), snap(y), Math.max(PX, snap(w)), Math.max(PX, snap(h)));
}

// ドットで描いた楕円（水たまり、霜など）
function blob(g, cx, cy, rx, ry, color, alpha) {
  for (let y = -ry; y <= ry; y += PX) {
    const half = rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)));
    if (half >= PX) block(g, cx - half, cy + y, half * 2, PX, color, alpha);
  }
}

// ばらまく点（床のざらつき）
function speckles(g, rng, area, count, colors, alpha) {
  for (let i = 0; i < count; i++) {
    const x = area.left + rng() * (area.right - area.left);
    const y = area.top + rng() * (area.bottom - area.top);
    block(g, x, y, PX, PX, colors[Math.floor(rng() * colors.length)], alpha);
  }
}

const THEMES = {
  // 下層スラム：ひび割れた路面、水たまりに映るネオン、垂れた電線、看板
  slum(g, rng, a) {
    speckles(g, rng, a, 320, [0x1c1733, 0x241d40, 0x120f20, 0x2a2148], 0.7);
    // 路面の白線（かすれている）
    for (let x = a.left + 30; x < a.right - 40; x += 72) {
      if (rng() < 0.75) block(g, x, a.cy - 2, 36, PX, 0xffc23a, 0.1);
    }
    // 水たまり。ネオンの色が映る
    for (let i = 0; i < 5; i++) {
      const cx = a.left + 80 + rng() * (a.w - 160);
      const cy = a.top + 60 + rng() * (a.h - 120);
      const rx = 30 + rng() * 40;
      const color = rng() < 0.5 ? 0x2ef2ff : 0xff2bd6;
      blob(g, cx, cy, rx, rx * 0.35, 0x05040a, 0.5);
      blob(g, cx, cy, rx * 0.8, rx * 0.22, color, 0.09);
      block(g, cx - rx * 0.4, cy - PX, rx * 0.5, PX, color, 0.18);
    }
    // マンホール
    for (let i = 0; i < 2; i++) {
      const cx = a.left + 120 + rng() * (a.w - 240);
      const cy = a.top + 80 + rng() * (a.h - 160);
      blob(g, cx, cy, 22, 22, 0x2a2546, 0.5);
      blob(g, cx, cy, 16, 16, 0x0b0914, 0.8);
      block(g, cx - 10, cy - 2, 20, PX, 0x2a2546, 0.5);
      block(g, cx - 2, cy - 10, PX, 20, 0x2a2546, 0.5);
    }
    // 垂れ下がった電線（上から下へ、たるみながら横切る）
    for (let i = 0; i < 3; i++) {
      const y0 = a.top + 40 + rng() * (a.h - 80);
      const sag = 20 + rng() * 40;
      for (let x = a.left; x < a.right; x += PX) {
        const k = (x - a.left) / a.w;
        block(g, x, y0 + Math.sin(k * Math.PI) * sag, PX, PX, 0x05040a, 0.75);
      }
    }
    // 壁ぎわのネオン看板と、床に落ちる光
    const signs = [0xff2bd6, 0x2ef2ff, 0xffc23a, 0x5dffa0];
    for (let i = 0; i < 4; i++) {
      const x = a.left + 60 + i * (a.w / 4) + rng() * 60;
      const w = 44 + rng() * 40;
      const color = signs[Math.floor(rng() * signs.length)];
      block(g, x, a.top + 6, w, 12, color, 0.32);
      block(g, x + 4, a.top + 10, w - 12, PX, 0xffffff, 0.22);
      for (let k = 0; k < 4; k++) block(g, x - k * 6, a.top + 22 + k * 14, w + k * 12, 14, color, 0.035 - k * 0.007);
    }
    // 下の壁ぎわの木箱とごみ袋
    for (let i = 0; i < 5; i++) {
      const x = a.left + 30 + rng() * (a.w - 80);
      const s = 16 + Math.floor(rng() * 3) * 4;
      block(g, x, a.bottom - s - 4, s, s, 0x231d3d, 0.9);
      block(g, x, a.bottom - s - 4, s, PX, 0x3a3360, 0.9);
      block(g, x + s / 2 - 2, a.bottom - s - 4, PX, s, 0x16122a, 0.9);
    }
  },

  // 冷却プラント：金網の床、壁を走る配管、霜、通気口、冷却剤のたまり
  plant(g, rng, a) {
    // 金網（斜めの格子）
    g.lineStyle(1, 0x4fb8ff, 0.045);
    for (let d = -a.h; d < a.w; d += 16) {
      g.lineBetween(a.left + Math.max(0, d), a.top + Math.max(0, -d), a.left + Math.min(a.w, d + a.h), a.top + Math.min(a.h, a.h - d));
      g.lineBetween(a.right - Math.max(0, d), a.top + Math.max(0, -d), a.right - Math.min(a.w, d + a.h), a.top + Math.min(a.h, a.h - d));
    }
    speckles(g, rng, a, 160, [0x12233a, 0x0c1828, 0x1a3352], 0.7);
    // 上下の壁ぎわを走る配管。継ぎ目とバルブつき
    for (const y of [a.top + 8, a.top + 26, a.bottom - 20]) {
      block(g, a.left, y, a.w, 12, 0x15293f, 0.95);
      block(g, a.left, y, a.w, PX, 0x2a4a6c, 0.9);
      block(g, a.left, y + 8, a.w, PX, 0x0a1522, 0.9);
      for (let x = a.left + 40 + rng() * 60; x < a.right - 20; x += 90 + rng() * 60) {
        block(g, x, y - 2, 8, 16, 0x35587c, 0.95);
        if (rng() < 0.4) {
          block(g, x + 20, y - 8, 12, PX, 0x8fd8ff, 0.5);
          block(g, x + 24, y - 8, PX, 8, 0x8fd8ff, 0.5);
        }
      }
    }
    // 左右の壁ぎわの縦の配管
    for (const x of [a.left + 6, a.right - 18]) {
      block(g, x, a.top + 40, 12, a.h - 64, 0x15293f, 0.9);
      block(g, x, a.top + 40, PX, a.h - 64, 0x2a4a6c, 0.9);
    }
    // 霜（白っぽい点の集まり）
    for (let i = 0; i < 9; i++) {
      const cx = a.left + rng() * a.w;
      const cy = a.top + rng() * a.h;
      for (let k = 0; k < 26; k++) {
        const r = rng() * 46;
        const t = rng() * Math.PI * 2;
        const x = cx + Math.cos(t) * r;
        const y = cy + Math.sin(t) * r * 0.6;
        if (x > a.left && x < a.right && y > a.top && y < a.bottom) block(g, x, y, PX, PX, rng() < 0.3 ? 0xffffff : 0x8fd8ff, 0.16);
      }
    }
    // 通気口（細い板が並ぶ）と、そこから漏れる冷気
    for (let i = 0; i < 3; i++) {
      const x = a.left + 90 + rng() * (a.w - 220);
      const y = a.top + 70 + rng() * (a.h - 160);
      block(g, x, y, 44, 28, 0x0a1522, 0.9);
      for (let k = 0; k < 4; k++) block(g, x + 4, y + 4 + k * 6, 36, PX, 0x2a4a6c, 0.8);
      blob(g, x + 22, y + 14, 46, 26, 0x8fd8ff, 0.035);
    }
    // 冷却剤のたまり
    for (let i = 0; i < 3; i++) {
      const cx = a.left + 80 + rng() * (a.w - 160);
      const cy = a.top + 60 + rng() * (a.h - 120);
      const rx = 26 + rng() * 30;
      blob(g, cx, cy, rx, rx * 0.4, 0x2ef2ff, 0.08);
      block(g, cx - rx * 0.3, cy - PX, rx * 0.4, PX, 0xffffff, 0.14);
    }
  },

  // 企業タワー：サーバールーム。光る継ぎ目の床板、基板のような配線、壁ぎわのサーバーラック
  tower(g, rng, a) {
    // 床板（大きな升目）。いくつかの板がうっすら光る
    for (let x = a.left; x < a.right; x += 80) {
      for (let y = a.top; y < a.bottom; y += 80) {
        if (rng() < 0.22) block(g, x + 4, y + 4, 72, 72, 0xffc23a, 0.03);
        block(g, x, y, 80, PX, 0xff7a3d, 0.06);
        block(g, x, y, PX, 80, 0xff7a3d, 0.06);
      }
    }
    speckles(g, rng, a, 120, [0x241414, 0x1a0e0e, 0x2e1a16], 0.7);
    // 基板の配線：直角に折れる線と、接続点
    for (let i = 0; i < 12; i++) {
      let x = snap(a.left + rng() * a.w);
      let y = snap(a.top + rng() * a.h);
      const color = rng() < 0.7 ? 0xff7a3d : 0xffc23a;
      block(g, x - 2, y - 2, 8, 8, color, 0.22);
      for (let k = 0; k < 4; k++) {
        const len = snap(40 + rng() * 110) * (rng() < 0.5 ? 1 : -1);
        if (k % 2 === 0) {
          const nx = Math.max(a.left, Math.min(a.right - PX, x + len));
          block(g, Math.min(x, nx), y, Math.abs(nx - x) + PX, PX, color, 0.1);
          x = nx;
        } else {
          const ny = Math.max(a.top, Math.min(a.bottom - PX, y + len));
          block(g, x, Math.min(y, ny), PX, Math.abs(ny - y) + PX, color, 0.1);
          y = ny;
        }
      }
      block(g, x - 2, y - 2, 8, 8, color, 0.22);
    }
    // 上の壁ぎわに並ぶサーバーラック。小さなランプが点いている
    const lamps = [0x5dffa0, 0xffc23a, 0xff4d5e, 0x2ef2ff];
    for (let x = a.left + 8; x < a.right - 56; x += 64) {
      block(g, x, a.top + 6, 56, 30, 0x1a0e0e, 0.95);
      block(g, x, a.top + 6, 56, PX, 0x4a2a22, 0.95);
      for (let r = 0; r < 3; r++) {
        block(g, x + 4, a.top + 14 + r * 8, 48, PX, 0x2e1a16, 0.95);
        for (let k = 0; k < 3; k++) {
          if (rng() < 0.6) block(g, x + 8 + k * 12 + Math.floor(rng() * 2) * 4, a.top + 14 + r * 8, PX, PX, lamps[Math.floor(rng() * lamps.length)], 0.85);
        }
      }
    }
    // 下の壁ぎわのケーブルの束
    block(g, a.left, a.bottom - 14, a.w, 8, 0x1a0e0e, 0.9);
    for (let x = a.left; x < a.right; x += 24) block(g, x, a.bottom - 14, 12, PX, 0x4a2a22, 0.8);
    // 部屋の中央の大きな紋（六角形の輪）
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push({ x: a.cx + Math.cos((i * Math.PI) / 3) * 150, y: a.cy + Math.sin((i * Math.PI) / 3) * 150 });
    g.lineStyle(PX, 0xff7a3d, 0.05).strokePoints(pts, true, true);
  },

  // 隠れ家：板張りの床、敷物、作業台、木箱、端末につながるケーブル
  hideout(g, rng, a) {
    // 床板
    for (let y = a.top; y < a.bottom; y += 24) {
      block(g, a.left, y, a.w, PX, 0x2a2546, 0.35);
      for (let x = a.left + rng() * 120; x < a.right; x += 120 + rng() * 80) block(g, x, y, PX, 24, 0x2a2546, 0.3);
    }
    speckles(g, rng, a, 140, [0x1b1631, 0x231d3d, 0x120f20], 0.7);
    // 敷物（部屋の中央）
    block(g, a.cx - 190, a.cy - 60, 380, 120, 0xff2bd6, 0.045);
    for (const [x, y, w, h] of [[a.cx - 190, a.cy - 60, 380, PX], [a.cx - 190, a.cy + 56, 380, PX], [a.cx - 190, a.cy - 60, PX, 120], [a.cx + 186, a.cy - 60, PX, 120]]) block(g, x, y, w, h, 0xff2bd6, 0.16);
    block(g, a.cx - 170, a.cy - 44, 340, PX, 0xff2bd6, 0.08);
    block(g, a.cx - 170, a.cy + 40, 340, PX, 0xff2bd6, 0.08);
    // 武器ラックの下の作業台
    block(g, 190, 176, 440, 12, 0x231d3d, 0.95);
    block(g, 190, 176, 440, PX, 0x3a3360, 0.95);
    for (const x of [198, 410, 618]) block(g, x, 188, 8, 16, 0x16122a, 0.95);
    // 端末につながるケーブル（下の壁へ）
    for (const x of [240, 440]) {
      for (let y = 424; y < a.bottom; y += PX) block(g, x + Math.sin(y * 0.08) * 6, y, PX, PX, 0x05040a, 0.8);
    }
    // 右下の木箱の山
    for (const [x, y, s] of [[a.right - 120, a.bottom - 36, 32], [a.right - 84, a.bottom - 28, 24], [a.right - 112, a.bottom - 60, 24], [a.left + 20, a.bottom - 32, 28]]) {
      block(g, x, y, s, s, 0x231d3d, 0.95);
      block(g, x, y, s, PX, 0x3a3360, 0.95);
      block(g, x + s / 2 - 2, y, PX, s, 0x16122a, 0.95);
    }
    // 上の壁ぎわのモニターと、その光
    for (const [x, color] of [[a.left + 30, 0x2ef2ff], [a.right - 250, 0x5dffa0], [a.right - 170, 0xffc23a]]) {
      block(g, x, a.top + 6, 60, 28, 0x0b0914, 0.95);
      block(g, x + 4, a.top + 10, 52, 20, color, 0.14);
      for (let k = 0; k < 3; k++) block(g, x + 8, a.top + 14 + k * 6, 20 + rng() * 24, PX, color, 0.4);
      block(g, x - 8, a.top + 36, 76, 20, color, 0.03);
    }
  },
  // 下水道：濡れた床、流れる汚水の溝、壁ぎわの配管、鉄格子、苔
  sewer(g, rng, a) {
    speckles(g, rng, a, 300, [0x0d1d18, 0x12281f, 0x091511, 0x16332a], 0.7);
    // 汚水の溝（横に2本。水面がところどころ光る）
    for (const k of [0.3, 0.72]) {
      const y = a.top + a.h * k + (rng() - 0.5) * 30;
      block(g, a.left, y - 10, a.w, 20, 0x04100c, 0.75);
      block(g, a.left, y - 12, a.w, PX, 0x1f4a3a, 0.5);
      block(g, a.left, y + 8, a.w, PX, 0x1f4a3a, 0.5);
      for (let x = a.left + rng() * 40; x < a.right - 30; x += 40 + rng() * 70) block(g, x, y - 2 + (rng() < 0.5 ? -4 : 4), 12 + rng() * 22, PX, 0x5dffa0, 0.14);
    }
    // 床の鉄格子（排水口）
    for (let i = 0; i < 3; i++) {
      const cx = a.left + 90 + rng() * (a.w - 180);
      const cy = a.top + 70 + rng() * (a.h - 140);
      block(g, cx - 22, cy - 14, 44, 28, 0x030806, 0.8);
      for (let x = cx - 18; x <= cx + 14; x += 8) block(g, x, cy - 14, PX, 28, 0x24483a, 0.7);
      block(g, cx - 22, cy - 14, 44, PX, 0x24483a, 0.7);
      block(g, cx - 22, cy + 10, 44, PX, 0x24483a, 0.7);
    }
    // 壁ぎわの配管（上の壁に沿って走り、ところどころ継ぎ手がある）
    for (const y of [a.top + 8, a.top + 22]) {
      block(g, a.left, y, a.w, 8, 0x16332a, 0.75);
      block(g, a.left, y, a.w, PX / 2, 0x3fae7a, 0.25);
      for (let x = a.left + 40 + rng() * 60; x < a.right - 20; x += 110 + rng() * 80) block(g, x, y - 2, 12, 12, 0x24483a, 0.9);
    }
    // 配管からの水もれ
    for (let i = 0; i < 4; i++) {
      const x = a.left + 60 + rng() * (a.w - 120);
      const len = 30 + rng() * 60;
      block(g, x, a.top + 30, PX, len, 0x5dffa0, 0.1);
      blob(g, x + 2, a.top + 32 + len, 14, 5, 0x5dffa0, 0.08);
    }
    // 苔（部屋のすみ）
    for (let i = 0; i < 14; i++) {
      const left = rng() < 0.5;
      const x = left ? a.left + rng() * 70 : a.right - 20 - rng() * 70;
      const y = a.top + 40 + rng() * (a.h - 60);
      block(g, x, y, 8 + rng() * 14, PX, 0x2f7a4a, 0.35);
    }
    // 下の壁の太い配管の口
    for (let i = 0; i < 2; i++) {
      const x = a.left + 140 + rng() * (a.w - 280);
      blob(g, x, a.bottom - 6, 26, 14, 0x030806, 0.9);
      blob(g, x, a.bottom - 6, 20, 9, 0x0d1d18, 0.9);
      block(g, x - 26, a.bottom - 22, 52, PX, 0x24483a, 0.8);
    }
  },
  // 貯水槽：水槽の底。水位の目盛り、床の継ぎ目、太い配管、波紋、沈んだがらくた
  tank(g, rng, a) {
    speckles(g, rng, a, 260, [0x0b1826, 0x102337, 0x08121d, 0x163049], 0.7);
    // 床の継ぎ目（大きな板）
    for (let x = a.left + 120; x < a.right - 40; x += 180) block(g, x, a.top, PX / 2, a.h, 0x1c3a58, 0.5);
    for (let y = a.top + 130; y < a.bottom - 40; y += 150) block(g, a.left, y, a.w, PX / 2, 0x1c3a58, 0.5);
    // 左右の壁の水位の目盛り
    for (const x of [a.left + 6, a.right - 30]) {
      for (let y = a.top + 30, i = 0; y < a.bottom - 20; y += 26, i++) block(g, x, y, i % 4 === 0 ? 24 : 12, PX / 2, 0x4fb8ff, i % 4 === 0 ? 0.45 : 0.25);
    }
    // 残った水の波紋
    for (let i = 0; i < 6; i++) {
      const cx = a.left + 90 + rng() * (a.w - 180);
      const cy = a.top + 70 + rng() * (a.h - 140);
      const rx = 34 + rng() * 46;
      blob(g, cx, cy, rx, rx * 0.4, 0x04090f, 0.5);
      blob(g, cx, cy, rx * 0.7, rx * 0.26, 0x4fb8ff, 0.07);
      block(g, cx - rx * 0.5, cy - PX, rx * 0.6, PX / 2, 0x8fd8ff, 0.2);
      block(g, cx - rx * 0.1, cy + PX, rx * 0.4, PX / 2, 0x8fd8ff, 0.12);
    }
    // 上の壁の太い配管と、バルブ
    block(g, a.left, a.top + 10, a.w, 14, 0x163049, 0.8);
    block(g, a.left, a.top + 10, a.w, PX / 2, 0x4fb8ff, 0.25);
    for (let x = a.left + 70 + rng() * 60; x < a.right - 40; x += 150 + rng() * 90) {
      block(g, x, a.top + 6, 14, 22, 0x1c3a58, 0.95);
      block(g, x - 6, a.top + 30, 26, PX, 0xffc23a, 0.35);
    }
    // 沈んだがらくた（箱、折れた手すり）
    for (let i = 0; i < 5; i++) {
      const x = a.left + 60 + rng() * (a.w - 120);
      const y = a.top + 60 + rng() * (a.h - 120);
      if (rng() < 0.5) {
        block(g, x, y, 22, 16, 0x102337, 0.8);
        block(g, x, y, 22, PX / 2, 0x1c3a58, 0.8);
      } else {
        block(g, x, y, 40, PX, 0x1c3a58, 0.7);
        block(g, x + 6, y, PX, 14, 0x1c3a58, 0.7);
        block(g, x + 30, y, PX, 14, 0x1c3a58, 0.7);
      }
    }
    // 下の壁の排水口
    for (let i = 0; i < 3; i++) {
      const x = a.left + 110 + i * ((a.w - 220) / 2);
      block(g, x - 20, a.bottom - 16, 40, 12, 0x04090f, 0.9);
      for (let k = 0; k < 5; k++) block(g, x - 18 + k * 9, a.bottom - 16, PX / 2, 12, 0x1c3a58, 0.9);
    }
  },
  // 浄水プラント：丸い沈殿池、ろ過装置の格子、床を走る太い管、こぼれた汚泥
  filter(g, rng, a) {
    speckles(g, rng, a, 280, [0x1a1022, 0x241530, 0x120a18, 0x2e1a3c], 0.7);
    // 沈殿池（丸い池。ふちが光る）
    for (let i = 0; i < 4; i++) {
      const cx = a.left + 120 + rng() * (a.w - 240);
      const cy = a.top + 90 + rng() * (a.h - 180);
      const r = 40 + rng() * 34;
      blob(g, cx, cy, r, r * 0.62, 0x08050c, 0.75);
      blob(g, cx, cy, r * 0.82, r * 0.5, 0x3a1a4a, 0.5);
      blob(g, cx - r * 0.2, cy - r * 0.1, r * 0.3, r * 0.12, 0xff2bd6, 0.08);
      for (let k = 0; k < 10; k++) {
        const t = (k / 10) * Math.PI * 2;
        block(g, cx + Math.cos(t) * r - 2, cy + Math.sin(t) * r * 0.62 - 2, PX, PX, 0xb05ad0, 0.3);
      }
    }
    // ろ過装置（格子のパネル）
    for (let i = 0; i < 3; i++) {
      const x = a.left + 60 + rng() * (a.w - 200);
      const y = a.top + 50 + rng() * (a.h - 130);
      block(g, x, y, 64, 40, 0x120a18, 0.7);
      for (let c = 0; c <= 64; c += 8) block(g, x + c, y, PX / 2, 40, 0x4a2a5e, 0.7);
      for (let rr = 0; rr <= 40; rr += 8) block(g, x, y + rr, 64, PX / 2, 0x4a2a5e, 0.7);
    }
    // 床を走る太い管（縦に2本）
    for (const k of [0.22, 0.78]) {
      const x = a.left + a.w * k + (rng() - 0.5) * 40;
      block(g, x - 8, a.top, 16, a.h, 0x1e1226, 0.7);
      block(g, x - 8, a.top, PX / 2, a.h, 0xb05ad0, 0.2);
      for (let y = a.top + 30 + rng() * 40; y < a.bottom - 20; y += 90 + rng() * 60) block(g, x - 11, y, 22, 8, 0x4a2a5e, 0.9);
    }
    // こぼれた汚泥
    for (let i = 0; i < 8; i++) {
      const x = a.left + 40 + rng() * (a.w - 80);
      const y = a.top + 40 + rng() * (a.h - 80);
      blob(g, x, y, 10 + rng() * 16, 4 + rng() * 5, 0x5a2a6a, 0.3);
    }
    // 上の壁の表示灯
    for (let x = a.left + 50; x < a.right - 30; x += 120) block(g, x, a.top + 8, 10, PX, rng() < 0.3 ? 0xff4d5e : 0x5dffa0, 0.5);
  },
  // 資材置き場：積まれた鉄骨、コンテナ、黄色と黒のしま模様、タイヤの跡、コーン
  yard(g, rng, a) {
    speckles(g, rng, a, 300, [0x1c180e, 0x262013, 0x14110a, 0x302818], 0.7);
    // タイヤの跡（斜めに2本ずつ）
    for (let i = 0; i < 3; i++) {
      const x0 = a.left + rng() * a.w * 0.6;
      const y0 = a.top + 40 + rng() * (a.h - 80);
      const slope = (rng() - 0.5) * 0.5;
      for (let x = 0; x < a.w * 0.5; x += PX) {
        if ((x / PX) % 3 === 0) continue;
        block(g, x0 + x, y0 + x * slope, PX, PX, 0x0a0805, 0.6);
        block(g, x0 + x, y0 + x * slope + 14, PX, PX, 0x0a0805, 0.6);
      }
    }
    // 積まれた鉄骨（H 形の束）
    for (let i = 0; i < 4; i++) {
      const x = a.left + 50 + rng() * (a.w - 200);
      const y = a.top + 50 + rng() * (a.h - 110);
      const len = 80 + rng() * 60;
      for (let k = 0; k < 3; k++) {
        block(g, x + k * 4, y + k * 9, len, 6, 0x3a3018, 0.8);
        block(g, x + k * 4, y + k * 9, len, PX / 2, 0xc9a12e, 0.3);
        block(g, x + k * 4, y + k * 9 + 5, len, PX / 2, 0x14110a, 0.8);
      }
    }
    // コンテナ（四角い箱。側面に縦のすじ）
    for (let i = 0; i < 3; i++) {
      const x = a.left + 80 + rng() * (a.w - 240);
      const y = a.top + 60 + rng() * (a.h - 150);
      const color = rng() < 0.5 ? 0x4a2a1a : 0x1e3340;
      block(g, x, y, 84, 44, color, 0.45);
      for (let c = 6; c < 84; c += 10) block(g, x + c, y, PX / 2, 44, 0x0a0805, 0.4);
      block(g, x, y, 84, PX / 2, 0xc9a12e, 0.25);
    }
    // 上の壁ぎわの、黄色と黒のしま模様
    for (let x = a.left, i = 0; x < a.right; x += 16, i++) block(g, x, a.top + 6, 16, 8, i % 2 === 0 ? 0xc9a12e : 0x14110a, i % 2 === 0 ? 0.3 : 0.6);
    // コーン
    for (let i = 0; i < 6; i++) {
      const x = a.left + 40 + rng() * (a.w - 80);
      const y = a.top + 50 + rng() * (a.h - 90);
      block(g, x, y, 10, PX, 0xff7a3d, 0.5);
      block(g, x + 2, y - 4, 6, PX, 0xff7a3d, 0.5);
      block(g, x + 3, y - 8, PX, PX, 0xff7a3d, 0.5);
    }
    // 下の壁ぎわの、鉄筋の束
    for (let i = 0; i < 4; i++) {
      const x = a.left + 60 + rng() * (a.w - 160);
      for (let k = 0; k < 4; k++) block(g, x + k * 3, a.bottom - 18 - k * 3, 70 + rng() * 30, PX / 2, 0x6a5a30, 0.6);
    }
  },
  // 高架の現場：橋げたの床（継ぎ目とリベット）、下に見える街の灯り、手すり、垂れたワイヤー
  bridge(g, rng, a) {
    speckles(g, rng, a, 240, [0x12161e, 0x181e28, 0x0c0f15, 0x202836], 0.7);
    // 床の桁の継ぎ目（横に長い板が並ぶ）とリベット
    for (let y = a.top + 70; y < a.bottom - 30; y += 84) {
      block(g, a.left, y, a.w, PX / 2, 0x2a3446, 0.7);
      for (let x = a.left + 20; x < a.right - 10; x += 44) block(g, x, y - 5, PX, PX, 0x3a4860, 0.7);
    }
    for (let x = a.left + 150; x < a.right - 60; x += 210) block(g, x, a.top, PX / 2, a.h, 0x2a3446, 0.5);
    // 床の抜けたところから、下の街の灯りが見える
    for (let i = 0; i < 4; i++) {
      const x = a.left + 80 + rng() * (a.w - 240);
      const y = a.top + 60 + rng() * (a.h - 140);
      const w = 50 + rng() * 60;
      block(g, x, y, w, 30, 0x04050a, 0.85);
      for (let k = 0; k < 7; k++) {
        const color = [0x2ef2ff, 0xff2bd6, 0xffc23a][Math.floor(rng() * 3)];
        block(g, x + 4 + rng() * (w - 10), y + 4 + rng() * 22, PX, PX / 2, color, 0.35);
      }
      block(g, x, y, w, PX / 2, 0x3a4860, 0.8);
      block(g, x, y + 30, w, PX / 2, 0x3a4860, 0.8);
    }
    // 上下の手すり
    for (const y of [a.top + 8, a.bottom - 14]) {
      block(g, a.left, y, a.w, PX, 0x3a4860, 0.8);
      for (let x = a.left + 10; x < a.right; x += 34) block(g, x, y, PX / 2, 10, 0x3a4860, 0.8);
    }
    // 垂れたワイヤー（上から下へ、斜めに）
    for (let i = 0; i < 3; i++) {
      const x0 = a.left + 80 + rng() * (a.w - 160);
      const lean = (rng() - 0.5) * 120;
      for (let y = a.top; y < a.bottom; y += PX) block(g, x0 + ((y - a.top) / a.h) * lean, y, PX / 2, PX, 0x05070b, 0.6);
    }
    // 置きっぱなしの工具箱
    for (let i = 0; i < 4; i++) {
      const x = a.left + 50 + rng() * (a.w - 100);
      const y = a.top + 50 + rng() * (a.h - 100);
      block(g, x, y, 18, 10, 0x4a3a1a, 0.6);
      block(g, x + 6, y - 3, 6, PX, 0x8fd8ff, 0.3);
    }
  },
  // 未完の塔：骨組みだけの最上階。鉄骨の梁、床の抜けたところから見える空、資材、赤い航空灯
  frame(g, rng, a) {
    speckles(g, rng, a, 220, [0x1a120e, 0x241814, 0x120c0a, 0x30201a], 0.7);
    // 太い梁（縦横の格子）
    for (let x = a.left + 110; x < a.right - 40; x += 180) {
      block(g, x - 5, a.top, 10, a.h, 0x2e1e16, 0.8);
      block(g, x - 5, a.top, PX / 2, a.h, 0xd07a3a, 0.2);
    }
    for (let y = a.top + 100; y < a.bottom - 40; y += 150) {
      block(g, a.left, y - 5, a.w, 10, 0x2e1e16, 0.8);
      block(g, a.left, y - 5, a.w, PX / 2, 0xd07a3a, 0.2);
    }
    // 梁の交わるところのボルト
    for (let x = a.left + 110; x < a.right - 40; x += 180) {
      for (let y = a.top + 100; y < a.bottom - 40; y += 150) {
        for (const [dx, dy] of [[-8, -8], [6, -8], [-8, 6], [6, 6]]) block(g, x + dx, y + dy, PX / 2, PX / 2, 0xd07a3a, 0.6);
      }
    }
    // 床の抜けたところ：遠い空と、下の階の灯り
    for (let i = 0; i < 5; i++) {
      const x = a.left + 60 + rng() * (a.w - 200);
      const y = a.top + 50 + rng() * (a.h - 130);
      const w = 60 + rng() * 50;
      const h = 34 + rng() * 26;
      block(g, x, y, w, h, 0x05060c, 0.8);
      for (let k = 0; k < 5; k++) block(g, x + 4 + rng() * (w - 8), y + 4 + rng() * (h - 8), PX / 2, PX / 2, 0xe9e6ff, 0.4);
      block(g, x, y, w, PX / 2, 0x4a3024, 0.9);
    }
    // 積まれた資材（短い鉄骨の束）
    for (let i = 0; i < 4; i++) {
      const x = a.left + 50 + rng() * (a.w - 160);
      const y = a.top + 60 + rng() * (a.h - 110);
      for (let k = 0; k < 3; k++) block(g, x + k * 3, y + k * 7, 56 + rng() * 30, 5, 0x4a3024, 0.75);
    }
    // 上の壁ぎわの航空灯（赤く光る）
    for (let x = a.left + 70; x < a.right - 30; x += 150) {
      block(g, x, a.top + 8, 8, 8, 0xff4d5e, 0.55);
      blob(g, x + 4, a.top + 12, 22, 12, 0xff4d5e, 0.05);
    }
    // 垂れた鎖
    for (let i = 0; i < 3; i++) {
      const x = a.left + 90 + rng() * (a.w - 180);
      const len = 50 + rng() * 80;
      for (let y = 0; y < len; y += PX * 2) block(g, x, a.top + y, PX / 2, PX, 0x6a4a3a, 0.6);
    }
  },
};

// 部屋の内側（壁の内側）に、エリアの背景を描く
export function drawBackdrop(g, theme, seed = 1) {
  const left = ROOM.wall;
  const top = ROOM.wallTop;
  const right = SCREEN.width - ROOM.wall;
  const bottom = SCREEN.height - ROOM.wall;
  const area = { left, top, right, bottom, w: right - left, h: bottom - top, cx: (left + right) / 2, cy: (top + bottom) / 2 };
  THEMES[theme]?.(g, seeded(seed), area);
}

export function hasBackdrop(theme) {
  return theme in THEMES;
}
