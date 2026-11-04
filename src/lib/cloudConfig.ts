export type CloudConfig = {
  version: 1;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function validateCloudConfig(value: unknown): CloudConfig {
  const config = value as Partial<CloudConfig> | null;
  if (
    !config ||
    config.version !== 1 ||
    typeof config.supabaseUrl !== 'string' ||
    typeof config.supabaseAnonKey !== 'string'
  ) {
    throw new Error('This server does not have a valid alphacoders configuration.');
  }
  const url = new URL(config.supabaseUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new Error('The workspace database must use a public HTTPS address.');
  }
  const key = config.supabaseAnonKey;
  if (!key.startsWith('sb_publishable_')) {
    let role: string | undefined;
    try {
      role = JSON.parse(
        globalThis.atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      ).role;
    } catch {
      /* Invalid public key. */
    }
    if (role !== 'anon')
      throw new Error('Use a Supabase publishable/anon key, never a secret or service-role key.');
  }
  if (key.length < 25) throw new Error('The server’s public database key is incomplete.');
  return { version: 1, supabaseUrl: url.origin, supabaseAnonKey: key };
}

export function workspaceConfigUrl(input: string): string {
  const url = new URL(input.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error('Enter your hosted workspace HTTPS URL, not a local Wi-Fi address.');
  }
  return `${url.origin}/app-config.json`;
}
