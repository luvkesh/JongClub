// Imported first by scripts that reuse fuzz-invariants.ts helpers, so that its own
// command-line run does not start (vite-node hides the script path from argv).
(globalThis as { __fuzzLib?: boolean }).__fuzzLib = true;
export {};
