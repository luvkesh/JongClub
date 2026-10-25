// The painted walls of the three signature venues (see cosmetics/venues.ts):
// a Hong Kong tea house, a Tokyo jansō and a Dubai majlis, plus the Hong Kong
// street the tea house looks out on. Same conventions as interior.ts: one
// repeat of the wall, world units through c.y / c.u, softened afterwards.

import type { EnvironmentStyle } from '../cosmetics/catalog';
import { mix } from './tileFaces';
import { finish, glow, lattice, panel, post, rgba, vase, wash, windowCut, woodFill, type Ctx, type G } from './interior';

/** Calligraphy as it reads from across the room: brush marks, not letters (no font needed). */
function brushText(c: Ctx, x: number, top: number, n: number, size: number, ink: string, vertical = true) {
  const { g, r } = c;
  g.fillStyle = ink;
  for (let k = 0; k < n; k++) {
    const cx = vertical ? x : x + k * size * 1.15;
    const cy = vertical ? top + k * size * 1.15 : top;
    // A character's square: a frame of strokes (top and foot, a spine) plus a few inner marks.
    const sq = size * 0.8,
      x0 = cx - sq / 2,
      y0 = cy - sq / 2,
      t = Math.max(1, size * 0.11);
    if (r() < 0.7) g.fillRect(x0, y0 + sq * (0.05 + r() * 0.15), sq, t);
    if (r() < 0.6) g.fillRect(x0 + sq * 0.05, y0 + sq * 0.85, sq * 0.9, t);
    g.fillRect(x0 + sq * (0.3 + r() * 0.4), y0, t, sq);
    const inner = 1 + Math.floor(r() * 3);
    for (let s = 0; s < inner; s++) {
      if (r() < 0.5) g.fillRect(x0 + sq * r() * 0.4, y0 + sq * (0.3 + r() * 0.45), sq * (0.35 + r() * 0.3), t);
      else {
        g.save();
        g.translate(x0 + sq * (0.15 + r() * 0.6), y0 + sq * (0.35 + r() * 0.3));
        g.rotate(r() < 0.5 ? 0.6 : -0.6);
        g.fillRect(0, 0, t, sq * 0.35);
        g.restore();
      }
    }
  }
}

// ------------------------------------------------------------ Hong Kong tea house

/** Glazed wall tiles, slightly uneven, with pale grout. */
function wallTiles(c: Ctx, top: number, bottom: number, base: string) {
  const { g, W, r } = c;
  const tw = c.u(0.44),
    th = c.u(0.22);
  g.fillStyle = mix(base, '#d8d2c0', 0.5);
  g.fillRect(0, top, W, bottom - top);
  let row = 0;
  for (let y = top; y < bottom; y += th, row++) {
    for (let x = row % 2 ? -tw / 2 : 0; x < W; x += tw) {
      const k = r();
      g.fillStyle = mix(base, k < 0.5 ? '#000000' : '#ffffff', Math.abs(k - 0.5) * 0.18);
      g.fillRect(x + 1, y + 1, tw - 2, th - 2);
      // The glaze catches the light along the top edge.
      g.fillStyle = 'rgba(255,255,240,0.1)';
      g.fillRect(x + 1, y + 1, tw - 2, Math.max(1, th * 0.14));
    }
  }
}

/** A stained-glass fanlight: diamond panes in amber, ruby, emerald and cobalt, lit from the street. */
function stainedGlass(c: Ctx, x: number, top: number, bottom: number, w: number, lead: string) {
  const { g } = c;
  const colors = ['#e8a23a', '#b8322a', '#2f8a5a', '#2f5aa8', '#f2d27a'];
  const h = bottom - top;
  const n = 6;
  const dw = w / n;
  g.save();
  g.beginPath();
  g.rect(x, top, w, h);
  g.clip();
  g.fillStyle = '#f2d8a0';
  g.fillRect(x, top, w, h);
  for (let i = -1; i <= n; i++)
    for (let j = 0; j < 3; j++) {
      const cx = x + (i + (j % 2) * 0.5) * dw + dw / 2;
      const cy = top + (j * h) / 2;
      g.fillStyle = colors[(i + j * 2 + 10) % colors.length];
      g.beginPath();
      g.moveTo(cx, cy - h * 0.5);
      g.lineTo(cx + dw / 2, cy);
      g.lineTo(cx, cy + h * 0.5);
      g.lineTo(cx - dw / 2, cy);
      g.closePath();
      g.fill();
      g.strokeStyle = lead;
      g.lineWidth = Math.max(1.5, c.u(0.05));
      g.stroke();
    }
  // Light through the glass.
  const lg = g.createLinearGradient(0, top, 0, bottom);
  lg.addColorStop(0, 'rgba(255,240,200,0.28)');
  lg.addColorStop(1, 'rgba(255,240,200,0.05)');
  g.fillStyle = lg;
  g.fillRect(x, top, w, h);
  g.restore();
  g.strokeStyle = lead;
  g.lineWidth = Math.max(2, c.u(0.1));
  g.strokeRect(x, top, w, h);
}

