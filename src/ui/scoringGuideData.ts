// What the scoring guide says for each variation: how to win, and the lines
// that score. Names are the score lines exactly as the hand result shows them
// (so the guide can mark what your last win scored); the explanations are
// translated. Values follow the rule files in src/engine/rules; the table's
// house rules (seven pairs, mixed hands, Lì Gǔ Lì Gǔ, minimums, caps) are
// read from the profile, so the guide always matches the game being played.

import { MIXED_FAAN, MIXED_NAMES, MIXED_TAI, type MixedValues } from '../engine/rules/mixed';
import { LI_GU_NAME } from '../engine/rules/taiwanese';
import { BIG_CARD, SMALL_CARD, type CardHand } from '../engine/rules/special';
import { GOULASH_ROUND_MIN, SPECIAL_ROUNDS, type SpecialRoundId } from '../engine/rules/windRounds';
import type { RuleProfile } from '../engine/rules/types';
import { tr } from '../i18n';

export interface GuideLine {
  name: string;
  /** Number of units, or a word ("Limit", "Yakuman"). */
  value: number | string;
  how: string;
}

export interface GuideSection {
  title: string;
  lines: GuideLine[];
  /** Closed until tapped (long or rare sections). */
  closed?: boolean;
}

export interface Guide {
  /** The scoring unit, translated ("faan", "tai"...). */
  unit: string;
  /** How a hand wins, one sentence per bullet. */
  win: string[];
  /** How the score turns into payments. */
  pay: string;
  sections: GuideSection[];
  /** The table plays a printed card instead: show it below (Dubai card, American card). */
  card?: 'dubai' | 'american';
}

const L = (name: string, value: number | string, how: string): GuideLine => ({ name, value, how });
const family = (p: RuleProfile) => p.base ?? p.id;
const choice = (p: RuleProfile, id: string) => p.houseChoices?.[id] ?? p.houseRules.find((r) => r.id === id)?.default;

/** Mixed hands for a table that has the house rule on. */
function mixedSection(v: MixedValues, pairs: boolean): GuideSection {
  const lines = [
    L(MIXED_NAMES.tripleChow, v.tripleChow, tr('The same run in all three suits, like 1-2-3 Characters, Dots and Bamboo')),
    L(MIXED_NAMES.shiftedChows, v.shiftedChows, tr('Three runs one step apart, one in each suit, like 1-2-3, 2-3-4, 3-4-5')),
    L(MIXED_NAMES.triplePung, v.triplePung, tr('A pung of the same number in all three suits')),
    L(MIXED_NAMES.shiftedPungs, v.shiftedPungs, tr('Pungs one number apart, one in each suit, like 4, 5 and 6')),
  ];
  if (pairs) lines.push(L(MIXED_NAMES.triplePair, v.triplePair, tr('In seven pairs: the same number paired in all three suits')));
  return { title: tr('Mixed hands'), lines };
}

/** Mixed sets (Indian and Dubai tables): sets across the suits, used inside a hand. */
function mixedSetsSection(): GuideSection {
  return {
    title: tr('Mixed sets and knits'),
    lines: [
      L('Mixed pung', 1, tr('Crochet: the same number once in each suit, like 5 Characters, 5 Dots, 5 Bamboo. Concealed, each one')),
      L('Mixed chow', 0, tr('Three numbers in a row, one in each suit, like 3 Characters, 4 Dots, 5 Bamboo. Concealed; counts as a set')),
      L('Knit pair', 0, tr('The same number in two suits, used as the pair')),
      L('Crochet', 6, tr('Four mixed pungs and a knit')),
      L('Knitting', 4, tr('Seven knits from two suits, nothing claimed')),
    ],
  };
}

/** The four special wind rounds, when the table plays them. */
function roundsSection(): GuideSection {
  const winds: [string, SpecialRoundId][] = [
    [tr('East'), 'passport'],
    [tr('South'), 'smallCard'],
    [tr('West'), 'goulash'],
    [tr('North'), 'bigCard'],
  ];
  return { title: tr('Special wind rounds'), closed: true, lines: winds.map(([w, id]) => L(tr(SPECIAL_ROUNDS[id].name), w, tr(SPECIAL_ROUNDS[id].rule))) };
}

const cardLines = (card: CardHand[]) => card.map((c) => L(c.name, c.value, tr(c.how)));

