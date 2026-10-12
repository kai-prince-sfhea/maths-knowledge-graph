-- Copyright 2026 Kai Prince
-- SPDX-License-Identifier: Apache-2.0
-- Explicit mathematical view and finite native authoring over KG v0 data.
-- Never infer truth, identity, proof validity or publication permission.

-- Quarto replaces error() with a logging helper in this filter phase.
-- assert() must abort rather than let invalid declarations continue rendering.
local function fail(message) assert(false, 'maths-knowledge-graph: ' .. message) end
local function text(value)
  if value == nil then return nil end
  if type(value) == 'string' then return value end
  if type(value) == 'boolean' or type(value) == 'number' then return tostring(value) end
  return pandoc.utils.stringify(value)
end
local function mapping(value, field)
  if value == nil then return {} end
  if type(value) ~= 'table' or pandoc.utils.type(value) == 'List' or value.t == 'MetaList' then
    fail(field .. ' must be a mapping')
  end
  return value
end
local function sequence(value, field)
  if value == nil then return {} end
  if type(value) ~= 'table' or (pandoc.utils.type(value) ~= 'List' and value.t ~= 'MetaList') then
    fail(field .. ' must be a sequence')
  end
  return value
end
local function nonblank(value, field)
  if type(value) ~= 'string' then
    local kind = pandoc.utils.type(value)
    if kind ~= 'Inlines' and kind ~= 'MetaInlines' and kind ~= 'MetaString' then
      fail(field .. ' must be text')
    end
  end
  local result = text(value)
  if not result or result:match('^%s*$') or #result > 4096 or result:find('%z') then
    fail(field .. ' requires bounded nonblank text')
  end
  return result
end
local function boolean(value, default, field)
  if value == nil then return default end
  if type(value) ~= 'boolean' then fail(field .. ' must be a YAML Boolean') end
  return value
end
local function local_path(value, field)
  local result = nonblank(value, field):gsub('\\', '/')
  if result:find('[%z\r\n?#:]') or result:sub(1,1) == '/' then fail(field .. ' must be a relative local path') end
  for part in result:gmatch('[^/]+') do
    if part == '..' or part == '.' then fail(field .. ' must not contain traversal components') end
  end
  return result
end
local families = {definition='def', theorem='thm', lemma='lem', proposition='prp', corollary='cor', conjecture='cnj'}
local statement_kinds = {theorem=true, lemma=true, proposition=true, corollary=true, conjecture=true, axiom=true}
local kinds = {definition=true, theorem=true, lemma=true, proposition=true, corollary=true, conjecture=true, axiom=true, assumption=true, proof=true}
local statuses = {unverified=true, ['author-reviewed']=true, ['formal-candidate']=true}
local relation_kinds = {defines=true, requires=true, references=true, proves=true, assumes=true}

-- Refuse excessive nesting before invoking a recursive JSON decoder. Braces
-- inside strings (including escaped quotes) are data, not nesting.
local function check_json_depth(raw)
  local depth, quoted, escaped = 0, false, false
  for i = 1, #raw do
    local char = raw:byte(i)
    if quoted then
      if escaped then escaped = false
      elseif char == 92 then escaped = true
      elseif char == 34 then quoted = false end
    elseif char == 34 then quoted = true
    elseif char == 123 or char == 91 then
      depth = depth + 1
      if depth > 64 then fail('JSON input exceeds the 64-level nesting limit') end
    elseif char == 125 or char == 93 then depth = depth - 1 end
  end
end

