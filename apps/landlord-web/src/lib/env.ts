export const ENV = {
  SUPABASE_URL: ((import.meta as any).env?.VITE_SUPABASE_URL as string | undefined) ?? "",
  SUPABASE_ANON_KEY: ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  API_BASE_URL: ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined) ?? ""
} as const;

export function assertSupabaseConfigured() {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error(
      "[env] Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. Create .env.local or set them in Cloudflare Pages env vars."
    );
  }
}
