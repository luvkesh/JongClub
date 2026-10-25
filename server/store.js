// Storage behind a tiny document interface: named collections of JSON
// documents by id. SQLite (node:sqlite, built into Node 22) when the runtime
// has it, otherwise one JSON file on disk, or memory only for tests.
//
// A Postgres store only needs the same methods:
//   get(coll, id) -> doc | null     put(coll, id, doc)     del(coll, id)
//   list(coll) -> doc[]             close()                kind
// e.g. one table `docs(coll text, id text, doc jsonb, primary key (coll, id))`.

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

/** Memory only (tests, or JONGCLUB_STORE=memory). */
export function memoryStore() {
  const data = new Map();
  const coll = (c) => {
    let m = data.get(c);
    if (!m) data.set(c, (m = new Map()));
    return m;
  };
  const copy = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
  return {
    kind: 'memory',
    data,
    get: (c, id) => copy(coll(c).get(id)),
    put: (c, id, doc) => void coll(c).set(id, copy(doc)),
    del: (c, id) => void coll(c).delete(id),
    list: (c) => [...coll(c).values()].map(copy),
    close() {},
  };
}

/** One JSON file, rewritten atomically (temp file + rename) shortly after each change. */
export function jsonStore(file) {
  const mem = memoryStore();
  if (existsSync(file)) {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    for (const [c, docs] of Object.entries(raw)) for (const [id, doc] of Object.entries(docs)) mem.put(c, id, doc);
  }
  let timer = null;
  const flush = () => {
    timer = null;
    const out = {};
    for (const [c, m] of mem.data) out[c] = Object.fromEntries(m);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, JSON.stringify(out));
    renameSync(`${file}.tmp`, file);
  };
  const later = () => (timer ??= setTimeout(flush, 200));
  return {
    kind: 'json',
    get: mem.get,
    put: (c, id, doc) => (mem.put(c, id, doc), later()),
    del: (c, id) => (mem.del(c, id), later()),
    list: mem.list,
    close() {
      if (timer) clearTimeout(timer);
      flush();
    },
  };
}

/** SQLite through node:sqlite, or null when this Node doesn't have it. */
export function sqliteStore(file) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch {
    return null;
  }
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('create table if not exists docs (coll text not null, id text not null, doc text not null, primary key (coll, id))');
  const get = db.prepare('select doc from docs where coll = ? and id = ?');
  const put = db.prepare('insert into docs (coll, id, doc) values (?, ?, ?) on conflict (coll, id) do update set doc = excluded.doc');
  const del = db.prepare('delete from docs where coll = ? and id = ?');
  const list = db.prepare('select doc from docs where coll = ?');
  return {
    kind: 'sqlite',
    get: (c, id) => {
      const r = get.get(c, id);
      return r ? JSON.parse(r.doc) : null;
    },
    put: (c, id, doc) => void put.run(c, id, JSON.stringify(doc)),
    del: (c, id) => void del.run(c, id),
    list: (c) => list.all(c).map((r) => JSON.parse(r.doc)),
    close: () => db.close(),
  };
}

/**
 * Pick a store: `kind` is 'sqlite' (default, falls back to JSON), 'json' or 'memory'.
 * `path` is a file path without extension; '.sqlite' or '.json' is added.
 */
export function openStore(kind = 'sqlite', path = './data/jongclub') {
  if (kind === 'memory') return memoryStore();
  if (kind !== 'json') {
    const s = sqliteStore(path === ':memory:' ? path : `${path}.sqlite`);
    if (s) return s;
  }
  return path === ':memory:' ? memoryStore() : jsonStore(`${path}.json`);
}
