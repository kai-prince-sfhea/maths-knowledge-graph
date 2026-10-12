-- Copyright 2026 Kai Prince
-- SPDX-License-Identifier: Apache-2.0
-- MK-1 finite, typed authoring template. Constructs native AST; it never
-- substitutes arbitrary text, reads files, executes code or verifies a proof.

local M = {}
local operators = {['\\circ']=true, ['\\cdot']=true, ['\\ast']=true, ['+']=true}
local allowed = {template=true, carrier=true, operation=true, variables=true,
  name=true, ['semantic-id']=true}

function M.expand(doc, ctx)
  local fail = ctx.fail
  local function parameter(value, field)
    if type(value) ~= 'string' then fail('maths-instance ' .. field .. ' must be literal text') end
    local result = ctx.nonblank(value, 'maths-instance ' .. field)
    if #result > 256 or result:find('[%c]') then
      fail('maths-instance parameters must be bounded single-line literal text')
    end
    return result
  end
  local function is_instance(el) return el.classes:includes('maths-instance') end

  local function expand(el)
    if #el.content ~= 0 then
      fail('maths-instance must be an empty Div; keep authored content outside it')
    end
    if #el.identifier > 128 or not el.identifier:match('^def%-[A-Za-z][A-Za-z0-9_-]*$') then
      fail('maths-instance requires a def- identifier with a simple Latin label')
    end
    for _, class in ipairs(el.classes) do
      if class ~= 'maths-instance' and class ~= 'definition' then
        fail('maths-instance accepts only its own class and optional definition class')
      end
    end
    for key in pairs(el.attributes) do
      if not allowed[key] then fail('maths-instance has an unknown parameter or authored control attribute') end
    end
    if parameter(el.attributes.template, 'template') ~= 'associativity' then
      fail('maths-instance supports only the finite associativity template')
    end

    -- Roles are finite: one nominal carrier, one author-declared closed binary
    -- operation on that carrier, and three distinct bound variable names. The
    -- closedness declaration is an assumption of the definition, not checked
    -- from a glyph or inferred from an arbitrary mathematical expression.
    local carrier = parameter(el.attributes.carrier, 'carrier')
    local carrier_letter = carrier:match('^([A-Za-z])$') or carrier:match('^\\mathbb{([A-Z])}$')
    if not carrier_letter then
      fail('maths-instance carrier must be one Latin letter or a capital mathbb symbol')
    end
    local operation = parameter(el.attributes.operation, 'operation')
    if not operators[operation] then
      fail('maths-instance operation must be one of the four approved binary operators')
    end
    local variables = el.attributes.variables == nil and 'x,y,z' or parameter(el.attributes.variables, 'variables')
    local x, y, z = variables:match('^ *([A-Za-z]) *, *([A-Za-z]) *, *([A-Za-z]) *$')
    if not x then fail('maths-instance variables must contain exactly three single Latin letters separated by commas') end
    if x == y or x == z or y == z or x == carrier_letter or y == carrier_letter or z == carrier_letter then
      fail('maths-instance bound variables must be distinct and must not capture the carrier symbol')
    end
    if el.attributes['semantic-id'] ~= nil then parameter(el.attributes['semantic-id'], 'semantic-id') end
    local name = el.attributes.name == nil and 'Associativity condition' or parameter(el.attributes.name, 'name')

    local signature = operation .. ' \\colon ' .. carrier .. ' \\times ' .. carrier .. ' \\to ' .. carrier
    local quantified = x .. ',' .. y .. ',' .. z .. ' \\in ' .. carrier
    local equality = '(' .. x .. ' ' .. operation .. ' ' .. y .. ') ' .. operation .. ' ' .. z
      .. ' = ' .. x .. ' ' .. operation .. ' (' .. y .. ' ' .. operation .. ' ' .. z .. ')'
    el.content = pandoc.Blocks({
      pandoc.Para({pandoc.Str('The author declares a closed binary operation '),
        pandoc.Math('InlineMath', signature), pandoc.Str('.')}),
      pandoc.Para({pandoc.Str('Associativity is the condition that, for all '),
        pandoc.Math('InlineMath', quantified), pandoc.Str(', the identity')}),
      pandoc.Para({pandoc.Math('DisplayMath', equality)}),
      pandoc.Para({pandoc.Str('holds. The operation is called associative if and only if it satisfies this condition.')}),
    })
    if not el.classes:includes('definition') then el.classes:insert('definition') end
    el.attributes.name = name
    el.attributes.variables = table.concat({x,y,z}, ',')
    el.attributes['data-mk-template-version'] = '1'
    el.attributes['data-mk-template-review'] = 'unverified'
    el.attributes['data-mk-template-kind'] = 'associativity-condition'
    return el
  end
  -- One topdown walk replaces separate proof-validation and expansion walks.
  -- A proof subtree is inspected once, then skipped by the outer walk; nested
  -- proofs cannot repeatedly rescan the same descendants. It remains forbidden
  -- to generate a proof or place an instance anywhere inside an authored proof.
  -- Pandoc documents the second false return as "do not process children";
  -- generated template content contains no further authoring placeholders.
  local changed = false
  local blocks = doc.blocks:walk({traverse='topdown', Div=function(el)
    if el.classes:includes('proof') or el.identifier:match('^prf%-') then
      if is_instance(el) then fail('maths-instance cannot generate a proof') end
      el.content:walk({Div=function(child)
        if is_instance(child) then fail('maths-instance cannot be nested in a proof') end
      end})
      return el, false
    end
    if is_instance(el) then
      changed = true
      return expand(el), false
    end
  end})
  if changed then doc.blocks = blocks end
  return doc
end

return M