/** A tall teak booth back with a carved crest rail. */
function boothBack(c: Ctx, x: number, w: number, teak: string) {
  const { g, H } = c;
  const top = c.y(1.25);
  panel(c, x, top, w, H - top, teak, Math.max(3, c.u(0.08)));
  // Crest rail with a soft curve.
  g.fillStyle = mix(teak, '#000000', 0.2);
  g.beginPath();
  g.moveTo(x - c.u(0.06), top + c.u(0.1));
  g.quadraticCurveTo(x + w / 2, top - c.u(0.28), x + w + c.u(0.06), top + c.u(0.1));
  g.lineTo(x + w + c.u(0.06), top + c.u(0.22));
  g.lineTo(x - c.u(0.06), top + c.u(0.22));
  g.fill();
  g.fillStyle = 'rgba(255,220,170,0.12)';
  g.fillRect(x, top - c.u(0.02), w, 1.5);
  // Two inset panels.
  const pw = (w - c.u(0.5)) / 2;
  for (const k of [0, 1]) panel(c, x + c.u(0.17) + k * (pw + c.u(0.16)), top + c.u(0.45), pw, c.u(1.3), mix(teak, '#000000', 0.12), 3);
}

/** The menu wall: a teak board of red price tags, the way tea houses still post their dim sum. */
function menuTags(c: Ctx, x: number, w: number, teak: string) {
  const { g, r } = c;
  const top = c.y(6.4),
    bottom = c.y(3.2);
  g.fillStyle = mix(teak, '#000000', 0.3);
  g.fillRect(x, top, w, bottom - top);
  g.strokeStyle = rgba(c.brass, 0.5);
  g.lineWidth = 1.5;
  g.strokeRect(x + c.u(0.08), top + c.u(0.08), w - c.u(0.16), bottom - top - c.u(0.16));
  const n = Math.max(6, Math.round(w / c.u(0.42)));
  const tw = (w - c.u(0.4)) / n;
  for (let k = 0; k < n; k++) {
    const tx = x + c.u(0.2) + k * tw + tw * 0.12;
    const red = r() < 0.75;
    g.fillStyle = red ? '#9a2018' : '#e8dcc0';
    g.fillRect(tx, top + c.u(0.3), tw * 0.76, bottom - top - c.u(0.6));
    brushText(c, tx + tw * 0.38, top + c.u(0.6), 4, tw * 0.5, red ? 'rgba(240,206,120,0.85)' : 'rgba(40,20,10,0.75)');
  }
  wash(c, x + w / 2, top - c.u(0.4), bottom, w * 0.9, c.e.key, 0.1);
}

/** A tall red signboard with gold calligraphy. */
function signboard(c: Ctx, x: number, top: number, bottom: number, w: number) {
  const { g } = c;
  g.fillStyle = '#7a1610';
  g.fillRect(x, top, w, bottom - top);
  g.strokeStyle = rgba(c.brass, 0.7);
  g.lineWidth = Math.max(2, c.u(0.06));
  g.strokeRect(x + c.u(0.08), top + c.u(0.08), w - c.u(0.16), bottom - top - c.u(0.16));
  brushText(c, x + w / 2, top + c.u(0.55), Math.floor((bottom - top) / (w * 0.75)) - 1, w * 0.62, 'rgba(240,200,110,0.9)');
}

