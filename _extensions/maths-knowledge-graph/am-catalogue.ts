// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Validate a separately installed current-AST producer, never old HTML.
import {lstat,open,realpath} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
export const AM_API_PINS=Object.freeze({
  '_extension.yml':'4a006a18bc116a42b46609ca1531ee266694d49ff14b4c66d8813fb46638a86a',
  'catalogue-api.lua':'131ca3d754bb62565504e6a6262a8e452c4bf9299497c5f4a12577972f7fff49',
  'catalogue.ts':'cbd678e55ea556da503d3d547b70d5a85da4365ddead99cc79dc8603c71bda14',
  'intent-grammar.lua':'16cf8830f8f6c1339d8ad14eb9bfc301980b9e28e306843b1ee34314d2aac3ca',
  'intent-grammar.js':'3334ed74561fbed9d76c0c472f55138779fa1a18b29ebd26f3b61673c2642a4f'});
export const AM_API_SUPPORTED=Object.freeze({'0.0.8':AM_API_PINS,'0.0.9':Object.freeze({"_extension.yml":"cc9684afb154ac37dacd7912747f238318b90174253ed628fb1229db1abc61cb","catalogue-api.lua":"f7db0556f8c0a9ed8d0827d041d833160b2c5d63c41229a0d37cc0ca83d8170d","catalogue.ts":"68e9b743a5d4734474bd80879d8e4da32dcfa69f358fa2ae93f90b5a62b2665c","intent-grammar.lua":"16cf8830f8f6c1339d8ad14eb9bfc301980b9e28e306843b1ee34314d2aac3ca","intent-grammar.js":"3334ed74561fbed9d76c0c472f55138779fa1a18b29ebd26f3b61673c2642a4f"})});
const fail=():never=>{throw new Error('maths-knowledge-graph: incompatible Accessible Maths catalogue or unconfined current source');};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const keys=(v:unknown,allowed:string[],required=allowed)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(v,k)))fail();return v;};
const text=(v:unknown,max=2048)=>{if(typeof v!=='string'||!v.trim()||new TextEncoder().encode(v).length>max||/[\u0000-\u001f\u007f-\u009f]/.test(v))fail();return v;};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))fail();return v;};
export const amCanonical=(v:any):string=>{
 if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);
 if(Array.isArray(v)){for(let i=0;i<v.length;i++)if(!Object.hasOwn(v,i))fail();return '['+v.map(amCanonical).join(',')+']';}
 if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+amCanonical(v[k])).join(',')+'}';return fail();
};
const sha=async(bytes:Uint8Array|string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
const local=(v:unknown)=>{const s=text(v,4096);if(/[:\\?#%]/.test(s)||s.startsWith('/')||s.split('/').some(p=>!p||p==='.'||p==='..'||['.git','.quarto'].includes(p.toLowerCase())))fail();return s;};
const anchor=(v:unknown)=>{const s=text(v,512);if(/[\s#"'<>]/.test(s))fail();return s;};
export function safeMathIdentity(value:unknown){
 const s=text(value,4096);if(/[\s\u0000-\u001f\u007f\\<>"{}]/.test(s))fail();
 if(/^urn:[A-Za-z0-9][A-Za-z0-9-]{0,31}:[A-Za-z0-9()+,\-.:=@;$_!*'%/?#]+$/.test(s)&&!/%(?![A-Fa-f0-9]{2})/.test(s))return s;
 const match=/^https?:\/\/([^/?#]+)/.exec(s);if(!match||match[1].includes('@'))fail();
 const pair=/^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(match[1]);if(!pair||pair[1].startsWith('.')||pair[1].endsWith('.')||pair[1].includes('..')||pair[2]&&Number(pair[2])>65535)fail();return s;
}
async function ordinaryBytes(rootInput:string,path:string,maximum:number){
 const root=resolve(rootInput),rootInfo=await lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())fail();const physicalRoot=await realpath(root);
 const filename=local(path),parts=filename.split('/');let cursor=root;
 const ordinary=async()=>{cursor=root;for(const [i,p]of parts.entries()){cursor=join(cursor,p);const s=await lstat(cursor);if(s.isSymbolicLink()||!(i===parts.length-1?s.isFile():s.isDirectory()))fail();}const physical=await realpath(cursor),suffix=relative(physicalRoot,physical);if(!suffix||isAbsolute(suffix)||suffix==='..'||suffix.startsWith('..'+sep))fail();return physical;};
 const physical=await ordinary(),before=await lstat(physical);if(before.size>maximum)fail();const handle=await open(physical,'r');let bytes:Uint8Array;
 try{const info=await handle.stat();if(info.ino!==before.ino||info.dev!==before.dev||info.size!==before.size)fail();const buffer=new Uint8Array(maximum+1);let length=0;while(length<buffer.length){const got=await handle.read(buffer,length,buffer.length-length,null);if(!got.bytesRead)break;length+=got.bytesRead;}if(length>maximum||length!==before.size)fail();bytes=buffer.slice(0,length);const after=await handle.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail();}finally{await handle.close();}
 const afterPath=await ordinary(),after=await lstat(afterPath);if(afterPath!==physical||after.ino!==before.ino||after.dev!==before.dev||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail();new TextDecoder('utf-8',{fatal:true}).decode(bytes);return bytes;
}
export async function locateAMAPI(input:unknown){
 const v=keys(input,['version','operation','root','candidates']);if(v.version!==1||v.operation!=='locate'||typeof v.root!=='string'||!isAbsolute(v.root)||!Array.isArray(v.candidates)||v.candidates.length>8)fail();
 let found=false;const matches=[];
 for(const candidate of [...new Set(v.candidates.map(local))]){
  try{const stat=await lstat(join(v.root,candidate));if(!stat.isDirectory()||stat.isSymbolicLink()){found=true;continue;}}catch{continue;}found=true;
  try{const observed:Record<string,string>={};for(const file of Object.keys(AM_API_PINS))observed[file]=await sha(await ordinaryBytes(v.root,candidate+'/'+file,2*1024*1024));for(const [version,pins]of Object.entries(AM_API_SUPPORTED))if(Object.entries(pins).every(([file,pin])=>observed[file]===pin)){matches.push({path:candidate,version,pins});break;}}catch{/* Incompatible or linked producer stays unavailable; never execute it. */}
 }
 if(matches.length>1)return{version:1,status:'unavailable',reason:'ambiguous-compatible-producers'};
 return matches.length?{version:1,status:'available',path:matches[0].path,apiVersion:1,producerVersion:matches[0].version,payloadSha256:await sha(amCanonical(matches[0].pins))}:{version:1,status:'unavailable',reason:found?'incompatible-producer':'producer-not-installed'};
}
export async function validateAMPacket(packet:unknown,context:{source:string;sourceSha256:string;anchors:string[]}){
 const p=keys(packet,['version','kind','status','producer','source','declarationsSha256','records']);
 if(p.version!==1||p.kind!=='accessible-maths-catalogue'||p.status!=='complete'||!Array.isArray(p.records)||p.records.length>256||p.records.length===0)fail();
 const producer=keys(p.producer,['name','version']);if(producer.name!=='accessible-maths'||!Object.hasOwn(AM_API_SUPPORTED,producer.version))fail();
 const source=keys(p.source,['document','precision','sha256']);if(source.document!==context.source||source.precision!=='containing-document'||digest(source.sha256)!==digest(context.sourceSha256))fail();
 if(!Array.isArray(context.anchors)||context.anchors.length>100000||new Set(context.anchors).size!==context.anchors.length)fail();const anchors=new Set(context.anchors.map(anchor)),ids=new Set(),seen=new Set();let previous='';
 for(const raw of p.records){
  const r=keys(raw,['id','type','label','anchor','scope','review','public','lexicalScope','bodySha256','notation','declarationSha256'],['id','type','label','anchor','scope','review','public','lexicalScope','bodySha256','declarationSha256']);
  const id=safeMathIdentity(r.id),a=anchor(r.anchor);text(r.label);if(!/^(?:def|thm|lem|cor|prp|cnj|exm|exr)$/.test(r.type)||!a.startsWith(r.type+'-')||!anchors.has(a)||seen.has(a)||ids.has(id)||previous>=a||!(/^[a-z][a-z0-9-]{0,63}$/).test(text(r.scope,64))||r.review!=='author-reviewed'||r.public!==true)fail();
  seen.add(a);ids.add(id);previous=a;digest(r.bodySha256);const lexical=keys(r.lexicalScope,['kind','anchor'],['kind']);if(lexical.kind==='document'){if(Object.hasOwn(lexical,'anchor'))fail();}else if(lexical.kind!=='div'||!anchors.has(anchor(lexical.anchor)))fail();
  // AM's pinned API validates actual TeX/intent/signatures. Keep it data only;
  // this is NOT admission to MKG's separately approved substitution profiles.
  if(r.notation!==undefined){
   const n=keys(r.notation,['command','roles','intent','visualTeX','signature','lexicalScope'],['command','roles','intent','visualTeX','signature']);
   if(!/^am[A-Z][A-Za-z]*$/.test(text(n.command,64))||['amIntent','amArg'].includes(n.command)||!Array.isArray(n.roles)||n.roles.length<1||n.roles.length>4)fail();
   const roles=n.roles.map((role:unknown)=>text(role,64));if(new Set(roles).size!==roles.length)fail();text(n.intent);text(n.visualTeX,4096);
   const signature=keys(n.signature,['version','parameters']);if(signature.version!==1||!Array.isArray(signature.parameters)||signature.parameters.length!==roles.length)fail();
   signature.parameters.forEach((raw:unknown,index:number)=>{const p=keys(raw,['role','kind','defaultTeX'],['role','kind']);if(p.role!==roles[index]||!['required','optional'].includes(p.kind)||p.kind==='optional'&&index!==0)fail();if(p.kind==='required'){if(Object.hasOwn(p,'defaultTeX'))fail();}else if(typeof p.defaultTeX!=='string'||new TextEncoder().encode(p.defaultTeX).length>1024||/[\u0000-\u001f\u007f-\u009f]/.test(p.defaultTeX))fail();});
   if(n.lexicalScope!==undefined){const scope=keys(n.lexicalScope,['kind','anchor'],['kind']);if(amCanonical(scope)!==amCanonical(lexical))fail();}
   if(new TextEncoder().encode(amCanonical(n)).length>16384)fail();
  }
  const {declarationSha256,...body}=r;if(digest(declarationSha256)!==await sha(amCanonical(body)))fail();
 }
 if(digest(p.declarationsSha256)!==await sha(amCanonical(p.records)))fail();return JSON.parse(amCanonical(p));
}
export async function processAMRequest(value:unknown){
 if(object(value)&&value.operation==='locate')return locateAMAPI(value);
 const v=keys(value,['version','operation','root','source','anchors','packet']);if(v.version!==1||v.operation!=='validate'||typeof v.root!=='string'||!isAbsolute(v.root)||!/\.(?:qmd|md)$/i.test(local(v.source)))fail();
 const bytes=await ordinaryBytes(v.root,v.source,2*1024*1024),packet=await validateAMPacket(v.packet,{source:v.source,sourceSha256:await sha(bytes),anchors:v.anchors});return{version:1,status:'validated',packet};
}
if((import.meta as any).main){try{const deno=(globalThis as any).Deno,reader=deno.stdin.readable.getReader(),parts:Uint8Array[]=[];let length=0;for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>3*1024*1024)fail();parts.push(next.value);}const bytes=new Uint8Array(length);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));await deno.stdout.write(new TextEncoder().encode(JSON.stringify(await processAMRequest(input))));}catch{console.error('maths-knowledge-graph: Accessible Maths import refused incompatible, changed, unsafe or unconfined current declarations');(globalThis as any).Deno.exit(1);}}
