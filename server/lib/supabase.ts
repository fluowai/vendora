import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseServiceKey);

function createSupabaseClients() {
  if (!isSupabaseConfigured) {
    console.warn("⚠️  Supabase não configurado. Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env");
    // Note: this warn intentionally uses console.warn for visibility during startup
    return { supabase: null, supabaseAdmin: null };
  }
  return {
    supabase: createClient(supabaseUrl, supabaseAnonKey),
    supabaseAdmin: createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

const clients = createSupabaseClients();
export const supabase = clients.supabase!;
export const supabaseAdmin = clients.supabaseAdmin!;

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "vendora-assets";

export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer,
  contentType: string
) {
  if (!supabaseAdmin) throw new Error("Supabase não configurado");
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, file, { contentType, upsert: true });
  if (error) throw error;
  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(path);
  return { path: data?.path, url: urlData?.publicUrl };
}

export async function deleteFile(bucket: string, path: string) {
  if (!supabaseAdmin) throw new Error("Supabase não configurado");
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function isSupabaseReady() {
  return isSupabaseConfigured;
}