/** A round opal-glass wall lamp. */
function opalLamp(c: Ctx, x: number, wy: number, light: string) {
  const { g } = c;
  const y = c.y(wy);
  wash(c, x, y, y + c.u(2.4), c.u(1.6), light, 0.12);
  glow(g, x, y, c.u(1.0), light, 0.4);
  g.fillStyle = rgba('#fffaf0', 0.9);
  g.beginPath();
  g.arc(x, y, c.u(0.2), 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba(c.brass, 0.8);
  g.fillRect(x - c.u(0.04), y - c.u(0.38), c.u(0.08), c.u(0.2));
}

/** Hong Kong: green-tiled walls, teak booths, stained-glass windows on the street, red signboards. */
export function teahouseRoom(c: Ctx) {
  const { g, W, H, e, r } = c;
  const teak = '#3a2212';
  const plaster = mix('#bfae8a', e.sky, 0.5);
  g.fillStyle = plaster;
  g.fillRect(0, 0, W, H);
  // Old plaster, gently mottled.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(60,40,20,${r() * 0.05})` : `rgba(255,244,220,${r() * 0.04})`;
    g.beginPath();
    g.ellipse(r() * W, r() * H, c.u(0.3 + r()), c.u(0.2 + r() * 0.6), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  wallTiles(c, c.y(1.7), H, '#2f6a56');
  // A band of darker border tiles and the teak dado rail.
  g.fillStyle = '#1f4a3c';
  g.fillRect(0, c.y(1.95), W, c.y(1.7) - c.y(1.95));
  g.fillStyle = teak;
  g.fillRect(0, c.y(2.15), W, c.y(1.95) - c.y(2.15));
  g.fillStyle = rgba(c.brass, 0.35);
  g.fillRect(0, c.y(2.15), W, 1.5);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    if (b % 2 === 0) {
      // A sash window on the street: stained-glass fanlight over clear panes.
      const ix = x0 + bw * 0.17,
        iw = bw * 0.66;
      g.fillStyle = teak;
      g.fillRect(ix - c.u(0.18), c.y(7.95), iw + c.u(0.36), c.y(2.3) - c.y(7.95));
      stainedGlass(c, ix, c.y(7.75), c.y(6.55), iw, '#1c120a');
      windowCut(c, ix, c.y(6.4), c.y(2.5), iw, false, '#24160c');
      // Half-height café curtain on a brass rod.
      g.fillStyle = rgba('#efe6d0', 0.55);
      g.fillRect(ix, c.y(4.0), iw, c.y(2.5) - c.y(4.0));
      g.fillStyle = rgba(c.brass, 0.8);
      g.fillRect(ix - c.u(0.1), c.y(4.0) - 2, iw + c.u(0.2), 3);
      for (let k = 0; k < 9; k++) g.fillRect(ix + (iw * k) / 8 - 1, c.y(4.0), 1, c.y(2.5) - c.y(4.0));
    } else {
      // The menu wall, flanked by signboards, with a clock above.
      menuTags(c, x0 + bw * 0.22, bw * 0.56, teak);
      signboard(c, x0 + bw * 0.08, c.y(7.6), c.y(2.4), bw * 0.09);
      signboard(c, x0 + bw * 0.83, c.y(7.6), c.y(2.4), bw * 0.09);
      const cx = x0 + bw / 2,
        cy = c.y(7.3),
        cr = c.u(0.42);
      g.fillStyle = teak;
      g.beginPath();
      g.arc(cx, cy, cr * 1.18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f2ead6';
      g.beginPath();
      g.arc(cx, cy, cr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#1c120a';
      g.lineWidth = Math.max(1.5, cr * 0.08);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + cr * 0.5, cy - cr * 0.35);
      g.moveTo(cx, cy);
      g.lineTo(cx - cr * 0.1, cy - cr * 0.8);
      g.stroke();
    }
    // Booths along the wall, back to back.
    boothBack(c, x0 + bw * 0.06, bw * 0.4, '#43271a');
    boothBack(c, x0 + bw * 0.54, bw * 0.4, '#43271a');
    post(c, x0 - c.u(0.16), c.u(0.32), c.y(9.4), H, teak, 0.14);
    opalLamp(c, x0 + bw / 2 + (b % 2 ? 0 : bw * 0.5), 8.3, mix(e.key, '#ffffff', 0.3));
  }
  // Cornice, then the coffered teak ceiling running up into the dark.
  g.fillStyle = teak;
  g.fillRect(0, c.y(9.6), W, c.y(8.9) - c.y(9.6));
  g.fillStyle = rgba(c.brass, 0.4);
  g.fillRect(0, c.y(8.95), W, 1.5);
  g.fillStyle = mix(teak, '#000000', 0.35);
  g.fillRect(0, 0, W, c.y(9.6));
  for (let x = 0; x < W; x += bw / 3) panel(c, x + 4, c.y(12), bw / 3 - 8, c.y(9.8) - c.y(12), mix(teak, '#000000', 0.2), 4);
  finish(c, 10.6);
}

// ------------------------------------------------------------ Tokyo jansō

/** Venetian blinds half drawn over a window. */
function blinds(c: Ctx, x: number, top: number, bottom: number, w: number) {
  const { g } = c;
  const slat = c.u(0.13);
  for (let y = top; y < bottom; y += slat) {
    g.fillStyle = 'rgba(214,214,206,0.8)';
    g.fillRect(x, y, w, slat * 0.62);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x, y, w, 1);
  }
  g.fillStyle = 'rgba(200,200,190,0.9)';
  g.fillRect(x, bottom - 2, w, c.u(0.08));
}

/** Rain on the glass: fine streaks over the window. */
function rain(c: Ctx, x: number, top: number, bottom: number, w: number) {
  const { g, r } = c;
  g.save();
  g.beginPath();
  g.rect(x, top, w, bottom - top);
  g.clip();
  g.strokeStyle = 'rgba(200,220,255,0.16)';
  g.lineWidth = 1;
  for (let i = 0; i < w / 3; i++) {
    const sx = x + r() * w,
      sy = top + r() * (bottom - top);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx - 2, sy + c.u(0.3 + r() * 0.5));
    g.stroke();
  }
  for (let i = 0; i < w / 6; i++) {
    g.fillStyle = 'rgba(220,235,255,0.22)';
    g.beginPath();
    g.arc(x + r() * w, top + r() * (bottom - top), 1 + r() * 1.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** A row of members' name plaques, the jansō's wall of regulars. */
function plaques(c: Ctx, x: number, w: number, wy: number) {
  const { g } = c;
  const n = Math.max(6, Math.round(w / c.u(0.36)));
  const pw = w / n;
  const top = c.y(wy),
    h = c.u(1.2);
  g.fillStyle = '#1a120c';
  g.fillRect(x - 3, top - c.u(0.1), w + 6, c.u(0.1));
  for (let k = 0; k < n; k++) {
    const px = x + k * pw + pw * 0.1;
    g.fillStyle = '#efe8d8';
    g.fillRect(px, top, pw * 0.8, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(px + pw * 0.8 - 1, top, 1, h);
    brushText(c, px + pw * 0.34, top + c.u(0.22), 3, pw * 0.42, k % 7 === 3 ? 'rgba(170,30,20,0.85)' : 'rgba(20,16,12,0.8)');
  }
}

/** The house rules board: a framed card of rules in brush lines. */
function rulesBoard(c: Ctx, x: number, top: number, w: number, h: number) {
  const { g } = c;
  g.fillStyle = '#2a1a0e';
  g.fillRect(x - c.u(0.12), top - c.u(0.12), w + c.u(0.24), h + c.u(0.24));
  g.fillStyle = '#f4efe2';
  g.fillRect(x, top, w, h);
  g.fillStyle = '#b02a1e';
  g.fillRect(x + w * 0.1, top + c.u(0.25), w * 0.8, c.u(0.12));
  const cols = 5;
  for (let k = 0; k < cols; k++) brushText(c, x + w - (k + 0.7) * (w / (cols + 0.4)), top + c.u(0.7), 6, w / (cols + 2), 'rgba(24,20,16,0.82)');
}

/** A noren: two indigo cloth panels over a doorway, a white mark split between them. */
function noren(c: Ctx, x: number, w: number) {
  const { g } = c;
  const top = c.y(6.6),
    bottom = c.y(3.6);
  // The doorway: dark corridor beyond.
  g.fillStyle = '#0a0a0c';
  g.fillRect(x, top, w, c.H - top);
  wash(c, x + w / 2, top, c.H, w * 0.8, '#ffe2b0', 0.06);
  g.fillStyle = '#1b2a4a';
  const gap = c.u(0.06);
  g.fillRect(x, top, w / 2 - gap, bottom - top);
  g.fillRect(x + w / 2 + gap, top, w / 2 - gap, bottom - top);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let k = 0; k < 6; k++) g.fillRect(x + (w * k) / 6, top, 1, bottom - top);
  // A white crest across both panels.
  g.strokeStyle = 'rgba(240,236,226,0.85)';
  g.lineWidth = c.u(0.12);
  g.beginPath();
  g.arc(x + w / 2, top + (bottom - top) * 0.45, c.u(0.6), 0, Math.PI * 2);
  g.stroke();
  brushText(c, x + w / 2 - c.u(0.12), top + (bottom - top) * 0.33, 1, c.u(0.6), 'rgba(240,236,226,0.85)');
  g.fillStyle = '#3a2a1a';
  g.fillRect(x - c.u(0.1), top - c.u(0.12), w + c.u(0.2), c.u(0.12));
}

/** Tokyo: a Shōwa-era mahjong parlour. Light wood panelling, rules on the wall, rain on the window. */
export function jansoRoom(c: Ctx) {
  const { g, W, H, e } = c;
  const veneer = mix('#6a4a2c', e.sky, 0.3);
  const cream = mix('#cfc6b0', e.sky, 0.4);
  // Upper wall: worn cream; lower: wood veneer panelling with a chair rail.
  g.fillStyle = cream;
  g.fillRect(0, 0, W, H);
  woodFill(c, 0, c.y(1.6), W, H - c.y(1.6), veneer);
  for (let x = 0; x < W; x += c.u(1.4)) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x, c.y(1.6), 1.5, H - c.y(1.6));
  }
  g.fillStyle = '#2a1a0e';
  g.fillRect(0, c.y(1.75), W, c.y(1.55) - c.y(1.75));
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    if (b === 0 || b === 2) {
      // Aluminium-framed window, blinds half down, the wet neon street beyond.
      const ix = x0 + bw * 0.12,
        iw = bw * 0.76,
        top = c.y(7.2),
        bottom = c.y(2.4);
      windowCut(c, ix, top, bottom, iw, false, '#8a8a84');
      rain(c, ix, top, bottom, iw);
      blinds(c, ix, top, c.y(5.6), iw);
      g.strokeStyle = '#a4a49c';
      g.lineWidth = c.u(0.1);
      g.strokeRect(ix, top, iw, bottom - top);
      if (b === 2) {
        // A plain wall clock above the window.
        const cx = ix + iw / 2,
          cy = c.y(7.75),
          cr = c.u(0.3);
        g.fillStyle = '#f2efe6';
        g.beginPath();
        g.arc(cx, cy, cr, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#2a2a2a';
        g.lineWidth = Math.max(1.5, cr * 0.12);
        g.stroke();
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + cr * 0.45, cy + cr * 0.2);
        g.moveTo(cx, cy);
        g.lineTo(cx - cr * 0.15, cy - cr * 0.75);
        g.stroke();
      }
      // A sill with a potted plant.
      g.fillStyle = '#3a2a1a';
      g.fillRect(ix - c.u(0.15), bottom, iw + c.u(0.3), c.u(0.14));
      vase(c, ix + iw * 0.85, bottom, c.u(0.5), 4);
      g.fillStyle = '#2d5a2a';
      g.beginPath();
      g.ellipse(ix + iw * 0.85, bottom - c.u(0.75), c.u(0.4), c.u(0.3), 0, 0, Math.PI * 2);
      g.fill();
    } else if (b === 1) {
      // The house rules and the regulars' plaques.
      rulesBoard(c, x0 + bw * 0.12, c.y(6.4), bw * 0.34, c.y(2.6) - c.y(6.4));
      plaques(c, x0 + bw * 0.54, bw * 0.38, 6.7);
      // A tea counter: a kettle and cups under a little light.
      const cx = x0 + bw * 0.54,
        cw = bw * 0.38;
      panel(c, cx, c.y(1.3), cw, c.y(-1.6) - c.y(1.3), '#3a2614', 4);
      g.fillStyle = '#d8cfbc';
      g.fillRect(cx - 4, c.y(1.3) - c.u(0.08), cw + 8, c.u(0.1));
      glow(g, cx + cw / 2, c.y(2.2), c.u(1.4), e.key, 0.2);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = k === 0 ? '#2a2a2a' : '#e8e2d4';
        const w = k === 0 ? c.u(0.4) : c.u(0.16);
        const hh = k === 0 ? c.u(0.4) : c.u(0.16);
        g.fillRect(cx + cw * (0.15 + k * 0.16), c.y(1.3) - c.u(0.08) - hh, w, hh);
      }
    } else {
      // The way out: a noren over the door, and the price list beside it.
      noren(c, x0 + bw * 0.3, bw * 0.4);
      rulesBoard(c, x0 + bw * 0.76, c.y(6.0), bw * 0.16, c.u(2.2));
    }
    post(c, x0 - c.u(0.1), c.u(0.2), 0, H, '#2a1a0e', 0.1);
  }
  // A strip of fluorescent light along the cornice, cool against the warm wood.
  g.fillStyle = '#2a1a0e';
  g.fillRect(0, c.y(8.4), W, c.y(7.8) - c.y(8.4));
  const cool = mix('#eef4ff', e.key, 0.3);
  for (let x = bw * 0.5; x < W; x += bw) {
    wash(c, x, c.y(7.8), c.y(4.6), bw * 0.9, cool, 0.12);
    g.fillStyle = rgba(cool, 0.75);
    g.fillRect(x - bw * 0.25, c.y(7.85), bw * 0.5, c.u(0.06));
  }
  // Ceiling: square acoustic tiles fading up.
  g.fillStyle = mix(cream, '#000000', 0.5);
  g.fillRect(0, 0, W, c.y(8.4));
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += c.u(1)) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, c.y(8.4));
    g.stroke();
  }
  finish(c, 10.2);
}

