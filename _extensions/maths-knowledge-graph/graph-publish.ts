// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original producer for KG's existing public-only run-bound protocol.
// No renderer, canonical declaration editing, external imports or inference.
import {lstat,mkdir,open,realpath,rename,unlink} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {AM_API_SUPPORTED,amCanonical,safeMathIdentity} from './am-catalogue.ts';
const fail=():never=>{throw Error('maths-knowledge-graph: graph publication requires current confined public declarations and a prepared KG run');};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:unknown,allowed:string[])=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))fail();return v;};
const text=(v:unknown,maximum=2048)=>{if(typeof v!=='string'||!v.trim()||new TextEncoder().encode(v).length>maximum||/[\u0000-\u001f\u007f]/.test(v))fail();return v;};
const path=(v:unknown)=>{const s=text(v,4096);if(/[:\\?#%]/.test(s)||s.startsWith('/')||s.split('/').some(p=>!p||p==='.'||p==='..'))fail();return s;};
const authorInput=(v:unknown)=>{const p=path(v);if(p.split('/').some(part=>part.startsWith('.')||['_extensions','node_modules'].includes(part.toLowerCase())))fail();return p;};
const anchor=(v:unknown)=>{const s=text(v,512);if(/[\s#"'<>]/.test(s))fail();return s;};
const sha=async(bytes:Uint8Array|string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
// The coordinator records interpreted YAML metadata, not raw file bytes.
// Keep this small interoperability fingerprint separate from source hashes.
// Its only semantic omission is knowledge-graph.mode (the coordinator contract).
function metadataCanonical(value:any,depth=0,budget={nodes:0,scalarBytes:0}):string{
 if(depth>64||++budget.nodes>200000)fail();
 if(Array.isArray(value))return '['+value.map(item=>metadataCanonical(item,depth+1,budget)).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>{const name=JSON.stringify(key);budget.scalarBytes+=name.length;if(budget.scalarBytes>8*1024*1024)fail();return name+':'+metadataCanonical(value[key],depth+1,budget);}).join(',')+'}';
 const encoded=JSON.stringify(value);if(encoded===undefined)fail();budget.scalarBytes+=encoded.length;if(budget.scalarBytes>8*1024*1024)fail();return encoded;
}
async function nativeMetadataParse(raw:string){const{parse}=await import('stdlib/yaml');return parse(raw);}
export async function mathsMetadataDigest(bytes:Uint8Array,parseMetadata:(raw:string)=>unknown|Promise<unknown>=nativeMetadataParse){
 const raw=await parseMetadata(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!object(raw))fail();
 const value=structuredClone(raw);delete value['knowledge-graph']?.mode;return sha(metadataCanonical(value));
}
export function buildMathsProducer(value:unknown,runId:string){
 const v=keys(value,['graph','source','output','language','objects','relations','dependencyDigests','amApiPath']);
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(runId)||!/\.qmd$/i.test(authorInput(v.source))||!/\.html?$/i.test(path(v.output))||v.output.split('/').some((part:string)=>part.startsWith('.')||part.toLowerCase()==='_extensions'))fail();
 const g=keys(v.graph,['id','label','navigation','search']);if(!/^[a-z][a-z0-9-]{0,63}$/.test(text(g.id,64))||['website','constructor','prototype'].includes(g.id)||typeof g.navigation!=='boolean'||typeof g.search!=='boolean')fail();text(g.label,256);
 const language=text(v.language,80);if(!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language)||!Array.isArray(v.objects)||!Array.isArray(v.relations)||v.objects.length>10000||v.relations.length>20000)fail();
 const ids=new Set<string>(),relationIds=new Set<string>();
 const objects=v.objects.map((raw:unknown)=>{const r=keys(raw,['id','type','scope','label','anchor','qualification','review']);const id=safeMathIdentity(r.id);if(ids.has(id))fail();ids.add(id);if(!['declared','author-reviewed'].includes(r.review))fail();return{id,type:text(r.type,128),scope:text(r.scope,256),labels:{[language]:text(r.label,4096)},source:{path:v.source,anchor:anchor(r.anchor),precision:'anchor'},review:'declared',origin:'author-declared',provenance:{qualification:text(r.qualification),review:r.review}};});
 const relations=v.relations.map((raw:unknown)=>{const r=keys(raw,['id','type','from','to','scope','anchor']);const id=safeMathIdentity(r.id),from=safeMathIdentity(r.from),to=safeMathIdentity(r.to);if(ids.has(id)||relationIds.has(id)||!ids.has(from)||!ids.has(to))fail();relationIds.add(id);return{id,type:text(r.type,128),from,to,scope:text(r.scope,256),source:{path:v.source,anchor:anchor(r.anchor),precision:'anchor'},review:'declared',origin:'author-declared'};});
 if(!Array.isArray(v.dependencyDigests)||v.dependencyDigests.length>10000)fail();const seen=new Set();const digests=v.dependencyDigests.map((raw:unknown)=>{const r=keys(raw,['path','sha256']);const p=authorInput(r.path);if(seen.has(p)||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256))fail();seen.add(p);return{path:p,algorithm:'sha256',digest:r.sha256};}).sort((a:any,b:any)=>a.path.localeCompare(b.path));
 return{producerVersion:1,producer:'maths-knowledge-graph',runId,source:v.source,output:v.output,graph:{id:g.id,label:g.label,navigation:g.navigation,search:g.search},objects,relations,dependencies:[...new Set([v.source,...digests.map((r:any)=>r.path)])].sort(),dependencyDigests:digests};
}
async function ordinary(root:string,p:string,maximum:number){
 const parts=path(p).split('/');let cursor=root;
 for(const [i,part]of parts.entries()){cursor=join(cursor,part);const info=await lstat(cursor);if(info.isSymbolicLink()||!(i===parts.length-1?info.isFile():info.isDirectory()))fail();}
 const physical=await realpath(cursor),suffix=relative(root,physical);if(!suffix||isAbsolute(suffix)||suffix==='..'||suffix.startsWith('..'+sep))fail();const before=await lstat(physical);if(before.size>maximum)fail();
 const file=await open(physical,'r');let bytes:Uint8Array;
 try{const stat=await file.stat();if(stat.ino!==before.ino||stat.dev!==before.dev||stat.size!==before.size)fail();const buffer=new Uint8Array(maximum+1);let count=0;while(count<buffer.length){const got=await file.read(buffer,count,buffer.length-count,null);if(!got.bytesRead)break;count+=got.bytesRead;}if(count>maximum||count!==before.size)fail();bytes=buffer.slice(0,count);const after=await file.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail();}finally{await file.close();}
 const afterPath=await realpath(cursor),after=await lstat(cursor);if(after.isSymbolicLink()||afterPath!==physical||after.ino!==before.ino||after.dev!==before.dev||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail();return bytes;
}
export async function publishMathsGraph(input:unknown,{parseMetadata=nativeMetadataParse}:{parseMetadata?:(raw:string)=>unknown|Promise<unknown>}={}){
 const v=keys(input,['version','root','projection']);if(v.version!==1||typeof v.root!=='string'||!isAbsolute(v.root))fail();const root=resolve(v.root),info=await lstat(root);if(info.isSymbolicLink()||!info.isDirectory())fail();const physicalRoot=await realpath(root);
 const pointer='.quarto/knowledge-graph/run.json';let runBytes:Uint8Array;
 try{runBytes=await ordinary(physicalRoot,pointer,8*1024*1024);}catch(error){if((error as any)?.code==='ENOENT')return{version:1,status:'unavailable',reason:'no-prepared-kg-run'};throw error;}
 const run=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(runBytes));if(!object(run)||run.contractVersion!==0||run.compositionVersion!==1||run.active!==true)return{version:1,status:'unavailable',reason:'incompatible-kg-run'};
 if(run.stateDir!=='.quarto/knowledge-graph'||typeof run.runId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(run.runId)||!Array.isArray(run.allRenderedSources)||run.allRenderedSources.length>100000||!run.allRenderedSources.includes(v.projection?.source))fail();
 const preparedBytes=await ordinary(physicalRoot,`.quarto/knowledge-graph/runs/${run.runId}/prepared.json`,8*1024*1024),prepared=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(preparedBytes));if(amCanonical(prepared)!==amCanonical(run))fail();
 const finalized=`.quarto/knowledge-graph/runs/${run.runId}/finalized.json`;
 try{await ordinary(physicalRoot,finalized,8*1024*1024);return{version:1,status:'unavailable',reason:'completed-kg-run'};}catch(error){if((error as any)?.code!=='ENOENT')throw error;}
 const projection={...v.projection,dependencyDigests:[...(v.projection?.dependencyDigests??[])]};
 const dependencies=new Map<string,string>();
 for(const row of projection.dependencyDigests){if(!object(row)||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256))fail();dependencies.set(authorInput(row.path),row.sha256);}
 const closure=run.sourceDependencies?.[projection.source]??[projection.source];if(!Array.isArray(closure)||closure.length>10000||!Array.isArray(run.dependencies)||run.dependencies.length>100000)fail();
 const originalHashes=new Map(run.dependencies.filter((r:any)=>object(r)&&typeof r.path==='string'&&typeof r.hash==='string').map((r:any)=>[r.path,r.hash]));
 // A removed filter/configuration must not stage into a prior failed run.
 // This verifies ordinary authored metadata, not a fabricated active-filter API.
 const sourceDirectory=dirname(path(projection.source)).replaceAll('\\','/');let checkedBytes=0;
 if(projection.amApiPath!==undefined){
  const api=path(projection.amApiPath);if(!/^_extensions\/(?:[^/]+\/)?accessible-maths$/.test(api))fail();
  // Executable extension payloads are coordinator context, never public author
  // inputs. Verify the admitted API again without placing _extensions paths in
  // the producer dependency list consumed by withdrawal/cache recovery.
  const files=Object.keys(AM_API_SUPPORTED['0.0.8']),receipts=new Map<string,any>();
  for(const file of files){
   const matches=run.dependencies.filter((row:any)=>object(row)&&row.kind==='companion-runtime'&&row.path==='companion/'+api+'/'+file);
   if(matches.length!==1)return{version:1,status:'unavailable',reason:'am-runtime-not-in-prepared-context'};
   receipts.set(file,matches[0]);
  }
  const supported=Object.values(AM_API_SUPPORTED).filter(pins=>Object.keys(pins).length===files.length&&files.every(file=>Object.hasOwn(pins,file)&&receipts.get(file).hash===(pins as Record<string,string>)[file]));
  if(supported.length!==1)return{version:1,status:'unavailable',reason:'am-runtime-not-in-prepared-context'};
  for(const [file,pin]of Object.entries(supported[0])){
   const name=api+'/'+file;
   const bytes=await ordinary(physicalRoot,name,2*1024*1024);checkedBytes+=bytes.length;if(checkedBytes>32*1024*1024||await sha(bytes)!==pin)fail();
  }
 }
 for(const row of run.dependencies){if(object(row)&&row.kind==='metadata'){
  const p=path(row.path),directory=dirname(p).replaceAll('\\','/');if(directory!=='.'&&sourceDirectory!==directory&&!sourceDirectory.startsWith(directory+'/'))continue;
  const bytes=await ordinary(physicalRoot,p,2*1024*1024);checkedBytes+=bytes.length;if(checkedBytes>32*1024*1024)fail();
  if(typeof row.hash!=='string'||!/^[a-f0-9]{64}$/.test(row.hash)||await mathsMetadataDigest(bytes,parseMetadata)!==row.hash)return{version:1,status:'unavailable',reason:'prepared-metadata-changed'};
 }}
 for(const p of closure){if(typeof p!=='string')fail();if(/\.(?:qmd|md)$/i.test(p)){authorInput(p);const hash=originalHashes.get(p);if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||dependencies.has(p)&&dependencies.get(p)!==hash)fail();dependencies.set(p,hash);}}
 if(dependencies.size>512)fail();
 for(const [p,expected]of dependencies){const bytes=await ordinary(physicalRoot,p,2*1024*1024);checkedBytes+=bytes.length;if(checkedBytes>32*1024*1024||await sha(bytes)!==expected)fail();}
 projection.dependencyDigests=[...dependencies].map(([path,sha256])=>({path,sha256}));
 const envelope=buildMathsProducer(projection,run.runId),raw=new TextEncoder().encode(JSON.stringify(envelope));if(raw.length>4*1024*1024)fail();
 const runDirectory=join(physicalRoot,'.quarto/knowledge-graph/runs',run.runId),directory=join(runDirectory,'producers');
 try{await mkdir(directory);}catch(error){if((error as any)?.code!=='EEXIST')throw error;}
 const dirInfo=await lstat(directory),dirPhysical=await realpath(directory);if(!dirInfo.isDirectory()||dirInfo.isSymbolicLink()||dirPhysical!==directory)fail();
 const filename=encodeURIComponent(envelope.source)+'.maths-knowledge-graph.json',destination=join(directory,filename),temp=destination+'.tmp-'+crypto.randomUUID();
 try{try{const old=await lstat(destination);if(!old.isFile()||old.isSymbolicLink())fail();}catch(error){if((error as any)?.code!=='ENOENT')throw error;}
  const out=await open(temp,'wx');try{await out.writeFile(raw);await out.sync();}finally{await out.close();}
  if(await sha(await ordinary(physicalRoot,pointer,8*1024*1024))!==await sha(runBytes))fail();
  await rename(temp,destination);
 }catch(error){await unlink(temp).catch(()=>{});throw error;}
 return{version:1,status:'published',graph:envelope.graph,objects:envelope.objects.length,relations:envelope.relations.length};
}
if((import.meta as any).main){try{const deno=(globalThis as any).Deno,reader=deno.stdin.readable.getReader(),parts:Uint8Array[]=[];let length=0;for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>4*1024*1024)fail();parts.push(next.value);}const bytes=new Uint8Array(length);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await deno.stdout.write(new TextEncoder().encode(JSON.stringify(await publishMathsGraph(input))));}catch{console.error('maths-knowledge-graph: cannot publish the current public maths graph; inspect the prepared companion run and ordinary confined source dependencies');(globalThis as any).Deno.exit(1);}}
