// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original exact selected-source bridge; no whole source file is published.
import {resolveSourceOrigin} from './source-map.ts';
import {createProofProposalRequest,verifyPublicProofProposal} from './proof-proposal.js';
export async function prepareProofProseRequest(files:any,source:string,proofId:string,statementId:string,options:any={}){
 const containing=Array.isArray(files)?files.find((f:any)=>f.path===source):null;if(!containing)throw Error('proof-prose-source-unavailable');
 const out:any={source:{path:source,sha256:containing.sha256}};
 for(const[k,id]of[['proof',proofId],['statement',statementId]]){
  const resolved:any=await resolveSourceOrigin(files,{anchor:id});if(resolved.status!=='available'||resolved.origin.span?.kind!=='fenced-div')throw Error('proof-prose-source-unavailable');
  const origin=resolved.origin,file=files.find((f:any)=>f.path===origin.path),span=origin.span;
  out[k]={id,path:origin.path,fileSha256:origin.hash,start:span.start,end:span.end,text:file.text.slice(span.start,span.end),sha256:span.hash};
 }
 return await createProofProposalRequest(out,options);
}
export async function matchCurrentProofProse(input:any,files:any,source:string,proofId:string,statementId:string){
 const checked=await verifyPublicProofProposal(input);if(!checked.valid)throw Error('invalid-or-private-proof-proposal');
 const current=await prepareProofProseRequest(files,source,proofId,statementId,{mode:checked.proposal.request.version===2?'source-plan':'controlled-v1'});
 if(current.sha256!==checked.proposal.request.sha256)throw Error('stale-proof-prose-source');return checked.proposal;
}
