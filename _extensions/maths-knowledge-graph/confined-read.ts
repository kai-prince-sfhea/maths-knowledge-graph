// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Installed Quarto helper; original implementation, no external imports/models.
// Verify ordinary descendants of the canonical project root before/after reads.
import {isAbsolute, join, relative, resolve, sep} from 'node:path';

const MAX_BYTES=2*1024*1024;
const fail=():never=>{throw new Error('confined-input-unavailable');};
const mapping=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const pathValue=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=4096&&v===v.trim()&&
 !/[\\:\u0000-\u001f\u007f?#]/.test(v)&&!v.startsWith('/')&&!v.split('/').some(p=>!p||p==='.'||p==='..');
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function boundedRead(reader:ReadableStream<Uint8Array>,limit:number){
 const input=reader.getReader(),parts:Uint8Array[]=[];let length=0;
 try{for(;;){const{done,value}=await input.read();if(done)break;length+=value.length;if(length>limit){await input.cancel();fail();}parts.push(value);}}
 finally{input.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
async function ordinary(root:string,path:string,missing=false){
 if(!pathValue(path))fail();let cursor=root;const parts=path.split('/');
 for(const[index,part]of parts.entries()){
  cursor=join(cursor,part);let info;try{info=await Deno.lstat(cursor);}catch(error){if(missing&&error instanceof Deno.errors.NotFound)return null;fail();}
  if(info.isSymlink||!(index===parts.length-1?info.isFile:info.isDirectory))fail();
 }
 const physical=await Deno.realPath(cursor),local=relative(root,physical);
 if(!local||isAbsolute(local)||local==='..'||local.startsWith('..'+sep))fail();
 return physical;
}
export async function readConfined(input:unknown){
 if(!mapping(input)||Object.keys(input).some(k=>!['version','root','path','discover'].includes(k))||input.version!==1||
  typeof input.root!=='string'||!isAbsolute(input.root)||input.root.length>32768)fail();
 const root=await Deno.realPath(input.root),rootInfo=await Deno.stat(root);if(!rootInfo.isDirectory)fail();
 let path=input.path;
 if(input.discover!==undefined){
  if(path!==undefined||!Array.isArray(input.discover)||!input.discover.length||input.discover.length>16||input.discover.some((v:unknown)=>!pathValue(v)))fail();
  path=null;for(const name of input.discover){if(await ordinary(root,name,true)){path=name;break;}}
  if(path===null)return {version:1,path:null};
 }
 if(!pathValue(path))fail();const physical=await ordinary(root,path),before=await Deno.stat(physical!);
 if(!before.isFile||before.size>MAX_BYTES)fail();const file=await Deno.open(physical!,{read:true});
 const bytes=await boundedRead(file.readable,MAX_BYTES);
 if(bytes.length>MAX_BYTES||bytes.length!==before.size)fail();
 const afterPath=await ordinary(root,path),after=await Deno.stat(afterPath!);
 if(afterPath!==physical||after.size!==before.size||after.mtime?.getTime()!==before.mtime?.getTime())fail();
 const raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 return {version:1,path,raw,bytes:bytes.length,sha256:await hash(bytes)};
}
if(import.meta.main){
 try{
  const bytes=await boundedRead(Deno.stdin.readable,65536);
  const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  console.log(JSON.stringify(await readConfined(input)));
 }catch{console.error('maths-knowledge-graph: cannot read configured input; use an ordinary UTF-8 file inside the project, without symlinks or junctions (maximum 2 MiB)');Deno.exit(1);}
}
