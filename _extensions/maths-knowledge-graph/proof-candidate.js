// Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
// Original finite controlled-English compiler. No authored Rocq commands,
// imports, model calls or mathematical/source-fidelity verdict are accepted.
import {buildCandidateMapping,validateCompilerArtifacts} from './proof-mapping.js';
export const COMPILER = Object.freeze({id:'mkg-controlled-propositional-en',version:1,
  hashBasis:'compiler-descriptor',artifactSha256:null});
export const LIMITS = Object.freeze({source:65536,lines:512,atoms:32,assumptions:32,
  steps:128,formulaNodes:256,formulaDepth:24,certificate:262144,dependencies:128});
const LANGUAGE = 'controlled-propositional-en-v1';
const atomName = /^[A-Z][A-Za-z0-9_]{0,31}$/;
const labelName = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const digestPattern = /^[a-f0-9]{64}$/;
class ProofError extends Error {
  constructor(code, line = null, column = null) { super(code); this.code=code; this.line=line; this.column=column; }
}
const fail = (code,line,column) => { throw new ProofError(code,line,column); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype,null].includes(Object.getPrototypeOf(value));
function keys(value, allowed, code) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(code);
}
function required(value, fields, code) {
  keys(value,fields,code); if (fields.some(field => !Object.hasOwn(value,field))) fail(code);
}
function string(value, maximum, code) {
  if (typeof value !== 'string' || !value.trim() || value.length>maximum || /[\u0000-\u001f\u007f]/.test(value)) fail(code);
  return value;
}
function canonical(value, depth=0) {
  if (depth>64) fail('serialization-depth-limit');
  if (value===null || typeof value==='string' || typeof value==='boolean') return JSON.stringify(value);
  if (typeof value==='number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '['+Array.from(value,item=>canonical(item,depth+1)).join(',')+']';
  if (!record(value)) fail('invalid-canonical-value');
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key],depth+1)).join(',')+'}';
}
async function sha256(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder!=='function') fail('hashing-unavailable');
  const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
const same = (left,right) => canonical(left)===canonical(right);
const diagnostic = error => ({code:error instanceof ProofError?error.code:'proof-compilation-failed',
  line:error instanceof ProofError?error.line:null,column:error instanceof ProofError?error.column:null,
  coordinateSpace:'codeblock-text',coordinateUnits:'utf16-code-units'});
