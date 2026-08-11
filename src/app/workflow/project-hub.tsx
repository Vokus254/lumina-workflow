"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id:string;
  name:string;
  fiscal_year_start:string;
  fiscal_year_end:string;
  reporting_date:string;
  status:string;
  project_role?:string;
  tasks_total:number;
  tasks_completed:number;
  tasks_overdue:number;
};

type Company = {
  id:string;
  name:string;
  legal_form?:string|null;
  registered_office?:string|null;
  currency_code?:string|null;
  company_role?:string;
  can_manage_company?:boolean;
  projects:Project[];
};

export type ProjectHubContext = { companies:Company[] };

function roleLabel(role?:string){
  return ({owner:"Owner",manager:"Manager",reviewer:"Reviewer",viewer:"Lesen",contributor:"Bearbeitung",member:"Mitglied"} as Record<string,string>)[role||""] || role || "Projektrolle";
}

export function ProjectHub({ context, userEmail = "", isAdmin = false }: { context: ProjectHubContext; userEmail?: string; isAdmin?: boolean }) {
  const router=useRouter();
  const [signingOut,setSigningOut]=useState(false);
  const companies=context.companies||[];
  const [companyId,setCompanyId]=useState(companies[0]?.id||"");
  const selected=useMemo(()=>companies.find(c=>c.id===companyId)||companies[0],[companies,companyId]);

  return <main className="projectHubPage">
    <header className="projectHubHeader">
      <div className="authBrand"><span className="brandMark"/><div><strong>LUMINA</strong><span>Gesellschaften & Projekte</span></div></div>
      <div className="hubHeaderActions">
        {userEmail&&<span className="hubUserEmail">{userEmail}</span>}
        {isAdmin&&<button className="hubAdminButton" onClick={()=>router.push("/admin")}>Administration</button>}
        <button className="hubQuickstart" onClick={()=>router.push("/quickstart?mode=company&fresh=1")}>+ KAI Quickstart</button>
        <button className="hubSignOut" disabled={signingOut} onClick={async()=>{setSigningOut(true);const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh();}}>Abmelden</button>
      </div>
    </header>
    <section className="projectHubHero">
      <p className="eyebrow">Projektzentrale</p>
      <h1>Welchen Abschluss möchten Sie öffnen?</h1>
      <p>Jedes Projekt besitzt eigene 202 Maßnahmen, eigene Status, Dokumente und Berechtigungen. Projekte werden niemals zusammengezählt.</p>
    </section>
    {companies.length===0 ? <section className="emptyHub"><h2>Noch keine Gesellschaft vorhanden.</h2><p>KAI legt mit Ihnen die erste Gesellschaft und das erste Abschlussprojekt an.</p><button className="primaryButton" onClick={()=>router.push("/quickstart?mode=company")}>Mit KAI starten</button></section> : <>
      <nav className="companyTabs" aria-label="Gesellschaft auswählen">
        {companies.map(c=><button key={c.id} className={selected?.id===c.id?"active":""} onClick={()=>setCompanyId(c.id)}><strong>{c.name}</strong><span>{c.projects?.length||0} Projekte</span></button>)}
      </nav>
      {selected&&<section className="companyProjectSection">
        <div className="companyProjectHead"><div><p className="miniLabel">{selected.company_role?`Ihre Gesellschaftsrolle: ${roleLabel(selected.company_role)}`:"Projektzugriff"}</p><h2>{selected.name}</h2><p>{[selected.legal_form,selected.registered_office].filter(Boolean).join(" · ")}</p></div>{selected.can_manage_company&&<button className="secondaryButton" onClick={()=>router.push(`/quickstart?company=${encodeURIComponent(selected.id)}`)}>+ Projekt anlegen</button>}</div>
        <div className="projectCardGrid">
          {(selected.projects||[]).map(p=>{
            const pct=p.tasks_total?Math.round((p.tasks_completed/p.tasks_total)*100):0;
            return <button key={p.id} className="projectCardButton" onClick={()=>router.push(`/workflow?project=${encodeURIComponent(p.id)}`)}>
              <div className="projectCardTop"><span className={`projectStatus status-${p.status}`}>{p.status}</span><span className="projectRole">{roleLabel(p.project_role)||"Zugriff"}</span></div>
              <h3>{p.name}</h3><p>Stichtag {p.reporting_date?.split("-").reverse().join(".")}</p>
              <div className="projectProgress"><span style={{width:`${pct}%`}}/></div>
              <div className="projectStats"><div><strong>{pct}%</strong><span>Fortschritt</span></div><div><strong>{p.tasks_total}</strong><span>Aufgaben</span></div><div className={p.tasks_overdue?"danger":""}><strong>{p.tasks_overdue}</strong><span>Überfällig</span></div></div>
              <span className="openProject">Projekt öffnen →</span>
            </button>;
          })}
          {selected.projects?.length===0&&<div className="emptyProjectCard"><strong>Keine freigeschalteten Projekte</strong><p>Sie sind Mitglied der Gesellschaft, aber aktuell keinem Projekt zugeordnet.</p>{selected.can_manage_company&&<button className="secondaryButton" onClick={()=>router.push(`/quickstart?company=${encodeURIComponent(selected.id)}`)}>Projekt mit KAI anlegen</button>}</div>}
        </div>
      </section>}
    </>}
  </main>;
}
