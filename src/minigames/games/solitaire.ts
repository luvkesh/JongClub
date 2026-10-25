// Mahjong Solitaire and the games built on its rules: Mahjong Tower, Timed
// Mahjong and Mahjong Blitz.

import { tr } from '../../i18n';
import { registerMiniGame } from '../registry';
import type { MiniLevel, MiniResult } from '../types';
import { LAYOUTS, TOWER_LAYOUTS } from './solitaire/layouts';
import { SolitaireSession, layoutName } from './solitaire/session';

const LEVEL_PAY: Record<MiniLevel, number> = { easy: 1, medium: 1.5, hard: 2.2 };

/** Wins pay by board size and level; a loss still pays a little for the tiles cleared. */
function pairsReward(r: MiniResult, level: MiniLevel, perTile = 0.9) {
  const k = LEVEL_PAY[level];
  if (!r.won) return Math.round((r.cleared / Math.max(1, r.total)) * 25 * k);
  const helps = r.hints * 4 + r.shuffles * 8 + r.undos;
  return Math.max(20, Math.round((40 + r.total * perTile) * k - helps));
}

registerMiniGame({
  id: 'solitaire',
  layered: true,
  title: tr('Mahjong Solitaire'),
  blurb: tr('Match free pairs from a layered layout until the board is clear.'),
  minutes: tr('3–10 min'),
  order: 10,
  icon: { kinds: [31, 31, 4, 27, 13], shape: 'stack' },
  levels: ['easy', 'medium', 'hard'],
  options: [
    {
      id: 'layout',
      label: tr('Layout'),
      initial: 'turtle',
      choices: [...LAYOUTS.map((l) => ({ id: l.id, label: layoutName(l.id) })), { id: 'random', label: tr('Surprise me') }],
    },
  ],
  howTo: [
    tr('Tap two matching tiles to take them off the board.'),
    tr('A tile can only move when nothing sits on it and its left or right side is open.'),
    tr('Any flower matches any flower, and any season matches any season.'),
    tr('Stuck? Ask for a hint, undo, or shuffle the tiles that are left.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  daily: true,
  reward: (r, level) => pairsReward(r, level),
  start: (host) => new SolitaireSession(host, { clock: 'classic' }, LAYOUTS.map((l) => l.id)),
});

registerMiniGame({
  id: 'tower',
  layered: true,
  title: tr('Mahjong Tower'),
  blurb: tr('Take a tall tower apart from the top: pairs hide beneath and behind.'),
  minutes: tr('3–10 min'),
  order: 50,
  icon: { kinds: [33, 33, 22, 9, 30, 18], shape: 'tower' },
  levels: ['medium', 'hard'],
  options: [{ id: 'layout', label: tr('Layout'), initial: 'tower', choices: TOWER_LAYOUTS.map((l) => ({ id: l.id, label: layoutName(l.id) })) }],
  howTo: [
    tr('Tiles are stacked high. Clear pairs from the top to uncover the floors below.'),
    tr('A tile is free when nothing sits on it and its left or right side is open.'),
    tr('Drag to walk around the tower and look at it from lower down.'),
  ],
  tools: { hint: true, undo: true, shuffle: true },
  reward: (r, level) => pairsReward(r, level, 1.1),
  start: (host) => new SolitaireSession(host, { clock: 'classic', pitch: 44 }, TOWER_LAYOUTS.map((l) => l.id)),
});

registerMiniGame({
  id: 'timed',
  layered: true,
  title: tr('Timed Mahjong'),
  blurb: tr('Clear the board before the clock runs out. Every pair wins back a few seconds.'),
  minutes: tr('1–3 min'),
  order: 80,
  icon: { kinds: [32, 32, 0, 8], shape: 'hourglass' },
  levels: ['medium', 'hard'],
  options: [
    { id: 'layout', label: tr('Layout'), initial: 'garden', choices: [{ id: 'garden', label: layoutName('garden') }, { id: 'peaks', label: layoutName('peaks') }, { id: 'pyramid', label: layoutName('pyramid') }] },
    { id: 'clock', label: tr('Clock'), initial: '120', choices: [{ id: '90', label: tr('1:30') }, { id: '120', label: tr('2:00') }, { id: '180', label: tr('3:00') }] },
  ],
  howTo: [tr('Match pairs as in Solitaire, against the clock.'), tr('Each pair adds seconds back, and quick pairs in a row build a combo.'), tr('Seconds left at the end count double in your score.')],
  tools: { hint: true, undo: false, shuffle: true },
  reward: (r, level) => (r.won ? Math.round((60 + r.total * 0.8) * LEVEL_PAY[level]) : Math.round((r.cleared / Math.max(1, r.total)) * 30 * LEVEL_PAY[level])),
  start: (host) => new SolitaireSession(host, { clock: 'timed', seconds: Number(host.options.clock ?? 120) }, ['garden']),
});

registerMiniGame({
  id: 'blitz',
  layered: true,
  title: tr('Mahjong Blitz'),
  blurb: tr('Ninety seconds. Clear as many pairs as you can; every cleared board deals another.'),
  minutes: tr('1–2 min'),
  order: 90,
  icon: { kinds: [6, 6, 15, 15, 24], shape: 'fan' },
  levels: ['easy', 'medium', 'hard'],
  howTo: [tr('Clear as many pairs as you can before time runs out.'), tr('Quick pairs in a row build a combo for extra points.'), tr('Clear a board and a new one drops in.')],
  tools: { hint: true, undo: false, shuffle: true },
  reward: (r, level) => Math.min(220, Math.round(r.score * 0.45 * LEVEL_PAY[level])),
  start: (host) => new SolitaireSession(host, { clock: 'blitz', seconds: 90 }, ['garden', 'peaks']),
});

registerMiniGame({
  id: 'shuffle',
  layered: true,
  title: tr('Mahjong Shuffle'),
  blurb: tr('Solitaire that will not sit still: every few pairs, the tiles left change places.'),
  minutes: tr('3–8 min'),
  order: 55,
  icon: { kinds: [9, 18, 9, 27, 18], shape: 'stack' },
  levels: ['easy', 'medium', 'hard'],
  options: [{ id: 'layout', label: tr('Layout'), initial: 'pyramid', choices: [...LAYOUTS.map((l) => ({ id: l.id, label: layoutName(l.id) })), { id: 'random', label: tr('Surprise me') }] }],
  howTo: [
    tr('Match free pairs as in Solitaire.'),
    tr('Every few pairs the tiles left on the board change places, so plan only a little ahead.'),
    tr('You never get stuck: with no pairs left, the tiles mix again by themselves.'),
  ],
  tools: { hint: true, undo: true, shuffle: false },
  reward: (r, level) => pairsReward(r, level, 0.8),
  start: (host) => new SolitaireSession(host, { clock: 'classic', reshuffleEvery: host.level === 'easy' ? 8 : host.level === 'medium' ? 6 : 4 }, LAYOUTS.map((l) => l.id)),
});
