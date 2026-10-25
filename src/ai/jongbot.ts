// JongBot: the in-game helper. Three depths of help:
//   beginner  "What should I do?"  one clear instruction
//   learning  "Why?"               the instruction plus the reason
//   advanced  "Analyse my hand."   the top candidates with numbers

import type { MahjongGame } from '../engine/game';
import type { ClaimOption } from '../engine/state';
import { tileName } from '../engine/tiles';
import { sevenPairsShanten, standardShanten, wildWaits } from '../engine/hand';
import { andList, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { charlestonDirName, CHARLESTON } from '../engine/game';
import { distance as cardDistance, progress } from '../engine/rules/american';
import { bestSwap, charlestonPick, describeTarget, exposureDanger, kindLabel, missingAfterCall, rankDiscards } from './american';
import { safetySentence, threatSentence, riskLabelFor } from './danger';
import { cardUses, currentShanten, currentWaits, exchangePick, handWilds, shantenWith, openHandHasYakuPath, unseenCounts } from './evaluate';
import { shantenAfterKong } from './players';
import { ADVISOR, ADVISOR_CLAIMS, planClaim, planDiscard, riichiAdvice } from './strategy';
import { isPassportRound, passportThreats, threatsOn } from './passportAdvice';
import { namesSentence, targetKit, targetReads, type TargetKit, type TargetPlan } from './targets';

export type HintDepth = 'beginner' | 'learning' | 'advanced';

export interface Hint {
  headline: string;
  why?: string;
  /** Kind the hint points at, for highlighting in 3D. */
  focusKind?: number;
  action?: 'discard' | 'win' | 'pass' | 'riichi' | 'kita' | ClaimOption['type'];
  table?: { tile: string; away: string; helpful: number; risk: string }[];
  warning?: string;
  /** The target hands still open, nearest first (after the advised discard): passports, card hands,
   *  ways to fill a Small Card, clean hands, yaku, scoring hands (targets.ts). */
  targets?: { title: string; plans: HintPlan[] };
  /** What the other players' exposed sets point to, and what to hold back. */
  keepBack?: string[];
  /** On a discard you could call: what the call does to your target hands. */
  callCheck?: string;
}

export interface HintPlan {
  names: string[];
  note?: string;
  how?: string;
  sets?: number;
  pair?: boolean;
  shanten: number;
  pieces: number[][];
  gaps: number[];
  need: { kind: number; left: number }[];
}

const hintPlans = (plans: TargetPlan[], unseen: number[]): HintPlan[] =>
  plans.map((p) => ({ names: p.names, note: p.note, how: p.how, sets: p.sets, pair: p.pair, shanten: p.missing - 1, pieces: p.pieces, gaps: p.gaps, need: p.need.map((k) => ({ kind: k, left: unseen[k] ?? -1 })) }));

/** "Aim for ..." at the head of JongBot's reason, in the words of the round. */
function aimLine(kit: TargetKit, aim: TargetPlan): string {
  if (kit.id === 'passport') return `Aim for ${namesSentence(aim.names)}${aim.sets ? ` with ${aim.sets} more set${aim.sets > 1 ? 's' : ''}` : ''}${aim.pair ? ' and a pair' : ''}. `;
  if (kit.id === 'smallCard') return aim.note ? `Fill your card ${aim.note}. ` : '';
  if (kit.id === 'card') return '';
  return `Aim for ${namesSentence(aim.names)}${aim.note ? ` (${aim.note})` : ''}. `;
}

/** Is setting a North aside (sanma kita) at least as good as keeping it? */
function kitaHelps(game: MahjongGame, seat: number): boolean {
  const north = game.profile.nukiDora;
  if (north === undefined) return false;
  const pl = game.players[seat];
  const rules = game.shapesFor(seat);
  const c = game.naturalCounts(pl.hand);
  if (!c[north]) return false;
  if (pl.riichi) return true;
  const best = (counts: number[]) => {
    let b = 99;
    for (let k = 0; k < counts.length; k++) {
      if (!counts[k]) continue;
      counts[k]--;
      b = Math.min(b, shantenWith(counts, pl.melds.length, rules, handWilds(game, seat)));
      counts[k]++;
    }
    return b;
  };
  const keep = best(c);
  c[north]--;
  // Without the North the hand holds one tile fewer: the replacement draw restores it.
  return shantenWith(c, pl.melds.length, rules, handWilds(game, seat)) <= keep;
}

/** The all-pairs hand to name when it is a shorter road to a win than sets and a pair (after discarding `kind`). */
export function pairsRoute(game: MahjongGame, seat: number, kind: number): string | null {
  const pl = game.players[seat];
  const rules = game.shapesFor(seat);
  if (pl.melds.length || game.profile.card) return null;
  const c = game.naturalCounts(pl.hand);
  if (!c[kind]) return null;
  c[kind]--;
  let best = standardShanten(c, 0, rules.sets ?? 4);
  let name: string | null = null;
  if (rules.sevenPairs && sevenPairsShanten(c) < best) (best = sevenPairsShanten(c)), (name = 'seven pairs');
  for (const sp of rules.special ?? [])
    if (sp.pairs) {
      const s = sp.shanten(c, 0);
      if (s < best) (best = s), (name = sp.name === 'liGu' ? 'Lì Gǔ Lì Gǔ (seven pairs and a pung)' : sp.name);
    }
  return name;
}

/** For a seat playing to a card (an India Rules Small Card): what the card needs, and why `kind` can go. */
export function cardHint(game: MahjongGame, seat: number, kind: number): string | null {
  const rules = game.shapesFor(seat);
  const uses = cardUses(rules);
  const own = rules.special?.find((sp) => sp.ai && sp.how);
  if (!uses || !own) return null;
  const need = own.how!.charAt(0).toLowerCase() + own.how!.slice(1);
  return uses(kind) ? `Your card, ${own.name}, needs ${need}. This tile is the one it can spare most.` : `Your card, ${own.name}, needs ${need}. The ${tileName(kind)} has no place in it.`;
}

const away = (s: number) => (s >= 99 ? 'no win possible with these sets' : s <= 0 ? 'ready' : s === 1 ? '1 tile from ready' : `${s} tiles from ready`);
const riskLabel = (d: number) => (d < 0.2 ? 'Safe' : d < 0.6 ? 'Low' : d < 1.2 ? 'Medium' : 'High');

export function turnHint(game: MahjongGame, seat: number, depth: HintDepth): Hint {
  const opts = game.turnOptions(seat);
  const names = game.profile.callNames;
  if (opts.canWin) {
    const s = opts.winScore!;
    return {
      headline: names.selfDraw === 'Mahjong' ? 'Declare Mahjong! Your hand is complete.' : `Declare ${names.selfDraw}! Your hand is complete.`,
      why: `Worth ${s.value} ${s.unit}${s.fu ? ` ${s.fu} fu` : ''}: ${s.items.map((i) => i.name).join(', ')}.`,
      action: 'win',
    };
  }
  if (game.profile.card) return americanTurnHint(game, seat, depth, opts.jokerSwaps.length > 0);
  if (opts.kita && kitaHelps(game, seat))
    return {
      headline: 'Set the North aside (kita).',
      why: depth === 'beginner' ? undefined : 'In three-player Riichi a North is a bonus dora when set aside, and you draw a replacement. Your hand does not need it.',
      action: 'kita',
      focusKind: game.profile.nukiDora,
    };
  const me = game.players[seat];
  if (me.riichi) {
    return {
      headline: `You're in ${names.riichi ?? 'riichi'}. Your drawn tile goes back out automatically.`,
      why: `Waiting on ${game.waitsOf(seat).map(tileName).join(', ')}. You can still win on any of them.`,
    };
  }
  const plan = planDiscard(game, seat, ADVISOR);
  // A kong that doesn't slow the hand: the same test the strong bots use.
  if (opts.kongs.length && (!plan.threat || plan.mode === 'push')) {
    const now = currentShanten(game, seat);
    const k = opts.kongs.find((x) => shantenAfterKong(game, seat, x) <= now);
    if (k !== undefined) {
      const added = me.melds.some((m) => m.type === 'pung' && m.tiles[0].kind === k);
      return {
        headline: `Declare a ${names.kong} of the ${tileName(k)}.`,
        why: depth === 'beginner' ? undefined : `${added ? 'Adding it to your exposed set' : 'Four of a kind'} doesn't slow your hand, and you draw a replacement tile.`,
        action: 'kong',
        focusKind: k,
      };
    }
  }
  const ranked = plan.ranked;
  let best = ranked[0];
  // Passport rounds: don't feed a passport another player is showing when a discard just as good is safe.
  const passport = isPassportRound(game);
  const threats = passport ? passportThreats(game, seat) : [];
  if (threats.length && plan.mode !== 'fold' && threatsOn(threats, best.kind).length) {
    const alt = ranked.find((r) => r.shanten === best.shanten && r.ukeire * 10 >= best.ukeire * 6 && !threatsOn(threats, r.kind).length);
    if (alt) best = alt;
  }
  const pl = game.players[seat];
  const name = tileName(best.kind);
  const hint: Hint = { headline: `Discard the ${name}.`, focusKind: best.kind, action: 'discard' };

  // Find a tile we'd naturally want to keep, for "keep X" phrasing.
  const keep = best.improvers.length
    ? pl.hand.find((t) => best.improvers.some((k) => Math.abs(k - t.kind) <= 2 && t.kind !== best.kind && Math.floor(k / 9) === Math.floor(t.kind / 9) && t.kind < 27))
    : undefined;

  if (plan.mode === 'fold') {
    hint.why = `Play it safe this turn. You're ${away(best.shanten)}, and winning from here isn't worth the risk of feeding a ready hand.`;
  } else if (best.shanten === 0) {
    const unseen = unseenCounts(game, seat);
    const w = best.improvers.map((k) => `${tileName(k)} (${unseen[k]} left)`);
    hint.why = `You'll be ready to win. Waiting on ${w.join(', ') || 'nothing live, consider another discard'}.`;
  } else {
    const second = ranked.find((r) => r.kind !== best.kind);
    hint.why = `It keeps you ${away(best.shanten)}, with ${best.ukeire} tiles still out there that improve your hand.`;
    const card = cardHint(game, seat, best.kind);
    const route = card ? null : pairsRoute(game, seat, best.kind);
    if (card) hint.why = card + ' ' + hint.why;
    else if (route) hint.why = `Go for ${route}: your pairs make it the shortest road to a win. ` + hint.why;
    else if (keep) hint.why = `Keep the ${tileName(keep.kind)}: it keeps your hand flexible. ` + hint.why;
    if (second && second.ukeire < best.ukeire && second.shanten === best.shanten)
      hint.why += ` The ${tileName(second.kind)} is the next choice but leaves ${second.ukeire}.`;
  }
  const kit = targetKit(game);
  if (kit) {
    const plans = kit.plans(game, seat, best.kind);
    hint.targets = { title: kit.list, plans: hintPlans(plans, unseenCounts(game, seat)) };
    const aim = plans[0];
    if (aim && plan.mode !== 'fold' && best.shanten > 0) hint.why = aimLine(kit, aim) + (hint.why ?? '');
  }
  const reads = passport ? threats : targetReads(game, seat);
  if (reads.length) hint.keepBack = reads.map((t) => t.line);
  if (passport) {
    const fed = threatsOn(threats, best.kind);
    if (fed.length) hint.warning = `${fed[0].line} Every other discard slows your hand, so this is the best of the risks.`;
  }
  const threat = plan.threat;
  if (threat && !(passport && hint.warning)) {
    const i = plan.danger.reads.indexOf(threat);
    const d = plan.danger.detail[best.kind][i];
    let line = `${threatSentence(game, threat)} ${d.reason === 'none' && plan.mode === 'fold' ? `The ${name} is the safest tile you have.` : safetySentence(best.kind, d)}`;
    if (plan.mode === 'push' && d.hit > 0.05) line = `${threatSentence(game, threat)} The ${name} carries some risk, but your hand is worth pushing.`;
    hint.warning = line;
  }
  // Riichi: declare when this discard leaves a ready closed hand (unless it's better to stay quiet).
  const riichiOk = opts.riichiDiscards.some((id) => pl.hand.find((t) => t.id === id)?.kind === best.kind);
  if (riichiOk) {
    const advice = riichiAdvice(game, seat, best.kind);
    if (advice.riichi) {
      hint.headline = `Declare ${names.riichi} and discard the ${name}.`;
      hint.action = 'riichi';
      hint.why =
        (game.profile.yakuRequired
          ? `Your closed hand will be ready. ${names.riichi} adds 1 han (more with ippatsu and ura dora) and makes any win legal, but your hand is locked afterwards. `
          : `Your closed hand will be ready. Declaring ${names.riichi} adds to what your win pays, but your hand is locked afterwards. `) + (hint.why ?? '');
    } else if (advice.reason === 'valuable') {
      hint.headline = `Discard the ${name} and stay quiet.`;
      hint.why = `Your hand is ready and already worth about ${(Math.round(advice.wait.damaPoints / 100) * 100).toLocaleString('en-US')} points without declaring. Staying quiet keeps the others from playing safe against you, and you can still fold if you need to. ` + (hint.why ?? '');
    } else if (advice.reason === 'noTiles') {
      hint.why = `You'll be ready, but every tile you'd wait on is already showing, so declaring ${names.riichi} isn't worth ${game.profile.riichi?.cost ? 'the deposit' : 'locking your hand'}. ` + (hint.why ?? '');
    }
  }
  // Furiten: a wait you've already discarded means no winning on discards.
  if (game.profile.furiten && best.shanten === 0) {
    const after = game.naturalCounts(pl.hand);
    after[best.kind]--;
    // Every wait counts, even one with no copies left to draw.
    const ws = wildWaits(after, handWilds(game, seat), pl.melds.length, game.shapesFor(seat), game.profile.wilds ?? { inPair: false, inChow: false });
    const gone = ws.filter((k) => pl.discardKinds.includes(k) || k === best.kind);
    if (gone.length) hint.warning = `Furiten: you've discarded ${gone.map(tileName).join(', ')}, which you'd be waiting on. You could only win by self-draw.`;
  }
  // Yaku: open hands in yaku-required rules need a way to score.
  if (game.profile.yakuRequired && !game.isConcealed(seat) && !openHandHasYakuPath(game, seat, -1, [])) {
    hint.warning = 'Your open hand has no yaku yet. You need a dragon or value-wind set, or all simples, before you can win.';
  }
  if (depth === 'beginner') delete hint.why;
  if (depth === 'advanced')
    hint.table = ranked.slice(0, 4).map((e) => ({ tile: tileName(e.kind), away: away(e.shanten), helpful: e.ukeire, risk: riskLabelFor(e.loss) }));
  return hint;
}

export function claimHint(game: MahjongGame, seat: number, options: ClaimOption[], discardKind: number, depth: HintDepth): Hint {
  const hint = baseClaimHint(game, seat, options, discardKind, depth);
  // Say what the call does to your target hands (passport, card hand, yaku...), called or not.
  const kit = targetKit(game);
  if (kit?.call && hint.action !== 'win') {
    const advised = options.find((o) => o.type === hint.action);
    const line = (advised && kit.call(game, seat, advised, discardKind)) || options.map((o) => kit.call!(game, seat, o, discardKind)).find((x) => !!x);
    if (line) hint.callCheck = line;
  }
  return hint;
}

function baseClaimHint(game: MahjongGame, seat: number, options: ClaimOption[], discardKind: number, depth: HintDepth): Hint {
  const names = game.profile.callNames;
  if (options.some((o) => o.type === 'win'))
    return { headline: `${names.win === 'Mahjong' ? 'Win' : names.win} on the ${tileName(discardKind)}!`, why: 'That discard completes your hand.', action: 'win' };
  if (game.profile.card) {
    const pl = game.players[seat];
    const now = cardDistance(pl.hand, pl.melds);
    let best: { o: ClaimOption; after: number } | null = null;
    for (const o of options) {
      if (o.type !== 'pung' && o.type !== 'kong') continue;
      const after = missingAfterCall(game, seat, discardKind, o.type === 'kong' ? 4 : 3);
      if (!best || after < best.after) best = { o, after };
    }
    if (best && best.after < now)
      return {
        headline: `${best.o.type === 'kong' ? names.kong : names.pung} the ${tileName(discardKind)}.`,
        why: depth === 'beginner' ? undefined : `It fits a hand on the card and leaves you ${cardAway(best.after)}. Exposed sets can hold jokers, which others may swap for.`,
        action: best.o.type,
        focusKind: discardKind,
      };
    return { headline: 'Pass.', why: depth === 'beginner' ? undefined : `The ${tileName(discardKind)} doesn't bring your nearest card hand closer. In American Mahjong you can only call for a set of three or more, or for Mah Jongg.`, action: 'pass' };
  }
  const plan = planClaim(game, seat, options, discardKind, ADVISOR_CLAIMS);
  const name = tileName(discardKind);
  const why = (text: string) => (depth === 'beginner' ? undefined : text);
  const unit = game.profile.scoreUnit ?? (game.profile.yakuRequired ? 'han' : (game.profile.base ?? game.profile.id) === 'taiwanese' ? 'tai' : 'faan');
  const called = plan.best;
  if (called.type === 'buy') {
    const price = game.profile.buyFromLeft ?? 0;
    const own = game.shapesFor(seat).special?.find((sp) => sp.ai && sp.how);
    return {
      headline: `Buy the ${name} for ${price}.`,
      why: why(`${own ? `It fits your card, ${own.name}, and moves` : 'It moves'} you from ${away(plan.before)} to ${away(plan.after)}. A bought tile stays concealed in your hand, and the ${price} goes to the bank for the next winner.`),
      action: 'buy',
      focusKind: discardKind,
    };
  }
  if (called.type !== 'pass') {
    const verb = called.type === 'chow' ? names.chow : called.type === 'kong' ? names.kong : names.pung;
    const moves = plan.after < plan.before ? `It moves you from ${away(plan.before)} to ${away(plan.after)}` : `It keeps you ${away(plan.after)}`;
    const joker = called.using?.some((k) => game.isWild(k)) ? ' It uses up one of your jokers.' : '';
    return {
      headline: `${verb} the ${name}.`,
      why: why(`${moves}. Calling shows your set to the table, so your hand is no longer concealed.${joker}`),
      action: called.type,
      focusKind: discardKind,
    };
  }
  const reasons: Record<string, string> = {
    noYaku: 'Calling would leave your hand open with no yaku, so it could never win. Stay closed and aim for riichi.',
    noValue: `An open hand here couldn't reach the ${game.profile.minValue} ${unit} you need to win. Stay concealed or wait for a scoring set.`,
    defend: `You're ${away(plan.before)} and someone looks ready. Calling would use up tiles you can safely discard, so stay patient and play safe.`,
    noGainBuy: `Buying the ${name} wouldn't bring your hand closer${plan.before === 0 ? ': you are ready, and a bought tile can never make Mahjong' : ''}. Keep your ${game.profile.buyFromLeft ?? ''} and draw from the wall.`,
    staysClosed: `Calling the ${name} would speed you up a little, but your concealed hand is worth more${game.profile.riichi ? ': you can still declare riichi' : ''}.`,
  };
  return {
    headline: 'Pass.',
    why: why(reasons[plan.reason === 'noGain' && options.every((o) => o.type === 'buy') ? 'noGainBuy' : plan.reason] ?? `Calling the ${name} doesn't bring you closer to winning, and keeping your hand concealed keeps your options open.`),
    action: 'pass',
  };
}

const cardAway = (n: number) => (!Number.isFinite(n) ? 'no card hand fits your exposures (dead hand)' : n <= 0 ? 'complete' : n === 1 ? 'one tile from Mah Jongg' : `${n} tiles from a card hand`);

function americanTurnHint(game: MahjongGame, seat: number, depth: HintDepth, canSwap: boolean): Hint {
  const pl = game.players[seat];
  const sw = canSwap ? bestSwap(game.turnOptions(seat).jokerSwaps, pl.hand, pl.melds) : undefined;
  if (sw) {
    const owner = sw.owner === seat ? 'your' : `${game.players[sw.owner].name}'s`;
    const t = pl.hand.find((x) => x.id === sw.tileId)!;
    return {
      headline: `Swap your ${tileName(t.kind)} for the joker in ${owner} exposure.`,
      why: depth === 'beginner' ? undefined : 'A joker can stand in for any tile in a set of three or more, so it is worth more than the tile you give up.',
      action: 'discard',
      focusKind: t.kind,
    };
  }
  const danger = exposureDanger(game, seat);
  const ranked = rankDiscards(pl.hand, pl.melds, (k) => danger(k) * 0.3);
  const best = ranked[0];
  const target = progress(pl.hand.filter((t) => t !== best.tile), pl.melds, 1)[0];
  const hint: Hint = { headline: `Discard the ${tileName(best.tile.kind)}.`, focusKind: best.tile.kind, action: 'discard' };
  const rest = pl.hand.filter((t) => t !== best.tile);
  if (!Number.isFinite(cardDistance(rest, pl.melds))) {
    hint.why = 'No hand on the card fits your exposures any more: your hand is dead and can’t win. Discard safely for the rest of the hand.';
  } else if (depth !== 'beginner' && target) {
    hint.why = `Your closest hand on the card is ${describeTarget(target)}. That leaves you ${cardAway(target.missing)}.`;
    // One away, but every tile that would finish it is already showing.
    if (target.missing === 1) {
      const unseen = unseenCounts(game, seat);
      const waits = game.profile.tileKinds.filter((k) => cardDistance([...rest, { id: -8, kind: k }], pl.melds) <= 0);
      if (waits.length && waits.every((k) => k < unseen.length && unseen[k] === 0)) hint.why = `Your closest hand on the card is ${describeTarget(target)}, but every tile that would finish it is already showing. Look for another hand on the card.`;
    }
  }
  if (depth === 'advanced')
    hint.table = ranked.slice(0, 4).map((r) => ({ tile: tileName(r.tile.kind), away: cardAway(r.missing), helpful: Math.round(r.keep), risk: riskLabel(danger(r.tile.kind) * 0.3) }));
  const kit = targetKit(game);
  if (kit) hint.targets = { title: kit.list, plans: hintPlans(kit.plans(game, seat, best.tile.kind), unseenCounts(game, seat)) };
  const reads = targetReads(game, seat);
  if (reads.length) hint.keepBack = reads.map((t) => t.line);
  const hot = game.players.find((p, s) => s !== seat && p.melds.length >= 3);
  if (hot) hint.warning = `${hot.name} has ${hot.melds.length} exposures and may be close to Mah Jongg. Avoid tiles that match them.`;
  return hint;
}

/** Why the exchange pick makes sense, in the words of the round being played. */
function exchangeWhy(game: MahjongGame, seat: number): string {
  const rules = game.shapesFor(seat);
  const own = cardUses(rules) && rules.special?.find((sp) => sp.ai && sp.how);
  if (own) return `Your card is ${own.name}: ${own.how}. Give away the tiles it can't use first.`;
  if (game.state.exchange && rules.chows === false) return 'Goulash round: no chows count here, so keep pairs and pungs. Give away lonely tiles and broken runs.';
  if (game.state.goulash) return 'Goulash exchange: the last hand was a wall game, so everyone passes three tiles. Give away the tiles your sets need least, usually lonely honours and terminals.';
  return 'Give away the tiles your hand needs least: usually lonely honours and terminals, and tiles that fit none of your sets.';
}

/** Charleston advice: which three tiles to pass. */
export function charlestonHint(game: MahjongGame, seat: number, depth: HintDepth): Hint & { tiles: number[] } {
  const ph = game.state.phase;
  // India Rules swaps in pairs, so the direction depends on the seat (the same reckoning as the action bar).
  const n = game.profile.players;
  const dir = ph.kind === 'charleston' ? charlestonDirName((game.passTarget(seat, ph.stage) - seat + n) % n || CHARLESTON[ph.stage]) : 'right';
  if (!game.profile.card) {
    const tiles = exchangePick(game, seat);
    return {
      headline: `Pass the ${tiles.map((t) => kindLabel(t.kind)).join(', ')} to the ${dir}.`,
      why: exchangeWhy(game, seat),
      tiles: tiles.map((t) => t.id),
    };
  }
  const pass = charlestonPick(game.players[seat].hand);
  const target = progress(game.players[seat].hand.filter((t) => !pass.includes(t)), [], 1)[0];
  return {
    headline: `Pass the ${pass.map((t) => kindLabel(t.kind)).join(', ')} to the ${dir}.`,
    why: depth === 'beginner' ? (game.state.goulash ? 'Pick three tiles you don\'t need, then pass. This is a goulash, so jokers may be passed too, but you will usually want to keep them.' : 'Pick three tiles you don\'t need, then pass. Jokers can\'t be passed.') : `They don't fit your best card hands. Aim for ${target ? describeTarget(target) : 'a hand on the card'}.`,
    tiles: pass.map((t) => t.id),
  };
}

/** Short status line, e.g. for the HUD: "2 tiles from ready" or waits. */
export function handStatus(game: MahjongGame, seat: number): string {
  if (game.profile.card) {
    const pl = game.players[seat];
    return pl.hand.length + pl.melds.reduce((a, m) => a + m.tiles.length, 0) > 13 ? '' : cardAway(cardDistance(pl.hand, pl.melds));
  }
  const s = currentShanten(game, seat);
  if (s === 0 && game.players[seat].hand.length % 3 === 1) {
    const w = currentWaits(game, seat);
    return w.length ? tr('Ready · waiting on {tiles}', { tiles: andList(w.map((k) => tileLabel(k))) }) : tr('Ready');
  }
  // 99: the shapes can't be reached at all (e.g. a call that fits none of the cards).
  if (s >= 99) return tr('no win possible with these sets');
  return s <= 0 ? tr('ready') : trn(s, '{n} tile from ready', '{n} tiles from ready');
}
