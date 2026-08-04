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

const bridge = `
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.data?.type!=='lumina-session')return;
  try{
    const {data,error}=await luminaDb.auth.setSession({access_token:event.data.accessToken,refresh_token:event.data.refreshToken});
    if(error)throw error;
    if(data.session&&!document.body.classList.contains('lumina-authenticated'))await startLuminaForSession(data.session);
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


const processDataroomBlock = String.raw`function buildProcessDataroomModel(){
  const pbc=luminaPbcRows();
  const rows=pbc?.rows||[];
  const phaseMap=new Map();
  const phases=[];
  const taskKeys=new Map();
  const rowIdentity=(row,index)=>String(row?.[12]||row?.[0]||index);
  rows.forEach((row,index)=>{
    const processStep=String(row?.[1]||'Ohne Prozessschritt').trim();
    const majorMatch=processStep.match(/^(\d+)/);
    const major=majorMatch?String(parseInt(majorMatch[1],10)):"0";
    if(!phaseMap.has(major)){
      const station=stations[(parseInt(major,10)||1)-1];
      const stationTitle=station?.title||processStep.replace(/^\d+(?:\.\d+)?\.\s*/,"")||"Ohne Prozessphase";
      const phase={name:\`\${major}. \${stationTitle}\`,children:[],_groups:new Map()};
      phaseMap.set(major,phase);
      phases.push(phase);
    }
    const phase=phaseMap.get(major);
    if(!phase._groups.has(processStep)){
      const group={name:processStep,children:[]};
      phase._groups.set(processStep,group);
      phase.children.push(group);
    }
    const taskNumber=String(row?.[0]||index+1).padStart(3,'0');
    const taskTitle=String(row?.[3]||row?.[5]||row?.[1]||'Aufgabe');
    phase._groups.get(processStep).children.push({
      name:\`\${taskNumber} · \${taskTitle}\`,
      children:[],
      taskIndex:index,
      taskIdentity:rowIdentity(row,index)
    });
  });
  phases.forEach(phase=>delete phase._groups);
  const assignKeys=(nodes,parent=[])=>{
    nodes.forEach((node,index)=>{
      const path=[...parent,index];
      node._key=path.join('.');
      if(Number.isInteger(node.taskIndex))taskKeys.set(node.taskIdentity,node._key);
      assignKeys(explorerNodeChildren(node),path);
    });
  };
  assignKeys(phases);
  return {tree:phases,taskKeys,rowIdentity,rowCount:rows.length};
}
function getDataroomTree(){return buildProcessDataroomModel().tree;}
function explorerNodeName(node){return typeof node==="string"?node:(node?.name||"Ordner");}
function explorerNodeChildren(node){return typeof node==="string"?[]:(Array.isArray(node?.children)?node.children:[]);}
function flattenDataroomFolders(){const out=[];const walk=(nodes,parentPath=[],parentNames=[])=>{(nodes||[]).forEach((node,i)=>{const path=[...parentPath,i],names=[...parentNames,explorerNodeName(node)];out.push({key:path.join('.'),path,names,name:names[names.length-1],depth:path.length-1,taskIndex:Number.isInteger(node?.taskIndex)?node.taskIndex:null});walk(explorerNodeChildren(node),path,names);});};walk(getDataroomTree());return out;}
function explorerFolderByKey(key){const all=flattenDataroomFolders();return all.find(x=>x.key===key)||all.find(x=>Number.isInteger(x.taskIndex))||all[0]||{key:"",path:[],names:["Datenraum"],name:"Datenraum",depth:0,taskIndex:null};}
function processFolderKeyForRow(row,index=0){const model=buildProcessDataroomModel();return model.taskKeys.get(model.rowIdentity(row,index))||"";}
function ensureExplorerFolder(st,row,index=0){const key=row?processFolderKeyForRow(row,index):st.folderPath;const all=flattenDataroomFolders();const fallback=all.find(x=>Number.isInteger(x.taskIndex))?.key||all[0]?.key||"";st.folderPath=all.some(x=>x.key===key)?key:fallback;return explorerFolderByKey(st.folderPath);}
function allExplorerDocuments(){const sub=getPbcSub(),out=[];if(!sub)return out;(sub.data.rows||[]).forEach((row,ri)=>{const st=ensureTaskState(sub.data,row,ri),taskFolder=ensureExplorerFolder(st,row,ri);(st.documents||[]).forEach(doc=>{doc.folderPath=taskFolder.key;out.push({...doc,_state:st,_row:row,_ri:ri,_taskId:row[12]});});});return out;}
function explorerDocsInFolder(key){return allExplorerDocuments().filter(d=>d.folderPath===key);}
function explorerFormatBytes(n){const v=Number(n)||0;if(!v)return "–";if(v<1024)return v+" B";if(v<1048576)return (v/1024).toFixed(1)+" KB";return (v/1048576).toFixed(1)+" MB";}
function explorerFileKind(doc){const n=(doc.name||"").toLowerCase();if(n.endsWith('.pdf'))return 'PDF';if(/\.(xlsx?|csv)$/.test(n))return 'XLS';if(/\.(docx?)$/.test(n))return 'DOC';if(/\.(png|jpe?g|gif|webp)$/.test(n))return 'IMG';return 'FILE';}
async function explorerDownload(doc){try{if(doc.storagePath){showTopNote('Dokument wird geladen ...');const {data,error}=await luminaDb.storage.from(doc.storageBucket||'lumina-datarooms').download(doc.storagePath);if(error)throw error;const objectUrl=URL.createObjectURL(data),a=document.createElement('a');a.href=objectUrl;a.download=doc.name||'Dokument';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);showTopNote('Dokument heruntergeladen.');return;}if(doc.dataUrl){const a=document.createElement('a');a.href=doc.dataUrl;a.download=doc.name||'Dokument';document.body.appendChild(a);a.click();a.remove();return;}if(doc.url){window.open(doc.url,'_blank','noopener');return;}showTopNote('Für diese Metadatei ist kein Dateiinhalt gespeichert.',true);}catch(error){showTopNote('Dokument konnte nicht geladen werden: '+(error.message||error),true);}}
function explorerRemoveDocument(doc){if(doc.persisted){showTopNote('Das dauerhafte Löschen wird separat freigeschaltet. Das Dokument bleibt sicher in Supabase gespeichert.',true);return;}if(!confirm(\`Dokument „\${doc.name}“ entfernen?\`))return;const list=doc._state.documents||[];const idx=list.findIndex(x=>x.id===doc.id);if(idx>=0)list.splice(idx,1);addActivity(doc._state,\`Dokument entfernt: \${doc.name}\`);renderTaskModal();}
async function explorerAddDocument(st,row){const file=document.getElementById('explorer-file')?.files?.[0],url=(document.getElementById('explorer-url')?.value||'').trim(),name=(document.getElementById('explorer-name')?.value||'').trim(),comment=(document.getElementById('explorer-comment')?.value||'').trim(),folder=ensureExplorerFolder(st,row);if(!file&&!url){showTopNote('Bitte eine Datei auswählen oder einen Link eingeben.',true);return;}if(url&&!/^https?:\/\//i.test(url)){showTopNote('Bitte einen gültigen Link eingeben.',true);return;}if(!file){const doc={id:'link-'+Date.now().toString(36),name:name||url,size:0,mime:'link',url,comment,folderPath:folder.key,taskId:row[12],taskNumber:row[0]||'',taskTitle:row[3]||row[1]||'',uploadedAt:luminaNow(),version:1};st.documents.push(doc);addActivity(st,\`Externer Link im Datenraum abgelegt: \${doc.name}\`);renderTaskModal();return;}if(!st.remoteTaskId){showTopNote('Diese Aufgabe ist noch keinem Supabase-Datensatz zugeordnet.',true);return;}const button=document.getElementById('explorer-save-document');if(button){button.disabled=true;button.textContent='Wird hochgeladen ...';}let prepared=null;try{const {data,error}=await luminaDb.rpc('prepare_document_upload',{p_task_id:st.remoteTaskId,p_original_file_name:file.name,p_mime_type:file.type||'application/octet-stream',p_file_size:file.size,p_upload_comment:comment||null});if(error)throw error;prepared=Array.isArray(data)?data[0]:data;if(!prepared?.storage_path)throw new Error('Supabase hat keinen Speicherpfad geliefert.');const {error:uploadError}=await luminaDb.storage.from(prepared.storage_bucket||'lumina-datarooms').upload(prepared.storage_path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(uploadError)throw uploadError;st.documents.push({id:prepared.document_id,remoteDocumentId:prepared.document_id,remoteVersionId:prepared.version_id,name:file.name,size:file.size,mime:file.type||'application/octet-stream',comment,folderPath:folder.key,taskId:row[12],taskNumber:row[0]||'',taskTitle:row[3]||row[1]||'',uploadedAt:luminaNow(),version:1,storageBucket:prepared.storage_bucket||'lumina-datarooms',storagePath:prepared.storage_path,persisted:true});st.workStatus='Eingereicht';addActivity(st,\`Dokument dauerhaft in Supabase abgelegt: \${file.name}\`);try{await saveLuminaTaskToSupabase(row,st);}catch(statusError){console.warn('Status konnte nicht gespeichert werden',statusError);}showTopNote('Dokument dauerhaft gespeichert.');renderTaskModal();}catch(error){if(prepared?.document_id)await luminaDb.rpc('cancel_document_upload',{p_document_id:prepared.document_id});showTopNote('Upload fehlgeschlagen: '+(error.message||error),true);if(button){button.disabled=false;button.textContent='Im Datenraum ablegen';}}}

function getNodeAtPath(nodes,path){let list=nodes,node=null;for(const idx of path){node=list?.[idx];if(node==null)return null;list=explorerNodeChildren(node);}return node;}
let explorerExpandedFolders=new Set();
function renderExplorerTreeNodes(nodes,parentPath=[],depth=0,selectedKey=""){
  return (nodes||[]).map((node,i)=>{
    const path=[...parentPath,i],key=path.join('.'),name=explorerNodeName(node),children=explorerNodeChildren(node),hasChildren=children.length>0,isOpen=explorerExpandedFolders.has(key),taskIndex=Number.isInteger(node?.taskIndex)?node.taskIndex:"";
    return \`<div class="explorer-folder-node"><button class="explorer-folder \${key===selectedKey?'active':''} \${isOpen?'is-open':''}" data-folder="\${luminaEsc(key)}" data-has-children="\${hasChildren?'1':'0'}" data-task-index="\${taskIndex}" style="padding-left:\${8+depth*14}px"><span class="explorer-folder-icon">\${hasChildren?'▸':'·'}</span><span title="\${luminaEsc(name)}">\${luminaEsc(name)}</span></button>\${hasChildren?\`<div class="explorer-folder-children \${isOpen?'is-open':''}">\${renderExplorerTreeNodes(children,path,depth+1,selectedKey)}</div>\`:''}</div>\`;
  }).join('');
}
function renderExplorerRoom(row,st){const pbc=luminaPbcRows(),ri=pbc?.rows?.indexOf(row)??0,folder=ensureExplorerFolder(st,row,ri),docs=explorerDocsInFolder(folder.key),tree=renderExplorerTreeNodes(getDataroomTree(),[],0,folder.key),rows=docs.map(doc=>\`<div class="explorer-row"><div class="explorer-file-name"><div class="explorer-file-icon">\${explorerFileKind(doc)}</div><div class="explorer-file-text"><div class="explorer-file-title" title="\${luminaEsc(doc.name)}">\${luminaEsc(doc.name)}</div><div class="explorer-file-sub">Aufgabe \${luminaEsc(doc.taskNumber||'–')} · \${luminaEsc(doc.comment||doc.taskTitle||'')}</div></div></div><div>\${luminaEsc(doc.taskNumber||'–')}</div><div>V\${luminaEsc(doc.version||1)}</div><div>\${formatDateTime(doc.uploadedAt)}</div><div class="explorer-actions"><button class="explorer-action" data-download="\${luminaEsc(doc.id)}">Öffnen</button><button class="explorer-action danger" data-remove="\${luminaEsc(doc.id)}">×</button></div></div>\`).join('');return \`<div class="explorer-shell"><aside class="explorer-tree"><div class="explorer-tree-head"><div><div class="explorer-tree-title">Prozessstruktur 1–8</div><div class="explorer-tree-sub">\${pbc?.rows?.length||0} Maßnahmen · je Maßnahme ein Datenraumordner</div></div><div class="explorer-tree-controls"><button class="explorer-tree-control" id="explorer-expand-all">Alle aufklappen</button><button class="explorer-tree-control" id="explorer-collapse-all">Alle zuklappen</button></div></div>\${tree||'<div class="explorer-empty">Keine Aufgabenstruktur vorhanden.</div>'}</aside><section class="explorer-main"><div class="explorer-head"><div class="explorer-breadcrumb">\${luminaEsc(folder.names.slice(0,-1).join(' › ')||'Jahresabschlussprozess')}<strong>\${luminaEsc(folder.name)}</strong></div><div class="explorer-toolbar"><button class="btn-save" id="explorer-toggle-upload">Dokument hinzufügen</button></div></div><div class="explorer-assignment"><span>Fester Maßnahmenordner: <b>\${luminaEsc(folder.names.join(' › '))}</b></span><span>\${docs.length} Dokument\${docs.length===1?'':'e'} in dieser Maßnahme</span></div><div class="explorer-upload" id="explorer-upload"><div class="task-field"><label>Datei</label><input id="explorer-file" type="file"></div><div class="task-field"><label>oder externer Link</label><input id="explorer-url" type="url" placeholder="https://..."></div><div class="task-field span-2"><label>Anzeigename bei Link</label><input id="explorer-name" type="text" placeholder="z. B. Anlagenspiegel 2026"></div><div class="task-field span-2"><label>Kommentar</label><input id="explorer-comment" type="text" placeholder="optional"></div><div class="explorer-upload-actions"><button class="btn-secondary" id="explorer-cancel-upload">Abbrechen</button><button class="btn-save" id="explorer-save-document">Im Maßnahmenordner ablegen</button></div></div><div class="explorer-list"><div class="explorer-row head"><div>Name</div><div>Aufgabe</div><div>Version</div><div>Hochgeladen</div><div>Aktion</div></div>\${rows||'<div class="explorer-empty"><strong>Noch keine Dokumente</strong>Fügen Sie für diese Maßnahme eine Datei oder einen Link hinzu.</div>'}</div><div class="dropbox-room-note"><strong>Prozessorientiert:</strong> Der Datenraum folgt exakt den 8 Prozessphasen und den Maßnahmen des Dashboards. Dokumente bleiben dauerhaft im privaten Supabase-Datenraum gespeichert.</div></section></div>\`;}
function bindExplorerRoom(row,st){document.querySelectorAll('.explorer-folder').forEach(b=>b.onclick=()=>{const key=b.dataset.folder,hasChildren=b.dataset.hasChildren==='1',taskIndex=b.dataset.taskIndex;if(hasChildren){if(explorerExpandedFolders.has(key))explorerExpandedFolders.delete(key);else explorerExpandedFolders.add(key);renderTaskModal();return;}if(taskIndex!==''&&Number.isInteger(Number(taskIndex))){const pbc=luminaPbcRows();if(pbc?.sub&&pbc.rows[Number(taskIndex)]){openTaskModal(pbc.sub,Number(taskIndex),'room');return;}}});const expandAll=document.getElementById('explorer-expand-all');if(expandAll)expandAll.onclick=()=>{flattenDataroomFolders().forEach(f=>{if(explorerNodeChildren(getNodeAtPath(getDataroomTree(),f.path)).length)explorerExpandedFolders.add(f.key);});renderTaskModal();};const collapseAll=document.getElementById('explorer-collapse-all');if(collapseAll)collapseAll.onclick=()=>{explorerExpandedFolders.clear();renderTaskModal();};const toggle=document.getElementById('explorer-toggle-upload'),box=document.getElementById('explorer-upload');if(toggle&&box)toggle.onclick=()=>box.classList.toggle('open');const cancel=document.getElementById('explorer-cancel-upload');if(cancel&&box)cancel.onclick=()=>box.classList.remove('open');const save=document.getElementById('explorer-save-document');if(save)save.onclick=()=>explorerAddDocument(st,row);const docs=allExplorerDocuments();document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.download);if(d)explorerDownload(d);});document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.remove);if(d)explorerRemoveDocument(d);});}
`
  // String.raw keeps \` and \${ escaped so this literal can safely embed
  // backtick/${} template syntax without ending or interpolating early;
  // un-escape just those two sequences (regex escapes like \d, \., \/ stay intact).
  .replace(/\\`/g, "`")
  .replace(/\\\$\{/g, "${");
const processDataroomStart = html.indexOf("function getDataroomTree()");
const processDataroomEnd = html.indexOf("\nfunction emailText(", processDataroomStart);
if (processDataroomStart < 0 || processDataroomEnd < 0) {
  throw new Error("Datenraum-Block für prozessorientierte Struktur nicht gefunden");
}
html = html.slice(0, processDataroomStart) + processDataroomBlock + html.slice(processDataroomEnd);
if (!html.includes(".explorer-tree-sub{")) {
  html = html.replace(
    ".explorer-tree-title{",
    ".explorer-tree-sub{font-size:10.5px;color:var(--text-faint);margin-top:3px;line-height:1.35;}\n  .explorer-tree-title{",
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Prepared ${outputPath}`);
