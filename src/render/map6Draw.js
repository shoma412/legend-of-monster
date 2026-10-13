// マップ6のボスの固有の攻撃の絵（動きは src/game/map6Bosses.js）。
import { COLORS, hex } from '../data/theme.js';
import { lineTelegraph, ringTelegraph } from './map1Draw.js';

const WHITE = 0xffffff;
const RED = () => hex(COLORS.red);

export const HAZARD_DRAWS_MAP6 = {
  // 吸気の輪：縮む輪
  closering(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 10, body, 0.18).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(h.x, h.y, h.r);
  },

  // 管の振動：通気口から広がる輪
  ventring(g, h, world) {
    if (h.wait > 0) return;
    const body = hex(h.color);
    g.lineStyle(h.width + 8, body, 0.2).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(h.width * 0.6, body, 0.9).strokeCircle(h.x, h.y, h.r);
    g.lineStyle(2, WHITE, 0.8).strokeCircle(h.x, h.y, h.r);
  },
};

export const BOSS_TELEGRAPHS_MAP6 = {
  bladevolley: ringTelegraph,
  suctionring: ringTelegraph,
  downdraft: ringTelegraph,
  spinevolley: ringTelegraph,
  ductquake: ringTelegraph,
  ductbite: (g, b, act, world) => {
    if (act.phase !== 'telegraph') return;
    const locked = act.t <= act.def.lockTime;
    g.lineStyle(b.r * 1.4, RED(), locked ? 0.18 : 0.06).lineBetween(b.x, b.y, b.x + act.dirX * 900, b.y + act.dirY * 900);
    lineTelegraph(900)(g, b, act, world);
  },
};
