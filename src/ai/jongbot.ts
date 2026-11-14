// JongBot: the in-game helper. Three depths of help:
//   beginner  "What should I do?"  one clear instruction
//   learning  "Why?"               the instruction plus the reason
//   advanced  "Analyse my hand."   the top candidates with numbers

import type { MahjongGame } from '../engine/game';
import type { ClaimOption } from '../engine/state';
import { sevenPairsShanten, standardShanten, wildWaits } from '../engine/hand';
import { andList, lang, listSep, scoreLine, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { FLOWER } from '../engine/rules/american';
import { andJoin, callWord, fromReady, namesText, planName, planNote, riskWord, sentences, tileList } from './adviceText';
import { charlestonDirName, CHARLESTON } from '../engine/game';
import { distance as cardDistance, progress } from '../engine/rules/american';
import { bestSwap, charlestonPick, describeTarget, exposureDanger, missingAfterCall, rankDiscards } from './american';
import { safetySentence, threatSentence, riskLabelFor } from './danger';
import { cardUses, currentShanten, currentWaits, exchangePick, handWilds, shantenWith, openHandHasYakuPath, unseenCounts, waitingView, winningWaits } from './evaluate';
import { shantenAfterKong } from './players';
import { ADVISOR, ADVISOR_CLAIMS, planClaim, planDiscard, riichiAdvice } from './strategy';
import { isPassportRound, passportThreats, threatsOn } from './passportAdvice';
import { targetKit, targetReads, type TargetKit, type TargetPlan } from './targets';

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
  /** American: the advice is a joker swap (the action is still 'discard'). */
  swap?: boolean;
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
  const name = namesText(aim.names);
  if (kit.id === 'passport') {
    if (aim.sets && aim.pair) return trn(aim.sets, 'Aim for {name} with {n} more set and a pair.', 'Aim for {name} with {n} more sets and a pair.', { name });
    if (aim.sets) return trn(aim.sets, 'Aim for {name} with {n} more set.', 'Aim for {name} with {n} more sets.', { name });
    return aim.pair ? tr('Aim for {name} and a pair.', { name }) : tr('Aim for {name}.', { name });
  }
  if (kit.id === 'smallCard') return aim.note ? tr('Fill your card {note}.', { note: planNote(aim.note) }) : '';
  if (kit.id === 'card') return '';
  return aim.note ? tr('Aim for {name} ({note}).', { name, note: planNote(aim.note) }) : tr('Aim for {name}.', { name });
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
  const card = tr(own.name);
  const tile = tileLabel(kind);
  // A card whose description has no translation yet is named without it.
  const how = tr(own.how!);
  if (lang() !== 'en' && how === own.how) return uses(kind) ? tr('Your card, {card}, can spare this tile most.', { card }) : tr('Your card, {card}, has no place for the {tile}.', { card, tile });
  const need = lang() === 'en' ? how.charAt(0).toLowerCase() + how.slice(1) : how;
  return uses(kind) ? tr('Your card, {card}, needs {need}. This tile is the one it can spare most.', { card, need }) : tr('Your card, {card}, needs {need}. The {tile} has no place in it.', { card, need, tile });
}

const away = fromReady;
const riskLabel = (d: number) => riskWord(d < 0.2 ? 'Safe' : d < 0.6 ? 'Low' : d < 1.2 ? 'Medium' : 'High');
/** The words for "the 5 Dot" in a sentence. */
const tileT = (k: number) => tileLabel(k);
/** A call name as the buttons show it (Pung, ポン, 碰...). */
const callT = callWord;

