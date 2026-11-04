import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCloudConfig, workspaceConfigUrl } from '../src/lib/cloudConfig.ts';
const publicConfig = {
  version: 1,
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'sb_publishable_example_public_key_only',
};
test('the APK can use either public hosting provider without a LAN address', () => {
  assert.equal(
    workspaceConfigUrl('https://alphacoders.vercel.app'),
    'https://alphacoders.vercel.app/app-config.json',
  );
  assert.equal(
    workspaceConfigUrl('https://alphacoders.onrender.com'),
    'https://alphacoders.onrender.com/app-config.json',
  );
  assert.throws(() => workspaceConfigUrl('http://192.168.1.10:8081'));
  assert.throws(() => workspaceConfigUrl('https://localhost'));
  assert.throws(() => workspaceConfigUrl('https://user:password@example.com'));
});
test('runtime cloud configuration accepts public keys and rejects privileged keys', () => {
  assert.equal(validateCloudConfig(publicConfig).supabaseUrl, 'https://example.supabase.co');
  assert.throws(() =>
    validateCloudConfig({ ...publicConfig, supabaseAnonKey: 'sb_secret_do_not_publish_this_key' }),
  );
  const serviceKey = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
  assert.throws(() => validateCloudConfig({ ...publicConfig, supabaseAnonKey: serviceKey }));
  const anonKey = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ role: 'anon' }))}.signature`;
  assert.equal(
    validateCloudConfig({ ...publicConfig, supabaseAnonKey: anonKey }).supabaseAnonKey,
    anonKey,
  );
  assert.throws(() => validateCloudConfig({ ...publicConfig, version: 2 }));
  assert.throws(() =>
    validateCloudConfig({ ...publicConfig, supabaseUrl: 'http://example.supabase.co' }),
  );
});
