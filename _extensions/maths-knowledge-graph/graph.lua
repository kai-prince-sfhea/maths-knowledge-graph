-- Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
-- Original MKG projection to the separately installed KG producer protocol.
-- Uses the existing coordinator/renderer. No embedded extension or inference.
local M={}
function M.options(value,ctx)
  if value==false then return nil end
  local result={id='maths',label='Mathematics',navigation=true,search=true,placement='append'}
  if value~=nil and value~=true then
    value=ctx.mapping(value,'graph')
    for key,entry in pairs(value) do
      if key=='navigation' or key=='search' then result[key]=ctx.boolean(entry,true,'graph.'..key)
      elseif key=='id' or key=='label' or key=='placement' then result[key]=ctx.nonblank(entry,'graph.'..key)
      else ctx.fail('graph contains an unknown option') end
    end
  end
  if #result.id>64 or not result.id:match('^[a-z][a-z0-9%-]*$') or result.id=='website' or result.id=='constructor' or result.id=='prototype' then ctx.fail('graph.id requires a separate lowercase graph name') end
  if #result.label>256 then ctx.fail('graph.label exceeds 256 UTF-8 bytes') end
  if result.placement~='append' and result.placement~='placeholder' then ctx.fail('graph.placement requires append or placeholder') end
  if result.placement=='placeholder' and not result.navigation then ctx.fail('graph placeholder requires navigation: true') end
  return result
end
local function withheld(el)
  local a=el.attributes or {}
  return el.classes and (el.classes:includes('private') or el.classes:includes('hidden') or el.classes:includes('content-hidden') or el.classes:includes('content-visible'))
    or a.hidden~=nil or a['aria-hidden']=='true' or a['data-private']=='true' or a.public=='false' or a['am-public']=='false'
    or a['when-format']~=nil or a['unless-format']~=nil or a['when-profile']~=nil or a['unless-profile']~=nil or a['when-meta']~=nil or a['unless-meta']~=nil
end
M.withheld=withheld
function M.visible_anchors(doc)
  local anchors={}
  local function collect(el)
    if withheld(el) then return el,false end
    if el.identifier and el.identifier~='' then anchors[el.identifier]=true end
  end
  doc.blocks:walk({traverse='topdown',Div=collect,Span=collect,Header=collect,Code=collect,CodeBlock=collect,Link=collect,Image=collect,Figure=collect,Table=collect})
  return anchors
end
local function escape(value)return value:gsub('&','&amp;'):gsub('"','&quot;'):gsub('<','&lt;'):gsub('>','&gt;')end
local function io_path(value)
  -- The same native extended Windows spelling used by the existing CV bridge;
  -- the actual run is independently confined/validated before any data use.
  if package.config:sub(1,1)=='\\' and not value:match('^\\\\%?\\') then value=value:gsub('/','\\');if value:match('^\\\\')then return '\\\\?\\UNC\\'..value:sub(3)end;return '\\\\?\\'..value end
  return value
