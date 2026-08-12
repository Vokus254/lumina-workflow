"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectSwitcher } from "./project-switcher";
import type { ProjectHubContext } from "./project-hub";

export function LegacyDashboard({ query, hubContext, activeProjectId, embedded = false }: { query:string; hubContext:ProjectHubContext; activeProjectId:string; embedded?:boolean }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");

  const sendSession = useCallback(async () => {
    const supabase = createClient();
    const { data, error: sessionError } = await supabase.auth.getSession();
    let session = data.session;
    if (session?.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 30) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed.session) session = refreshed.session;
    }
    if (sessionError || !session) {
      setError("Die Sitzung konnte nicht an das Dashboard übergeben werden.");
      return;
    }

    frameRef.current?.contentWindow?.postMessage(
      { type:"lumina-session",accessToken:session.access_token,refreshToken:session.refresh_token },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lumina-refresh-session") { await sendSession(); return; }
      if (event.data?.type !== "lumina-signout") return;
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login"); router.refresh();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router, sendSession]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login"); router.refresh();
  }, [router]);

  const frameSource = query ? `/legacy/lumina.html?${query}` : "/legacy/lumina.html";

  const handleFrameLoad = useCallback(async () => {
    if (embedded) {
      try {
        const doc = frameRef.current?.contentDocument;
        if (doc && !doc.getElementById("lumina-p1a-embedded-style")) {
          const style = doc.createElement("style");
          style.id = "lumina-p1a-embedded-style";
          style.textContent = `
            .header{min-height:0!important;margin:0 0 14px!important;padding:0 0 12px!important;border-bottom:1px solid var(--border)!important;display:flex!important;align-items:center!important;gap:12px!important;}
            .header::before{content:"Prozesswerkzeuge";font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);white-space:nowrap;}
            .header-brand{display:none!important;}
            .top-toolbar{width:100%!important;justify-content:flex-end!important;}
            .lumina-session{display:none!important;}
            .page{padding-top:20px!important;}
          `;
          doc.head.appendChild(style);
        }
      } catch {
        // Same-origin styling is a progressive enhancement. The iframe remains usable without it.
      }
    }
    await sendSession();
  }, [embedded, sendSession]);

  if (embedded) {
    return <main style={{ width:"100%", height:"100%", minHeight:0, overflow:"hidden", background:"#fff", position:"relative" }}>
      {error && <div className="legacyError" role="alert">{error}</div>}
      <iframe
        ref={frameRef}
        src={frameSource}
        title="LUMINA Abschlussprozess"
        onLoad={handleFrameLoad}
        style={{ display:"block", width:"100%", height:"100%", border:0, background:"#fff" }}
      />
    </main>;
  }

  return <main className="legacyDashboard">
    {error && <div className="legacyError" role="alert">{error}</div>}
    <ProjectSwitcher context={hubContext} activeProjectId={activeProjectId}/>
    <button className="dashboardQuickstart" type="button" onClick={() => router.push("/quickstart")}>KAI Quickstart</button>
    <button className="dashboardSignOut" type="button" onClick={handleSignOut}>Abmelden</button>
    <iframe ref={frameRef} className="legacyFrame" src={frameSource} title="LUMINA Abschluss-Cockpit" onLoad={handleFrameLoad}/>
  </main>;
}
