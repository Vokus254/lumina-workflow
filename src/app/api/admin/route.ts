import { NextResponse } from "next/server";
import { isLuminaSuperAdminEmail, requireLuminaAdmin } from "@/lib/lumina-admin";
import { generateTemporaryPassword } from "@/lib/secure-password";

function text(v: unknown) { return String(v ?? "").trim(); }
function email(v: unknown) { return text(v).toLowerCase(); }
function asDate(v: unknown) { const s = text(v); return s || null; }

async function listAllUsers(admin: any) {
  const users: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

async function removeStoredVersions(admin: any, documentIds: string[]) {
  if (!documentIds.length) return;
  const { data: versions, error } = await admin
    .from("document_versions")
    .select("storage_bucket,storage_path")
    .in("document_id", documentIds);
  if (error) throw error;
  const byBucket = new Map<string, string[]>();
  for (const row of versions || []) {
    if (!row.storage_bucket || !row.storage_path) continue;
    const rows = byBucket.get(row.storage_bucket) || [];
    rows.push(row.storage_path);
    byBucket.set(row.storage_bucket, rows);
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const { error: storageError } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (storageError) throw storageError;
    }
  }
}

async function removeTaskDocuments(admin: any, taskId: string) {
  const { data: docs, error } = await admin.from("documents").select("id").eq("task_id", taskId);
  if (error) throw error;
  const ids = (docs || []).map((row: any) => row.id);
  await removeStoredVersions(admin, ids);
  if (ids.length) {
    const { error: deleteError } = await admin.from("documents").delete().in("id", ids);
    if (deleteError) throw deleteError;
  }
}

async function removeProjectStorage(admin: any, projectId: string) {
  const { data: docs, error } = await admin.from("documents").select("id").eq("project_id", projectId);
  if (error) throw error;
  await removeStoredVersions(admin, (docs || []).map((row: any) => row.id));
}

