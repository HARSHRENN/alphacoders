import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateCloudConfig } from '../src/lib/cloudConfig.ts';
const config = validateCloudConfig({
  version: 1,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
if (process.argv.includes('--validate-only')) {
  console.log('Public cloud configuration is valid.');
  process.exit(0);
}
await mkdir('dist/web', { recursive: true });
await writeFile('dist/web/app-config.json', JSON.stringify(config));
console.log('Wrote public workspace configuration. No private credentials are published.');
const apk = await readFile('releases/alphacoders.apk');
const checksum = createHash('sha256').update(apk).digest('hex');
const expected = (await readFile('releases/alphacoders.apk.sha256', 'utf8')).trim().split(/\s+/)[0];
if (checksum !== expected) throw new Error('Android release checksum does not match');
await mkdir('dist/web/downloads', { recursive: true });
await copyFile('releases/alphacoders.apk', 'dist/web/downloads/alphacoders.apk');
await copyFile('releases/alphacoders.apk.sha256', 'dist/web/downloads/alphacoders.apk.sha256');
await writeFile(
  'dist/web/downloads/build.json',
  JSON.stringify({
    version: '1.0.0',
    platform: 'android',
    filename: 'alphacoders.apk',
    sha256: checksum,
    size: apk.length,
  }),
);
console.log('Published the verified standalone Android APK in downloads.');
