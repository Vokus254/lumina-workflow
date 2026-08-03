#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const sourcePath = resolve(projectRoot, "..", "LUMINA_Abschluss_Cockpit_SUPABASE.html");
const outputPath = resolve(projectRoot, "public", "legacy", "lumina.html");
let html = await readFile(sourcePath, "utf8");

function replaceArray(marker, replacement) {
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Marker not found: ${marker}`);
  const open = html.indexOf("[", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < html.length; index += 1) {
    const current = html[index];
    const next = html[index + 1];
    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = "";
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      continue;
    }
    if (current === "[") depth += 1;
    if (current === "]" && --depth === 0) {
      const semicolon = html.indexOf(";", index);
      html = html.slice(0, start) + replacement + html.slice(semicolon + 1);
      return;
    }
  }
  throw new Error(`Unclosed array: ${marker}`);
}

replaceArray("const stations = [", "const stations = []");
replaceArray(
  "const LUMINA_EMBEDDED_SERAFIN_STATE = [",
  "const LUMINA_EMBEDDED_SERAFIN_STATE = null",
);

html = html.replace(
  "const LUMINA_PUBLIC_APP_URL='https://lumina-abschluss-test.vokus.chatgpt.site/lumina.html';",
  "const LUMINA_PUBLIC_APP_URL='https://lumina-workflow.vercel.app/workflow';",
);

html = html.replace(
  "document.getElementById('lumina-signout').addEventListener('click',async()=>{await luminaDb.auth.signOut();location.reload();});",
  "document.getElementById('lumina-signout').addEventListener('click',async()=>{if(window.parent!==window){window.parent.postMessage({type:'lumina-signout'},location.origin);return;}await luminaDb.auth.signOut();location.reload();});",
);


// Keep the project-scoped notification authorization when regenerating the legacy dashboard.
html = html.replace('required value="admin@volkerkusch.de"', 'required');
html = html.replace(
  "async function loadLuminaFromSupabase(){",
  "let currentLuminaProjectId='';\\nlet currentLuminaCanNotifyAll=false;\\n\\nasync function loadLuminaFromSupabase(){",
);
html = html.replace(
  "  const project=projects[0],companyName=project.companies?.name||project.name||'Serafin GmbH';",
  `  const project=projects[0],companyName=project.companies?.name||project.name||'Serafin GmbH';
  currentLuminaProjectId=project.id;
  const {data:{user:currentUser}}=await luminaDb.auth.getUser();
  const {data:adminMembership,error:adminMembershipError}=currentUser?await luminaDb.from('project_members').select('security_role').eq('project_id',project.id).eq('user_id',currentUser.id).eq('active',true).in('security_role',['owner','manager']).maybeSingle():{data:null,error:null};
  if(adminMembershipError)console.warn('Projektberechtigung für Sammelversand konnte nicht geprüft werden',adminMembershipError);
  currentLuminaCanNotifyAll=Boolean(adminMembership);
  document.getElementById('btn-notify-all').style.display=currentLuminaCanNotifyAll?'inline-flex':'none';`,
);
html = html.replace(
  "fetch('/api/notifications/role-digests',{cache:'no-store'})",
  "fetch(`/api/notifications/role-digests?projectId=${encodeURIComponent(currentLuminaProjectId)}`,{cache:'no-store'})",
);
html = html.replace(
  "body:JSON.stringify({confirmed:true})",
  "body:JSON.stringify({confirmed:true,projectId:currentLuminaProjectId})",
);
html = html.replace(
  "  document.getElementById('btn-notify-all').style.display=session.user.email?.toLowerCase()==='admin@volkerkusch.de'?'inline-flex':'none';",
  "  document.getElementById('btn-notify-all').style.display='none';",
);
html = html.replace(
  "async function renderAdminDigestPreview(){\\n  digestOpen",
  "async function renderAdminDigestPreview(){\\n  if(!currentLuminaProjectId||!currentLuminaCanNotifyAll){showTopNote('Für dieses Projekt fehlt Ihnen die Berechtigung zum Sammelversand.',true);return;}\\n  digestOpen",
);
html = html.replace(
  "async function sendAdminDigests(){if(!adminDigestPreview",
  "async function sendAdminDigests(){if(!currentLuminaProjectId||!currentLuminaCanNotifyAll){showTopNote('Für dieses Projekt fehlt Ihnen die Berechtigung zum Sammelversand.',true);return;}if(!adminDigestPreview",
);


// Keep document lists and actions scoped to the currently opened task. Documents
// assigned to other tasks may share the same data-room folder, but must not be
// shown or removable from this task dialog.
html = html.replace(
  "function explorerDocsInFolder(key){return allExplorerDocuments().filter(d=>d.folderPath===key);}",
  "function explorerDocsInFolder(key,taskId){return allExplorerDocuments().filter(d=>d.folderPath===key&&String(d._taskId||d.taskId||'')===String(taskId||''));}",
);
html = html.replace(
  "function renderExplorerRoom(row,st){const folders=flattenDataroomFolders(),folder=ensureExplorerFolder(st),docs=explorerDocsInFolder(folder.key);",
  "function renderExplorerRoom(row,st){const folders=flattenDataroomFolders(),folder=ensureExplorerFolder(st),docs=explorerDocsInFolder(folder.key,row[12]);",
);
html = html.replace(
  "<span>${docs.length} Dokument${docs.length===1?'':'e'} im Ordner</span>",
  "<span>${docs.length} Dokument${docs.length===1?'':'e'} für diese Aufgabe</span>",
);
html = html.replace(
  "const docs=allExplorerDocuments();document.querySelectorAll('[data-download]')",
  "const docs=explorerDocsInFolder(ensureExplorerFolder(st).key,row[12]);document.querySelectorAll('[data-download]')",
);


// Approval actions are persisted exclusively by act_task_approval. The generic
// task-state RPC is intentionally not called from the approval tab, because an
// approver may be allowed to approve without being allowed to edit task fields.
html = html.replace(
  "  document.querySelectorAll('.task-tab').forEach(b=>b.onclick=()=>{taskActiveTab=b.dataset.tab;renderTaskModal();});\n  if(!activeTaskContext.globalRoom){loadTaskWorkPackage(st).catch(console.warn);if(String(row[0]||'')==='82')loadTaskApproval(st).catch(console.warn);if(taskActiveTab==='review')loadTaskAiInteractions(st).catch(console.warn);if(['details','previous','review'].includes(taskActiveTab))bindTaskWorkPackage(row,st);if(taskActiveTab==='approval')bindTaskApproval(st);}",
  "  document.querySelectorAll('.task-tab').forEach(b=>b.onclick=()=>{taskActiveTab=b.dataset.tab;renderTaskModal();});\n  const modalSaveButton=document.getElementById('task-modal-save');\n  if(modalSaveButton){\n    const approvalOnlyView=!activeTaskContext.globalRoom&&taskActiveTab==='approval';\n    modalSaveButton.style.display=approvalOnlyView?'none':'inline-flex';\n  }\n  if(!activeTaskContext.globalRoom){loadTaskWorkPackage(st).catch(console.warn);if(String(row[0]||'')==='82')loadTaskApproval(st).catch(console.warn);if(taskActiveTab==='review')loadTaskAiInteractions(st).catch(console.warn);if(['details','previous','review'].includes(taskActiveTab))bindTaskWorkPackage(row,st);if(taskActiveTab==='approval')bindTaskApproval(st);}",
);
html = html.replace(
  "document.getElementById(\"task-modal-save\").addEventListener(\"click\", async () => { const button=document.getElementById('task-modal-save');button.disabled=true;try{ if(activeTaskContext && !activeTaskContext.globalRoom){ const {sub,ri}=activeTaskContext,row=sub.data.rows[ri],st=ensureTaskState(sub.data,row,ri); const c=document.getElementById(\"task-internal-comment\"); if(c) st.internalComment=c.value; await saveLuminaTaskToSupabase(row,st); addActivity(st,\"Aufgabe in Supabase gespeichert\"); } saveLuminaLocal(); closeTaskModal(); render(); }catch(error){setLuminaSyncState('Speichern fehlgeschlagen',true);showTopNote('Supabase-Speichern fehlgeschlagen: '+error.message,true);}finally{button.disabled=false;} });",
  "document.getElementById(\"task-modal-save\").addEventListener(\"click\", async () => { const button=document.getElementById('task-modal-save');if(taskActiveTab==='approval'){closeTaskModal();render();return;}button.disabled=true;try{ if(activeTaskContext && !activeTaskContext.globalRoom){ const {sub,ri}=activeTaskContext,row=sub.data.rows[ri],st=ensureTaskState(sub.data,row,ri); const c=document.getElementById(\"task-internal-comment\"); if(c) st.internalComment=c.value; await saveLuminaTaskToSupabase(row,st); addActivity(st,\"Aufgabe in Supabase gespeichert\"); } saveLuminaLocal(); closeTaskModal(); render(); }catch(error){setLuminaSyncState('Speichern fehlgeschlagen',true);showTopNote('Supabase-Speichern fehlgeschlagen: '+error.message,true);}finally{button.disabled=false;} });",
);


// Keep the embedded dashboard on an access-token-only client. The refresh token
// remains in the parent Next.js application and is never exposed to legacy code.
html = html.replace(
  "const luminaDb=window.supabase.createClient(LUMINA_SUPABASE_URL,LUMINA_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});",
  "let luminaDb=window.supabase.createClient(LUMINA_SUPABASE_URL,LUMINA_SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});\nlet currentLuminaUser=null;\nfunction createEmbeddedLuminaClient(accessToken){return window.supabase.createClient(LUMINA_SUPABASE_URL,LUMINA_SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${accessToken}`}}});}",
);
html = html.replace(
  "  const {data:{user:currentUser}}=await luminaDb.auth.getUser();",
  "  const currentUser=currentLuminaUser||(await luminaDb.auth.getUser()).data.user;",
);

const bridge = `
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='lumina-session'||typeof event.data.accessToken!=='string')return;
  try{
    luminaDb=createEmbeddedLuminaClient(event.data.accessToken);
    const {data,error}=await luminaDb.auth.getUser(event.data.accessToken);
    if(error||!data.user)throw error||new Error('Die Sitzung ist ungültig.');
    currentLuminaUser=data.user;
    if(!document.body.classList.contains('lumina-authenticated'))await startLuminaForSession({user:data.user});
  }catch(error){setLuminaAuthError(error.message||'LUMINA konnte nicht geladen werden.');}
});
if(window.parent!==window){
  document.querySelector('.lumina-auth-card h2').textContent='Dashboard wird geladen …';
  document.querySelector('.lumina-auth-form').style.display='none';
}
`;

const initializeMarker = "initializeLuminaSupabase();";
const initializeIndex = html.lastIndexOf(initializeMarker);
if (initializeIndex < 0) throw new Error("Initialization marker not found");
html = html.slice(0, initializeIndex) + bridge + html.slice(initializeIndex);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Prepared ${outputPath}`);
