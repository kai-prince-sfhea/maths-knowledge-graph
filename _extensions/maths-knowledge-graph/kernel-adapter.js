/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
// Original bounded client protocol. External Sandbox code/assets are not bundled.
import {verifyProfileCandidate as verifyCandidateIntegrity} from './proof-profiles.js';
import {validateKernelInspection} from './kernel-inspector.js';

export const KERNEL_PROTOCOL='mkg-kernel-v1';
export const KERNEL_PINS=Object.freeze([
 {path:'/runtime/coq.js',bytes:6873,sha256:'a139ad204e89ba528c7043d9bbdc110451fa7ab53da93887cf6202312f90fe6e'},
 {path:'/runtime/telemetry.js',bytes:2101,sha256:'aff02bf5db1730d664a793c198d3c74b0c620bee36d5ae9015a947a8b9a5b045'},
 {path:'/data/rocq-files.json',bytes:13160,sha256:'9d5c33c3a21998d86d6b438d43adb1bfbcec1c4a3b619b26f0fb2fcabee06bfa'},
 {path:'/data/assets.json',bytes:39828,sha256:'2bbedfffd26cfee460050098432384ebc5fd91f5a2c7a5e0d83cc9af89d7ca7f'},
 {path:'/vendor/rocq820/backend/jsoo/jscoq_worker.bc.js',bytes:6246412,sha256:'86086143e732b7985fed06a729b73934879e396e0416ffbf7f6c8ffd20f8e216'},
].map(Object.freeze));
// Descriptor SHA256 binds the protocol and these five ordered source hashes.
// It is not a signature, a single binary hash or a deployment attestation.
export const KERNEL_TOOLCHAIN=Object.freeze({id:'sandbox-coq-8.20.1-jscoq-1.99.2',version:'Coq 8.20.1 / jsCoq 1.99.2',sha256:'31d11b90a8d9b17a518093745782783096b1fffb96e07b2a595f4cbd314aa1fe'});
export const KERNEL_LIMITS=Object.freeze({message:2*1024*1024,manifest:1024*1024,files:1024,totalBytes:40*1024*1024,minimumTimeout:15000,maximumTimeout:120000});
const statuses=new Set(['ready','accepted-closed-generated-certificate','rejected','wrong-pin','invalid-candidate','unavailable','busy','cancelled','timeout','stale','failed']);
const map=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const bounded=value=>{try{return JSON.stringify(value).length<=KERNEL_LIMITS.message;}catch{return false;}};
const exactKeys=(value,keys)=>map(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
export function sameKernelToolchain(value){return exactKeys(value,['id','version','sha256'])&&Object.keys(KERNEL_TOOLCHAIN).every(key=>value[key]===KERNEL_TOOLCHAIN[key]);}
export function kernelOrigin(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);return !url.username&&!url.password&&(url.protocol==='https:'||url.protocol==='http:'&&local)?url.origin:null;}catch{return null;}
}
export function normalizeKernelHost(value){
 if(typeof value!=='string'||!kernelOrigin(value)||/[?#\\\u0000-\u0020\u007f]/.test(value)||/%(?:2f|5c)/i.test(value))throw new Error('kernel-host requires an explicit HTTPS HTML URL or localhost HTTP URL');
 const url=new URL(value);let path;try{path=decodeURIComponent(url.pathname);}catch{throw new Error('invalid kernel-host URL');}
 if(!/\.html?$/i.test(path)||path.split('/').some(part=>part==='.'||part==='..')||/[\\\u0000-\u001f\u007f]/.test(path))throw new Error('invalid kernel-host HTML path');
 return url.href;
}
export function kernelReceipt(action,status,candidateHash=null,extra={}){
 return {schemaVersion:1,kind:'mkg-kernel-result',action,status,toolchain:{...KERNEL_TOOLCHAIN},candidateHash,
  assumptionsInspection:'not-performed',sourceMappingReview:'not-established',reason:null,integrity:null,health:null,...extra};
}
export function validKernelRequest(value){
 return bounded(value)&&exactKeys(value,['protocol','version','type','action','session','requestId','nonce','expectedToolchain','candidateHash','candidate','timeoutMs'])&&value.protocol===KERNEL_PROTOCOL&&value.version===1&&value.type==='request'&&['health','check','cancel'].includes(value.action)&&hex(value.session)&&typeof value.requestId==='string'&&/^[a-z0-9-]{16,64}$/.test(value.requestId)&&hex(value.nonce)&&
  exactKeys(value.expectedToolchain,['id','version','sha256'])&&typeof value.expectedToolchain.id==='string'&&value.expectedToolchain.id.length<=128&&typeof value.expectedToolchain.version==='string'&&value.expectedToolchain.version.length<=128&&hex(value.expectedToolchain.sha256)&&
  Number.isInteger(value.timeoutMs)&&value.timeoutMs>=KERNEL_LIMITS.minimumTimeout&&value.timeoutMs<=KERNEL_LIMITS.maximumTimeout&&
  (value.action==='check'?map(value.candidate)&&hex(value.candidateHash):value.candidate===null&&value.candidateHash===null);
}
function validResponse(value,request){
 if(!bounded(value)||!exactKeys(value,['protocol','version','type','action','session','requestId','nonce','receipt'])||value.protocol!==KERNEL_PROTOCOL||value.version!==1||value.type!=='response'||['action','session','requestId','nonce'].some(key=>value[key]!==request[key]))return false;
 const receipt=value.receipt;
 if(!map(receipt))return false;
 const integrity=receipt.integrity,health=receipt.health;
 const validIntegrity=exactKeys(integrity,['status','descriptorSha256','files','bytes','executionAttestation','licenceBoundary'])&&integrity.status==='verified-transferred-bytes'&&integrity.descriptorSha256===KERNEL_TOOLCHAIN.sha256&&Number.isSafeInteger(integrity.files)&&integrity.files>=KERNEL_PINS.length&&integrity.files<=KERNEL_LIMITS.files+KERNEL_PINS.length&&Number.isSafeInteger(integrity.bytes)&&integrity.bytes>0&&integrity.bytes<=KERNEL_LIMITS.totalBytes&&integrity.executionAttestation==='not-provided'&&integrity.licenceBoundary==='external-jscoq-agpl-and-coq-component-licences';
 const validHealth=exactKeys(health,['status','positiveAccepted','negativeRejected','version'])&&health.status==='ready'&&health.positiveAccepted===true&&health.negativeRejected===true&&health.version==='Coq 8.20.1/82000';
 const inspected=Object.hasOwn(receipt,'inspection');let validInspection=false;
 if(inspected){try{const admitted=validateKernelInspection(receipt.inspection,{candidateHash:request.candidateHash,certificateHash:request.candidate?.hashes?.certificate,declaredPremises:request.candidate?.certificate?.bindings?.assumptions});validInspection=request.action==='check'&&receipt.status==='accepted-closed-generated-certificate'&&receipt.assumptionsInspection===admitted.status;}catch{return false;}}
 return exactKeys(receipt,['schemaVersion','kind','action','status','toolchain','candidateHash','assumptionsInspection','sourceMappingReview','reason','integrity','health',...(inspected?['inspection']:[])])&&receipt.schemaVersion===1&&receipt.kind==='mkg-kernel-result'&&receipt.action===request.action&&statuses.has(receipt.status)&&sameKernelToolchain(receipt.toolchain)&&receipt.candidateHash===request.candidateHash&&(inspected?validInspection:receipt.assumptionsInspection==='not-performed')&&receipt.sourceMappingReview==='not-established'&&(receipt.reason===null||typeof receipt.reason==='string'&&/^[a-z0-9-]{1,80}$/.test(receipt.reason))&&
  (integrity===null||validIntegrity)&&(health===null||validHealth)&&(!['ready','accepted-closed-generated-certificate','rejected'].includes(receipt.status)||validIntegrity&&validHealth)&&
  (receipt.status!=='accepted-closed-generated-certificate'||request.action==='check'&&hex(request.candidateHash));
}
/** Loading/checking sends the bounded source-bound candidate to the explicitly
 * configured host origin. The caller owns the reader's explicit check action.
 * Aborting/disposal removes the owned iframe and its worker browsing context;
 * it is cancellation, never a mathematical rejection. No storage is used. */
export function createKernelClient({hostUrl,timeoutMs=90000,expectedToolchain=KERNEL_TOOLCHAIN}={},environment=globalThis.window){
 const host=normalizeKernelHost(hostUrl),origin=new URL(host).origin;
 if(!environment?.document?.createElement||!environment.crypto?.getRandomValues||!kernelOrigin(environment.location?.href)||!Number.isInteger(timeoutMs)||timeoutMs<KERNEL_LIMITS.minimumTimeout||timeoutMs>KERNEL_LIMITS.maximumTimeout||!map(expectedToolchain))throw new Error('invalid kernel client configuration');
 const expected={...expectedToolchain};if(!exactKeys(expected,['id','version','sha256'])||!hex(expected.sha256))throw new Error('invalid kernel toolchain descriptor');
 const random=()=>[...environment.crypto.getRandomValues(new Uint8Array(32))].map(value=>value.toString(16).padStart(2,'0')).join('');
 let disposed=false,frame=null,session=null,active=null;
 function removeFrame(){frame?.remove();frame=null;session=null;}
 async function perform(action,candidate,{signal,isCurrent=()=>true}={}){
  const candidateHash=action==='check'&&hex(candidate?.hashes?.candidate)?candidate.hashes.candidate:null;
  const result=(status,reason)=>kernelReceipt(action,status,candidateHash,{reason});
  if(disposed)return result('unavailable','client-disposed');if(active)return result('busy','client-request-in-progress');if(signal?.aborted)return result('cancelled','caller-cancelled');
  if(typeof isCurrent!=='function'||!isCurrent())return result('stale','candidate-no-longer-current');
  let admitted=null;
  if(action==='check'){
   const verified=await verifyCandidateIntegrity(candidate);if(!verified.valid)return result('invalid-candidate','candidate-integrity-failed');
   admitted=verified.candidate;if(!sameKernelToolchain(admitted.context?.toolchain))return result('wrong-pin','candidate-toolchain-mismatch');
  }
  if(disposed||signal?.aborted)return result('cancelled','caller-cancelled');if(active)return result('busy','client-request-in-progress');if(!isCurrent())return result('stale','candidate-no-longer-current');
  const request={protocol:KERNEL_PROTOCOL,version:1,type:'request',action,session:session??random(),requestId:random().slice(0,32),nonce:random(),expectedToolchain:expected,candidateHash,candidate:admitted,timeoutMs};
  if(!validKernelRequest(request))return result('invalid-candidate','request-limit');
  return new Promise(resolve=>{
   const owner={request,resolve,done:false};active=owner;
   const finish=(receipt,{discard=false}={})=>{if(owner.done)return;owner.done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);environment.removeEventListener('message',message);if(active===owner)active=null;if(discard)removeFrame();resolve(receipt);};
   const cancel=(status,reason)=>{try{frame?.contentWindow?.postMessage({...request,action:'cancel',candidate:null,candidateHash:null},origin);}catch{}finish(result(status,reason),{discard:true});};
   const abort=()=>cancel('cancelled','caller-cancelled');
   const message=async event=>{
    if(event.origin!==origin||event.source!==frame?.contentWindow||!validResponse(event.data,request))return;
    if(!isCurrent())return finish(result('stale','candidate-no-longer-current'),{discard:true});
    if(action==='check'){
     const fresh=await verifyCandidateIntegrity(candidate);
     if(owner.done)return;
     if(!isCurrent())return finish(result('stale','candidate-no-longer-current'),{discard:true});
     if(!fresh.valid||fresh.candidate.hashes.candidate!==request.candidateHash)return finish(result('stale','candidate-changed'),{discard:true});
    }
    finish(event.data.receipt);
   };
   const timer=setTimeout(()=>cancel('timeout','host-time-limit'),timeoutMs);environment.addEventListener('message',message);signal?.addEventListener('abort',abort,{once:true});
   const send=()=>{if(!owner.done){try{frame.contentWindow.postMessage(request,origin);}catch{finish(result('unavailable','host-message-failed'),{discard:true});}}};
   if(!frame){
    session=request.session;frame=environment.document.createElement('iframe');frame.hidden=true;frame.title='Optional proof kernel host';frame.referrerPolicy='no-referrer';
    frame.addEventListener('load',send,{once:true});frame.addEventListener('error',()=>finish(result('unavailable','host-load-failed'),{discard:true}),{once:true});
    const url=new URL(host);url.searchParams.set('mkg-parent',environment.location.origin);url.searchParams.set('mkg-session',session);url.searchParams.set('mkg-inspection','1');frame.src=url.href;environment.document.body.appendChild(frame);
   }else send();
   owner.cancel=()=>cancel('cancelled','client-disposed');
  });
 }
 return Object.freeze({health:options=>perform('health',null,options),check:(candidate,options)=>perform('check',candidate,options),dispose(){disposed=true;active?.cancel?.();removeFrame();}});
}
