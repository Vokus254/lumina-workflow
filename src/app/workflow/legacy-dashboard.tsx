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
  skin = "lumina",
}: {
  query: string;
  hubContext: ProjectHubContext;
  activeProjectId: string;
  embedded?: boolean;
  initialTab?: string | null;
  onReady?: () => void;
  onTaskSaved?: (update: { taskId: string; workStatus?: string; reviewStatus?: string; dueDate?: string | null; hasDocument?: boolean }) => void;
  onTaskClose?: () => void;
  skin?: "lumina" | "blue" | "light" | "yellow";
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

  useEffect(() => {
    if (!embedded) return;
    const palettes = {
      lumina: { bg:"#F4F6F4", card:"#FFFFFF", line:"#E2E7E3", ink:"#10201B", ink2:"#3C4A45", ink3:"#77837E", primary:"#0E8C6D", primaryDark:"#0A6B53", primarySoft:"#E3F2EC", radius:"10px" },
      blue: { bg:"#F5F6F7", card:"#FFFFFF", line:"#D5DADD", ink:"#1D2D3E", ink2:"#475E75", ink3:"#6A7F93", primary:"#0A6ED1", primaryDark:"#075CAF", primarySoft:"#EAF3FC", radius:"6px" },
      light: { bg:"#F7F7F8", card:"#FFFFFF", line:"#E5E5E5", ink:"#202123", ink2:"#565869", ink3:"#8E8EA0", primary:"#10A37F", primaryDark:"#0B7F63", primarySoft:"#E8F7F2", radius:"10px" },
      yellow: { bg:"#FAF9F5", card:"#FFFDF8", line:"#E8E1D7", ink:"#2D2926", ink2:"#655D57", ink3:"#8A817A", primary:"#C15F3C", primaryDark:"#9D472B", primarySoft:"#F7E9E2", radius:"14px" },
    } as const;
    const apply = () => {
      try {
        const root = frameRef.current?.contentDocument?.documentElement;
        if (!root) return;
        const p = palettes[skin];
        root.style.setProperty("--p1a-bg", p.bg);
        root.style.setProperty("--p1a-card", p.card);
        root.style.setProperty("--p1a-line", p.line);
        root.style.setProperty("--p1a-ink", p.ink);
        root.style.setProperty("--p1a-ink2", p.ink2);
        root.style.setProperty("--p1a-ink3", p.ink3);
        root.style.setProperty("--p1a-primary", p.primary);
        root.style.setProperty("--p1a-primary-dark", p.primaryDark);
        root.style.setProperty("--p1a-primary-soft", p.primarySoft);
        root.style.setProperty("--p1a-radius", p.radius);
      } catch { /* same-origin iframe expected */ }
    };
    apply();
    const timer = window.setInterval(apply, 120);
    return () => window.clearInterval(timer);
  }, [embedded, skin]);

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
            :root{--p1a-bg:#f4f6f4;--p1a-card:#fff;--p1a-line:#e2e7e3;--p1a-ink:#10201b;--p1a-ink2:#3c4a45;--p1a-ink3:#77837e;--p1a-primary:#0e8c6d;--p1a-primary-dark:#0a6b53;--p1a-primary-soft:#e3f2ec;--p1a-radius:10px;}
            body{background:var(--p1a-card)!important;color:var(--p1a-ink)!important;}
            body > *:not(#task-modal-backdrop):not(script):not(style){display:none!important;}
            #task-modal-backdrop{display:none!important;}
            #task-modal-backdrop.open{display:flex!important;position:fixed!important;inset:0!important;padding:0!important;background:var(--p1a-card)!important;backdrop-filter:none!important;align-items:stretch!important;justify-content:stretch!important;overflow:hidden!important;}
            #task-modal-backdrop .task-modal{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;background:var(--p1a-card)!important;color:var(--p1a-ink)!important;}
            #task-modal-backdrop .task-modal-head{padding:20px 24px!important;background:var(--p1a-card)!important;border-color:var(--p1a-line)!important;}
            #task-modal-backdrop .task-modal-sub,#task-modal-backdrop .task-field label,#task-modal-backdrop .task-section h3,#task-modal-backdrop .task-file-note,#task-modal-backdrop .submission-meta,#task-modal-backdrop .activity-meta{color:var(--p1a-ink3)!important;}
            #task-modal-backdrop .task-modal-body{flex:1!important;min-height:0!important;overflow:auto!important;background:var(--p1a-card)!important;}
            #task-modal-backdrop .task-main{background:var(--p1a-card)!important;}
            #task-modal-backdrop .task-side,#task-modal-backdrop .task-footer{background:var(--p1a-bg)!important;border-color:var(--p1a-line)!important;}
            #task-modal-backdrop .task-tabs{display:grid!important;grid-template-columns:repeat(7,minmax(92px,1fr))!important;gap:10px!important;border:0!important;margin:0 0 18px!important;padding:0!important;background:transparent!important;width:auto!important;}
            #task-modal-backdrop .task-tab{box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:58px!important;padding:10px 9px!important;border:1px solid var(--p1a-line)!important;border-radius:var(--p1a-radius)!important;background:var(--p1a-card)!important;color:var(--p1a-ink2)!important;text-align:center!important;font-weight:700!important;line-height:1.2!important;box-shadow:none!important;}
            #task-modal-backdrop .task-tab:hover{border-color:var(--p1a-primary)!important;background:var(--p1a-primary-soft)!important;color:var(--p1a-primary-dark)!important;}
            #task-modal-backdrop .task-tab.active{border-color:var(--p1a-primary)!important;background:var(--p1a-primary-soft)!important;color:var(--p1a-primary-dark)!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--p1a-primary) 10%,transparent)!important;}
            #task-modal-backdrop .task-field input,#task-modal-backdrop .task-field select,#task-modal-backdrop .task-field textarea,#task-modal-backdrop input[type=file],#task-modal-backdrop .submission-item,#task-modal-backdrop .activity-item,#task-modal-backdrop .email-preview{background:var(--p1a-card)!important;color:var(--p1a-ink)!important;border-color:var(--p1a-line)!important;}
            #task-modal-backdrop .btn-save,#task-modal-backdrop .btn-primary,#task-modal-backdrop button.primary,#task-modal-backdrop .task-action-btn.primary{background:var(--p1a-primary)!important;border-color:var(--p1a-primary)!important;color:#fff!important;}
            #task-modal-backdrop a{color:var(--p1a-primary-dark)!important;}
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
    return <main style={{ width: "100%", height: "100%", minHeight: 0, overflow: "hidden", background: "transparent", position: "relative" }}>
      {error && <div className="legacyError" role="alert">{error}</div>}
      <iframe
        ref={frameRef}
        src={frameSource}
        title="LUMINA Arbeitsraum"
        onLoad={handleFrameLoad}
        style={{ display: "block", width: "100%", height: "100%", border: 0, background: "transparent", opacity: frameReady ? 1 : 0 }}
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
