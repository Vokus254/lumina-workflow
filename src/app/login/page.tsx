"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUICKSTART_EMAIL = process.env.NEXT_PUBLIC_LUMINA_QUICKSTART_EMAIL || "quickstart@volkerkusch.de";
const QUICKSTART_PASSWORD = process.env.NEXT_PUBLIC_LUMINA_QUICKSTART_PASSWORD || "start123";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [quickstartPending, setQuickstartPending] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const recoveryError = params.get("recovery_error");
    const requestedTarget = params.get("next");
    const targetEmail = requestedTarget
      ? new URLSearchParams(requestedTarget.split("?")[1] || "").get("email")
      : null;
    const requestedEmail = params.get("email") || targetEmail;
    const handoff = params.get("handoff");
    const accountCreated = params.get("created") === "1";
    const timer = window.setTimeout(() => {
      if (requestedMode === "reset") setMode("reset");
      if (recoveryError) setError("Der Link zum Zurücksetzen ist ungültig oder abgelaufen. Bitte fordern Sie eine neue E-Mail an.");
      if (requestedEmail) setEmail(requestedEmail);
      if (handoff === "1") {
        setMessage(accountCreated
          ? "Ihr persönlicher LUMINA-Zugang wurde angelegt. Melden Sie sich jetzt mit Ihrer E-Mail-Adresse und dem Erstpasswort start123 an."
          : "Das Projekt wurde Ihrem persönlichen LUMINA-Zugang übertragen. Melden Sie sich jetzt mit Ihrem bestehenden Passwort an.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function signIn(targetEmail: string, targetPassword: string) {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: targetEmail.trim(),
      password: targetPassword,
    });
    if (signInError) throw signInError;
  }

  async function handleQuickstart() {
    setError("");
    setMessage("");
    setQuickstartPending(true);
    try {
      await signIn(QUICKSTART_EMAIL, QUICKSTART_PASSWORD);
      router.replace("/quickstart?mode=company&fresh=1");
      router.refresh();
    } catch {
      setError("Der Quickstart-Testzugang ist noch nicht eingerichtet oder das Passwort stimmt nicht. Bitte prüfen Sie den Supabase-Auth-Nutzer quickstart@volkerkusch.de.");
    } finally {
      setQuickstartPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);

    try {
      const supabase = createClient();
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/login?mode=reset")}` },
        );
        if (resetError) throw resetError;
        setMessage("Wir haben Ihnen eine E-Mail zum Zurücksetzen des Passworts gesendet.");
        return;
      }

      if (mode === "reset") {
        if (password.length < 8) {
          setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage("Ihr Passwort wurde geändert. Sie können sich jetzt anmelden.");
        setPassword("");
        setMode("login");
        window.history.replaceState({}, "", "/login");
        return;
      }

      await signIn(email, password);

      const requestedTarget = new URLSearchParams(window.location.search).get("next");
      const target = requestedTarget && requestedTarget.startsWith("/") && !requestedTarget.startsWith("//")
        ? requestedTarget
        : "/workflow";
      router.replace(target);
      router.refresh();
    } catch {
      setError("E-Mail-Adresse oder Passwort ist nicht korrekt.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="authPage startDesktopAuth">
      <section className="authIntro">
        <div className="authBrand">
          <span className="brandMark" aria-hidden="true" />
          <div>
            <strong>LUMINA Workflow</strong>
            <span>Jahresabschluss sicher koordinieren</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Startdesktop</p>
          <h1>Willkommen<br />bei LUMINA.</h1>
          <p className="lead">
            Ein Login, alle freigeschalteten Gesellschaften und Abschlussprojekte.
            Neue Projekte richten Sie in wenigen Schritten mit KAI ein.
          </p>
          <div className="startBenefits" aria-label="LUMINA Vorteile">
            <span>Eigene Gesellschaften</span>
            <span>Eigene Projekte</span>
            <span>Rollen & Berechtigungen</span>
            <span>KAI Quickstart</span>
          </div>
        </div>
        <p className="authNotice">Testsystem · Noch keine Produktivdaten</p>
      </section>

      <section className="loginPanel" aria-labelledby="login-title">
        <div className="loginStack">
          <form className="loginCard" onSubmit={handleSubmit}>
            <p className="eyebrow">{mode === "login" ? "Persönliche Anmeldung" : "Passwort"}</p>
            <h2 id="login-title">
              {mode === "forgot" ? "Passwort zurücksetzen" : mode === "reset" ? "Neues Passwort festlegen" : "Meine Projekte öffnen"}
            </h2>
            <p className="formIntro">
              {mode === "forgot"
                ? "Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten anschließend einen sicheren Link."
                : mode === "reset"
                  ? "Geben Sie ein neues persönliches Passwort mit mindestens 8 Zeichen ein."
                  : "Melden Sie sich mit Ihrer persönlichen LUMINA-E-Mail-Adresse an. Danach sehen Sie ausschließlich die Gesellschaften und Projekte, für die Sie berechtigt sind."}
            </p>

            {mode !== "reset" && <label>
              E-Mail-Adresse
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@unternehmen.de"
                required
              />
            </label>}

            {mode !== "forgot" && <label>
              {mode === "reset" ? "Neues Passwort" : "Passwort"}
              <input
                type="password"
                name="password"
                autoComplete={mode === "reset" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>}

            {error && <p className="formError" role="alert">{error}</p>}
            {message && <p className="formSuccess" role="status">{message}</p>}

            <button className="primaryButton" type="submit" disabled={pending || quickstartPending}>
              {pending ? "Bitte warten …" : mode === "forgot" ? "E-Mail anfordern" : mode === "reset" ? "Passwort speichern" : "Anmelden & Projektzentrale öffnen"}
            </button>

            {mode === "login" ? (
              <button className="textButton" type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>
                Passwort vergessen?
              </button>
            ) : (
              <button className="textButton" type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>
                Zurück zur Anmeldung
              </button>
            )}
          </form>

          {mode === "login" && <section className="quickstartAccess" aria-label="KAI Quickstart Testzugang">
            <div>
              <p className="miniLabel">Neu bei LUMINA?</p>
              <h3>Neues Projekt mit KAI starten</h3>
              <p>Für den Pilotbetrieb steht ein gemeinsamer Quickstart-Zugang bereit. Er öffnet ausschließlich den Einrichtungsassistenten – keine fremden Projektübersichten.</p>
            </div>
            <div className="quickstartCredentials">
              <span><b>E-Mail</b>{QUICKSTART_EMAIL}</span>
              <span><b>Passwort</b>{QUICKSTART_PASSWORD}</span>
            </div>
            <button className="quickstartEntryButton" type="button" onClick={handleQuickstart} disabled={quickstartPending || pending}>
              {quickstartPending ? "Quickstart wird geöffnet …" : "KAI Quickstart öffnen →"}
            </button>
            <small>Testzugang für die Pilotphase. Für den Produktivbetrieb erhält jeder Teilnehmer einen persönlichen Zugang.</small>
          </section>}
        </div>
      </section>
    </main>
  );
}
