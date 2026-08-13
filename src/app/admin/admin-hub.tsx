"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AdminTab = "users" | "companies" | "projects" | "measures" | "permissions";
type User={id:string;email:string;firstName:string;lastName:string;displayName:string;createdAt?:string;lastSignInAt?:string;bannedUntil?:string|null;blocked:boolean};
type Company={id:string;name:string;legal_form?:string|null;registered_office?:string|null;currency_code:string;status:string;created_at:string;updated_at:string};
type Project={id:string;company_id:string;name:string;fiscal_year_start:string;fiscal_year_end:string;reporting_date:string;status:string;created_at:string;taskCount:number;documentCount:number};
type CM={company_id:string;user_id:string;company_role:string;active:boolean};
type PM={project_id:string;user_id:string;security_role:string;active:boolean};
type RA={user_id:string;role_id:string;project_id:string;role_key:string;display_name:string;assignedTaskCount:number};
type RR={id:string;project_id:string;role_key:string;display_name:string};
type ProcessStep={id:string;project_id:string;code:string;name:string;sort_order:number};
type AdminTask={id:string;project_id:string;process_step_id?:string|null;responsibility_role_id?:string|null;source_number?:string|null;title:string;required_documents_text?:string|null;due_date?:string|null;work_status:string;review_status:string;legacy_source_key?:string};
type Data={currentAdmin:{id:string;email:string;isSuperAdmin?:boolean};users:User[];companies:Company[];projects:Project[];companyMembers:CM[];projectMembers:PM[];roleAssignments:RA[];responsibilityRoles:RR[];processSteps:ProcessStep[];tasks:AdminTask[]};

const fmt=(d?:string|null)=>d?new Date(`${d.slice(0,10)}T12:00:00`).toLocaleDateString("de-DE"):"–";
const isTab=(v:string|null):v is AdminTab=>v==="users"||v==="companies"||v==="projects"||v==="measures"||v==="permissions";

const emptyTaskForm={id:"",sourceNumber:"",processStepId:"",responsibilityRoleId:"",title:"",requiredDocuments:"",dueDate:"",workStatus:"open",reviewStatus:"unreviewed"};