export async function GET() {
  const access = await requireLuminaAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const admin = access.admin;

  try {
    const [users, companiesRes, projectsRes, cmRes, pmRes, rolesRes, roleAssignmentsRes, processStepsRes] = await Promise.all([
      listAllUsers(admin),
      admin.from("companies").select("id,name,legal_form,registered_office,currency_code,status,created_at,updated_at").order("name"),
      admin.from("projects").select("id,company_id,name,fiscal_year_start,fiscal_year_end,reporting_date,status,created_at,updated_at").order("reporting_date", { ascending: false }),
      admin.from("company_members").select("company_id,user_id,company_role,active"),
      admin.from("project_members").select("project_id,user_id,security_role,active"),
      admin.from("responsibility_roles").select("id,project_id,role_key,display_name"),
      admin.from("role_user_assignments").select("role_id,user_id"),
      admin.from("process_steps").select("id,project_id,code,name,sort_order").order("sort_order"),
    ]);
    if (companiesRes.error) throw companiesRes.error;
    if (projectsRes.error) throw projectsRes.error;
    if (cmRes.error) throw cmRes.error;
    if (pmRes.error) throw pmRes.error;
    if (rolesRes.error) throw rolesRes.error;
    if (roleAssignmentsRes.error) throw roleAssignmentsRes.error;
    if (processStepsRes.error) throw processStepsRes.error;

    const projects = projectsRes.data ?? [];
    const projectIds = projects.map((p: any) => p.id);
    let taskCounts: Record<string, number> = {};
    let documentCounts: Record<string, number> = {};
    let roleTaskCounts: Record<string, number> = {};
    let adminTasks: any[] = [];
    if (projectIds.length) {
      const [tasksRes, docsRes] = await Promise.all([
        admin.from("tasks").select("id,project_id,process_step_id,responsibility_role_id,source_number,title,required_documents_text,due_date,work_status,review_status,legacy_source_key").in("project_id", projectIds),
        admin.from("documents").select("project_id").in("project_id", projectIds),
      ]);
      if (!tasksRes.error) { adminTasks = tasksRes.data ?? []; for (const row of adminTasks) {
        taskCounts[row.project_id] = (taskCounts[row.project_id] || 0) + 1;
        if (row.responsibility_role_id) roleTaskCounts[row.responsibility_role_id] = (roleTaskCounts[row.responsibility_role_id] || 0) + 1;
      }}
      if (!docsRes.error) for (const row of docsRes.data ?? []) documentCounts[row.project_id] = (documentCounts[row.project_id] || 0) + 1;
    }

    const normalizedUsers = users.map((u: any) => ({
      id: u.id,
      email: u.email || "",
      firstName: u.user_metadata?.first_name || "",
      lastName: u.user_metadata?.last_name || "",
      displayName: u.user_metadata?.display_name || "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      bannedUntil: u.banned_until || null,
      blocked: Boolean(u.banned_until && new Date(u.banned_until).getTime() > Date.now()),
    }));

    const rolesById = new Map((rolesRes.data ?? []).map((r: any) => [r.id, r]));
    const effectiveRoleAssignments = (roleAssignmentsRes.data ?? []).map((a: any) => {
      const role: any = rolesById.get(a.role_id);
      return {
        user_id: a.user_id,
        role_id: a.role_id,
        project_id: role?.project_id || null,
        role_key: role?.role_key || "",
        display_name: role?.display_name || role?.role_key || "",
        assignedTaskCount: roleTaskCounts[a.role_id] || 0,
      };
    }).filter((a: any) => a.project_id);

    return NextResponse.json({
      currentAdmin: { id: access.userId, email: access.email, isSuperAdmin: access.isSuperAdmin },
      users: normalizedUsers,
      companies: companiesRes.data ?? [],
      projects: projects.map((p: any) => ({ ...p, taskCount: taskCounts[p.id] || 0, documentCount: documentCounts[p.id] || 0 })),
      companyMembers: cmRes.data ?? [],
      projectMembers: pmRes.data ?? [],
      roleAssignments: effectiveRoleAssignments,
      responsibilityRoles: rolesRes.data ?? [],
      processSteps: processStepsRes.data ?? [],
      tasks: adminTasks,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Admin-Daten konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireLuminaAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const admin = access.admin;
  const body = await request.json().catch(() => ({}));
  const action = text(body.action);

  try {
    if (action === "create_user") {
      const mail = email(body.email);
      if (!mail.includes("@")) throw new Error("Gültige E-Mail-Adresse erforderlich.");
      const suppliedPassword = text(body.password);
      const password = suppliedPassword || generateTemporaryPassword();
      const firstName = text(body.firstName), lastName = text(body.lastName);
      const { data, error } = await admin.auth.admin.createUser({
        email: mail,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName || undefined, last_name: lastName || undefined, display_name: [firstName, lastName].filter(Boolean).join(" ") || undefined },
      });
      if (error) throw error;
      if (data.user?.id && isLuminaSuperAdminEmail(mail)) {
        const { error: adminError } = await admin.from("lumina_admins").upsert({ user_id: data.user.id, active: true }, { onConflict: "user_id" });
        if (adminError) throw adminError;
      }
      return NextResponse.json({ ok: true, userId: data.user?.id, temporaryPassword: suppliedPassword ? null : password });
    }

    if (action === "update_user") {
      const userId = text(body.userId);
      const firstName = text(body.firstName), lastName = text(body.lastName), mail = email(body.email);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email: mail || undefined,
        user_metadata: { first_name: firstName || undefined, last_name: lastName || undefined, display_name: [firstName, lastName].filter(Boolean).join(" ") || undefined },
      });
      if (error) throw error;
      if (isLuminaSuperAdminEmail(mail)) {
        const { error: adminError } = await admin.from("lumina_admins").upsert({ user_id: userId, active: true }, { onConflict: "user_id" });
        if (adminError) throw adminError;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "block_user" || action === "unblock_user") {
      const { error } = await admin.auth.admin.updateUserById(text(body.userId), { ban_duration: action === "block_user" ? "876000h" : "none" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_password") {
      const suppliedPassword = text(body.password);
      const password = suppliedPassword || generateTemporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(text(body.userId), { password });
      if (error) throw error;
      return NextResponse.json({ ok: true, temporaryPassword: suppliedPassword ? null : password });
    }

    if (action === "delete_user") {
      if (text(body.userId) === access.userId) throw new Error("Der aktuell angemeldete Admin kann sich nicht selbst löschen.");
      const targetId = text(body.userId);
      const { data: target } = await admin.auth.admin.getUserById(targetId);
      if (isLuminaSuperAdminEmail(target?.user?.email)) throw new Error("Der definierte Superadmin kann nicht über die Oberfläche gelöscht werden.");
      const { error } = await admin.auth.admin.deleteUser(targetId, false);
      if (error) throw new Error(`Benutzer konnte nicht endgültig gelöscht werden: ${error.message}. Falls bereits Belege/Historien verknüpft sind, Benutzer stattdessen sperren.`);
      return NextResponse.json({ ok: true });
    }

    if (action === "create_company") {
      const name = text(body.name);
      if (!name) throw new Error("Gesellschaftsname fehlt.");
      const { data, error } = await admin.from("companies").insert({
        name, legal_form: text(body.legalForm) || null, registered_office: text(body.registeredOffice) || null,
        currency_code: text(body.currencyCode) || "EUR", status: "active",
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, companyId: data.id });
    }

    if (action === "update_company") {
      const { error } = await admin.from("companies").update({
        name: text(body.name), legal_form: text(body.legalForm) || null, registered_office: text(body.registeredOffice) || null,
        currency_code: text(body.currencyCode) || "EUR", updated_at: new Date().toISOString(),
      }).eq("id", text(body.companyId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (["active", "locked", "archived"].includes(action.replace("company_", "")) && action.startsWith("company_")) {
      const status = action.replace("company_", "");
      const { error } = await admin.from("companies").update({ status, updated_at: new Date().toISOString() }).eq("id", text(body.companyId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_company") {
      const companyId = text(body.companyId);
      const { data: projs, error: pe } = await admin.from("projects").select("id").eq("company_id", companyId);
      if (pe) throw pe;
      const pids = (projs ?? []).map((x: any) => x.id);
      if (pids.length) {
        const { count, error: de } = await admin.from("documents").select("id", { count: "exact", head: true }).in("project_id", pids);
        if (de) throw de;
        if ((count || 0) > 0 && !access.isSuperAdmin) throw new Error("Gesellschaft enthält Dokumente. Aus Sicherheitsgründen bitte archivieren statt endgültig löschen.");
        if (access.isSuperAdmin) for (const pid of pids) await removeProjectStorage(admin, pid);
        for (const pid of pids) {
          const { error } = await admin.from("projects").delete().eq("id", pid);
          if (error) throw error;
        }
      }
      const { error } = await admin.from("companies").delete().eq("id", companyId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "create_project") {
      const ownerUserId = text(body.ownerUserId) || access.userId;
      const companyId = text(body.companyId);
      const { error: cme } = await admin.from("company_members").upsert({ company_id: companyId, user_id: ownerUserId, company_role: "owner", active: true }, { onConflict: "company_id,user_id" });
      if (cme) throw cme;
      const { data, error } = await admin.rpc("admin_create_project", {
        p_company_id: companyId,
        p_name: text(body.name),
        p_fiscal_year_start: asDate(body.fiscalYearStart),
        p_fiscal_year_end: asDate(body.fiscalYearEnd),
        p_reporting_date: asDate(body.reportingDate),
        p_owner_user_id: ownerUserId,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, projectId: data });
    }

    if (action === "update_project") {
      const { error } = await admin.from("projects").update({
        name: text(body.name), fiscal_year_start: asDate(body.fiscalYearStart), fiscal_year_end: asDate(body.fiscalYearEnd),
        reporting_date: asDate(body.reportingDate), updated_at: new Date().toISOString(),
      }).eq("id", text(body.projectId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (["active", "locked", "archived", "draft"].includes(action.replace("project_", "")) && action.startsWith("project_")) {
      const status = action.replace("project_", "");
      const { error } = await admin.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", text(body.projectId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_project") {
      const projectId = text(body.projectId);
      const { count, error: de } = await admin.from("documents").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (de) throw de;
      if ((count || 0) > 0 && !access.isSuperAdmin) throw new Error("Projekt enthält Dokumente. Aus Sicherheitsgründen bitte archivieren statt endgültig löschen.");
      if (access.isSuperAdmin) await removeProjectStorage(admin, projectId);
      const { error } = await admin.from("projects").delete().eq("id", projectId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "set_company_member") {
      const { error } = await admin.from("company_members").upsert({ company_id: text(body.companyId), user_id: text(body.userId), company_role: text(body.role) || "member", active: body.active !== false }, { onConflict: "company_id,user_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "remove_company_member") {
      const { error } = await admin.from("company_members").delete().eq("company_id", text(body.companyId)).eq("user_id", text(body.userId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "set_project_member") {
      const { error } = await admin.from("project_members").upsert({ project_id: text(body.projectId), user_id: text(body.userId), security_role: text(body.role) || "viewer", active: body.active !== false }, { onConflict: "project_id,user_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "remove_project_member") {
      const { error } = await admin.from("project_members").delete().eq("project_id", text(body.projectId)).eq("user_id", text(body.userId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "assign_responsibility_role") {
      const roleId = text(body.roleId), userId = text(body.userId);
      if (!roleId || !userId) throw new Error("Benutzer und Workflow-Rolle sind erforderlich.");
      const { error } = await admin.from("role_user_assignments").upsert({ role_id: roleId, user_id: userId }, { onConflict: "role_id,user_id" });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "remove_responsibility_role") {
      const { error } = await admin.from("role_user_assignments").delete().eq("role_id", text(body.roleId)).eq("user_id", text(body.userId));
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "create_task") {
      const projectId = text(body.projectId), title = text(body.title);
      if (!projectId || !title) throw new Error("Projekt und Aufgabenbezeichnung sind erforderlich.");
      const processStepId = text(body.processStepId) || null;
      const roleId = text(body.responsibilityRoleId) || null;
      const sourceNumber = text(body.sourceNumber) || null;
      const legacyKey = `admin:${Date.now()}:${Math.random().toString(36).slice(2,10)}`;
      const { data, error } = await admin.from("tasks").insert({
        project_id: projectId,
        process_step_id: processStepId,
        responsibility_role_id: roleId,
        source_number: sourceNumber,
        title,
        required_documents_text: text(body.requiredDocuments) || null,
        due_date: asDate(body.dueDate),
        work_status: text(body.workStatus) || "open",
        review_status: text(body.reviewStatus) || "unreviewed",
        legacy_source_key: legacyKey,
      }).select("id").single();
      if (error) throw error;
      return NextResponse.json({ ok: true, taskId: data.id });
    }

    if (action === "update_task") {
      const taskId = text(body.taskId);
      if (!taskId) throw new Error("Maßnahme fehlt.");
      const { error } = await admin.from("tasks").update({
        process_step_id: text(body.processStepId) || null,
        responsibility_role_id: text(body.responsibilityRoleId) || null,
        source_number: text(body.sourceNumber) || null,
        title: text(body.title),
        required_documents_text: text(body.requiredDocuments) || null,
        due_date: asDate(body.dueDate),
        work_status: text(body.workStatus) || "open",
        review_status: text(body.reviewStatus) || "unreviewed",
        updated_at: new Date().toISOString(),
      }).eq("id", taskId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_task") {
      const taskId = text(body.taskId);
      const [{ count: docCount, error: docError }, { count: msgCount, error: msgError }] = await Promise.all([
        admin.from("documents").select("id", { count: "exact", head: true }).eq("task_id", taskId),
        admin.from("task_messages").select("id", { count: "exact", head: true }).eq("task_id", taskId),
      ]);
      if (docError) throw docError;
      if (msgError) throw msgError;
      if (((docCount || 0) > 0 || (msgCount || 0) > 0) && !access.isSuperAdmin) throw new Error("Maßnahme enthält Dokumente oder Kommunikation und kann daher nicht gelöscht werden.");
      if (access.isSuperAdmin && (docCount || 0) > 0) await removeTaskDocuments(admin, taskId);
      const { error } = await admin.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    throw new Error("Unbekannte Admin-Aktion.");
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Admin-Aktion fehlgeschlagen." }, { status: 400 });
  }
}
