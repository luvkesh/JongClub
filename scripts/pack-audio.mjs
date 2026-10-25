// Packs the embedded audio into sidecar files for the Artifact build:
// dist-artifact/audio/<name>.json ({ parts, index: key -> [part, offset, length] }) and <name>-<part>.mp3.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Each .mp3 part stays under 12 MB (the host serves files up to 15 MB).
const PART = 12 * 1024 * 1024;

function pack(name, entries) {
  const index = {};
  const parts = [[]];
  let at = 0;
  let total = 0;
  for (const [key, url] of entries) {
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (at + bytes.length > PART && at > 0) {
      parts.push([]);
      at = 0;
    }
    index[key] = [parts.length - 1, at, bytes.length];
    parts[parts.length - 1].push(bytes);
    at += bytes.length;
    total += bytes.length;
  }
  mkdirSync('dist-artifact/audio', { recursive: true });
  writeFileSync(`dist-artifact/audio/${name}.json`, JSON.stringify({ parts: parts.length, index }));
  parts.forEach((p, i) => writeFileSync(`dist-artifact/audio/${name}-${i}.mp3`, Buffer.concat(p)));
  console.log(`audio/${name}: ${entries.length} clips in ${parts.length} part(s), ${(total / 1024) | 0} KB`);
}

const narr = readFileSync('src/audio/narration.gen.ts', 'utf8');
pack('narration', [...narr.matchAll(/"([0-9a-z]+)": '(data:audio\/mpeg;base64,[^']+)'/g)].map((m) => [m[1], m[2]]));

// Mei's Atelier pitches, fetched only when an item's View pop-over opens.
const pitch = readFileSync('src/audio/pitch.gen.ts', 'utf8');
pack('pitch', [...pitch.matchAll(/"([0-9a-z]+)": '(data:audio\/mpeg;base64,[^']+)'/g)].map((m) => [m[1], m[2]]));

const callers = readFileSync('src/audio/callers.gen.ts', 'utf8');
const voices = JSON.parse(callers.slice(callers.indexOf('= [') + 2, callers.lastIndexOf(';')));
pack('callers', voices.flatMap((v) => Object.entries(v.clips).map(([p, url]) => [`${v.id}|${p}`, url])));
