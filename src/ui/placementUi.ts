// Tournament placement scoring in the UI: the table option in the lobby's
// Format step, the results column, and the tournament screen's choice.
// The rules themselves live in src/club/placement.ts.

import { TOURNAMENT_SCORING, UMA_KEY, UMA_PRESETS, formatPlacement } from '../club/placement';
import type { TournamentScoring } from '../club/tournament';
import './placementUi.css';
import { h } from './dom';
import { tr } from '../i18n';

/** Lobby: "Final score" or "Placement points", plus the uma when placement is on. */
export function placementField(houseRules: Record<string, string>, players: number): HTMLElement {
  const wrap = h('div', { class: 'ts-scoring' });
  const draw = () => {
    const on = houseRules[TOURNAMENT_SCORING] === 'on';
    const pick = (value: boolean, label: string, title: string) => {
      const b = h('button', { type: 'button', class: on === value ? 'on' : '', 'aria-pressed': String(on === value), title }, label);
      b.onclick = () => {
        if (value) houseRules[TOURNAMENT_SCORING] = 'on';
        else delete houseRules[TOURNAMENT_SCORING];
        draw();
      };
      return b;
    };
    const uma = h('select', { 'aria-label': tr('Placement bonus (uma)') }) as HTMLSelectElement;
    for (const p of UMA_PRESETS) {
      const label = players === 3 ? p.label.replace(/ \/ [^/]+ \/ [^/]+ \//, ' / 0 /') : p.label;
      uma.append(h('option', { value: p.value, selected: (houseRules[UMA_KEY] ?? '15') === p.value }, label));
    }
    uma.onchange = () => (houseRules[UMA_KEY] = uma.value);
    wrap.replaceChildren(
      h('div', { class: 'seg', role: 'group', 'aria-label': tr('Match scoring') }, pick(false, tr('Final score'), tr('The highest score wins the match')), pick(true, tr('Tournament scoring'), tr('Placement points: a bonus by place plus the score difference'))),
      on ? h('label', { class: 'ts-uma' }, tr('Placement bonus '), uma) : '',
      h('p', { class: 'ts-note' }, on ? tr('Placement points: a bonus for your place plus your score difference in thousands (hundreds at smaller-stake tables), as in league and tournament play.') : tr('The highest score at the end wins.')),
    );
  };
  draw();
  return wrap;
}

/** Results: the placement points next to a final score. */
export const placementCell = (p: number) => h('span', { class: 'num placement-pts', title: tr('Placement points') }, formatPlacement(p));

const PREF_KEY = 'jongclub.tournamentScoring.v1';

/** The tournament scoring this viewer last chose (a per-viewer convenience). */
export function tournamentScoringPref(): TournamentScoring {
  try {
    return localStorage.getItem(PREF_KEY) === 'placement' ? 'placement' : 'standings';
  } catch {
    return 'standings';
  }
}

export function setTournamentScoringPref(v: TournamentScoring) {
  try {
    localStorage.setItem(PREF_KEY, v);
  } catch {
    /* ignore */
  }
}

/** A standings row's points: 4/2/1/0 totals, or placement points with a sign. */
export const pointsText = (scoring: TournamentScoring | undefined, points: number) => (scoring === 'placement' ? formatPlacement(points) : String(points));
