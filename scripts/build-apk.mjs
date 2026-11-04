import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,chmodSync,readdirSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {homedir} from 'node:os';

const root=resolve(import.meta.dirname,'..');
const java=process.env.JAVA_HOME || (process.platform==='darwin'?'/Applications/Android Studio.app/Contents/jbr/Contents/Home':'');
const sdk=process.env.ANDROID_HOME || (process.platform==='darwin'?join(homedir(),'Library/Android/sdk'):'');
if(!existsSync(join(java,'bin/java')) || !existsSync(join(sdk,'build-tools'))) throw new Error('Set JAVA_HOME and ANDROID_HOME to an installed JDK 21 and Android SDK.');
const env={...process.env,JAVA_HOME:java,ANDROID_HOME:sdk};
function run(command,args){const result=spawnSync(command,args,{cwd:root,env,stdio:'inherit'});if(result.status!==0)throw new Error(`${command} failed; APK was not produced.`);}
if(!existsSync(join(root,'android/gradlew')) || process.argv.includes('--prebuild')) {
 run('npx',['expo','prebuild','--platform','android','--no-install']);
}
run(join(root,'android/gradlew'),['-p','android','assembleRelease','--no-daemon','-PreactNativeArchitectures=arm64-v8a,armeabi-v7a']);

// Keep this unique key for future internal updates. Never commit or publish it.
const credentials=join(root,'.credentials');mkdirSync(credentials,{recursive:true,mode:0o700});
const passwordFile=join(credentials,'android-signing-password');
const keystore=join(credentials,'alphacoders-release.jks');
if(!existsSync(passwordFile)){
 if(existsSync(keystore))throw new Error('Signing key exists but its password file is missing. Restore your signing credentials.');
 writeFileSync(passwordFile,randomBytes(32).toString('hex'),{mode:0o600});
}
env.ALPHACODERS_SIGNING_PASSWORD=readFileSync(passwordFile,'utf8').trim();
if(!existsSync(keystore)) run(join(java,'bin/keytool'),['-genkeypair','-keystore',keystore,'-alias','alphacoders','-storepass:env','ALPHACODERS_SIGNING_PASSWORD','-keypass:env','ALPHACODERS_SIGNING_PASSWORD','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=alphacoders']);
chmodSync(keystore,0o600);
const buildTools=readdirSync(join(sdk,'build-tools')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).at(-1);
const signer=join(sdk,'build-tools',buildTools,'apksigner');
const output=join(root,'artifacts');mkdirSync(output,{recursive:true});
const apk=join(output,'alphacoders.apk');
run(signer,['sign','--ks',keystore,'--ks-key-alias','alphacoders','--ks-pass','env:ALPHACODERS_SIGNING_PASSWORD','--key-pass','env:ALPHACODERS_SIGNING_PASSWORD','--out',apk,join(root,'android/app/build/outputs/apk/release/app-release.apk')]);
run(signer,['verify','--verbose',apk]);
writeFileSync(join(output,'alphacoders.apk.sha256'),createHash('sha256').update(readFileSync(apk)).digest('hex')+'  alphacoders.apk\n');
console.log('Signed standalone APK: artifacts/alphacoders.apk');
console.log('Connect it to your deployed workspace URL. Android push still requires Firebase configuration at build time.');
