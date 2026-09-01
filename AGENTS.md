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
