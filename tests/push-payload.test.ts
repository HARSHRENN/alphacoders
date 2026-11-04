import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fcmMessage } from '../supabase/functions/notify/pushPayload.ts';

test('FCM messages carry readable alerts and the JSON navigation payload Expo expects', () => {
  const navigation = { screen: 'updates', projectId: 'project-id', updateId: 'revision-id' };
  const result = fcmMessage('native-device-token', {
    title: 'Team update revised',
    body: 'A teammate posted progress.',
    data: navigation,
  });
  assert.equal(result.message.notification.title, 'Team update revised');
  assert.deepEqual(JSON.parse(result.message.data.body), navigation);
  assert.ok(Object.values(result.message.data).every((value) => typeof value === 'string'));
  assert.equal(result.message.android.notification.channel_id, result.message.data.channelId);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 4096);
});
