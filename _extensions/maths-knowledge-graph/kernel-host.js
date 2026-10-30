/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
// Original bridge only. No Sandbox, jsCoq or Coq source/assets are distributed.
import {verifyProfileCandidate as verifyCandidateIntegrity} from './proof-profiles.js';
import {KERNEL_PROTOCOL,KERNEL_PINS,KERNEL_TOOLCHAIN,KERNEL_LIMITS,kernelOrigin,kernelReceipt,sameKernelToolchain,validKernelRequest} from './kernel-adapter.js';
import {createKernelInspector,validateKernelInspection} from './kernel-inspector.js';

const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
const verifiedAssets=new WeakMap();
const regularPath=value=>typeof value==='string'&&value.startsWith('/vendor/rocq820/coq-pkgs/unpacked/')&&!/[\\?#\u0000-\u0020\u007f%]/.test(value)&&!value.split('/').some(part=>part==='.'||part==='..');
async function readBounded(response,maximum,signal){
 if(!response.ok||response.redirected)throw new Error('runtime-transfer-failed');const length=response.headers?.get('content-length');if(length!==null&&length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maximum))throw new Error('runtime-transfer-limit');
 if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>maximum)throw new Error('runtime-transfer-limit');return bytes;}
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{while(true){if(signal?.aborted)throw new Error('cancelled');const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>maximum)throw new Error('runtime-transfer-limit');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const output=new Uint8Array(total);let offset=0;for(const part of chunks){output.set(part,offset);offset+=part.length;}return output;
}
/** Verify observed transferred bytes BEFORE importing the external runtime.
 * This is not execution attestation: the trusted origin/service worker/server
 * could change its module or Worker response after verification. */
export async function verifyExternalKernel(environment,signal){
 const origin=environment.location.origin,fetcher=environment.fetch.bind(environment),texts=new Map();let total=0,files=0;
 const fetchFile=async pin=>{const response=await fetcher(new URL(pin.path,origin),{cache:'reload',credentials:'omit',redirect:'error',signal});const bytes=await readBounded(response,pin.bytes,signal);
  total+=bytes.length;files++;if(total>KERNEL_LIMITS.totalBytes||bytes.length!==pin.bytes||await digest(bytes)!==pin.sha256)throw new Error('runtime-pin-mismatch');return bytes;};
 for(const pin of KERNEL_PINS){const bytes=await fetchFile(pin);if(pin.path.endsWith('.json'))texts.set(pin.path,new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 const catalogue=JSON.parse(texts.get('/data/assets.json')),libraries=JSON.parse(texts.get('/data/rocq-files.json'));
 if(!Array.isArray(catalogue.files)||catalogue.files.length>10000||!Array.isArray(libraries.files)||libraries.files.length>KERNEL_LIMITS.files)throw new Error('runtime-manifest-invalid');
 const listed=new Map();for(const value of catalogue.files){if(value&&typeof value.url==='string'&&value.url.startsWith('/vendor/rocq820/')){
  if(listed.has(value.url)||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>KERNEL_LIMITS.totalBytes||!/^[a-f0-9]{64}$/.test(value.sha256))throw new Error('runtime-manifest-invalid');listed.set(value.url,{path:value.url,bytes:value.bytes,sha256:value.sha256});}}
 const paths=[...new Set(libraries.files)];if(!paths.length||paths.some(path=>!regularPath(path)||!listed.has(path)))throw new Error('runtime-manifest-invalid');
 const transferred=new Array(paths.length);let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<paths.length){const position=cursor++,path=paths[position];transferred[position]={path,bytes:await fetchFile(listed.get(path))};}}));
 if(signal?.aborted)throw new Error('cancelled');verifiedAssets.set(environment,{libraries:transferred,paths:libraries.paths});
 return {status:'verified-transferred-bytes',descriptorSha256:KERNEL_TOOLCHAIN.sha256,files,bytes:total,executionAttestation:'not-provided',licenceBoundary:'external-jscoq-agpl-and-coq-component-licences'};
}
/** Install only on the configured Sandbox origin. An HTTP frame-ancestors
 * policy remains a deployment decision; the nonce protocol is not site login.
 * Injectable operations are for isolated protocol tests, never a kernel claim. */
