// Words that reach tr() through a variable rather than a literal at the call
// site, and that no data table lists: score units from the rule profiles and
// the Charleston directions. test/i18n.test.ts checks every language has them,
// along with the data-driven ones it reads itself (call names, house rules,
// match formats, regions and so on).

export const DYNAMIC_KEYS = [
  // Score units (RuleProfile.scoreUnit and each score's unit).
  'faan',
  'fan',
  'han',
  'phán',
  'tai',
  'pt',
  'pts',
  'points',
  // Charleston directions (engine/game.ts charlestonDirName).
  'right',
  'across',
  'left',
  // The win cinematic's names (render/cinematic.ts signatureName).
  'Yakuman',
  'Counted Yakuman',
  'Limit hand',
  'Maximum tai',
  // JongBot's target hands, named by the planners in English (ai/adviceText.ts planName and planNote).
  'Tanyao (all simples)',
  'Toitoi (all pungs)',
  'Chiitoitsu (seven pairs)',
  '1s and 9s',
  'Three Dragons',
  'Concealed Mahjong adds 3 doubles while nothing is exposed.',
];

