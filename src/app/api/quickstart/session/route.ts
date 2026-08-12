import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.LUMINA_QUICKSTART_ENABLED !== "true") {
    return NextResponse.json({ error: "Quickstart ist derzeit nicht freigeschaltet." }, { status: 503 });
  }

  const email = process.env.LUMINA_QUICKSTART_EMAIL?.trim();
  const password = process.env.LUMINA_QUICKSTART_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "Quickstart ist serverseitig nicht vollständig konfiguriert." }, { status: 503 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Quickstart konnte nicht geöffnet werden." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
