#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const html=await readFile(resolve(import.meta.dirname,"..","public","legacy","lumina.html"),"utf8");
const required=["function luminaSafeUrl(","luminaEsc(s.title)","luminaEsc(sub.text)","luminaSafeUrl(task.link)","noopener,noreferrer"];
const missing=required.filter(token=>!html.includes(token));
if(missing.length){console.error("XSS hardening markers missing:",missing);process.exit(1);}
const forbidden=["window.open(doc.url,'_blank','noopener')",'href="${luminaEsc(task.link)}"'];
const found=forbidden.filter(token=>html.includes(token));
if(found.length){console.error("Unsafe legacy output patterns remain:",found);process.exit(1);}
console.log("Legacy XSS hardening checks passed.");
