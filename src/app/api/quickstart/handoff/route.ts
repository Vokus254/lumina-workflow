import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateTemporaryPassword } from "@/lib/secure-password";

const QUICKSTART_EMAIL = process.env.LUMINA_QUICKSTART_EMAIL?.trim().toLowerCase() || "";

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (claimsError || !claims?.sub) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  if (!QUICKSTART_EMAIL) {
    return NextResponse.json({ error: "Quickstart ist serverseitig nicht vollständig konfiguriert." }, { status: 503 });
  }

  const currentEmail = normalizeEmail(claims.email);
  if (currentEmail !== QUICKSTART_EMAIL) {
    return NextResponse.json({ error: "Die Projektübergabe ist nur aus dem KAI-Pilotzugang möglich." }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Serverkonfiguration fehlt: SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt." }, { status: 500 });
  }

  let body: { projectId?: string; email?: string; firstName?: string; lastName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const projectId = String(body.projectId || "").trim();
  const ownerEmail = normalizeEmail(body.email);
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();

  if (!projectId) return NextResponse.json({ error: "Projekt fehlt." }, { status: 400 });
  if (!ownerEmail || !ownerEmail.includes("@")) return NextResponse.json({ error: "Bitte eine gültige persönliche E-Mail-Adresse angeben." }, { status: 400 });
  if (ownerEmail === QUICKSTART_EMAIL) return NextResponse.json({ error: "Bitte eine persönliche E-Mail-Adresse verwenden, nicht den gemeinsamen Quickstart-Zugang." }, { status: 400 });

  const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const guestUserId = String(claims.sub);

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,company_id,name")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json({ error: "Projekt wurde nicht gefunden." }, { status: 404 });
  }

  const { data: guestMembership } = await admin
    .from("project_members")
    .select("security_role,active")
    .eq("project_id", projectId)
    .eq("user_id", guestUserId)
    .maybeSingle();
  if (!guestMembership?.active || guestMembership.security_role !== "owner") {
    return NextResponse.json({ error: "Der Quickstart-Zugang ist nicht Owner dieses Projekts." }, { status: 403 });
  }

  let targetUser: { id: string; email?: string | null } | undefined;
  let page = 1;
  do {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (usersError) return NextResponse.json({ error: `Benutzerprüfung fehlgeschlagen: ${usersError.message}` }, { status: 500 });
    targetUser = usersData.users.find((user) => normalizeEmail(user.email) === ownerEmail);
    if (targetUser || usersData.users.length < 200) break;
    page += 1;
  } while (page <= 10);

  let created = false;
  let temporaryPassword: string | null = null;
  if (!targetUser) {
    temporaryPassword = generateTemporaryPassword();
    const { data: createdData, error: createError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        display_name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
        lumina_source: "quickstart_handoff",
      },
    });
    if (createError || !createdData.user) {
      return NextResponse.json({ error: `Persönlicher Zugang konnte nicht angelegt werden: ${createError?.message || "Unbekannter Fehler"}` }, { status: 500 });
    }
    targetUser = createdData.user;
    created = true;
  }

  const ownerUserId = targetUser.id;

  const { error: companyMemberError } = await admin
    .from("company_members")
    .upsert({ company_id: project.company_id, user_id: ownerUserId, company_role: "owner", active: true }, { onConflict: "company_id,user_id" });
  if (companyMemberError) return NextResponse.json({ error: `Gesellschaftsberechtigung konnte nicht übertragen werden: ${companyMemberError.message}` }, { status: 500 });

  const { error: projectMemberError } = await admin
    .from("project_members")
    .upsert({ project_id: projectId, user_id: ownerUserId, security_role: "owner", active: true }, { onConflict: "project_id,user_id" });
  if (projectMemberError) return NextResponse.json({ error: `Projektberechtigung konnte nicht übertragen werden: ${projectMemberError.message}` }, { status: 500 });

  // Der gemeinsame Pilotzugang ist nur der Bootstrap. Nach erfolgreicher
  // Übergabe verliert er den Zugriff auf dieses konkrete Projekt und dessen Gesellschaft.
  const { error: removeProjectError } = await admin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", guestUserId);
  if (removeProjectError) return NextResponse.json({ error: `Quickstart-Projektzugriff konnte nicht entfernt werden: ${removeProjectError.message}` }, { status: 500 });

  const { data: otherGuestProjects } = await admin
    .from("project_members")
    .select("project_id,projects!inner(company_id)")
    .eq("user_id", guestUserId)
    .eq("active", true)
    .eq("projects.company_id", project.company_id)
    .limit(1);

  if (!otherGuestProjects?.length) {
    await admin
      .from("company_members")
      .delete()
      .eq("company_id", project.company_id)
      .eq("user_id", guestUserId);
  }

  await admin
    .from("quickstart_sessions")
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", guestUserId)
    .eq("project_id", projectId);

  return NextResponse.json({
    ok: true,
    email: ownerEmail,
    created,
    temporaryPassword: created ? temporaryPassword : null,
    projectName: project.name,
  });
}