function span(value) {
  required(value,['start','end','line','column'],'invalid-source-span');
  if (![value.start,value.end,value.line,value.column].every(Number.isInteger) || value.start<0 || value.end<value.start ||
      value.end>LIMITS.source || value.line<1 || value.line>LIMITS.lines || value.column<1 || value.column>LIMITS.source) fail('invalid-source-span');
}
function formula(value, atoms, depth=0, budget={nodes:0}, active=new Set()) {
  if (depth>LIMITS.formulaDepth || ++budget.nodes>LIMITS.formulaNodes) fail('formula-limit');
  if (!record(value) || active.has(value)) fail('invalid-formula');
  active.add(value);
  try {
    if (value.kind==='atom') {
      required(value,['kind','name'],'invalid-formula');
      if (!atoms.has(value.name)) fail('undeclared-proposition');
    } else if (value.kind==='true' || value.kind==='false') required(value,['kind'],'invalid-formula');
    else if (['and','or','implies'].includes(value.kind)) {
      required(value,['kind','left','right'],'invalid-formula');
      formula(value.left,atoms,depth+1,budget,active); formula(value.right,atoms,depth+1,budget,active);
    } else fail('unsupported-formula');
  } finally { active.delete(value); }
}
function parseFormula(text, atoms, line, baseColumn) {
  let position=0,nodes=0;
  const whitespace=()=>{while(text[position]===' '||text[position]==='\t')position++;};
  const word=()=>{whitespace();const found=/^[A-Za-z][A-Za-z0-9_]*/.exec(text.slice(position));if(!found)return null;position+=found[0].length;return found[0];};
  const create=(kind,extra={})=>{if(++nodes>LIMITS.formulaNodes)fail('formula-limit',line,baseColumn+position);return {kind,...extra};};
  function term(depth) {
    if(depth>LIMITS.formulaDepth)fail('formula-limit',line,baseColumn+position);
    whitespace();
    if(text[position]==='('){position++;const parsed=expression(1,depth+1);whitespace();if(text[position++]!==')')fail('unsupported-formula-syntax',line,baseColumn+position-1);return parsed;}
    const termStart=position,name=word();
    if(name==='not')return create('implies',{left:term(depth+1),right:create('false')});
    if(name==='true'||name==='false')return create(name);
    if(!name||!atoms.has(name))fail(name&&atomName.test(name)?'undeclared-proposition':'unsupported-formula-syntax',line,baseColumn+termStart);
    return create('atom',{name});
  }
  function expression(minimum,depth) {
    let left=term(depth);
    while(true){
      const before=position,name=word(),precedence={implies:1,or:2,and:3}[name];
      if(!precedence||precedence<minimum){position=before;break;}
      left=create(name,{left,right:expression(name==='implies'?precedence:precedence+1,depth+1)});
    }
    return left;
  }
  const parsed=expression(1,0);whitespace();if(position!==text.length)fail('unsupported-formula-syntax',line,baseColumn+position);
  formula(parsed,atoms);return parsed;
}
function ruleFrom(text,line) {
  const patterns=[
    ['implies-elim',/^applying ([A-Za-z][A-Za-z0-9_-]{0,31}) to ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['and-intro',/^combining ([A-Za-z][A-Za-z0-9_-]{0,31}) and ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['and-left',/^taking the left part of ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['and-right',/^taking the right part of ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['or-left',/^choosing the left alternative ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['or-right',/^choosing the right alternative ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['false-elim',/^contradiction from ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['repeat',/^repeating ([A-Za-z][A-Za-z0-9_-]{0,31})$/],
    ['true-intro',/^truth$/]
  ];
  for(const [rule,pattern] of patterns){const found=pattern.exec(text);if(found)return {rule,premises:found.slice(1)};}
  fail('unsupported-proof-step',line,1);
}
/** Source coordinates refer ONLY to LF-normalized codeblock text, not QMD. */
export function parseControlledProof(text) {
  if(typeof text==='string'&&/^\s*Begin subproof /m.test(text))return parseStructuredProof(text);
  try {
    if(typeof text!=='string'||!text.trim()||text.length>LIMITS.source||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))fail('invalid-proof-source');
    const normalized=text.replace(/\r\n?/g,'\n'),lines=normalized.split('\n');if(lines.length>LIMITS.lines)fail('source-line-limit');
    const ir={version:1,language:LANGUAGE,coordinateSpace:'codeblock-text',coordinateUnits:'utf16-code-units',
      atoms:[],declaration:null,assumptions:[],steps:[],conclusion:null};
    let offset=0,atoms;
    for(let index=0;index<lines.length;index++){
      const raw=lines[index],line=raw.trim(),number=index+1;
      const leading=raw.length-raw.trimStart().length;
      const sourceSpan={start:offset,end:offset+raw.length,line:number,column:1};offset+=raw.length+1;
      if(!line)continue;
      if(ir.conclusion)fail('content-after-conclusion',number,1);
      let match;
      if(!atoms){
        match=/^Let ([A-Z][A-Za-z0-9_]*(?:, *[A-Z][A-Za-z0-9_]*)*) be (?:propositions|a proposition)\.$/.exec(line);
        if(!match)fail('unsupported-proposition-declaration',number,1);
        ir.atoms=match[1].split(',').map(item=>item.trim());atoms=new Set(ir.atoms);ir.declaration=sourceSpan;
        if(ir.atoms.length>LIMITS.atoms||atoms.size!==ir.atoms.length||ir.atoms.some(name=>!atomName.test(name)||
          ['true','false','not','and','or','implies'].includes(name.toLowerCase())))fail('invalid-proposition-declaration',number,1);
      } else if((match=/^Assume ([A-Za-z][A-Za-z0-9_-]{0,31}): (.+)\.$/.exec(line))){
        if(ir.steps.length)fail('assumption-after-derivation',number,1);
        ir.assumptions.push({id:match[1],formula:parseFormula(match[2],atoms,number,leading+10+match[1].length),span:sourceSpan});
      } else if((match=/^Then ([A-Za-z][A-Za-z0-9_-]{0,31}): (.+) by (.+)\.$/.exec(line))){
        ir.steps.push({id:match[1],formula:parseFormula(match[2],atoms,number,leading+8+match[1].length),...ruleFrom(match[3],number),span:sourceSpan});
      } else if((match=/^Conclude ([A-Za-z][A-Za-z0-9_-]{0,31})\.$/.exec(line)))ir.conclusion={id:match[1],span:sourceSpan};
      else fail('unsupported-proof-line',number,1);
      if(ir.assumptions.length>LIMITS.assumptions||ir.steps.length>LIMITS.steps)fail('proof-size-limit',number,1);
    }
    if(!atoms||!ir.conclusion)fail('incomplete-proof');
    validateProofIR(ir);
    return {status:'supported',ir,diagnostics:[]};
  } catch(error) {
    const code=error instanceof ProofError?error.code:'';
    return {status:code.startsWith('unsupported-')?'unsupported':'invalid',ir:null,diagnostics:[diagnostic(error)]};
  }
}
function validateStep(step,prior) {
  const count={ 'implies-elim':2,'and-intro':2,'and-left':1,'and-right':1,'or-left':1,'or-right':1,'false-elim':1,repeat:1,'true-intro':0 }[step.rule];
  if(count===undefined||step.premises.length!==count)fail('unsupported-rule');
  const args=step.premises.map(id=>{if(!labelName.test(id)||!prior.has(id))fail('unknown-or-forward-reference');return prior.get(id);});
  const goal=step.formula;
  const valid=step.rule==='implies-elim'?args[0].kind==='implies'&&same(args[0].left,args[1])&&same(args[0].right,goal)
    :step.rule==='and-intro'?goal.kind==='and'&&same(goal.left,args[0])&&same(goal.right,args[1])
    :step.rule==='and-left'?args[0].kind==='and'&&same(goal,args[0].left)
    :step.rule==='and-right'?args[0].kind==='and'&&same(goal,args[0].right)
    :step.rule==='or-left'?goal.kind==='or'&&same(goal.left,args[0])
    :step.rule==='or-right'?goal.kind==='or'&&same(goal.right,args[0])
    :step.rule==='false-elim'?args[0].kind==='false'
    :step.rule==='true-intro'?goal.kind==='true':same(goal,args[0]);
  if(!valid)fail('rule-does-not-establish-conclusion',step.span.line,step.span.column);
}
/** Validate logic independently of the parser; never trust an imported IR. */
export function validateProofIR(ir) {
  if(ir?.language===STRUCTURED_LANGUAGE)return validateStructuredProofIR(ir);
  required(ir,['version','language','coordinateSpace','coordinateUnits','atoms','declaration','assumptions','steps','conclusion'],'invalid-proof-ir');
  if(ir.version!==1||ir.language!==LANGUAGE||ir.coordinateSpace!=='codeblock-text'||ir.coordinateUnits!=='utf16-code-units')fail('unsupported-proof-ir');
  if(!Array.isArray(ir.atoms)||!ir.atoms.length||ir.atoms.length>LIMITS.atoms||new Set(ir.atoms).size!==ir.atoms.length||
    ir.atoms.some(name=>typeof name!=='string'||!atomName.test(name)||['true','false','not','and','or','implies'].includes(name.toLowerCase())))fail('invalid-proposition-declaration');
  span(ir.declaration);const atoms=new Set(ir.atoms),prior=new Map();
  if(!Array.isArray(ir.assumptions)||ir.assumptions.length>LIMITS.assumptions||!Array.isArray(ir.steps)||ir.steps.length>LIMITS.steps)fail('proof-size-limit');
  for(const assumption of ir.assumptions){
    required(assumption,['id','formula','span'],'invalid-assumption');span(assumption.span);
    if(!labelName.test(assumption.id)||prior.has(assumption.id))fail('duplicate-or-invalid-step-label');
    formula(assumption.formula,atoms);prior.set(assumption.id,assumption.formula);
  }
  for(const step of ir.steps){
    required(step,['id','formula','rule','premises','span'],'invalid-proof-step');span(step.span);
    if(!labelName.test(step.id)||prior.has(step.id))fail('duplicate-or-invalid-step-label');
    formula(step.formula,atoms);if(!Array.isArray(step.premises))fail('invalid-premises');validateStep(step,prior);prior.set(step.id,step.formula);
  }
  required(ir.conclusion,['id','span'],'invalid-conclusion');span(ir.conclusion.span);
  if(!labelName.test(ir.conclusion.id)||!prior.has(ir.conclusion.id))fail('unknown-conclusion');
  return {conclusion:prior.get(ir.conclusion.id)};
}
function rocqFormula(value,atoms) {
  if(value.kind==='atom')return atoms.get(value.name);
  if(value.kind==='true')return 'True';if(value.kind==='false')return 'False';
  return `(${rocqFormula(value.left,atoms)} ${{and:'/\\',or:'\\/',implies:'->'}[value.kind]} ${rocqFormula(value.right,atoms)})`;
}
/** Only constructive Init.Logic terms and generated bound names are emitted. */
export function compileCertificate(ir) {
  if(ir?.language===STRUCTURED_LANGUAGE)return compileStructuredCertificate(ir);
  const {conclusion}=validateProofIR(ir),atoms=new Map(ir.atoms.map((name,index)=>[name,`p${index}`]));
  const references=new Map(),formulas=new Map(),parameters=[...atoms.values()].map(name=>`(${name} : Prop)`);
  for(const [index,assumption] of ir.assumptions.entries()){
    const name=`h${index}`;references.set(assumption.id,name);formulas.set(assumption.id,assumption.formula);
    parameters.push(`(${name} : ${rocqFormula(assumption.formula,atoms)})`);
  }
  const lets=[];
  for(const [index,step] of ir.steps.entries()){
    const args=step.premises.map(id=>references.get(id)),goal=rocqFormula(step.formula,atoms);
    let term;
    if(step.rule==='implies-elim')term=`(${args[0]} ${args[1]})`;
    else if(step.rule==='and-intro')term=`(@conj ${rocqFormula(step.formula.left,atoms)} ${rocqFormula(step.formula.right,atoms)} ${args[0]} ${args[1]})`;
    else if(step.rule==='and-left'||step.rule==='and-right'){
      const from=formulas.get(step.premises[0]);term=`(@${step.rule==='and-left'?'proj1':'proj2'} ${rocqFormula(from.left,atoms)} ${rocqFormula(from.right,atoms)} ${args[0]})`;
    }else if(step.rule==='or-left'||step.rule==='or-right')term=`(@${step.rule==='or-left'?'or_introl':'or_intror'} ${rocqFormula(step.formula.left,atoms)} ${rocqFormula(step.formula.right,atoms)} ${args[0]})`;
    else if(step.rule==='false-elim')term=`(@False_rect ${goal} ${args[0]})`;
    else if(step.rule==='true-intro')term='I';else term=args[0];
    const name=`s${index}`;lets.push(`let ${name} : ${goal} := ${term} in`);references.set(step.id,name);formulas.set(step.id,step.formula);
  }
  const binders=[...atoms.values()].map(name=>`(${name} : Prop)`).join(' ');
  const hypotheses=ir.assumptions.map(value=>rocqFormula(value.formula,atoms));
  const statement=`forall ${binders}, ${[...hypotheses,rocqFormula(conclusion,atoms)].join(' -> ')}`;
  const theorem='mkg_certificate';
  const sentences=[`Theorem ${theorem} : ${statement}.`,'Proof.',
    `exact (fun ${parameters.join(' ')} => ${lets.length?lets.join(' ')+' ':''}${references.get(ir.conclusion.id)}).`,'Qed.'];
  const sourceText=sentences.join('\n')+'\n';if(sourceText.length>LIMITS.certificate)fail('certificate-size-limit');
  const bindings={atoms:ir.atoms.map((name,index)=>({source:name,generated:`p${index}`})),
    assumptions:ir.assumptions.map((item,index)=>({source:item.id,generated:`h${index}`})),
    steps:ir.steps.map((item,index)=>({source:item.id,generated:`s${index}`}))};
  return {schemaVersion:1,kind:'mkg-constructive-certificate',language:'rocq',theorem,statement,sentences,sourceText,bindings,
    assumptionsInspection:'not-performed'};
}
// Original structured constructive fragment. Local hypotheses are scoped;
// discharged assumptions never become global premises or source assertions.
const STRUCTURED_LANGUAGE='structured-propositional-en-v2';
const STRUCTURED_COMPILER=Object.freeze({id:'mkg-structured-propositional-en',version:2,hashBasis:'compiler-descriptor',artifactSha256:null});
function parseStructuredProof(text){
 try{
  if(typeof text!=='string'||!text.trim()||text.length>LIMITS.source||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))fail('invalid-proof-source');
  const normalized=text.replace(/\r\n?/g,'\n'),lines=normalized.split('\n');if(lines.length>LIMITS.lines)fail('source-line-limit');
  const ir={version:2,language:STRUCTURED_LANGUAGE,coordinateSpace:'codeblock-text',coordinateUnits:'utf16-code-units',atoms:[],declaration:null,assumptions:[],steps:[],conclusion:null};
  let offset=0,atoms;const stack=[ir];
  const rule=(value,line)=>{let match;if((match=/^introducing ([A-Za-z][A-Za-z0-9_-]{0,31})$/.exec(value)))return{rule:'implies-intro',premises:[match[1]]};if((match=/^cases ([A-Za-z][A-Za-z0-9_-]{0,31}) using ([A-Za-z][A-Za-z0-9_-]{0,31}) and ([A-Za-z][A-Za-z0-9_-]{0,31})$/.exec(value)))return{rule:'or-elim',premises:match.slice(1)};return ruleFrom(value,line);};
  for(let index=0;index<lines.length;index++){
   const raw=lines[index],line=raw.trim(),number=index+1,leading=raw.length-raw.trimStart().length;
   const sourceSpan={start:offset,end:offset+raw.length,line:number,column:1};offset+=raw.length+1;if(!line)continue;
   const current=stack.at(-1);if(ir.conclusion)fail('content-after-conclusion',number,1);let match;
   if(!atoms){
    match=/^Let ([A-Z][A-Za-z0-9_]*(?:, *[A-Z][A-Za-z0-9_]*)*) be (?:propositions|a proposition)\.$/.exec(line);if(!match)fail('unsupported-proposition-declaration',number,1);
    ir.atoms=match[1].split(',').map(v=>v.trim());atoms=new Set(ir.atoms);ir.declaration=sourceSpan;
   }else if((match=/^Begin subproof ([A-Za-z][A-Za-z0-9_-]{0,31}) with ([A-Za-z][A-Za-z0-9_-]{0,31}): (.+)\.$/.exec(line))){
    if(stack.length>=9)fail('subproof-depth-limit',number,1);
    const item={kind:'subproof',id:match[1],assumption:{id:match[2],formula:parseFormula(match[3],atoms,number,leading+line.indexOf(':')+3),span:sourceSpan},steps:[],conclusion:null,span:sourceSpan};current.steps.push(item);stack.push(item);
   }else if((match=/^End subproof ([A-Za-z][A-Za-z0-9_-]{0,31}) with ([A-Za-z][A-Za-z0-9_-]{0,31})\.$/.exec(line))){
    if(stack.length===1||current.id!==match[1])fail('mismatched-subproof-end',number,1);current.conclusion={id:match[2],span:sourceSpan};stack.pop();
   }else if((match=/^Assume ([A-Za-z][A-Za-z0-9_-]{0,31}): (.+)\.$/.exec(line))){
    if(stack.length!==1||ir.steps.length)fail('assumption-after-derivation',number,1);
    ir.assumptions.push({id:match[1],formula:parseFormula(match[2],atoms,number,leading+10+match[1].length),span:sourceSpan});
   }else if((match=/^Then ([A-Za-z][A-Za-z0-9_-]{0,31}): (.+) by (.+)\.$/.exec(line))){
    current.steps.push({id:match[1],formula:parseFormula(match[2],atoms,number,leading+8+match[1].length),...rule(match[3],number),span:sourceSpan});
   }else if((match=/^Conclude ([A-Za-z][A-Za-z0-9_-]{0,31})\.$/.exec(line))){
    if(stack.length!==1)fail('unclosed-subproof',number,1);ir.conclusion={id:match[1],span:sourceSpan};
   }else fail('unsupported-proof-line',number,1);
  }
  if(!atoms||!ir.conclusion||stack.length!==1)fail('incomplete-proof');validateStructuredProofIR(ir);
  return{status:'supported',ir,diagnostics:[]};
 }catch(error){const code=error instanceof ProofError?error.code:'';return{status:code.startsWith('unsupported-')?'unsupported':'invalid',ir:null,diagnostics:[diagnostic(error)]};}
}
function validateStructuredProofIR(ir){
 required(ir,['version','language','coordinateSpace','coordinateUnits','atoms','declaration','assumptions','steps','conclusion'],'invalid-proof-ir');
 if(ir.version!==2||ir.language!==STRUCTURED_LANGUAGE||ir.coordinateSpace!=='codeblock-text'||ir.coordinateUnits!=='utf16-code-units')fail('unsupported-proof-ir');
 if(!Array.isArray(ir.atoms)||!ir.atoms.length||ir.atoms.length>LIMITS.atoms||new Set(ir.atoms).size!==ir.atoms.length||ir.atoms.some(v=>typeof v!=='string'||!atomName.test(v)||['true','false','not','and','or','implies'].includes(v.toLowerCase())))fail('invalid-proposition-declaration');
 span(ir.declaration);const atoms=new Set(ir.atoms),ids=new Set(),active=new Set();let count=0;
 const label=id=>{if(!labelName.test(id)||ids.has(id))fail('duplicate-or-invalid-step-label');ids.add(id);};
 if(!Array.isArray(ir.assumptions)||ir.assumptions.length>LIMITS.assumptions)fail('proof-size-limit');const prior=new Map();
 for(const item of ir.assumptions){required(item,['id','formula','span'],'invalid-assumption');label(item.id);span(item.span);formula(item.formula,atoms);prior.set(item.id,item.formula);}
 function scope(steps,inherited,conclusion,depth){
  if(depth>8||!Array.isArray(steps)||active.has(steps))fail('subproof-depth-limit');active.add(steps);const known=new Map(inherited),subproofs=new Set();
  try{for(const item of steps){
   if(++count>LIMITS.steps)fail('proof-size-limit');if(!record(item))fail('invalid-proof-step');label(item.id);span(item.span);
   if(item.kind==='subproof'){
    required(item,['kind','id','assumption','steps','conclusion','span'],'invalid-subproof');required(item.assumption,['id','formula','span'],'invalid-local-assumption');label(item.assumption.id);span(item.assumption.span);formula(item.assumption.formula,atoms);
    if(++count>LIMITS.steps)fail('proof-size-limit');const local=new Map(known);local.set(item.assumption.id,item.assumption.formula);
    const body=scope(item.steps,local,item.conclusion,depth+1);known.set(item.id,{kind:'implies',left:item.assumption.formula,right:body});subproofs.add(item.id);
   }else{
    required(item,['id','formula','rule','premises','span'],'invalid-proof-step');formula(item.formula,atoms);if(!Array.isArray(item.premises))fail('invalid-premises');
    if(item.rule==='implies-intro'){
     if(item.premises.length!==1||!subproofs.has(item.premises[0])||!same(known.get(item.premises[0]),item.formula))fail('rule-does-not-establish-conclusion',item.span.line,1);
    }else if(item.rule==='or-elim'){
     if(item.premises.length!==3||item.premises.some(id=>!labelName.test(id)||!known.has(id)))fail('unknown-or-forward-reference');
     const [choice,left,right]=item.premises.map(id=>known.get(id));
     if(choice.kind!=='or'||left.kind!=='implies'||right.kind!=='implies'||!same(choice.left,left.left)||!same(choice.right,right.left)||!same(left.right,item.formula)||!same(right.right,item.formula))fail('rule-does-not-establish-conclusion',item.span.line,1);
    }else validateStep(item,known);known.set(item.id,item.formula);
   }
  }
  required(conclusion,['id','span'],'invalid-conclusion');span(conclusion.span);if(!labelName.test(conclusion.id)||!known.has(conclusion.id))fail('unknown-conclusion');return known.get(conclusion.id);
  }finally{active.delete(steps);}
 }
 return{conclusion:scope(ir.steps,prior,ir.conclusion,0)};
}
function compileStructuredCertificate(ir){
 const {conclusion}=validateStructuredProofIR(ir),atoms=new Map(ir.atoms.map((name,index)=>[name,`p${index}`])),references=new Map(),formulas=new Map(),bindings={atoms:ir.atoms.map((name,index)=>({source:name,generated:`p${index}`})),assumptions:[],steps:[]};let counter=0;
 const generated=id=>{const name=`s${counter++}`;bindings.steps.push({source:id,generated:name});return name;};
 const parameters=[...atoms.values()].map(name=>`(${name} : Prop)`);
 for(const[index,item]of ir.assumptions.entries()){const name=`h${index}`;parameters.push(`(${name} : ${rocqFormula(item.formula,atoms)})`);references.set(item.id,name);formulas.set(item.id,item.formula);bindings.assumptions.push({source:item.id,generated:name});}
 function scope(steps,parentRefs,parentFormulas,end){
  const refs=new Map(parentRefs),facts=new Map(parentFormulas),lets=[];
  for(const item of steps){
   const name=generated(item.id);let goal,term;
   if(item.kind==='subproof'){
    const local=generated(item.assumption.id),localRefs=new Map(refs),localFacts=new Map(facts);localRefs.set(item.assumption.id,local);localFacts.set(item.assumption.id,item.assumption.formula);
    const body=scope(item.steps,localRefs,localFacts,item.conclusion);goal={kind:'implies',left:item.assumption.formula,right:body.formula};term=`(fun (${local} : ${rocqFormula(item.assumption.formula,atoms)}) => ${body.term})`;
   }else{
    goal=item.formula;const args=item.premises.map(id=>refs.get(id));
    if(item.rule==='implies-elim')term=`(${args[0]} ${args[1]})`;
    else if(item.rule==='and-intro')term=`(@conj ${rocqFormula(goal.left,atoms)} ${rocqFormula(goal.right,atoms)} ${args[0]} ${args[1]})`;
    else if(item.rule==='and-left'||item.rule==='and-right'){const from=facts.get(item.premises[0]);term=`(@${item.rule==='and-left'?'proj1':'proj2'} ${rocqFormula(from.left,atoms)} ${rocqFormula(from.right,atoms)} ${args[0]})`;}
    else if(item.rule==='or-left'||item.rule==='or-right')term=`(@${item.rule==='or-left'?'or_introl':'or_intror'} ${rocqFormula(goal.left,atoms)} ${rocqFormula(goal.right,atoms)} ${args[0]})`;
    else if(item.rule==='false-elim')term=`(@False_rect ${rocqFormula(goal,atoms)} ${args[0]})`;
    else if(item.rule==='true-intro')term='I';
    else if(item.rule==='or-elim'){const choice=facts.get(item.premises[0]);term=`(@or_ind ${rocqFormula(choice.left,atoms)} ${rocqFormula(choice.right,atoms)} ${rocqFormula(goal,atoms)} ${args[1]} ${args[2]} ${args[0]})`;}
    else term=args[0];
   }
   lets.push(`let ${name} : ${rocqFormula(goal,atoms)} := ${term} in`);refs.set(item.id,name);facts.set(item.id,goal);
  }
  return{formula:facts.get(end.id),term:(lets.length?lets.join(' ')+' ':'')+refs.get(end.id)};
 }
 const body=scope(ir.steps,references,formulas,ir.conclusion),statement=`forall ${[...atoms.values()].map(name=>`(${name} : Prop)`).join(' ')}, ${[...ir.assumptions.map(v=>rocqFormula(v.formula,atoms)),rocqFormula(conclusion,atoms)].join(' -> ')}`;
 const theorem='mkg_certificate',sentences=[`Theorem ${theorem} : ${statement}.`,'Proof.',`exact (fun ${parameters.join(' ')} => ${body.term}).`,'Qed.'],sourceText=sentences.join('\n')+'\n';
 if(sourceText.length>LIMITS.certificate)fail('certificate-size-limit');return{schemaVersion:1,kind:'mkg-constructive-certificate',language:'rocq',theorem,statement,sentences,sourceText,bindings,assumptionsInspection:'not-performed'};
}

function contextValue(value) {
  keys(value,['proofId','statementId','source','statementText','statementPrecision','dependencies','toolchain','sourceProposalSha256'],'invalid-candidate-context');
  const proofId=string(value.proofId,4096,'invalid-proof-identity'),statementId=string(value.statementId,4096,'invalid-statement-identity');
  keys(value.source,['path','anchor','fileSha256'],'invalid-source-context');
  const path=string(value.source.path,4096,'invalid-source-path').replaceAll('\\','/');
  if(path.startsWith('/')||/[:?#]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))fail('invalid-source-path');
  const anchor=string(value.source.anchor,512,'invalid-source-anchor');if(/[\s#/?\\]/.test(anchor))fail('invalid-source-anchor');
  const fileSha256=value.source.fileSha256??null;
  if(fileSha256!==null&&(typeof fileSha256!=='string'||!digestPattern.test(fileSha256)))fail('invalid-source-file-hash');
  const statementText=value.statementText??null;
  if(statementText!==null&&(typeof statementText!=='string'||!statementText.trim()||statementText.length>LIMITS.source||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(statementText)))fail('invalid-authored-statement-text');
  const statementPrecision=statementText===null?'not-supplied':'rendered-text';
  if(value.statementPrecision!==undefined&&value.statementPrecision!==statementPrecision)fail('invalid-statement-precision');
  const dependencies=value.dependencies??[];
  if(!Array.isArray(dependencies)||dependencies.length>LIMITS.dependencies)fail('invalid-dependencies');
  const normalized=dependencies.map(item=>{
    required(item,['id','sha256','usage'],'invalid-dependency');const id=string(item.id,4096,'invalid-dependency');
    if(!digestPattern.test(item.sha256)||item.usage!=='context-only')fail('unsupported-dependency-import');
    return {id,sha256:item.sha256,usage:'context-only'};
  }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if(new Set(normalized.map(item=>item.id)).size!==normalized.length)fail('duplicate-dependency');
  const toolchain=value.toolchain??{id:'export-only',version:null,sha256:null};
  required(toolchain,['id','version','sha256'],'invalid-toolchain');string(toolchain.id,256,'invalid-toolchain');
  if(toolchain.version!==null)string(toolchain.version,256,'invalid-toolchain');
  if(toolchain.sha256!==null&&!digestPattern.test(toolchain.sha256))fail('invalid-toolchain');
  if(toolchain.id!=='export-only'&&(toolchain.version===null||toolchain.sha256===null))fail('unpinned-toolchain');
  if(value.sourceProposalSha256!==undefined&&!digestPattern.test(value.sourceProposalSha256))fail('invalid-source-proposal-hash');
  return {proofId,statementId,...(value.sourceProposalSha256===undefined?{}:{sourceProposalSha256:value.sourceProposalSha256}),source:{path,anchor,fileSha256},statementText,
    statementPrecision,dependencies:normalized,toolchain:{...toolchain}};
}
/** No AI or kernel is called. Hashes bind a candidate, not human approval. */
export async function createCandidate(text,context,options={}) {
  const parsed=parseControlledProof(text);
  const base={schemaVersion:1,kind:'mkg-proof-candidate',review:{status:'unreviewed'},kernel:{status:'not-requested'}};
  if(parsed.status!=='supported')return {...base,status:parsed.status,diagnostics:parsed.diagnostics};
  try{
    keys(options,['sourceObservation','compilerArtifacts'],'invalid-candidate-options');
    const normalized=contextValue(context),certificate=compileCertificate(parsed.ir),sourceText=text.replace(/\r\n?/g,'\n'),compiler=parsed.ir.version===2?STRUCTURED_COMPILER:COMPILER;
    const hashes={source:await sha256(sourceText),sourceFile:normalized.source.fileSha256,ir:await sha256(canonical(parsed.ir)),
      statement:await sha256(canonical({atoms:parsed.ir.atoms,assumptions:parsed.ir.assumptions.map(item=>item.formula),conclusion:validateProofIR(parsed.ir).conclusion})),
      authoredStatement:await sha256(canonical({text:normalized.statementText,precision:normalized.statementPrecision})),
      assumptions:await sha256(canonical(parsed.ir.assumptions)),dependencies:await sha256(canonical(normalized.dependencies)),
      compiler:await sha256(canonical(compiler)),certificate:await sha256(canonical(certificate)),toolchain:await sha256(canonical(normalized.toolchain))};
    const source={...normalized.source,text:sourceText,normalization:'LF',coordinateSpace:'codeblock-text',coordinateUnits:'utf16-code-units',sha256:hashes.source};
    const additions={};
    if(options.sourceObservation!==undefined){
      additions.mapping=await buildCandidateMapping(options.sourceObservation,{sourceText,context:normalized,ir:parsed.ir,certificate});
      if(JSON.stringify(additions.mapping).length>1024*1024)fail('candidate-provenance-limit');
      hashes.mapping=await sha256(canonical(additions.mapping));
    }
    if(options.compilerArtifacts!==undefined){
      additions.compilerProvenance=validateCompilerArtifacts(options.compilerArtifacts);
      hashes.compilerArtifacts=await sha256(canonical(additions.compilerProvenance));
    }
    hashes.candidate=await sha256(canonical({schemaVersion:1,kind:base.kind,context:normalized,source,hashes}));
    return {...base,status:'candidate',context:normalized,source,compiler:{...compiler},ir:parsed.ir,certificate,...additions,hashes,diagnostics:[]};
  }catch(error){return {...base,status:'invalid',diagnostics:[diagnostic(error)]};}
}
/** Reparse retained source and recompile; arbitrary submitted sentences and
 * imported review/kernel claims never cross this boundary as trusted input. */
export async function verifyCandidateIntegrity(candidate) {
  try{
    if(!record(candidate)||candidate.status!=='candidate'||typeof candidate.source?.text!=='string')return {valid:false,reason:'not-a-proof-candidate'};
    // Check bounded shapes before canonical comparison of an imported payload.
    // Review/kernel fields are deliberately not evaluated or accepted as proof.
    keys(candidate,['schemaVersion','kind','status','context','source','compiler','ir','certificate','hashes','diagnostics','review','kernel','mapping','compilerProvenance'],'invalid-candidate');
    if(candidate.schemaVersion!==1||candidate.kind!=='mkg-proof-candidate')fail('unsupported-candidate');
    validateProofIR(candidate.ir);
    required(candidate.source,['path','anchor','fileSha256','text','normalization','coordinateSpace','coordinateUnits','sha256'],'invalid-source');
    string(candidate.source.path,4096,'invalid-source');string(candidate.source.anchor,512,'invalid-source');
    if(candidate.source.text.length>LIMITS.source||candidate.source.normalization!=='LF'||candidate.source.coordinateSpace!=='codeblock-text'||
      candidate.source.coordinateUnits!=='utf16-code-units'||typeof candidate.source.sha256!=='string'||!digestPattern.test(candidate.source.sha256)||
      candidate.source.fileSha256!==null&&(typeof candidate.source.fileSha256!=='string'||!digestPattern.test(candidate.source.fileSha256)))fail('invalid-source');
    required(candidate.certificate,['schemaVersion','kind','language','theorem','statement','sentences','sourceText','bindings','assumptionsInspection'],'invalid-certificate');
    if(candidate.certificate.schemaVersion!==1)fail('unsupported-certificate');
    for(const key of ['kind','language','theorem','assumptionsInspection'])string(candidate.certificate[key],128,'invalid-certificate');
    for(const key of ['statement','sourceText'])if(typeof candidate.certificate[key]!=='string'||candidate.certificate[key].length>LIMITS.certificate)fail('invalid-certificate');
    if(!Array.isArray(candidate.certificate.sentences)||candidate.certificate.sentences.length!==4||candidate.certificate.sentences.some(item=>typeof item!=='string'||item.length>LIMITS.certificate))fail('invalid-certificate');
    required(candidate.certificate.bindings,['atoms','assumptions','steps'],'invalid-certificate-bindings');
    for(const [key,maximum] of [['atoms',LIMITS.atoms],['assumptions',LIMITS.assumptions],['steps',LIMITS.steps]]){
      const entries=candidate.certificate.bindings[key];if(!Array.isArray(entries)||entries.length>maximum)fail('invalid-certificate-bindings');
      for(const entry of entries){required(entry,['source','generated'],'invalid-certificate-bindings');string(entry.source,32,'invalid-certificate-bindings');string(entry.generated,32,'invalid-certificate-bindings');}
    }
    required(candidate.compiler,['id','version','hashBasis','artifactSha256'],'invalid-compiler');
    const expectedCompiler=candidate.ir.version===2?STRUCTURED_COMPILER:COMPILER;
    if(Object.keys(expectedCompiler).some(key=>candidate.compiler[key]!==expectedCompiler[key]))fail('unsupported-compiler');
    const mapped=Object.hasOwn(candidate,'mapping'),artifacts=Object.hasOwn(candidate,'compilerProvenance');
    if(mapped&&JSON.stringify(candidate.mapping).length>1024*1024||artifacts&&JSON.stringify(candidate.compilerProvenance).length>8192)fail('candidate-provenance-limit');
    required(candidate.hashes,['source','sourceFile','ir','statement','authoredStatement','assumptions','dependencies','compiler','certificate','toolchain','candidate',...(mapped?['mapping']:[]),...(artifacts?['compilerArtifacts']:[])],'invalid-hashes');
    for(const [key,value] of Object.entries(candidate.hashes))if(!(key==='sourceFile'&&value===null)&&(typeof value!=='string'||!digestPattern.test(value)))fail('invalid-hashes');
    if(!Array.isArray(candidate.diagnostics)||candidate.diagnostics.length)fail('invalid-diagnostics');
    const regenerated=await createCandidate(candidate.source.text,candidate.context,{...(mapped?{sourceObservation:candidate.mapping.original}:{}),...(artifacts?{compilerArtifacts:candidate.compilerProvenance}:{})});
    if(regenerated.status!=='candidate')return {valid:false,reason:'candidate-could-not-be-regenerated'};
    const core=['schemaVersion','kind','status','context','source','compiler','ir','certificate','hashes','diagnostics',...(mapped?['mapping']:[]),...(artifacts?['compilerProvenance']:[])];
    if(core.some(key=>!Object.hasOwn(candidate,key)||!same(candidate[key],regenerated[key])))return {valid:false,reason:'candidate-integrity-mismatch'};
    return {valid:true,candidate:regenerated};
  }catch{return {valid:false,reason:'invalid-candidate-structure'};}
}
function reviewBinding(candidate) {
  return {proofId:candidate.context.proofId,statementId:candidate.context.statementId,
    candidateHash:candidate.hashes.candidate,sourceHash:candidate.hashes.source,sourceFileHash:candidate.hashes.sourceFile,
    authoredStatementHash:candidate.hashes.authoredStatement,statementHash:candidate.hashes.statement,
    assumptionsHash:candidate.hashes.assumptions,dependenciesHash:candidate.hashes.dependencies,
    compilerHash:candidate.hashes.compiler,certificateHash:candidate.hashes.certificate,toolchainHash:candidate.hashes.toolchain,
    ...(Object.hasOwn(candidate.hashes,'mapping')?{sourceMappingHash:candidate.hashes.mapping}:{}),
    ...(Object.hasOwn(candidate.hashes,'compilerArtifacts')?{compilerArtifactsHash:candidate.hashes.compilerArtifacts}:{})};
}
/** An explicitly supplied LOCAL claim about source mapping. It authenticates
 * neither a human nor their judgment, and grants no kernel/publication status. */
export async function recordMappingReview(candidate,{reviewer,accepted}={}) {
  const checked=await verifyCandidateIntegrity(candidate);if(!checked.valid)fail('candidate-integrity-mismatch');
  const name=string(reviewer,256,'invalid-reviewer');if(typeof accepted!=='boolean')fail('explicit-review-decision-required');
  const receipt={version:1,kind:'mkg-source-mapping-review',status:accepted?'accepted':'rejected',reviewer:name,
    authority:'unauthenticated-local-mapping-review',reviewedAt:new Date().toISOString(),...reviewBinding(checked.candidate)};
  return {...receipt,receiptHash:await sha256(canonical(receipt))};
}
/** Integrity/current-candidate check only; `valid` never authenticates review. */
export async function verifyMappingReview(candidate,receipt) {
  try{
    const checked=await verifyCandidateIntegrity(candidate);if(!checked.valid)return {valid:false,reason:'candidate-integrity-mismatch'};
    const binding=reviewBinding(checked.candidate);
    required(receipt,['version','kind','status','reviewer','authority','reviewedAt',...Object.keys(binding),'receiptHash'],'invalid-mapping-review');
    if(receipt.version!==1||receipt.kind!=='mkg-source-mapping-review'||!['accepted','rejected'].includes(receipt.status)||
      receipt.authority!=='unauthenticated-local-mapping-review')fail('invalid-mapping-review');
    string(receipt.reviewer,256,'invalid-reviewer');
    if(typeof receipt.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.reviewedAt)||
      !Number.isFinite(Date.parse(receipt.reviewedAt))||new Date(receipt.reviewedAt).toISOString()!==receipt.reviewedAt)fail('invalid-review-date');
    if(Object.keys(binding).some(key=>receipt[key]!==binding[key]))return {valid:false,reason:'review-belongs-to-different-candidate'};
    const body={...receipt};delete body.receiptHash;
    if(typeof receipt.receiptHash!=='string'||!digestPattern.test(receipt.receiptHash)||await sha256(canonical(body))!==receipt.receiptHash)return {valid:false,reason:'review-integrity-mismatch'};
    return {valid:true,review:JSON.parse(JSON.stringify(receipt)),authority:'unauthenticated-local-mapping-review'};
  }catch{return {valid:false,reason:'invalid-mapping-review'};}
}
