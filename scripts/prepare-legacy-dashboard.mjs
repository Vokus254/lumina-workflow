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


// Bilanz-/GuV-Akkordeon: gespeicherte Set-Zustände robust normalisieren.
html = html.replace(
  `function anyRootLevelOpen(rootKeys, expandedSet){
  return rootKeys.some(k => expandedSet.has(k));
}`,
  `function normalizeExpandedSet(value){
  if(value instanceof Set) return value;
  if(Array.isArray(value)) return new Set(value);
  if(value && Array.isArray(value.values)) return new Set(value.values);
  if(value && value.__isSet && Array.isArray(value.values)) return new Set(value.values);
  return new Set();
}

function anyRootLevelOpen(rootKeys, expandedSet){
  const normalized = normalizeExpandedSet(expandedSet);
  return rootKeys.some(k => normalized.has(k));
}`,
);

html = html.replace(
  `function renderStatement(){
  const sub = stations[view.station].measures[view.measure].subitems[view.sub];
  const container = document.getElementById("form-container");
  const tree = buildStatementTree();`,
  `function renderStatement(){
  const sub = stations[view.station].measures[view.measure].subitems[view.sub];
  const container = document.getElementById("form-container");
  sub.data = sub.data || {};
  sub.data.expanded = normalizeExpandedSet(sub.data.expanded);
  container.innerHTML = "";
  const tree = buildStatementTree();`,
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
console.log(`Prepared ${outputPath}`);