/** The guide in a special wind round: what this round's hands are. */
function specialRoundGuide(p: RuleProfile, unit: string): Guide {
  const id = p.specialRound as SpecialRoundId;
  const extras: GuideSection = {
    title: tr('How you won'),
    lines: [L('Self-drawn', 1, tr('You drew the winning tile yourself')), ...(id === 'passport' ? [L('Concealed hand', 1, tr('You claimed nothing all hand'))] : []), ...(p.flowers ? [L('Seat flower', 1, tr('The flower or season numbered for your seat (East 1, South 2, West 3, North 4)')), L('All four plants', 2, tr('All four flowers of one set'))] : [])],
  };
  const nine = p.houseChoices?.passportNine ?? 'straight';
  const nineHow = nine === 'knitted' ? tr('1-4-7, 2-5-8 and 3-6-9, each in a different suit') : nine === 'orphans' ? tr('Nine different ones, nines, winds and dragons') : tr('1 to 9 of one suit');
  const win = [tr(SPECIAL_ROUNDS[id].rule)];
  const sections: GuideSection[] = [];
  if (id === 'passport') {
    win.push(tr('A passport is a row of different tiles: 5 or 6 different winds and dragons, or a 9-tile passport ({nine}).', { nine: nineHow }), tr('Fill the rest with sets, and a pair when two tiles are left over. Sets may be claimed; the passport is built from your own tiles.'));
    sections.push({
      title: tr('Passports'),
      lines: [
        L('Passport (5)', 1, tr('Five different winds and dragons, plus three sets')),
        L('Passport (6)', 1, tr('Six different winds and dragons, plus two sets and a pair')),
        L('Passport (9)', 2, tr('A 9-tile passport, plus a set and a pair')),
        L('Double Passport (5 + 6)', 3, tr('Two passports and a set')),
        L('Double Passport (6 + 6)', 3, tr('Two six-passports and a pair')),
        L('Double Passport (9 + 5)', 3, tr('A 9-tile passport and a five-passport: the whole hand')),
      ],
    });
  } else if (id === 'smallCard' || id === 'bigCard') {
    win.push(tr('Every hand on the card is concealed: you may claim a discard only to win.'));
    sections.push({ title: id === 'smallCard' ? tr('The Small Card') : tr('The Big Card'), lines: cardLines(id === 'smallCard' ? SMALL_CARD : BIG_CARD) });
  } else {
    win.push(tr('Every set is a pung or kong: no chows, not even concealed ones.'), tr('You need at least {n} {unit} to declare a win.', { n: Math.max(p.minValue, GOULASH_ROUND_MIN), unit }));
    const base = classicGuide(p, unit);
    const chowLine = tr('A set is a pung (three of a kind); chows can’t be claimed at this table, only made from your own draws.');
    return { ...base, win: [...win, ...base.win.filter((w) => w !== chowLine)] };
  }
  sections.push(extras);
  return { unit, win, pay: classicGuide(p, unit).pay, sections };
}

/** How the hand can be built, from the profile's shapes. */
function winLines(p: RuleProfile, unit: string): string[] {
  const out: string[] = [];
  const sets = p.shapes.sets ?? 4;
  out.push(tr('Collect {sets} sets and a pair: {tiles} tiles once you add the winning tile.', { sets, tiles: sets * 3 + 2 }));
  out.push(p.calls.chow ? tr('A set is a pung (three of a kind) or a chow (a run of three in one suit). A kong (four of a kind) counts as a set and draws a replacement tile.') : tr('A set is a pung (three of a kind); chows can’t be claimed at this table, only made from your own draws.'));
  const special: string[] = [];
  if (p.shapes.sevenPairs) special.push(tr('seven pairs'));
  if (p.shapes.thirteenOrphans) special.push(tr('thirteen orphans'));
  for (const sp of p.shapes.special ?? []) {
    if (sp.name === 'liGu') special.push(tr('Lì Gǔ Lì Gǔ (seven pairs and a pung)'));
    else if (sp.name === 'nicoNico') special.push(tr('Nico Nico (seven pairs and a pung)'));
    else if (sp.name === 'orphans13' || sp.name === 'orphans16') special.push(sp.name === 'orphans13' ? tr('thirteen orphans') : tr('sixteen orphans'));
    else if (sp.name === 'Knitted Straight') special.push(tr('the knitted straight'));
    else if (sp.name === 'Lesser Honours and Knitted Tiles') special.push(tr('honours and knitted tiles'));
    else if (sp.name === 'Knitting') special.push(tr('knitting (seven knits)'));
  }
  if (special.length) out.push(tr('Special hands that also win, fully concealed: {list}.', { list: [...new Set(special)].join(' · ') }));
  else out.push(tr('No special shapes here: every win is sets and a pair.'));
  if (p.missingSuit) out.push(tr('Your winning hand must be missing one suit entirely.'));
  if (p.yakuRequired) out.push(tr('You also need at least one yaku (a scoring pattern). Riichi, a concealed self-draw or all simples are the easiest.'));
  if (p.wilds) out.push(tr('Jokers can stand in for tiles in sets. A hand won without any scores a bonus.'));
  if (p.yakuRequired || family(p) === 'mcr') {
    // The yaku line (Riichi) or the payment line (MCR's 8 fan) says what a win needs.
  } else if (p.minValue > 0) out.push(tr('You need at least {n} {unit} to declare a win.', { n: p.minValue, unit }));
  else out.push(tr('Any complete hand may win, even one that scores nothing.'));
  return out;
}

const honourLines = (dragon: number, seat: number, round: number, smallDragons: number | string, smallWinds: number | string): GuideLine[] => [
  L('Dragon pung', dragon, tr('A pung or kong of any dragon, each one')),
  L('Seat wind pung', seat, tr('A pung of your own seat’s wind')),
  L('Round wind pung', round, tr('A pung of the wind of the round')),
  L('Small Three Dragons', smallDragons, tr('Two dragon pungs and a pair of the third dragon')),
  L('Small Four Winds', smallWinds, tr('Three wind pungs and a pair of the fourth wind')),
];