export function mountKernelHost(environment=globalThis.window,{verifyRuntime=verifyExternalKernel,loadRuntime,createInspector=createKernelInspector}={}){
 let parentOrigin,session,inspectionRequested=false;
 try{const url=new URL(environment.location.href);parentOrigin=url.searchParams.get('mkg-parent');session=url.searchParams.get('mkg-session');const flag=url.searchParams.getAll('mkg-inspection');if(flag.length>1||flag.length===1&&flag[0]!=='1')throw new Error();inspectionRequested=flag.length===1;if(environment.parent===environment||kernelOrigin(parentOrigin)!==parentOrigin||!/^[a-f0-9]{64}$/.test(session)||!kernelOrigin(url.href))throw new Error();}catch{return {dispose(){}};}
 const status=text=>{const node=environment.document?.getElementById('kernel-host-status');if(node)node.textContent=text;};
 let active=null,loaded=null,disposed=false;const seenIds=new Set(),seenNonces=new Set();
 const send=(request,receipt)=>environment.parent.postMessage({protocol:KERNEL_PROTOCOL,version:1,type:'response',action:request.action,session,requestId:request.requestId,nonce:request.nonce,receipt},parentOrigin);
 async function receive(event){
  const request=event.data;if(disposed||event.source!==environment.parent||event.origin!==parentOrigin||!validKernelRequest(request)||request.session!==session)return;
  if(request.action==='cancel'){
   if(active&&request.requestId===active.request.requestId&&request.nonce===active.request.nonce){active.cancelled=true;active.controller.abort();status('The caller cancelled this check. No rejection was inferred.');}return;
  }
  const result=(state,reason=null,extra={})=>kernelReceipt(request.action,state,request.candidateHash,{reason,...extra});
  if(seenIds.has(request.requestId)||seenNonces.has(request.nonce))return;
  if(seenIds.size>=128){send(request,result('unavailable','host-session-request-limit'));return;}
  seenIds.add(request.requestId);seenNonces.add(request.nonce);
  if(!sameKernelToolchain(request.expectedToolchain)){send(request,result('wrong-pin','configured-toolchain-mismatch'));return;}
  if(active){send(request,result('busy','host-request-in-progress'));return;}
  const job={request,cancelled:false,controller:new AbortController()};active=job;let timer;
  const current=()=>!disposed&&!job.cancelled&&active===job;
  try{
   let candidate=null;
   if(request.action==='check'){
    const verified=await verifyCandidateIntegrity(request.candidate);
    if(!current())return;
    if(!verified.valid||verified.candidate.hashes.candidate!==request.candidateHash){send(request,result('invalid-candidate','candidate-integrity-failed'));return;}
    candidate=verified.candidate;if(!sameKernelToolchain(candidate.context?.toolchain)){send(request,result('wrong-pin','candidate-toolchain-mismatch'));return;}
   }
   const deadline=Date.now()+request.timeoutMs;
   timer=setTimeout(()=>{if(current()){job.cancelled=true;job.controller.abort();send(request,result('timeout','host-time-limit'));status('The check timed out; no rejection was inferred.');}},request.timeoutMs);
   status('Checking the pinned external runtime and generated certificate.');
   if(!loaded){const integrity=await verifyRuntime(environment,job.controller.signal);if(!current())return;
    if(loadRuntime){
     // Legacy injectable interface remains an explicit no-inspection path.
     const moduleUrl=new URL('/runtime/coq.js',environment.location.origin);moduleUrl.searchParams.set('mkg-pin',KERNEL_PINS[0].sha256);
     const runtime=await loadRuntime(moduleUrl.href);if(!current())return;
     if(runtime.KERNEL!==KERNEL_TOOLCHAIN.version||typeof runtime.certify!=='function'||typeof runtime.ensureKernel!=='function'||typeof runtime.resetKernel!=='function'||typeof runtime.kernelHealth!=='function')throw new Error('runtime-interface-mismatch');
     loaded={runtime,integrity,inspector:false};
    }else{
     const runtime=createInspector({environment,assets:verifiedAssets.get(environment)});
     if(!runtime||typeof runtime.health!=='function'||typeof runtime.check!=='function'||typeof runtime.dispose!=='function')throw new Error('runtime-interface-mismatch');
     loaded={runtime,integrity,inspector:true};
    }
   }
   const health=loaded.inspector?await loaded.runtime.health({signal:job.controller.signal,timeoutMs:Math.max(1,deadline-Date.now()),inspect:inspectionRequested}):await loaded.runtime.ensureKernel();if(!current())return;
   // CoqInfo is a full jsCoq/Flèche/OCaml banner, not a bare Coq version.
   const version=typeof health.accepted?.version==='string'&&health.accepted.version.length<=512?health.accepted.version.match(/(?:^|, )(Coq 8\.20\.1\/82000)(?:\n|$)/)?.[1]:null;
   if(health.state!=='ready'||health.accepted?.status!=='verified'||health.rejected?.status!=='rejected'||health.rejected?.kind!=='proof'||!version){send(request,result('unavailable','kernel-health-failed',{integrity:loaded.integrity}));status('The kernel health check was unavailable.');return;}
   const checkedHealth={status:'ready',positiveAccepted:true,negativeRejected:true,version};
   if(request.action==='health'){send(request,result('ready',null,{integrity:loaded.integrity,health:checkedHealth}));status('The pinned kernel accepted True and rejected its false health theorem.');return;}
   const verified=await verifyCandidateIntegrity(candidate);if(!current())return;if(!verified.valid){send(request,result('invalid-candidate','candidate-changed'));return;}
   const remaining=Math.min(90000,deadline-Date.now());if(remaining<1000){send(request,result('timeout','host-time-limit'));return;}
   const checked=loaded.inspector?await loaded.runtime.check(verified.candidate,{signal:job.controller.signal,timeoutMs:remaining,inspect:inspectionRequested}):await loaded.runtime.certify(verified.candidate.certificate.sentences,remaining);if(!current())return;
   const outcome=checked.status==='verified'?'accepted-closed-generated-certificate':checked.status==='rejected'&&checked.kind==='proof'?'rejected':'unavailable';
   let inspection=null;
   if(inspectionRequested&&loaded.inspector&&checked.status==='verified'&&checked.inspection)inspection=validateKernelInspection(checked.inspection,{candidateHash:request.candidateHash,certificateHash:verified.candidate.hashes.certificate,declaredPremises:verified.candidate.certificate.bindings.assumptions});
   send(request,result(outcome,outcome==='unavailable'?'kernel-check-unavailable':null,{integrity:loaded.integrity,health:checkedHealth,...(inspection?{assumptionsInspection:inspection.status,inspection}:{})}));
   status(outcome==='accepted-closed-generated-certificate'?'The kernel accepted the closed generated certificate. Prose fidelity and assumptions inspection remain separate.':'The kernel did not accept this certificate.');
  }catch{if(current()){try{if(loaded?.inspector)loaded.runtime.dispose();}catch{}loaded=null;verifiedAssets.delete(environment);send(request,result('unavailable','external-runtime-or-check-failed'));status('The pinned external runtime or check was unavailable.');}}
  finally{clearTimeout(timer);if(active===job)active=null;if(job.cancelled){try{if(loaded?.inspector)loaded.runtime.dispose();else loaded?.runtime.resetKernel();}catch{}loaded=null;verifiedAssets.delete(environment);}}
 }
 environment.addEventListener('message',receive);
 return {dispose(){disposed=true;if(active){active.cancelled=true;active.controller.abort();}try{if(loaded?.inspector)loaded.runtime.dispose();else loaded?.runtime.resetKernel();}catch{}loaded=null;verifiedAssets.delete(environment);environment.removeEventListener('message',receive);}};
}
if(typeof window!=='undefined')mountKernelHost(window);
