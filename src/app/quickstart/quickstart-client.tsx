"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = { id:string; name:string; reporting_date:string; status:string };
type Company = { id:string; name:string; legal_form?:string|null; registered_office?:string|null; currency_code?:string; projects?:Project[] };
type Context = { companies:Company[]; session?:{ company_id?:string; project_id?:string; current_step?:number }|null; quickstart_guest?:boolean };
type Msg = { who:"kai"|"user"; text:string };

const TEAM = [
  { kind:"cfo", role_key:"VO (Vorstand)", label:"CFO / Geschäftsführung" },
  { kind:"project_lead", role_key:null, label:"Projektleitung Abschluss" },
  { kind:"accounting_lead", role_key:"RW (Leitung)", label:"Leitung Rechnungswesen" },
  { kind:"accountant", role_key:"RW (Hauptbuchhaltung)", label:"Bilanzbuchhalter / Hauptbuch" },
  { kind:"auditor", role_key:"WP (Leitung)", label:"Wirtschaftsprüfer" },
  { kind:"tax_advisor", role_key:"Steuerberater", label:"Steuerberater (optional)" },
];

export function KaiQuickstart({ initialContext, startCompanyId = "" }: { initialContext: Context; startCompanyId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [context,setContext] = useState<Context>(initialContext);
  // A normal Quickstart always starts fresh. An unfinished session is never resumed implicitly.
  const [step,setStep] = useState(startCompanyId ? 1 : 0);
  const [companyId,setCompanyId] = useState(startCompanyId);
  const [projectId,setProjectId] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const startCompany = initialContext.companies?.find(c=>c.id===startCompanyId);
  const [messages,setMessages] = useState<Msg[]>([
    {who:"kai",text:"Guten Tag. Ich bin KAI. Ich richte Ihren Jahresabschluss gemeinsam mit Ihnen ein. Wir arbeiten in fünf kurzen Abschnitten – Gesellschaft, Projekt, Team, Aufgaben & PBC und Start ins Cockpit."},
    {who:"kai",text: startCompanyId
      ? `Wir legen ein neues Projekt für ${startCompany?.name || "die ausgewählte Gesellschaft"} an.`
      : (context.companies?.length ? "Möchten Sie eine neue Gesellschaft anlegen? Die bestehenden Gesellschaften bleiben unverändert." : "Sie haben noch keine Gesellschaft in LUMINA. Wie heißt die erste Gesellschaft?")}
  ]);
  const [newCompany,setNewCompany] = useState({name:"",legal_form:"GmbH",registered_office:"",currency_code:"EUR"});
  const year = new Date().getFullYear();
  const [project,setProject] = useState({name:`Jahresabschluss 31.12.${year}`,fiscal_start:`${year}-01-01`,fiscal_end:`${year}-12-31`,reporting_date:`${year}-12-31`,auditor:""});
  const [team,setTeam] = useState(TEAM.map(x=>({...x,first_name:"",last_name:"",email:""})));
  const [summary,setSummary] = useState<Record<string,number>|null>(null);
  const initializedCompany = useRef(false);

  useEffect(() => {
    if (!startCompanyId || initializedCompany.current) return;
    initializedCompany.current = true;
    void (async () => {
      setBusy(true);
      setError("");
      const { error } = await supabase.rpc("quickstart_use_company", { p_company_id: startCompanyId });
      if (error) setError(error.message);
      setBusy(false);
    })();
  }, [startCompanyId, supabase]);

  function say(who:Msg["who"],text:string){ setMessages(m=>[...m,{who,text}]); }
  async function refresh(){ const {data}=await supabase.rpc("quickstart_context"); if(data) setContext(data as Context); }
  async function run<T=unknown>(fn:()=>PromiseLike<{data:T|null;error:any}>) { setBusy(true);setError(""); try{const {data,error}=await fn();if(error)throw error;return data;}catch(e:any){setError(e.message||String(e));return null;}finally{setBusy(false);} }

  async function createCompany(){
    if(!newCompany.name.trim()) return setError("Bitte nennen Sie die Gesellschaft.");
    const duplicate=context.companies?.find(c=>c.name.trim().toLocaleLowerCase("de-DE")===newCompany.name.trim().toLocaleLowerCase("de-DE"));
    if(duplicate) return setError(`${duplicate.name} ist für Sie bereits vorhanden. Bitte legen Sie ein neues Projekt über die Projektzentrale an.`);
    const id=await run<string>(()=>supabase.rpc("quickstart_create_company",{p_name:newCompany.name,p_legal_form:newCompany.legal_form,p_registered_office:newCompany.registered_office,p_currency_code:newCompany.currency_code})); if(!id)return;
    setCompanyId(id);setStep(1);say("user",`${newCompany.name}, ${newCompany.legal_form}${newCompany.registered_office?`, Sitz ${newCompany.registered_office}`:""}`);say("kai",`✓ ${newCompany.name} ist als eigene Gesellschaft angelegt. Jetzt erstellen wir darunter das erste Projekt.`);await refresh();
  }
  async function createProject(){
    const id=await run<string>(()=>supabase.rpc("quickstart_create_project",{p_company_id:companyId,p_name:project.name,p_fiscal_year_start:project.fiscal_start,p_fiscal_year_end:project.fiscal_end,p_reporting_date:project.reporting_date,p_auditor:project.auditor||null})); if(!id)return;
    setProjectId(id);setStep(2);say("user",`${project.name}, Stichtag ${project.reporting_date}`);say("kai","✓ Projekt angelegt. Ich habe die LUMINA-Prozessstruktur als eigene Projektinstanz vorbereitet: neue IDs, neue Aufgabenstatus und ein eigener Datenraum. Jetzt ordnen wir nur die Kernrollen zu.");await refresh();
  }
  async function saveTeam(){
    const data=team.map(x=>({kind:x.kind,role_key:x.role_key,first_name:x.first_name,last_name:x.last_name,email:x.email}));
    const ok=await run(()=>supabase.rpc("quickstart_save_team",{p_project_id:projectId,p_team:data})); if(!ok)return;
    setStep(3);say("user","Teamzuordnung übernehmen");say("kai","✓ Kernteam gespeichert. Registrierte LUMINA-Nutzer wurden – soweit ihre E-Mail schon bekannt ist – direkt mit dem Projekt bzw. ihrer Fachrolle verknüpft. Die übrigen Rollen können später ergänzt werden.");say("kai","Als Nächstes prüfe ich Aufgaben, Termine und PBC-Struktur. Die 202 Maßnahmen müssen Sie nicht einzeln anlegen – sie wurden aus dem LUMINA-Modell erzeugt.");
  }
  async function acceptPlan(){ setStep(4); say("user","Standard-Aufgaben und PBC übernehmen"); say("kai","✓ Aufgaben- und PBC-Grundstruktur übernommen. Alte Dokumente, Kommentare, Findings und Erledigt-Status wurden bewusst nicht kopiert. Nur Struktur und Arbeitshilfen sind wiederverwendet."); say("kai","Ich kann das Projekt jetzt abschließen und Ihnen die Startübersicht zeigen."); }
  async function finish(){
    const data=await run<Record<string,number>>(()=>supabase.rpc("quickstart_finish",{p_project_id:projectId})); if(!data)return;
    setSummary(data);setStep(5);say("user","Projekt starten");say("kai",`✓ Ihr LUMINA-Projekt ist startbereit: ${data.process_stations ?? 0} Prozessstationen, ${data.tasks ?? 0} Maßnahmen, ${data.document_requests ?? 0} konkrete Dokumentanforderungen und ${data.due_dates ?? 0} hinterlegte Kacheltermine.`);
  }

  const selectedCompany=context.companies?.find(c=>c.id===companyId);
  return <main className="kaiPage">
    <header className="kaiHeader"><div className="authBrand"><span className="brandMark"/><div><strong>LUMINA</strong><span>KAI Quickstart</span></div></div><div className="kaiProgress">{[0,1,2,3,4].map((n)=><span key={n} className={n<=Math.min(step,4)?"done":""}>{n+1}</span>)}</div></header>
    <div className="kaiLayout">
      <section className="kaiChat">
        <div className="kaiPromise"><strong>In 30 Minuten startklar.</strong><span>Kompletter Abschlussprozess mit Verantwortlichen, Terminen und echtem Fortschritt.</span></div>
        <div className="kaiMessages">{messages.map((m,i)=><div key={i} className={`kaiBubble ${m.who}`}>{m.text}</div>)}</div>
        {error&&<div className="formError">{error}</div>}
      </section>
      <aside className="kaiAction">
        {step===0&&<>
          <div className="kaiCard"><p className="miniLabel">Neue Gesellschaft</p><h2>Gesellschaft anlegen</h2>{context.companies?.length>0&&<p className="cardHint">Ihre bestehenden Gesellschaften bleiben unverändert. Ein neues Projekt für eine bestehende Gesellschaft starten Sie in der Projektzentrale über „+ Projekt anlegen“.</p>}<label>Gesellschaft<input value={newCompany.name} onChange={e=>setNewCompany({...newCompany,name:e.target.value})} placeholder="z. B. Hercules GmbH"/></label><div className="formRow"><label>Rechtsform<input value={newCompany.legal_form} onChange={e=>setNewCompany({...newCompany,legal_form:e.target.value})}/></label><label>Währung<input value={newCompany.currency_code} onChange={e=>setNewCompany({...newCompany,currency_code:e.target.value})}/></label></div><label>Sitz<input value={newCompany.registered_office} onChange={e=>setNewCompany({...newCompany,registered_office:e.target.value})} placeholder="Duisburg"/></label><button className="primaryButton" disabled={busy} onClick={createCompany}>Gesellschaft mit KAI anlegen</button></div>
        </>}
        {step===1&&<div className="kaiCard"><p className="miniLabel">{selectedCompany?.name||"Gesellschaft"}</p><h2>Projekt</h2><label>Projektname<input value={project.name} onChange={e=>setProject({...project,name:e.target.value})}/></label><div className="formRow"><label>Von<input type="date" value={project.fiscal_start} onChange={e=>setProject({...project,fiscal_start:e.target.value})}/></label><label>Bis<input type="date" value={project.fiscal_end} onChange={e=>setProject({...project,fiscal_end:e.target.value,reporting_date:e.target.value,name:`Jahresabschluss ${e.target.value.split('-').reverse().join('.')}`})}/></label></div><label>Bilanzstichtag<input type="date" value={project.reporting_date} onChange={e=>setProject({...project,reporting_date:e.target.value})}/></label><label>Abschlussprüfer<input value={project.auditor} onChange={e=>setProject({...project,auditor:e.target.value})} placeholder="optional"/></label><button className="primaryButton" disabled={busy} onClick={createProject}>Projekt anlegen & LUMINA-Struktur erzeugen</button></div>}
        {step===2&&<div className="kaiCard teamCard"><h2>Kernteam</h2><p className="cardHint">KAI zeigt nur die wichtigsten Rollen. Weitere Rollen bleiben im vollständigen LUMINA erhalten.</p>{team.map((r,i)=><div className="teamRow" key={r.kind}><strong>{r.label}</strong><input placeholder="Vorname" value={r.first_name} onChange={e=>setTeam(team.map((x,j)=>j===i?{...x,first_name:e.target.value}:x))}/><input placeholder="Nachname" value={r.last_name} onChange={e=>setTeam(team.map((x,j)=>j===i?{...x,last_name:e.target.value}:x))}/><input placeholder="E-Mail" value={r.email} onChange={e=>setTeam(team.map((x,j)=>j===i?{...x,email:e.target.value}:x))}/></div>)}<button className="primaryButton" disabled={busy} onClick={saveTeam}>Team übernehmen</button></div>}
        {step===3&&<div className="kaiCard"><h2>Aufgaben & Termine</h2><div className="checkStack"><p>✓ 78 Prozessstationen als Projektstruktur</p><p>✓ 202 Maßnahmen als neue Aufgabeninstanzen</p><p>✓ Termine relativ zum neuen Bilanzstichtag verschoben</p><p>✓ Verantwortungsrollen aus dem LUMINA-Modell</p></div><p className="cardHint">Sie prüfen später nur Ausnahmen. KAI verlangt keine manuelle Verteilung von 202 Zeilen im Quickstart.</p><button className="primaryButton" onClick={acceptPlan}>Standardplan übernehmen</button></div>}
        {step===4&&<div className="kaiCard"><h2>Datenraum & PBC</h2><div className="checkStack"><p>✓ eigener Projektdatenraum</p><p>✓ Aufgaben-/Ordner-Verknüpfungen</p><p>✓ erwartete Dokumentanforderungen</p><p>✓ Arbeitshilfen bleiben zentral verlinkt</p><p>✓ keine Vorjahresdokumente als aktuelle Nachweise kopiert</p></div><button className="primaryButton" disabled={busy} onClick={finish}>Projekt starten</button></div>}
        {step===5&&<div className="kaiCard finishCard"><p className="miniLabel">KAI Quickstart abgeschlossen</p><h2>Ihr Abschluss ist startbereit.</h2>{summary&&<div className="summaryGrid"><div><strong>{summary.process_stations??0}</strong><span>Stationen</span></div><div><strong>{summary.tasks??0}</strong><span>Maßnahmen</span></div><div><strong>{summary.document_requests??0}</strong><span>PBC-Nachweise</span></div><div><strong>{summary.due_dates??0}</strong><span>Termine</span></div></div>}{context.quickstart_guest?<><p className="cardHint">Das Projekt wurde mit dem gemeinsamen Pilotzugang angelegt und dem LUMINA-Administrator zur weiteren Einrichtung bereitgestellt. Melden Sie sich für die laufende Bearbeitung später mit Ihrem persönlichen Zugang an.</p><button className="primaryButton" onClick={async()=>{await supabase.auth.signOut();router.replace("/login");router.refresh();}}>Zur Anmeldung</button><button className="secondaryButton full" onClick={()=>{setStep(0);setProjectId("");setCompanyId("");setSummary(null);refresh();}}>Weiteres Testprojekt anlegen</button></>:<><button className="primaryButton" onClick={()=>router.push(`/workflow?project=${encodeURIComponent(projectId)}`)}>Zum Abschluss-Cockpit</button><button className="secondaryButton full" onClick={()=>{setStep(0);setProjectId("");setCompanyId("");setSummary(null);refresh();}}>Weiteres Projekt anlegen</button></>}</div>}
      </aside>
    </div>
  </main>;
}
