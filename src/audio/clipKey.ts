// A stable key for a narration line, shared by the recording script and the player.
export function clipKey(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