function classicGuide(p: RuleProfile, unit: string): Guide {
  const hk = family(p) === 'hongkong';
  const mixed = hk ? choice(p, 'mixedHands') === 'on' : choice(p, 'mixedHands') !== 'off';
  const flowers = !!p.flowers;
  const sections: GuideSection[] = [
    {
      title: tr('How you won'),
      lines: [L('Self-drawn', 1, tr('You drew the winning tile yourself')), L('Concealed hand', 1, tr('You claimed nothing all hand')), L('Win after Kong', 1, tr('Won on the replacement tile after a kong')), L('Robbing the Kong', 1, tr('Won on a tile another player added to a pung')), L('Last tile', 1, tr('Won on the very last tile'))],
    },
    {
      title: tr('Hand shape'),
      lines: [
        L('All Chows', 1, tr('Every set is a chow, and the pair is not a dragon or a lucky wind')),
        L('All Pungs', 3, tr('Every set is a pung or kong')),
        ...(p.shapes.sevenPairs ? [L('Seven Pairs', 4, tr('Seven different pairs, nothing claimed'))] : []),
        L(hk ? 'Half Flush' : 'Mixed One Suit', 3, tr('One suit plus honours')),
        L(hk ? 'Full Flush' : 'Pure One Suit', 7, tr('One suit only, no honours')),
        ...(hk ? [L('Mixed Terminals', 1, tr('Only ones, nines and honours'))] : []),
      ],
    },
    { title: tr('Honours'), lines: honourLines(1, 1, 1, hk ? 5 : 3, 6) },
  ];
  if (mixed) sections.push(mixedSection(MIXED_FAAN, p.shapes.sevenPairs));
  if (p.shapes.special?.some((x) => x.name === 'Mixed sets')) sections.push(mixedSetsSection());
  if (p.windRounds) sections.push(roundsSection());
  if (flowers)
    sections.push({
      title: tr('Flowers'),
      lines: [L('Seat flower', 1, tr('The flower or season numbered for your seat (East 1, South 2, West 3, North 4)')), L('All four plants', 2, tr('All four flowers of one set')), ...(family(p) !== 'classic' ? [L('No flowers', 1, tr('You won without drawing any flower'))] : [])],
    });
  if (family(p) === 'indian' && choice(p, 'cleanBonus') !== 'off' && choice(p, 'jokers') !== 'off') sections.push({ title: tr('Jokers'), lines: [L('No jokers used', 1, tr('Your winning hand uses no joker'))] });
  const limit = hk ? 10 : 8;
  sections.push({
    title: tr('Limit hands'),
    closed: true,
    lines: [
      L('Thirteen Orphans', tr('Limit'), tr('One of each one, nine, wind and dragon, plus any one of them again')),
      L('All Honours', tr('Limit'), tr('Only winds and dragons')),
      L(hk ? 'Great Three Dragons' : 'Big Three Dragons', hk ? 8 : tr('Limit'), tr('Pungs of all three dragons')),
      L(hk ? 'Great Four Winds' : 'Big Four Winds', tr('Limit'), tr('Pungs of all four winds')),
      L('Four Concealed Pungs', tr('Limit'), tr('Four pungs, none of them claimed')),
      ...(hk ? [L('All Terminals', tr('Limit'), tr('Only ones and nines')), L('Four Kongs', tr('Limit'), tr('Four kongs')), L('Nine Gates', tr('Limit'), tr('1-1-1-2-3-4-5-6-7-8-9-9-9 of one suit, concealed, plus any tile of that suit'))] : []),
    ],
  });
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Each faan doubles the payment, up to the limit of {limit} faan. On a discard the discarder pays the most; a self-draw is paid by everyone.', { limit }),
    sections,
  };
}

function riichiGuide(p: RuleProfile, unit: string): Guide {
  const closed = tr('closed');
  const open = tr('open');
  const v = (c: number, o: number) => `${c} ${closed} · ${o} ${open}`;
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Han and fu set the points. From 5 han a hand is a mangan, then haneman (6), baiman (8), sanbaiman (11) and yakuman (13). Dora add han but are not yaku.'),
    sections: [
      {
        title: tr('One han'),
        lines: [
          L('Riichi', 1, tr('Declare ready with a closed hand and a 1,000-point stick')),
          L('Ippatsu', 1, tr('Win within one go-around of declaring riichi')),
          L('Menzen Tsumo', 1, tr('Self-draw with a closed hand')),
          L('Tanyao', 1, tr('All simples: no ones, nines or honours')),
          L('Pinfu', 1, tr('Closed, all runs, a pair that scores nothing, and a two-sided wait')),
          L('Iipeikou', 1, tr('Two identical runs, closed')),
          L('Yakuhai', 1, tr('A pung of dragons, your seat wind or the round wind')),
          L('Haitei / Houtei', 1, tr('Won on the very last tile')),
          L('Rinshan Kaihou', 1, tr('Won on the replacement tile after a kong')),
          L('Chankan', 1, tr('Won on a tile another player added to a pung')),
        ],
      },
      {
        title: tr('Two han and more'),
        lines: [
          L('Double Riichi', 2, tr('Riichi on your very first discard')),
          L('Chiitoitsu', 2, tr('Seven different pairs, closed')),
          L('Sanshoku Doujun', v(2, 1), tr('The same run in all three suits')),
          L('Sanshoku Doukou', 2, tr('A pung of the same number in all three suits')),
          L('Ittsu', v(2, 1), tr('1-2-3, 4-5-6 and 7-8-9 of one suit')),
          L('Toitoi', 2, tr('Every set is a pung or kong')),
          L('Sanankou', 2, tr('Three pungs, none of them claimed')),
          L('Sankantsu', 2, tr('Three kongs')),
          L('Shousangen', 2, tr('Two dragon pungs and a pair of the third dragon')),
          L('Honroutou', 2, tr('Only ones, nines and honours')),
          L('Chanta', v(2, 1), tr('Every set and the pair hold a one, nine or honour')),
          L('Junchan', v(3, 2), tr('Every set and the pair hold a one or nine, no honours')),
          L('Ryanpeikou', 3, tr('Two pairs of identical runs, closed')),
          L('Honitsu', v(3, 2), tr('One suit plus honours')),
          L('Chinitsu', v(6, 5), tr('One suit only, no honours')),
        ],
      },
      {
        title: tr('Yakuman'),
        closed: true,
        lines: [
          L('Kokushi Musou', tr('Yakuman'), tr('One of each one, nine, wind and dragon, plus any one of them again')),
          L('Suuankou', tr('Yakuman'), tr('Four pungs, none of them claimed')),
          L('Daisangen', tr('Yakuman'), tr('Pungs of all three dragons')),
          L('Shousuushii', tr('Yakuman'), tr('Three wind pungs and a pair of the fourth wind')),
          L('Daisuushii', tr('Yakuman'), tr('Pungs of all four winds')),
          L('Tsuuiisou', tr('Yakuman'), tr('Only winds and dragons')),
          L('Chinroutou', tr('Yakuman'), tr('Only ones and nines')),
          L('Ryuuiisou', tr('Yakuman'), tr('Only green tiles: 2, 3, 4, 6, 8 Bamboo and the green dragon')),
          L('Chuuren Poutou', tr('Yakuman'), tr('1-1-1-2-3-4-5-6-7-8-9-9-9 of one suit, concealed, plus any tile of that suit')),
          L('Suukantsu', tr('Yakuman'), tr('Four kongs')),
        ],
      },
    ],
  };
}

