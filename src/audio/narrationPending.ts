// Narration lines written but not yet recorded in Mei's voice. Until a clip
// exists, the line shows as a caption only (voice.ts never stands in another
// voice for Mei, unless the player chose a device voice in Settings, which
// then reads it). Re-run scripts/record-narration.py, then remove the lines
// it recorded: test/narration.test.ts keeps this list exact.

export const PENDING_NARRATION: string[] = [];
