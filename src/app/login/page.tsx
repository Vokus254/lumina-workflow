"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const requestedTarget = params.get("next");
    const targetEmail = requestedTarget
      ? new URLSearchParams(requestedTarget.split("?")[1] || "").get("email")
      : null;
    const requestedEmail = params.get("email") || targetEmail;
    const timer = window.setTimeout(() => {
      if (requestedMode === "reset") setMode("reset");
      if (requestedEmail) setEmail(requestedEmail);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
          { redirectTo: `${window.location.origin}/login?mode=reset` },
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

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("E-Mail-Adresse oder Passwort ist nicht korrekt.");
        return;
      }

      const requestedTarget = new URLSearchParams(window.location.search).get("next");
      const target = requestedTarget?.startsWith("/workflow")
        ? requestedTarget
        : "/workflow";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Die Anmeldung ist momentan nicht erreichbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authIntro">
        <div className="authBrand">
          <span className="brandMark" aria-hidden="true" />
          <div>
            <strong>LUMINA Workflow</strong>
            <span>Jahresabschluss sicher koordinieren</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Geschützter Arbeitsbereich</p>
          <h1>Willkommen<br />zurück.</h1>
          <p className="lead">
            Aufgaben, Termine und Dokumente für den Jahresabschluss an einem
            zentralen Ort.
          </p>
        </div>
        <p className="authNotice">Testsystem · Noch keine Produktivdaten</p>
      </section>

      <section className="loginPanel" aria-labelledby="login-title">
        <form className="loginCard" onSubmit={handleSubmit}>
          <p className="eyebrow">{mode === "login" ? "Anmeldung" : "Passwort"}</p>
          <h2 id="login-title">
            {mode === "forgot" ? "Passwort zurücksetzen" : mode === "reset" ? "Neues Passwort festlegen" : "LUMINA öffnen"}
          </h2>
          <p className="formIntro">
            {mode === "forgot"
              ? "Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten anschließend einen sicheren Link."
              : mode === "reset"
                ? "Geben Sie ein neues persönliches Passwort mit mindestens 8 Zeichen ein."
                : "Melden Sie sich mit der in Supabase hinterlegten E-Mail-Adresse und Ihrem persönlichen Passwort an."}
          </p>

          {mode !== "reset" && <label>
            E-Mail-Adresse
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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

          <button className="primaryButton" type="submit" disabled={pending}>
            {pending ? "Bitte warten …" : mode === "forgot" ? "E-Mail anfordern" : mode === "reset" ? "Passwort speichern" : "Anmelden"}
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

          <p className="formHelp">
            Der Zugang wird durch die LUMINA-Administration eingerichtet.
          </p>
        </form>
      </section>
    </main>
  );
}