// ------------------------------------------------------------ Dubai majlis

/** Rough coral-stone plaster: warm, uneven, with the odd shadowed pore. */
function coralStone(c: Ctx, x: number, y: number, w: number, h: number, base: string) {
  const { g, r } = c;
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  for (let i = 0; i < (w * h) / 900; i++) {
    const px = x + r() * w,
      py = y + r() * h;
    g.fillStyle = r() < 0.6 ? `rgba(70,45,25,${0.04 + r() * 0.07})` : `rgba(255,236,200,${r() * 0.06})`;
    g.beginPath();
    g.ellipse(px, py, 1 + r() * c.u(0.3), 1 + r() * c.u(0.18), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
}

/** A gypsum frieze of pierced triangles, the old houses' vents. */
function frieze(c: Ctx, wy: number, base: string, dark: string) {
  const { g, W } = c;
  const y = c.y(wy),
    h = c.u(0.7);
  g.fillStyle = mix(base, '#ffffff', 0.08);
  g.fillRect(0, y, W, h);
  const s = h * 0.7;
  for (let x = 0; x < W; x += s * 1.2) {
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x, y + h * 0.85);
    g.lineTo(x + s / 2, y + h * 0.15);
    g.lineTo(x + s, y + h * 0.85);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, y + h, W, 2);
}

/** A carved teak door with brass studs. */
function teakDoor(c: Ctx, x: number, w: number) {
  const { g } = c;
  const top = c.y(5.6),
    bottom = c.H;
  g.fillStyle = '#2a1608';
  g.fillRect(x - c.u(0.25), top - c.u(0.3), w + c.u(0.5), bottom - top + c.u(0.3));
  for (const k of [0, 1]) {
    const dx = x + (k * w) / 2;
    woodFill(c, dx + 2, top, w / 2 - 4, bottom - top, '#5a3418');
    for (let j = 0; j < 3; j++) panel(c, dx + c.u(0.18), top + c.u(0.25) + j * c.u(1.85), w / 2 - c.u(0.4), c.u(1.6), '#4a2a12', 3);
    g.fillStyle = rgba(c.brass, 0.85);
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(dx + w * 0.08 + (i * w * 0.34) / 2, top + c.u(0.15) + j * c.u(0.9), Math.max(1.5, c.u(0.05)), 0, Math.PI * 2);
        g.fill();
      }
  }
  wash(c, x + w / 2, top - c.u(1.2), top + c.u(1), w * 1.2, c.e.key, 0.12);
}