function taiwaneseGuide(p: RuleProfile, unit: string): Guide {
  const sections: GuideSection[] = [
    {
      title: tr('How you won'),
      lines: [
        L('Dealer', 1, tr('You are the dealer, plus 2 for each deal you have kept')),
        L('Concealed self-draw', 3, tr('Nothing claimed and you drew the winning tile')),
        L('Concealed hand', 1, tr('You claimed nothing all hand')),
        L('Self-draw', 1, tr('You drew the winning tile yourself')),
        L('All melded', 2, tr('Every set claimed, won on a discard')),
        L('Single wait', 1, tr('Only one tile could finish your hand')),
        L('Last tile self-draw', 1, tr('Won on the very last tile')),
        L('Win on replacement', 1, tr('Won on the replacement tile after a kong or flower')),
        L('Robbing the kong', 1, tr('Won on a tile another player added to a pung')),
      ],
    },
    {
      title: tr('Hand shape'),
      lines: [
        L('Ping Hu', 2, tr('All chows, no honours or flowers, an open wait, won on a discard')),
        L('All pungs', 4, tr('Every set is a pung or kong')),
        L('Three concealed pungs', 2, tr('Three pungs, none of them claimed (4 is 5 tai, 5 is 8 tai)')),
        L('Half flush', 4, tr('One suit plus honours')),
        L('Full flush', 8, tr('One suit only, no honours')),
        L('All honours', 16, tr('Only winds and dragons')),
      ],
    },
  ];
  if (p.shapes.special?.some((s) => s.name === 'liGu')) sections.push({ title: tr('All-pairs hands'), lines: [L(LI_GU_NAME, 8, tr('Seven pairs and one pung, all concealed (includes the concealed hand)'))] });
  sections.push({
    title: tr('Honours'),
    lines: [
      L('Dragon pung', 1, tr('A pung or kong of any dragon, each one')),
      L('Seat wind pung', 1, tr('A pung of your own seat’s wind')),
      L('Round wind pung', 1, tr('A pung of the wind of the round')),
      L('Small three dragons', 4, tr('Two dragon pungs and a pair of the third dragon')),
      L('Big three dragons', 8, tr('Pungs of all three dragons')),
      L('Small four winds', 8, tr('Three wind pungs and a pair of the fourth wind')),
      L('Big four winds', 16, tr('Pungs of all four winds')),
    ],
  });
  if (choice(p, 'mixedHands') === 'on') sections.push(mixedSection(MIXED_TAI, false));
  sections.push({
    title: tr('Flowers'),
    lines: [L('Seat flower', 1, tr('The flower or season numbered for your seat (East 1, South 2, West 3, North 4)')), L('All four plants', 2, tr('All four flowers of one set')), L('Eight flowers', 8, tr('All eight flowers'))],
  });
  return { unit, win: winLines(p, unit), pay: tr('Each tai adds 100 to a base of 300. Only the discarder pays; a self-draw is paid by everyone, and the dealer pays their own tai on top.'), sections };
}

