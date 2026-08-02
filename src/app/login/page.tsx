"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError("E-Mail-Adresse oder Passwort ist nicht korrekt.");
        return;
      }

      router.replace("/workflow");
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
          <p className="eyebrow">Anmeldung</p>
          <h2 id="login-title">LUMINA öffnen</h2>
          <p className="formIntro">
            Melden Sie sich mit der in Supabase hinterlegten E-Mail-Adresse
            und Ihrem persönlichen Passwort an.
          </p>

          <label>
            E-Mail-Adresse
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            Passwort
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="formError" role="alert">{error}</p>}

          <button className="primaryButton" type="submit" disabled={pending}>
            {pending ? "Anmeldung wird geprüft …" : "Anmelden"}
          </button>

          <p className="formHelp">
            Der Zugang wird durch die LUMINA-Administration eingerichtet.
          </p>
        </form>
      </section>
    </main>
  );
}