export function turnHint(game: MahjongGame, seat: number, depth: HintDepth): Hint {
  const opts = game.turnOptions(seat);
  const names = game.profile.callNames;
  if (opts.canWin) {
    const s = opts.winScore!;
    return {
      headline: tr('Declare {call}! Your hand is complete.', { call: callT(names.selfDraw) }),
      why: tr('Worth {value}: {items}.', { value: `${s.value} ${tr(s.unit)}${s.fu ? ` ${s.fu} ${tr('fu')}` : ''}`, items: s.items.map((i) => scoreLine(i.name)).join(listSep()) }),
      action: 'win',
    };
  }
  if (game.profile.card) return americanTurnHint(game, seat, depth, opts.jokerSwaps.length > 0);
  if (opts.kita && kitaHelps(game, seat))
    return {
      headline: tr('Set the North aside (kita).'),
      why: depth === 'beginner' ? undefined : tr('In three-player Riichi a North is a bonus dora when set aside, and you draw a replacement. Your hand does not need it.'),
      action: 'kita',
      focusKind: game.profile.nukiDora,
    };
  const me = game.players[seat];
  if (me.riichi) {
    return {
      headline: tr("You're in {riichi}. Your drawn tile goes back out automatically.", { riichi: callT(names.riichi ?? 'riichi') }),
      // The drawn tile goes back out: the waits are those of the hand without it.
      why: tr('Waiting on {tiles}. You can still win on any of them.', { tiles: tileList(winningWaits(game, seat, opts.discards[0]?.kind ?? -1)) }),
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
        headline: tr('Declare a {kong} of the {tile}.', { kong: callT(names.kong), tile: tileT(k) }),
        why: depth === 'beginner' ? undefined : added ? tr("Adding it to your exposed set doesn't slow your hand, and you draw a replacement tile.") : tr("Four of a kind doesn't slow your hand, and you draw a replacement tile."),
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
  const name = tileT(best.kind);
  const hint: Hint = { headline: tr('Discard the {tile}.', { tile: name }), focusKind: best.kind, action: 'discard' };

  // Find a tile we'd naturally want to keep, for "keep X" phrasing.
  const keep = best.improvers.length
    ? pl.hand.find((t) => best.improvers.some((k) => Math.abs(k - t.kind) <= 2 && t.kind !== best.kind && Math.floor(k / 9) === Math.floor(t.kind / 9) && t.kind < 27))
    : undefined;

  if (plan.mode === 'fold') {
    hint.why = tr("Play it safe this turn. You're {away}, and winning from here isn't worth the risk of feeding a ready hand.", { away: away(best.shanten) });
  } else if (best.shanten === 0) {
    const unseen = unseenCounts(game, seat);
    const w = best.improvers.map((k) => `${tileT(k)} (${tr('{n} left', { n: unseen[k] })})`);
    hint.why = w.length ? tr("You'll be ready to win. Waiting on {tiles}.", { tiles: w.join(listSep()) }) : tr("You'll be ready to win. Waiting on nothing live, consider another discard.");
  } else {
    const second = ranked.find((r) => r.kind !== best.kind);
    hint.why = tr('It keeps you {away}, with {n} tiles still out there that improve your hand.', { away: away(best.shanten), n: best.ukeire });
    const card = cardHint(game, seat, best.kind);
    const route = card ? null : pairsRoute(game, seat, best.kind);
    if (card) hint.why = sentences(card, hint.why);
    else if (route) hint.why = sentences(tr('Go for {hand}: your pairs make it the shortest road to a win.', { hand: planName(route) }), hint.why);
    else if (keep) hint.why = sentences(tr('Keep the {tile}: it keeps your hand flexible.', { tile: tileT(keep.kind) }), hint.why);
    if (second && second.ukeire < best.ukeire && second.shanten === best.shanten)
      hint.why = sentences(hint.why, tr('The {tile} is the next choice but leaves {n}.', { tile: tileT(second.kind), n: second.ukeire }));
  }
  const kit = targetKit(game);
  if (kit) {
    const plans = kit.plans(game, seat, best.kind);
    hint.targets = { title: kit.list, plans: hintPlans(plans, unseenCounts(game, seat)) };
    const aim = plans[0];
    if (aim && plan.mode !== 'fold' && best.shanten > 0) hint.why = sentences(aimLine(kit, aim), hint.why);
  }
  const reads = passport ? threats : targetReads(game, seat);
  if (reads.length) hint.keepBack = reads.map((t) => t.line);
  if (passport) {
    const fed = threatsOn(threats, best.kind);
    if (fed.length) hint.warning = sentences(fed[0].line, tr('Every other discard slows your hand, so this is the best of the risks.'));
  }
  const threat = plan.threat;
  if (threat && !(passport && hint.warning)) {
    const i = plan.danger.reads.indexOf(threat);
    const d = plan.danger.detail[best.kind][i];
    let line = sentences(threatSentence(game, threat), d.reason === 'none' && plan.mode === 'fold' ? tr('The {tile} is the safest tile you have.', { tile: name }) : safetySentence(best.kind, d));
    if (plan.mode === 'push' && d.hit > 0.05) line = sentences(threatSentence(game, threat), tr('The {tile} carries some risk, but your hand is worth pushing.', { tile: name }));
    hint.warning = line;
  }
  // Riichi: declare when this discard leaves a ready closed hand (unless it's better to stay quiet).
  const riichiOk = opts.riichiDiscards.some((id) => pl.hand.find((t) => t.id === id)?.kind === best.kind);
  if (riichiOk) {
    const advice = riichiAdvice(game, seat, best.kind);
    const riichi = callT(names.riichi ?? 'riichi');
    if (advice.riichi) {
      hint.headline = tr('Declare {riichi} and discard the {tile}.', { riichi, tile: name });
      hint.action = 'riichi';
      hint.why = sentences(
        game.profile.yakuRequired
          ? tr('Your closed hand will be ready. {riichi} adds 1 han (more with ippatsu and ura dora) and makes any win legal, but your hand is locked afterwards.', { riichi })
          : tr('Your closed hand will be ready. Declaring {riichi} adds to what your win pays, but your hand is locked afterwards.', { riichi }),
        hint.why,
      );
    } else if (advice.reason === 'valuable') {
      hint.headline = tr('Discard the {tile} and stay quiet.', { tile: name });
      hint.why = sentences(
        tr('Your hand is ready and already worth about {points} points without declaring. Staying quiet keeps the others from playing safe against you, and you can still fold if you need to.', {
          points: (Math.round(advice.wait.damaPoints / 100) * 100).toLocaleString('en-US'),
        }),
        hint.why,
      );
    } else if (advice.reason === 'noTiles') {
      hint.why = sentences(
        game.profile.riichi?.cost
          ? tr("You'll be ready, but every tile you'd wait on is already showing, so declaring {riichi} isn't worth the deposit.", { riichi })
          : tr("You'll be ready, but every tile you'd wait on is already showing, so declaring {riichi} isn't worth locking your hand.", { riichi }),
        hint.why,
      );
    }
  }
  // Furiten: a wait you've already discarded means no winning on discards.
  if (game.profile.furiten && best.shanten === 0) {
    const after = game.naturalCounts(pl.hand);
    after[best.kind]--;
    // Every wait counts, even one with no copies left to draw.
    const ws = wildWaits(after, handWilds(game, seat), pl.melds.length, game.shapesFor(seat), game.profile.wilds ?? { inPair: false, inChow: false });
    const gone = ws.filter((k) => pl.discardKinds.includes(k) || k === best.kind);
    if (gone.length) hint.warning = tr("Furiten: you've discarded {tiles}, which you'd be waiting on. You could only win by self-draw.", { tiles: tileList(gone) });
  }
  // Yaku: open hands in yaku-required rules need a way to score.
  if (game.profile.yakuRequired && !game.isConcealed(seat) && !openHandHasYakuPath(game, seat, -1, [])) {
    hint.warning = tr('Your open hand has no yaku yet. You need a dragon or value-wind set, or all simples, before you can win.');
  }
  if (depth === 'beginner') delete hint.why;
  if (depth === 'advanced')
    hint.table = ranked.slice(0, 4).map((e) => ({ tile: tileT(e.kind), away: away(e.shanten), helpful: e.ukeire, risk: riskWord(riskLabelFor(e.loss)) }));
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
    return {
      headline: names.win === 'Mahjong' ? tr('Win on the {tile}!', { tile: tileT(discardKind) }) : tr('{call} on the {tile}!', { call: callT(names.win), tile: tileT(discardKind) }),
      why: tr('That discard completes your hand.'),
      action: 'win',
    };
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
        headline: tr('{call} the {tile}.', { call: callT(best.o.type === 'kong' ? names.kong : names.pung), tile: tileT(discardKind) }),
        why: depth === 'beginner' ? undefined : tr('It fits a hand on the card and leaves you {away}. Exposed sets can hold jokers, which others may swap for.', { away: cardAway(best.after) }),
        action: best.o.type,
        focusKind: discardKind,
      };
    return {
      headline: tr('Pass.'),
      why: depth === 'beginner' ? undefined : tr("The {tile} doesn't bring your nearest card hand closer. In American Mahjong you can only call for a set of three or more, or for Mah Jongg.", { tile: tileT(discardKind) }),
      action: 'pass',
    };
  }
  const plan = planClaim(game, seat, options, discardKind, ADVISOR_CLAIMS);
  const name = tileT(discardKind);
  const why = (text: string) => (depth === 'beginner' ? undefined : text);
  const unit = game.profile.scoreUnit ?? (game.profile.yakuRequired ? 'han' : (game.profile.base ?? game.profile.id) === 'taiwanese' ? 'tai' : 'faan');
  const called = plan.best;
  if (called.type === 'buy') {
    const price = game.profile.buyFromLeft ?? 0;
    const own = game.shapesFor(seat).special?.find((sp) => sp.ai && sp.how);
    const p = { card: own ? tr(own.name) : '', before: away(plan.before), after: away(plan.after), n: price };
    return {
      headline: tr('Buy the {tile} for {n}.', { tile: name, n: price }),
      why: why(
        own
          ? tr('It fits your card, {card}, and moves you from {before} to {after}. A bought tile stays concealed in your hand, and the {n} goes to the bank for the next winner.', p)
          : tr('It moves you from {before} to {after}. A bought tile stays concealed in your hand, and the {n} goes to the bank for the next winner.', p),
      ),
      action: 'buy',
      focusKind: discardKind,
    };
  }
  if (called.type !== 'pass') {
    const verb = callT(called.type === 'chow' ? names.chow : called.type === 'kong' ? names.kong : names.pung);
    const moves = plan.after < plan.before ? tr('It moves you from {before} to {after}.', { before: away(plan.before), after: away(plan.after) }) : tr('It keeps you {away}.', { away: away(plan.after) });
    const joker = called.using?.some((k) => game.isWild(k)) ? tr('It uses up one of your jokers.') : '';
    // More than one chow on offer: say which (the others may fit no winning hand at all).
    const which = called.type === 'chow' && options.filter((o) => o.type === 'chow').length > 1;
    return {
      headline: which ? tr('{call} the {tile} with the {tiles}.', { call: verb, tile: name, tiles: andJoin(called.using!.map(tileT)) }) : tr('{call} the {tile}.', { call: verb, tile: name }),
      why: why(sentences(moves, tr('Calling shows your set to the table, so your hand is no longer concealed.'), joker)),
      action: called.type,
      focusKind: discardKind,
    };
  }
  const reason = plan.reason === 'noGain' && options.every((o) => o.type === 'buy') ? 'noGainBuy' : plan.reason;
  const keep = `${game.profile.buyFromLeft ?? ''}`;
  const text =
    reason === 'noYaku'
      ? tr('Calling would leave your hand open with no yaku, so it could never win. Stay closed and aim for riichi.')
      : reason === 'noValue'
        ? tr("An open hand here couldn't reach the {n} {unit} you need to win. Stay concealed or wait for a scoring set.", { n: game.profile.minValue, unit: tr(unit) })
        : reason === 'defend'
          ? tr("You're {away} and someone looks ready. Calling would use up tiles you can safely discard, so stay patient and play safe.", { away: away(plan.before) })
          : reason === 'noGainBuy'
            ? plan.before === 0
              ? tr("Buying the {tile} wouldn't bring your hand closer: you are ready, and a bought tile can never make Mahjong. Keep your {n} and draw from the wall.", { tile: name, n: keep })
              : tr("Buying the {tile} wouldn't bring your hand closer. Keep your {n} and draw from the wall.", { tile: name, n: keep })
            : reason === 'staysClosed'
              ? game.profile.riichi
                ? tr('Calling the {tile} would speed you up a little, but your concealed hand is worth more: you can still declare riichi.', { tile: name })
                : tr('Calling the {tile} would speed you up a little, but your concealed hand is worth more.', { tile: name })
              : tr("Calling the {tile} doesn't bring you closer to winning, and keeping your hand concealed keeps your options open.", { tile: name });
  return { headline: tr('Pass.'), why: why(text), action: 'pass' };
}

