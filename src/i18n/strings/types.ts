// Row types for the string tables (see ./index.ts).

export type Forms = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };
export type Cell = string | Forms;
export type Row = [string | [string, string], Cell, Cell, Cell, Cell, Cell];
