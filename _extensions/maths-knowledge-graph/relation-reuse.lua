-- Copyright 2026 Kai Prince. SPDX-License-Identifier: Apache-2.0
-- Explicit, pinned relation projection only. The caller retains every normal
-- schema/type/role/publication check and verifies real native endpoint anchors.
-- This helper neither reads files nor infers equivalence or proof validity.
local M = {}
local unavailable = 'reuse-relations request cannot be applied; select a public in-scope relation with matching revision and assumption hash and both current-document endpoints'
local invalid = 'reuse-relations requires at most 128 distinct relation IDs, nonblank revisions of at most 128 bytes and lowercase SHA-256 hashes'
local function abort(ctx, message)
  if type(ctx.fail) == 'function' then ctx.fail(message) end
  assert(false, 'maths-knowledge-graph: ' .. message)
end
-- Scope selection is a projection, not deletion from the authoritative
-- catalogue. Withhold relations touching declared excluded objects; a truly
-- missing endpoint still refuses, even if the other endpoint is excluded.
-- No private/off-scope object is returned or implicitly admitted here.
function M.selected_endpoints(objects, excluded, from_id, to_id, ctx)
  assert(type(objects)=='table' and type(excluded)=='table' and type(from_id)=='string'
    and type(to_id)=='string' and type(ctx)=='table' and type(ctx.field)=='string',
    'maths-knowledge-graph: invalid relation scope selection')
  local from,to=objects[from_id],objects[to_id]
  if (not from and not excluded[from_id]) or (not to and not excluded[to_id]) then
    abort(ctx,ctx.field..': unresolved endpoint; declare both endpoint objects')
  end
  if not from or not to then return {status='excluded'} end
  return {status='selected',from=from,to=to}
end
local function literal(ctx, value)
  if type(ctx.nonblank) == 'function' then
    local ok, result = pcall(ctx.nonblank, value, 'reuse-relations value')
    if ok and type(result) == 'string' and not result:match('^%s*$') then return result end
    abort(ctx, invalid)
  end
  if type(value) ~= 'string' or value:match('^%s*$') then abort(ctx, invalid) end
  return value
end
local function mapping(ctx, value)
  if type(ctx.mapping) == 'function' then
    local ok, result = pcall(ctx.mapping, value, 'reuse-relations entry')
    if ok and type(result) == 'table' then return result end
    abort(ctx, invalid)
  end
  if type(value) ~= 'table' then abort(ctx, invalid) end
  return value
end
local function sha(value)
  return type(value) == 'string' and #value == 64 and not value:find('[^a-f0-9]')
end
function M.prepare(config, ctx)
  assert(type(ctx) == 'table' and type(ctx.source) == 'string' and type(ctx.identity) == 'function',
    'maths-knowledge-graph: relation-reuse requires the containing source and identity validator')
  local state = {ctx=ctx, source=ctx.source, requests={}, order={}, count=0}
  if config == nil then return state end
  local entries
  if type(ctx.sequence) == 'function' then
    local ok, result = pcall(ctx.sequence, config, 'reuse-relations')
    if not ok or type(result) ~= 'table' then abort(ctx, invalid) end
    entries = result
  else
    if type(config) ~= 'table' then abort(ctx, invalid) end
    entries = config
  end
  if #entries > 128 then abort(ctx, invalid) end
  for key in pairs(entries) do
    if type(key) ~= 'number' or key % 1 ~= 0 or key < 1 or key > #entries then abort(ctx, invalid) end
  end
  for index = 1, #entries do if entries[index] == nil then abort(ctx, invalid) end end
  for _, entry in ipairs(entries) do
    entry = mapping(ctx, entry)
    for key in pairs(entry) do
      if key ~= 'id' and key ~= 'revision' and key ~= 'assumptions-sha256' then abort(ctx, invalid) end
    end
    local ok, id = pcall(ctx.identity, entry.id, 'reuse-relations id')
    if not ok or type(id) ~= 'string' or id == '' then abort(ctx, invalid) end
    local revision = literal(ctx, entry.revision)
    local hash = literal(ctx, entry['assumptions-sha256'])
    if #revision > 128 or revision:find('[%c]') or not sha(hash) or state.requests[id] then abort(ctx, invalid) end
    local request = {id=id, revision=revision, hash=hash, matched=false}
    state.requests[id] = request
    state.order[#state.order+1] = request
    state.count = state.count + 1
  end
  return state
end
local function at_current_document(value, source)
  return type(value) == 'table' and value.public == true and type(value.source) == 'table'
    and value.source.path == source and type(value.source.anchor) == 'string'
    and #value.source.anchor > 0 and #value.source.anchor <= 4096
    and not value.source.anchor:find('[%s%c#"\'<>]')
end
function M.apply(state, relation, raw)
  local request = state.requests[relation.id]
  -- In particular, never transfer all relations from one reused object. With
  -- no explicit request this is a no-op, preserving the caller's old policy.
  if not request then return nil end
  local properties = type(raw) == 'table' and raw.properties
  if request.matched or type(raw) ~= 'table' or raw.public ~= true or type(properties) ~= 'table'
    or properties['assertion-revision'] ~= request.revision
    or properties['assumptions-sha256'] ~= request.hash
    or not at_current_document(relation.from, state.source)
    or not at_current_document(relation.to, state.source)
    or type(relation.source) ~= 'table' or type(relation.source.path) ~= 'string'
    or type(relation.source.anchor) ~= 'string' then abort(state.ctx, unavailable) end
  local projected = {}
  for key, value in pairs(relation) do projected[key] = value end
  projected.canonicalSource = {path=relation.source.path, anchor=relation.source.anchor}
  projected.source = {path=state.source, anchor=relation.from.source.anchor}
  projected.reused = true
  projected.reuse = {revision=request.revision, ['assumptions-sha256']=request.hash}
  request.matched = true
  return projected
end
function M.finish(state)
  for _, request in ipairs(state.order) do
    -- Private, unavailable and filtered-out IDs have the same fixed diagnostic.
    -- Do not expose whether an unadmitted catalogue record happens to exist.
    if not request.matched then abort(state.ctx, unavailable) end
  end
  return true
end
return M
