import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetActiveManagerForTests,
  getActiveManager,
  parseConcurrencyCap,
  reserveRun,
  type RunRequest,
} from './execution-manager';

const RUN_REQUEST: RunRequest = {
  run_id: 123,
  executions: [
    {
      execution_id: 1,
      run_id: 123,
      persona_id: 'confident_desktop',
      browser: 'chromium',
      flow_name: 'registration',
      base_url: 'https://example.test',
      callback_token: 'token',
      callback_url: 'http://dashboard/callback',
    },
  ],
};

describe('execution-manager', () => {
  afterEach(() => {
    __resetActiveManagerForTests();
  });

  it('clamps invalid concurrency caps to the default', () => {
    expect(parseConcurrencyCap(undefined)).toBe(4);
    expect(parseConcurrencyCap('abc')).toBe(4);
    expect(parseConcurrencyCap('0')).toBe(4);
    expect(parseConcurrencyCap('-2')).toBe(4);
  });

  it('accepts positive integer concurrency caps', () => {
    expect(parseConcurrencyCap('1')).toBe(1);
    expect(parseConcurrencyCap('8')).toBe(8);
  });

  it('reserves the active run synchronously before asynchronous execution starts', () => {
    const manager = reserveRun(RUN_REQUEST, 'corr-1');

    expect(getActiveManager()).toBe(manager);
    expect(manager.getRunId()).toBe(123);
    expect(() => reserveRun({ ...RUN_REQUEST, run_id: 456 }, 'corr-2')).toThrow('A run is already in progress');
  });
});
