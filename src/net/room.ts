// Thin, typed access to the artifact runtime's `room` and `user`
// capabilities. When a JongClub server is configured (src/net/api.ts) the
// same interfaces run against it instead (src/net/cloud.ts). Anywhere else
// (a saved file, a dev server) these resolve to null and multiplayer simply
// stays hidden.

import { serverUrl } from './api';
import { cloudLobby, cloudUser } from './cloud';
import type { Db } from './dbroom';

export interface RoomSender {
  peer: string;
  by: string | null;
  isMe: boolean;
  sameTab: boolean;
  kind: 'viewer' | 'agent';
  guest: boolean;
}

export interface RoomPeer extends RoomSender {
  presence: Readonly<Record<string, unknown>>;
  updatedAt: number;
}

export interface PeersChange {
  peers: readonly RoomPeer[];
  joined: readonly RoomPeer[];
  left: readonly RoomPeer[];
  updated: readonly RoomPeer[];
}

export interface RoomLike {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly RoomPeer[];
  onPeers(fn: (c: PeersChange) => void, onError?: (e: { code: string; message: string }) => void): () => void;
  connected(): boolean;
}

export interface NamedRoom extends RoomLike {
  readonly name: string;
  leave(): Promise<void>;
}

export interface LobbyRoom extends RoomLike {
  join(name: string): Promise<NamedRoom>;
}

export interface UserApi {
  id(): Promise<string>;
  isOwner(): boolean;
}

interface ClaudeRuntime {
  use(name: string): Promise<unknown>;
}

export const runtime = (): ClaudeRuntime | null => {
  const c = (globalThis as { claude?: ClaudeRuntime }).claude;
  return c && typeof c.use === 'function' ? c : null;
};

let roomP: Promise<LobbyRoom | null> | null = null;

/** The lobby room (everyone viewing JongClub right now), or null. */
export function lobbyRoom(): Promise<LobbyRoom | null> {
  if (!roomP) {
    const c = runtime();
    roomP = serverUrl()
      ? cloudLobby()
      : c ? (c.use('room') as Promise<LobbyRoom | null>).catch(() => null) : Promise.resolve(null);
  }
  return roomP;
}

let dbP: Promise<Db | null> | null = null;

/** The page's shared store (live tables keep a saved copy there, see dbroom.ts), or null. */
export function liveDb(): Promise<Db | null> {
  if (!dbP) {
    const c = runtime();
    dbP = !serverUrl() && c ? (c.use('db') as Promise<Db | null>).then((d) => d ?? null, () => null) : Promise.resolve(null);
  }
  return dbP;
}

let userP: Promise<UserApi | null> | null = null;

export function userApi(): Promise<UserApi | null> {
  if (!userP) {
    const c = runtime();
    userP = serverUrl()
      ? Promise.resolve(cloudUser())
      : c ? (c.use('user') as Promise<UserApi | null>).catch(() => null) : Promise.resolve(null);
  }
  return userP;
}

/** This tab's own peer label in a room (null until the platform answers). */
export function myPeer(room: RoomLike): string | null {
  return room.peers().find((p) => p.isMe && p.sameTab)?.peer ?? null;
}

/** A short table code people can read out: no 0/o or 1/l. */
export function newTableCode(): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