end
function M.apply(doc,ctx)
  local options,placeholders=M.options(ctx.options,ctx),{}
  local function find(el)
    if el.classes:includes('maths-graph') then
      if #el.content~=0 then ctx.fail('maths-graph must be an empty page-level Div') end
      placeholders[#placeholders+1]=el
    elseif el.identifier:match('^(def)%-') or el.identifier:match('^thm%-') or el.identifier:match('^lem%-') or el.identifier:match('^cor%-') or el.identifier:match('^prp%-') or el.identifier:match('^cnj%-') or el.identifier:match('^prf%-') or el.identifier:match('^exm%-') or el.identifier:match('^exr%-') then
      el.content:walk({Div=function(child)if child.classes:includes('maths-graph') then ctx.fail('place maths-graph outside mathematical statement/definition/proof Divs')end end})
    end
  end
  doc.blocks:walk({Div=find})
  if #placeholders>1 then ctx.fail('use at most one maths-graph placeholder per page') end
  if #placeholders>0 and (not options or options.placement~='placeholder') then ctx.fail('an authored maths-graph placeholder requires graph.placement: placeholder') end
  if options and options.placement=='placeholder' and #placeholders~=1 then ctx.fail('graph.placement: placeholder requires one empty maths-graph Div') end
  if not options then return doc end
  local html=FORMAT=='html' or FORMAT=='html5'
  local published=false
  if html and quarto.project.directory and #ctx.current>0 then
    local settings=doc.meta['knowledge-graph']
    if settings~=false and not(type(settings)=='table' and settings.enabled==false) then
      local pointer=io.open(io_path(pandoc.path.join({ctx.root,'.quarto','knowledge-graph','run.json'})),'rb')
      if pointer then
        pointer:close()
        local visible,records,relations,included=M.visible_anchors(doc),pandoc.List(),pandoc.List(),{}
        for _,object in ipairs(ctx.current) do if object.public and visible[object.source.anchor] then
          local review=object.am and object.field=='Accessible Maths current-AST import' and 'author-reviewed' or 'declared'
          local qualification={basis=object.am and 'current-native-AST-AM-and-explicit-MKG-publication' or 'explicit-MKG-publication',mathKind=object.kind,rights='not-established',mathematicalCorrectness='not-established',proofStatus=object.proofStatus}
          if object.am then qualification.amReview=object.am.review;qualification.lexicalScope=object.am.lexicalScope;qualification.declarationSha256=object.am.declarationSha256 end
          records:insert({id=object.id,type=object.kind,scope=object.scope,label=object.label,anchor=object.source.anchor,review=review,qualification=pandoc.json.encode(qualification)})
          included[object.id]=true
        end end
        for _,relation in ipairs(ctx.links) do if included[relation.from.id] and included[relation.to.id] and relation.source.path==ctx.source and visible[relation.source.anchor] then
          relations:insert({id=relation.id,type=relation.kind,from=relation.from.id,to=relation.to.id,scope=relation.scope or relation.from.scope,anchor=relation.source.anchor})
        end end
        if #records>0 then
          local output=ctx.nonblank(quarto.doc.output_file,'graph native output'):gsub('\\','/')
          if not pandoc.path.is_absolute(output) then output=pandoc.path.join({pandoc.path.directory(ctx.input),output}) end
          output=pandoc.path.make_relative(output,ctx.root):gsub('\\','/')
          local dependencies=pandoc.List();for filename,observed in pairs(ctx.dependencies) do dependencies:insert({path=filename,sha256=observed.sha256}) end
          local request={version=1,root=ctx.root,projection={graph={id=options.id,label=options.label,navigation=options.navigation,search=options.search},source=ctx.source,output=output,language=ctx.language,objects=records,relations=relations,dependencyDigests=dependencies,amApiPath=ctx.amApiPath}}
          local raw=pandoc.json.encode(request);if #raw>4194304 then ctx.fail('public maths graph exceeds its 4 MiB bound; narrow selected scopes') end
          local ok,response=pcall(pandoc.pipe,os.getenv('QUARTO_BIN') or 'quarto',{'run',pandoc.path.join({ctx.runtimePath,'graph-publish.ts'})},raw)
          if not ok then ctx.fail('cannot publish current public mathematics to the prepared KG run; inspect ordinary confined source dependencies') end
          local result=pandoc.json.decode(response);if type(result)~='table' or result.version~=1 then ctx.fail('graph producer helper returned incompatible data') end
          published=result.status=='published'
        end
      end
    end
  end
  local function content()
    if published then return pandoc.List({pandoc.RawBlock('html','<div data-kg-graph="'..escape(options.id)..'" data-kg-producer-placeholder="1"><p>Graph navigation is prepared after the project finishes rendering. The native mathematical content remains available.</p></div>')}) end
    return pandoc.List({pandoc.Para({pandoc.Str(html and 'The mathematical graph is unavailable here. Select the separately installed Knowledge Graph Extraction extension and render its project to prepare navigation; the native mathematical content remains available.' or 'Interactive graph navigation is available in HTML with Knowledge Graph Extraction. The native mathematical content remains available in this format.')})})
  end
  if options.navigation then
    if options.placement=='placeholder' then doc.blocks=doc.blocks:walk({Div=function(el)if el.classes:includes('maths-graph')then el.content=content();return el end end})
    elseif published then doc.blocks:insert(pandoc.Div(content(),pandoc.Attr('',{'maths-graph'}))) end
    if published then quarto.doc.add_html_dependency({name='maths-knowledge-graph-navigation',version='0.0.9',stylesheets={'maths-graph.css'}}) end
  end
  return doc
end
return M