function singaporeGuide(p: RuleProfile, unit: string): Guide {
  const cap = Number(choice(p, 'cap') ?? 5);
  const sections: GuideSection[] = [
    {
      title: tr('Hand shape'),
      lines: [
        L('Ping Hu', 4, tr('All chows, no bonus tiles, a pair that scores nothing, an open wait')),
        L('Pong Pong', 2, tr('Every set is a pung or kong')),
        ...(p.shapes.sevenPairs ? [L('Seven Pairs', 3, tr('Seven different pairs, nothing claimed'))] : []),
        L('Half colour', 2, tr('One suit plus honours')),
        L('Full colour', 4, tr('One suit only, no honours')),
      ],
    },
    { title: tr('Honours'), lines: [L('Dragon pung', 1, tr('A pung or kong of any dragon, each one')), L('Seat wind pung', 1, tr('A pung of your own seat’s wind')), L('Prevailing wind pung', 1, tr('A pung of the wind of the round')), L('Small Three Dragons', 4, tr('Two dragon pungs and a pair of the third dragon'))] },
    {
      title: tr('Bonus tiles'),
      lines: [L('Seat flower', 1, tr('The flower or season numbered for your seat (East 1, South 2, West 3, North 4)')), L('All four plants', 1, tr('A complete set of four flowers, on top')), L('Cat', 1, tr('Each animal you hold: cat, mouse, rooster or centipede'))],
    },
    { title: tr('How you won'), lines: [L('Win on kong replacement', 1, tr('Won on the replacement tile after a kong')), L('Robbing the kong', 1, tr('Won on a tile another player added to a pung')), L('Last tile', 1, tr('Won on the very last tile'))] },
    {
      title: tr('Limit hands'),
      closed: true,
      lines: [
        L('Thirteen Wonders', cap, tr('One of each one, nine, wind and dragon, plus any one of them again')),
        L('All Honours', cap, tr('Only winds and dragons')),
        L('Big Three Dragons', cap, tr('Pungs of all three dragons')),
        L('Small Four Winds', cap, tr('Three wind pungs and a pair of the fourth wind')),
        L('Big Four Winds', cap, tr('Pungs of all four winds')),
      ],
    },
  ];
  return { unit, win: winLines(p, unit), pay: tr('Each tai doubles the payment, up to the cap of {cap} tai. Animal pairs and kongs also pay on the spot.', { cap }), sections };
}

function vietnameseGuide(p: RuleProfile, unit: string): Guide {
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Phán are added, not doubled: each payment is one stake plus one more for every phán.'),
    sections: [
      { title: tr('How you won'), lines: [L('Self-drawn (Tự bốc)', 1, tr('You drew the winning tile yourself')), L('Concealed hand (Bất cầu)', 1, tr('You claimed nothing all hand')), L('Last tile', 2, tr('Won on the very last tile')), L('Win after kong', 1, tr('Won on the replacement tile after a kong')), L('Robbing the kong', 1, tr('Won on a tile another player added to a pung'))] },
      {
        title: tr('Hand shape'),
        lines: [
          L('All chows (Ù phình)', 1, tr('Every set is a chow, and the pair is not a dragon or a lucky wind')),
          L('All pungs (Ù tui tui)', 3, tr('Every set is a pung or kong')),
          ...(p.shapes.sevenPairs ? [L('Seven Pairs', 3, tr('Seven different pairs, no jokers (a house rule)'))] : []),
          L('Half flush', 3, tr('One suit plus honours')),
          L('Full flush (Mủn cun)', 6, tr('One suit only, no honours')),
          L('All honours (Toàn chữ)', 18, tr('Only winds and dragons')),
        ],
      },
      {
        title: tr('Honours'),
        lines: [...honourLines(1, 1, 1, 6, 24).map((l) => (l.name === 'Small Three Dragons' ? { ...l, name: 'Small three dragons (Tiểu tam nguyên)' } : l.name === 'Small Four Winds' ? { ...l, name: 'Small four winds (Tiểu tứ hỷ)' } : l)), L('Big three dragons (Đại tam nguyên)', 12, tr('Pungs of all three dragons')), L('Big four winds (Đại tứ hỷ)', 36, tr('Pungs of all four winds'))],
      },
      { title: tr('Flowers and jokers'), lines: [L('Seat flower (Hoa vị trí)', 1, tr('The flower or season numbered for your seat (East 1, South 2, West 3, North 4)')), L('All four plants', 2, tr('All four flowers of one set')), L('Flower Joker', 1, tr('Each Flower Joker set aside')), L('No flowers (Không hoa)', 1, tr('You won without drawing any flower')), L('No jokers used', 1, tr('Your winning hand uses no joker'))] },
    ],
  };
}

