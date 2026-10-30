# Maths Knowledge Graph

An experimental Quarto extension that connects explicit mathematical concepts,
definitions, assumptions and authored proofs, produces a static glossary, and
supports a finite definition template and scoped reader notation preferences.
Authors keep native theorem blocks, mathematical notation and cross-references.
Readers can follow the glossary to the original text and distinguish a statement,
its conditions and its associated proofs.

The **0.0.9 experimental development source** uses a local catalogue and explicitly
approved notation alternatives. It does not infer mathematical truth or link
matching words. Optional features include a finite associativity template,
portable notation choices and a controlled-English proof candidate compiler.
An explicitly configured external kernel can check a generated certificate;
that result does not certify its correspondence to the original mathematics.
Knowledge Graph Extraction owns whole-project graph assembly.
Native helper and catalogue paths use Quarto's native document context. This
avoids depending on differently encoded Windows project metadata or relative
module search paths. It does not change publication, scope or source-review
requirements, and is not a claim of arbitrary Unicode portability.
Version 0.0.9 separates model-proposed clause meanings from deterministic proof
construction. It also adds explicitly selected typed profiles for constructive
quantifiers/equality and natural-number induction. These remain finite
experiments: a generated derivation need not follow the original proof's
reasoning, and a type-checking certificate does not establish source fidelity.
Earlier 0.0.7/0.0.8 native, browser and kernel results retain their own source
snapshots. Both earlier positive Gemma attempts invented an undefined premise
and were withheld; those failed results remain recorded. Current verification
is recorded separately below. The source is distributed from experimental `main`,
not as a supported tagged release.
[AI assistance is disclosed below](#ai-assistance-and-review).

## Install and try the example

Install the development source from your document/project directory:

```powershell
quarto add kai-prince-sfhea/maths-knowledge-graph --no-prompt
```

The GitHub command follows the experimental `main` branch. For a local checkout
or extracted source, replace the path with its source folder on your computer:

```powershell
quarto add "C:/path/to/maths-knowledge-graph" --no-prompt
```

Open the [example.qmd tutorial](example.qmd) in your editor. In a consuming
directory, copy both that article and [knowledge.json](knowledge.json), then
select `filters: [kai-prince-sfhea/maths-knowledge-graph]` for a GitHub
installation or `filters: [maths-knowledge-graph]` for a local installation.
The tutorial guides rendering, following a glossary link, making one label
change, and exploring its authored proof/assumption relations.

Use your editor's normal **Render** or **Preview** command, or run
`quarto render example.qmd --to html`. Word uses `--to docx`. The tutorial needs
no AI model or companion extension and its instructions remain readable in the
rendered output. This README contains the advanced authoring, options and
cross-extension reference.

A GitHub installation lives under
`_extensions/kai-prince-sfhea/maths-knowledge-graph/`; a local installation uses
`_extensions/maths-knowledge-graph/`. Keep the filter and schema paths consistent
with the route you chose. Installation copies only `_extensions`; copy runnable
examples separately. A source checkout can render its included article directly.

## Choose the smallest authoring setup

Start with native theorem blocks and a literal `knowledge.yml` catalogue. Use
your editor's ordinary **Render** or **Preview** command after editing either
file; if a catalogue-only edit is not picked up by Preview, run Render again.
No author-written JavaScript or data-conversion command is needed.

| What you want | Add to your normal QMD/YAML authoring |
|---|---|
| A static mathematical glossary | Public concept/assertion declarations with source anchors, then an empty `.maths-glossary` Div. |
| Reuse reviewed native definitions | Select the compatible Accessible Maths companion after MK, enable its catalogue and mark the native definitions for review/publication. MK imports them on the same render; no duplicate catalogue file is required. |
| Proof and assumption disclosures | Select Accessible Maths after MK. A single explicit `proves` or unambiguous `assumes` relation supplies the association; you do not need to type it twice. |
| Reader notation choices | Add a literal YAML/JSON notation registry, mark the permitted occurrences and place a `.maths-notation-glossary` Div. |
| A draggable mathematical graph and website search | Select compatible Knowledge Graph Extraction alongside MK. MK supplies its selected public native objects to a separate `maths` graph; KG builds its navigation and search after rendering. |

For an existing mixed website catalogue, set `maths-knowledge-graph.scopes` to
the exact mathematical scopes you want to use. A scope selects declarations;
the separate `graph.id` option names the mathematical graph. Knowledge Graph
Extraction owns graph assembly and navigation. See the complete
[composition recipe](#optional-composition-with-the-other-extensions).

### Reuse an Accessible Maths definition

With local MKG 0.0.7 and Accessible Maths 0.0.8 installed, this complete QMD
uses the normal Render/Preview workflow without a `knowledge.yml` file:

```markdown
---
title: A first reviewed mathematical glossary
filters: [maths-knowledge-graph, accessible-maths]
accessible-maths:
  catalogue: true
maths-knowledge-graph:
  scopes: [algebra]
---

::: {#def-square name="Square" semantic-id="https://example.org/maths/square" am-review="author-reviewed" am-public="true" am-scope="algebra"}
The square of a real number $x$ is $x\cdot x$.
:::

::: {.maths-glossary}
:::
```

For GitHub-installed copies, use the matching owner-qualified filter names.
Install compatible development-source companion versions for this interface.
The basic example above needs no experimental MathJax
configuration or AI model. Accessible Maths' separate intent/speech experiment
has its own opt-in engine requirements.

MKG imports automatically when its compatible separately installed producer is
present and `accessible-maths.catalogue: true` opts in. Individual declarations
still require all three explicit review, public and knowledge-scope attributes.
Keep MKG before Accessible Maths. Installing files alone does not enable that
companion's rendering controls. Set `import-accessible-maths: false` inside the
MKG mapping to disable this import while retaining an explicit catalogue.

The 0.0.8 and current 0.0.9 API payloads have separate exact admission hashes.
Current native import checks use 0.0.9, including its correction for foreign
content that shares a language-independent URI. Older 0.0.8 retains its own
bounded contract; admitting it does not establish every newer feature
combination. A missing, unadmitted, disabled, altered or ambiguous producer cannot supply trusted imports;
the glossary reports the unavailable import and preserves ordinary explicit
declarations. An eligible empty catalogue is a distinct outcome. Reinstall a
compatible pair rather than editing their admission hashes.

Knowledge `scopes` select which public records enter this view. An AM lexical
`.am-macro-scope` is a separate notation boundary: local definitions keep that
scope in the glossary and never become global MKG substitution profiles. Public
review labels report author decisions, not mathematical truth or rights grants.
Safe HTTP(S) and URN identities remain distinct from their native page/fragment
destinations. A conflicting canonical identity, native anchor, kind or scope is
an error. An existing matching canonical declaration retains its chosen label.

This interface supplies the page-local MKG glossary. With compatible Knowledge
Graph Extraction selected after MKG and Accessible Maths, the normal project
render also passes those selected public objects to KG's producer interface.
The default graph ID is `maths`; its label is Mathematics. It has independent
navigation while remaining included in website graph search. The finalizer
creates the navigation only after validating the current project render. A
standalone glossary without that coordinator does not invent a ready graph.

Change these advanced defaults inside the effective MKG mapping:

```yaml
maths-knowledge-graph:
  scopes: [algebra]
  graph:
    id: algebra
    label: Algebra
    navigation: true
    search: true
    placement: placeholder
```

For `placement: placeholder`, put one empty `.maths-graph` Div outside theorem,
definition and proof environments. The default `append` placement needs no Div.
Use `graph: false` to disable this transfer, or `navigation: false` to retain a
searchable graph without a page graph view. `search: false` excludes that graph
from KG's federated search. Public review and proof-status qualifications remain
visible in the graph data; no mathematical correctness or content licence is
inferred. KG owns its cache, partial-render and reset instructions.

## Author explicit mathematical objects

[knowledge.json](knowledge.json) remains a runnable JSON example. Authors can
instead use a literal `knowledge.yml` or `knowledge.yaml`, with Knowledge Graph
Extraction's version 0 declaration shape: namespace
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

The catalogue is read as literal data: Markdown punctuation is not interpreted
as formatting and TeX backslashes are preserved. The same single-theorem example
can be written as `knowledge.yml`:

```yaml
version: 0
namespaces:
  math: https://example.org/maths/
sources:
  - path: example.qmd
objects:
  - id: math:positive-square
    type: assertion
    scope: real-arithmetic
    labels:
      en: Positive squares
    public: true
    source:
      path: example.qmd
      anchor: thm-square
    properties:
      math-kind: theorem
relations: []
```

When no MK `declarations` option is supplied, MK first reuses the effective
`knowledge-graph.declarations` option, then looks for `knowledge.yml`,
`knowledge.yaml`, or the original `knowledge.json` at the project root (or beside
a standalone document), in that order. Set an explicit path if several files
exist; MK never merges them. Updating that one catalogue and rendering again
updates the mathematical view; authors do not run a conversion script.

YAML supports block mappings/sequences, flow collections, plain scalars,
single-quoted strings, JSON-compatible double-quoted strings and literal `|`,
`|-`, `|+` blocks. Use single quotes for TeX, such as `notation: '\circ'`,
and double a single quote inside a single-quoted string (`'L''action'`). Quote
dates, leading-zero identifiers and any numeric-looking text. Numeric versions
must remain unquoted, and publication flags must be Boolean `true`/`false`.
For long literal text use `|` rather than folded `>`. YAML aliases, anchors,
tags, merge keys, duplicate keys, multiple documents, folded blocks, ambiguous
numeric forms and tab indentation are refused. This is a documented bounded
YAML subset, not every YAML feature. JSON remains fully supported; escape
backslashes there, for example `"notation": "a\\{b\\}c"`.

Use the corresponding native block:

```markdown
::: {#thm-square name="Positive squares"}
For every nonzero real number $x$, the square $x^2$ is positive.
:::

See @thm-square.
```

Numbered `@...` references follow Quarto's project rules: website pages use
local references and ordinary links such as `[definition](notation.qmd#def-example)`
to other pages. Numbered references across files require a
[book project](https://quarto.org/docs/books/book-crossrefs.html). The extension
preserves native numbering rather than adding a second cross-file numbering system.

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

[notation.json](examples/notation/notation.json) is a literal JSON example with numeric
`version: 1` and a `profiles` array. Every profile declares `id`, `concept`,
`scope`, ordered `roles`, `default`, and `variants`. Each variant requires `id`,
`label`, `tex` and `description`. The concept must be explicitly public in
the configured catalogue, and its scope must match. For example, the demonstration uses
`{{left}} \\circ {{right}}` and
`\\operatorname{compose}({{left}},{{right}})` as author-approved alternatives.
Those displayed JSON forms contain escaped backslashes; see the complete file
for a copyable registry.

The same registry can be written as `notation.yml`. This single-profile example
works with the demonstration's public `demo:composition` concept in the
`algebra` scope:

```yaml
version: 1
profiles:
  - id: composition
    concept: demo:composition
    scope: algebra
    roles: [left, right]
    default: infix
    variants:
      - id: infix
        label: Infix composition
        tex: '{{left}} \circ {{right}}'
        description: The authored composition glyph, with the left argument first.
      - id: named
        label: Named composition
        tex: '\operatorname{compose}({{left}},{{right}})'
        description: An author-approved named form for this synthetic concept.
```

Set `maths-knowledge-graph.notation: notation.yml` to select it. Keep the complete
effective MK mapping, including any custom catalogue path or scope selection,
at that metadata layer. For a catalogue of your own, replace the concept, scope
and approved descriptions together; a matching glyph alone is not an identity.

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
Import accepts a local preference JSON file from the same registry, preserving
compatible choices for other pages without enabling browser persistence. Invalid,
oversized or stale files leave current choices unchanged. There is no cloud
sync. The registry content token identifies a version; it is not a signature.
Variant labels, descriptions and concept labels are authored text. Generated
notation-control messages currently use English; changing the document's `lang`
does not automatically translate those messages.

Without JavaScript, the notation selected during rendering and the full static
glossary remain readable. Static writers use the same native AST selection;
browser printing uses the currently visible alternative. Browser choices do not
change prebuilt Word/PDF files. Actual speech, assistive-technology interpretation and equivalence still
need independent review. In particular, MK does not establish AM's experimental
intent/arg interpretation or dynamic speech compatibility by changing visibility.

### Page defaults, required notation and portable preferences

For each declared notation profile, selection follows this order:

1. A page's `notation-overrides` choice, which locks that page's control.
2. A validated reader choice for the exact concept, scope and profile.
3. A page's `notation-defaults` choice.
4. The registry profile's `default`.

Defaults and overrides map profile keys to declared variant keys. An override
does not erase the reader's preference for other pages. Keep the source expression
equal to the registry's canonical default even when the page initially displays
another variant; this check detects an inconsistent authoring marker.

For the composition profile above, the following mapping supplies a page default:

```yaml
maths-knowledge-graph:
  notation: notation.yml
  notation-defaults:
    composition: named
  # Lock this page to a variant only when its context requires it:
  # notation-overrides:
  #   composition: infix
```

Use **Export notation choices** in the rendered glossary, save the downloaded
JSON inside the project, and opt into it for a subsequent native render:

```yaml
maths-knowledge-graph:
  notation: notation.yml
  notation-preferences: notation-choices.json
```

Keep other required MK options in the effective mapping. The exported JSON is
limited to 64 KiB, depth 8 and 128 distinct context choices. It must identify the
current registry and contain only the documented version, token, enabled and
choices fields. Native selection uses its explicit choices even when browser
remembering was disabled; importing a file never enables persistence. A changed
registry requires a fresh export. The selected native Math nodes reach Word,
EPUB and PDF writers rather than being an HTML-only substitution; review those
outputs with the notation and fonts appropriate to your content.

## Optional controlled-English proof candidates

This experimental feature compiles a small explicit propositional language into
a closed Rocq certificate. It preserves the authored statement and proof body.
It does not translate unrestricted mathematical prose, accept arbitrary Rocq
commands, call an AI model or establish that the formal encoding matches the
original statement.

To try it, keep the existing `example.qmd` tutorial and `knowledge.json` together.
Add `formal-proofs` to that article's existing MK mapping, keeping its other
options, and append the following native theorem/proof blocks. The complete
relevant front matter is:

```yaml
---
title: "Positive squares and a controlled proof example"
filters: [maths-knowledge-graph]
maths-knowledge-graph:
  declarations: knowledge.json
  formal-proofs:
    enabled: true
---
```

Use the owner-qualified filter selector for a GitHub installation. The appended
blocks are an original synthetic example, separate from the square theorem:

````markdown
::: {#thm-controlled-implication}
If proposition $P$ holds and $P$ implies $Q$, then $Q$ holds.
:::

::: {#prf-controlled-implication .proof .maths-formal-proof proof-for="#thm-controlled-implication"}
This selected fragment makes the propositional assumptions explicit.

```{.maths-proof}
Let P, Q be propositions.
Assume hp: P.
Assume himp: P implies Q.
Then hq: Q by applying himp to hp.
Conclude hq.
```
:::
````

Every `.maths-formal-proof` requires a native `prf-` identifier, exactly one
`.maths-proof` fence, and an existing theorem, lemma, proposition or corollary
target on the same page. The `proof-for`, `formal-target` and `am-theorem`
associations must agree when more than one is supplied. Up to 32 explicitly
selected fragments are admitted per document. Unsupported language or an invalid
inference keeps the original body with an explanation and no certificate claim.

The language declares capitalized proposition names, then labelled assumptions,
labelled derivation steps and one `Conclude` line. Formulas support `true`,
`false`, `not`, `and`, `or`, `implies` and parentheses. The finite step phrases
are `applying … to …`, `combining … and …`, `taking the left part of …`,
`taking the right part of …`, `choosing the left alternative …`,
`choosing the right alternative …`, `contradiction from …`, `repeating …`
and `truth`. Assumptions precede steps; references must already exist and every
step must establish its stated result. This is a finite language with size bounds,
not a general natural-language proof engine.

Supported fragments add a readable generated certificate in native outputs.
Bootstrap HTML also supplies an inert candidate and explicit controls to inspect
or download it, download the Rocq certificate, record a local mapping review or
record a mismatch. No kernel request runs automatically. Code-block-local spans
use UTF-16 units relative to LF-normalized text. Where a native statement, proof
or literal controlled-proof fence can be located uniquely, additional original
file ranges retain original BOM/CRLF coordinates, file and selected-span hashes.
Included files keep their own source identity. Partial or unavailable mappings
are labelled separately; quoted, transformed or ambiguous text never receives a
guessed exact range. Certificate identifier ranges and observed packaged compiler
byte hashes support inspection, not semantic equivalence or execution attestation.
Local reviewer names and decisions are declarations, not authenticated approvals.

Use **Download mapping review** to save an explicit local decision separately
from the candidate. **Import an existing mapping review JSON file** accepts a
UTF-8 JSON receipt of at most 64 KiB, validates it against the current candidate
and preserves any existing valid review when an import is stale or invalid.
Imported decisions remain labelled unauthenticated local declarations. Importing
does not run a kernel, enable storage or publish approval. **Remove local review**
clears the in-memory decision; there is no automatic persistence.

## Ordinary prose, private proposals and reviewed public output

You can keep a native proof in ordinary prose and optionally ask an already
running local language model to propose a controlled encoding. This is an
**author command**, separate from Render/Preview. It requires a separately
installed compatible Knowledge Graph Extraction extension for its local-server
transport. No model is bundled, downloaded or called by rendering.

The current formal target is constructive propositional logic. A proof about
quantified objects, arithmetic, equality or unspecified mathematical definitions
may remain unsupported. The model must report unresolved material; neither a
valid encoding nor a successful kernel check establishes that the original
mathematics was translated faithfully.

First add the planned public projection filename to your ordinary proof. Keep
the existing `formal-proofs.enabled: true` setting. This original synthetic
example uses no private personal information:

```markdown
::: {#thm-identity}
If a proposition holds, that same proposition holds.
:::

::: {#prf-identity .proof .maths-formal-proof proof-for="#thm-identity" proof-proposal="reviewed-proof.json"}
Suppose the proposition holds. It therefore holds by that same supposition.
:::
```

Keep the complete original proof body. An imported proposal replaces the
separate `.maths-proof` code fence, not your prose. Do not put private data,
prompts, model responses, API credentials or review receipts in QMD or a public
repository.

Create an existing private folder outside your project and **every Git checkout**,
for example `D:/Private/QuartoAI`. Save `local-proof.yml` in that private folder,
using the actual name served by your installed local AI program. Gemma 4 E2B is
the default profile; a server-reported name does not attest which weights ran.

```yaml
version: 1
provider: local-openai
base-url: http://127.0.0.1:8941/v1
model: gemma-4-E2B
timeout-seconds: 120
max-tokens: 2048
# Optional: api-key-env: LOCAL_AI_TOKEN
```

The helper accepts this flat literal YAML mapping or JSON. Use one key per line;
aliases, tags and duplicate keys are refused. An optional API token belongs in
the named process environment variable, never in this file or page. The helper
does not automatically read a `.env` file. Use your normal local environment
loader if required. Only explicit literal-loopback IPv4/IPv6 endpoints and a
compatible separately installed transport are admitted; there is no cloud
fallback.

After replacing the installation selector, source and private folder, run this
from your project directory. `--config` is relative to the private workspace:

```powershell
quarto run _extensions/kai-prince-sfhea/maths-knowledge-graph/proof-propose.ts propose --source article.qmd --proof prf-identity --statement thm-identity --config local-proof.yml --workspace "D:/Private/QuartoAI" --output identity-private.json
```

That explicit command sends only the complete selected original proof and
statement blocks, including their Markdown, to your configured local server.
It retains a private proposal containing exact source hashes, model-reported
provenance, original response, complete source-unit coverage and unresolved issues. It
does not publish or approve anything. Source spans use UTF-16 code units; they
locate text rather than establish its meaning. Unsupported spans or source
changes during generation are refused; text is never silently clipped.

The default command also records private hashes of the exact prompt, response
schema, configuration, admitted transport and ten proposer modules. It rechecks
the captured files before saving and before publishing a reviewed projection.
If you edit that configuration or update the installed proposer, make a new
proposal. These are observations of file bytes, not proof of model identity or
executed code. Existing unobserved proposals keep their explicit compatibility
route and are labelled accordingly; no observation is added retroactively.

By default the model proposes a formula and role for each host-owned content
unit. Checked code owns the original wording, coordinates and clause keys. Only
explicit initial assumptions may be global premises; a later asserted conclusion
is never added as a hypothesis. Local or ambiguous scope remains unverified.
The model returns one decision per unit and a closed formula syntax tree;
checked code converts that tree to the existing mathematical syntax. This avoids
ambiguous formula strings and overlapping mapped/unresolved lists. Structural
admission still does not establish that a formula means the same as its source.
Bounded constructive search then attempts a **new derivation of the proposed
encoding**. It does not certify the original argument or the model's reading.
Inspect the separate source-step audit and its missing-support/unknown results.

The older model-authored controlled-program workflow is available explicitly
with `--proposal-format controlled-v1`. To read an existing project-local
generation configuration, also specify `--config-location project`; there is
no automatic fallback or search for a secret file. Private responses and review
receipts still require the external workspace.

Inspect the private JSON in your normal editor. Check every premise, conclusion,
negation, scope and source correspondence. If the candidate is supported, has no
reported unresolved issues, and you decide the selected source and encoding are
suitable for public release, explicitly produce the public projection:

```powershell
quarto run _extensions/kai-prince-sfhea/maths-knowledge-graph/proof-propose.ts publish --workspace "D:/Private/QuartoAI" --proposal identity-private.json --reviewer "Your name or private pseudonym" --confirm-public-source --accept-encoding --receipt identity-review-private.json --output reviewed-proof.json
quarto render article.qmd
```

The raw response, server details and named review receipt stay in that external
private folder. The public JSON contains only the deliberately reviewed
controlled proof, its selected already-public source, clause interpretations and
coverage/audit data, and an
unauthenticated declaration of review/AI assistance. A declaration does not
authenticate a reviewer or establish semantic equivalence. Render/Preview admits
only that public projection, rechecks the current exact original source and
preserves your ordinary prose. Raw private proposals cannot be rendered.

No existing output is overwritten. After a source revision, create fresh private
proposal/review filenames, inspect the revision, intentionally remove the old
public projection and publish its replacement to the same planned public
filename. Stale imports fail closed. Keep all private records out of GitHub.
Private review and public projection writes are separate operations; if the
second fails, a private declaration may exist without a delivered public file.

The rendered controls separately show the complete selected public source,
proposed encoding and source bindings. Existing mapping review/export and
optional kernel checks remain independent. The external kernel receives the
controlled candidate, not the private raw model response. Only its generated
certificate is checked.

### Constructive subproofs and case analysis

You may also write the controlled form yourself without a model. In addition to
the original finite rules, the structured fragment supports explicit local
subproofs, implication introduction and disjunction elimination:

```text
Let P be a proposition.
Begin subproof identity with hp: P.
Then same: P by repeating hp.
End subproof identity with same.
Then result: P implies P by introducing identity.
Conclude result.
```

The local hypothesis `hp` is discharged inside the generated implication. It is
not an established fact or an extra global premise. Nested subproofs can use
available ancestor hypotheses; inner labels cannot escape. Labels must be
globally unique within the selected fragment. At most eight nested subproofs and
128 combined local/derived entries are admitted.

For cases, `Then result: R by cases choice using left and right.` requires
`choice: P or Q`, `left: P implies R` and `right: Q implies R` already available.
Both branches must reach the stated result. The compiler emits constructive
lambda/Init.Logic terms, never model-authored Rocq commands, tactics, imports,
axioms or `Admitted`. The original v1 controlled syntax retains its original
descriptor and certificate form; structured syntax has a separate v2 identity.
Old external host bridge copies must be updated to the current original bridge
files before they can regenerate and check a structured candidate.


### Explicit typed quantifiers, equality and natural-number induction

The advanced `typed-fol-eq-v1` and `typed-nat-induction-v1` profiles accept closed
JSON data in the same `.maths-proof` fence. Select the profile explicitly on its
native proof block with `formal-profile`; an invalid or unknown profile never
falls back to a different compiler. No model is needed for this route. These
profiles do not parse arbitrary prose or accept submitted Rocq commands.

For example, after enabling `formal-proofs.enabled`, paste this self-contained
native theorem/proof pair into a QMD page. Its uninterpreted type may be empty;
no witness or extra hypothesis is invented:

````markdown
::: {#thm-typed-identity}
For every item $x$, if $P(x)$ holds, then $P(x)$ holds.
:::

::: {#prf-typed-identity .proof .maths-formal-proof formal-target="#thm-typed-identity" formal-profile="typed-fol-eq-v1"}
Fix an arbitrary item. The conclusion is exactly the stated local assumption.

```{.maths-proof}
{
  "version": 1,
  "profile": "typed-fol-eq-v1",
  "signature": {
    "sorts": ["Item"],
    "functions": [],
    "predicates": [{"id":"P","args":["Item"]}]
  },
  "assumptions": [],
  "proof": {
    "id": "generalise", "rule": "forall-intro",
    "variable": {"id":"w","sort":"Item"},
    "body": {
      "id": "identity", "rule": "implies-intro",
      "assumption": {
        "id": "hw",
        "formula": {"kind":"predicate","id":"P","args":[{"kind":"var","id":"w"}]}
      },
      "body": {"id":"useAssumption","rule":"hypothesis","name":"hw"}
    }
  },
  "conclusion": {
    "kind": "forall", "variable": {"id":"x","sort":"Item"},
    "body": {
      "kind": "implies",
      "left": {"kind":"predicate","id":"P","args":[{"kind":"var","id":"x"}]},
      "right": {"kind":"predicate","id":"P","args":[{"kind":"var","id":"x"}]}
    }
  }
}
```
:::
````

The typed profile requires declared sorts and function/predicate signatures.
Universal introduction checks a fresh local variable; existential introduction
requires an actual typed witness. Scoped existential elimination prevents its
witness escaping. Equality supports reflexivity, symmetry, transitivity,
congruence and transport through an explicitly checked formula motive. It uses
structural substitution, not textual replacement.

`typed-nat-induction-v1` additionally reserves `Nat`, zero, successor and addition.
Induction requires exactly a zero case and a scoped successor case with its
induction hypothesis; it emits the fixed `nat_ind` principle. It does not silently
change integers into naturals or import an unproved lemma. Missing/mismatched
branches, cross-sort equalities, escaping witnesses and arbitrary commands are
refused. Input size, recursion, proof nodes and certificate size are bounded.

The rendered source inspection includes declared types, symbols, local binders,
witnesses and induction obligations. Typed candidates have separate versioned
compiler/mapping identities and regenerate from their complete controlled data.
The original propositional v1/v2 syntax and certificates retain their own
identities. Review, kernel acceptance and the original mathematical claim remain
separate for every profile.

### Optional external Sandbox-compatible kernel

Certificate generation needs only the installed Quarto runtime; no author Node
installation, model or proof engine is required. Reader checking is a separate
opt-in deployment. Supply a compatible Argumentation Sandbox distribution with
the exact Coq **8.20.1** / jsCoq **1.99.2** runtime and matching library assets
identified by the installed adapter's pins. Neither that distribution nor its
kernel, libraries or AGPL-covered jsCoq code is bundled with MK.

The `mkg-kernel-v1` bridge checks the explicit typed certificate profiles described
above. Generative Websites' Sandbox scenario interchange has its own finite
Boolean/Horn contract; typed MK certificates use this kernel bridge.

Copy these eight original MK bridge files from the installed extension into a
single `mkg/` directory served on the **same origin as that Sandbox runtime**:

- `kernel-host.html`
- `kernel-host.js`
- `kernel-adapter.js`
- `kernel-inspector.js`
- `proof-candidate.js`
- `proof-mapping.js`
- `proof-profiles.js`
- `proof-typed.js`

Keep the Sandbox runtime's expected `/runtime/`, `/data/` and `/vendor/rocq820/`
paths and its own copyright, source-availability and licence obligations. Point
the authored page at the copied HTML host, replacing this example address:

```yaml
maths-knowledge-graph:
  declarations: knowledge.json
  formal-proofs:
    enabled: true
    kernel-host: https://sandbox.example.org/mkg/kernel-host.html
    timeout: 90
```

`kernel-host` requires HTTPS, except HTTP loopback for local testing; credentials,
query strings and fragments are refused. The timeout is an integer from 15 to
120 seconds, default 90. Configure the site's CSP to permit its intended frame
and the host's deployment policy to permit the parent; this is a separate hosting
decision. Origin/session/nonce checks are not user authentication.

Only **Check candidate with proof engine** loads the configured host and sends
the selected candidate there. The host verifies pinned transferred bytes and
positive/negative kernel health controls before checking the regenerated closed
certificate. A server or service worker could change later execution responses;
this is not execution attestation. Cancellation, timeout, unavailable runtime and
rejection remain distinct outcomes. Acceptance means the pinned kernel accepted
that generated certificate. It does not establish source-mapping fidelity or
validate the original prose.

Compatible clients and hosts separately inspect the regenerated certificate
using fixed `Print Assumptions` and `Print Typing Flags` commands. The receipt
distinguishes a closed global context, reported global assumptions and unknown
output. It retains the declared hypotheses as quantified premises: a closed
global context does not establish those premises as facts. The reader can inspect
the bounded receipt separately from the local source review. Ordinary typing
flags and real closed/axiom/false health controls are required before the adapter
can report a closed inspection. Missing, unsupported, stale or malformed feedback
cannot receive that result. No authored Rocq command or arbitrary import runs
through this interface.

Older compatible hosts retain `not-performed` inspection status. New clients use
an internal capability flag; authors do not add a query string to `kernel-host`.
An optional inspection failure leaves an independently accepted certificate's
status separate. The 0.0.7 inspection adapter has been checked against its pinned
real worker using bounded closed, axiom-bearing and false controls. That result
does not establish arbitrary Rocq-toolchain compatibility or mathematical truth;
protocol-unit checks alone do not establish actual kernel output.

## Qualified relation reuse

An occurrence of a concept does not copy its canonical relationships. To reuse
one public relation on a page, declare both endpoint occurrences on that page
and explicitly request the relation's canonical identity, authored revision and
assumption digest:

```yaml
maths-knowledge-graph:
  declarations: knowledge.yml
  reuse-relations:
    - id: math:reviewed-dependency
      revision: author-review-2
      assumptions-sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

Replace the illustrative digest with your own reviewed assumption digest. The
selected relation must be public and in scope, with catalogue properties
`assertion-revision: author-review-2` and `assumptions-sha256` exactly matching
the request. Both public endpoint declarations must identify native anchors on
the containing page. Requests are limited to 128 distinct relation IDs.
The reused relation retains its canonical source and records its explicit reuse
context. These revision/hash declarations do not infer semantic equivalence,
transfer every relation or prove that assumptions are correct. A missing,
private, filtered or mismatched request is refused with a generic diagnostic.

## Match your website's appearance

The static glossary uses ordinary native Quarto definition lists. Its placement,
heading and surrounding content remain authored QMD. The optional notation
controls inherit the page's font and text colour, use the native Quarto body
background and keep minimum 44-CSS-pixel select/button heights.

No stylesheet is required. If you want a different appearance, use Quarto's
ordinary HTML CSS setting and a local stylesheet:

```yaml
format:
  html:
    css: styles.css
```

```css
/* styles.css */
:root {
  --mk-panel-radius: .6rem;
  --mk-panel-padding: 1rem;
  --mk-control-radius: .4rem;
}
```

The supported properties are `--mk-panel-border-color` (`currentColor`),
`--mk-panel-radius` (`0`), `--mk-panel-padding` (`.75rem`),
`--mk-panel-spacing` (`.5rem 0 1rem`), `--mk-control-radius` (`.25rem`),
`--mk-control-background` (the Quarto body background, falling back to `Canvas`)
and `--mk-focus-color` (`currentColor`). Set them on `:root` for the whole page
or on a containing authored class for one section. Public class hooks are
`.maths-notation-panel`, `.maths-notation-persistence`, `.maths-notation-status`,
`.maths-notation-controls` and `.maths-notation-variant`.

Retain the variant's native `hidden` behaviour, visible focus and readable
contrast; do not use styling to show several alternatives as one expression.
Forced-colour mode uses system colours. Presentation changes do not alter
approved choices, notation identity or opt-in persistence. Edit your own
stylesheet rather than the installed extension, so an update keeps your styles.

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
| `import-accessible-maths` | `true`; reuse an explicitly opted-in compatible current-AST AM catalogue. `false` disables that import. No model or previous HTML render is used. |
| `graph` | A separate `maths` graph with label Mathematics, navigation/search enabled and appended navigation. `false` disables this optional KG transfer. A mapping accepts `id`, `label`, `navigation`, `search` and `placement` (`append` or `placeholder`). Requires the separately selected compatible KG coordinator. |
| `declarations` | Reuse `knowledge-graph.declarations` when configured; otherwise discover `knowledge.yml`, `knowledge.yaml`, then `knowledge.json` at the project/document root. Accepts trusted local literal YAML or JSON. |
| `notation` | Absent; optional trusted local literal YAML or JSON registry for explicit notation authoring. |
| `notation-defaults` | Absent; mapping from profile keys to page-default variant keys. |
| `notation-overrides` | Absent; required page variants, above reader choices without erasing them. |
| `notation-preferences` | Absent; explicit local exported JSON for native selection, at most 64 KiB. |
| `formal-proofs` | Disabled; optional finite controlled-English certificate generation, external `kernel-host` and 15–120-second timeout. |
| `reuse-relations` | Absent; explicitly qualified public relations with matching revision/digest and both current-page endpoints. |
| `scopes` | Absent: validate the complete MK-profile catalogue. An optional nonempty list of exact mathematical scopes selects a view from a mixed shared catalogue. |

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
document, then are normalized inside the project root (or standalone document
directory). The installed Quarto helper verifies ordinary physical descendants
of the canonical root before and after reading, rejects symlink/junction aliases
and bounds UTF-8 data files to 2 MiB. It uses Quarto's supplied runtime and needs
no separate author Node installation. Source locations describe the containing page and native anchor;
they do not claim original include-file character offsets. Included text shares
its containing document's scope. Reading declarations is a trusted local-file
capability. These checks do not provide an operating-system sandbox or a guarantee
against a hostile concurrent filesystem writer. Keep publication inputs trusted.

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
knowledge-graph:
  declarations: knowledge.yml
  schema: _extensions/kai-prince-sfhea/maths-knowledge-graph/maths-schema.yml
```

The MK installation includes the data-only [maths schema](_extensions/maths-knowledge-graph/maths-schema.yml).
Select it explicitly for KG. It extends KG's built-in `concept`/`assertion`
vocabulary and preserves existing `defines`/`requires` meanings. MK additionally
checks mathematical endpoint roles. MK automatically reads the same configured
catalogue as KG unless its own `declarations` option overrides the path. Use one
authoritative catalogue; the JSON example may be selected instead with
`knowledge-graph.declarations: knowledge.json`. Installing
MK does not overwrite another project's schema or install its dependencies.
The earlier published fixtures used Accessible Maths **0.0.4** and Knowledge Graph
Extraction **0.0.6**. The historical 0.0.7 integration used Accessible Maths
**0.0.8**, MK **0.0.7** and KG **0.0.14**. Its standalone regression and the
complete 62-page combined website render passed. It contains a complete separate
mathematics graph, alongside the other named graphs. Other versions need their
own compatibility checks. This configuration
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

For a shared catalogue containing other domains, select the mathematical scopes:

```yaml
maths-knowledge-graph:
  scopes: [algebra, real-arithmetic]
  notation: notation.yml
```

Selected objects and relations retain all publication, type, anchor, identity
and proof-role checks. A relation whose known endpoint belongs to an excluded
scope is withheld from this mathematical view; MK does not add that scope
silently. Genuinely missing endpoints and invalid explicit relation reuse still
refuse. Objects/relations in other named scopes are outside
this mathematical view; their whole-project validation remains KG's job.
Scope selection does not hide source files or make a catalogue private. A
CV graph stays a separate KG collection; choosing mathematical scopes
does not combine its navigation with the website graph.

An explicit concept occurrence on another page reuses its identity and links to
the canonical source. By default, it does not copy that page's relationships or
interactive proof/assumption controls into the reuse page. Relations authored
wholly in other canonical contexts remain in KG and their containing page view;
their mathematical roles and publication flags are still checked. A relation
belonging to the current mathematical context still requires its local native
endpoints and declaration provenance. Reusing one endpoint must not make an
otherwise valid canonical relation appear to be a new cross-page association.
Use [qualified relation reuse](#qualified-relation-reuse) only when both endpoint
occurrences and the explicit revision/assumption contract are present.

The notation registry can also be authored directly in YAML, with no JSON
conversion step. For example, a public declared composition concept can use:

```yaml
version: 1
profiles:
  - id: composition
    concept: math:composition
    scope: algebra
    roles: [left, right]
    default: infix
    variants:
      - id: infix
        label: Infix composition
        tex: '{{left}} \circ {{right}}'
        description: The left argument precedes the right argument.
      - id: named
        label: Named composition
        tex: '\operatorname{compose}({{left}},{{right}})'
        description: An author-approved alternative for the same roles.
```

The concept ID and scope must match a public concept in the shared catalogue.
When `scopes` is configured, the same selection applies to the registry, so one
registry may contain profiles for other pages/scopes. Every explicitly annotated
notation use on the rendered page must still refer to a selected valid profile;
select all scopes needed by that page rather than relying on automatic widening.
This does not infer equivalence, insert missing concepts, or enable unreviewed
AI proposals. Normal `quarto render`/`quarto preview` remain the author workflow;
catalogue-only preview watching retains the limitation described above.
For complete site-wide KG exploration with companions, start with Render Project.
KG documents the tested Windows Quarto prerelease's direct-HTML preview cache
defect and a supported YAML static-preview workaround; `--render all` alone does
not avoid it. No author-written server script is required. Partial edits retain
the documented conservative replay boundary.

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
Earlier retained native checks cover local installation/update/removal, disabled/unselected
operation, HTML/DOCX and reopened Word content, the original example, nested
Latin-1 input paths, includes/citations, custom output, configuration layering and
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
AI generation or unrestricted prose-to-Rocq conversion. The controlled proof
experiment has the explicit language, review and external-kernel boundaries
described above. A dependency route does not prove a proposition. Physical input
confinement has bounded local junction/file checks; it is not a filesystem sandbox.

The 0.0.7 regression passed 20 native import commands, 54 integration commands
and 58 completion commands, including intended refusals. Separate graph checks
passed 15 commands covering full and partial renders, navigation placement,
search, withdrawal and restoration. Original-source checks cover exact included
BOM/CRLF/Unicode ranges, unchanged formal modules, actual Word output and stale
review refusal; the later scope-filter repair has fresh whole-runtime tests.

During the historical 0.0.7 verification, the actual pinned external kernel
accepted seven finite generated certificates
with separate global-assumptions and typing-flag observations. Declared premises
remain visible; acceptance does not certify the source proof. Exact upstream
worker warnings are retained in the private report. Eight no-host browser groups
passed for current review controls, imports, downloads, cancellation and mobile
width. No model was downloaded or executed for that earlier verification.

For the current local 0.0.9 candidate, 108 portable formal checks, the full
native regression and the actual 76-page/thirteen-graph combined project render
pass. A separate fourteen-case actual installed author-command test admits every
model response through the schema and host checks. Only four cases meet every
meaning/role expectation, all negative cases; none of the six positive cases
meets the full expectation. One negative case yields a derivation of an incorrect
encoding. All proposals remain private and unreviewed. Valid JSON, source coverage
and even a type-correct derivation cannot replace checking the proposed meaning.
These fixed fictional development cases are not a general mathematics benchmark.

A later four-case direct-module comparison with a larger context/output budget
and reasoning enabled produces the correct synthesized sequent for all three
positive cases. Only modus ponens also meets every source-step expectation:
identity misclassifies its closing role, and the nested case also loses one
closing-step formula. The negative case remains unproved but weakens its goal
with an unexplained antecedent. This is a bounded profile comparison with several
settings changed together, not a new installed-command test or proof of general
conversion quality. Original reasoning and local scope still require review.

For 0.0.8, the full source-bound regression and an additional 11-command
installed-authoring fixture passed, including HTML/Word output and intended
refusals of stale source, private imports and overwrite. A separate actual
browser worker accepted the new implication, case-analysis and nested-subproof
certificates, with closed assumptions and ordinary typing observations. Its
True/False health controls passed; a leaking local assumption was refused before
any kernel request. These five checks do not establish prose fidelity.

The separately configured, already available local Gemma 4 E2B server returned
three authenticated completions. Both supported identity attempts contained an
undefined premise, so compilation and publication were withheld. The unsupported
quantified/equality example returned unresolved issues and abstained. One bounded
prompt clarification did not resolve the positive-case failure. No model was
downloaded for these tests. This is a model-quality limitation, rather than
evidence that ordinary mathematical prose can reliably be converted to Rocq.

The complete combined project passed 62 QMD inputs, producing 91 HTML pages and
twelve complete named graphs plus federation. These automated checks cover their
recorded inputs and byte snapshots. Broader compatibility, source fidelity,
notation equivalence, human mathematical and assistive-technology review remain
open; no WCAG, institutional or production acceptance follows.

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

Normal Render and Preview make no AI requests. The explicitly invoked installed
`proof-propose.ts propose` author command sends selected source to a configured
loopback model through the separately installed pinned Knowledge Graph Extraction
transport. Raw responses and named reviews stay in an external private workspace.
Its optional deterministic compiler generates a finite formal certificate while
preserving the authored proof body; an invalid proposal is withheld.
Developer tests, planning documents and detailed evidence live outside this
lean extension folder. The public user package alone does not reproduce that
complete development workflow. Detailed native/browser/preview reports and exact
candidate hashes are retained separately. Developer evidence and the complete AI
session/prompt history are not distributed in this source package, so its full
development verification cannot currently be reproduced from this repository
alone. The included examples remain independently installable and runnable. This
development disclosure is separate from runtime AI and from the finite
certificate-generation feature.

## Versions, updates and migration

The `0.0.x` interfaces are experimental: a patch update can tighten validation or
change an authoring contract. The current catalogue is version 0 and the optional
notation registry is version 1. Unsupported versions are refused rather than
silently reinterpreted. Read the [changelog](CHANGELOG.md) before
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
Optional dependencies retain their own notices and terms. The optional external
Sandbox/jsCoq/Coq deployment is separately supplied: jsCoq's AGPL obligations
and each component's terms remain applicable to that distribution. MK's original
bridge files do not relicense, bundle or provide a rights review of those assets.

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