/** A wall niche holding a coffee pot, an incense burner or a lantern. */
function niche(c: Ctx, x: number, w: number, kind: number, stone: string) {
  const { g } = c;
  const top = c.y(5.3),
    bottom = c.y(3.0);
  g.fillStyle = mix(stone, '#000000', 0.45);
  g.beginPath();
  g.moveTo(x, bottom);
  g.lineTo(x, top + w / 2);
  g.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w, bottom);
  g.closePath();
  g.fill();
  const lx = x + w / 2,
    base = bottom - 2;
  if (kind === 0) {
    // Dallah: the long-beaked coffee pot, in brass.
    glow(g, lx, base - c.u(0.5), c.u(0.9), '#ffc070', 0.2);
    g.fillStyle = rgba(c.brass, 0.95);
    g.beginPath();
    g.moveTo(lx - c.u(0.25), base);
    g.quadraticCurveTo(lx - c.u(0.3), base - c.u(0.45), lx - c.u(0.12), base - c.u(0.55));
    g.lineTo(lx - c.u(0.1), base - c.u(0.85));
    g.lineTo(lx + c.u(0.1), base - c.u(0.85));
    g.lineTo(lx + c.u(0.12), base - c.u(0.55));
    g.quadraticCurveTo(lx + c.u(0.3), base - c.u(0.45), lx + c.u(0.25), base);
    g.fill();
    g.strokeStyle = rgba(c.brass, 0.95);
    g.lineWidth = Math.max(1.5, c.u(0.05));
    g.beginPath();
    g.moveTo(lx - c.u(0.2), base - c.u(0.4));
    g.quadraticCurveTo(lx - c.u(0.55), base - c.u(0.6), lx - c.u(0.5), base - c.u(0.95));
    g.stroke();
    g.fillStyle = rgba('#fff2c8', 0.35);
    g.fillRect(lx - c.u(0.15), base - c.u(0.5), c.u(0.04), c.u(0.4));
  } else if (kind === 1) {
    // A mabkhara incense burner with a thread of smoke.
    g.fillStyle = '#5a2a14';
    g.fillRect(lx - c.u(0.18), base - c.u(0.45), c.u(0.36), c.u(0.45));
    g.fillStyle = rgba(c.brass, 0.85);
    g.fillRect(lx - c.u(0.22), base - c.u(0.5), c.u(0.44), c.u(0.07));
    g.strokeStyle = 'rgba(230,220,210,0.18)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(lx, base - c.u(0.5));
    g.bezierCurveTo(lx + c.u(0.25), base - c.u(0.9), lx - c.u(0.25), base - c.u(1.2), lx + c.u(0.05), base - c.u(1.6));
    g.stroke();
  } else {
    // A small lantern, lit.
    glow(g, lx, base - c.u(0.45), c.u(1.1), '#ffb050', 0.35);
    g.fillStyle = rgba('#ffd08a', 0.9);
    g.fillRect(lx - c.u(0.16), base - c.u(0.65), c.u(0.32), c.u(0.5));
    g.strokeStyle = rgba(c.brass, 0.9);
    g.lineWidth = 1.5;
    g.strokeRect(lx - c.u(0.16), base - c.u(0.65), c.u(0.32), c.u(0.5));
    g.fillStyle = rgba(c.brass, 0.9);
    g.beginPath();
    g.moveTo(lx - c.u(0.2), base - c.u(0.65));
    g.lineTo(lx, base - c.u(0.9));
    g.lineTo(lx + c.u(0.2), base - c.u(0.65));
    g.fill();
  }
}

