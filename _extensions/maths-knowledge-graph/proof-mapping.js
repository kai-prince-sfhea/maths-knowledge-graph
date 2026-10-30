// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original source/certificate coordinate binding. No IO or semantic verdict.
const fail=()=>{throw Error('invalid-proof-mapping');};
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,names)=>{if(!object(value)||Object.keys(value).length!==names.length||names.some(key=>!Object.hasOwn(value,key)))fail();return value;};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sha=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
const path=value=>typeof value==='string'&&value.length>0&&value.length<=4096&&/\.(?:qmd|md)$/i.test(value)&&!value.startsWith('/')&&!/[\\:\u0000-\u001f\u007f?#%]/.test(value)&&!value.split('/').some(p=>!p||p==='.'||p==='..'||['.git','.quarto','_extensions'].includes(p.toLowerCase()));
const integer=value=>Number.isSafeInteger(value)&&value>=0&&value<=2*1024*1024;
const clone=value=>JSON.parse(JSON.stringify(value));
function origin(result){
 if(!object(result))fail();
 if(result.status==='unavailable'){
  keys(result,['status','reason']);if(!['invalid-input','source-integrity','missing','ambiguous','limit','include-closure-unavailable'].includes(result.reason))fail();return clone(result);
 }
 keys(result,['status','origin']);if(result.status!=='available')fail();const value=result.origin;
 if(!object(value)||Object.keys(value).some(k=>!['path','anchor','hash','start','end','precision','span'].includes(k))||!path(value.path)||!digest(value.hash)||typeof value.anchor!=='string'||!value.anchor||value.anchor.length>512||/[\s{}"'`<>#\\]/u.test(value.anchor)||value.precision!=='anchor-token'||!integer(value.start)||!integer(value.end)||value.end!==value.start+value.anchor.length+1)fail();
 if(value.span!==undefined){const span=keys(value.span,['kind','start','end','hash','precision']);if(!['heading-section','fenced-div'].includes(span.kind)||span.precision!=='source-structure'||!digest(span.hash)||!integer(span.start)||!integer(span.end)||span.start>value.start||span.end<value.end)fail();}
 return clone(result);
}
/** Checks internal coordinate/hash consistency. Original full-file and block
 * hashes remain observed provenance; original source bytes are not published. */
export async function validateSourceObservation(value,{sourceText,context}={}){
 keys(value,['version','coordinateUnits','containing','status','reason','closure','proof','statement','code']);
 if(value.version!==1||value.coordinateUnits!=='utf16-code-units'||typeof sourceText!=='string'||sourceText.length>65536||!object(context))fail();
 const containing=keys(value.containing,['path','sha256']);if(!path(containing.path)||!digest(containing.sha256)||containing.path!==context.source.path||containing.sha256!==context.source.fileSha256)fail();
 const proof=origin(value.proof),statement=origin(value.statement);
 if(proof.status==='available'&&proof.origin.anchor!==context.proofId||statement.status==='available'&&statement.origin.anchor!==context.statementId)fail();
 const closure=keys(value.closure,['status','fileCount','sha256']);
 if(closure.status==='complete'){if(!Number.isInteger(closure.fileCount)||closure.fileCount<1||closure.fileCount>64||!digest(closure.sha256))fail();}
 else if(closure.status!=='unavailable'||closure.fileCount!==0||closure.sha256!==null)fail();
 let code;
 if(value.code?.status==='unavailable'){
  keys(value.code,['status','reason']);if(!['include-closure-unavailable','source-integrity','original-proof-fence-unavailable'].includes(value.code.reason))fail();code=clone(value.code);
 }else{
  const c=keys(value.code,['status','path','fileSha256','start','end','sha256','normalization','segments']);
  if(c.status!=='available'||closure.status!=='complete'||!path(c.path)||!digest(c.fileSha256)||!digest(c.sha256)||!integer(c.start)||!integer(c.end)||c.end<=c.start||c.normalization!=='LF'||!Array.isArray(c.segments)||!c.segments.length||c.segments.length>512)fail();
  if(proof.status!=='available'||proof.origin.path!==c.path||proof.origin.hash!==c.fileSha256||proof.origin.span?.kind!=='fenced-div'||c.start<proof.origin.span.start||c.end>proof.origin.span.end)fail();
  const lines=sourceText.split('\n');if(lines.length!==c.segments.length)fail();let codeOffset=0,originalOffset=c.start,raw='';
  c.segments.forEach((segment,index)=>{
   keys(segment,['codeStart','codeEnd','sourceStart','sourceEnd','lineEnding']);const line=lines[index],last=index===lines.length-1;
   if(!['none','LF','CR','CRLF'].includes(segment.lineEnding)||segment.codeStart!==codeOffset||segment.codeEnd!==codeOffset+line.length||segment.sourceStart!==originalOffset||segment.sourceEnd!==originalOffset+line.length||(segment.lineEnding==='none')!==last)fail();
   const eol=segment.lineEnding==='CRLF'?'\r\n':segment.lineEnding==='LF'?'\n':segment.lineEnding==='CR'?'\r':'';raw+=line+eol;codeOffset+=line.length+(last?0:1);originalOffset+=line.length+eol.length;
  });
  if(originalOffset!==c.end||codeOffset!==sourceText.length||await sha(raw)!==c.sha256)fail();code=clone(c);
 }
 const expectedStatus=code.status==='available'&&statement.status==='available'?'available':proof.status==='available'||statement.status==='available'?'partial':'unavailable';
 const expectedReason=expectedStatus==='available'?null:closure.status==='unavailable'?value.reason:code.status==='unavailable'?'original-proof-fence-unavailable':'original-statement-unavailable';
 if(value.status!==expectedStatus||value.reason!==expectedReason||!([null,'include-closure-unavailable','source-integrity','original-proof-fence-unavailable','original-statement-unavailable'].includes(value.reason)))fail();
 return{version:1,coordinateUnits:'utf16-code-units',containing:clone(containing),status:value.status,reason:value.reason,closure:clone(closure),proof,statement,code};
}
function originalRanges(span,code){
 if(code.status!=='available')return null;
 const ranges=[];
 for(const segment of code.segments){
  const start=Math.max(span.start,segment.codeStart),end=Math.min(span.end,segment.codeEnd);
  if(end>start)ranges.push({path:code.path,start:segment.sourceStart+start-segment.codeStart,end:segment.sourceStart+end-segment.codeStart});
 }
 return ranges;
}
/** Derived ranges are regenerated from finite IR and exact certificate bytes.
 * Identifier occurrences are lexical links, not proof or prose equivalence. */
export async function buildCandidateMapping(observation,{sourceText,context,ir,certificate}={}){
 const original=await validateSourceObservation(observation,{sourceText,context});
 if(!object(ir)||!object(certificate)||typeof certificate.sourceText!=='string'||certificate.sourceText.length>262144||!object(certificate.bindings))fail();
 // Index the exact regenerated identifier tokens once, rather than rescan the
 // whole certificate for each declared atom, assumption and proof step.
 const references=new Map();
 for(const found of certificate.sourceText.matchAll(/\b(?:p|h|s)\d+\b/g)){
  const entries=references.get(found[0])??[];if(entries.length>=1024)fail();entries.push({start:found.index,end:found.index+found[0].length});references.set(found[0],entries);
 }
 function entry(id,generated,span){const positions=references.get(generated);if(!positions?.length)fail();return{id,generated,codeblock:{...span},original:originalRanges(span,original.code),certificate:positions.map(value=>({...value}))};}
 const allSteps=[],activeSteps=new Set();const visit=(rows,depth=0)=>{if(!Array.isArray(rows)||depth>8||activeSteps.has(rows))fail();activeSteps.add(rows);try{for(const row of rows){if(!object(row)||allSteps.length>=128)fail();allSteps.push(row);if(row.kind==='subproof'){if(!object(row.assumption)||allSteps.length>=128)fail();allSteps.push(row.assumption);visit(row.steps,depth+1);}}}finally{activeSteps.delete(rows);}};visit(ir.steps);
 const bindings={atoms:certificate.bindings.atoms.map(binding=>entry(binding.source,binding.generated,ir.declaration)),
  assumptions:certificate.bindings.assumptions.map(binding=>{const item=ir.assumptions.find(row=>row.id===binding.source);if(!item)fail();return entry(item.id,binding.generated,item.span);}),
  steps:certificate.bindings.steps.map(binding=>{const item=allSteps.find(row=>row.id===binding.source);if(!item)fail();return entry(item.id,binding.generated,item.span);})};
 const final=certificate.bindings.steps.find(row=>row.source===ir.conclusion.id)??certificate.bindings.assumptions.find(row=>row.source===ir.conclusion.id);if(!final)fail();
 return{version:1,coordinateUnits:'utf16-code-units',original,bindings,conclusion:entry(ir.conclusion.id,final.generated,ir.conclusion.span),qualification:'Observed original-source coordinates and regenerated lexical encoding links; neither prose equivalence nor mathematical correctness is established.'};
}
export function validateCompilerArtifacts(value){
 keys(value,['version','hashBasis','executionAttestation','files']);if(value.version!==1||value.hashBasis!=='observed-installed-file-bytes'||value.executionAttestation!=='not-provided'||!Array.isArray(value.files)||value.files.length!==2)fail();
 const expected=['proof-candidate.js','proof-mapping.js'];
 const files=value.files.map((file,index)=>{keys(file,['path','bytes','sha256']);if(file.path!==expected[index]||!Number.isInteger(file.bytes)||file.bytes<1||file.bytes>2*1024*1024||!digest(file.sha256))fail();return{...file};});
 return{version:1,hashBasis:'observed-installed-file-bytes',executionAttestation:'not-provided',files};
}
