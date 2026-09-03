# AGENTS.md

This repository is in the architecture / early-development phase. The implementation is not yet established, and agent work must respect the existing design baseline rather than redefine it.

## Authority order

Follow explicit user or task instructions within the repository's security and privacy boundaries.

For project sources, apply this order when they conflict:

1. security and privacy constraints
2. accepted ADRs
3. docs/ARCHITECTURE.md
4. README.md
5. implementation code and tests once they exist
6. agent suggestions or inferences

If a requested change would alter an established security, privacy, or architectural boundary, surface the conflict and require an explicit project decision rather than silently overriding the documented baseline.

## Evidence-first workflow

- Inspect the repository before proposing or making changes.
- Do not assume functionality exists just because it is conceptually expected.
- Distinguish confirmed repository behavior from proposed behavior.
- Do not invent missing extraction rules, business rules, grouping logic, or financial policy.
- Any rule not already documented must be treated as unresolved unless explicitly decided by the user or by a documented ADR.
- When a task depends on a named version, branch, tag, commit, or release, verify that exact revision from direct repository evidence before using it as an evidence source.
- After a reference revision is identified, inspect source content from that exact revision. Do not substitute the current working tree, another branch, or prior conversational context for revision-specific evidence.
- If the required revision cannot be accessed or verified, stop the assessment and report the evidence gap rather than inferring its contents.

Reference baseline rule:

- Financial/extraction baseline: Generator-Werkbon-GAS @ tag v1.7.4
  commit a75264f06eb66cbce34a822502645f8adc4475ed

- PDF-ingestion baseline: Generator-Werkbon-GAS @ tag v1.8.0
  commit ade14f485d6932d09c6f471f6d2a2ac24ccb2094

These are distinct evidence sources. Do not attribute PDF-ingestion work to v1.7.4 unless the exact revision and source content prove it.

## Local Review Evidence

The repository may be accompanied by a local `.review-evidence/` directory containing real-world material used to review extraction and declaration behavior.

This directory is local-only, ignored by Git, and is not part of the repository source of truth.

It may contain sensitive or personally identifiable information, including filled declarations, receipts, invoices, account-related data, or other real source-document content.

### Access boundary

Agents may inspect `.review-evidence/` only when the current task explicitly requires review of local evidence.

Do not inspect, enumerate, summarize, or process this directory merely because it exists.

### Permitted use

When explicitly authorized for the current task, local review evidence may be used to:

- understand real source-document structures;
- compare source documents with their resulting declaration representation;
- review proposed extraction contracts and architecture;
- identify evidence-backed requirements, ambiguities, and missing cases;
- derive sanitized or synthetic test scenarios.

Local review evidence is evidence, not an implementation specification.

### Prohibited use

Content from `.review-evidence/` must not be:

- staged, committed, or pushed to Git;
- copied into tracked source files, documentation, tests, fixtures, logs, or generated repository artifacts;
- reproduced in agent reports beyond the minimum information required for the task;
- sent to external services unless the current task explicitly authorizes that specific processing and it complies with project security and privacy rules;
- treated as an exhaustive representation of supported documents;
- converted into vendor-specific production rules;
- used to invent confidence thresholds, fallback heuristics, or undocumented financial or identity-selection policy.

Never expose declarant PII or other sensitive values merely to explain a finding. Prefer structural descriptions, field names, sanitized examples, or synthetic values.

### Derived artifacts

Any tracked documentation, regression fixture, or test derived from local review evidence must contain only sanitized or synthetic data.

If sanitization cannot preserve the evidence required for a proposed tracked artifact, keep that artifact local rather than weakening this boundary.

### Evidence authority

`.review-evidence/` provides observational evidence only.

It does not override:

1. security and privacy requirements;
2. accepted ADRs;
3. `docs/ARCHITECTURE.md`;
4. other authoritative project contracts.

When local evidence exposes behavior not covered by an accepted contract, report the gap and preserve the case as unresolved rather than inventing a generalized rule.

## Architectural boundaries that must be preserved

- v1 is single-declarant.
- declarant profile/configuration is separate from source-document extraction.
- source-document extraction is not a vehicle for exposing declarant profile data.
- declarant PII and applicant code must not be committed to Git.
- declarant PII/configuration must not be sent to OpenAI for document extraction.
- Script Properties are configuration storage; they are not a dedicated secrets-management system.
- extraction precedes canonical normalization.
- the canonical financial model is the source of truth for declaration assembly.
- Google Sheets is the presentation layer.
- PDF export is downstream of Sheet population and validation.

Use these terms consistently:

- source document
- source document ID
- relevant document date
- canonical financial model
- declaration reference
- declarant profile
- declaration assembly

The declaration reference is derived from the relevant document date and applicant code according to the documented architecture. Do not introduce additional grouping rules.

## Prohibited speculative design

Agents must not invent unresolved heuristics or assumptions for:

- relevant document date selection
- source document ID selection
- confidence thresholds
- fallback behavior
- final tax/fee normalization rules

These require evidence and/or an explicit design decision recorded in project documentation before implementation.

## Reuse policy for Generator-Werkbon-GAS

Generator-Werkbon-GAS v1.7.4 is a reference implementation and source of proven patterns. Reuse is allowed only when it is assessed before copying.

Use a simple reuse analysis:

- reuse: proven pattern fits the need and scope without forcing new assumptions
- adapt: pattern is useful but must be modified to match Declaratie Analyzer constraints
- exclude: pattern is not appropriate for this repository, especially if it is output-specific or business-specific

Do not import Werkbon-specific output behavior.
Do not assume Werkbon business rules automatically apply to Declaratie Analyzer.

## Financial correctness requirements

- extracted printed values must remain traceable to their source document
- deterministic code should perform financial reconciliation where possible
- do not silently alter amounts to make totals reconcile
- reconciliation failures or materially ambiguous financial data must not be hidden

The canonical financial model is the authoritative representation for declaration assembly; sheet presentation must not be treated as the source of truth.

## Change discipline

- make the smallest change necessary for the task
- do not modify unrelated files
- do not change accepted architectural decisions implicitly
- architecture changes must update the authoritative documentation and, when they alter an accepted decision, add or supersede the relevant ADR
- security-boundary changes require explicit review
- avoid premature dependencies, frameworks, CI, deployment artifacts, or infrastructure additions

## Validation expectations

Before claiming a task is complete:

- inspect git diff
- run the relevant tests/checks when they exist
- use git diff --check
- report what was validated and what could not be validated
- never claim success based only on file creation

## Git discipline

- do not commit, push, merge, rebase, or delete branches unless explicitly requested
- do not modify credentials or repository secrets
- do not include PII in commits, fixtures, examples, logs, or documentation
- do not add or change deployment metadata, app configuration, or project secrets as part of routine work

## Working rule

Agents must guide their work from the project’s documented baseline, not from assumptions. When the design is not yet explicit, defer the decision and document the gap rather than inventing behavior.
