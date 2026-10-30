// Keeps drawn tile faces on the device (IndexedDB), so a later visit starts
// with every face already at full detail instead of drawing them again.
// Faces are stored losslessly (PNG) per build, tile set, detail, labels and
// accessibility options; entries from other builds or other sets are dropped.

declare const __BUILD_ID__: string | undefined;

const DB = 'jongclub-faces';
const STORE = 'faces';
/** Faces from another build may be drawn differently: they are never reused. */
export const FACE_STORE_VERSION = `${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}.4`;

let dbP: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  dbP ??= new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbP;
}

export interface StoredFace {
  face: Blob;
  foil?: Blob;
  /** The face's relief for the 3D bump map (tileFaces.ts). */
  relief?: Blob;
}

/** Every stored face under `prefix` (one set at one detail), keyed by the rest of its key. */
export async function loadFaces(prefix: string): Promise<Map<string, StoredFace>> {
  const out = new Map<string, StoredFace>();
  const db = await open();
  if (!db) return out;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const range = IDBKeyRange.bound(prefix, prefix + '￿');
      const req = tx.objectStore(STORE).openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve(out);
        out.set(String(cur.key).slice(prefix.length), cur.value as StoredFace);
        cur.continue();
      };
      req.onerror = () => resolve(out);
    } catch {
      resolve(out);
    }
  });
}

/** Stores one face; the first save under a new prefix clears every other prefix (one set kept per device). */
export async function saveFace(prefix: string, rest: string, face: StoredFace) {
  const db = await open();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const os = tx.objectStore(STORE);
    if (!kept.has(prefix)) {
      kept.add(prefix);
      // Drop faces of other builds and other sets (they can be tens of MB each).
      const all = os.openCursor();
      all.onsuccess = () => {
        const cur = all.result;
        if (!cur) return;
        const k = String(cur.key);
        if (![...kept].some((p) => k.startsWith(p))) cur.delete();
        cur.continue();
      };
    }
    os.put(face, prefix + rest);
  } catch {
    /* storage full or unavailable: faces are simply drawn next time */
  }
}
const kept = new Set<string>();

/** Decode a stored image into a canvas (canvases, unlike bitmaps, upload the right way up in three.js). */
export async function blobCanvas(b: Blob): Promise<HTMLCanvasElement | null> {
  try {
    const bmp = await createImageBitmap(b);
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    bmp.close();
    return c;
  } catch {
    return null;
  }
}

// PNG encoding runs in a small worker so storing faces never costs the table a frame.
const WORKER = [
  "self.addEventListener('message', async (e) => {",
  '  const { id, bmp } = e.data;',
  '  let blob = null;',
  '  try {',
  '    const c = new OffscreenCanvas(bmp.width, bmp.height);',
  "    c.getContext('2d').drawImage(bmp, 0, 0);",
  '    bmp.close();',
  "    blob = await c.convertToBlob({ type: 'image/png' });",
  '  } catch (_) {}',
  '  self.postMessage({ id, blob });',
  '});',
].join('\n');
let worker: Worker | null | undefined;
const pending = new Map<number, (b: Blob | null) => void>();
let seq = 0;

function encoder(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') throw 0;
    const w = new Worker(URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' })));
    w.onmessage = (e: MessageEvent<{ id: number; blob: Blob | null }>) => {
      pending.get(e.data.id)?.(e.data.blob);
      pending.delete(e.data.id);
    };
    w.onerror = () => {
      worker = null;
      for (const r of pending.values()) r(null);
      pending.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** A lossless PNG of the canvas; in a worker when the browser allows, else on the page. */
export async function encodePng(c: HTMLCanvasElement): Promise<Blob | null> {
  const w = encoder();
  if (w) {
    try {
      const bmp = await createImageBitmap(c);
      const blob = await new Promise<Blob | null>((r) => {
        const id = ++seq;
        pending.set(id, r);
        w.postMessage({ id, bmp }, [bmp]);
      });
      if (blob) return blob;
    } catch {
      /* fall back below */
    }
  }
  return new Promise((r) => c.toBlob(r, 'image/png'));
}
