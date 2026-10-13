// 共通の攻撃の部品（突進・弾の扇・衝撃波・線・跳びかかり・円錐・周囲の一撃・雨・レーザー・召喚・汚れ床・大技の「耐える」「安全地帯」「追尾」）を、
// 部品ごとにテストするための、攻撃の定義。2026-10-13 までは、マップ1の3体（ボルトボア・クライオ・ワイバーン・オーバーロード）が
// これらを使っていた。いまは、ボスがそれぞれ固有の攻撃を使うので、部品のテストには、ここの定義を使う。
// （部品の関数は、ほかのボスがまだ使っているあいだは残してある。使うボスがいなくなったら、部品もテストも削除する）
export const SHARED_ATTACKS = {
  // ボルトボア（旧）
  charge: { pattern: 'charge', telegraph: 0.8, lockTime: 0.25, speed: 560, duration: 0.9, damage: 38, recover: 0.7, wallStun: 1.6, reach: 'far' },
  doubleCharge: { pattern: 'charge', repeat: 2, repeatTelegraph: 0.5, telegraph: 0.7, lockTime: 0.2, speed: 600, duration: 0.9, damage: 38, recover: 0.8, wallStun: 1.6, reach: 'far' },
  stomp: { pattern: 'shockwave', telegraph: 0.8, damage: 22, ringSpeed: 330, ringMax: 320, ringWidth: 14, recover: 0.9, reach: 'near' },
  sparks: { pattern: 'barrage', telegraph: 0.7, count: 10, spread: 360, waves: 1, shotSpeed: 230, shotRadius: 7, damage: 22, recover: 0.7 },
  sparksHard: { pattern: 'barrage', telegraph: 0.6, count: 10, spread: 360, waves: 3, interval: 0.45, rotate: 18, shotSpeed: 250, shotRadius: 7, damage: 22, recover: 0.8 },
  thunder: { pattern: 'lines', telegraph: 0.6, orient: 'aim', count: 3, spacing: 110, width: 34, delay: 0.8, stagger: 0.25, damage: 30, recover: 0.8 },
  thunderHard: { pattern: 'lines', telegraph: 0.5, orient: 'aim', count: 5, spacing: 95, width: 34, delay: 0.7, stagger: 0.2, damage: 30, recover: 0.8 },
  leap: { pattern: 'leap', telegraph: 0.9, lockTime: 0.3, air: 0.5, radius: 105, damage: 38, ring: { speed: 300, max: 260, width: 14, damage: 22 }, recover: 0.9, reach: 'far' },
  overcharge: {
    pattern: 'endure', telegraph: 0.8, duration: 5, break: 0.06, stun: 4, recover: 1.2,
    pulse: { move: 'sparks', interval: 1.7 },
    blast: { count: 3, interval: 0.45, damage: 38, ringSpeed: 380, ringMax: 980, ringWidth: 18 },
  },
  // クライオ・ワイバーン（旧）
  breath: { pattern: 'cone', telegraph: 0.9, lockTime: 0.3, range: 400, arc: 54, duration: 1.1, damage: 26, slow: true, recover: 0.7 },
  sweep: { pattern: 'slam', telegraph: 0.65, radius: 135, damage: 36, recover: 0.6, reach: 'near' },
  icicles: { pattern: 'rain', telegraph: 0.4, count: 7, interval: 0.28, delay: 0.85, radius: 36, spread: 60, damage: 29, recover: 0.7 },
  iciclesHard: { pattern: 'rain', telegraph: 0.3, count: 11, interval: 0.2, delay: 0.8, radius: 36, spread: 80, damage: 29, recover: 0.6 },
  dive: { pattern: 'charge', telegraph: 0.75, lockTime: 0.25, speed: 680, duration: 0.8, damage: 34, recover: 0.6, wallStun: 0.8, reach: 'far' },
  shards: { pattern: 'barrage', telegraph: 0.6, lockTime: 0.15, count: 5, spread: 50, waves: 3, interval: 0.4, track: true, shotSpeed: 300, shotRadius: 7, damage: 22, slow: true, recover: 0.7, reach: 'far' },
  frost: { pattern: 'pools', telegraph: 0.6, count: 4, radius: 56, spread: 130, arm: 0.9, life: 6, tick: 0.6, damage: 14, slow: true, recover: 0.6 },
  zero: { pattern: 'safezone', telegraph: 1.9, waveTelegraph: 1.4, zones: 2, radius: 78, within: 190, waves: 3, active: 0.35, damage: 44, recover: 1.5 },
  // マップ2のボス（旧）
  pinch: { pattern: 'cone', telegraph: 0.75, lockTime: 0.3, range: 170, arc: 110, duration: 0.25, damage: 42, recover: 1.1, reach: 'near' },
  rebirth: {
    pattern: 'endure', telegraph: 0.8, duration: 6, break: 0.04, stun: 4.5, recover: 1.2, heal: 0.1, regrow: true,
    pulse: { move: 'drop', interval: 3.2 },
    blast: { count: 2, interval: 0.5, damage: 40, ringSpeed: 360, ringMax: 980, ringWidth: 18 },
  },
  drop: { pattern: 'rain', telegraph: 0.4, count: 8, interval: 0.3, delay: 0.9, radius: 40, spread: 80, damage: 32, recover: 0.8 },
  rupture: {
    pattern: 'chase', telegraph: 1.0, count: 5, interval: 0.95, spawn: 140, speed: 330, follow: 1.1, lock: 0.55, radius: 62, damage: 40, recover: 1.2,
    pool: { radius: 56, arm: 0.2, life: 5, tick: 0.5, damage: 16, slow: true },
  },
  // オーバーロード（旧）
  laser: { pattern: 'laser', telegraph: 0.9, lead: 55, turn: 190, speed: 95, width: 22, range: 1100, damage: 34, recover: 0.7 },
  summon: { pattern: 'summon', telegraph: 0.7, enemy: 'drone', count: 3, max: 6, recover: 0.6 },
  nova: { pattern: 'shockwave', telegraph: 0.9, damage: 29, ringSpeed: 340, ringMax: 980, ringWidth: 16, recover: 0.8 },
  grid: { pattern: 'lines', telegraph: 0.6, orient: 'cross', count: 6, spacing: 120, width: 30, delay: 0.85, stagger: 0.22, damage: 34, recover: 0.7, reach: 'far' },
  spiral: { pattern: 'barrage', telegraph: 0.7, count: 8, spread: 360, waves: 6, interval: 0.28, rotate: 13, shotSpeed: 210, shotRadius: 7, damage: 26, recover: 0.8 },
  scorch: { pattern: 'pools', telegraph: 0.6, count: 5, radius: 60, spread: 150, arm: 1.0, life: 7, tick: 0.5, damage: 18, recover: 0.6 },
  lockon: { pattern: 'chase', telegraph: 1.0, count: 6, interval: 1.0, spawn: 150, speed: 330, follow: 1.3, lock: 0.55, radius: 60, damage: 40, recover: 1.2 },
};

// そのボスに、共通の部品の攻撃を足す（部品のテスト用）。boss.def.attacks に、SHARED_ATTACKS を混ぜる
export function withShared(boss) {
  boss.def = { ...boss.def, attacks: { ...SHARED_ATTACKS, ...boss.def.attacks } };
  return boss;
}
