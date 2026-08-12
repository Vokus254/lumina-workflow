"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectSwitcher } from "./project-switcher";
import type { ProjectHubContext } from "./project-hub";

export function LegacyDashboard({ query, hubContext, activeProjectId, embedded = false, onTaskClose }: { query:string; hubContext:ProjectHubContext; activeProjectId:string; embedded?:boolean; onTaskClose?:() => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const closeObserverRef = useRef<MutationObserver | null>(null);

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
      if (event.data?.type === "lumina-task-closed") { onTaskClose?.(); return; }
      if (event.data?.type !== "lumina-signout") return;
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login"); router.refresh();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router, sendSession, onTaskClose]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login"); router.refresh();
  }, [router]);

  const frameSource = query ? `/legacy/lumina.html?${query}` : "/legacy/lumina.html";

  useEffect(() => {
    setFrameReady(false);
    closeObserverRef.current?.disconnect();
    closeObserverRef.current = null;
  }, [frameSource]);

  useEffect(() => () => { closeObserverRef.current?.disconnect(); }, []);

  const handleFrameLoad = useCallback(async () => {
    if (embedded) {
      try {
        const doc = frameRef.current?.contentDocument;
        if (doc && !doc.getElementById("lumina-p1a-embedded-style")) {
          const style = doc.createElement("style");
          style.id = "lumina-p1a-embedded-style";
          style.textContent = `
            /* P1A embedded mode: the legacy dashboard must never be visible behind a task workspace. */
            body > *:not(#task-modal-backdrop):not(script):not(style){display:none!important;}
            #task-modal-backdrop{display:none!important;}
            #task-modal-backdrop.open{display:flex!important;}
            .lumina-session,.lumina-sync-state,.lumina-structure-loading{display:none!important;}
          `;
          doc.head.appendChild(style);
        }

        const modalBackdrop = doc?.getElementById("task-modal-backdrop");
        closeObserverRef.current?.disconnect();
        if (modalBackdrop && onTaskClose) {
          let wasOpen = modalBackdrop.classList.contains("open");
          const observer = new MutationObserver(() => {
            const isOpen = modalBackdrop.classList.contains("open");
            if (wasOpen && !isOpen) onTaskClose();
            wasOpen = isOpen;
          });
          observer.observe(modalBackdrop, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
          closeObserverRef.current = observer;
        }
      } catch {
        // Same-origin styling is a progressive enhancement. The iframe remains usable without it.
      }
    }
    await sendSession();
    window.setTimeout(() => setFrameReady(true), embedded ? 220 : 0);
  }, [embedded, sendSession, onTaskClose]);

  if (embedded) {
    return <main style={{ width:"100%", height:"100%", minHeight:0, overflow:"hidden", background:"#fff", position:"relative" }}>
      {error && <div className="legacyError" role="alert">{error}</div>}
      <iframe
        ref={frameRef}
        src={frameSource}
        title="LUMINA Abschlussprozess"
        onLoad={handleFrameLoad}
        style={{ display:"block", width:"100%", height:"100%", border:0, background:"#fff", opacity:frameReady ? 1 : 0 }}
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
