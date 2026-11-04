import {mkdir,writeFile} from 'node:fs/promises';
import {validateCloudConfig} from '../src/lib/cloudConfig.ts';
const config=validateCloudConfig({version:1,supabaseUrl:process.env.EXPO_PUBLIC_SUPABASE_URL,supabaseAnonKey:process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY});
if(process.argv.includes('--validate-only')) { console.log('Public cloud configuration is valid.'); process.exit(0); }
await mkdir('dist/web',{recursive:true});
await writeFile('dist/web/app-config.json',JSON.stringify(config));
console.log('Wrote public workspace configuration. No private credentials are published.');
