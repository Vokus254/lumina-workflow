import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const nextSteps = [
  "Rollen und Benutzerprofile übernehmen",
  "202 Aufgaben aus Supabase laden",
  "Privaten Datenraum anbinden",
];

export default async function WorkflowPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email = typeof data.claims.email === "string"
    ? data.claims.email
    : "Angemeldeter Benutzer";

  return (
    <main className="workflowShell">
      <header className="workflowHeader">
        <div className="authBrand">
          <span className="brandMark" aria-hidden="true" />
          <div>
            <strong>LUMINA Workflow</strong>
            <span>Jahresabschluss sicher koordinieren</span>
          </div>
        </div>
        <div className="accountBox">
          <span>{email}</span>
          <form action={signOut}>
            <button className="secondaryButton" type="submit">Abmelden</button>
          </form>
        </div>
      </header>

      <section className="workflowHero">
        <div>
          <p className="eyebrow">Anmeldung erfolgreich</p>
          <h1>Ihr geschützter<br />Arbeitsbereich.</h1>
        </div>
        <span className="status">Supabase verbunden</span>
      </section>

      <section className="migrationCard">
        <div>
          <p className="eyebrow">Nächster Migrationsschritt</p>
          <h2>Das Abschluss-Cockpit wird jetzt übernommen.</h2>
          <p>
            Ihre Anmeldung funktioniert bereits über Supabase. Im nächsten
            Schritt ersetzen wir diese Übergangsseite durch Aufgabenübersicht,
            Rollenmodell und Datenraum.
          </p>
        </div>
        <ol>
          {nextSteps.map((step, index) => (
            <li key={step}><span>0{index + 1}</span>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