/** Sadu weave: bands of red, black and ivory with small diamonds and teeth. */
export function saduBand(g: G, x: number, y: number, w: number, h: number, scale = 1) {
  const red = '#8a1c16',
    black = '#1a1210',
    ivory = '#e8dcc2',
    ochre = '#c08a3a';
  const bands = [red, black, ivory, red, black];
  const bh = h / bands.length;
  bands.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(x, y + i * bh, w, bh + 0.5);
  });
  // Teeth along the band edges and diamonds down the middle.
  const s = 6 * scale;
  g.fillStyle = ivory;
  for (let k = x; k < x + w; k += s * 2) {
    g.beginPath();
    g.moveTo(k, y + bh * 2);
    g.lineTo(k + s, y + bh * 2 - s * 0.8);
    g.lineTo(k + s * 2, y + bh * 2);
    g.fill();
  }
  g.fillStyle = ochre;
  for (let k = x + s; k < x + w; k += s * 3) {
    const cy = y + bh * 2.5;
    g.beginPath();
    g.moveTo(k, cy - bh * 0.35);
    g.lineTo(k + s * 0.7, cy);
    g.lineTo(k, cy + bh * 0.35);
    g.lineTo(k - s * 0.7, cy);
    g.fill();
  }
  g.fillStyle = red;
  for (let k = x; k < x + w; k += s * 2) {
    g.beginPath();
    g.moveTo(k, y + bh * 3);
    g.lineTo(k + s, y + bh * 3 + s * 0.8);
    g.lineTo(k + s * 2, y + bh * 3);
    g.fill();
  }
}

