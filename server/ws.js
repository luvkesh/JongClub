// A small RFC 6455 WebSocket server side: the opening handshake and framing
// (text, ping/pong, close, fragmented messages). Clients must mask frames;
// the server never does. Binary frames are refused: the protocol is JSON.

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** Largest message accepted from a client (presence is capped well below this). */
export const MAX_MESSAGE = 64 * 1024;

/** Answer an HTTP upgrade request. Returns a WsConn, or null after refusing the request. */
export function acceptWebSocket(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  const upgrade = String(req.headers.upgrade ?? '').toLowerCase();
  if (upgrade !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'));
  socket.setNoDelay(true);
  const ws = new WsConn(socket);
  if (head?.length) ws.feed(head);
  return ws;
}

/** Encode one unmasked server frame. */
export function frame(opcode, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.alloc(2) : len < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (len < 126) head[1] = len;
  else if (len < 65536) {
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([head, payload]);
}

export class WsConn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.parts = [];
    this.partsLen = 0;
    this.closed = false;
    socket.on('data', (d) => this.feed(d));
    socket.on('close', () => this.finish(1006));
    socket.on('error', () => this.finish(1006));
  }

  send(text) {
    if (this.closed) return;
    this.socket.write(frame(0x1, Buffer.from(text, 'utf8')));
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const r = Buffer.from(reason, 'utf8').subarray(0, 120);
    const p = Buffer.alloc(2 + r.length);
    p.writeUInt16BE(code, 0);
    r.copy(p, 2);
    this.socket.write(frame(0x8, p));
    this.socket.end();
    this.finish(code);
  }

  finish(code) {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroySoon?.();
    this.emit('close', code);
  }

  feed(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (!this.closed) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        const big = b.readBigUInt64BE(2);
        if (big > BigInt(MAX_MESSAGE)) return this.close(1009, 'too big');
        len = Number(big);
        off = 10;
      }
      if (!masked) return this.close(1002, 'unmasked frame');
      if (len > MAX_MESSAGE) return this.close(1009, 'too big');
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      this.onFrame(fin, opcode, payload);
    }
  }

  onFrame(fin, opcode, payload) {
    if (opcode >= 0x8) {
      // Control frames: never fragmented, at most 125 bytes.
      if (!fin || payload.length > 125) return this.close(1002, 'bad control frame');
      if (opcode === 0x8) return this.close(payload.length >= 2 ? payload.readUInt16BE(0) : 1000);
      if (opcode === 0x9) return void this.socket.write(frame(0xa, payload));
      if (opcode === 0xa) return void this.emit('pong');
      return this.close(1002, 'unknown opcode');
    }
    if (opcode === 0x2) return this.close(1003, 'text only');
    if (opcode === 0x1) {
      if (this.parts.length) return this.close(1002, 'interleaved message');
    } else if (opcode !== 0x0 || !this.parts.length) return this.close(1002, 'bad continuation');
    this.parts.push(payload);
    this.partsLen += payload.length;
    if (this.partsLen > MAX_MESSAGE) return this.close(1009, 'too big');
    if (!fin) return;
    const msg = Buffer.concat(this.parts).toString('utf8');
    this.parts = [];
    this.partsLen = 0;
    this.emit('message', msg);
  }
}
