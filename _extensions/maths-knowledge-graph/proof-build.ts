// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Deterministic installed bridge, never a model or proof-kernel invocation.
import {boundedRead} from './confined-read.ts';
import {readConfined} from './confined-read.ts';
import {createProfileCandidate,profileOfCandidate,compilerArtifactPaths} from './proof-profiles.js';
import {candidateFromProofProposal,parseProofProposalJSON} from './proof-proposal.js';
import {matchCurrentProofProse} from './proof-prose-source.ts';
import {inventoryProofSources,prepareProofSourceObservation} from './proof-source.ts';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
try{
 // A source fragment is individually bounded by the compiler. The envelope
 // must also accommodate its native statement/context without pretending
 // every maximum-sized combination necessarily fits the cumulative budget.
 const bytes=await boundedRead(Deno.stdin.readable,2*1024*1024);
 const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1||
  Object.keys(input).some(k=>!['version','text','context','kernel','sourceRoot','proposalPath','profile'].includes(k))||typeof input.kernel!=='boolean')throw Error('invalid-proof-input');
 const profile=input.profile??'controlled-propositional';
 if(!['controlled-propositional','typed-fol-eq-v1','typed-nat-induction-v1'].includes(profile))throw Error('unsupported-proof-profile');
 if(input.kernel){const{KERNEL_TOOLCHAIN}=await import('./kernel-adapter.js');input.context.toolchain=KERNEL_TOOLCHAIN;}
 let proposal:any=null,candidate:any;
 if(input.proposalPath!==undefined){
  if(profile!=='controlled-propositional')throw Error('prose-proposal-profile-mismatch');
  if(typeof input.sourceRoot!=='string'||typeof input.proposalPath!=='string'||input.text!=='')throw Error('invalid-proof-proposal-import');
  const file=await readConfined({version:1,root:input.sourceRoot,path:input.proposalPath}),parsed=parseProofProposalJSON(file.raw);
  const observed=await inventoryProofSources(input.context.source.path,path=>readConfined({version:1,root:input.sourceRoot,path}));
  proposal=await matchCurrentProofProse(parsed,observed.files,input.context.source.path,input.context.proofId,input.context.statementId);
  candidate=await candidateFromProofProposal(proposal,input.context);
  if((await readConfined({version:1,root:input.sourceRoot,path:input.proposalPath})).sha256!==file.sha256)throw Error('stale-proof-proposal-import');
 }else candidate=await createProfileCandidate(profile,input.text,input.context);
 if(candidate.status==='candidate'&&input.sourceRoot!==undefined){
  if(profileOfCandidate(candidate)!==profile)throw Error('proof-candidate-profile-mismatch');
  if(typeof input.sourceRoot!=='string'||input.sourceRoot.length>32768)throw Error('invalid-source-root');
  const observed=await inventoryProofSources(candidate.context.source.path,path=>readConfined({version:1,root:input.sourceRoot,path}));
  const original=await prepareProofSourceObservation(observed.files,{source:candidate.context.source.path,sourceSha256:candidate.context.source.fileSha256,proofId:candidate.context.proofId,statementId:candidate.context.statementId,text:candidate.source.text});
  const runtime=dirname(fileURLToPath(import.meta.url)),files=[];
  for(const path of compilerArtifactPaths(profile)){const file=await readConfined({version:1,root:runtime,path});files.push({path,bytes:file.bytes,sha256:file.sha256});}
  candidate=await createProfileCandidate(profile,candidate.source.text,candidate.context,{sourceObservation:original,compilerArtifacts:{version:profile==='controlled-propositional'?1:2,...(profile==='controlled-propositional'?{}:{profile}),hashBasis:'observed-installed-file-bytes',executionAttestation:'not-provided',files}});
 }
 const output=JSON.stringify({...candidate,...(proposal?{proseProposal:proposal}:{})});
 if(new TextEncoder().encode(output).length>1536*1024)throw Error('proof-output-limit');console.log(output);
}catch{console.error('maths-knowledge-graph: cannot prepare the selected formal proof; reinstall the complete extension and use the documented bounded proof format');Deno.exit(1);}