function mcrGuide(p: RuleProfile, unit: string): Guide {
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Add up the fan; you need 8 to win (flowers don’t count toward it). The discarder pays the fan plus 8, the others 8 each; a self-draw is paid fan plus 8 by everyone.'),
    sections: [
      {
        title: tr('Mixed hands'),
        lines: [
          L('Mixed Double Chow', 1, tr('The same run in two suits')),
          L('Mixed Shifted Chows', 6, tr('Three runs one step apart, one in each suit, like 1-2-3, 2-3-4, 3-4-5')),
          L('Mixed Triple Chow', 8, tr('The same run in all three suits, like 1-2-3 Characters, Dots and Bamboo')),
          L('Mixed Straight', 8, tr('1-2-3, 4-5-6 and 7-8-9, each in a different suit')),
          L('Double Pung', 2, tr('A pung of the same number in two suits')),
          L('Mixed Shifted Pungs', 8, tr('Pungs one number apart, one in each suit, like 4, 5 and 6')),
          L('Triple Pung', 16, tr('A pung of the same number in all three suits')),
        ],
      },
      {
        title: tr('All-pairs hands'),
        lines: [L('Seven Pairs', 24, tr('Seven pairs, nothing claimed')), L('Seven Shifted Pairs', 88, tr('Seven pairs in one suit with consecutive numbers, like 1 to 7'))],
      },
      {
        title: tr('Common fan'),
        lines: [
          L('Pure Double Chow', 1, tr('Two identical runs in one suit')),
          L('Short Straight', 1, tr('Two runs that join, like 1-2-3 and 4-5-6 in one suit')),
          L('Two Terminal Chows', 1, tr('1-2-3 and 7-8-9 in one suit')),
          L('Self-Drawn', 1, tr('You drew the winning tile yourself')),
          L('All Chows', 2, tr('Every set is a chow and the pair is a number tile')),
          L('All Simples', 2, tr('No ones, nines or honours')),
          L('Concealed Hand', 2, tr('Nothing claimed, won on a discard')),
          L('Dragon Pung', 2, tr('A pung or kong of any dragon, each one')),
          L('All Pungs', 6, tr('Every set is a pung or kong')),
          L('Half Flush', 6, tr('One suit plus honours')),
          L('All Types', 6, tr('All three suits, a wind and a dragon')),
          L('Pure Straight', 16, tr('1-2-3, 4-5-6 and 7-8-9 of one suit')),
          L('Full Flush', 24, tr('One suit only, no honours')),
          L('Chicken Hand', 8, tr('A win that scores nothing else'))
        ],
      },
      {
        title: tr('Big hands'),
        closed: true,
        lines: [
          L('Pure Shifted Chows', 16, tr('Three runs in one suit, each one or two steps up')),
          L('Pure Triple Chow', 24, tr('Three identical runs in one suit')),
          L('Pure Shifted Pungs', 24, tr('Three pungs in one suit, one number apart')),
          L('Four Concealed Pungs', 64, tr('Four pungs, none of them claimed')),
          L('Thirteen Orphans', 88, tr('One of each one, nine, wind and dragon, plus any one of them again')),
          L('Big Three Dragons', 88, tr('Pungs of all three dragons')),
          L('Big Four Winds', 88, tr('Pungs of all four winds')),
          L('Nine Gates', 88, tr('1-1-1-2-3-4-5-6-7-8-9-9-9 of one suit, concealed, plus any tile of that suit')),
        ],
      },
    ],
  };
}

function sichuanGuide(p: RuleProfile, unit: string): Guide {
  const cap = Number(choice(p, 'cap') ?? 4);
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Each fan doubles the payment, up to the cap of {cap} fan. Kongs pay on the spot.', { cap }),
    sections: [
      {
        title: tr('Hand patterns'),
        lines: [
          L('Self-drawn', 1, tr('You drew the winning tile yourself')),
          L('All Pungs', 1, tr('Every set is a pung or kong')),
          L('All Simples', 1, tr('No ones or nines')),
          L('Root (four of a kind)', 1, tr('All four of one tile in your hand, each time')),
          L('Golden Hook', 1, tr('Four sets claimed, waiting on the pair')),
          L('Seven Pairs', 2, tr('Seven pairs, nothing claimed')),
          L('Pure Suit', 2, tr('One suit only')),
          L('Pure 2-5-8', 2, tr('Every set and the pair are twos, fives or eights')),
          L('Terminals in every set', 2, tr('Every set and the pair hold a one or nine')),
          L('Win on a kong replacement', 1, tr('Won on the replacement tile after a kong')),
          L('Robbing the kong', 1, tr('Won on a tile another player added to a pung')),
          L('Last tile', 1, tr('Won on the very last tile')),
        ],
      },
    ],
  };
}

function koreanGuide(p: RuleProfile, unit: string): Guide {
  return {
    unit,
    win: winLines(p, unit),
    pay: tr('Points are added up, to a limit of 10. Flowers pay but never count toward the minimum.'),
    sections: [
      {
        title: tr('Hand patterns'),
        lines: [
          L('Self-drawn', 1, tr('You drew the winning tile yourself')),
          L('Concealed hand', 1, tr('You claimed nothing all hand')),
          L('Riichi', 1, tr('Declared ready with a concealed hand')),
          ...(p.shapes.sevenPairs ? [L('Seven Pairs', 2, tr('Seven different pairs, nothing claimed'))] : []),
          L('Dragon pung', 1, tr('A pung or kong of any dragon, each one')),
          L('Seat wind pung', 1, tr('A pung of your own seat’s wind')),
          L('Round wind pung', 1, tr('A pung of the wind of the round')),
          L('All Pungs', 2, tr('Every set is a pung or kong')),
          L('Three Concealed Pungs', 2, tr('Three pungs, none of them claimed')),
          L('Small Three Dragons', 2, tr('Two dragon pungs and a pair of the third dragon')),
          L('All Simples', 1, tr('No ones, nines or honours')),
          L('Terminals and Honours', 2, tr('Only ones, nines and honours')),
          L('Mixed One Suit', 2, tr('One suit plus honours')),
          L('Pure One Suit', 5, tr('One suit only, no honours')),
        ],
      },
      {
        title: tr('Limit hands'),
        closed: true,
        lines: [L('Thirteen Orphans', 10, tr('One of each one, nine, wind and dragon, plus any one of them again')), L('All Honours', 10, tr('Only winds and dragons')), L('Big Three Dragons', 10, tr('Pungs of all three dragons')), L('Big Four Winds', 10, tr('Pungs of all four winds')), L('Four Concealed Pungs', 10, tr('Four pungs, none of them claimed'))],
      },
    ],
  };
}

