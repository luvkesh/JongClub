import { describe, expect, it } from 'vitest';
import { tableFor } from '../src/ui/screens/tables';

describe('starting tables', () => {
  it('tournament Riichi starts as East and South, as its rules and lesson say', () => {
    expect(tableFor('riichi-tournament').length).toBe('eastSouth');
    expect(tableFor('riichi').length).toBe('eastSouth');
    expect(tableFor('sanma').length).toBe('eastSouth');
    expect(tableFor('mcr').length).toBe('eastRound');
  });
});
