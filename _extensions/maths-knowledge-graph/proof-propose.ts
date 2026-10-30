// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Explicit author command only. Never imported by native render hooks.
import {join,resolve,dirname,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {readConfined} from './confined-read.ts';
import {inventoryProofSources} from './proof-source.ts';
import {prepareProofProseRequest} from './proof-prose-source.ts';
import {buildProofProposalPrompt,createProofProposal,createProofProposalRequest,proofResponseSchema,parseProofProposalJSON,verifyProofProposal,projectReviewedProofProposal,createProofPublicationReview,createProofAuthoringObservation,PROPOSER_OBSERVATION_MODULES} from './proof-proposal.js';
export const TRANSPORT_SHA256='254cdc60d00cb9104442caaf486a2d6d4dd6210d14c872532f5f92bb3fd910d0';
function fail():never{throw Error('proof-proposal-authoring-unavailable');}
const authorSha=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(value=>value.toString(16).padStart(2,'0')).join('');
async function observeProposerFiles(){
 const root=await Deno.realPath(dirname(fileURLToPath(import.meta.url))),files=[];let total=0;
 for(const path of PROPOSER_OBSERVATION_MODULES){const observed=await readConfined({version:1,root,path});total+=observed.bytes;if(total>8*1024*1024)fail();files.push({path,bytes:observed.bytes,sha256:observed.sha256});}
 return{basis:'observed-installed-proposer-module-file-bytes',files,executionAttestation:'not-provided'};
}
async function checkObservedAuthoring(observation:any,root:string,workspace:string){
 const config=await readConfined({version:1,root:observation.configuration.location==='private'?workspace:root,path:observation.configuration.path});if(config.sha256!==observation.configuration.sha256)fail();
 const transport=await readConfined({version:1,root,path:observation.transport.path});if(transport.sha256!==TRANSPORT_SHA256||transport.sha256!==observation.transport.sha256)fail();
 const current=await observeProposerFiles();if(current.files.length!==observation.proposer.files.length||current.files.some((row,index)=>{const before=observation.proposer.files[index];return row.path!==before.path||row.bytes!==before.bytes||row.sha256!==before.sha256;}))fail();
}
export function parseProofGenerationConfig(raw:string){
 if(raw.length>65536)fail();if(raw.trimStart().startsWith('{'))return parseProofProposalJSON(raw);
 const out:any=Object.create(null);for(const line of raw.replace(/^\uFEFF/u,'').split(/\r\n|\r|\n/u)){
  if(!line.trim()||/^\s*#/u.test(line))continue;const row=/^([a-z][a-z0-9-]*):\s*(.*?)\s*$/u.exec(line);if(!row||Object.hasOwn(out,row[1]))fail();
  const value=row[2];if(!value||/[\u0000-\u001f]/u.test(value))fail();
  if(value[0]==='"'){try{const parsed=JSON.parse(value);if(typeof parsed!=='string')fail();out[row[1]]=parsed;}catch{fail();}}
  else if(value[0]==="'"){if(!/^'(?:[^']|'')*'$/u.test(value))fail();out[row[1]]=value.slice(1,-1).replaceAll("''", "'");}
  else if(/^\d+$/u.test(value))out[row[1]]=Number(value);
  else{if(/[\s#\[\]{}&*!|>@`]/u.test(value))fail();out[row[1]]=value;}
 }return out;
}
async function transport(root:string){
 const candidates:string[]=[];
 try{await readConfined({version:1,root,path:'_extensions/knowledge-graph-extraction/local-generation.ts'});candidates.push('_extensions/knowledge-graph-extraction/local-generation.ts');}catch{/* optional direct installation */}
 try{for await(const row of Deno.readDir(join(root,'_extensions'))){if(!row.isDirectory||row.isSymlink||row.name==='knowledge-graph-extraction'||!/^[A-Za-z0-9_.-]+$/u.test(row.name))continue;const path=`_extensions/${row.name}/knowledge-graph-extraction/local-generation.ts`;try{await readConfined({version:1,root,path});candidates.push(path);}catch{/* unrelated extension directory */}}}catch{/* absent dependency */}
 if(candidates.length!==1)fail();const observed=await readConfined({version:1,root,path:candidates[0]});if(observed.sha256!==TRANSPORT_SHA256)fail();
 const module=await import(pathToFileURL(join(root,candidates[0])).href+'?mkg-transport-sha256='+TRANSPORT_SHA256);
 const check=async()=>{const current=await readConfined({version:1,root,path:candidates[0]});if(current.sha256!==TRANSPORT_SHA256||current.raw!==observed.raw)fail();};
 await check();if(typeof module.parseLocalGenerationConfig!=='function'||typeof module.generateLocalJSON!=='function')fail();return{module,check,observation:{path:candidates[0],sha256:observed.sha256}};
}
async function privateWorkspace(root:string,value:string){
 if(typeof value!=='string'||!isAbsolute(value))fail();const workspace=await Deno.realPath(value),inside=relative(root,workspace);
 if(!inside||!isAbsolute(inside)&&inside!=='..'&&!inside.startsWith('..'+sep))fail();
 let cursor=workspace;for(;;){const info=await Deno.lstat(cursor);if(!info.isDirectory||info.isSymlink)fail();try{await Deno.lstat(join(cursor,'.git'));fail();}catch(error){if(!(error instanceof Deno.errors.NotFound))throw error;}const parent=dirname(cursor);if(parent===cursor)break;cursor=parent;}return workspace;
}
async function newDestination(root:string,value:string){
 if(typeof value!=='string'||!/^[-A-Za-z0-9_./]+\.json$/u.test(value)||value.startsWith('/')||value.split('/').some(x=>!x||x==='.'||x==='..'||['.git','.quarto','_extensions'].includes(x.toLowerCase())))fail();
 const destination=join(root,value);let cursor=root;for(const part of value.split('/').slice(0,-1)){cursor=join(cursor,part);const info=await Deno.lstat(cursor);if(!info.isDirectory||info.isSymlink||await Deno.realPath(cursor)!==cursor)fail();}
 const parent=dirname(destination),local=relative(root,await Deno.realPath(parent));if(isAbsolute(local)||local==='..'||local.startsWith('..'+sep))fail();
 try{await Deno.lstat(destination);fail();}catch(error){if(!(error instanceof Deno.errors.NotFound))throw error;}return destination;
}
async function writeNewJSON(root:string,path:string,value:any){
 const destination=await newDestination(root,path),bytes=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');let created=false;
 try{const file=await Deno.open(destination,{write:true,createNew:true});created=true;try{let at=0;while(at<bytes.length){const n=await file.write(bytes.subarray(at));if(!n)fail();at+=n;}await file.sync();}finally{file.close();}
  const observed=await readConfined({version:1,root,path});if(observed.raw!==new TextDecoder().decode(bytes))fail();
 }catch(error){if(created){try{const observed=await readConfined({version:1,root,path});if(observed.raw===new TextDecoder().decode(bytes))await Deno.remove(destination);}catch{/* retain an uncertain owned file for inspection rather than deleting another path */}}throw error;}
}
function argumentsFor(args:string[]){const command=args[0],out:any={};if(!['propose','publish'].includes(command))fail();const allowed=command==='propose'?['--root','--workspace','--source','--proof','--statement','--config','--output','--proposal-format','--config-location']:['--root','--workspace','--proposal','--output','--receipt','--reviewer','--confirm-public-source','--accept-encoding'];for(let i=1;i<args.length;i++){const key=args[i];if(!allowed.includes(key)||Object.hasOwn(out,key))fail();if(['--confirm-public-source','--accept-encoding'].includes(key))out[key]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))fail();out[key]=args[++i];}}return{command,flags:out};}
export async function proposeProof(args:string[]){
 const {command,flags}=argumentsFor(args),root=await Deno.realPath(resolve(flags['--root']??'.')),workspace=await privateWorkspace(root,flags['--workspace']),read=(path:string)=>readConfined({version:1,root,path});
 if(command==='publish'){
  if(['--proposal','--output','--receipt','--reviewer'].some(k=>!flags[k])||flags['--confirm-public-source']!==true||flags['--accept-encoding']!==true)fail();
  const privateFile=await readConfined({version:1,root:workspace,path:flags['--proposal']}),checked=await verifyProofProposal(parseProofProposalJSON(privateFile.raw));if(!checked.valid)fail();const proposal=checked.proposal,request=proposal.request;
  const observed=await inventoryProofSources(request.source.path,read);if(observed.status!=='available')fail();const captured=await prepareProofProseRequest(observed.files,request.source.path,request.proof.id,request.statement.id),freshRequest=await createProofProposalRequest({source:captured.source,proof:captured.proof,statement:captured.statement},{mode:request.version===2?'source-plan':'controlled-v1'});if(freshRequest.sha256!==request.sha256)fail();
  if(proposal.authoringObservation)await checkObservedAuthoring(proposal.authoringObservation,root,workspace);
  const projection=await projectReviewedProofProposal(proposal,{accepted:true,confirmedPublicSource:true}),receipt=await createProofPublicationReview(proposal,projection,{reviewer:flags['--reviewer']});
  await newDestination(root,flags['--output']);await newDestination(workspace,flags['--receipt']);
  if((await readConfined({version:1,root:workspace,path:flags['--proposal']})).sha256!==privateFile.sha256)fail();
  if(proposal.authoringObservation)await checkObservedAuthoring(proposal.authoringObservation,root,workspace);
  // Review receipt and public output are separately written, not a transaction.
  await writeNewJSON(workspace,flags['--receipt'],receipt);await writeNewJSON(root,flags['--output'],projection);
  return{status:'reviewed-public-projection-written',path:flags['--output'],privateRecords:'kept-outside-project-and-git',authoringObservation:proposal.authoringObservation?'captured-config-and-proposer-files-rechecked':'unobserved-compatibility-config-and-code-not-rechecked',semanticFidelity:'author-declared-not-authenticated',kernel:'not-requested'};
 }
 if(['--source','--proof','--statement','--config','--output'].some(k=>!flags[k]))fail();const source=flags['--source'];
 const mode=flags['--proposal-format']??'source-plan',configLocation=flags['--config-location']??'private';if(!['source-plan','controlled-v1'].includes(mode)||!['private','project'].includes(configLocation))fail();
 const currentRequest=async(observed:any)=>{const captured=await prepareProofProseRequest(observed.files,source,flags['--proof'],flags['--statement']);return await createProofProposalRequest({source:captured.source,proof:captured.proof,statement:captured.statement},{mode});},readConfig=()=>readConfined({version:1,root:configLocation==='private'?workspace:root,path:flags['--config']});
 const observed=await inventoryProofSources(source,read);if(observed.status!=='available')fail();
 const request=await currentRequest(observed),configFile=await readConfig(),dependency=await transport(root),config=dependency.module.parseLocalGenerationConfig(parseProofGenerationConfig(configFile.raw));
 await newDestination(workspace,flags['--output']);
 const prompt=await buildProofProposalPrompt(request),schema=proofResponseSchema(request),authoringObservation=mode==='source-plan'?await createProofAuthoringObservation(request,{prompt:{basis:'exact-prompt-utf8',sha256:await authorSha(prompt)},schema:{basis:'exact-json-stringify-schema-utf8',sha256:await authorSha(JSON.stringify(schema))},configuration:{location:configLocation,path:flags['--config'],sha256:configFile.sha256},transport:dependency.observation,proposer:await observeProposerFiles()}):null;
 const result=await dependency.module.generateLocalJSON(config,prompt,schema,{requestId:request.sha256}),proposal=await createProofProposal(request,result.text,result.provenance,authoringObservation?{authoringObservation}:{});
 const fresh=await inventoryProofSources(source,read);if(fresh.status!=='available'||(await currentRequest(fresh)).sha256!==request.sha256||(await readConfig()).sha256!==configFile.sha256)fail();await dependency.check();await privateWorkspace(root,workspace);
 if(authoringObservation)await checkObservedAuthoring(authoringObservation,root,workspace);
 await writeNewJSON(workspace,flags['--output'],proposal);
 return{status:'private-unreviewed-proposal-written',path:flags['--output'],proposalFormat:mode,configLocation,authoringObservation:authoringObservation?'captured-private-hashed-observation':'unobserved-compatibility-config-and-code-not-rechecked',compilation:proposal.response.compilation,unresolved:proposal.response.unresolved.length,privateRecords:'outside-project-and-git',modelIdentity:'reported-not-attested',semanticFidelity:'not-established',kernel:'not-requested'};
}
if(import.meta.main){try{if(Deno.args.length===1&&Deno.args[0]==='--help')console.log('Explicit private proposal:\nquarto run <installed-mkg>/proof-propose.ts propose --source article.qmd --proof prf-name --statement thm-name --config local-proof.yml --workspace ABSOLUTE_NON_GIT_FOLDER --output proposal.json [--root .]\nAfter inspecting the private record and confirming the selected QMD source is public:\nquarto run <installed-mkg>/proof-propose.ts publish --workspace ABSOLUTE_NON_GIT_FOLDER --proposal proposal.json --reviewer NAME --confirm-public-source --accept-encoding --receipt review.json --output reviewed-proof.json [--root .]\nInstall compatible Knowledge Graph Extraction separately. Only propose contacts its configured literal-loopback model. Raw responses, server provenance and reviewer receipts stay outside the project and all Git repositories. Publish writes only the deliberately reviewed public encoding and already-public selected source. Ordinary render makes no model request and refuses private raw proposal files. Default propose uses source-clause mappings and a private-workspace config; --proposal-format controlled-v1 and --config-location project are explicit compatibility choices. There is no secret/config fallback search. Default source-plan proposals privately record exact prompt/schema/configuration/transport and proposer-module file hashes without configuration values. Publication rechecks captured configuration and module bytes; historical or explicit compatibility records remain unobserved and are labelled accordingly. These observations are not execution or model-weight attestation. Synthesized derivations are separate from source reasoning; semantic review is still required. No existing file is overwritten.');else console.log(JSON.stringify(await proposeProof(Deno.args)));}catch{console.error('maths-knowledge-graph: cannot prepare the selected proof proposal; use unique visible native fenced blocks, ordinary paths and a fresh filename. Keep the private workspace outside the project and every Git repository. Propose needs a compatible separate Knowledge Graph Extraction installation and configured loopback model; publish requires explicit review/public-source declarations and no unresolved model issues. No kernel acceptance was recorded.');Deno.exit(1);}}
