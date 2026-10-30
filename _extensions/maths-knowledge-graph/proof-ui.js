// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original reader controls. No model, automatic kernel request or publication.
import {verifyProfileCandidate as verifyCandidateIntegrity,recordProfileMappingReview as recordMappingReview,verifyProfileMappingReview as verifyMappingReview,profileOfCandidate} from './proof-profiles.js';
import {createKernelClient,normalizeKernelHost} from './kernel-adapter.js';
import {validateKernelInspection} from './kernel-inspector.js';
import {verifyPublicProofProposal} from './proof-proposal.js';
let sharedClient=null,active=null,lifecycle=0;
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function download(value,type,name){const url=URL.createObjectURL(new Blob([value],{type})),link=element('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dispose(){lifecycle++;active?.abort();sharedClient?.dispose();sharedClient=null;active=null;}
window.addEventListener('pagehide',dispose);
async function mount(script){
 const panel=element('section',undefined,'mkg-proof-controls');panel.setAttribute('aria-label','Formal proof candidate');script.after(panel);
 const notice=element('p','Checking the local candidate data…');notice.setAttribute('role','status');panel.append(notice);
 try{
  if(script.textContent.length>2*1024*1024)throw Error('candidate-limit');
  const input=JSON.parse(script.textContent);
  if(!input||input.version!==1||Object.keys(input).some(k=>!['version','candidate','timeoutMs','hostUrl','proseProposal'].includes(k))||
    !Number.isInteger(input.timeoutMs)||input.timeoutMs<15000||input.timeoutMs>120000)throw Error('invalid-configuration');
  const verified=await verifyCandidateIntegrity(input.candidate);if(!verified.valid)throw Error('invalid-candidate');
  const candidate=verified.candidate,hostUrl=input.hostUrl===undefined?null:normalizeKernelHost(input.hostUrl);
  const profile=profileOfCandidate(candidate);
  let proseProposal=null;
  if(input.proseProposal!==undefined&&input.proseProposal!==null){
    const checked=await verifyPublicProofProposal(input.proseProposal);if(!checked.valid)throw Error('invalid-or-private-prose-proposal');
    proseProposal=checked.proposal;
    if(candidate.context.sourceProposalSha256!==proseProposal.sha256||candidate.context.source.path!==proseProposal.request.source.path||candidate.context.source.fileSha256!==proseProposal.request.source.sha256||candidate.context.proofId!==proseProposal.request.proof.id||candidate.context.statementId!==proseProposal.request.statement.id||candidate.source.text!==proseProposal.response.controlledProof.replace(/\r\n?/g,'\n'))throw Error('prose-proposal-binding-mismatch');
  }else if(candidate.context.sourceProposalSha256!==undefined)throw Error('missing-prose-proposal');
  let review=null,kernel={status:'not-requested'},reviewEpoch=0,requestEpoch=0;
  panel.replaceChildren(element('h3','Inspect the proposed encoding'));
  if(profile!=='controlled-propositional')panel.append(element('p',`Experimental typed profile: ${profile}. Inspect the declared sorts, signatures, witnesses and scoped obligations. It does not interpret arbitrary mathematical prose.`));
  const translation=element('p',proseProposal?'Translation: author-declared reviewed public projection of an AI-assisted proposal, compiled through the deterministic controlled-language boundary. Review is not authenticated; the kernel has not checked the original prose. Private model records are not published.':'Translation: deterministic controlled-language candidate. The original mathematical statement has not been certified.');
  const reviewStatus=element('p','Source mapping: unreviewed.'),kernelStatus=element('p','Kernel: not requested.');
  reviewStatus.setAttribute('role','status');reviewStatus.setAttribute('aria-atomic','true');
  kernelStatus.setAttribute('role','status');panel.append(translation,reviewStatus,kernelStatus);
  const inspectionDetails=element('details');inspectionDetails.hidden=true;panel.append(inspectionDetails);
  const describeInspection=result=>{
    inspectionDetails.replaceChildren();inspectionDetails.hidden=true;
    if(!result.inspection)return 'Global assumptions: not inspected. Declared hypotheses remain quantified premises.';
    try{
      const inspection=validateKernelInspection(result.inspection,{candidateHash:candidate.hashes.candidate,
        certificateHash:candidate.hashes.certificate,declaredPremises:candidate.certificate.bindings.assumptions});
      if(result.assumptionsInspection!==inspection.status)throw Error('inspection-status-mismatch');
      inspectionDetails.append(element('summary','Inspect global assumptions and typing flags'));
      const global=inspection.status==='closed'?'The fixed inspection reported a closed global context.'
        :inspection.status==='reported'?'The fixed inspection reported global assumptions; inspect them below.'
          :'Global assumptions are unknown for this inspection; no closed-context claim is made.';
      inspectionDetails.append(element('p',global));
      inspectionDetails.append(element('p',inspection.typingFlags.status==='checked'
        ? `Typing flags were observed; ordinary settings: ${inspection.typingFlags.ordinary?'yes':'no'}.`
        : 'Typing flags: unknown.'));
      inspectionDetails.append(element('p',`Declared quantified premises: ${inspection.declaredPremises.length}. These remain conditions of the generated theorem; they are not established facts.`));
      if(inspection.declaredPremises.length){const premises=element('ul');for(const entry of inspection.declaredPremises)premises.append(element('li',`${entry.source} → ${entry.generated}`));inspectionDetails.append(premises);}
      inspectionDetails.append(element('pre',JSON.stringify(inspection,null,2)));
      inspectionDetails.hidden=false;
      return `${global} Source fidelity and the declared premises remain separate.`;
    }catch{return 'Global assumptions: unavailable because the inspection receipt does not match this candidate. No closed-context claim is made.';}
  };
  const actions=element('div',undefined,'mkg-proof-actions');panel.append(actions);
  const button=(text,action,parent=actions)=>{const node=element('button',text);node.type='button';node.addEventListener('click',action);parent.append(node);return node;};
  button('Download Rocq certificate',()=>download(candidate.certificate.sourceText,'text/plain;charset=utf-8','proof-candidate.v'));
  button('Download candidate and provenance',()=>download(JSON.stringify({...candidate,review:review??candidate.review,kernel},null,2)+'\n','application/json','proof-candidate.json'));
  if(proseProposal){
    const original=element('details');original.append(element('summary','Inspect complete original source and model proposal'));
    original.append(element('p','All selected original statement and proof source is retained below. Source quotes and hashes locate the proposal; they do not establish semantic fidelity. The model cannot approve its own mapping or kernel result.'));
    for(const key of ['statement','proof']){original.append(element('h4',key==='proof'?'Complete selected proof source':'Complete selected statement source'));original.append(element('pre',proseProposal.request[key].text));}
    original.append(element('h4','Generated controlled encoding'),element('pre',candidate.source.text));
    if(proseProposal.version===2)original.append(element('p','The model proposed source-clause meanings and roles. Bounded deterministic search constructed this derivation; it does not establish that the original proof used the same reasoning. Inspect the complete original source and clause coverage.'));
    original.append(element('p','The author declared this selected source and encoding suitable for public release. That declaration does not authenticate a reviewer or establish semantic equivalence.'));
    if(proseProposal.version===2){
      const coverage=proseProposal.response.coverage,audit=proseProposal.response.synthesis?.sourceStepAudit;
      original.append(element('h4','Source-clause coverage and support checks'));
      original.append(element('p','Coverage locates the selected source clauses. It does not prove that their proposed meanings are faithful. Support checks use only the declared global prefix: a missing derivation is not a disproof, and local scopes or exhausted work budgets remain unknown. Assertions never become premises merely because they appear in the proof.'));
      original.append(element('pre',JSON.stringify({mapping:proseProposal.response.mapping,coverage,sourceStepAudit:audit},null,2)));
    }
    original.append(element('pre',JSON.stringify({...(proseProposal.version===1?{bindings:proseProposal.response.bindings}:{}),method:proseProposal.method,review:proseProposal.review,proposalSha256:proseProposal.sha256},null,2)));
    button('Download reviewed public proof projection',()=>download(JSON.stringify(proseProposal,null,2)+'\n','application/json','reviewed-public-proof.json'),original);panel.append(original);
  }
  const details=element('details'),summary=element('summary','Review the source mapping');details.append(summary);
  details.append(element('p','Compare the original statement, assumptions and selected proof fragment with the generated certificate. A local review records your decision; it does not authenticate a reviewer or publish an approval.'));
  if(candidate.context.statementText)details.append(element('pre',candidate.context.statementText,'mkg-proof-statement'));
  if(profile!=='controlled-propositional'){
    const declarations=element('details');declarations.append(element('summary','Inspect typed declarations and proof obligations'));
    declarations.append(element('p','These explicit declarations and scoped proof steps determine the generated conditional. Check sorts, predicates, witnesses and assumptions against the authored mathematical claim.'));
    declarations.append(element('pre',JSON.stringify(candidate.ir,null,2)));details.append(declarations);
  }
  if(candidate.certificate.bindings){
    const list=element('dl');for(const group of ['atoms','sorts','functions','predicates','binders','witnesses','assumptions','steps','induction'])for(const entry of candidate.certificate.bindings[group]??[]){
      list.append(element('dt',entry.source),element('dd',entry.generated));
    }details.append(list);
  }
  if(candidate.mapping){
    const mapping=element('details');mapping.append(element('summary','Inspect original-source and certificate coordinates'));
    mapping.append(element('p',candidate.mapping.original?.status==='available'
      ? 'The mapping records exact original-file and generated-certificate ranges in UTF-16 code units. Matching ranges and hashes locate this encoding; they do not establish that it faithfully represents the original prose.'
      : candidate.mapping.original?.status==='partial'
        ? 'Some original-file ranges were located, but an exact mapping for the whole selected proof is unavailable. Inspect the separate statement, proof and code statuses below; no missing range is inferred.'
        : 'An exact original-file mapping is unavailable. The codeblock-local ranges remain available; no original source span is inferred.'));
    mapping.append(element('pre',JSON.stringify(candidate.mapping,null,2)));details.append(mapping);
  }
  if(candidate.compilerProvenance){
    const provenance=element('details');provenance.append(element('summary','Inspect packaged compiler byte observations'));
    provenance.append(element('p','These hashes identify the installed compiler files observed during rendering. They do not attest which code executed in this browser or establish source fidelity.'));
    provenance.append(element('pre',JSON.stringify(candidate.compilerProvenance,null,2)));details.append(provenance);
  }
  const reviewerLabel=element('label','Reviewer name or pseudonym '),reviewer=element('input');reviewer.type='text';reviewer.maxLength=128;reviewer.autocomplete='off';reviewerLabel.append(reviewer);details.append(reviewerLabel);
  const checkedLabel=element('label'),checked=element('input');checked.type='checkbox';checkedLabel.append(checked,document.createTextNode(' I checked this encoding against the original statement and assumptions.'));details.append(checkedLabel);
  const useReview=(value,verb)=>{
    review=value;exportReview.disabled=false;
    reviewStatus.textContent=`Source mapping: ${verb} ${value.status==='accepted'?'acceptance':'mismatch'} locally declared by ${value.reviewer}. This unauthenticated declaration is separate from the kernel result and publication approval.`;
  };
  const record=async accepted=>{
    const epoch=++reviewEpoch,pageEpoch=lifecycle;
    if(!reviewer.value.trim()||accepted&&!checked.checked){reviewStatus.textContent='Source mapping: enter a reviewer name and explicitly check the mapping before recording acceptance.';return;}
    try{const result=await recordMappingReview(candidate,{reviewer:reviewer.value.trim(),accepted});if(epoch!==reviewEpoch||pageEpoch!==lifecycle)return;useReview(result,'recorded');}
    catch{if(epoch===reviewEpoch&&pageEpoch===lifecycle)reviewStatus.textContent='The review could not be recorded for this candidate. Its mapping remains unapproved.';}
  };
  button('Record mapping review',()=>{void record(true);},details);
  button('Record a mismatch',()=>{void record(false);},details);
  const exportReview=button('Download mapping review',()=>{if(review)download(JSON.stringify(review,null,2)+'\n','application/json','proof-mapping-review.json');},details);exportReview.disabled=true;
  const importLabel=element('label','Import an existing mapping review JSON file '),importReview=element('input');importReview.type='file';importReview.accept='.json,application/json';importLabel.append(importReview);details.append(importLabel);
  details.append(element('p','Imported reviews must match this exact source, candidate and compiler. Importing records a reported local decision; it does not authenticate the reviewer, run the kernel or publish an approval. Reviews stay in memory unless you explicitly download them.'));
  importReview.addEventListener('change',async()=>{
    const file=importReview.files?.[0];if(!file)return;
    const epoch=++reviewEpoch,pageEpoch=lifecycle,current=()=>epoch===reviewEpoch&&pageEpoch===lifecycle;
    try{
      if(file.size>65536)throw Error('review-file-limit');
      const bytes=await file.arrayBuffer();if(bytes.byteLength>65536)throw Error('review-file-limit');
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      const result=await verifyMappingReview(candidate,value);if(!current())return;
      if(!result.valid)throw Error('review-binding-mismatch');
      checked.checked=false;useReview(result.review,'imported');
    }catch{if(current())reviewStatus.textContent='That review is invalid, too large or belongs to different source or compiler inputs. Any existing current review is retained; no imported approval was recorded.';}
    finally{if(current())importReview.value='';}
  });
  button('Remove local review',()=>{reviewEpoch++;review=null;checked.checked=false;importReview.value='';exportReview.disabled=true;reviewStatus.textContent='Source mapping: unreviewed.';},details);
  panel.append(details);
  if(hostUrl){
    panel.append(element('p',`Checking loads the configured proof engine at ${new URL(hostUrl).origin} and sends this candidate there. No model is downloaded. The check establishes acceptance of the generated certificate, not fidelity to the original prose.`));
    let controller;
    const run=button('Check candidate with proof engine',async()=>{
      if(active){kernelStatus.textContent='Another proof check is running. Finish or cancel it first.';return;}
      const epoch=++requestEpoch,pageEpoch=lifecycle,current=()=>epoch===requestEpoch&&pageEpoch===lifecycle;
      const ownedController=new AbortController();controller=ownedController;active=ownedController;let client;
      kernel={status:'requested'};inspectionDetails.hidden=true;inspectionDetails.replaceChildren();
      run.disabled=true;cancel.disabled=false;kernelStatus.textContent='Kernel: loading or checking the explicitly selected runtime…';
      try{
        client=sharedClient??=createKernelClient({hostUrl,timeoutMs:input.timeoutMs});
        const result=await client.check(candidate,{signal:ownedController.signal});if(!current())return;kernel=result;
        kernelStatus.textContent=kernel.status==='accepted-closed-generated-certificate'
          ? 'Kernel: accepted the closed generated certificate. '+describeInspection(kernel)
          : kernel.status==='cancelled'?'Kernel: cancelled; no acceptance was recorded.'
            : kernel.status==='timeout'?'Kernel: timed out; no acceptance was recorded.'
              : 'Kernel: the candidate could not be accepted by this runtime. Preserve and inspect its receipt before drawing a conclusion.';
      }catch{if(current()){kernel={status:ownedController.signal.aborted?'cancelled':'unavailable'};kernelStatus.textContent=ownedController.signal.aborted?'Kernel: cancelled.':'Kernel: unavailable. The static candidate and original mathematics remain available.';}}
      finally{if(active===ownedController)active=null;if(current()){run.disabled=false;cancel.disabled=true;}if(ownedController.signal.aborted&&sharedClient===client){sharedClient?.dispose();sharedClient=null;}}
    });
    const cancel=button('Cancel proof check',()=>controller?.abort());cancel.disabled=true;
    window.addEventListener('pageshow',()=>{if(!active){run.disabled=false;cancel.disabled=true;}});
  }else panel.append(element('p','No proof engine host is configured. You can inspect and export the candidate, or configure the optional Sandbox-compatible host through YAML.'));
  const status=element('p','Candidate hashes identify this selected source, encoding, assumptions and configured toolchain; they are not signatures or mathematical approvals.');panel.append(status);
 }catch{notice.textContent='This formalisation data is unavailable or incompatible. The original statement, proof and static certificate remain readable.';}
}
for(const script of document.querySelectorAll('script.mkg-proof-data'))void mount(script);
