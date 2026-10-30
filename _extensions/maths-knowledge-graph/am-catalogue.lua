-- Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
-- Consumer of the separately installed AM current-native-AST API. No embedding.
local M={version=1}
local function run(ctx,request)
  local ok,raw=pcall(pandoc.pipe,os.getenv('QUARTO_BIN') or 'quarto',{'run',pandoc.path.join({ctx.runtimePath,'am-catalogue.ts'})},pandoc.json.encode(request))
  if not ok then ctx.fail('Accessible Maths import refused incompatible, changed, unsafe or unconfined current declarations') end
  local success,result=pcall(pandoc.json.decode,raw)
  if not success or type(result)~='table' or result.version~=1 then ctx.fail('Accessible Maths import helper returned incompatible data') end
  return result
end
function M.prepare(doc,ctx)
  if ctx.enabled==false then return {status='disabled',reason='consumer-opt-out'} end
  local options=doc.meta['accessible-maths']
  if not options or options.enabled==false or options.catalogue~=true then
    return {status='disabled',reason='producer-not-opted-in'}
  end
  local candidates,seen={},{}
  local function add(path)
    path=path:gsub('\\','/')
    if not seen[path] and not path:match('^%.%./') and not pandoc.path.is_absolute(path) and not path:find(':',1,true) then candidates[#candidates+1]=path;seen[path]=true end
  end
  add(pandoc.path.make_relative(pandoc.path.join({pandoc.path.directory(ctx.runtimePath),'accessible-maths'}),ctx.root))
  add('_extensions/accessible-maths');add('_extensions/kai-prince-sfhea/accessible-maths')
  local result=run(ctx,{version=1,operation='locate',root=ctx.root,candidates=candidates})
  if result.status~='available' then return {status='unavailable',reason=result.reason or 'incompatible-producer',intent=true} end
  local api=dofile(pandoc.path.join({ctx.root,result.path,'catalogue-api.lua'}))
  if type(api)~='table' or api.version~=1 or type(api.capture)~='function' then ctx.fail('Accessible Maths current-AST API is incompatible') end
  return {status='available',api=api,path=result.path,payloadSha256=result.payloadSha256,intent=true}
end
local function anchor_list(doc,ctx)
  local values,seen={},{}
  local function collect(el)
    if el.identifier and el.identifier~='' then
      if seen[el.identifier] then ctx.fail('duplicate native identifier in the containing document') end
      seen[el.identifier]=true;values[#values+1]=el.identifier
    end
  end
  doc.blocks:walk({Div=collect,Span=collect,Header=collect,Code=collect,CodeBlock=collect,Link=collect,Image=collect,Table=collect,Figure=collect})
  table.sort(values);return values
end
function M.capture(doc,state,ctx)
  if state.status~='available' then return {version=1,status=state.status,reason=state.reason,records={}} end
  local packet=state.api.capture(doc)
  if type(packet)~='table' or packet.version~=1 or packet.kind~='accessible-maths-catalogue' then ctx.fail('Accessible Maths current-AST API returned an incompatible packet') end
  if packet.status=='empty' then
    if not packet.source or packet.source.document~=ctx.source or packet.source.precision~='containing-document' or #packet.records~=0 then ctx.fail('Accessible Maths empty packet does not match the current containing source') end
    return {version=1,status='empty',source=packet.source,records={},producerPayloadSha256=state.payloadSha256}
  end
  if packet.status~='complete' then ctx.fail('Accessible Maths catalogue became disabled during current-AST import') end
  local anchors=anchor_list(doc,ctx)
  local key=pandoc.json.encode({packet=packet,anchors=anchors})
  if state.validatedKey==key then
    local checked=pandoc.json.decode(state.validatedPacket);checked.producerPayloadSha256=state.payloadSha256;return checked
  end
  local result=run(ctx,{version=1,operation='validate',root=ctx.root,source=ctx.source,anchors=anchors,packet=packet})
  if result.status~='validated' or type(result.packet)~='table' then ctx.fail('Accessible Maths current source validation failed') end
  state.validatedKey=key;state.validatedPacket=pandoc.json.encode(result.packet)
  local checked=result.packet;checked.producerPayloadSha256=state.payloadSha256;return checked
end
function M.consistent(before,after,ctx)
  if before.status~=after.status or #before.records~=#after.records then ctx.fail('Accessible Maths declarations changed during mathematical projection') end
  for index,entry in ipairs(before.records) do
    local other=after.records[index]
    for _,key in ipairs({'id','type','label','anchor','scope','review','public'}) do if entry[key]~=other[key] then ctx.fail('Accessible Maths declaration identity or policy changed during mathematical projection') end end
    if entry.lexicalScope.kind~=other.lexicalScope.kind or entry.lexicalScope.anchor~=other.lexicalScope.anchor then ctx.fail('Accessible Maths lexical scope changed during mathematical projection') end
    -- Source bodies may acquire native notation/theorem controls. The final
    -- current-AST capture, not the preliminary body hash, is the receipt.
    local function notation_key(n)
      if not n then return '' end
      local pieces={n.command,n.intent,n.visualTeX}
      for _,p in ipairs(n.signature.parameters) do pieces[#pieces+1]=p.role;pieces[#pieces+1]=p.kind;pieces[#pieces+1]=p.defaultTeX or '' end
      return table.concat(pieces,'\n')
    end
    if notation_key(entry.notation)~=notation_key(other.notation) then ctx.fail('Accessible Maths notation changed during mathematical projection') end
  end
end
function M.attach(doc,packet,ctx)
  if doc.meta['maths-accessible-maths-import']~=nil then ctx.fail('reserved maths-accessible-maths-import metadata conflicts with authored content') end
  local function reserved(el)
    if el.identifier=='maths-accessible-maths-import' then ctx.fail('reserved maths-accessible-maths-import identifier conflicts with authored content') end
  end
  local function raw(el)
    if (el.format=='html' or el.format=='html5') and el.text:find('maths-accessible-maths-import',1,true) then ctx.fail('reserved maths-accessible-maths-import marker conflicts with authored raw HTML') end
  end
  doc.blocks:walk({Div=reserved,Span=reserved,Header=reserved,Code=reserved,CodeBlock=reserved,Link=reserved,Image=reserved,Table=reserved,Figure=reserved,RawBlock=raw,RawInline=raw})
  local entries={};for _,entry in ipairs(packet.records) do entries[#entries+1]=pandoc.json.encode(entry) end
  local envelope={version=1,kind='maths-accessible-maths-import',status=packet.status,reason=packet.reason,source=packet.source,producer=packet.producer,
    declarationsSha256=packet.declarationsSha256,producerPayloadSha256=packet.producerPayloadSha256}
  local selected={};for _,id in ipairs(packet.selectedIds or {}) do selected[#selected+1]=pandoc.json.encode(id) end
  local raw=pandoc.json.encode(envelope);raw=raw:sub(1,-2)..',"records":['..table.concat(entries,',')..'],"selectedIds":['..table.concat(selected,',')..']}'
  doc.meta['maths-accessible-maths-import']=pandoc.MetaString(raw)
  if FORMAT=='html' or FORMAT=='html5' then doc.blocks:insert(pandoc.RawBlock('html','<script type="application/json" id="maths-accessible-maths-import">'..raw:gsub('<','\\u003c')..'</script>')) end
  return doc
end
return M
