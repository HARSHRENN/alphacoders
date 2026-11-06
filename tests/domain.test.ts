import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  latestUpdates,
  projectProgress,
  nextDue,
  validateUpdate,
  exportReport,
} from '../src/lib/domain.ts';
import { createWorkspaceFixture } from './fixtures/workspace.ts';

test('cadence stays anchored at interval boundaries and across a day change', () => {
  const anchor = '2026-11-04T23:30:00Z';
  assert.equal(
    nextDue(anchor, 1, Date.parse('2026-11-05T00:29:59Z')),
    Date.parse('2026-11-05T00:30:00Z'),
  );
  assert.equal(
    nextDue(anchor, 1, Date.parse('2026-11-05T00:30:00Z')),
    Date.parse('2026-11-05T01:30:00Z'),
  );
  assert.equal(nextDue(anchor, 2, Date.parse(anchor)), Date.parse('2026-11-05T01:30:00Z'));
});
test('project progress counts each contributor once and keeps revision history', () => {
  const data = createWorkspaceFixture(),
    previous = data.updates.find((u) => u.user_id === 'maya')!;
  data.updates.push({
    ...previous,
    id: 'revision',
    progress: 95,
    supersedes: previous.id,
    created_at: new Date().toISOString(),
  });
  assert.equal(projectProgress('p1', data.updates), 90);
  assert.equal(latestUpdates(data.updates).length, 4);
  assert.equal(data.updates.length, 5);
});
test('update input rejects missing work, invalid progress, and past ETA', () => {
  const input = {
    completed: 'Built onboarding',
    remaining: 'QA',
    progress: 70,
    eta: new Date(Date.now() + 3600000).toISOString(),
  };
  assert.doesNotThrow(() => validateUpdate(input));
  assert.throws(() => validateUpdate({ ...input, completed: ' ' }));
  assert.throws(() => validateUpdate({ ...input, progress: NaN }));
  assert.throws(() => validateUpdate({ ...input, progress: 33.5 }), /whole number/);
  assert.throws(() => validateUpdate({ ...input, progress: 101 }));
  assert.throws(() => validateUpdate({ ...input, remaining: '' }));
  assert.throws(() => validateUpdate({ ...input, eta: '2020-01-01' }));
  assert.doesNotThrow(() => validateUpdate({ ...input, progress: 100, remaining: '' }));
});
test('daily report includes attribution, remaining work, and ETA', () => {
  const report = exportReport(createWorkspaceFixture());
  assert.match(report, /Maya Chen \/ Orbit mobile app/);
  assert.match(report, /Remaining: Payment screens/);
  assert.match(report, /ETA:/);
  assert.match(report, /Waiting on feedback/);
});
