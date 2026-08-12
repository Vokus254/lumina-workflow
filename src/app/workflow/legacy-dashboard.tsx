"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProjectSwitcher } from "./project-switcher";
import type { ProjectHubContext } from "./project-hub";

export function LegacyDashboard({
  query,
  hubContext,
  activeProjectId,
  embedded = false,
  initialTab,
  onReady,
  onTaskSaved,
  onTaskClose,
}: {
  query: string;
  hubContext: ProjectHubContext;
  activeProjectId: string;
  embedded?: boolean;
  initialTab?: string | null;
  onReady?: () => void;
  onTaskSaved?: (update: { taskId: string; workStatus?: string; reviewStatus?: string; dueDate?: string | null; hasDocument?: boolean }) => void;
  onTaskClose?: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const closeObserverRef = useRef<MutationObserver | null>(null);
  const readyTimerRef = useRef<number | null>(null);

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
      { type: "lumina-session", accessToken: session.access_token, refreshToken: session.refresh_token },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "lumina-refresh-session") { await sendSession(); return; }
      if (event.data?.type === "lumina-task-saved") {
        onTaskSaved?.({ taskId: String(event.data.taskId || ""), workStatus: event.data.workStatus, reviewStatus: event.data.reviewStatus, dueDate: event.data.dueDate ?? null, hasDocument: typeof event.data.hasDocument === "boolean" ? event.data.hasDocument : undefined });
        return;
      }
      if (event.data?.type === "lumina-task-closed") { onTaskClose?.(); return; }
      if (event.data?.type !== "lumina-signout") return;
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [router, sendSession, onTaskSaved, onTaskClose]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  const frameSource = query ? `/legacy/lumina.html?${query}` : "/legacy/lumina.html";

  useEffect(() => {
    setFrameReady(false);
    closeObserverRef.current?.disconnect();
    closeObserverRef.current = null;
    if (readyTimerRef.current) window.clearInterval(readyTimerRef.current);
    readyTimerRef.current = null;
  }, [frameSource, initialTab]);

  useEffect(() => () => {
    closeObserverRef.current?.disconnect();
    if (readyTimerRef.current) window.clearInterval(readyTimerRef.current);
  }, []);

  const markReadyWhenWorkspaceIsOpen = useCallback(() => {
    if (!embedded) {
      setFrameReady(true);
      onReady?.();
      return;
    }

    const startedAt = Date.now();
    if (readyTimerRef.current) window.clearInterval(readyTimerRef.current);
    readyTimerRef.current = window.setInterval(() => {
      try {
        const doc = frameRef.current?.contentDocument;
        const modalBackdrop = doc?.getElementById("task-modal-backdrop");
        const workspaceOpen = Boolean(modalBackdrop?.classList.contains("open"));
        if (!workspaceOpen) {
          if (Date.now() - startedAt > 8000) {
            if (readyTimerRef.current) window.clearInterval(readyTimerRef.current);
            readyTimerRef.current = null;
            setError("Der Arbeitsraum konnte nicht vollständig geöffnet werden.");
          }
          return;
        }

        if (initialTab) {
          const tab = doc?.querySelector<HTMLButtonElement>(`.task-tab[data-tab="${initialTab}"]`);
          if (!tab) return;
          if (!tab.classList.contains("active")) {
            tab.click();
            return;
          }
        }

        if (readyTimerRef.current) window.clearInterval(readyTimerRef.current);
        readyTimerRef.current = null;
        requestAnimationFrame(() => {
          setFrameReady(true);
          onReady?.();
        });
      } catch {
        // Same-origin iframe is expected; keep waiting if the document is not ready yet.
      }
    }, 45);
  }, [embedded, initialTab, onReady]);

  const handleFrameLoad = useCallback(async () => {
    if (embedded) {
      try {
        const doc = frameRef.current?.contentDocument;
        if (doc && !doc.getElementById("lumina-p1a-embedded-style")) {
          const style = doc.createElement("style");
          style.id = "lumina-p1a-embedded-style";
          style.textContent = `
            body{background:#fff!important;}
            body > *:not(#task-modal-backdrop):not(script):not(style){display:none!important;}
            #task-modal-backdrop{display:none!important;}
            #task-modal-backdrop.open{
              display:flex!important;position:fixed!important;inset:0!important;
              padding:0!important;background:#fff!important;backdrop-filter:none!important;
              align-items:stretch!important;justify-content:stretch!important;overflow:hidden!important;
            }
            #task-modal-backdrop .task-modal{
              width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;
              margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;
              display:flex!important;flex-direction:column!important;background:#fff!important;
            }
            #task-modal-backdrop .task-modal-head{padding:20px 24px!important;background:#fff!important;}
            #task-modal-backdrop .task-modal-body{flex:1!important;min-height:0!important;overflow:auto!important;}
            #task-modal-backdrop .task-tabs{
              display:grid!important;grid-template-columns:repeat(7,minmax(92px,1fr))!important;gap:10px!important;
              border:0!important;margin:0 0 18px!important;padding:0!important;
            }
            #task-modal-backdrop .task-tab{
              box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;
              min-height:58px!important;padding:10px 9px!important;border:1px solid #dfe7e3!important;
              border-radius:10px!important;background:#fff!important;color:#52645e!important;
              text-align:center!important;font-weight:700!important;line-height:1.2!important;
              box-shadow:0 1px 2px rgba(15,42,34,.04)!important;
            }
            #task-modal-backdrop .task-tab:hover{border-color:#9bcab9!important;background:#f5fbf8!important;color:#176b53!important;}
            #task-modal-backdrop .task-tab.active{
              border-color:#4faf8a!important;background:#eaf7f1!important;color:#126b50!important;
              box-shadow:0 0 0 1px rgba(79,175,138,.08)!important;
            }
            .lumina-session,.lumina-sync-state,.lumina-structure-loading{display:none!important;}
            @media(max-width:1050px){#task-modal-backdrop .task-tabs{grid-template-columns:repeat(4,minmax(110px,1fr))!important;}}
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
        // Progressive enhancement only.
      }
    }
    await sendSession();
    markReadyWhenWorkspaceIsOpen();
  }, [embedded, sendSession, onTaskClose, markReadyWhenWorkspaceIsOpen]);

  if (embedded) {
    return <main style={{ width: "100%", height: "100%", minHeight: 0, overflow: "hidden", background: "#fff", position: "relative" }}>
      {error && <div className="legacyError" role="alert">{error}</div>}
      <iframe
        ref={frameRef}
        src={frameSource}
        title="LUMINA Arbeitsraum"
        onLoad={handleFrameLoad}
        style={{ display: "block", width: "100%", height: "100%", border: 0, background: "#fff", opacity: frameReady ? 1 : 0 }}
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
