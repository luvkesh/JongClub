// Types for server/app.js, so tests in test/ can start the server.

export interface ServerStore {
  kind: string;
  get(coll: string, id: string): any;
  put(coll: string, id: string, doc: unknown): void;
  del(coll: string, id: string): void;
  list(coll: string): any[];
  close(): void;
}

export interface RunningServer {
  port: number;
  url: string;
  store: ServerStore;
  close(): Promise<void>;
}

export function startServer(opts?: { port?: number; host?: string; env?: Record<string, string>; store?: ServerStore; fetch?: (url: string) => Promise<Response> }): Promise<RunningServer>;
export function weekOf(date?: Date): string;
export const LEAGUE_POINTS: number[];
export function leagueTable(results: { uid: string; name: string; week: string; place: number }[], week: string): { uid: string; name: string; games: number; wins: number; points: number }[];
