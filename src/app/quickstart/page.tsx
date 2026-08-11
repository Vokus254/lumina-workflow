import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KaiQuickstart } from "./quickstart-client";

export const dynamic = "force-dynamic";

export default async function QuickstartPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login?next=/quickstart");
  const { data: context } = await supabase.rpc("quickstart_context");
  return <KaiQuickstart initialContext={context ?? { companies: [] }} />;
}