-- Run only after the native JSON decoder has checked syntax. Native decoders
-- disagree about duplicate keys; refuse them rather than change permissions or
-- identities when the same catalogue reaches KG's parser. Decoded key strings
-- also catch duplicates hidden behind Unicode escapes. Bound nesting separately.
local function check_json_keys(raw)
  local position = 1
  local function whitespace()
    local _, ending = raw:find('^%s*', position)
    position = (ending or position - 1) + 1
  end
  local function string_end()
    local start = position
    position = position + 1
    while position <= #raw do
      local char = raw:byte(position)
      position = position + (char == 92 and 2 or 1)
      if char == 34 then return raw:sub(start, position - 1) end
    end
    fail('cannot scan declaration strings')
  end
  local value
  value = function(depth)
    if depth > 64 then fail('declarations exceed the 64-level nesting limit') end
    whitespace()
    local char = raw:sub(position, position)
    if char == '{' then
      local seen = {}
      position = position + 1; whitespace()
      if raw:sub(position, position) == '}' then position = position + 1; return end
      while true do
        local raw_key = string_end()
        -- Syntax was checked by the full decoder. An unescaped JSON key is
        -- already its literal UTF-8 value; escaped keys still use the native
        -- decoder so Unicode/escape collisions retain exactly the same guard.
        local key = raw_key:find('\\', 1, true) and pandoc.json.decode(raw_key) or raw_key:sub(2, -2)
        if seen[key] then fail('declarations contain a duplicate JSON mapping key; keep one value per field') end
        seen[key] = true
        whitespace(); position = position + 1 -- colon, already syntax-checked
        value(depth + 1); whitespace()
        local closing = raw:sub(position, position)
        position = position + 1
        if closing == '}' then return end
        whitespace()
      end
    elseif char == '[' then
      position = position + 1; whitespace()
      if raw:sub(position, position) == ']' then position = position + 1; return end
      while true do
        value(depth + 1); whitespace()
        local closing = raw:sub(position, position)
        position = position + 1
        if closing == ']' then return end
      end
    elseif char == '"' then string_end()
    else
      local _, ending = raw:find('^[^%s,%]%}]+', position)
      if not ending then fail('cannot scan declaration values') end
      position = ending + 1
    end
  end
  value(0)
end

