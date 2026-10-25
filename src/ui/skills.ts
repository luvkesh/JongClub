// Profile: skill ratings beyond win rate, per variation. Efficiency, defence,
// speed to ready and call rate, each with a trend over recent games and a
// "Practise this" link to the matching daily drill.

import { VARIATIONS } from '../engine/rules';
import type { DrillType } from '../learn/drillGen';
import { SKILLS, SKILL_LABEL, loadSkills, summarise, weakest, type SkillId, type SkillSummary } from '../progression/skills';
import type { AppCtx } from './ctx';
import { h } from './dom';
import { openDrills } from './drills';
import './skills.css';
import { tr, trn } from '../i18n';

/** The drill that trains each skill. */
export const SKILL_DRILL: Record<SkillId, DrillType> = { efficiency: 'discard', defence: 'safe', speed: 'wait', calls: 'value' };

const NOTE: Record<SkillId, string> = {
  efficiency: tr('Discards that matched the most efficient one'),
  defence: tr('Deal-ins once someone was ready. Lower is better'),
  speed: tr('Your turns until one tile from winning'),
  calls: tr('Hands where you called a set'),
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

function shown(id: SkillId, v: number | null): string {
  if (v === null) return '—';
  return id === 'speed' ? tr('{n} turns', { n: v.toFixed(1) }) : pct(v);
}

/** A small trend line: oldest game on the left. */
export function trendSvg(values: number[], label: string): HTMLElement {
  if (values.length < 2) return h('span', { class: 'sk-trend none' }, values.length ? tr('Trend after 2 games') : '');
  const w = 96;
  const ht = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(ht - 2 - ((v - min) / span) * (ht - 4)).toFixed(1)}`).join(' ');
  const last = pts.split(' ').pop()!.split(',');
  return h('span', {
    class: 'sk-trend',
    html: `<svg viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}" role="img" aria-label="${label}"><polyline fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${pts}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="currentColor"/></svg>`,
  });
}

function variationCard(ctx: AppCtx, s: SkillSummary): HTMLElement {
  const v = VARIATIONS.find((x) => x.id === s.variation);
  // Efficiency over every game counts all your games of this variation (profile analytics).
  const vs = ctx.profile.varStats[s.variation];
  const value = { ...s.value, efficiency: vs?.decisions ? vs.good / vs.decisions : s.value.efficiency };
  const weak = weakest({ ...s, value });
  return h(
    'article',
    { class: 'sk-var' },
    h('header', { class: 'sk-head' }, h('h4', {}, `${v?.flag ?? ''} ${v?.short ?? s.variation}`), h('span', { class: 'muted small' }, trn(s.games, '{n} game measured', '{n} games measured'))),
    h(
      'div',
      { class: 'sk-grid' },
      ...SKILLS.map((id) =>
        h(
          'div',
          { class: `sk-metric ${weak === id ? 'weak' : ''}` },
          h('span', { class: 'k' }, SKILL_LABEL[id], weak === id ? h('span', { class: 'sk-tag' }, tr('Work on this')) : null),
          h('span', { class: 'v' }, shown(id, value[id])),
          h('span', { class: 'sk-note' }, NOTE[id]),
          trendSvg(s.trend[id], tr('{skill} over your last {n} games', { skill: SKILL_LABEL[id], n: s.trend[id].length })),
          h('button', { class: 'link sk-practise', onclick: () => openDrills(ctx, { focus: SKILL_DRILL[id] }) }, tr('Practise this ›')),
        ),
      ),
    ),
  );
}

/** The Profile section. */
export function skillsSection(ctx: AppCtx): HTMLElement {
  const sums = summarise(loadSkills()).filter((s) => VARIATIONS.some((v) => v.id === s.variation));
  return h(
    'section',
    { class: 'section skills' },
    h('h3', {}, tr('Skills')),
    sums.length
      ? h('div', { class: 'sk-list' }, ...sums.slice(0, 6).map((s) => variationCard(ctx, s)))
      : h('p', { class: 'muted' }, tr('Finish a game to see your efficiency, defence, speed to ready and call rate, with a trend over recent games.')),
  );
}
