"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectHubContext } from "./project-hub";

export function ProjectSwitcher({ context, activeProjectId }: { context:ProjectHubContext; activeProjectId:string }){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const all=useMemo(()=>context.companies.flatMap(c=>(c.projects||[]).map(p=>({...p,companyName:c.name}))),[context]);
  const active=all.find(p=>p.id===activeProjectId);
  return <div className="projectSwitcher">
    <button className="projectSwitcherButton" onClick={()=>setOpen(v=>!v)} title="Gesellschaft oder Projekt wechseln"><span>{active?.companyName||"LUMINA"}</span><strong>{active?.name||"Projekt wählen"}</strong><b>⌄</b></button>
    {open&&<div className="projectSwitcherMenu">
      <div className="switcherMenuHead"><strong>Projekt wechseln</strong><button onClick={()=>router.push("/workflow")}>Alle Projekte</button></div>
      {context.companies.map(c=><div className="switcherCompany" key={c.id}><span>{c.name}</span>{(c.projects||[]).map(p=><button key={p.id} className={p.id===activeProjectId?"active":""} onClick={()=>{setOpen(false);router.push(`/workflow?project=${encodeURIComponent(p.id)}`)}}><span>{p.name}</span>{p.id===activeProjectId&&<b>✓</b>}</button>)}</div>)}
      <button className="switcherQuickstart" onClick={()=>router.push("/quickstart")}>+ Neues Projekt mit KAI</button>
    </div>}
  </div>;
}
