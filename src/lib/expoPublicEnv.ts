export type ExpoPublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function readRequiredEnv(name: keyof NodeJS.ProcessEnv): string {
  const raw = process.env[name];
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to a local .env (not committed) or set it in EAS (preview/production) before building.`,
    );
  }
  return value;
}

function looksLikeSupabaseProjectUrl(url: string): boolean {
  // Minimal safety check to catch obvious misconfigs (missing scheme, wrong domain, etc.).
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);
}

function looksLikeJwt(token: string): boolean {
  // header.payload.signature (base64url-ish). We don't validate cryptographically here.
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

export function getExpoPublicEnv(): ExpoPublicEnv {
  const supabaseUrl = readRequiredEnv('EXPO_PUBLIC_SUPABASE_URL');
  if (!looksLikeSupabaseProjectUrl(supabaseUrl)) {
    throw new Error(
      `Invalid EXPO_PUBLIC_SUPABASE_URL: expected https://<project-ref>.supabase.co (got ${JSON.stringify(
        supabaseUrl,
      )})`,
    );
  }

  const supabaseAnonKey = readRequiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!looksLikeJwt(supabaseAnonKey)) {
    throw new Error(
      `Invalid EXPO_PUBLIC_SUPABASE_ANON_KEY: expected a JWT-like string (header.payload.signature).`,
    );
  }

  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey };
}