local function process(doc)
  local options = mapping(doc.meta['maths-knowledge-graph'], 'configuration')
  for key in pairs(options) do
    if key ~= 'enabled' and key ~= 'declarations' and key ~= 'notation' then fail('unknown configuration key; use enabled, declarations or notation') end
  end
  if not boolean(options.enabled, true, 'enabled') then return doc end
  local input = quarto.doc.input_file
  local root = quarto.project.directory or pandoc.path.directory(input)
  local source = pandoc.path.make_relative(input, root):gsub('\\', '/')
  local_path(source, 'containing document')
  local function read_json(option, default, field)
    local filename = default
    if option ~= nil then
    local configured = nonblank(option, field):gsub('\\', '/')
    if configured:find('[%c?#:]') or configured:sub(1,1) == '/' then
      fail(field .. ' must be a relative local path')
    end
    -- Quarto rebases inherited file-valued metadata to the input directory.
    -- Normalize that effective path first, then admit only paths within root.
    -- pandoc.path.normalize intentionally retains '..' (symlink semantics).
    -- Fold project-relative components explicitly for this trusted, lexical
    -- read boundary; do not misrepresent it as real-path confinement.
    local parts = {}
    local effective = pandoc.path.directory(source):gsub('\\', '/') .. '/' .. configured
    for part in effective:gmatch('[^/]+') do
      if part == '..' then
        if #parts == 0 then fail(field .. ' must stay within the project/document directory') end
        table.remove(parts)
      elseif part ~= '.' then parts[#parts+1] = part end
    end
    filename = table.concat(parts, '/')
    local_path(filename, field)
    end
    local handle = io.open(pandoc.path.join({root, filename}), 'rb')
    if not handle then fail('cannot read ' .. field .. '; create the configured local JSON file') end
    local raw = handle:read(2097153); handle:close()
    if not raw or #raw > 2097152 then fail(field .. ' exceeds the 2 MiB limit') end
    if not raw:match('^%s*{') then fail(field .. ' requires a JSON object; convert YAML to literal JSON and set the option to that file') end
    check_json_depth(raw)
    local ok, data = pcall(pandoc.json.decode, raw)
    if not ok then fail('cannot parse ' .. field .. '; use a valid JSON object') end
    check_json_keys(raw)
    return mapping(data, field), raw
  end
  -- Pandoc preserves JSON arrays as Lists, including empty arrays; Quarto's
  -- decoder returns plain tables, which erase the map/sequence distinction.
  -- Catalogue values are literal data. A Markdown metadata reader silently
  -- changes TeX escapes and emphasis. YAML support awaits a faithful reader.
  local data = read_json(options.declarations, 'knowledge.json', 'declarations')
  if type(data.version) ~= 'number' or data.version ~= 0 then fail('declarations version must be numeric 0') end
  local namespaces = mapping(data.namespaces, 'namespaces')
  local function identity(value, field)
    local result = nonblank(value, field)
    local prefix, suffix = result:match('^([%a][%w_-]*):(.*)$')
    if prefix and namespaces[prefix] then result = nonblank(namespaces[prefix], 'namespace') .. suffix end
    local authority = result:match('^https?://([^/?#]+)')
    if not authority or authority:find('@', 1, true) or result:find('[%s%c\\<>"{}]') then
      fail(field .. ' requires an HTTP(S) URI without credentials or unsafe characters')
    end
    -- Keep the initial URI contract conservative: DNS/IPv4-style host and an
    -- optional numeric port. No silent URL normalization or credential output.
    local host, port = authority:match('^([%w%.%-]+):(%d+)$')
    host = host or authority
    if not host:match('^[%w%.%-]+$') or host:sub(1,1) == '.' or host:sub(-1) == '.' or host:find('..', 1, true)
      or (port and (tonumber(port) > 65535 or #port > 5)) then
      fail(field .. ' requires a supported DNS/IPv4-style HTTP(S) authority')
    end
    return result
  end
  local function location(value, field)
    value = mapping(value, field)
    local path = local_path(value.path, field .. '.path')
    local anchor = nonblank(value.anchor, field .. '.anchor')
    if anchor:find('[%s%c#"\'<>]') then fail(field .. '.anchor must be an unambiguous native identifier') end
    return {path=path, anchor=anchor}
  end
  local function language_tag(value)
    if type(value) ~= 'string' or #value > 255 then return false end
    local first = true
    for part in value:gmatch('[^%-]+') do
      if #part > 8 or (first and (#part < 2 or not part:match('^[A-Za-z]+$')))
        or (not first and not part:match('^[A-Za-z0-9]+$')) then return false end
      first = false
    end
    return not first and not value:find('%-%-') and value:sub(1,1) ~= '-' and value:sub(-1) ~= '-'
  end
  local objects, links, current = {}, {}, {}
  local document_language = text(doc.meta.lang) or 'en'
  local records = sequence(data.objects, 'objects')
  if #records > 10000 then fail('objects exceed the 10000-record limit') end
  for index, value in ipairs(records) do
    value = mapping(value, 'object')
    local field = 'objects[' .. index .. ']'
    local id = identity(value.id, field .. '.id')
    if objects[id] then fail(field .. ': duplicate normalized identity') end
    if value.review ~= nil and value.review ~= 'declared' then fail(field .. '.review must be declared; proposed records require author review before admission') end
    local public = boolean(value.public, false, field .. '.public')
    local properties = mapping(value.properties, field .. '.properties')
    local category = nonblank(value.type, field .. '.type')
    local kind = category == 'concept' and 'concept' or
      (properties['math-kind'] ~= nil and nonblank(properties['math-kind'], field .. '.properties.math-kind') or nil)
    if category ~= 'concept' and category ~= 'assertion' then fail(field .. ': MK-0 accepts concept/assertion records only') end
    if category == 'assertion' and kind and not kinds[kind] then fail(field .. ': unsupported assertion math-kind') end
    if category == 'concept' and properties['math-kind'] ~= nil then fail(field .. ': math-kind belongs to an assertion') end
    local scope = nonblank(value.scope, field .. '.scope')
    local origin = location(value.source, field .. '.source')
    local labels = mapping(value.labels, field .. '.labels')
    local label_count, fallback_language = 0, nil
    for language, label_value in pairs(labels) do
      if not language_tag(language) then
        fail(field .. '.labels requires bounded language tags')
      end
      nonblank(label_value, field .. '.labels value')
      label_count = label_count + 1
      if not fallback_language or language < fallback_language then fallback_language = language end
    end
    if label_count == 0 then fail(field .. '.labels needs at least one literal translation') end
    if value.aliases ~= nil then
      for language, entries in pairs(mapping(value.aliases, field .. '.aliases')) do
        if not language_tag(language) then fail(field .. '.aliases requires language tags') end
        local seen = {}
        entries = sequence(entries, field .. '.aliases entry')
        if #entries == 0 then fail(field .. '.aliases entries must not be empty') end
        for _, alias in ipairs(entries) do
          alias = nonblank(alias, field .. '.aliases value')
          if seen[alias] then fail(field .. '.aliases values must be distinct') end
          seen[alias] = true
        end
      end
    end
    local label = labels[document_language] or labels.en
    if not label then label = fallback_language and labels[fallback_language] end
    label = nonblank(label, field .. '.labels')
    local status = properties['proof-status'] ~= nil and nonblank(properties['proof-status'], field .. '.properties.proof-status') or nil
    if status and (kind ~= 'proof' or not statuses[status]) then fail(field .. ': proof-status is valid only for proofs and the documented states') end
    local notation = properties.notation ~= nil and nonblank(properties.notation, field .. '.notation') or nil
    if notation and category ~= 'concept' then fail(field .. ': notation belongs to a concept') end
    local local_origin = origin.path == source and origin or nil
    local seen_occurrences = {}
    local occurrences = sequence(value.occurrences, field .. '.occurrences')
    if #occurrences > 1000 then fail(field .. '.occurrences exceeds the 1000-record limit') end
    for _, occurrence in ipairs(occurrences) do
      local at = location(occurrence, field .. '.occurrences')
      local key = at.path .. '\n' .. at.anchor
      if seen_occurrences[key] then fail(field .. '.occurrences repeats a path/anchor; list additional reuses once') end
      seen_occurrences[key] = true
      if at.path == source then
        if local_origin and local_origin.anchor ~= at.anchor then
          fail(field .. ': only one occurrence of an identity per page is supported; use separate containing pages')
        end
        local_origin = at
      end
    end
    local object = {id=id, kind=kind, category=category, scope=scope, source=local_origin or origin, canonical=origin, label=label,
      public=public, field=field, proofStatus=kind == 'proof' and (status or 'unverified') or nil, notation=notation}
    objects[id] = object
    if public and kind and local_origin then current[#current+1] = object end
  end
  local relations = sequence(data.relations, 'relations')
  if #relations > 20000 then fail('relations exceed the 20000-record limit') end
  local relation_ids = {}
  for index, value in ipairs(relations) do
    value = mapping(value, 'relation')
    local field = 'relations[' .. index .. ']'
    local id = identity(value.id, field .. '.id')
    if relation_ids[id] then fail(field .. ': duplicate normalized relation identity') end
    if objects[id] then fail(field .. '.id collides with an object identity; use distinct record identities') end
    relation_ids[id] = true
    if value.review ~= nil and value.review ~= 'declared' then fail(field .. '.review must be declared; proposed records require author review before admission') end
    local kind = nonblank(value.type, field .. '.type')
    if not relation_kinds[kind] then fail(field .. ': unsupported relation type in the MK-0 profile') end
    local from = objects[identity(value.from, field .. '.from')]
    local to = objects[identity(value.to, field .. '.to')]
    if not from or not to then fail(field .. ': unresolved endpoint; declare both endpoint objects') end
    local public = boolean(value.public, false, field .. '.public')
    nonblank(value.scope, field .. '.scope')
    local origin = location(value.source, field .. '.source')
    if kind == 'defines' and (from.kind ~= 'definition' or to.kind ~= 'concept') then fail(field .. ': defines requires definition to concept') end
    if kind == 'requires' and to.kind ~= 'concept' then fail(field .. ': requires must target a concept') end
    if kind == 'proves' and (from.kind ~= 'proof' or not statement_kinds[to.kind]) then fail(field .. ': proves requires proof to statement') end
    if kind == 'assumes' and ((not statement_kinds[from.kind] and from.kind ~= 'proof') or to.kind ~= 'assumption') then
      fail(field .. ': assumes requires statement/proof to assumption')
    end
    if public and (not from.public or not to.public) then fail(field .. ': public relation requires public endpoints') end
    if public and from.public and to.public then
      if (from.source.path == source or to.source.path == source) and from.source.path ~= to.source.path then
        fail(field .. ': MK-0 relations must stay in the containing document; cross-page mapping is not implemented')
      end
      links[#links+1] = {id=id, field=field, kind=kind, from=from, to=to, source=origin}
    end
  end
  doc = require('./templates').expand(doc, {fail=fail, nonblank=nonblank, mapping=mapping, sequence=sequence})
  local anchors, used_notation = {}, false
  local function collect(el)
    if (el.t == 'Span' and el.classes:includes('maths-notation'))
      or (el.t == 'Div' and el.classes:includes('maths-notation-glossary')) then used_notation = true end
    if el.identifier and el.identifier ~= '' then
      if anchors[el.identifier] then fail('duplicate native identifier in the containing document') end
      anchors[el.identifier] = el
    end
  end
  doc.blocks:walk({Div=collect, Span=collect, Header=collect, Code=collect, CodeBlock=collect,
    Link=collect, Image=collect, Table=collect, Figure=collect})
  local by_anchor, semantic = {}, {}
  for _, object in ipairs(current) do
    local anchor = object.source.anchor
    local el = anchors[anchor]
    if not el then fail(object.field .. ': a public current-document object has no native source anchor; add its source identifier') end
    if by_anchor[anchor] then fail('two public mathematical objects share one native anchor; give concept and definition distinct identifiers') end
    by_anchor[anchor] = object
    if families[object.kind] and (el.t ~= 'Div' or not anchor:match('^' .. families[object.kind] .. '%-')) then
      fail('a mathematical kind conflicts with its native theorem-family identifier')
    end
    if object.kind == 'proof' and (el.t ~= 'Div' or not el.classes:includes('proof') or not anchor:match('^prf%-')) then
      fail('a proof requires a native .proof Div with its own prf- identifier')
    end
    if (object.kind == 'assumption' or object.kind == 'axiom') and el.t ~= 'Div' then
      fail('an assumption or axiom requires an identified native Div')
    end
    local existing = el.attributes['semantic-id']
    if existing and existing ~= object.id then fail('native semantic-id conflicts with the normalized catalogue identity; use its expanded HTTP(S) URI') end
    semantic[object.id] = anchor
  end
  local associations, assumptions, outgoing, incoming_proofs = {}, {}, {}, {}
  for _, relation in ipairs(links) do
    if relation.from.source.path == source then
      if not anchors[relation.from.source.anchor] or not anchors[relation.to.source.anchor] then
        fail(relation.field .. ': a public current-document relation endpoint has no native source anchor; add both declared identifiers')
      end
      if relation.source.path ~= source or not anchors[relation.source.anchor] then
        fail(relation.field .. ': a public current-document relation needs a native declaration source anchor in this document')
      end
      outgoing[relation.from.id] = outgoing[relation.from.id] or {}
      table.insert(outgoing[relation.from.id], relation)
      if relation.kind == 'proves' then
        incoming_proofs[relation.to.id] = incoming_proofs[relation.to.id] or {}
        table.insert(incoming_proofs[relation.to.id], relation)
      end
      if relation.kind == 'proves' then
        local anchor = relation.from.source.anchor
        if associations[anchor] then fail('a proof has several statement targets; declare one association in MK-0') end
        associations[anchor] = relation.to.source.anchor
      elseif relation.kind == 'assumes' and statement_kinds[relation.from.kind] then
        local anchor = relation.to.source.anchor
        assumptions[anchor] = assumptions[anchor] or {}
        assumptions[anchor][relation.from.source.anchor] = true
      end
    end
  end
  for _, object in ipairs(current) do
    if object.kind == 'proof' and not associations[object.source.anchor] then fail('a public proof needs one explicit public proves relation') end
  end
  local function target_matches(value, anchor)
    return value == '#' .. anchor or semantic[value] == anchor
  end
  local function glossary(el)
    if #el.content ~= 0 then fail('maths-glossary must be an empty Div; put authored headings outside it') end
    for key in pairs(el.attributes) do if key ~= 'scope' then fail('maths-glossary accepts only the optional scope attribute') end end
    local scope = el.attributes.scope
    local entries = pandoc.List()
    local sorted = {}; for _, object in ipairs(current) do if not scope or object.scope == scope then sorted[#sorted+1] = object end end
    table.sort(sorted, function(a,b) return a.label == b.label and a.id < b.id or a.label < b.label end)
    for _, object in ipairs(sorted) do
      local description = pandoc.List({pandoc.Para({pandoc.Str(object.kind .. ' — ' .. object.scope .. '. Author-declared; mathematical correctness is not established.')})})
      description:insert(pandoc.Para({pandoc.Str('Identity: '), pandoc.Code(object.id)}))
      if object.canonical.path ~= source then
        local canonical_path = pandoc.path.make_relative(object.canonical.path, pandoc.path.directory(source)):gsub('\\', '/')
        description:insert(pandoc.Para({pandoc.Link({pandoc.Str('Authored canonical source')}, canonical_path .. '#' .. object.canonical.anchor),
          pandoc.Str(' (catalogue destination; not independently validated by this page render).')}))
      end
      if object.proofStatus then description:insert(pandoc.Para({pandoc.Str('Proof status: ' .. object.proofStatus .. ' (authored status; no formal checking).')})) end
      if object.notation then description:insert(pandoc.Para({pandoc.Str('Authored notation: '), pandoc.Math('InlineMath', object.notation)})) end
      local relationships = pandoc.List()
      for _, relation in ipairs(outgoing[object.id] or {}) do
        relationships:insert({pandoc.Plain({pandoc.Str(relation.kind .. ': '), pandoc.Link({pandoc.Str(relation.to.label)}, '#' .. relation.to.source.anchor)})})
      end
      for _, relation in ipairs(incoming_proofs[object.id] or {}) do
        relationships:insert({pandoc.Plain({pandoc.Str('associated proof: '), pandoc.Link({pandoc.Str(relation.from.label)}, '#' .. relation.from.source.anchor)})})
      end
      if #relationships > 0 then description:insert(pandoc.BulletList(relationships)) end
      entries:insert({{pandoc.Link({pandoc.Str(object.label)}, '#' .. object.source.anchor)}, {description}})
    end
    local blocks = pandoc.List({pandoc.Para({pandoc.Str('Explicit public declarations for this containing document only. Other pages and undeclared relationships are outside this view; missing entries do not imply absence.')})})
    if #entries > 0 then blocks:insert(pandoc.DefinitionList(entries))
    else blocks:insert(pandoc.Para({pandoc.Str('No public mathematical declarations match this document and scope.')})) end
    el.content = blocks; return el
  end
  local function decorate(el)
    if el.t == 'Div' and el.classes:includes('maths-glossary') then
      if by_anchor[el.identifier] then fail('a glossary placeholder cannot replace a mathematical source object') end
      return glossary(el)
    end
    local object = by_anchor[el.identifier]
    if object then
      el.attributes['semantic-id'] = object.id
      if associations[el.identifier] then
        local destination = associations[el.identifier]
        if el.attributes['proof-for'] and not target_matches(el.attributes['proof-for'], destination) then fail('authored proof-for conflicts with its declared proves relation') end
        el.attributes['proof-for'] = '#' .. destination
      end
      if el.classes:includes('am-assumption') then
        if object.kind ~= 'assumption' or not assumptions[el.identifier] then
          fail('an interactive assumption needs an explicit public statement-to-assumption association')
        end
        local targets = {}; for anchor in pairs(assumptions[el.identifier]) do targets[#targets+1] = anchor end
        if #targets ~= 1 then fail('an interactive assumption has multiple statement targets; split its rendered occurrences explicitly') end
        if el.attributes['theorem-for'] and not target_matches(el.attributes['theorem-for'], targets[1]) then fail('authored theorem-for conflicts with its declared assumes relation') end
        el.attributes['theorem-for'] = '#' .. targets[1]
      end
    end
    if object then return el end
  end
  doc.blocks = doc.blocks:walk({Div=decorate, Span=decorate, Header=decorate, Code=decorate,
    CodeBlock=decorate, Link=decorate, Image=decorate, Table=decorate, Figure=decorate})
  local registry, registry_raw
  if options.notation ~= nil then registry, registry_raw = read_json(options.notation, nil, 'notation') end
  doc = require('./notation').apply(doc, {data=registry, token=registry_raw and pandoc.utils.sha1(registry_raw),
    objects=objects, identity=identity, fail=fail, mapping=mapping, sequence=sequence,
    nonblank=nonblank, text=text, source=source, used_authoring=used_notation})
  return doc
end

return {Pandoc=process}
