/* Copyright 2026 Kai Prince; SPDX-License-Identifier: Apache-2.0 */
// Original finite jsCoq protocol consumer. No external runtime source is bundled.
// Protocol reference: jscoq/jscoq v8.20 backend/coq-worker.ts and common/jscoq_proto.ml.
import {verifyProfileCandidate as verifyCandidateIntegrity} from './proof-profiles.js';

export const INSPECTION_LIMITS=Object.freeze({messages:4096,goalMessages:8,transcriptBytes:262144,ppNodes:16384,ppDepth:48,text:65536,document:262400,files:1024,libraryBytes:40*1024*1024});
export const INSPECTION_QUALIFICATION='Observed output from fixed inspection commands over a regenerated finite certificate; quantified premises remain theorem parameters. This does not establish source fidelity, execution attestation or general mathematical correctness.';
const WORKER='/vendor/rocq820/backend/jsoo/jscoq_worker.bc.js';
const VERSION='Coq 8.20.1/82000';
const hashPattern=/^[a-f0-9]{64}$/;
const uriPattern=/^file:\/\/\/mkg_inspection_[a-f0-9]{32}\.v$/;
const commands=Object.freeze(['Print Assumptions mkg_certificate.','Print Typing Flags.']);
const commandsSha256='00aab2b4cb64c2d6165f494cd70bad29d494cbc65f183778253a72b9d103b219';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
function data(value,depth=0,budget={nodes:0,bytes:0},seen=new Set()){
 if(depth>64||++budget.nodes>32768)fail('inspection-data-limit');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isSafeInteger(value))fail('inspection-data-invalid');return value;}
 if(typeof value==='string'){
  if(value.length>INSPECTION_LIMITS.transcriptBytes)fail('inspection-data-limit');
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value))fail('inspection-data-invalid');
  for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))fail('inspection-data-invalid');}else if(c>=0xdc00&&c<=0xdfff)fail('inspection-data-invalid');}
  budget.bytes+=new TextEncoder().encode(value).length;if(budget.bytes>INSPECTION_LIMITS.transcriptBytes)fail('inspection-data-limit');return value;
 }
 if(typeof value!=='object'||seen.has(value))fail('inspection-data-invalid');seen.add(value);
 let out;if(Array.isArray(value)){const ds=Object.getOwnPropertyDescriptors(value);if(Reflect.ownKeys(ds).length!==value.length+1||value.length>INSPECTION_LIMITS.messages)fail('inspection-data-invalid');out=[];for(let i=0;i<value.length;i++){if(!Object.hasOwn(ds[i]??{},'value'))fail('inspection-data-invalid');out.push(data(ds[i].value,depth+1,budget,seen));}}
 else{if(!plain(value))fail('inspection-data-invalid');out={};for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!Object.hasOwn(d,'value')||['__proto__','constructor','prototype'].includes(key))fail('inspection-data-invalid');out[key]=data(d.value,depth+1,budget,seen);}}
 seen.delete(value);return out;
}
function freeze(value){if(value&&typeof value==='object'){for(const part of Object.values(value))freeze(part);Object.freeze(value);}return value;}
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const bytes=value=>new TextEncoder().encode(value);
const sha=async(value,cryptoObject)=>[...new Uint8Array(await cryptoObject.subtle.digest('SHA-256',bytes(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
function aborted(signal){if(signal?.aborted)fail('cancelled');}
// jsCoq's Ready-of-unit notification uses an own undefined unit slot in the
// observed jsoo worker. Normalize ONLY that documented unit to JSON null. The
// transcript hash identifies this JSON projection, never original wire bytes.
function normalizeWorkerMessage(value){
 if(!Array.isArray(value))return value;
 const ds=Object.getOwnPropertyDescriptors(value),tag=ds[0];
 if(!tag||!Object.hasOwn(tag,'value'))return value;
 if(tag.value==='Response'){
  // The observed Fleche informational message has an optional own
  // range:undefined slot. Omit ONLY this exact documented absent field.
  const shallow=value=>{if(!plain(value))return null;const props=Object.getOwnPropertyDescriptors(value),out={};for(const key of Reflect.ownKeys(props)){if(typeof key!=='string'||!Object.hasOwn(props[key],'value')||['__proto__','constructor','prototype'].includes(key))return null;out[key]=props[key].value;}return out;};
  if(ds.length.value!==2||Reflect.ownKeys(ds).length!==3||!Object.hasOwn(ds[1]??{},'value'))return value;
  const response=shallow(ds[1].value);if(!response||!Array.isArray(response.res))return value;
  const res=Object.getOwnPropertyDescriptors(response.res);if(res.length.value!==2||Reflect.ownKeys(res).length!==3||res[0]?.value!=='Goals'||!Object.hasOwn(res[1]??{},'value'))return value;
  const body=shallow(res[1].value);if(!body||!Array.isArray(body.messages))return value;
  const list=Object.getOwnPropertyDescriptors(body.messages),length=list.length.value;if(length<1||length>INSPECTION_LIMITS.goalMessages||Reflect.ownKeys(list).length!==length+1)return value;
  const messages=[];let changed=false;
  for(let i=0;i<length;i++){
   if(!Object.hasOwn(list[i]??{},'value'))return value;
   const message=shallow(list[i].value);if(!message)return value;
   if(exact(message,['level','text','range'])&&message.range===undefined){delete message.range;changed=true;}
   messages.push(message);
  }
  return changed?['Response',{...response,res:['Goals',{...body,messages}]}]:value;
 }
 if(tag.value!=='Ready')return value;
 const length=ds.length.value;
 if(![1,2].includes(length)||Reflect.ownKeys(ds).length!==length+1)fail('inspection-ready-invalid');
 if(length===2&&(!ds[1]||!Object.hasOwn(ds[1],'value')||![null,undefined].includes(ds[1].value)))fail('inspection-ready-invalid');
 return length===2?['Ready',null]:['Ready'];
}

/** A complete bounded decoder for the documented finite Pp wire constructors.
 * Unknown nodes refuse; they must never silently disappear from an audit. */
export function flattenKernelPp(input){
 const value=data(input),budget={nodes:0,length:0};
 function walk(node,depth){
  if(!Array.isArray(node)||depth>INSPECTION_LIMITS.ppDepth||++budget.nodes>INSPECTION_LIMITS.ppNodes)fail('inspection-pp-invalid');
  let text='';const tag=node[0];
  if(tag==='Pp_empty'&&node.length===1)text='';
  else if(tag==='Pp_string'&&node.length===2&&typeof node[1]==='string')text=node[1];
  else if(tag==='Pp_glue'&&node.length===2&&Array.isArray(node[1]))text=node[1].map(v=>walk(v,depth+1)).join('');
  else if(tag==='Pp_box'&&node.length===3&&Array.isArray(node[1])&&((node[1][0]==='Pp_hbox'&&node[1].length===1)||(['Pp_vbox','Pp_hvbox','Pp_hovbox'].includes(node[1][0])&&node[1].length===2&&Number.isInteger(node[1][1])&&Math.abs(node[1][1])<=4096)))text=walk(node[2],depth+1);
  else if(tag==='Pp_tag'&&node.length===3&&typeof node[1]==='string'&&node[1].length<=256)text=walk(node[2],depth+1);
  else if(tag==='Pp_print_break'&&node.length===3&&Number.isInteger(node[1])&&node[1]>=0&&node[1]<=4096&&Number.isInteger(node[2])&&Math.abs(node[2])<=4096)text=' '.repeat(node[1]);
  else if(tag==='Pp_force_newline'&&node.length===1)text='\n';
  else if(tag==='Pp_comment'&&node.length===2&&Array.isArray(node[1])&&node[1].every(v=>typeof v==='string'))text=node[1].join('\n');
  else fail('inspection-pp-invalid');
  // Bound each intermediate construction as well as the final flattened text.
  if(text.length>INSPECTION_LIMITS.text||(budget.length+=tag==='Pp_string'?text.length:0)>INSPECTION_LIMITS.text)fail('inspection-pp-limit');return text;
 }
 return walk(value,0);
}

export function classifyAssumptions(value){
 if(typeof value!=='string'||value.length>INSPECTION_LIMITS.text)return {status:'unknown',text:'',categories:[]};
 const text=value.trim();if(text==='Closed under the global context')return {status:'closed',text,categories:[]};
 const allowed=['Axioms','Section Variables','Theory','Opaque constants','Transparent constants'],lines=text.split('\n'),categories=[];let section=false,content=false;
 for(const line of lines){const header=/^([^:]+):\s*$/.exec(line.trim());if(header){if(!allowed.includes(header[1])||section&&!content||categories.includes(header[1]))return {status:'unknown',text,categories:[]};categories.push(header[1]);section=true;content=false;}
  else if(line.trim()){if(!section||line.includes('Closed under the global context'))return {status:'unknown',text,categories:[]};content=true;}}
 return section&&content?{status:'reported',text,categories}:{status:'unknown',text,categories:[]};
}
export function classifyTypingFlags(value){
 const text=typeof value==='string'&&value.length<=INSPECTION_LIMITS.text?value.trim():'';
 const match=/^check_guarded:\s*(true|false)\s*\ncheck_positive:\s*(true|false)\s*\ncheck_universes:\s*(true|false)\s*\ndefinitional uip:\s*(true|false)$/.exec(text);
 if(!match)return {status:'unknown',text,values:null,ordinary:null};
 const values={checkGuarded:match[1]==='true',checkPositive:match[2]==='true',checkUniverses:match[3]==='true',definitionalUIP:match[4]==='true'};
 return {status:'checked',text,values,ordinary:values.checkGuarded&&values.checkPositive&&values.checkUniverses&&!values.definitionalUIP};
}
function inspectionQueries(text){
 if(typeof text!=='string')return [];
 const matched=/\n(Print Assumptions (mkg_certificate|mkg_health_closed|mkg_health_reported)\.)\n(Print Typing Flags\.)\n$/.exec(text);if(!matched)return [];
 const start=matched.index+1,flagStart=start+matched[1].length+1;
 return [{kind:'assumptions',id:2,start,end:start+matched[1].length,offset:start+matched[1].length-1},
  {kind:'typingFlags',id:3,start:flagStart,end:flagStart+matched[3].length,offset:flagStart+matched[3].length-1}];
}
function pointAt(text,offset){const prefix=text.slice(0,offset),last=prefix.lastIndexOf('\n');return {line:(prefix.match(/\n/g)??[]).length,character:offset-last-1,offset};}
function samePoint(value,expected){return exact(value,['line','character','offset'])&&Object.keys(expected).every(k=>value[k]===expected[k]);}
/** Only a correlated response at the fixed Print command's period is admitted.
 * Actual jsCoq 8.20 returns these messages through Fleche Goals, not Log. */
export function decodeInspectionGoals(input,{uri,text,requestId}={}){
 const m=data(input),q=inspectionQueries(text).find(q=>q.id===requestId);
 if(!q||!uriPattern.test(uri)||!Array.isArray(m)||m.length!==2||m[0]!=='Response'||!exact(m[1],['id','res'])||m[1].id!==requestId||!Array.isArray(m[1].res)||m[1].res.length!==2||m[1].res[0]!=='Goals')fail('inspection-goals-invalid');
 const b=m[1].res[1];if(!exact(b,['textDocument','position','range','program','messages'])||!exact(b.textDocument,['uri','version'])||b.textDocument.uri!==uri||b.textDocument.version!==1||!samePoint(b.position,{line:-1,character:-1,offset:q.offset})||!exact(b.range,['start','end'])||!samePoint(b.range.start,pointAt(text,q.start))||!samePoint(b.range.end,pointAt(text,q.end))||!Array.isArray(b.program)||b.program.length||!Array.isArray(b.messages)||b.messages.length<1||b.messages.length>INSPECTION_LIMITS.goalMessages)fail('inspection-goals-invalid');
 let semantic;const information=[];
 for(const message of b.messages){
  if(!exact(message,['level','text'])||![3,4].includes(message.level))fail('inspection-goals-invalid');
  const text=flattenKernelPp(message.text);
  if(message.level===3){if(semantic!==undefined)fail('inspection-goals-invalid');semantic=text;}
  else information.push({level:4,text});
 }
 if(semantic===undefined)fail('inspection-goals-invalid');
 return freeze({kind:q.kind,id:q.id,offset:q.offset,text:semantic,information});
}
function observations(result){
 const expected=inspectionQueries(result.text),answers=new Map();let malformed=expected.length!==2;
 for(const message of result.transcript??[]){
  if(message?.[0]==='Log'&&message[1]?.[0]==='Notice'){try{const text=flattenKernelPp(message[2]);if(classifyAssumptions(text).status!=='unknown'||classifyTypingFlags(text).status!=='unknown')malformed=true;}catch{malformed=true;}}
  if(message?.[0]!=='Response'||message[1]?.id===1)continue;try{const answer=decodeInspectionGoals(message,{uri:result.uri,text:result.text,requestId:message[1]?.id});if(answers.has(answer.id))malformed=true;else answers.set(answer.id,answer);}catch{malformed=true;}
 }
 return {global:!malformed&&answers.has(2)?classifyAssumptions(answers.get(2).text):{status:'unknown',text:'',categories:[]},
  flags:!malformed&&answers.has(3)?classifyTypingFlags(answers.get(3).text):{status:'unknown',text:'',values:null,ordinary:null},malformed,
  information:expected.flatMap(q=>(answers.get(q.id)?.information??[]).map(item=>({command:q.kind,...item}))),
  queries:expected.map(q=>({id:q.id,offset:q.offset,answered:!malformed&&answers.has(q.id)}))};
}
const validPremises=value=>Array.isArray(value)&&value.length<=32&&value.every((v,i)=>exact(v,['source','generated'])&&typeof v.source==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v.source)&&v.generated==='h'+i)&&new Set(value.map(v=>v.source)).size===value.length;

/** Receipt validation is transport admission, not independent execution proof. */
export function validateKernelInspection(input,{candidateHash,certificateHash,declaredPremises}={}){
 const v=data(input),keys=['version','kind','status','candidateHash','certificateHash','theorem','outputChannel','globalAssumptions','typingFlags','declaredPremises','commands','commandsSha256','documentSha256','transcriptSha256','correlation','health','reason','qualification'];
 if(!exact(v,Object.hasOwn(v,'information')?[...keys,'information']:keys)||v.version!==1||v.kind!=='mkg-assumptions-inspection'||!['closed','reported','unknown'].includes(v.status)||!hashPattern.test(v.candidateHash)||!hashPattern.test(v.certificateHash)||v.theorem!=='mkg_certificate'||v.outputChannel!=='fleche-goals-v1'||v.qualification!==INSPECTION_QUALIFICATION||!validPremises(v.declaredPremises))fail('inspection-receipt-invalid');
 if(Object.hasOwn(v,'information')){
  if(!Array.isArray(v.information)||!v.information.length||v.information.length>2*(INSPECTION_LIMITS.goalMessages-1))fail('inspection-receipt-invalid');
  const counts={assumptions:0,typingFlags:0};let flagsSeen=false;
  for(const item of v.information){if(!exact(item,['command','level','text'])||!Object.hasOwn(counts,item.command)||item.level!==4||typeof item.text!=='string'||item.text.length>INSPECTION_LIMITS.text||++counts[item.command]>=INSPECTION_LIMITS.goalMessages||item.command==='assumptions'&&flagsSeen)fail('inspection-receipt-invalid');if(item.command==='typingFlags')flagsSeen=true;}
 }
 if(candidateHash!==undefined&&v.candidateHash!==candidateHash||certificateHash!==undefined&&v.certificateHash!==certificateHash||declaredPremises!==undefined&&JSON.stringify(v.declaredPremises)!==JSON.stringify(declaredPremises))fail('inspection-binding-mismatch');
 if(!Array.isArray(v.commands)||JSON.stringify(v.commands)!==JSON.stringify(commands)||v.commandsSha256!==commandsSha256||!['documentSha256','transcriptSha256'].every(k=>hashPattern.test(v[k])))fail('inspection-receipt-invalid');
 if(!exact(v.globalAssumptions,['status','text','categories'])||v.globalAssumptions.status!==v.status||typeof v.globalAssumptions.text!=='string'||v.globalAssumptions.text.length>INSPECTION_LIMITS.text||!Array.isArray(v.globalAssumptions.categories))fail('inspection-receipt-invalid');
 const reclassified=classifyAssumptions(v.globalAssumptions.text);if(v.status!=='unknown'&&(reclassified.status!==v.status||JSON.stringify(reclassified.categories)!==JSON.stringify(v.globalAssumptions.categories)))fail('inspection-receipt-invalid');
 if(v.status==='unknown'&&v.globalAssumptions.categories.length)fail('inspection-receipt-invalid');
 if(!exact(v.typingFlags,['status','text','values','ordinary'])||JSON.stringify(classifyTypingFlags(v.typingFlags.text))!==JSON.stringify(v.typingFlags))fail('inspection-receipt-invalid');
 if(!exact(v.correlation,['uri','requestId','saveVo','response','assumptionsRequest','typingFlagsRequest'])||!uriPattern.test(v.correlation.uri)||v.correlation.requestId!==1||typeof v.correlation.saveVo!=='boolean'||typeof v.correlation.response!=='boolean')fail('inspection-receipt-invalid');
 for(const [key,id]of [['assumptionsRequest',2],['typingFlagsRequest',3]]){const q=v.correlation[key];if(!exact(q,['id','offset','answered'])||q.id!==id||!Number.isSafeInteger(q.offset)||q.offset<0||q.offset>INSPECTION_LIMITS.document||typeof q.answered!=='boolean')fail('inspection-receipt-invalid');}
 if(v.correlation.typingFlagsRequest.offset!==v.correlation.assumptionsRequest.offset+commands[1].length+1)fail('inspection-receipt-invalid');
 if(!exact(v.health,['closedContextObserved','axiomReported','falseRejected','typingFlagsObserved'])||Object.values(v.health).some(x=>typeof x!=='boolean'))fail('inspection-receipt-invalid');
 const healthy=Object.values(v.health).every(Boolean),ack=v.correlation.saveVo&&v.correlation.response&&v.correlation.assumptionsRequest.answered&&v.correlation.typingFlagsRequest.answered;
 if(v.status==='closed'&&(!healthy||!ack||v.typingFlags.status!=='checked'||v.typingFlags.ordinary!==true)||v.status==='reported'&&!ack)fail('inspection-receipt-invalid');
 if(!(v.reason===null||typeof v.reason==='string'&&/^[a-z0-9-]{1,80}$/.test(v.reason))||v.status!=='unknown'&&v.reason!==null||v.status==='unknown'&&v.reason===null)fail('inspection-receipt-invalid');
 return freeze(v);
}

export async function summarizeInspection(candidate,result,health,{cryptoObject=globalThis.crypto}={}){
 const verified=await verifyCandidateIntegrity(candidate);if(!verified.valid)fail('inspection-candidate-invalid');candidate=verified.candidate;
 health=data(health);if(!exact(health,['closedContextObserved','axiomReported','falseRejected','typingFlagsObserved'])||Object.values(health).some(v=>typeof v!=='boolean'))fail('inspection-health-invalid');
 if(!result||result.text!==candidate.certificate.sourceText+commands.join('\n')+'\n'||!uriPattern.test(result.uri))fail('inspection-document-binding-mismatch');
 const transcript=data(result.transcript);if(!Array.isArray(transcript))fail('inspection-transcript-invalid');
 const logs=[];let saved=0,responded=0,malformed=false,version=false;
 for(const m of transcript){
  if(!Array.isArray(m)||typeof m[0]!=='string'){malformed=true;continue;}
  if(m[0]==='CoqInfo'){if(typeof m[1]==='string'&&/(?:^|, )Coq 8\.20\.1\/82000(?:\n|$)/.test(m[1]))version=true;else malformed=true;}
  if(m[0]==='Log'){
   if(m.length!==3||!Array.isArray(m[1])||m[1].length!==1){malformed=true;continue;}
   try{const text=flattenKernelPp(m[2]);logs.push({level:m[1][0],pp:m[2]});if(text.startsWith('Saved .vo file for ')){if(text==='Saved .vo file for '+result.uri&&m[1][0]==='Notice')saved++;else malformed=true;}if(m[1][0]==='Error')malformed=true;}catch{malformed=true;}
  }
  if(m[0]==='Response'){if(m.length===2&&exact(m[1],['id','res'])&&m[1].id===1&&JSON.stringify(m[1].res)==='["Void"]')responded++;else if(![2,3].includes(m[1]?.id)||saved!==1||responded!==1)malformed=true;}
  if(m[0]==='JsonExn')malformed=true;
  if(m[0]==='Notification'&&(!plain(m[1])||m[1].uri!==result.uri||!Array.isArray(m[1].diagnostic)||m[1].diagnostic.some(d=>!plain(d)||d.severity===1)))malformed=true;
 }
 const seen=observations({...result,transcript}),ack=result.status==='verified'&&result.saved===true&&result.responded===true&&saved===1&&responded===1&&version&&!malformed&&!seen.malformed&&seen.queries.every(q=>q.answered);
 let status=seen.global.status,reason=null;
 if(!ack){status='unknown';reason='inspection-not-acknowledged';}
 else if(status==='unknown')reason='assumptions-format-unknown';
 else if(status==='closed'&&!Object.values(health).every(Boolean)){status='unknown';reason='inspection-health-unavailable';}
 else if(status==='closed'&&seen.flags.status!=='checked'){status='unknown';reason='typing-flags-unknown';}
 else if(status==='closed'&&!seen.flags.ordinary){status='unknown';reason='typing-flags-nonstandard';}
 const packet={version:1,kind:'mkg-assumptions-inspection',status,candidateHash:candidate.hashes.candidate,certificateHash:candidate.hashes.certificate,theorem:'mkg_certificate',outputChannel:'fleche-goals-v1',
  globalAssumptions:{...seen.global,status,categories:status==='unknown'?[]:seen.global.categories},typingFlags:seen.flags,declaredPremises:candidate.certificate.bindings.assumptions.map(x=>({...x})),
  commands:[...commands],commandsSha256:await sha(commands.join('\n')+'\n',cryptoObject),documentSha256:await sha(result.text,cryptoObject),transcriptSha256:await sha(JSON.stringify(transcript),cryptoObject),
  correlation:{uri:result.uri,requestId:1,saveVo:saved===1&&!malformed,response:responded===1&&!malformed,assumptionsRequest:seen.queries[0],typingFlagsRequest:seen.queries[1]},health:{...health},reason,qualification:INSPECTION_QUALIFICATION};
 if(seen.information.length)packet.information=seen.information;
 return validateKernelInspection(packet,{candidateHash:candidate.hashes.candidate,certificateHash:candidate.hashes.certificate,declaredPremises:candidate.certificate.bindings.assumptions});
}

/** assets are confined, exact transferred library bytes already checked by the
 * host against the pinned manifest. Worker URL identity is not attestation. */
export function createKernelInspector({environment=globalThis,assets,workerFactory}={}){
 const origin=environment.location?.origin,cryptoObject=environment.crypto??globalThis.crypto;
 if(typeof origin!=='string'||!cryptoObject?.getRandomValues||!cryptoObject?.subtle||!assets||!Array.isArray(assets.libraries)||!Array.isArray(assets.paths)||!assets.libraries.length||assets.libraries.length>INSPECTION_LIMITS.files)fail('inspection-assets-invalid');
 let total=0;const seenPaths=new Set();
 for(const item of assets.libraries){if(!exact(item,['path','bytes'])||typeof item.path!=='string'||!item.path.startsWith('/vendor/rocq820/coq-pkgs/unpacked/')||/[\\?#%\u0000-\u0020\u007f]/.test(item.path)||item.path.split('/').some(p=>p==='.'||p==='..')||!(item.bytes instanceof Uint8Array)||!item.bytes.length||seenPaths.has(item.path))fail('inspection-assets-invalid');seenPaths.add(item.path);total+=item.bytes.length;if(total>INSPECTION_LIMITS.libraryBytes)fail('inspection-assets-limit');}
 const paths=data(assets.paths);if(paths.length>128||paths.some(v=>!Array.isArray(v)||v.length!==2||!Array.isArray(v[0])||!v[0].length||v[0].some(s=>typeof s!=='string'||! /^[A-Za-z][A-Za-z0-9_]*$/.test(s))||JSON.stringify(v[1])!=='["/lib"]'))fail('inspection-assets-invalid');
 const makeWorker=workerFactory??(url=>new environment.Worker(url));let active=false,disposed=false,healthCache=new Map(),activeCancel=null;
 // Coq derives the compilation-unit identifier from the filename. Keep every
 // basename character within the finite identifier subset, including nonce.
 const freshURI=()=>`file:///mkg_inspection_${[...cryptoObject.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('')}.v`;
 async function runDocument(text,{signal,deadline}){
  aborted(signal);if(typeof text!=='string'||text.length>INSPECTION_LIMITS.document||disposed)fail('inspection-document-invalid');
  const remaining=deadline-Date.now();if(remaining<1)fail('inspection-timeout');
  const uri=freshURI(),worker=makeWorker(new URL(WORKER,origin).href),transcript=[],logs=[],queries=inspectionQueries(text),answers=new Set();let transcriptBytes=0,version='',saved=false,responded=false,ready=false,finished=false,timer,resolve,diagnosticText=null,queriesSent=false;
  const pending=new Promise(a=>{resolve=a;});
  const finish=(status,code=null)=>{if(finished)return;if(status==='verified'&&!/(?:^|, )Coq 8\.20\.1\/82000(?:\n|$)/.test(version)){status='error';code='inspection-version-invalid';}finished=true;resolve({status,kind:status==='rejected'?'proof':'runtime',code,version,uri,text,saved,responded,logs,transcript,diagnosticText});};
  const error=()=>finish('error','inspection-worker-failed'),cancel=()=>finish('error','cancelled');
  const post=message=>{if(!finished)worker.postMessage(message);};
  const sendDocument=()=>{post(['OpenDoc',{uri,languageId:'rocq',version:1,text}]);post(['Request',{id:1,method:{uri,loc:text.length,v:['SaveVo']}}]);};
  const receive=event=>{if(finished)return;let m;try{m=data(normalizeWorkerMessage(event.data));const size=bytes(JSON.stringify(m)).length;if(transcript.length>=INSPECTION_LIMITS.messages||(transcriptBytes+=size)>INSPECTION_LIMITS.transcriptBytes)fail('inspection-transcript-limit');transcript.push(m);}catch{finish('error','inspection-transcript-invalid');return;}
   if(!Array.isArray(m)||typeof m[0]!=='string'){finish('error','inspection-message-invalid');return;}
   if(m[0]==='CoqInfo'){if(m.length!==2||typeof m[1]!=='string'||m[1].length>512){finish('error','inspection-version-invalid');return;}version=m[1];}
   else if(m[0]==='Ready'){if(ready){finish('error','inspection-ready-replayed');return;}ready=true;sendDocument();}
   else if(m[0]==='JsonExn'){finish('error','inspection-protocol-error');}
   else if(m[0]==='Notification'){
    const n=m[1];if(!plain(n)||typeof n.uri!=='string'||n.version!==1||!Array.isArray(n.diagnostic)||n.diagnostic.length>256){finish('error','inspection-diagnostics-invalid');return;}
    if(n.uri!==uri){finish('error','inspection-document-mismatch');return;}
    if(n.diagnostic.some(d=>!plain(d)||!Number.isInteger(d.severity))){finish('error','inspection-diagnostics-invalid');return;}
    const first=n.diagnostic.find(d=>d.severity===1);if(first){try{diagnosticText=(typeof first.message==='string'?first.message:flattenKernelPp(first.message)).trim();}catch{finish('error','inspection-diagnostics-invalid');return;}
     const runtimeFailure=/library|failedrequire|bad magic|internal error|cannot open/i.test(diagnosticText);finish(runtimeFailure?'error':'rejected',runtimeFailure?'inspection-library-or-runtime-error':'proof-diagnostic');return;}
   }else if(m[0]==='Log'){
    if(m.length!==3||!Array.isArray(m[1])||m[1].length!==1||!['Debug','Info','Notice','Warning','Error'].includes(m[1][0])){finish('error','inspection-log-invalid');return;}
    let flattened;try{flattened=flattenKernelPp(m[2]);}catch{finish('error','inspection-pp-invalid');return;}
    logs.push({level:m[1][0],pp:m[2]});
    if(m[1][0]==='Error'){finish('error','inspection-log-error');return;}
    if(m[1][0]==='Notice'&&flattened.startsWith('Saved .vo file for ')){if(flattened!=='Saved .vo file for '+uri||saved){finish('error','inspection-save-mismatch');return;}saved=true;}
   }else if(m[0]==='Response'){
    if(m.length!==2||!exact(m[1],['id','res'])){finish('error','inspection-response-invalid');return;}
    if(m[1].id===1){if(responded||JSON.stringify(m[1].res)!=='["Void"]'){finish('error','inspection-response-invalid');return;}responded=true;}
    else{try{if(!queriesSent||answers.has(m[1].id))fail('inspection-goals-invalid');const answer=decodeInspectionGoals(m,{uri,text,requestId:m[1].id});answers.add(answer.id);}catch{finish('error','inspection-goals-invalid');return;}}
   }else{finish('error','inspection-message-unknown');return;}
   if(saved&&responded){
    if(!queries.length)finish('verified');
    else if(!queriesSent){queriesSent=true;for(const query of queries)post(['Request',{id:query.id,method:{uri,loc:query.offset,v:['Goals']}}]);}
    else if(answers.size===queries.length)finish('verified');
   }
  };
  try{
   activeCancel=cancel;worker.addEventListener('message',receive);worker.addEventListener('error',error);worker.addEventListener('messageerror',error);signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimeout(()=>finish('error','inspection-timeout'),remaining);
   for(const item of assets.libraries){aborted(signal);const payload=item.bytes.slice().buffer;worker.postMessage(['Put','/lib/'+item.path.split('/unpacked/')[1],payload],[payload]);}
   post(['Init',{implicit_libs:true,coq_options:[],debug:false,lib_path:paths,lib_init:['Coq.Init.Prelude']}]);
   return await pending;
  }finally{finished=true;if(activeCancel===cancel)activeCancel=null;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.removeEventListener?.('message',receive);worker.removeEventListener?.('error',error);worker.removeEventListener?.('messageerror',error);worker.terminate();}
 }
 async function healthInternal(options){
  const inspect=options.inspect!==false;if(healthCache.has(inspect))return healthCache.get(inspect);
  const closed=['Theorem mkg_health_closed : True.','Proof.','exact I.','Qed.'],negative=['Theorem mkg_health_false : true=false.','Proof.','reflexivity.','Qed.'];
  const positive=await runDocument(closed.join('\n')+'\n',options);aborted(options.signal);
  const bad=await runDocument(negative.join('\n')+'\n',options);aborted(options.signal);
  const negativeRejected=bad.status==='rejected'&&bad.kind==='proof'&&bad.diagnosticText==='Unable to unify "false" with "true".';
  const skipped={status:'error',logs:[]};
  const closedInspection=inspect?await runDocument([...closed,'Print Assumptions mkg_health_closed.','Print Typing Flags.'].join('\n')+'\n',options):skipped;aborted(options.signal);
  const axiom=inspect?await runDocument(['Axiom mkg_health_axiom : False.','Theorem mkg_health_reported : False.','Proof.','exact mkg_health_axiom.','Qed.','Print Assumptions mkg_health_reported.','Print Typing Flags.'].join('\n')+'\n',options):skipped;aborted(options.signal);
  const c=observations(closedInspection),a=observations(axiom),version=positive.version.match(/(?:^|, )(Coq 8\.20\.1\/82000)(?:\n|$)/)?.[1]??null;
  const inspectionHealth={closedContextObserved:closedInspection.status==='verified'&&c.global.status==='closed',axiomReported:axiom.status==='verified'&&a.global.status==='reported'&&a.global.categories.includes('Axioms')&&/\bmkg_health_axiom\b/.test(a.global.text),falseRejected:negativeRejected,typingFlagsObserved:closedInspection.status==='verified'&&axiom.status==='verified'&&c.flags.ordinary===true&&a.flags.ordinary===true};
  const state=positive.status==='verified'&&negativeRejected&&version===VERSION?'ready':'unavailable';
  const receipt=freeze({state,accepted:{status:positive.status,version:positive.version},rejected:{status:negativeRejected?'rejected':'error',kind:negativeRejected?'proof':'runtime'},inspectionHealth,version});healthCache.set(inspect,receipt);return receipt;
 }
 async function exclusive(operation,{signal,timeoutMs=90000,inspect=true}={}){
  if(disposed)fail('inspection-disposed');if(active)fail('inspection-busy');if(typeof inspect!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)fail('inspection-timeout-invalid');aborted(signal);active=true;
  try{return await operation({signal,deadline:Date.now()+timeoutMs,inspect});}finally{active=false;}
 }
 return Object.freeze({
  health:options=>exclusive(healthInternal,options),
  check:(candidate,options)=>exclusive(async controls=>{
   const verified=await verifyCandidateIntegrity(candidate);aborted(controls.signal);if(!verified.valid)fail('inspection-candidate-invalid');
   const fresh=verified.candidate,health=await healthInternal(controls);aborted(controls.signal);if(health.state!=='ready')return {status:'error',kind:'runtime',code:'inspection-health-unavailable',version:health.version};
   const accepted=await runDocument(fresh.certificate.sourceText,controls);aborted(controls.signal);
   if(accepted.status!=='verified')return accepted;
   let inspection;
   if(controls.inspect){
    const text=fresh.certificate.sourceText+commands.join('\n')+'\n';let inspected;
    try{inspected=await runDocument(text,controls);}catch{aborted(controls.signal);if(disposed)fail('inspection-disposed');inspected={status:'error',uri:freshURI(),text,saved:false,responded:false,transcript:[]};}
    aborted(controls.signal);inspection=await summarizeInspection(fresh,inspected,health.inspectionHealth,{cryptoObject});aborted(controls.signal);
   }
   const unchanged=await verifyCandidateIntegrity(candidate);aborted(controls.signal);if(!unchanged.valid||unchanged.candidate.hashes.candidate!==fresh.hashes.candidate)fail('inspection-candidate-changed');
   return {status:'verified',version:accepted.version,...(inspection?{inspection}:{})};
  },options),
  dispose(){disposed=true;healthCache.clear();activeCancel?.();}
 });
}