const cardAway = (n: number) => (!Number.isFinite(n) ? tr('no card hand fits your exposures (dead hand)') : n <= 0 ? tr('complete') : n === 1 ? tr('one tile from Mah Jongg') : tr('{n} tiles from a card hand', { n }));

/** A tile or the Flower (American flowers are one kind), in a sentence. */
const kindT = (k: number) => (k === FLOWER ? tr('Flower') : tileT(k));

function americanTurnHint(game: MahjongGame, seat: number, depth: HintDepth, canSwap: boolean): Hint {
  const pl = game.players[seat];
  const sw = canSwap ? bestSwap(game.turnOptions(seat).jokerSwaps, pl.hand, pl.melds) : undefined;
  if (sw) {
    const t = pl.hand.find((x) => x.id === sw.tileId)!;
    return {
      headline: sw.owner === seat ? tr('Swap your {tile} for the joker in your exposure.', { tile: tileT(t.kind) }) : tr("Swap your {tile} for the joker in {name}'s exposure.", { tile: tileT(t.kind), name: game.players[sw.owner].name }),
      why: depth === 'beginner' ? undefined : tr('A joker can stand in for any tile in a set of three or more, so it is worth more than the tile you give up.'),
      action: 'discard',
      focusKind: t.kind,
      swap: true,
    };
  }
  const danger = exposureDanger(game, seat);
  const ranked = rankDiscards(pl.hand, pl.melds, (k) => danger(k) * 0.3);
  const best = ranked[0];
  const target = progress(pl.hand.filter((t) => t !== best.tile), pl.melds, 1)[0];
  const hint: Hint = { headline: tr('Discard the {tile}.', { tile: tileT(best.tile.kind) }), focusKind: best.tile.kind, action: 'discard' };
  const rest = pl.hand.filter((t) => t !== best.tile);
  if (!Number.isFinite(cardDistance(rest, pl.melds))) {
    hint.why = tr('No hand on the card fits your exposures any more: your hand is dead and can’t win. Discard safely for the rest of the hand.');
  } else if (depth !== 'beginner' && target) {
    hint.why = tr('Your closest hand on the card is {hand}. That leaves you {away}.', { hand: describeTarget(target), away: cardAway(target.missing) });
    // One away, but every tile that would finish it is already showing.
    if (target.missing === 1) {
      const unseen = unseenCounts(game, seat);
      const waits = game.profile.tileKinds.filter((k) => cardDistance([...rest, { id: -8, kind: k }], pl.melds) <= 0);
      if (waits.length && waits.every((k) => k < unseen.length && unseen[k] === 0))
        hint.why = tr('Your closest hand on the card is {hand}, but every tile that would finish it is already showing. Look for another hand on the card.', { hand: describeTarget(target) });
    }
  }
  if (depth === 'advanced')
    hint.table = ranked.slice(0, 4).map((r) => ({ tile: tileT(r.tile.kind), away: cardAway(r.missing), helpful: Math.round(r.keep), risk: riskLabel(danger(r.tile.kind) * 0.3) }));
  const kit = targetKit(game);
  if (kit) hint.targets = { title: kit.list, plans: hintPlans(kit.plans(game, seat, best.tile.kind), unseenCounts(game, seat)) };
  const reads = targetReads(game, seat);
  if (reads.length) hint.keepBack = reads.map((t) => t.line);
  const hot = game.players.find((p, s) => s !== seat && !game.sameTeam(seat, s) && p.melds.length >= 3);
  if (hot) hint.warning = tr('{name} has {n} exposures and may be close to Mah Jongg. Avoid tiles that match them.', { name: hot.name, n: hot.melds.length });
  return hint;
}

