import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RoleRow = {
  id: string;
  role_key: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type TaskRow = {
  id: string;
  source_number: string | null;
  title: string;
  required_documents_text: string | null;
  due_date: string | null;
  due_date_override: string | null;
  work_status: string;
  responsibility_role_id: string | null;
};

type DigestTask = {
  number: string;
  title: string;
  requiredDocuments: string;
  dueDate: string | null;
  link: string;
};

type RoleDigest = {
  roleId: string;
  role: string;
  recipientName: string;
  email: string;
  tasks: DigestTask[];
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lumina-workflow.vercel.app/workflow";

function effectiveDueDate(task: TaskRow) {
  return task.due_date_override || task.due_date;
}

function formatDate(value: string | null) {
  if (!value) return "ohne festen Termin";
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(new Date(`${value}T12:00:00Z`));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

async function getAdminDigests() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user) {
    return { error: "Nicht angemeldet.", status: 401 as const };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("project_members")
    .select("project_id,security_role")
    .eq("user_id", user.id)
    .eq("active", true)
    .in("security_role", ["owner", "manager"])
    .limit(1);

  if (membershipError || !memberships?.length || user.email?.toLowerCase() !== "admin@volkerkusch.de") {
    return { error: "Diese Funktion ist nur für die LUMINA-Administration verfügbar.", status: 403 as const };
  }

  const projectId = memberships[0].project_id;
  const [{ data: roles, error: rolesError }, { data: tasks, error: tasksError }, { data: project, error: projectError }] = await Promise.all([
    supabase
      .from("responsibility_roles")
      .select("id,role_key,display_name,first_name,last_name,email")
      .eq("project_id", projectId)
      .order("role_key"),
    supabase
      .from("tasks")
      .select("id,source_number,title,required_documents_text,due_date,due_date_override,work_status,responsibility_role_id")
      .eq("project_id", projectId)
      .not("responsibility_role_id", "is", null)
      .not("work_status", "in", "(completed,not_relevant)"),
    supabase
      .from("projects")
      .select("name,reporting_date,companies(name)")
      .eq("id", projectId)
      .single(),
  ]);

  if (rolesError || tasksError || projectError) {
    return { error: rolesError?.message || tasksError?.message || projectError?.message || "Daten konnten nicht geladen werden.", status: 500 as const };
  }

  const typedRoles = (roles || []) as RoleRow[];
  const typedTasks = (tasks || []) as TaskRow[];
  const digests: RoleDigest[] = typedRoles
    .filter((role) => role.email)
    .map((role) => {
      const roleTasks = typedTasks
        .filter((task) => task.responsibility_role_id === role.id)
        .sort((left, right) => {
          const leftDue = effectiveDueDate(left) || "9999-12-31";
          const rightDue = effectiveDueDate(right) || "9999-12-31";
          return leftDue.localeCompare(rightDue) || (left.source_number || "").localeCompare(right.source_number || "", "de", { numeric: true });
        })
        .map((task) => ({
          number: task.source_number || "–",
          title: task.title,
          requiredDocuments: task.required_documents_text || "–",
          dueDate: effectiveDueDate(task),
          link: `${APP_URL}?task=${encodeURIComponent(task.source_number || task.id)}&view=dataroom`,
        }));

      return {
        roleId: role.id,
        role: role.display_name || role.role_key,
        recipientName: [role.first_name, role.last_name].filter(Boolean).join(" ") || role.display_name || role.role_key,
        email: role.email!,
        tasks: roleTasks,
      };
    })
    .filter((digest) => digest.tasks.length > 0);

  const companyRelation = project.companies as unknown as { name?: string } | null;
  return {
    digests,
    project: {
      name: companyRelation?.name || project.name,
      reportingDate: project.reporting_date,
    },
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  };
}

function createMessage(digest: RoleDigest, project: { name: string; reportingDate: string }) {
  const taskRows = digest.tasks.map((task) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(task.number)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top"><strong>${escapeHtml(task.title)}</strong><br><span style="color:#6b7280;font-size:12px">${escapeHtml(task.requiredDocuments)}</span></td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">${escapeHtml(formatDate(task.dueDate))}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top"><a href="${escapeHtml(task.link)}" style="color:#238867">Datenraum öffnen</a></td>
    </tr>`).join("");

  const subject = `LUMINA – Ihre offenen Aufgaben für ${project.name}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#202124;line-height:1.5;max-width:900px">
      <p>Guten Tag ${escapeHtml(digest.recipientName)},</p>
      <p>für den Jahresabschluss zum ${escapeHtml(formatDate(project.reportingDate))} finden Sie nachfolgend Ihre aktuell offenen Aufgaben. Die Übersicht ist nach Fälligkeit sortiert.</p>
      <table style="width:100%;border-collapse:collapse;margin:22px 0">
        <thead><tr style="background:#f3f7f5;text-align:left"><th style="padding:10px 8px">Nr.</th><th style="padding:10px 8px">Aufgabe</th><th style="padding:10px 8px">Fälligkeit</th><th style="padding:10px 8px">Zugriff</th></tr></thead>
        <tbody>${taskRows}</tbody>
      </table>
      <p>Über den jeweiligen Link gelangen Sie nach der Anmeldung direkt zum zugehörigen Datenraum.</p>
      <p>Vielen Dank für Ihre Unterstützung.</p>
      <p>Freundliche Grüße<br>LUMINA Abschlusskoordination</p>
    </div>`;
  const text = [
    `Guten Tag ${digest.recipientName},`,
    "",
    `für den Jahresabschluss zum ${formatDate(project.reportingDate)} finden Sie Ihre aktuell offenen Aufgaben, sortiert nach Fälligkeit:`,
    "",
    ...digest.tasks.flatMap((task) => [`${task.number} – ${task.title}`, `Fälligkeit: ${formatDate(task.dueDate)}`, `Datenraum: ${task.link}`, ""]),
    "Vielen Dank für Ihre Unterstützung.",
    "",
    "Freundliche Grüße",
    "LUMINA Abschlusskoordination",
  ].join("\n");
  return { subject, html, text };
}

export async function GET() {
  const result = await getAdminDigests();
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result);
}

export async function POST(request: Request) {
  const result = await getAdminDigests();
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });

  const body = await request.json().catch(() => null) as { confirmed?: boolean } | null;
  if (!body?.confirmed) return Response.json({ error: "Der Versand wurde nicht bestätigt." }, { status: 400 });
  if (!result.smtpConfigured) return Response.json({ error: "Der IONOS-Mailversand ist in Vercel noch nicht vollständig eingerichtet." }, { status: 503 });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const from = process.env.SMTP_FROM || `LUMINA Workflow <${process.env.SMTP_USER}>`;
  const sent: Array<{ email: string; taskCount: number }> = [];

  for (const digest of result.digests) {
    const message = createMessage(digest, result.project);
    await transporter.sendMail({ from, to: digest.email, ...message });
    sent.push({ email: digest.email, taskCount: digest.tasks.length });
  }

  return Response.json({ sent });
}