/** Dubai: coral-stone walls, niches, a teak door, a palm-frond ceiling and sadu cushions round the room. */
export function majlisRoom(c: Ctx) {
  const { g, W, H, e } = c;
  const stone = mix('#cbb08a', e.sky, 0.42);
  coralStone(c, 0, 0, W, H, stone);
  const bays = 4;
  const bw = W / bays;
  for (let b = 0; b < bays; b++) {
    const x0 = b * bw;
    if (b === 0 || b === 2) {
      // An arched opening on the courtyard and the desert, with a carved wooden screen in its head.
      const ix = x0 + bw * 0.2,
        iw = bw * 0.6,
        top = c.y(7.6),
        bottom = c.y(0.4);
      g.fillStyle = mix(stone, '#000000', 0.25);
      g.fillRect(ix - c.u(0.25), top - c.u(0.25), iw + c.u(0.5), bottom - top + c.u(0.25));
      windowCut(c, ix, top, bottom, iw, true, '#3a2412');
      // Mashrabiya in the arch.
      lattice(c, ix + iw * 0.1, top + c.u(0.4), iw * 0.8, c.u(1.4), '#3a2412', '#ffc888', 0.18);
    } else if (b === 1) {
      teakDoor(c, x0 + bw * 0.32, bw * 0.36);
    } else {
      // Three niches.
      for (let k = 0; k < 3; k++) niche(c, x0 + bw * (0.16 + k * 0.26), bw * 0.16, k, stone);
    }
    // Stone pier between bays, with a little light from a wall lantern.
    post(c, x0 - c.u(0.22), c.u(0.44), c.y(9.2), H, mix(stone, '#000000', 0.08), 0.08);
    const lx = x0;
    wash(c, lx, c.y(5.6), c.y(1.5), c.u(2), '#ffb868', 0.16);
    glow(g, lx, c.y(5.8), c.u(0.8), '#ffb868', 0.5);
    g.fillStyle = rgba(c.brass, 0.9);
    g.fillRect(lx - c.u(0.12), c.y(6.1), c.u(0.24), c.u(0.5));
  }
  // Low seating all round: cushions on a bench, bolsters against the wall.
  const seatTop = c.y(-0.35);
  saduBand(g, 0, seatTop, W, H - seatTop, c.u(1) / 36);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, seatTop, W, 2);
  // Back cushions: firm, square-cornered, piped in ivory.
  for (let x = c.u(0.1); x < W; x += c.u(1.7)) {
    const top = c.y(0.75),
      bot = seatTop + 2,
      w = c.u(1.5);
    g.fillStyle = '#4a1410';
    if (g.roundRect) {
      g.beginPath();
      g.roundRect(x, top, w, bot - top, c.u(0.18));
      g.fill();
    } else g.fillRect(x, top, w, bot - top);
    const sh = g.createLinearGradient(0, top, 0, bot);
    sh.addColorStop(0, 'rgba(255,220,180,0.12)');
    sh.addColorStop(1, 'rgba(0,0,0,0.3)');
    g.fillStyle = sh;
    g.fillRect(x + 2, top + 2, w - 4, bot - top - 4);
    g.fillStyle = 'rgba(232,220,194,0.35)';
    g.fillRect(x + c.u(0.1), top + c.u(0.12), w - c.u(0.2), 1.5);
    g.fillStyle = 'rgba(192,138,58,0.4)';
    for (let k = 0; k < 3; k++) g.fillRect(x + w * (0.25 + k * 0.25) - 2, top + (bot - top) * 0.45, 4, 4);
  }
  frieze(c, 8.4, stone, mix(stone, '#000000', 0.5));
  // Ceiling: dark chandal beams over a mat of palm fronds.
  const ct = c.y(9.1);
  g.fillStyle = '#6a5030';
  g.fillRect(0, 0, W, ct);
  g.strokeStyle = 'rgba(40,26,12,0.35)';
  g.lineWidth = 1;
  for (let x = -ct; x < W; x += 5) {
    g.beginPath();
    g.moveTo(x, ct);
    g.lineTo(x + ct * 0.6, 0);
    g.stroke();
  }
  g.fillStyle = '#2a1a0c';
  for (let x = 0; x < W; x += c.u(0.9)) g.fillRect(x, 0, c.u(0.22), ct);
  g.fillRect(0, ct - c.u(0.2), W, c.u(0.25));
  finish(c, 10.4);
}

