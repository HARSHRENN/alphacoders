import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

const apk = process.argv[2] && resolve(process.argv[2]);
if (!apk || !existsSync(apk)) throw new Error('Pass the downloaded release APK path.');
const sdk = process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk');
const versions = readdirSync(join(sdk, 'build-tools')).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true }),
);
const tools = join(sdk, 'build-tools', versions.at(-1));
const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME || '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
};
function run(command, args, binary = false) {
  const result = spawnSync(command, args, {
    env,
    encoding: binary ? undefined : 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr?.toString()}`);
  return result.stdout;
}
function identity(file) {
  const badging = run(join(tools, 'aapt'), ['dump', 'badging', file]);
  const match = badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
  if (!match || badging.includes('application-debuggable'))
    throw new Error('APK identity is invalid or debuggable.');
  const certificate = run(join(tools, 'apksigner'), ['verify', '--print-certs', file]);
  const signer = certificate.match(/Signer #1 certificate SHA-256 digest: (\w+)/)?.[1];
  if (!signer) throw new Error('APK signature could not be verified.');
  return {
    packageName: match[1],
    versionCode: Number(match[2]),
    version: match[3],
    signer,
    badging,
  };
}
const next = identity(apk);
const previous = identity('releases/alphacoders.apk');
const config = JSON.parse(await readFile('app.json', 'utf8')).expo;
if (next.packageName !== previous.packageName || next.signer !== previous.signer)
  throw new Error('Package or signing identity changed; existing installs could not upgrade.');
if (
  next.versionCode <= previous.versionCode ||
  next.versionCode !== config.android.versionCode ||
  next.version !== config.version
)
  throw new Error('APK version does not match the prepared release or is not newer.');
for (const permission of config.android.blockedPermissions || [])
  if (next.badging.includes(`uses-permission: name='${permission}'`))
    throw new Error(`Unused permission remains: ${permission}`);
const bundle = run('unzip', ['-p', apk, 'assets/index.android.bundle'], true);
for (const marker of [
  'Team overview',
  'Work timers are for team members only.',
  'jrvqllgpuhzwyswwmpka.supabase.co',
])
  if (!bundle.includes(Buffer.from(marker)))
    throw new Error(`Required application code is missing: ${marker}`);
const resources = run(join(tools, 'aapt'), ['dump', '--values', 'resources', apk]);
for (const marker of ['google_app_id', 'gcm_defaultSenderId', 'alphacoders-593b1'])
  if (!resources.includes(marker))
    throw new Error(`Native Firebase resource is missing: ${marker}`);
const file = await readFile(apk);
const sha256 = createHash('sha256').update(file).digest('hex');
const sourceCommit = run('git', ['rev-parse', 'HEAD']).trim();
const metadata = {
  version: next.version,
  versionCode: next.versionCode,
  packageName: next.packageName,
  platform: 'android',
  filename: 'alphacoders.apk',
  sha256,
  size: file.length,
  signerSha256: next.signer,
  sourceCommit,
  buildId: process.argv.find((arg) => arg.startsWith('--build-id='))?.slice(11) || null,
  verifiedAt: new Date().toISOString(),
};
await mkdir('releases', { recursive: true });
await copyFile(apk, 'releases/alphacoders.apk');
await writeFile('releases/alphacoders.apk.sha256', `${sha256}  alphacoders.apk\n`);
await writeFile('releases/android-release.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
console.log(
  'Verified release APK, matching upgrade signature, embedded application code and native Firebase resources.',
);