export default function AdminHub({
  initialTab:initialTabProp,
  embedded=false,
  activeProjectId,
  onBack,
}:{initialTab?:AdminTab;embedded?:boolean;activeProjectId?:string;onBack?:()=>void}={}){
  const router=useRouter();
  const searchParams=useSearchParams();
  const requestedTab=searchParams.get("tab");
  const initialTab=initialTabProp||(isTab(requestedTab)?requestedTab:"users");
  const [data,setData]=useState<Data|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState<AdminTab>(initialTab);
  const [q,setQ]=useState("");
  const [userForm,setUserForm]=useState({id:"",firstName:"",lastName:"",email:"",password:""});
  const [companyForm,setCompanyForm]=useState({id:"",name:"",legalForm:"GmbH",registeredOffice:"",currencyCode:"EUR"});
  const [projectForm,setProjectForm]=useState({id:"",companyId:"",name:"",fiscalYearStart:"2026-01-01",fiscalYearEnd:"2026-12-31",reportingDate:"2026-12-31",ownerUserId:""});
  const [perm,setPerm]=useState({userId:"",companyId:"",companyRole:"member",projectId:"",projectRole:"viewer",roleId:""});
  const [taskForm,setTaskForm]=useState(emptyTaskForm);

  async function load(){
    setError("");
    const r=await fetch("/api/admin",{cache:"no-store"});
    const j=await r.json();
    if(!r.ok){setError(j.error||"Laden fehlgeschlagen");return;}
    setData(j);
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{if(initialTabProp)setTab(initialTabProp);},[initialTabProp]);

  async function act(payload:Record<string,unknown>,confirmText?:string){
    if(confirmText&&!window.confirm(confirmText))return null;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/admin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Aktion fehlgeschlagen");
      await load();
      router.refresh();
      return j;
    }catch(e:unknown){setError(e instanceof Error?e.message:"Aktion fehlgeschlagen");return null;}
    finally{setBusy(false);}
  }

  const uq=q.trim().toLowerCase();
  const users=useMemo(()=>data?.users.filter(u=>`${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(uq))||[],[data,uq]);
  const companies=useMemo(()=>data?.companies.filter(c=>`${c.name} ${c.legal_form||""} ${c.registered_office||""}`.toLowerCase().includes(uq))||[],[data,uq]);
  const projects=useMemo(()=>data?.projects.filter(p=>`${p.name} ${data?.companies.find(c=>c.id===p.company_id)?.name||""} ${p.reporting_date}`.toLowerCase().includes(uq))||[],[data,uq]);
  const activeProject=data?.projects.find(p=>p.id===activeProjectId);
  const activeSteps=useMemo(()=>(data?.processSteps||[]).filter(s=>s.project_id===activeProjectId).sort((a,b)=>a.sort_order-b.sort_order||a.code.localeCompare(b.code,"de",{numeric:true})),[data,activeProjectId]);
  const activeRoles=useMemo(()=>(data?.responsibilityRoles||[]).filter(r=>r.project_id===activeProjectId),[data,activeProjectId]);
  const measures=useMemo(()=>{
    const steps=new Map<string,ProcessStep>((data?.processSteps||[]).map(s=>[s.id,s] as const));
    return (data?.tasks||[]).filter(t=>t.project_id===activeProjectId).filter(t=>{
      if(!uq)return true;
      const step=t.process_step_id?steps.get(t.process_step_id):undefined;
      return `${t.source_number||""} ${step?.code||""} ${step?.name||""} ${t.title} ${t.required_documents_text||""}`.toLowerCase().includes(uq);
    }).sort((a,b)=>String(a.source_number||"").localeCompare(String(b.source_number||""),"de",{numeric:true})||a.title.localeCompare(b.title,"de"));
  },[data,activeProjectId,uq]);


  const userAccess = (userId:string) => {
    const cms=data?.companyMembers.filter(m=>m.user_id===userId&&m.active)||[];
    const pms=data?.projectMembers.filter(m=>m.user_id===userId&&m.active)||[];
    const ras=data?.roleAssignments.filter(a=>a.user_id===userId)||[];
    const projectIds=new Set<string>([...pms.map(m=>m.project_id),...ras.map(a=>a.project_id)]);
    const projectRows=(data?.projects||[]).filter(p=>projectIds.has(p.id));
    const companyIds=new Set<string>([...cms.map(m=>m.company_id),...projectRows.map(p=>p.company_id)]);
    const companyRows=(data?.companies||[]).filter(c=>companyIds.has(c.id));
    const taskCount=ras.reduce((sum,a)=>sum+(a.assignedTaskCount||0),0);
    return {cms,pms,ras,projectRows,companyRows,taskCount};
  };

  function editTask(t:AdminTask){
    setTaskForm({id:t.id,sourceNumber:t.source_number||"",processStepId:t.process_step_id||"",responsibilityRoleId:t.responsibility_role_id||"",title:t.title,requiredDocuments:t.required_documents_text||"",dueDate:t.due_date?.slice(0,10)||"",workStatus:t.work_status||"open",reviewStatus:t.review_status||"unreviewed"});
  }
  async function saveTask(){
    if(!activeProjectId){setError("Kein aktives Projekt ausgewählt.");return;}
    if(!taskForm.title.trim()){setError("Bitte eine Aufgabenbezeichnung eingeben.");return;}
    const payload={projectId:activeProjectId,sourceNumber:taskForm.sourceNumber,processStepId:taskForm.processStepId,responsibilityRoleId:taskForm.responsibilityRoleId,title:taskForm.title,requiredDocuments:taskForm.requiredDocuments,dueDate:taskForm.dueDate,workStatus:taskForm.workStatus,reviewStatus:taskForm.reviewStatus};
    const result=taskForm.id?await act({action:"update_task",taskId:taskForm.id,...payload}):await act({action:"create_task",...payload});
    if(result)setTaskForm(emptyTaskForm);
  }

  if(!data)return <main className={embedded?"adminEmbedded":"adminPage"}><p>{error||"Administration wird geladen …"}</p></main>;
  const blocked=data.users.filter(u=>u.blocked).length, archived=data.projects.filter(p=>p.status==="archived").length;
  const title=tab==="users"?"Benutzer verwalten":tab==="companies"?"Gesellschaften":tab==="projects"?"Projekte":tab==="measures"?"Maßnahmen":"Rollen & Berechtigungen";
  const isSuperAdmin=Boolean(data.currentAdmin.isSuperAdmin);

  return <main className={embedded?"adminEmbedded":"adminPage"}>
    {!embedded&&<header className="adminTop"><div className="brandRow"><div className="brandMark"/><div><strong>LUMINA</strong><span>Administration</span></div></div><div className="adminTopActions"><button onClick={()=>router.push("/workflow")}>Zur Projektzentrale</button><button className="dangerSoft" onClick={async()=>{const supabase=createClient();await supabase.auth.signOut();router.replace("/login");router.refresh();}}>Abmelden</button></div></header>}
    {!embedded&&<section className="adminHero"><div><p className="miniLabel">ZENTRALE VERWALTUNG</p><h1>Benutzer, Gesellschaften und Projekte</h1><p>Globaler Überblick und sichere Verwaltung aller LUMINA-Mandanten.</p></div><div className="adminStats"><div><b>{data.users.length}</b><span>Benutzer</span></div><div><b>{data.companies.length}</b><span>Gesellschaften</span></div><div><b>{data.projects.length}</b><span>Projekte</span></div><div><b>{blocked}</b><span>gesperrt</span></div><div><b>{archived}</b><span>archiviert</span></div></div></section>}
    {embedded&&<div className="adminEmbeddedTitle"><div><button type="button" className="adminBack" onClick={onBack}>← Administration</button><h1>{title}</h1><p>{tab==="measures"?`${activeProject?.name||"Aktives Projekt"} · ${measures.length} Maßnahmen`:"Zentrale Verwaltung innerhalb der LUMINA-Arbeitsoberfläche."}</p></div></div>}
    {isSuperAdmin&&<div className="superAdminNotice"><b>Superadmin Vollzugriff</b><span>Alle Gesellschaften, Projekte, Prozessbereiche und Verwaltungsaktionen sind freigeschaltet.</span></div>}
    {error&&<div className="adminError">{error}</div>}
    <div className="adminToolbar"><div className="adminTabs">
      <button className={tab==="users"?"active":""} onClick={()=>setTab("users")}>Benutzer</button>
      <button className={tab==="companies"?"active":""} onClick={()=>setTab("companies")}>Gesellschaften</button>
      <button className={tab==="projects"?"active":""} onClick={()=>setTab("projects")}>Projekte</button>
      <button className={tab==="measures"?"active":""} onClick={()=>setTab("measures")}>Maßnahmen</button>
      <button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}>Berechtigungen</button>
    </div><input className="adminSearch" placeholder="Suchen …" value={q} onChange={e=>setQ(e.target.value)}/></div>

    {tab==="users"&&<section className="adminGrid2 adminUsersWorkspace"><div className="adminPanel"><div className="panelHead"><h2>Benutzer</h2><button onClick={()=>setUserForm({id:"",firstName:"",lastName:"",email:"",password:""})}>+ Neu</button></div><div className="adminTableWrap"><table className="adminTable adminUserTable"><thead><tr><th>Name / E-Mail</th><th>Gesellschaft</th><th>Projekt</th><th>Workflow-Rolle</th><th>Aufgaben</th><th>Status</th><th>Letzter Login</th><th/></tr></thead><tbody>{users.map(u=>{const access=userAccess(u.id);return <tr key={u.id}><td><b>{[u.firstName,u.lastName].filter(Boolean).join(" ")||u.displayName||"–"}</b><small>{u.email}{u.email.toLowerCase()==="adminall@volkerkusch.de"?" · Superadmin":""}</small></td><td>{access.companyRows.length?access.companyRows.map(c=><span className="adminAccessLine" key={c.id}>{c.name}</span>):"–"}</td><td>{access.projectRows.length?access.projectRows.map(p=><span className="adminAccessLine" key={p.id}>{p.name}</span>):"–"}</td><td>{access.ras.length?access.ras.map(a=><span className="adminAccessLine" key={a.role_id}>{a.display_name} · {a.assignedTaskCount}</span>):"–"}</td><td><b>{access.taskCount}</b></td><td><span className={`statusPill ${u.blocked?"locked":"active"}`}>{u.blocked?"Gesperrt":"Aktiv"}</span></td><td>{fmt(u.lastSignInAt)}</td><td><button onClick={()=>setUserForm({id:u.id,firstName:u.firstName,lastName:u.lastName,email:u.email,password:""})}>Bearbeiten</button></td></tr>})}</tbody></table></div></div><div className="adminPanel formPanel"><h2>{userForm.id?"Benutzer bearbeiten":"Benutzer anlegen"}</h2><label>Vorname<input value={userForm.firstName} onChange={e=>setUserForm({...userForm,firstName:e.target.value})}/></label><label>Nachname<input value={userForm.lastName} onChange={e=>setUserForm({...userForm,lastName:e.target.value})}/></label><label>E-Mail<input type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></label>{!userForm.id&&<label>Startpasswort (optional)<input type="password" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></label>}<button className="primaryButton" disabled={busy} onClick={async()=>{if(userForm.id){await act({action:"update_user",userId:userForm.id,...userForm});}else{const result=await act({action:"create_user",...userForm});if(result?.temporaryPassword)window.alert(`Sicheres Einmalpasswort: ${result.temporaryPassword}`);}}}>{userForm.id?"Änderungen speichern":"Benutzer anlegen"}</button>{userForm.id&&<><div className="buttonRow"><button onClick={()=>act({action:data.users.find(x=>x.id===userForm.id)?.blocked?"unblock_user":"block_user",userId:userForm.id})}>{data.users.find(x=>x.id===userForm.id)?.blocked?"Entsperren":"Sperren"}</button><button onClick={async()=>{const result=await act({action:"reset_password",userId:userForm.id});if(result?.temporaryPassword)window.alert(`Neues Einmalpasswort: ${result.temporaryPassword}`);}}>Einmalpasswort</button></div><button className="dangerButton" onClick={()=>act({action:"delete_user",userId:userForm.id},"Benutzer endgültig löschen?")}>Endgültig löschen</button></>}</div></section>}

    {tab==="companies"&&<section className="adminGrid2"><div className="adminPanel"><div className="panelHead"><h2>Gesellschaften</h2><button onClick={()=>setCompanyForm({id:"",name:"",legalForm:"GmbH",registeredOffice:"",currencyCode:"EUR"})}>+ Neu</button></div><div className="adminCards">{companies.map(c=><article className="adminEntityCard" key={c.id}><div><span className={`statusPill ${c.status}`}>{c.status}</span><h3>{c.name}</h3><p>{c.legal_form||"–"} · {c.registered_office||"–"}</p></div><button onClick={()=>setCompanyForm({id:c.id,name:c.name,legalForm:c.legal_form||"",registeredOffice:c.registered_office||"",currencyCode:c.currency_code})}>Bearbeiten</button></article>)}</div></div><div className="adminPanel formPanel"><h2>{companyForm.id?"Gesellschaft bearbeiten":"Gesellschaft anlegen"}</h2><label>Name<input value={companyForm.name} onChange={e=>setCompanyForm({...companyForm,name:e.target.value})}/></label><label>Rechtsform<input value={companyForm.legalForm} onChange={e=>setCompanyForm({...companyForm,legalForm:e.target.value})}/></label><label>Sitz<input value={companyForm.registeredOffice} onChange={e=>setCompanyForm({...companyForm,registeredOffice:e.target.value})}/></label><label>Währung<input value={companyForm.currencyCode} onChange={e=>setCompanyForm({...companyForm,currencyCode:e.target.value})}/></label><button className="primaryButton" disabled={busy} onClick={()=>companyForm.id?act({action:"update_company",companyId:companyForm.id,...companyForm}):act({action:"create_company",...companyForm})}>{companyForm.id?"Änderungen speichern":"Gesellschaft anlegen"}</button>{companyForm.id&&isSuperAdmin&&<button className="dangerButton" disabled={busy} onClick={async()=>{const ok=await act({action:"delete_company",companyId:companyForm.id},"Gesellschaft einschließlich aller Projekte, Maßnahmen, Dokumente und Kommunikation endgültig löschen?");if(ok)setCompanyForm({id:"",name:"",legalForm:"GmbH",registeredOffice:"",currencyCode:"EUR"});}}>Gesellschaft endgültig löschen</button>}</div></section>}

    {tab==="projects"&&<section className="adminGrid2"><div className="adminPanel"><div className="panelHead"><h2>Projekte</h2><button onClick={()=>setProjectForm({id:"",companyId:data.companies[0]?.id||"",name:"Jahresabschluss 31.12.2026",fiscalYearStart:"2026-01-01",fiscalYearEnd:"2026-12-31",reportingDate:"2026-12-31",ownerUserId:data.currentAdmin.id})}>+ Neu</button></div><div className="adminCards">{projects.map(p=><article className="adminEntityCard projectCard" key={p.id}><div><span className={`statusPill ${p.status}`}>{p.status}</span><h3>{p.name}</h3><p>{data.companies.find(c=>c.id===p.company_id)?.name||"–"} · Stichtag {fmt(p.reporting_date)}</p><small>{p.taskCount} Aufgaben · {p.documentCount} Dokumente</small></div><div className="stackActions"><button onClick={()=>router.push(`/workflow?project=${encodeURIComponent(p.id)}`)}>Öffnen</button><button onClick={()=>setProjectForm({id:p.id,companyId:p.company_id,name:p.name,fiscalYearStart:p.fiscal_year_start,fiscalYearEnd:p.fiscal_year_end,reportingDate:p.reporting_date,ownerUserId:data.currentAdmin.id})}>Bearbeiten</button></div></article>)}</div></div><div className="adminPanel formPanel"><h2>{projectForm.id?"Projekt bearbeiten":"Projekt anlegen"}</h2><label>Gesellschaft<select disabled={!!projectForm.id} value={projectForm.companyId} onChange={e=>setProjectForm({...projectForm,companyId:e.target.value})}><option value="">Bitte wählen</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Projektname<input value={projectForm.name} onChange={e=>setProjectForm({...projectForm,name:e.target.value})}/></label><label>Geschäftsjahresbeginn<input type="date" value={projectForm.fiscalYearStart} onChange={e=>setProjectForm({...projectForm,fiscalYearStart:e.target.value})}/></label><label>Geschäftsjahresende<input type="date" value={projectForm.fiscalYearEnd} onChange={e=>setProjectForm({...projectForm,fiscalYearEnd:e.target.value,reportingDate:e.target.value})}/></label><label>Stichtag<input type="date" value={projectForm.reportingDate} onChange={e=>setProjectForm({...projectForm,reportingDate:e.target.value})}/></label>{!projectForm.id&&<label>Owner<select value={projectForm.ownerUserId} onChange={e=>setProjectForm({...projectForm,ownerUserId:e.target.value})}>{data.users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}</select></label>}<button className="primaryButton" disabled={busy} onClick={()=>projectForm.id?act({action:"update_project",projectId:projectForm.id,name:projectForm.name,fiscalYearStart:projectForm.fiscalYearStart,fiscalYearEnd:projectForm.fiscalYearEnd,reportingDate:projectForm.reportingDate}):act({action:"create_project",...projectForm})}>{projectForm.id?"Änderungen speichern":"Projekt mit 202 Maßnahmen anlegen"}</button>{projectForm.id&&isSuperAdmin&&<button className="dangerButton" disabled={busy} onClick={async()=>{const ok=await act({action:"delete_project",projectId:projectForm.id},"Projekt einschließlich aller Maßnahmen, Dokumente und Kommunikation endgültig löschen?");if(ok)setProjectForm({id:"",companyId:"",name:"",fiscalYearStart:"2026-01-01",fiscalYearEnd:"2026-12-31",reportingDate:"2026-12-31",ownerUserId:""});}}>Projekt endgültig löschen</button>}</div></section>}

    {tab==="measures"&&<section className="adminMeasuresWorkspace"><div className="adminPanel"><div className="panelHead"><div><h2>Maßnahmen · {activeProject?.name||"Aktives Projekt"}</h2><p className="formHint">Liste startet direkt im eigenen Reiter. Klick auf eine Maßnahme öffnet sie zur Bearbeitung.</p></div><div className="buttonRow compact"><span className="adminMeasureCount">{measures.length} angezeigt</span><button onClick={()=>setTaskForm(emptyTaskForm)}>+ Maßnahme</button></div></div><div className="adminTableWrap adminMeasureTableWrap"><table className="adminTable adminMeasureTable"><thead><tr><th>Nr.</th><th>Prozessschritt</th><th>Aufgabe</th><th>Fälligkeit</th><th>Bearbeitung</th><th>Review</th><th/></tr></thead><tbody>{measures.map(t=>{const step=data.processSteps.find(s=>s.id===t.process_step_id);return <tr key={t.id} onClick={()=>editTask(t)}><td><b>{t.source_number||"–"}</b></td><td><b>{step?.code||"–"}</b><small>{step?.name||"Ohne Zuordnung"}</small></td><td><b>{t.title}</b><small>{t.required_documents_text||"Keine zusätzliche Unterlage angegeben"}</small></td><td>{fmt(t.due_date)}</td><td><span className={`statusPill ${t.work_status==="completed"?"active":t.work_status==="submitted"?"submitted":"draft"}`}>{t.work_status}</span></td><td><span className={`statusPill ${t.review_status==="accepted"?"active":t.review_status==="question"||t.review_status==="changes_required"?"locked":"draft"}`}>{t.review_status}</span></td><td><button type="button" onClick={e=>{e.stopPropagation();editTask(t);}}>Bearbeiten</button></td></tr>})}</tbody></table></div></div><div className="adminPanel formPanel adminMeasureForm"><h2>{taskForm.id?"Maßnahme bearbeiten":"Maßnahme anlegen"}</h2><label>Nr.<input value={taskForm.sourceNumber} onChange={e=>setTaskForm({...taskForm,sourceNumber:e.target.value})}/></label><label>Prozessschritt<select value={taskForm.processStepId} onChange={e=>setTaskForm({...taskForm,processStepId:e.target.value})}><option value="">Ohne Zuordnung</option>{activeSteps.map(s=><option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label><label>Workflow-Rolle<select value={taskForm.responsibilityRoleId} onChange={e=>setTaskForm({...taskForm,responsibilityRoleId:e.target.value})}><option value="">Nicht zugeordnet</option>{activeRoles.map(r=><option key={r.id} value={r.id}>{r.display_name}</option>)}</select></label><label>Aufgabe<textarea className="adminAutoTextarea" rows={3} value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} onInput={e=>{const el=e.currentTarget;el.style.height="auto";el.style.height=`${Math.max(86,el.scrollHeight)}px`;}}/></label><label>Benötigte Unterlagen<textarea className="adminAutoTextarea" rows={4} value={taskForm.requiredDocuments} onChange={e=>setTaskForm({...taskForm,requiredDocuments:e.target.value})} onInput={e=>{const el=e.currentTarget;el.style.height="auto";el.style.height=`${Math.max(104,el.scrollHeight)}px`;}}/></label><label>Fälligkeit<input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})}/></label><label>Bearbeitung<select value={taskForm.workStatus} onChange={e=>setTaskForm({...taskForm,workStatus:e.target.value})}><option value="open">Offen</option><option value="in_progress">In Bearbeitung</option><option value="submitted">Eingereicht</option><option value="completed">Abgeschlossen</option><option value="not_relevant">Nicht relevant</option></select></label><label>Review<select value={taskForm.reviewStatus} onChange={e=>setTaskForm({...taskForm,reviewStatus:e.target.value})}><option value="unreviewed">Ungeprüft</option><option value="question">Rückfrage</option><option value="changes_required">Nachbesserung</option><option value="accepted">Akzeptiert</option></select></label><button className="primaryButton" disabled={busy} onClick={saveTask}>{taskForm.id?"Maßnahme speichern":"Maßnahme anlegen"}</button>{taskForm.id&&<><button className="secondaryAdminButton" onClick={()=>setTaskForm(emptyTaskForm)}>Bearbeitung abbrechen</button><button className="dangerButton" disabled={busy} onClick={async()=>{const r=await act({action:"delete_task",taskId:taskForm.id},"Maßnahme endgültig löschen?");if(r)setTaskForm(emptyTaskForm);}}>Maßnahme löschen</button></>}</div></section>}

    {tab==="permissions"&&<section className="adminGrid2 adminPermissionsWorkspace"><div className="adminPanel"><h2>Berechtigungsmatrix</h2><p className="formHint">Gesellschafts-, Projekt- und Workflow-Zuordnungen einschließlich der daraus resultierenden Aufgaben je Benutzer.</p><div className="adminTableWrap"><table className="adminTable adminPermissionTable"><thead><tr><th>Benutzer</th><th>Gesellschaft</th><th>Projekt</th><th>Workflow-Rolle</th><th>Aufgaben</th></tr></thead><tbody>{data.users.map(u=>{const access=userAccess(u.id);return <tr key={u.id}><td><b>{u.email}</b></td><td>{access.companyRows.length?access.companyRows.map(c=><span className="adminAccessLine" key={c.id}>{c.name}</span>):"–"}</td><td>{access.projectRows.length?access.projectRows.map(p=><span className="adminAccessLine" key={p.id}>{p.name}</span>):"–"}</td><td>{access.ras.length?access.ras.map(a=><span className="adminAccessLine" key={a.role_id}>{a.display_name} · {a.assignedTaskCount}</span>):"–"}</td><td><b>{access.taskCount}</b></td></tr>})}</tbody></table></div></div><div className="adminPanel formPanel"><h2>Zugriff zuweisen</h2><label>Benutzer<select value={perm.userId} onChange={e=>setPerm({...perm,userId:e.target.value})}><option value="">Bitte wählen</option>{data.users.map(u=><option key={u.id} value={u.id}>{u.email}</option>)}</select></label><label>Gesellschaft<select value={perm.companyId} onChange={e=>setPerm({...perm,companyId:e.target.value})}><option value="">–</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Gesellschaftsrolle<select value={perm.companyRole} onChange={e=>setPerm({...perm,companyRole:e.target.value})}><option>owner</option><option>manager</option><option>member</option><option>viewer</option></select></label><div className="buttonRow"><button className="primaryButton" onClick={()=>act({action:"set_company_member",userId:perm.userId,companyId:perm.companyId,role:perm.companyRole})}>Gesellschaft zuweisen</button><button onClick={()=>act({action:"remove_company_member",userId:perm.userId,companyId:perm.companyId})}>Entfernen</button></div><label>Projekt<select value={perm.projectId} onChange={e=>setPerm({...perm,projectId:e.target.value,roleId:""})}><option value="">–</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Projektrolle<select value={perm.projectRole} onChange={e=>setPerm({...perm,projectRole:e.target.value})}><option>owner</option><option>manager</option><option>contributor</option><option>reviewer</option><option>viewer</option></select></label><div className="buttonRow"><button className="primaryButton" onClick={()=>act({action:"set_project_member",userId:perm.userId,projectId:perm.projectId,role:perm.projectRole})}>Projekt zuweisen</button><button onClick={()=>act({action:"remove_project_member",userId:perm.userId,projectId:perm.projectId})}>Entfernen</button></div><hr/><h3>Workflow-Rolle / Aufgabenpaket</h3><label>Workflow-Rolle<select value={perm.roleId} onChange={e=>setPerm({...perm,roleId:e.target.value})}><option value="">–</option>{(data.responsibilityRoles||[]).filter(r=>!perm.projectId||r.project_id===perm.projectId).map(r=><option key={r.id} value={r.id}>{data.projects.find(p=>p.id===r.project_id)?.name||"Projekt"} · {r.display_name}</option>)}</select></label><div className="buttonRow"><button className="primaryButton" onClick={()=>act({action:"assign_responsibility_role",userId:perm.userId,roleId:perm.roleId})}>Workflow-Rolle zuweisen</button><button onClick={()=>act({action:"remove_responsibility_role",userId:perm.userId,roleId:perm.roleId})}>Workflow-Rolle entfernen</button></div></div></section>}
  </main>;
}
