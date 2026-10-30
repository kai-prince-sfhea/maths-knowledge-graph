// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original finite proof-source bridge. No file IO, models or semantic inference.
import {inspectNativeSource,resolveSourceOrigin} from './source-map.ts';
export const PROOF_SOURCE_LIMITS=Object.freeze({files:64,depth:16,fileBytes:2*1024*1024,totalBytes:8*1024*1024,segments:512});
type File={path:string;text:string;sha256:string};
const fail=():never=>{throw Error('proof-source-unavailable');};
const plain=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const sha=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const validPath=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=4096&&/\.(?:qmd|md)$/i.test(v)&&!v.startsWith('/')&&!/[\\:\u0000-\u001f\u007f?#%]/.test(v)&&!v.split('/').some(p=>!p||p==='.'||p==='..'||['.quarto','.git','_extensions'].includes(p.toLowerCase()));
const unavailable=(reason:string)=>({status:'unavailable' as const,reason});
function includePath(owner:string,value:string){
 if(typeof value!=='string'||!value||value!==value.trim()||/[\\:\u0000-\u001f\u007f?#%]/.test(value)||value.startsWith('/'))fail();
 const parts=owner.split('/').slice(0,-1);for(const part of value.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)fail();parts.pop();}else parts.push(part);}
 const joined=parts.join('/');if(!validPath(joined))fail();return joined;
}
/** read is supplied by the native confined-file boundary. Only literal native
 * include shortcodes are followed, never globs, arbitrary project scans or URLs.
 * The whole observed closure is verified again before returning. */
export async function inventoryProofSources(source:string,read:(path:string)=>Promise<unknown>){
 const files:File[]=[],seen=new Set<string>();let total=0;
 async function visit(path:string,depth:number){
  if(!validPath(path)||depth>PROOF_SOURCE_LIMITS.depth||seen.has(path)||files.length>=PROOF_SOURCE_LIMITS.files)fail();seen.add(path);
  const value=await read(path);if(!plain(value)||value.path!==path||typeof value.raw!=='string'||typeof value.sha256!=='string'||!/^[a-f0-9]{64}$/.test(value.sha256))fail();
  const size=new TextEncoder().encode(value.raw).length;total+=size;if(size>PROOF_SOURCE_LIMITS.fileBytes||total>PROOF_SOURCE_LIMITS.totalBytes||await sha(value.raw)!==value.sha256)fail();
  files.push({path,text:value.raw,sha256:value.sha256});
  const inventory=inspectNativeSource(value.raw);if(!inventory.complete)fail();
  for(const include of inventory.includes){if(!include.safe||include.path===null)fail();await visit(includePath(path,include.path),depth+1);}
 }
 try{
  await visit(source,0);
  for(const file of files){const current=await read(file.path);if(!plain(current)||current.path!==file.path||current.sha256!==file.sha256||current.raw!==file.text)fail();}
  return{status:'available' as const,files};
 }catch{return{status:'unavailable' as const,reason:'include-closure-unavailable',files:[] as File[]};}
}
function proofFence(header:string){
 const value=header.trim();if(value==='maths-proof')return true;
 // Deliberately finite attribute syntax. Rich attributes keep local mappings.
 if(!/^\{(?:\s*[.#][^\s{}"'`<>]+\s*)+\}$/.test(value))return false;
 return value.slice(1,-1).trim().split(/\s+/).includes('.maths-proof');
}
function codeSegments(text:string,start:number,end:number){
 const segments:any[]=[];let codeStart=0,sourceStart=start;
 for(const match of text.slice(start,end).matchAll(/[^\r\n]*(?:\r\n|\n|\r|$)/g)){
  if(!match[0].length)continue;
  const newline=match[0].match(/\r\n$|[\r\n]$/)?.[0]??'',length=match[0].length-newline.length;
  segments.push({codeStart,codeEnd:codeStart+length,sourceStart,sourceEnd:sourceStart+length,lineEnding:newline==='\r\n'?'CRLF':newline==='\n'?'LF':newline==='\r'?'CR':'none'});
  codeStart+=length+(newline?1:0);sourceStart+=match[0].length;
 }
 if(segments.length&&segments.at(-1).lineEnding!=='none')segments.push({codeStart,codeEnd:codeStart,sourceStart,sourceEnd:sourceStart,lineEnding:'none'});
 if(segments.length>PROOF_SOURCE_LIMITS.segments)fail();return segments;
}
/** Native anchor admission is a caller obligation. This maps only a unique
 * original explicit block and one literal exact maths-proof fence inside it.
 * Full original source is not returned, only bounds and observed hashes. */
export async function prepareProofSourceObservation(files:unknown,input:unknown){
 if(!plain(input)||Object.keys(input).some(k=>!['source','sourceSha256','proofId','statementId','text'].includes(k))||!validPath(input.source)||!/^([a-f0-9]{64})$/.test(input.sourceSha256??'')||typeof input.text!=='string'||typeof input.proofId!=='string'||typeof input.statementId!=='string')fail();
 const base={version:1,coordinateUnits:'utf16-code-units',containing:{path:input.source,sha256:input.sourceSha256}};
 const missing=(reason:string)=>({...base,status:'unavailable',reason,closure:{status:'unavailable',fileCount:0,sha256:null},proof:unavailable(reason),statement:unavailable(reason),code:unavailable(reason)});
 if(!Array.isArray(files)||!files.length||files.length>PROOF_SOURCE_LIMITS.files)return missing('include-closure-unavailable');
 let total=0;for(const file of files){if(!plain(file)||typeof file.text!=='string')return missing('source-integrity');total+=new TextEncoder().encode(file.text).length;if(total>PROOF_SOURCE_LIMITS.totalBytes)return missing('include-closure-unavailable');}
 const proof=await resolveSourceOrigin(files,{anchor:input.proofId}),statement=await resolveSourceOrigin(files,{anchor:input.statementId});
 // resolveSourceOrigin verifies every supplied file byte/hash before resolving.
 if(proof.status==='unavailable'&&['invalid-input','source-integrity','limit'].includes(proof.reason))return missing('source-integrity');
 const accepted=files as File[],containing=accepted.find(file=>file.path===input.source);
 if(!containing||containing.sha256!==input.sourceSha256)return missing('source-integrity');
 const rows=accepted.map(file=>({path:file.path,sha256:file.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const closure={status:'complete',fileCount:rows.length,sha256:await sha(JSON.stringify(rows))};
 let code:any=unavailable('original-proof-fence-unavailable');
 if(proof.status==='available'&&proof.origin.span?.kind==='fenced-div'){
  const original=accepted.find(file=>file.path===proof.origin.path)!;
  const inventory=inspectNativeSource(original.text),span=proof.origin.span;
  const candidates=inventory.fences.filter(fence=>fence.safe&&fence.start>=span.start&&fence.end<=span.end&&proofFence(fence.header));
  if(inventory.complete&&candidates.length===1){
   const fence=candidates[0],start=fence.contentStart;
   let end=fence.contentEnd;const terminal=original.text.slice(start,end).match(/\r\n$|[\r\n]$/)?.[0]??'';end-=terminal.length;
   const raw=original.text.slice(start,end);
   if(raw.replace(/\r\n?/g,'\n')===input.text.replace(/\r\n?/g,'\n'))code={status:'available',path:original.path,fileSha256:original.sha256,start,end,sha256:await sha(raw),normalization:'LF',segments:codeSegments(original.text,start,end)};
  }
 }
 const status=code.status==='available'&&statement.status==='available'?'available':proof.status==='available'||statement.status==='available'?'partial':'unavailable';
 return{...base,status,reason:status==='available'?null:code.status==='unavailable'?'original-proof-fence-unavailable':'original-statement-unavailable',closure,proof,statement,code};
}
