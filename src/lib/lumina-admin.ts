import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt.");
  return createSupabaseAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireLuminaAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return { ok: false as const, status: 401, error: "Anmeldung erforderlich." };

  const admin = createAdminClient();
  const { data: row, error: adminError } = await admin
    .from("lumina_admins")
    .select("user_id,active")
    .eq("user_id", String(claims.sub))
    .eq("active", true)
    .maybeSingle();

  if (adminError || !row) return { ok: false as const, status: 403, error: "Keine LUMINA-Adminberechtigung." };

  return {
    ok: true as const,
    userId: String(claims.sub),
    email: String(claims.email || ""),
    admin,
  };
}