// ------------------------------------------------------------ the Hong Kong street

/**
 * The view from the tea house: dense towers at dusk, signs hung out over the
 * street in neon and painted boards, a tram passing. `row` maps world y to
 * canvas rows, as in backdrop.ts.
 */
export function paintHkStreet(g: G, e: EnvironmentStyle, r: () => number, W: number, H: number, row: (y: number) => number) {
  const sky = g.createLinearGradient(0, 0, 0, row(2));
  sky.addColorStop(0, '#1a1430');
  sky.addColorStop(0.55, '#5a3248');
  sky.addColorStop(1, '#c0704a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // Three layers of towers, nearer ones darker and taller.
  for (const [base, maxH, color, lit] of [
    [1.5, 13, '#3a2a3a', 0.25],
    [0.5, 12, '#22182a', 0.35],
    [0, 14, '#140e18', 0.45],
  ] as const) {
    let x = 0;
    while (x < W) {
      const w = 40 + r() * 90;
      const top = row(base + 4 + r() * (maxH - 4));
      g.fillStyle = color;
      g.fillRect(x, top, w + 1, H - top);
      for (let wy = top + 8; wy < row(1); wy += 10)
        for (let wx = x + 5; wx < x + w - 6; wx += 8) {
          if (r() > lit) continue;
          g.fillStyle = rgba(r() < 0.8 ? '#ffd9a0' : '#cfe8ff', 0.25 + r() * 0.4);
          g.fillRect(wx, wy, 4, 5);
        }
      // Air-conditioner boxes and laundry poles on the near layer.
      if (color === '#140e18')
        for (let k = 0; k < 6; k++) {
          g.fillStyle = 'rgba(120,110,110,0.35)';
          g.fillRect(x + r() * w, top + r() * (row(1) - top), 7, 5);
        }
      x += w;
    }
  }
  // Signs over the street: neon outlines and lit boards, vertical and horizontal.
  for (let i = 0; i < 26; i++) {
    const col = e.bokeh[Math.floor(r() * e.bokeh.length)];
    const vertical = r() < 0.6;
    const sw = vertical ? 18 + r() * 14 : 60 + r() * 70;
    const sh = vertical ? 70 + r() * 90 : 20 + r() * 18;
    const sx = r() * W;
    const sy = row(3 + r() * 7);
    glow(g, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.9, col, 0.22);
    if (r() < 0.5) {
      g.fillStyle = rgba(mix(col, '#000000', 0.55), 0.9);
      g.fillRect(sx, sy, sw, sh);
      g.strokeStyle = rgba(mix(col, '#ffffff', 0.4), 0.9);
      g.lineWidth = 2;
      g.strokeRect(sx + 3, sy + 3, sw - 6, sh - 6);
    } else {
      g.fillStyle = rgba(mix(col, '#ffffff', 0.15), 0.75);
      g.fillRect(sx, sy, sw, sh);
    }
    // Characters as bright marks.
    g.fillStyle = rgba('#fff6e0', 0.6);
    const n = vertical ? Math.floor(sh / 22) : Math.floor(sw / 22);
    for (let k = 0; k < n; k++) {
      const cx = vertical ? sx + sw / 2 - 5 : sx + 8 + k * 22;
      const cy = vertical ? sy + 8 + k * 22 : sy + sh / 2 - 5;
      g.fillRect(cx, cy, 10, 2);
      g.fillRect(cx + 4, cy - 3, 2, 12);
      g.fillRect(cx, cy + 6, 10, 2);
    }
  }
  // The street, wet and glowing, and a double-decker tram.
  const sy = row(0.6);
  const st = g.createLinearGradient(0, sy, 0, H);
  st.addColorStop(0, '#2a1e24');
  st.addColorStop(1, '#120c10');
  g.fillStyle = st;
  g.fillRect(0, sy, W, H - sy);
  for (let i = 0; i < 40; i++) {
    const col = e.bokeh[i % e.bokeh.length];
    g.fillStyle = rgba(col, 0.12);
    g.fillRect(r() * W, sy + r() * (H - sy), 20 + r() * 40, 2);
  }
  for (const tx of [380, 1460]) {
    const top = row(3.4),
      bot = row(0.5);
    g.fillStyle = '#2d6a4a';
    g.fillRect(tx, top, 150, bot - top);
    g.fillStyle = '#e8dcc0';
    g.fillRect(tx, top + (bot - top) * 0.48, 150, 6);
    for (const wy of [top + 8, top + (bot - top) * 0.58]) for (let k = 0; k < 6; k++) {
      g.fillStyle = rgba('#ffe2a8', 0.75);
      g.fillRect(tx + 8 + k * 23, wy, 16, (bot - top) * 0.22);
    }
    g.strokeStyle = 'rgba(30,30,30,0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(tx + 75, top);
    g.lineTo(tx + 100, row(5.5));
    g.stroke();
  }
  g.strokeStyle = 'rgba(30,24,28,0.9)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, row(5.5));
  g.lineTo(W, row(5.5));
  g.stroke();
}
