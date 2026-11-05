import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  workDurationMs,
  workTotalMs,
  workDayStart,
  formatWorkDuration,
  exportReport,
} from '../src/lib/domain.ts';
import type { WorkSession } from '../src/types.ts';
import { createWorkspaceFixture } from './fixtures/workspace.ts';
const session = (start: string, end: string | null): WorkSession => ({
  id: start,
  org_id: 'org',
  user_id: 'maya',
  started_at: start,
  ended_at: end,
});
test('time totals clip overnight sessions, breaks and active clocks to the selected period', () => {
  const from = Date.parse('2026-11-05T00:00:00Z'),
    to = Date.parse('2026-11-05T03:00:00Z');
  const night = session('2026-11-04T23:00:00Z', '2026-11-05T01:00:00Z');
  const active = session('2026-11-05T02:00:00Z', null);
  assert.equal(workTotalMs([night, active], from, to), 2 * 3600000);
  assert.equal(workDurationMs(night, from, to), 3600000);
  assert.equal(workDurationMs(active, from, to + 10000) - workDurationMs(active, from, to), 10000);
  assert.equal(workDurationMs(session('2026-11-06T00:00:00Z', null), from, to), 0);
  assert.equal(workDurationMs(session('invalid', null), from, to), 0);
  assert.equal(formatWorkDuration(3661000, true), '01:01:01');
  assert.equal(formatWorkDuration(3661000), '1h 1m');
  assert.equal(formatWorkDuration(23000), '23s');
  assert.equal(formatWorkDuration(-100), '0h 0m');
});
test('date windows begin at local midnight and include the requested calendar days', () => {
  const now = new Date(2026, 10, 5, 14, 30).getTime();
  assert.equal(workDayStart(now), new Date(2026, 10, 5).getTime());
  assert.equal(workDayStart(now, 7), new Date(2026, 9, 30).getTime());
  assert.equal(workDayStart(now, 30), new Date(2026, 9, 7).getTime());
});
test('daily founder report includes attribution, server start/stop times and work updates', () => {
  const data = createWorkspaceFixture();
  const end = Date.now();
  const start = Math.max(workDayStart(end), end - 3600000);
  data.work_sessions = [session(new Date(start).toISOString(), new Date(end).toISOString())];
  const report = exportReport(data);
  assert.ok(report.includes(`Maya Chen: ${formatWorkDuration(end - start)}`));
  assert.match(report, /Start: .*Stop:/);
  assert.match(report, /WORK UPDATES TODAY/);
  assert.match(report, /Remaining:/);
});
