// Icons for the mini-game HUD: the tool bar (Hint, Undo, Shuffle, Dimensions'
// turns, Reset view) and the top bar (How to play, New board).

export const TOOL_ICONS = {
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  view: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9M12 17.3h.01"/>',
  restart: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  turnL: '<path d="M8 8 4 12l4 4"/><path d="M4 12h11a5 5 0 0 1 5 5"/>',
  turnR: '<path d="m16 8 4 4-4 4"/><path d="M20 12H9a5 5 0 0 0-5 5"/>',
};

export type ToolIcon = keyof typeof TOOL_ICONS;

/**
 * Icons whose arrow points back along the reading direction: mirrored in right-to-left
 * languages (i18n/rtl.css, .ico-dir), as the app's forward arrows are (.ico-fwd). Dimensions'
 * Turn left and Turn right stay as drawn: they turn the cube that way on screen, whatever the
 * language. The circular arrows (Reset view, New board) are not about reading direction.
 */
export const MIRROR_IN_RTL: ReadonlySet<ToolIcon> = new Set<ToolIcon>(['undo']);

export const toolSvg = (id: ToolIcon) =>
  `<svg${MIRROR_IN_RTL.has(id) ? ' class="ico-dir"' : ''} viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOOL_ICONS[id]}</svg>`;
