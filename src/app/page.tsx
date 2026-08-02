const phases = [
  { label: "Frontend-Grundlage", detail: "Next.js und Vercel", state: "bereit" },
  { label: "Anmeldung", detail: "Supabase Auth", state: "als Nächstes" },
  { label: "Aufgaben und Rollen", detail: "Migration aus LUMINA", state: "geplant" },
  { label: "Datenraum", detail: "Privater Supabase Storage", state: "geplant" },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandMark" aria-hidden="true" />
        <div>
          <strong>LUMINA Workflow</strong>
          <span>Jahresabschluss sicher koordinieren</span>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Neue Anwendungsplattform</p>
        <h1>Die Migration hat begonnen.</h1>
        <p className="lead">
          Diese getrennte Anwendung wird schrittweise das bestehende
          Abschluss-Cockpit übernehmen. Die öffentliche LUMINA-Landingpage
          bleibt unverändert.
        </p>
        <div className="address">Zieladresse: lumina-workflow.vercel.app</div>
      </section>

      <section className="phaseSection" aria-labelledby="migration-title">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Migrationsstand</p>
            <h2 id="migration-title">Sicher in Etappen</h2>
          </div>
          <span className="status">Testsystem</span>
        </div>

        <div className="phaseGrid">
          {phases.map((phase, index) => (
            <article className="phaseCard" key={phase.label}>
              <span className="phaseNumber">0{index + 1}</span>
              <h3>{phase.label}</h3>
              <p>{phase.detail}</p>
              <span className={`phaseState state-${index}`}>{phase.state}</span>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>LUMINA Workflow</span>
        <span>Noch keine Produktivdaten</span>
      </footer>
    </main>
  );
}
