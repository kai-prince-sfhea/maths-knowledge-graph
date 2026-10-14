# Maths Knowledge Graph

An experimental Quarto extension that connects explicit mathematical concepts,
definitions, assumptions and authored proofs, produces a static glossary, and
supports a finite definition template and scoped reader notation preferences.
Authors keep native theorem blocks, mathematical notation and cross-references.
Readers can follow the glossary to the original text and distinguish a statement,
its conditions and its associated proofs.

The **0.0.3 experimental implementation** covers explicit mathematical objects
and their current-page occurrences (MK-0), one bounded associativity template
(MK-1), and approved notation alternatives across pages (MK-2). It uses a local
catalogue and never infers mathematical truth or links matching words. AI,
general template languages and formal proof checking remain later experiments;
Knowledge Graph Extraction owns whole-project graph assembly.
[AI assistance is disclosed below](#ai-assistance-and-review).

## Install and try the example

This is experimental source, with no tagged release or supported production
version. In a new consumer directory, install from GitHub:

```powershell
quarto add kai-prince-sfhea/maths-knowledge-graph --no-prompt
```

Copy [example.qmd](example.qmd) and [knowledge.json](knowledge.json) into that
directory. Replace the copied example's local `filters` value with the
GitHub-qualified filter in its front matter:

```yaml
filters: [kai-prince-sfhea/maths-knowledge-graph]
```

Render the article using the ordinary workflow:

```powershell
quarto render example.qmd --to html
quarto render example.qmd --to docx
```

The original synthetic example has one definition, a nonzero-real assumption,
two proofs and a glossary. It uses ordinary `$x^2$` mathematics, so neither
Accessible Maths nor Knowledge Graph Extraction is needed for this initial
standalone workflow. A source checkout can render its included article directly.

For local development or an unpublished copy, use the local source instead:

```powershell
quarto add "C:/path/to/maths-knowledge-graph" --no-prompt
```

The repository's article and notation-site files use `filters: [maths-knowledge-graph]`
for that local route and direct checkout rendering. A GitHub installation lives
under `_extensions/kai-prince-sfhea/maths-knowledge-graph/`; a local installation
lives under `_extensions/maths-knowledge-graph/`. Select the matching filter and
schema path throughout your consumer configuration. Installation copies only
`_extensions`; copy the runnable examples separately.

## Author explicit mathematical objects

[knowledge.json](knowledge.json) is the authoritative catalogue. It uses literal
JSON with Knowledge Graph Extraction's version 0 declaration shape: namespace
declarations, objects and relations. Public objects need an ID, type, scope,
language-keyed labels and a containing-document source anchor. Only records with
`public: true` are displayed.

```json
{
  "version": 0,
  "namespaces": {"math": "https://example.org/maths/"},
  "sources": [{"path": "example.qmd"}],
  "objects": [
    {
      "id": "math:positive-square",
      "type": "assertion",
      "scope": "real-arithmetic",
      "labels": {"en": "Positive squares"},
      "public": true,
      "source": {"path": "example.qmd", "anchor": "thm-square"},
      "properties": {"math-kind": "theorem"}
    }
  ],
  "relations": []
}
```

The catalogue is read as data, so labels containing Markdown punctuation and
TeX containing backslashes retain their literal values. Escape backslashes in
JSON strings, for example `"notation": "a\\{b\\}c"`. Catalogue YAML is deferred
until a reader has demonstrated faithful scalar/type handling; the initial
prototype refuses that format rather than parsing catalogue values as Markdown.
Ordinary Quarto front matter, project options and the supplied KG schema profile
remain YAML.

Use the corresponding native block:

```markdown
::: {#thm-square name="Positive squares"}
For every nonzero real number $x$, the square $x^2$ is positive.
:::

See @thm-square.
```

Concepts retain `type: concept`. Mathematical assertions use `type: assertion`
with `properties.math-kind` set to `definition`, `theorem`, `lemma`,
`proposition`, `corollary`, `conjecture`, `axiom`, `assumption` or `proof`.
A concept's optional `properties.notation` supplies authored TeX for its
glossary entry. It does not replace notation in the source.

A concept and its defining assertion are distinct objects. Give them distinct
native anchors, such as the example's inline `#concept-square` span inside
`#def-square`, and connect them with `defines`. One native block cannot carry
two different semantic identities. The filter derives an expanded HTTP(S)
`semantic-id` from an eligible explicit declaration when the attribute is
absent; an existing conflicting identity is an error. This initial ID boundary
accepts HTTP(S) authorities using DNS names or IPv4 addresses, with no credentials.
IPv6 literals and internationalized URI/authority handling remain pending.

The mathematical relations are explicit:

| Relation | Direction and meaning |
|---|---|
| `defines` | Definition assertion → concept. |
| `requires` | Dependent object → prerequisite concept; a reading dependency. |
| `proves` | Authored proof assertion → statement assertion. |
| `assumes` | Statement or proof assertion → assumption assertion. |
| `references` | A contextual reference between explicit objects; no automatic support claim. |

Relations have their own `id`, `scope`, `source`, `from`, `to` and explicit
`public: true`. Both endpoints must also be public. Mathematical endpoint roles
are checked rather than inferred from a matching label. A public association
outside the supported current page is refused; other catalogue records do not
become a cross-page glossary.

`review` defaults to `declared`; other values are refused, including on private
records. Proposals need author review before entering this catalogue. All
translations and language tags are validated, rather than just the displayed
label. Object and relation IDs share one collision-free identity space.

An optional `occurrences` array lists additional containing-page/anchor pairs
for a concept or assertion; its canonical `source` counts automatically. One
occurrence per identity per page is supported. A reused object receives the same
identity, a local glossary destination and a labelled canonical-source link.
This does not validate another page's anchors or remap a relation's canonical
provenance. Reusing an associated subgraph outside its declaration page is
currently refused when that provenance cannot be validated locally. KG's
project lifecycle remains responsible for complete occurrence/destination checks.

MK-0 currently accepts catalogues of `concept` and `assertion` objects and the
five relations above. Generic assertions without `math-kind` are outside the
mathematical glossary; referenced destinations still need real native anchors.
The standalone filter checks the fields it uses. KG's selected schema and
project lifecycle supply broader declaration and final-output validation.

A proof can declare `properties.proof-status`: `unverified`, `author-reviewed`
or `formal-candidate`; omission defaults to `unverified`. These are authored statuses. `author-reviewed` records
the author's claim of review; `formal-candidate` identifies a proposal. None
establishes an independently verified or kernel-checked proof. The native
statement, assumptions and proof bodies remain the authored mathematical source.

## Insert a static glossary

Add an empty native Div where the glossary should appear:

```markdown
::: {#maths-glossary .maths-glossary}
:::
```

The filter inserts ordinary definition-list blocks with source links and authored
relations/statuses. The list remains readable without JavaScript. The glossary
is a page-local view, not evidence that an entire website has been processed or
that absent mathematical dependencies do not exist.

Use `.proof` with a `prf-` identifier for a native proof. One explicit `proves`
relation supplies its `proof-for` association when absent. With Accessible Maths
selected afterwards, the same association supplies its authored proof controls.
An `.am-assumption` block can similarly receive `theorem-for` from an unambiguous
declared `assumes` relation. Existing conflicting associations are errors.

## Generate a finite definition

An empty native Div instantiates the built-in associativity-condition template:

```markdown
::: {#def-associativity .maths-instance template="associativity" carrier="G" operation="\circ" variables="x,y,z" name="Associativity condition"}
:::
```

Declare `#def-associativity` as a separate definition assertion in the catalogue
if it should enter the mathematical glossary. The filter constructs native
paragraphs and mathematics before Quarto processes theorem labels and references.
The generated text defines the **condition** of associativity for an
author-declared closed binary operation; it does not assert that an arbitrary
operation satisfies the condition or generate a proof.

This finite template checks parameter roles and a nominal symbol grammar, not
mathematical types in a proof assistant. `carrier` is one Latin letter or a
capital `\mathbb{G}`-style symbol. `operation` is `\circ`, `\cdot`, `\ast`
or `+`. `variables` defaults to `x,y,z` and must be three distinct Latin letters
different from the carrier symbol. Unknown parameters, capture, unsafe TeX,
existing body content and proof placement are errors. Arbitrary/nested templates
and transitive macro substitution are outside this finite language.

## Let readers choose notation

The runnable [notation website](examples/notation/index.qmd) contains two pages,
two distinct concepts sharing `\circ`, approved alternatives, reset controls and
the definition template. Copy the whole `examples/notation` folder to a new
consumer directory, install MK there from GitHub, and replace the copied
`_quarto.yml` filter selection with:

```yaml
filters: [kai-prince-sfhea/maths-knowledge-graph]
```

Then render or preview:

```powershell
quarto render --to html
quarto preview
quarto render index.qmd --to docx
```

For your own project, add the optional registry path:

```yaml
maths-knowledge-graph:
  declarations: knowledge.json
  notation: notation.json
```

[notation.json](examples/notation/notation.json) is literal JSON with numeric
`version: 1` and a `profiles` array. Every profile declares `id`, `concept`,
`scope`, ordered `roles`, `default`, and `variants`. Each variant requires `id`,
`label`, `tex` and `description`. The concept must be explicitly public in
`knowledge.json`, and its scope must match. For example, the demonstration uses
`{{left}} \\circ {{right}}` and
`\\operatorname{compose}({{left}},{{right}})` as author-approved alternatives.
Those displayed JSON forms contain escaped backslashes; see the complete file
for a copyable registry.

Mark only the occurrences that may change, using the profile's exact authored
default and one argument for each declared role:

```markdown
[$x \circ y$]{.maths-notation profile="composition" arg-left="x" arg-right="y"}

::: {#notation-preferences .maths-notation-glossary}
:::
```

The empty glossary Div accepts an optional `scope` and provides the control
surface. Choices affect only the declared concept/scope/profile. Unmarked maths,
theorem parameters, canonical declarations and mathematical assumptions keep
their authored meanings. Repeated notation uses carry their target in
`data-mk-concept`; they are not extra canonical concept declarations.

Arguments are single free Latin or supported Greek symbols with optional simple
subscripts, such as `x`, `x_i`, `x_{ij}` or `\alpha`. Templates must preserve
each role exactly once, the same role order and operation-token count. A small
nonbinding TeX vocabulary excludes arbitrary macros and variables outside roles.
Whitespace/alias differences from the authored default are not guessed. These
checks prevent some structural mistakes; **the author must review equivalence**.
The feature is not a general TeX parser, binder or notation translation system.

HTML alternatives are rendered through the existing native maths pipeline;
the browser switches their visibility without loading a second engine or
retypesetting. Controls use labelled native selects/buttons and polite status
text. Choices stay on the page unless the reader explicitly selects **Remember
my notation choices**. Opt-in persistence carries choices to other pages using
the same registry; a changed registry discards stale choices. Reset restores
authored defaults and removes old saved choices before writing an empty preference
record, so a full storage quota cannot restore an old choice. If the browser
actually refuses removal, reset applies on this page and warns that saved choices
may return after navigation. Export downloads preference JSON, and denied storage
retains page choices with a visible explanation. One shared polite status region
announces changes without repeating a message under every glossary entry.
There is no preference import or cloud
sync. The registry content token identifies a version; it is not a signature.

Without JavaScript, authored notation and the full static glossary remain
readable. Word/EPUB/Typst use the authored default. Browser printing uses the
currently visible alternative; browser choices do not change prebuilt Word/PDF
files. Actual speech, assistive-technology interpretation and equivalence still
need independent review. In particular, MK does not establish AM's experimental
intent/arg interpretation or dynamic speech compatibility by changing visibility.

## Options and disabling

Options use one namespace in normal Quarto metadata:

```yaml
maths-knowledge-graph:
  enabled: true
  declarations: knowledge.json
  # Optional; enable only with a notation registry:
  # notation: notation.json
```

| Option | Default and scope |
|---|---|
| `enabled` | `true` with the selected filter; `false` disables its work. |
| `declarations` | `knowledge.json` at the project root, or beside a standalone document; a trusted local JSON catalogue. |
| `notation` | Absent; optional trusted local literal JSON registry for explicit notation authoring. |

Unknown options and unsupported value types are errors. Boolean settings require
YAML booleans. Quarto supplies effective project/directory/document/format/profile
and metadata-file options; the extension does not read `_quarto.yml` separately.
The effective namespace is authoritative: a higher native metadata layer can
replace the mapping rather than preserve every project field. Put the complete
intended `maths-knowledge-graph` mapping at that layer, including nondefault
catalogue/notation paths. A metadata file does not force an override of an
explicit document mapping. `enabled: false` works when it is selected in the
effective mapping; unknown configuration keys are still refused. Removing the
filter is the unconditional opt-out.
Explicit paths follow Quarto's metadata rebasing to the input
document, then are normalized and checked to stay lexically inside the project
root (or standalone document directory). Source locations describe the containing page and native anchor;
they do not claim original include-file character offsets. Included text shares
its containing document's scope. Reading declarations is a trusted local-file
capability. Lexical path checks do not establish real-path confinement through
symlinks or Windows junctions; that confinement remains an unresolved acceptance
gate. Keep catalogue inputs trusted and do not describe this prototype as a
filesystem sandbox.

To disable the feature, set `maths-knowledge-graph.enabled: false` or remove the
filter from `filters`. Disabled processing reads neither catalogue nor registry.
There is no MK graph cache or model installation. Browser notation storage is
created only through reader opt-in. For a GitHub installation, manage it with:

```powershell
quarto list extensions
quarto update kai-prince-sfhea/maths-knowledge-graph --no-prompt
quarto remove kai-prince-sfhea/maths-knowledge-graph --no-prompt
```

For the local-source route instead, use
`quarto update extension "C:/path/to/maths-knowledge-graph" --no-prompt` and
`quarto remove maths-knowledge-graph --no-prompt`. Remove the filter selection
before uninstalling; review extension-only authoring markers as described below.

Ordinary renders read current catalogue/registry bytes. A small native website
preview fixture reflected a catalogue-only edit on a subsequent page request;
that is bounded evidence, not a universal watch guarantee for every file/layout.
If preview does not refresh after a data edit, rerender or edit the containing
QMD. Do not publish the raw catalogue as a resource merely to make it watched.

Installed [options.schema.json](_extensions/maths-knowledge-graph/options.schema.json)
and [notation.schema.json](_extensions/maths-knowledge-graph/notation.schema.json)
are reference schemas for explicit external validation. They do not register
automatic Quarto editor validation or replace runtime semantic checks.

## Optional composition with the other extensions

Accessible Maths owns accessible mathematical rendering and authored disclosure
controls. Knowledge Graph Extraction owns whole-project graph assembly, cache
validity, final destination verification and its optional navigation. This
extension supplies mathematical roles and a static page view.

For an HTML website project, install the two published dependencies if wanted:

```powershell
quarto add kai-prince-sfhea/accessible-maths --no-prompt
quarto add kai-prince-sfhea/knowledge-graph-extraction --no-prompt
```

Move filter selection from the example's front matter into `_quarto.yml` and
retain this order:

```yaml
project:
  type: website
  render: [example.qmd]
filters:
  - kai-prince-sfhea/maths-knowledge-graph
  - kai-prince-sfhea/accessible-maths
  - kai-prince-sfhea/knowledge-graph-extraction
maths-knowledge-graph:
  declarations: knowledge.json
knowledge-graph:
  declarations: knowledge.json
  schema: _extensions/kai-prince-sfhea/maths-knowledge-graph/maths-schema.yml
```

The MK installation includes the data-only [maths schema](_extensions/maths-knowledge-graph/maths-schema.yml).
Select it explicitly for KG. It extends KG's built-in `concept`/`assertion`
vocabulary and preserves existing `defines`/`requires` meanings. MK additionally
checks mathematical endpoint roles. Use one authoritative catalogue, and set
both `declarations` paths to that same file when changing its name. Installing
MK does not overwrite another project's schema or install its dependencies.
The tested optional companions are Accessible Maths **0.0.4** and Knowledge Graph
Extraction **0.0.6**. Other versions need compatibility checks. This configuration
uses GitHub installation paths; for a local MK copy, change its filter to
`maths-knowledge-graph` and its schema path to
`_extensions/maths-knowledge-graph/maths-schema.yml`.

`quarto-required` declares the Quarto version constraint, not an extension
dependency resolver. Quarto's documented `--embed` workflow bundles dependencies
inside custom formats; MK remains a lean standalone filter with explicit
optional installation. Its own notation assets use a named/versioned HTML
dependency only on pages that need them. See
[Quarto embedding guidance](https://quarto.org/docs/extensions/formats.html#extension-embedding)
and [HTML dependencies](https://quarto.org/docs/extensions/lua-api.html#html-dependencies).

The example's `amSquare` macro declaration is optional Accessible Maths input.
MK runs first so derived identities/associations and any glossary mathematics
reach Accessible Maths before its processing. The example uses ordinary visual
mathematics with Accessible Maths' default semantics setting; enabling its
experimental MathML annotation transport requires that extension's separate
pinned-engine configuration. MK does not add a maths engine or consume an
HTML declaration payload as an authoritative project snapshot.

KG requires a project for this integrated workflow. It contributes its own
prepare/finalize hooks; MK adds no hooks. Whole-project completeness and frozen
snapshots remain KG capabilities with their own evidence and limitations.

## Privacy, support and current boundaries

`public: false` omits a catalogue record from MK's glossary. It does not hide
ordinary page prose, source attributes, linked files or a source catalogue that
you publish separately. Keep confidential material outside publication inputs
and resources. The supplied private catalogue record is a synthetic omission
check; its canary label is never authored into the article body. The example
does not link to that catalogue as a website resource. Publishing the raw
catalogue separately would expose all of its records, regardless of eligibility.

Validation diagnostics use fixed field names and catalogue/registry entry
ordinals instead of rejected private values or IDs. An entry ordinal is not a
source line number. Ordinary renderer output, source attributes and native
tool logs can still contain authored or machine-specific data; review and
redact those privately before sharing a reproduction.

The tested baseline is Windows, Quarto **1.11.5 pre-release** and Pandoc **3.10**.
Native checks cover local installation/update/removal, disabled/unselected
operation, HTML/DOCX and reopened Word content, the original example, nested
Unicode paths, includes/citations, custom output, configuration layering and
existing hooks, literal data, invalid records and private canaries. Further
checks exercise the finite template and unmodified two-scope example, independently
reopen static notation DOCX/EPUB, compile a native Typst PDF, and render the new
features through unchanged AM/KG companions in an owner-qualified installation
layout. This is local dependency evidence, not a fresh GitHub installation.

Automated Edge/Chromium-family browser checks use the native MathML output to
exercise choices, scoped navigation, opt-in storage, reset/export, print and
JavaScript-disabled reading. Other renderers, platforms, concurrent renders,
custom theorem families and the full combination of Quarto features need their
own checks. A permissive manifest constraint does not establish support for every
Quarto version it accepts. Native LaTeX compilation and executed Python/Jupyter
cells have not been established by these fixtures.

The 0.0.3 follow-up reduces repeated template/notation scans, retains literal
data checks, and updates only the previous and next pre-rendered notation
variants when a choice changes. Unchanged default choices avoid visibility
writes. Bounded component measurements and exact native-output comparisons live
in the separate developer workspace; they do not establish a whole-site speedup.

Static source links and native lists support accessible reading; manual author,
assistive-technology and mathematical review remain separate acceptance work.
The finite template and scoped preferences do not implement arbitrary template
languages, general macro/type/binding inference, automatic terminology extraction,
AI generation, prose-to-Rocq conversion or proof checking. A dependency route
does not prove a proposition. Trust local inputs: real-path confinement through
linked directories remains unresolved, and no filesystem sandbox is claimed.

The maintainer is [Kai Prince](https://github.com/kai-prince-sfhea). No private
vulnerability-reporting channel is configured yet. Arrange a private contact route
through information the maintainer makes available before sharing sensitive
security details. Do not place those details in public issues. For a non-sensitive
bug report, use [repository issues](https://github.com/kai-prince-sfhea/maths-knowledge-graph/issues)
and include the extension, Quarto, operating system and browser versions and a
small non-confidential reproduction.

### Publication and verification scope

The public repository distributes the experimental source and runnable consumer
examples. It does not publish the separate developer workspace, tag a release,
freeze the authoring API or establish accessibility or mathematical acceptance.
Detailed verification reports remain outside this source package; the support
and reproduction limits below continue to apply.

## AI assistance and review

**OpenAI Codex materially assisted development**: design and source research,
implementation, debugging, optimisation, documentation, original synthetic
examples/catalogues, test harnesses and expected results. AI also assisted code
review and interpretation of automated checks. This is not a claim of independent
human authorship or review. AI-assisted fixtures and expected outcomes are
development evidence; passing them does not establish mathematical correctness,
notation equivalence, accessible speech, WCAG conformance or educational benefit.
Independent author, mathematical and manual assistive-technology review remain
open.

The maintainer retains responsibility for reviewing contributions, rights,
claims and publication. No institutional approval or University of Manchester
policy-compliance result is claimed. University-affiliated use needs the applicable
institutional, research, teaching, confidentiality and publisher rules checked for
that activity.

The installed MK runtime makes no AI requests and generates no proof text.
Developer tests, planning documents and detailed evidence live outside this
lean extension folder. The public user package alone does not reproduce that
complete development workflow. Detailed native/browser/preview reports and exact
candidate hashes are retained separately. Developer evidence and the complete AI
session/prompt history are not distributed in this source package, so its full
development verification cannot currently be reproduced from this repository
alone. The included examples remain independently installable and runnable. This
development disclosure is separate from runtime AI; MK makes no model requests
and does not generate or rewrite proof text.

## Versions, updates and migration

The `0.0.x` interfaces are experimental: a patch update can tighten validation or
change an authoring contract. The current catalogue is version 0 and the optional
notation registry is version 1. Unsupported versions are refused rather than
silently reinterpreted. There is no automatic migration from the original Schema
extension or a general migration tool. Read the [changelog](CHANGELOG.md) before
updating; previously admitted invalid declarations may need explicit correction.

Keep a working copy of your installed `_extensions`, authored pages, catalogue
and notation registry in version control. Try an update in a separate consumer
copy, rerender and review identities, assumptions, template statements, approved
notation equivalence and links before adopting it. Use the GitHub update command
for a GitHub installation, or the same source-path command for a local copy.
To roll back, restore
the matching installed extension and authoring inputs together. Changed registry
bytes invalidate remembered notation choices; browser preferences are not a
backup of the authoring inputs.

Before uninstalling, remove the filter from your configuration. Review any
`.maths-instance`, `.maths-glossary` and notation markers that need ordinary authored
replacement content, then run the removal command above. Existing native theorem
and proof bodies remain authored content. No MK graph cache or model needs removing.
GitHub and local installations have different namespaces; retain the appropriate
selectors and paths when restoring a working copy.
[Quarto extension management](https://quarto.org/docs/extensions/managing.html)
and [distribution](https://quarto.org/docs/extensions/distributing.html) describe
the different installation routes.

## Licence

Copyright 2026 Kai Prince. Original extension code, documentation and the
synthetic example/catalogue use [Apache License 2.0](LICENSE). The [installed
licence](_extensions/maths-knowledge-graph/LICENSE) travels with the runtime.
This does not choose a licence for a consumer's research, prose, data or models.
Optional dependencies retain their own notices and terms.

No Quarto, Pandoc, MathJax, third-party JSON/YAML parser, font, model weight or
browser inference runtime is bundled. Quarto supplies the renderer and Lua/Pandoc
APIs under its distribution's own terms; optional Accessible Maths and Knowledge
Graph Extraction retain their separate licences. Any maths engine, fonts or other
assets you configure remain your separately selected dependencies. This is not a
rights review of every resource in a consumer's website.

Generated HTML can redistribute MK's JavaScript and CSS. Retain their copyright
and Apache notices and include the installed [licence](_extensions/maths-knowledge-graph/LICENSE)
and [copyright/assistance notice](_extensions/maths-knowledge-graph/COPYRIGHT)
when redistributing those assets. The supplied code and synthetic material are
covered by this package's Apache terms; these terms do not automatically license
your research, prose, graph data or third-party dependencies.