/** The guide for the table being played (house rules applied). */
const DEFAULT_UNIT: Record<string, string> = { riichi: 'han', taiwanese: 'tai', mcr: 'fan', sichuan: 'fan', korean3: 'pt' };

export function guideFor(p: RuleProfile): Guide {
  const fam = family(p);
  const key = p.scoreUnit ?? DEFAULT_UNIT[fam] ?? 'faan';
  const unit = tr(key);
  if (p.specialRound && !p.guide) return specialRoundGuide(p, unit);
  if (p.guide) {
    const g = p.guide;
    const own: Guide = { unit, win: g.win.map((w) => tr(w)), pay: g.pay ? tr(g.pay) : '', sections: g.sections.map((x) => ({ title: tr(x.title), closed: x.closed, lines: x.lines.map(([n, v, how]) => L(n, v, tr(how))) })) };
    if (!g.extend) return own;
    const fam = guideFor({ ...p, guide: undefined });
    return { ...fam, win: [...fam.win, ...own.win], pay: own.pay ? `${fam.pay} ${own.pay}` : fam.pay, sections: [...fam.sections, ...own.sections] };
  }
  if (p.card) return { unit: tr('points'), win: [tr('Match one hand on the card exactly, using the tiles in the pattern’s colours and numbers.'), tr('Jokers may fill any pung, kong or larger group, never a single or a pair.'), tr('Hands marked C must be concealed: you may only claim the tile that finishes them.'), tr('Every hand on the card, with how close you are to each, is under the Card button.')], pay: tr('The discarder pays double the hand’s value and the others pay its value; a self-draw is paid double by everyone.'), sections: [], card: 'american' };
  if (fam === 'taiwanese' && p.houseChoices?.scoring === 'dubai') return { unit: tr('pts'), win: winLines(p, tr('pts')), pay: tr('Every line you make is added up. Self-drawn wins are paid by everyone, a discard by the player who threw it. '), sections: [], card: 'dubai' };
  if (fam === 'riichi') return riichiGuide(p, unit);
  if (fam === 'taiwanese') return taiwaneseGuide(p, unit);
  if (fam === 'singapore') return singaporeGuide(p, unit);
  if (fam === 'vietnamese') return vietnameseGuide(p, unit);
  if (fam === 'mcr') return mcrGuide(p, unit);
  if (fam === 'sichuan') return sichuanGuide(p, unit);
  if (fam === 'korean3') return koreanGuide(p, unit);
  return classicGuide(p, unit);
}

/**
 * Tile pictures for the lines where one helps, keyed by the line's name.
 * Sets are split by "|", tiles written as parseKinds reads them.
 */
