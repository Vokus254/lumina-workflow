"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LegacyDashboard({ query }: { query: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");

  const sendSession = useCallback(async () => {
    const supabase = createClient();
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    const fallback = refreshed.session ? null : await supabase.auth.getSession();
    const session = refreshed.session ?? fallback?.data.session ?? null;
    const sessionError = refreshError && !session ? refreshError : fallback?.error;
    if (sessionError || !session) {
      setError("Die Sitzung konnte nicht an das Dashboard übergeben werden.");
      return;
    }

    frameRef.current?.contentWindow?.postMessage(
      {
        type: "lumina-session",
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lumina-refresh-session") {
        await sendSession();
        return;
      }
      if (event.data?.type !== "lumina-signout") return;
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router, sendSession]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const frameSource = query
    ? `/legacy/lumina.html?${query}`
    : "/legacy/lumina.html";

  return (
    <main className="legacyDashboard">
      {error && <div className="legacyError" role="alert">{error}</div>}
      <button className="dashboardSignOut" type="button" onClick={handleSignOut}>
        Abmelden
      </button>
      <iframe
        ref={frameRef}
        className="legacyFrame"
        src={frameSource}
        title="LUMINA Abschluss-Cockpit"
        onLoad={sendSession}
      />
    </main>
  );
}
