-- Copyright 2026 Kai Prince
-- SPDX-License-Identifier: Apache-2.0
-- Author-approved, finite notation alternatives. No equivalence inference.
local M = {}

local function includes(el, name) return el.classes and el.classes:includes(name) end
local function strict(value, allowed, field, ctx)
  value = ctx.mapping(value, field)
  for key in pairs(value) do if not allowed[key] then ctx.fail(field .. ' contains an unsupported field') end end
  return value
end
local function key(value, field, ctx)
  value = ctx.nonblank(value, field)
  if #value > 64 or not value:match('^[a-z][a-z0-9%-]*$') then ctx.fail(field .. ' must be a lowercase local key of at most 64 characters') end
  return value
end
local function literal(value, limit, field, ctx)
  if type(value) ~= 'string' or #value > limit or value:match('^%s*$') or value:find('%c') then
    ctx.fail(field .. ' requires bounded literal single-line text')
  end
  return value
end
local symbols = {
  alpha=true,beta=true,gamma=true,delta=true,epsilon=true,varepsilon=true,zeta=true,eta=true,theta=true,vartheta=true,
  iota=true,kappa=true,lambda=true,mu=true,nu=true,xi=true,pi=true,varpi=true,rho=true,varrho=true,sigma=true,
  varsigma=true,tau=true,upsilon=true,phi=true,varphi=true,chi=true,psi=true,omega=true,
  Gamma=true,Delta=true,Theta=true,Lambda=true,Xi=true,Pi=true,Sigma=true,Upsilon=true,Phi=true,Psi=true,Omega=true,
}
local operators = {circ=true,cdot=true,times=true,oplus=true,otimes=true,ast=true,star=true,bullet=true,diamond=true,
  wedge=true,vee=true,land=true,lor=true,cap=true,cup=true,setminus=true,smallsetminus=true,backslash=true,
  to=true,mapsto=true,rightarrow=true,leftarrow=true,leftrightarrow=true,Rightarrow=true,Leftrightarrow=true,
  le=true,leq=true,ge=true,geq=true,ne=true,neq=true,equiv=true,sim=true,simeq=true,approx=true,cong=true,
  ['in']=true,notin=true,subset=true,subseteq=true,supset=true,supseteq=true,pm=true,mp=true,div=true,
  frac=true,sqrt=true}
local grouping = {left=true,right=true,langle=true,rangle=true,lvert=true,rvert=true,lVert=true,rVert=true,
  vert=true,Vert=true,mathbin=true,mathrel=true,mathopen=true,mathclose=true}

local function atom(value, ctx)
  value = literal(value, 80, 'notation argument', ctx)
  -- Only a free atom with an optional literal subscript is admitted. An
  -- expression, macro, binder or control sequence cannot enter through a role.
  local base, suffix
  if value:sub(1,1) == '\\' then base, suffix = value:match('^\\([A-Za-z]+)(.*)$')
    if not base or not symbols[base] then ctx.fail('notation arguments support only a single Latin or documented Greek symbol') end
  else base, suffix = value:match('^([A-Za-z])(.*)$') end
  if not base or (suffix ~= '' and not suffix:match('^_[A-Za-z0-9]$') and not suffix:match('^_{[A-Za-z0-9]+}$')) then
    ctx.fail('notation arguments must be a free single symbol with an optional alphanumeric subscript')
  end
  if suffix and #suffix > 20 then ctx.fail('notation argument subscript exceeds the supported bound') end
  return value
end