const PICS: [string[], string][] = [
  [['All Chows', 'All chows', 'Ping Hu', 'Pinfu', 'All chows (Ù phình)'], '123m|456p|234s|678s|55p'],
  [['All Pungs', 'All pungs', 'Pong Pong', 'Toitoi', 'All pungs (Ù tui tui)'], '222m|777p|999s|NNN|55s'],
  [['Seven Pairs', 'Chiitoitsu'], '11m|44m|77p|99p|22s|55s|EE'],
  [['Seven Shifted Pairs'], '11p|22p|33p|44p|55p|66p|77p'],
  [[LI_GU_NAME], '11m|22m|33p|44p|55s|66s|EE|999p'],
  [['Half Flush', 'Half flush', 'Mixed One Suit', 'Half colour', 'Honitsu'], '123s|456s|999s|EEE|GdGd'],
  [['Full Flush', 'Full flush', 'Pure One Suit', 'Full colour', 'Chinitsu', 'Pure Suit', 'Full flush (Mủn cun)'], '123p|345p|678p|999p|22p'],
  [['Mixed Terminals', 'Honroutou', 'Terminals and Honours'], '111m|999p|111s|NNN|WdWd'],
  [['All Simples', 'Tanyao'], '234m|567p|345s|678s|22p'],
  [['Chanta'], '123m|789p|789s|EEE|99m'],
  [['Junchan', 'Terminals in every set'], '123m|789p|111s|999s|99m'],
  [['Pure 2-5-8'], '222m|555p|888s|555s|22p'],
  [['Dragon pung', 'Dragon Pung', 'Yakuhai'], 'RdRdRd'],
  [['Seat wind pung'], 'SSS'],
  [['Round wind pung', 'Prevailing wind pung'], 'EEE'],
  [['Small Three Dragons', 'Small three dragons', 'Shousangen', 'Small three dragons (Tiểu tam nguyên)'], 'RdRdRd|GdGdGd|WdWd'],
  [['Big Three Dragons', 'Big three dragons', 'Great Three Dragons', 'Daisangen', 'Big three dragons (Đại tam nguyên)'], 'RdRdRd|GdGdGd|WdWdWd'],
  [['Small Four Winds', 'Small four winds', 'Shousuushii', 'Small four winds (Tiểu tứ hỷ)'], 'EEE|SSS|WWW|NN'],
  [['Big Four Winds', 'Big four winds', 'Great Four Winds', 'Daisuushii', 'Big four winds (Đại tứ hỷ)'], 'EEE|SSS|WWW|NNN'],
  [['Thirteen Orphans', 'Thirteen Wonders', 'Kokushi Musou'], '19m|19p|19s|ESWN|RdGdWd|1m'],
  [['All Honours', 'All honours', 'Tsuuiisou', 'All honours (Toàn chữ)'], 'EEE|SSS|NNN|RdRdRd|GdGd'],
  [['All Terminals', 'Chinroutou'], '111m|999m|111p|999s|11s'],
  [['Four Concealed Pungs', 'Suuankou'], '111m|444p|777s|WWW|55m'],
  [['Three concealed pungs', 'Three Concealed Pungs', 'Sanankou'], '222m|555p|888s'],
  [['Four Kongs', 'Suukantsu'], '1111m|5555p|8888s|EEEE'],
  [['Sankantsu'], '1111m|5555p|8888s'],
  [['Root (four of a kind)'], '5555m'],
  [['Nine Gates', 'Chuuren Poutou'], '111m|2345678m|999m'],
  [['Ryuuiisou'], '234s|666s|888s|GdGdGd|22s'],
  [[MIXED_NAMES.tripleChow, 'Sanshoku Doujun'], '123m|123p|123s'],
  [[MIXED_NAMES.shiftedChows], '123m|234p|345s'],
  [[MIXED_NAMES.triplePung, 'Triple Pung', 'Sanshoku Doukou'], '555m|555p|555s'],
  [[MIXED_NAMES.shiftedPungs], '444m|555p|666s'],
  [[MIXED_NAMES.triplePair], '22m|22p|22s'],
  [['Mixed Double Chow'], '456m|456p'],
  [['Double Pung'], '777m|777s'],
  [['Mixed Straight'], '123m|456p|789s'],
  [['Pure Double Chow', 'Iipeikou'], '345p|345p'],
  [['Ryanpeikou'], '345p|345p|678s|678s'],
  [['Short Straight'], '123s|456s'],
  [['Two Terminal Chows'], '123m|789m'],
  [['Pure Straight', 'Ittsu'], '123p|456p|789p'],
  [['Pure Shifted Chows'], '123s|234s|345s'],
  [['Pure Triple Chow'], '234m|234m|234m'],
  [['Pure Shifted Pungs'], '333p|444p|555p'],
  [['All Types'], '123m|456p|789s|EEE|RdRd'],
  [['Seat flower', 'Seat flower (Hoa vị trí)'], 'F1|F5'],
  [['All four plants'], 'F1 F2 F3 F4'],
  [['Eight flowers'], 'F1 F2 F3 F4|F5 F6 F7 F8'],
  [['Cat'], 'Cat Mse Rst Cpd'],
  [['Mixed pung'], '5m 5p 5s'],
  [['Mixed chow'], '3m 4p 5s'],
  [['Knit pair'], '7p 7s'],
  [['Passport (5)'], 'ESWNRd'],
  [['Passport (6)'], 'ESWNRdGd'],
  [['Passport (9)'], '123456789m'],
  [['Double Passport (5 + 6)'], 'ESWNRd|ESWNGdWd'],
  [['Double Passport (6 + 6)'], 'ESWNRdGd|SWNRdGdWd'],
  [['Double Passport (9 + 5)'], '123456789m|ESWNRd'],
  ...[...SMALL_CARD, ...BIG_CARD].filter((c) => !['Seven Pairs', 'Half Flush', 'Full Flush', 'Small Three Dragons', 'Small Four Winds', 'Four Concealed Pungs', 'Thirteen Orphans'].includes(c.name)).map((c): [string[], string] => [[c.name], c.picture]),
  [['Flower Joker'], 'JF'],
];
const PIC_BY_NAME = new Map(PICS.flatMap(([names, spec]) => names.map((n) => [n, spec] as const)));

/** The tile picture for a line, as sets of tile notation, or undefined. */
export const pictureFor = (name: string): string[] | undefined => PIC_BY_NAME.get(name)?.split('|');

/** The parts of a winning hand, as drawn at the top of the guide. */
export function anatomy(p: RuleProfile): { kind: 'chow' | 'pung' | 'kong' | 'pair'; tiles: string }[] {
  const sets = [
    { kind: 'chow' as const, tiles: '123m' },
    { kind: 'pung' as const, tiles: '555p' },
    { kind: 'kong' as const, tiles: 'EEEE' },
    { kind: 'chow' as const, tiles: '678s' },
    { kind: 'pung' as const, tiles: '999m' },
  ].slice(0, p.shapes.sets ?? 4);
  return [...sets, { kind: 'pair', tiles: 'RdRd' }];
}

/** The special winning shapes this table allows, with a picture each. */
export function specialShapes(p: RuleProfile): { name: string; tiles: string[] }[] {
  const out: { name: string; tiles: string[] }[] = [];
  if (p.shapes.sevenPairs) out.push({ name: tr('Seven pairs'), tiles: pictureFor('Seven Pairs')! });
  if (p.shapes.thirteenOrphans || p.shapes.special?.some((s) => s.name === 'orphans13')) out.push({ name: tr('Thirteen orphans'), tiles: pictureFor('Thirteen Orphans')! });
  if (p.shapes.special?.some((s) => s.name === 'liGu' || s.name === 'nicoNico')) out.push({ name: p.shapes.special.some((s) => s.name === 'liGu') ? 'Lì Gǔ Lì Gǔ' : 'Nico Nico', tiles: pictureFor(LI_GU_NAME)! });
  return out;
}
