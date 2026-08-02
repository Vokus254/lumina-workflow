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
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) {
      setError("Die Sitzung konnte nicht an das Dashboard übergeben werden.");
      return;
    }

    frameRef.current?.contentWindow?.postMessage(
      {
        type: "lumina-session",
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== "lumina-signout") return;
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router]);

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