local function template(value, roles, expected, ctx)
  value = literal(value, 1024, 'notation variant tex', ctx)
  local used, order, stripped = {}, {}, value
  stripped = stripped:gsub('{{([a-z][a-z0-9%-]*)}}', function(role)
    if not roles[role] or used[role] then ctx.fail('notation templates must preserve each declared role exactly once') end
    used[role] = true; order[#order+1] = role; return '0'
  end)
  for role in pairs(roles) do if not used[role] then ctx.fail('notation templates must preserve each declared role exactly once') end end
  local signature = table.concat(order, '|')
  if expected and signature ~= expected then ctx.fail('notation variants must preserve the same declared role order') end
  local operations = 0
  stripped = stripped:gsub('\\operatorname{([A-Za-z][A-Za-z0-9 %-]*)}', function(name)
    if #name > 64 then ctx.fail('notation named operators exceed the supported bound') end
    operations = operations + 1; return ''
  end)
  stripped = stripped:gsub('\\([A-Za-z]+)', function(command)
    if operators[command] then operations = operations + 1
    elseif not grouping[command] then ctx.fail('notation templates contain an unsupported or binding TeX command') end
    return ''
  end)
  -- No free variable is allowed outside a role. Binders, declarations, active
  -- TeX and arbitrary text commands are deliberately outside this finite profile.
  if stripped:find('[A-Za-z\\$%%#&~]') or stripped:find('[^%d%s{}()%[%]|,.;:+*/=<>!%^_%-]') then
    ctx.fail('notation templates support only role placeholders, nonbinding operators and grouping')
  end
  local depth = 0
  for char in stripped:gmatch('.') do
    if char == '{' then depth = depth + 1 elseif char == '}' then depth = depth - 1 end
    if depth < 0 then ctx.fail('notation template has unmatched braces') end
  end
  if depth ~= 0 then ctx.fail('notation template has unmatched braces') end
  for _ in stripped:gmatch('[+*/=<>!%^_%-]') do operations = operations + 1 end
  return value, signature, operations
end
local function expand(value, args) return (value:gsub('{{([a-z][a-z0-9%-]*)}}', function(role) return args[role] end)) end

function M.apply(doc, ctx)
  local used_authoring = ctx.used_authoring
  if used_authoring == nil then
    used_authoring = false
    doc.blocks:walk({Span=function(el) if includes(el, 'maths-notation') then used_authoring = true end end,
      Div=function(el) if includes(el, 'maths-notation-glossary') then used_authoring = true end end})
  end
  if ctx.data == nil then
    if ctx.page_defaults ~= nil or ctx.page_overrides ~= nil or ctx.preferences ~= nil then
      ctx.fail('notation defaults, overrides and preferences require a notation registry')
    end
    if used_authoring then ctx.fail('notation authoring requires the notation registry option and a literal YAML or JSON registry') end
    return doc
  end
  local registry = strict(ctx.data, {version=true,profiles=true}, 'notation registry', ctx)
  if type(registry.version) ~= 'number' or registry.version ~= 1 then ctx.fail('notation registry version must be numeric 1') end
  if registry.profiles == nil then ctx.fail('notation registry requires a profiles sequence') end
  if type(ctx.token) ~= 'string' or #ctx.token ~= 40 or not ctx.token:match('^[0-9a-f]+$') then ctx.fail('notation registry requires a stable SHA1 content token') end
  local profiles, ordered = {}, {}
  local records = ctx.sequence(registry.profiles, 'notation profiles')
  if #records > 128 then ctx.fail('notation registry exceeds the 128-profile bound') end
  for _, value in ipairs(records) do
    value = strict(value, {id=true,concept=true,scope=true,roles=true,default=true,variants=true}, 'notation profile', ctx)
    local scope = literal(value.scope, 256, 'notation profile scope', ctx)
    if not ctx.scopes or ctx.scopes[scope] then
    local id = key(value.id, 'notation profile id', ctx)
    if profiles[id] then ctx.fail('notation profiles must have unique local keys') end
    local concept = ctx.identity(value.concept, 'notation concept')
    local object = ctx.objects[concept]
    if not object or not object.public or (object.category ~= 'concept' and object.kind ~= 'concept') then
      ctx.fail('notation profiles require an explicitly public concept in the declarations')
    end
    if scope ~= object.scope then ctx.fail('notation profile scope must match its declared concept scope') end
    local role_list = ctx.sequence(value.roles, 'notation roles')
    if #role_list < 1 or #role_list > 4 then ctx.fail('notation profiles require between one and four roles') end
    local roles = {}
    for _, role in ipairs(role_list) do
      role = key(role, 'notation role', ctx)
      if roles[role] then ctx.fail('notation roles must be unique') end
      roles[role] = true
    end
    local selected = key(value.default, 'notation default', ctx)
    local variants, by_id, signature, operations = {}, {}, table.concat(role_list, '|'), nil
    local variant_list = ctx.sequence(value.variants, 'notation variants')
    if #variant_list < 1 or #variant_list > 12 then ctx.fail('notation profiles require between one and twelve variants') end
    for _, variant in ipairs(variant_list) do
      variant = strict(variant, {id=true,label=true,tex=true,description=true}, 'notation variant', ctx)
      local variant_id = key(variant.id, 'notation variant id', ctx)
      if by_id[variant_id] then ctx.fail('notation variants must have unique keys within each profile') end
      local tex, found, count = template(variant.tex, roles, signature, ctx)
      signature = signature or found
      if operations ~= nil and count ~= operations then ctx.fail('notation variants must preserve the number of explicit operation tokens') end
      operations = count
      local record = {id=variant_id, label=literal(variant.label,120,'notation variant label',ctx), tex=tex,
        description=literal(variant.description,512,'notation variant description',ctx)}
      variants[#variants+1] = record; by_id[variant_id] = record
    end
    if not by_id[selected] then ctx.fail('notation default must name one of its declared variants') end
    local profile = {id=id,concept=concept,scope=scope,roles=role_list,variants=variants,by_id=by_id,default=selected,object=object}
    profiles[id] = profile; ordered[#ordered+1] = profile
    end
  end
  local function selections(value, field)
    local result = {}
    if value == nil then return result end
    value = ctx.mapping(value, field)
    for id, variant in pairs(value) do
      id = key(id, field .. ' profile', ctx)
      local profile = profiles[id]
      if not profile then ctx.fail(field .. ' requires a public profile in the selected notation registry') end
      variant = key(variant, field .. ' variant', ctx)
      if not profile.by_id[variant] then ctx.fail(field .. ' requires a declared variant of that profile') end
      result[id] = variant
    end
    return result
  end
  local page_defaults = selections(ctx.page_defaults, 'notation-defaults')
  local page_overrides = selections(ctx.page_overrides, 'notation-overrides')
  local preferences = {}
  if ctx.preferences ~= nil then
    if ctx.preferences_validated ~= true then
      ctx.fail('notation preferences require bounded duplicate-key-checked JSON from the confined reader')
    end
    local saved = strict(ctx.preferences, {version=true,token=true,enabled=true,choices=true}, 'notation preferences', ctx)
    if type(saved.version) ~= 'number' or saved.version ~= 1 or saved.token ~= ctx.token or type(saved.enabled) ~= 'boolean' then
      ctx.fail('notation preferences are invalid or stale; export choices from the current notation registry')
    end
    if saved.choices == nil then ctx.fail('notation preferences require a choices sequence') end
    local choices = ctx.sequence(saved.choices, 'notation preference choices')
    if #choices > 128 then ctx.fail('notation preferences exceed the 128-choice bound') end
    local seen = {}
    for _, choice in ipairs(choices) do
      choice = strict(choice, {profile=true,concept=true,scope=true,variant=true}, 'notation preference choice', ctx)
      local id, variant = key(choice.profile, 'notation preference profile', ctx), key(choice.variant, 'notation preference variant', ctx)
      local concept = literal(choice.concept,4096,'notation preference concept',ctx)
      if ctx.identity(concept, 'notation preference concept') ~= concept then ctx.fail('notation preferences require expanded concept identities') end
      local scope = literal(choice.scope,256,'notation preference scope',ctx)
      -- Length prefixes keep exact context identities unambiguous, including
      -- punctuation in a scope. No preferences are matched by display words.
      local identity = #concept .. ':' .. concept .. #scope .. ':' .. scope .. #id .. ':' .. id
      if seen[identity] then ctx.fail('notation preferences contain a repeated context') end
      seen[identity] = true
      local profile = profiles[id]
      if profile then
        if profile.concept ~= concept or profile.scope ~= scope or not profile.by_id[variant] then
          ctx.fail('notation preference context or variant conflicts with the current profile')
        end
        preferences[id] = variant
      end
      -- A same-registry choice for another selected page/scope is retained in
      -- the portable file, but cannot affect an occurrence not validated here.
    end
  end
  for _, profile in ipairs(ordered) do
    profile.page_default = page_defaults[profile.id]
    profile.override = page_overrides[profile.id]
    profile.reader_choice = preferences[profile.id]
    profile.author_default = profile.override or profile.page_default or profile.default
    profile.initial = profile.override or profile.reader_choice or profile.page_default or profile.default
  end
  if not used_authoring then return doc end
  local html = quarto.doc.is_format('html')
  local js = quarto.doc.is_format('html:js')
  local controls, occurrences = false, false
  local function attrs(profile, variant)
    local attributes = {['data-mk-profile']=profile.id, ['data-mk-concept']=profile.concept, ['data-mk-scope']=profile.scope,
      ['data-mk-default']=profile.author_default, ['data-mk-site-default']=profile.default,
      ['data-mk-initial']=profile.initial, ['data-mk-token']=ctx.token, ['data-mk-variant']=variant.id,
      ['data-mk-label']=variant.label, ['data-mk-concept-label']=profile.object.label}
    if profile.page_default then attributes['data-mk-page-default'] = profile.page_default end
    if profile.override then attributes['data-mk-override'] = profile.override end
    if profile.reader_choice then attributes['data-mk-reader-choice'] = profile.reader_choice end
    return attributes
  end
  local function occurrence(el)
    if not includes(el, 'maths-notation') then return el end
    local profile = profiles[el.attributes.profile or '']
    if not profile then ctx.fail('maths-notation requires a declared profile key') end
    local args = {}
    for _, role in ipairs(profile.roles) do
      if not el.attributes['arg-' .. role] then ctx.fail('maths-notation requires one arg- attribute for each declared role') end
      args[role] = atom(el.attributes['arg-' .. role], ctx)
    end
    for name, value in pairs(el.attributes) do
      if name == 'semantic-id' then
        if value ~= profile.concept then ctx.fail('maths-notation semantic-id conflicts with its concept') end
        if profile.object.source.path ~= ctx.source or el.identifier ~= profile.object.source.anchor then
          ctx.fail('maths-notation semantic-id belongs only on its declared concept anchor; use profile alone for a notation use')
        end
      elseif name ~= 'profile' and not (name:sub(1,4) == 'arg-' and args[name:sub(5)]) then
        ctx.fail('maths-notation accepts only profile and declared arg- attributes')
      end
    end
    local default_tex = expand(profile.by_id[profile.default].tex, args)
    if #el.content ~= 1 or el.content[1].t ~= 'Math' or el.content[1].text ~= default_tex then
      ctx.fail('maths-notation must contain one native Math expression exactly matching the expanded authored default')
    end
    if el.content[1].mathtype ~= 'InlineMath' then ctx.fail('maths-notation currently requires native inline mathematics') end
    occurrences = true
    -- EPUB is in Quarto's html alias, but is a static fallback here. Keep only
    -- the authored expression rather than relying on a reading system's hidden
    -- attribute handling for the alternatives.
    if not js then
      el.content = pandoc.List({pandoc.Math('InlineMath',expand(profile.by_id[profile.initial].tex,args))})
      return el
    end
    local content = pandoc.List()
    for _, variant in ipairs(profile.variants) do
      local attributes = attrs(profile, variant)
      if variant.id ~= profile.initial then attributes.hidden = ''; attributes['aria-hidden'] = 'true' end
      content:insert(pandoc.Span({pandoc.Math('InlineMath', expand(variant.tex,args))},pandoc.Attr('', {'maths-notation-variant'},attributes)))
    end
    el.content = content
    for _, role in ipairs(profile.roles) do el.attributes['arg-'..role] = nil end
    el.attributes.profile = nil
    -- A notation use is not a new canonical declaration. Keep an explicitly
    -- validated semantic-id if this span is itself the declared concept anchor,
    -- but otherwise carry its target in data-mk-concept. AM requires unique
    -- declaration identities; KG validates declared occurrences independently.
    for name, value in pairs(attrs(profile,profile.by_id[profile.default])) do if name ~= 'data-mk-variant' and name ~= 'data-mk-label' then el.attributes[name] = value end end
    return el
  end
  local function glossary(el)
    if not includes(el, 'maths-notation-glossary') then return el end
    if #el.content ~= 0 then ctx.fail('maths-notation-glossary must be an empty Div') end
    for name in pairs(el.attributes) do if name ~= 'scope' then ctx.fail('maths-notation-glossary accepts only the optional scope attribute') end end
    local entries = pandoc.List()
    for _, profile in ipairs(ordered) do
      if not el.attributes.scope or profile.scope == el.attributes.scope then
        local source = profile.object.source
        local target
        if ctx.destination then target = ctx.destination(source.path,source.anchor)
        else target = source.path == ctx.source and '#'..source.anchor
          or pandoc.path.make_relative(source.path,pandoc.path.directory(ctx.source)):gsub('\\','/') .. '#' .. source.anchor end
        local description = pandoc.List({pandoc.Para({pandoc.Str('Scope: '..profile.scope..'. Author-approved alternatives; mathematical equivalence is not verified.')})})
        local origin = profile.override and 'required by this page' or profile.reader_choice and 'configured reader preference'
          or profile.page_default and 'page default' or 'site default'
        description:insert(pandoc.Para({pandoc.Str('Initial notation: '..profile.by_id[profile.initial].label..' ('..origin..').')}))
        local args, example = {}, {'x','y','z','w'}
        for index, role in ipairs(profile.roles) do args[role] = example[index] end
        local items = pandoc.List()
        for _, variant in ipairs(profile.variants) do
          items:insert({pandoc.Plain({pandoc.Str(variant.label..(variant.id == profile.default and ' (site default)' or '')..': '),
            pandoc.Math('InlineMath',expand(variant.tex,args)),pandoc.Str('. '..variant.description)})})
        end
        description:insert(pandoc.BulletList(items))
        if html and js then
          local attributes = attrs(profile,profile.by_id[profile.default])
          attributes['data-mk-variant'] = nil; attributes['data-mk-label'] = nil
          -- Variant metadata lives on inert native spans. No raw author HTML or
          -- executable JSON is generated from registry values.
          local choices = pandoc.List()
          for _, variant in ipairs(profile.variants) do
            choices:insert(pandoc.Span({pandoc.Str(variant.label)},pandoc.Attr('',{'maths-notation-choice'},attrs(profile,variant))))
          end
          description:insert(pandoc.Div({pandoc.Plain(choices)},pandoc.Attr('',{'maths-notation-controls'},attributes)))
          controls = true
        end
        entries:insert({{pandoc.Link({pandoc.Str(profile.object.label)},target)},{description}})
      end
    end
    local content = pandoc.List({pandoc.Para({pandoc.Str('Finite public notation profiles from the configured registry. Each choice applies only to its declared semantic concept and scope; undeclared expressions keep their authored notation.')})})
    if #entries > 0 then content:insert(pandoc.DefinitionList(entries))
    else content:insert(pandoc.Para({pandoc.Str('No public notation profiles match this scope.')})) end
    el.content = content; return el
  end
  doc.blocks = doc.blocks:walk({Span=occurrence,Div=glossary})
  if html and js and (occurrences or controls) then
    quarto.doc.add_html_dependency({name='maths-knowledge-graph-notation',version='0.0.10',scripts={'notation-preferences.js','notation.js'},stylesheets={'notation.css'}})
  end
  return doc
end

return M
