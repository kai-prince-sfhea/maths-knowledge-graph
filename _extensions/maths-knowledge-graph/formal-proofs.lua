-- Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
-- Explicit controlled fragments; preserve authored proof and ordinary formats.
local M={}
local function fragment(value)
  return value and value:match('^#([^%s#/?\\]+)$')
end
function M.apply(doc,ctx)
  local config=ctx.mapping(ctx.options,'formal-proofs')
  for key in pairs(config)do if key~='enabled' and key~='kernel-host' and key~='timeout' then ctx.fail('formal-proofs contains an unknown option') end end
  local enabled=ctx.boolean(config.enabled,false,'formal-proofs.enabled')
  local host=config['kernel-host'] and ctx.nonblank(config['kernel-host'],'formal-proofs.kernel-host') or nil
  if host and (not host:match('^https://[^/%s]+/[^%s]*$') and not host:match('^http://localhost[:/]') and not host:match('^http://127%.0%.0%.1[:/]')) then
    ctx.fail('formal-proofs.kernel-host requires an HTTPS host page or HTTP loopback test page')
  end
  if host and (host:find('[?#@\\]') or host:find('%c')) then ctx.fail('formal-proofs.kernel-host must not include credentials, a query or fragment') end
  local timeout=90
  if config.timeout~=nil then local raw=ctx.text(config.timeout);if not raw:match('^%d+$')then ctx.fail('formal-proofs.timeout requires an integer between 15 and 120 seconds')end;timeout=tonumber(raw)end
  if timeout<15 or timeout>120 then ctx.fail('formal-proofs.timeout requires an integer between 15 and 120 seconds') end
  if not enabled then return doc end
  local html=quarto.doc.is_format('html:js') and quarto.doc.has_bootstrap()
  local count,used=0,false
  local visible=ctx.visible and ctx.visible() or {}
  local function proof_code(block,label,proof_id,statement_id)
    if html then
      -- Native HTML attributes keep horizontal code scrolling available even
      -- without the optional reader UI or automatic browser focus behavior.
      block.classes:insert('mkg-proof-code')
      block.attributes.tabindex='0'
      block.attributes.role='region'
      block.attributes['aria-label']=label..' for '..statement_id..' ('..proof_id..')'
      used=true
    end
    return block
  end
  local function contains_withheld(blocks)
    local found=false
    local function inspect(el)if ctx.withheld and ctx.withheld(el)then found=true;return el,false end end
    blocks:walk({traverse='topdown',Div=inspect,Span=inspect,Header=inspect,Code=inspect,CodeBlock=inspect,Link=inspect,Image=inspect,Figure=inspect,Table=inspect})
    return found
  end
  local script=pandoc.path.join({ctx.runtimePath,'proof-build.ts'})
  local function formal(el)
    if not el.classes:includes('maths-formal-proof')then return nil end
    -- This derived export requires a visible native proof and target. Retain
    -- authored content without publishing a candidate from private/hidden or
    -- conditional ancestry, even when that condition currently renders.
    if not visible[el.identifier] then return nil end
    count=count+1;if count>32 then ctx.fail('formal-proofs supports at most 32 explicit fragments per document') end
    if el.identifier=='' or not el.identifier:match('^prf%-')then ctx.fail('maths-formal-proof requires a native prf- identifier')end
    local target
    for _,name in ipairs({'formal-target','proof-for','am-theorem'})do
      local raw=el.attributes[name]
      if raw then local value=fragment(raw)or(raw:match('^[^%s#/?\\]+$')and raw)
        if not value or target and target~=value then ctx.fail('formal proof targets conflict; use one native statement association')end;target=value
      end
    end
    local statement=target and ctx.anchors[target]
    if statement and not visible[target] then return nil end
    if not statement or statement.t~='Div' or not target:match('^(thm)%-') and not target:match('^lem%-') and not target:match('^prp%-') and not target:match('^cor%-') then
      ctx.fail('formal proof needs an existing theorem, lemma, proposition or corollary target on this page')
    end
    if contains_withheld(el.content) or contains_withheld(statement.content) then return nil end
    local texts={};el.content:walk({CodeBlock=function(block)if block.classes:includes('maths-proof')then texts[#texts+1]=block.text end end})
    local proposal_path=el.attributes['proof-proposal']
    if proposal_path then
      if #texts~=0 then ctx.fail('proof-proposal imports ordinary prose; remove the maths-proof fence or remove proof-proposal') end
      proposal_path=ctx.nonblank(proposal_path,'proof-proposal')
      local base=ctx.source:match('^(.*)/[^/]+$');proposal_path=base and(base..'/'..proposal_path)or proposal_path
    elseif #texts~=1 then ctx.fail('maths-formal-proof requires one maths-proof fence or an explicit proof-proposal JSON import')end
    local profile=el.attributes['formal-profile'] and ctx.nonblank(el.attributes['formal-profile'],'formal-profile') or 'controlled-propositional'
    if profile~='controlled-propositional' and profile~='typed-fol-eq-v1' and profile~='typed-nat-induction-v1' then ctx.fail('formal-profile must be controlled-propositional, typed-fol-eq-v1 or typed-nat-induction-v1')end
    local request={version=1,text=proposal_path and '' or texts[1],proposalPath=proposal_path,profile=profile,kernel=host~=nil,sourceRoot=ctx.root,context={proofId=el.identifier,statementId=target,
      source={path=ctx.source,anchor=el.identifier,fileSha256=ctx.sourceHash()},statementText=pandoc.utils.stringify(statement.content),dependencies=pandoc.List()}}
    local request_raw=pandoc.json.encode(request)
    if #request_raw>2097152 then ctx.fail('selected proof and native context exceed the 2 MiB request limit; narrow the selected fragment') end
    local ok,response=pcall(pandoc.pipe,os.getenv('QUARTO_BIN')or'quarto',{'run',script},request_raw)
    if not ok then ctx.fail('cannot prepare selected proof candidate; reinstall the complete extension and use the documented bounded proof format')end
    local candidate;ok,candidate=pcall(pandoc.json.decode,response)
    if not ok or type(candidate)~='table' or candidate.kind~='mkg-proof-candidate' then ctx.fail('formal proof helper returned incompatible data')end
    local prose_proposal=candidate.proseProposal;candidate.proseProposal=nil
    el.content=el.content:walk({CodeBlock=function(block)
      if block.classes:includes('maths-proof')then
        return proof_code(block,'Authored controlled proof source',el.identifier,target)
      end
    end})
    el.content:insert(pandoc.Para({pandoc.Str(prose_proposal and 'Formalisation: an author-declared reviewed public projection of an AI-assisted encoding. Its complete selected public source and controlled encoding remain separately reviewable; the private response and named review receipt are not published. Review authenticity and semantic fidelity are not established.' or 'Formalisation: a proposed encoding of the selected controlled fragment. Source-mapping review and proof-kernel checking are separate from the original mathematical claim.')}))
    if candidate.status=='candidate' then
      el.content:insert(pandoc.Para({pandoc.Str('Generated closed Rocq certificate (unreviewed mapping; kernel not requested):')}))
      if html then el.content:insert(pandoc.RawBlock('html','<details class="mkg-certificate"><summary>Inspect the generated certificate and encoding names</summary><div class="mkg-certificate-body">')) end
      el.content:insert(proof_code(pandoc.CodeBlock(candidate.certificate.sourceText,pandoc.Attr('',{'coq'})),'Generated Rocq certificate',el.identifier,target))
      if candidate.certificate.bindings then
        local bindings=pandoc.List()
        for _,group in ipairs({'atoms','sorts','functions','predicates','binders','witnesses','assumptions','steps','induction'})do for _,entry in ipairs(candidate.certificate.bindings[group]or{})do
          bindings:insert({{pandoc.Code(entry.source)},{pandoc.Plain({pandoc.Code(entry.generated)})}})
        end end
        el.content:insert(pandoc.Div({pandoc.Para({pandoc.Str('Encoding names (authored name followed by its generated certificate name):')}),pandoc.DefinitionList(bindings)},pandoc.Attr('',{'mkg-encoding-names'})))
      end
      if html then
        el.content:insert(pandoc.RawBlock('html','</div></details>'))
        local payload={version=1,candidate=candidate,timeoutMs=timeout*1000,hostUrl=host,proseProposal=prose_proposal}
        local encoded=pandoc.json.encode(payload):gsub('<','\\u003c'):gsub('>','\\u003e'):gsub('&','\\u0026')
        el.content:insert(pandoc.RawBlock('html','<script type="application/json" class="mkg-proof-data">'..encoded..'</script>'))
        used=true
      end
    else
      el.content:insert(pandoc.Para({pandoc.Str('This fragment is outside the supported controlled proof language or has an invalid inference. Its authored text is retained; no certificate or verification is claimed.')}))
    end
    return el
  end
  doc.blocks=doc.blocks:walk({Div=formal})
  if used then quarto.doc.add_html_dependency({name='maths-knowledge-graph-proofs',version='0.0.10',
    scripts={{path='proof-ui.js',attribs={type='module'}}},stylesheets={'proof-ui.css'},
    resources={'proof-ui-context.js','proof-candidate.js','proof-mapping.js','proof-profiles.js','proof-typed.js','proof-proposal.js','proof-clause-plan.js','proof-plan-search.js','kernel-adapter.js','kernel-inspector.js','kernel-host.html','kernel-host.js'}})end
  return doc
end
return M
