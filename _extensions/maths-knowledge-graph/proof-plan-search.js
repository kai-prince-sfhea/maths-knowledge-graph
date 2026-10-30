// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original finite constructive search. No source interpretation, tactics or kernel.
import {parseControlledProof,validateProofIR,compileCertificate} from './proof-candidate.js';

export const PLAN_SEARCH_LIMITS=Object.freeze({states:4096,depth:8,facts:256,steps:128,source:65536});
export const PLAN_SEARCH_PROFILE=Object.freeze({id:'mkg-constructive-plan-search',version:1,completeness:'not-claimed'});
const admitted=new WeakSet(),fail=code=>{throw Error(code);};
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
function freeze(v,seen=new Set()){if(v&&typeof v==='object'&&!seen.has(v)){seen.add(v);Object.values(v).forEach(x=>freeze(x,seen));Object.freeze(v);}return v;}
function limitOptions(options={}){if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>k!=='limits'))fail('invalid-planner-options');const out={...PLAN_SEARCH_LIMITS};if(options.limits!==undefined){if(!options.limits||typeof options.limits!=='object'||Array.isArray(options.limits))fail('invalid-planner-limits');for(const[k,v]of Object.entries(options.limits)){if(!Object.hasOwn(out,k)||!Number.isSafeInteger(v)||v<1||v>out[k])fail('invalid-planner-limits');out[k]=v;}}return out;}
function inspectFormula(v,depth=0,budget={n:0},active=new Set()){
 if(++budget.n>256||depth>24||!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||active.has(v))fail('invalid-plan-formula');
 const ds=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!Object.hasOwn(ds[k],'value')))fail('invalid-plan-formula');
 const kind=ds.kind?.value,allowed=kind==='atom'?['kind','name']:['true','false'].includes(kind)?['kind']:['and','or','implies'].includes(kind)?['kind','left','right']:null;
 if(!allowed||Object.keys(ds).length!==allowed.length||allowed.some(k=>!Object.hasOwn(ds,k)))fail('invalid-plan-formula');
 if(kind==='atom'){if(typeof v.name!=='string'||!/^[A-Z][A-Za-z0-9_]{0,31}$/u.test(v.name)||['true','false','not','and','or','implies'].includes(v.name.toLowerCase()))fail('invalid-plan-formula');return{kind,name:v.name};}
 if(kind==='true'||kind==='false')return{kind};active.add(v);try{return{kind,left:inspectFormula(v.left,depth+1,budget,active),right:inspectFormula(v.right,depth+1,budget,active)};}finally{active.delete(v);}
}
function formulaText(f){return f.kind==='atom'?f.name:f.kind==='true'?'true':f.kind==='false'?'false':'('+formulaText(f.left)+' '+{and:'and',or:'or',implies:'implies'}[f.kind]+' '+formulaText(f.right)+')';}
export function serializePlanFormula(value){return formulaText(inspectFormula(value));}
export function parsePlanFormula(text){
 if(typeof text!=='string'||!text.trim()||text.length>8192||!text.isWellFormed()||!/^[A-Za-z0-9_() \t]+$/u.test(text))fail('invalid-plan-formula');
 const words=text.match(/[A-Za-z][A-Za-z0-9_]*/gu)??[],atoms=[...new Set(words.filter(v=>/^[A-Z]/u.test(v)))].sort();
 if(atoms.length>32||words.some(v=>!atoms.includes(v)&&!['true','false','not','and','or','implies'].includes(v)))fail('invalid-plan-formula');
 const declared=atoms.length?atoms:['P0'],source='Let '+declared.join(', ')+' be '+(declared.length===1?'a proposition':'propositions')+'.\nAssume input: '+text+'.\nConclude input.';
 const parsed=parseControlledProof(source);if(parsed.status!=='supported')fail('invalid-plan-formula');return freeze(inspectFormula(parsed.ir.assumptions[0].formula));
}
export function searchConstructiveProof(input,options={}){
 const limits=limitOptions(options);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='goals,premises'||!Array.isArray(input.premises)||input.premises.length>32||!Array.isArray(input.goals)||!input.goals.length||input.goals.length>32)fail('invalid-proof-plan-input');
 const unique=new Map(input.premises.map(f=>{const v=inspectFormula(f);return[canonical(v),v];})),premises=[...unique].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,f])=>f),goals=input.goals.map(f=>inspectFormula(f)),goal=goals.reduce((a,b)=>({kind:'and',left:a,right:b}));
 inspectFormula(goal);let states=0,fuelExhausted=false,depthStopped=false,factStopped=false;const failures=new Set(),active=new Set();
 const term=(rule,formula,extra={})=>({rule,formula,...extra});
 function saturate(initial){const facts=new Map(initial);let changed=true;const add=(f,t)=>{const k=canonical(f);if(facts.has(k))return;if(facts.size>=limits.facts){factStopped=true;return;}facts.set(k,{formula:f,term:t});changed=true;};
  while(changed){changed=false;const rows=[...facts].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,x])=>x);for(const row of rows){if(row.formula.kind==='and'){add(row.formula.left,term('and-left',row.formula.left,{from:row.term}));add(row.formula.right,term('and-right',row.formula.right,{from:row.term}));}if(row.formula.kind==='implies'){const arg=facts.get(canonical(row.formula.left));if(arg)add(row.formula.right,term('implies-elim',row.formula.right,{fn:row.term,arg:arg.term}));}}}return facts;
 }
 function prove(wanted,initial,scope,depth,usedCases){
  if(states>=limits.states){fuelExhausted=true;return null;}states++;if(depth>limits.depth){depthStopped=true;return null;}
  const facts=saturate(initial),key=canonical({wanted,scope,context:[...facts.keys()].sort(),usedCases:[...usedCases].sort()});if(failures.has(key)||active.has(key))return null;active.add(key);
  try{
   const exact=facts.get(canonical(wanted));if(exact)return exact.term;if(wanted.kind==='true')return term('true-intro',wanted);
   const absurd=facts.get(canonical({kind:'false'}));if(absurd)return term('false-elim',wanted,{from:absurd.term});
   if(wanted.kind==='and'){const left=prove(wanted.left,facts,scope,depth+1,usedCases);if(left){const right=prove(wanted.right,facts,scope,depth+1,usedCases);if(right)return term('and-intro',wanted,{left,right});}}
   if(wanted.kind==='implies'){const local=scope+'/intro',next=new Map(facts);next.set(canonical(wanted.left),{formula:wanted.left,term:term('hypothesis',wanted.left,{key:local})});const body=prove(wanted.right,next,local,depth+1,usedCases);if(body)return term('implies-intro',wanted,{key:local,body});}
   if(wanted.kind==='or'){const left=prove(wanted.left,facts,scope,depth+1,usedCases);if(left)return term('or-left',wanted,{from:left});const right=prove(wanted.right,facts,scope,depth+1,usedCases);if(right)return term('or-right',wanted,{from:right});}
   const rows=[...facts].sort(([a],[b])=>a<b?-1:a>b?1:0);
   for(const [factKey,row]of rows){if(fuelExhausted)break;if(row.formula.kind!=='implies'||facts.has(canonical(row.formula.right)))continue;const arg=prove(row.formula.left,facts,scope,depth+1,usedCases);if(arg){const next=new Map(facts);next.set(canonical(row.formula.right),{formula:row.formula.right,term:term('implies-elim',row.formula.right,{fn:row.term,arg})});const result=prove(wanted,next,scope,depth+1,usedCases);if(result)return result;}}
   for(const [factKey,row]of rows){if(fuelExhausted)break;if(row.formula.kind!=='or'||usedCases.has(factKey))continue;const used=new Set(usedCases);used.add(factKey);const branch=(side)=>{const local=scope+'/case-'+factKey+'/'+side,f=row.formula[side],next=new Map(facts);next.set(canonical(f),{formula:f,term:term('hypothesis',f,{key:local})});return{key:local,formula:f,body:prove(wanted,next,local,depth+1,used)};};const left=branch('left');if(left.body){const right=branch('right');if(right.body)return term('or-elim',wanted,{choice:row.term,left,right});}}
   failures.add(key);return null;
  }finally{active.delete(key);}
 }
 const facts=new Map(premises.map((f,i)=>[canonical(f),{formula:f,term:term('hypothesis',f,{key:'global:'+i})}])),proof=prove(goal,facts,'root',0,new Set());
 const result={version:1,profile:PLAN_SEARCH_PROFILE,status:proof?'proved':'unproved',reason:proof?'constructive-derivation-found':fuelExhausted?'search-fuel-exhausted':depthStopped?'search-depth-exhausted':factStopped?'search-fact-budget-exhausted':'no-derivation-in-bounded-search',premises,goals,goal,...(proof?{term:proof}:{}),limits,statistics:{states:Math.min(states,limits.states+1),fuelExhausted,depthStopped,factStopped},qualification:'A host-constructed derivation for the proposed encoding. Original proof-step fidelity, truth of premises, semantic review and kernel acceptance are not established.'};admitted.add(result);return freeze(result);
}
export function renderConstructiveProof(result){
 if(!admitted.has(result)||result.status!=='proved')fail('unproved-or-unowned-plan');const atoms=new Set(),visit=f=>{if(f.kind==='atom')atoms.add(f.name);else if(f.left){visit(f.left);visit(f.right);}};result.premises.forEach(visit);visit(result.goal);if(atoms.size>32)fail('planner-atom-budget');const names=[...atoms].sort(),unusedCompilerParameter=names.length===0;if(unusedCompilerParameter)names.push('P0');
 const lines=['Let '+names.join(', ')+' be '+(names.length===1?'a proposition':'propositions')+'.'],globals=new Map(),cache=new Map();let serial=0,steps=0;
 const fresh=prefix=>prefix+(serial++),step=()=>{if(++steps>result.limits.steps)fail('planner-program-budget');};
 result.premises.forEach((f,i)=>{const label='h'+i;lines.push('Assume '+label+': '+formulaText(f)+'.');globals.set('global:'+i,label);});
 function introduce(key,assumption,body,rows,known,memo){step();const block=fresh('b'),hyp=fresh('a'),localKnown=new Map(known),localMemo=new Map(memo);localKnown.set(key,hyp);rows.push('Begin subproof '+block+' with '+hyp+': '+formulaText(assumption)+'.');const end=emit(body,rows,localKnown,localMemo);rows.push('End subproof '+block+' with '+end+'.');const label=fresh('s');rows.push('Then '+label+': '+formulaText({kind:'implies',left:assumption,right:body.formula})+' by introducing '+block+'.');return label;}
 function emit(t,rows,known,memo){if(t.rule==='hypothesis'){const label=known.get(t.key);if(!label)fail('planner-local-reference-leak');return label;}if(memo.has(t))return memo.get(t);let label,phrase;
  if(t.rule==='implies-intro')label=introduce(t.key,t.formula.left,t.body,rows,known,memo);
  else{step();if(t.rule==='true-intro')phrase='truth';else if(t.rule==='and-intro')phrase='combining '+emit(t.left,rows,known,memo)+' and '+emit(t.right,rows,known,memo);else if(t.rule==='implies-elim')phrase='applying '+emit(t.fn,rows,known,memo)+' to '+emit(t.arg,rows,known,memo);else if(t.rule==='and-left'||t.rule==='and-right')phrase='taking the '+(t.rule==='and-left'?'left':'right')+' part of '+emit(t.from,rows,known,memo);else if(t.rule==='or-left'||t.rule==='or-right')phrase='choosing the '+(t.rule==='or-left'?'left':'right')+' alternative '+emit(t.from,rows,known,memo);else if(t.rule==='false-elim')phrase='contradiction from '+emit(t.from,rows,known,memo);else if(t.rule==='or-elim'){const choice=emit(t.choice,rows,known,memo),left=introduce(t.left.key,t.left.formula,t.left.body,rows,known,memo),right=introduce(t.right.key,t.right.formula,t.right.body,rows,known,memo);phrase='cases '+choice+' using '+left+' and '+right;}else fail('invalid-planner-term');label=fresh('s');rows.push('Then '+label+': '+formulaText(t.formula)+' by '+phrase+'.');}memo.set(t,label);return label;
 }
 lines.push('Conclude '+emit(result.term,lines,globals,cache)+'.');const text=lines.join('\n');if(text.length>result.limits.source)fail('planner-program-budget');const parsed=parseControlledProof(text);if(parsed.status!=='supported')fail('planner-program-invalid');validateProofIR(parsed.ir);compileCertificate(parsed.ir);return freeze({controlledProof:text,compilerVersion:parsed.ir.version,unusedCompilerParameter,steps,qualification:result.qualification});
}
