# Changelog

## Documentation refinement — 14 October 2026

- Clarify complete effective metadata namespaces, document/metadata-file
  conflicts, authoritative disabling and fixed-field diagnostic privacy.
- Keep runtime at 0.0.3. No authoring, catalogue, registry or browser preference
  migration is introduced; native output and runtime bytes remain unchanged.


## 0.0.3 — experimental development, 12 October 2026

- Remove old saved preferences before reset writes an empty record; quota
  failure cannot restore the previous choice. Explain when removal is blocked.
- Use one shared polite status region to avoid duplicate announcements across
  glossary entries.
- Cache notation variant nodes, touch only the previous/next alternatives, and
  skip unchanged visibility writes while keeping scoped controls synchronized.
- Combine template validation/expansion traversal and reuse notation detection
  from anchor collection. Keep all parameter, proof-placement and registry checks.
- Avoid per-key native JSON decoding for unescaped keys; retain native decoding
  for escaped keys, duplicate-key refusal and the pre-decode depth guard.
- Retain bounded component baselines, native-output parity and browser/storage
  regression evidence outside the lean installed package.

The authoring catalogue and registry versions remain unchanged. Publish the
experimental source with explicit GitHub/local installation routes, material
AI-assistance disclosure and Apache redistribution notices. No tagged release,
supported production version or independent mathematical/AT acceptance is claimed.

## 0.0.2 — experimental development, 12 October 2026

- Add a finite native associativity-condition template with checked nominal
  parameter roles, capture refusal and explicit unverified provenance.
- Add public, scoped notation profiles, pre-rendered alternatives and a static
  glossary with labelled reader controls, opt-in local persistence, reset and
  preference export. Keep static writers on authored defaults.
- Add a runnable two-page/two-scope consumer example and reference option/notation
  schemas. No automatic editor registration or new dependency installation.
- Validate all translations/aliases and review statuses, reject object/relation
  identity collisions, and bound JSON depth before decoding.
- Support one explicitly declared occurrence of an identity per page, with a
  labelled canonical-source link; retain local relation-provenance validation.
- Verify native configuration layering, additional static outputs, preview and
  combined existing AM/KG behavior; retain human review and trust limits.

Version 0 catalogue records remain compatible with 0.0.1. New features are opt-in:
`.maths-instance` and the optional version 1 notation registry. Invalid review,
translation or colliding-identity records that previously escaped validation
now fail and require explicit correction. This is experimental source development,
not a tagged release or a public repository publication.

## 0.0.1 — in development, 12 October 2026

- Start the deterministic MK-0 prototype: explicit mathematical roles,
  assumption/proof associations and a native static glossary on one page.
- Add a data-only KG schema profile preserving the built-in concept/assertion
  vocabulary and defines/requires meanings.
- Add an original synthetic positive-squares article and authoritative catalogue
  with two distinctly labelled proofs and explicit unverified statuses.
- Use a literal `knowledge.json` catalogue to preserve labels, TeX and scalar
  types. Catalogue YAML awaits a faithful reader; normal Quarto metadata remains
  YAML. No third-party YAML parser is bundled.
- Document the bounded DNS/IPv4 HTTP(S) identifier grammar and trusted local-file
  read, including the unresolved symlink/junction confinement gate.
- Separate base use from optional Accessible Maths/KG composition, and disclose
  material AI assistance and pending independent review.

This initial candidate had no earlier schema to migrate. Cross-page mathematical
assembly, typed templates, reader notation preferences and formal proof checking
were later work at that point; finite templates and scoped preferences are now
implemented in 0.0.2 above. No public repository or tagged release has been created.