/** A card's description, or null when it has no translation yet (other languages then leave it out). */
function cardHow(how: string): string | null {
  const t = tr(how);
  return lang() !== 'en' && t === how ? null : t;
}

/** Why the exchange pick makes sense, in the words of the round being played. */
function exchangeWhy(game: MahjongGame, seat: number): string {
  const rules = game.shapesFor(seat);
  const own = cardUses(rules) && rules.special?.find((sp) => sp.ai && sp.how);
  if (own) {
    const how = cardHow(own.how!);
    return how ? tr("Your card is {card}: {how}. Give away the tiles it can't use first.", { card: tr(own.name), how }) : tr("Your card is {card}. Give away the tiles it can't use first.", { card: tr(own.name) });
  }
  if (game.state.exchange && rules.chows === false) return tr('Goulash round: no chows count here, so keep pairs and pungs. Give away lonely tiles and broken runs.');
  if (game.state.goulash) return tr('Goulash exchange: the last hand was a wall game, so everyone passes three tiles. Give away the tiles your sets need least, usually lonely honours and terminals.');
  return tr('Give away the tiles your hand needs least: usually lonely honours and terminals, and tiles that fit none of your sets.');
}

/** Charleston advice: which three tiles to pass. */
export function charlestonHint(game: MahjongGame, seat: number, depth: HintDepth): Hint & { tiles: number[] } {
  const ph = game.state.phase;
  // India Rules swaps in pairs, so the direction depends on the seat (the same reckoning as the action bar).
  const n = game.profile.players;
  const dirName = ph.kind === 'charleston' ? charlestonDirName((game.passTarget(seat, ph.stage) - seat + n) % n || CHARLESTON[ph.stage]) : 'right';
  const dir = tr(dirName);
  if (!game.profile.card) {
    const tiles = exchangePick(game, seat);
    return {
      headline: tr('Pass the {tiles} to the {dir}.', { tiles: tiles.map((t) => kindT(t.kind)).join(listSep()), dir }),
      why: exchangeWhy(game, seat),
      tiles: tiles.map((t) => t.id),
    };
  }
  const pass = charlestonPick(game.players[seat].hand);
  const target = progress(game.players[seat].hand.filter((t) => !pass.includes(t)), [], 1)[0];
  return {
    headline: tr('Pass the {tiles} to the {dir}.', { tiles: pass.map((t) => kindT(t.kind)).join(listSep()), dir }),
    why:
      depth === 'beginner'
        ? game.state.goulash
          ? tr("Pick three tiles you don't need, then pass. This is a goulash, so jokers may be passed too, but you will usually want to keep them.")
          : tr("Pick three tiles you don't need, then pass. Jokers can't be passed.")
        : tr("They don't fit your best card hands. Aim for {hand}.", { hand: target ? describeTarget(target) : tr('a hand on the card') }),
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
  if (s === 0 && waitingView(game, seat)) {
    const w = currentWaits(game, seat);
    return w.length ? tr('Ready · waiting on {tiles}', { tiles: andList(w.map((k) => tileLabel(k))) }) : tr('Ready');
  }
  // 99: the shapes can't be reached at all (e.g. a call that fits none of the cards).
  if (s >= 99) return tr('no win possible with these sets');
  return s <= 0 ? tr('ready') : trn(s, '{n} tile from ready', '{n} tiles from ready');
}
