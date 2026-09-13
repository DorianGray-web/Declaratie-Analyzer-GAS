# ADR 0005: Declaration period and financial-document assignment

Status: Accepted

## Context

Recognized financial documents must be selected for a declaration without conflating recognition, query-relative eligibility, authoritative assignment, or archival. Historical declarations must retain their resolved periods and accounting references even when future cadence or declarant configuration changes.

## Decision

### Period and candidates

A `DeclarationPeriod` is authoritatively represented by inclusive resolved `startDate` and `endDate` boundaries. `MONTH`, `TWO_MONTHS`, `QUARTER`, and `CUSTOM` may be convenience presets, but the resolved boundaries are persisted with the declaration and are the historical truth.

Period routing uses the authoritative canonical `documentDate` produced by Identity Resolution under ADR 0002. Raw observed dates are not routing authority. An unresolved date requires review; the system must not silently substitute upload date, file creation date, filename date, recognition date, or current date.

Candidate selection is conceptually:

```text
recognized document
AND period.startDate <= documentDate <= period.endDate
AND no conflicting authoritative declaration assignment
```

Filtering precedes deterministic sorting and operation grouping. Documents outside the period remain untouched. Selecting a period produces candidate classifications and a preview before human confirmation. `ELIGIBLE`, `OUTSIDE_PERIOD`, `ALREADY_DECLARED`, and `REVIEW_REQUIRED` are query-relative classifications unless another accepted contract deliberately makes one persistent; they do not automatically become document lifecycle states.

### Declaration identity and confirmation

Each declaration has a stable technical `declarationInstanceId`, distinct from `evidenceId`, `sourceDocumentId`, and `operationReference`.

Human confirmation is one consistency boundary that freezes declaration membership, authoritative declaration associations, and the basis of the `ExpectedEvidenceManifest`. The Level-1 invariant is:

```text
confirmed financial documents
  = frozen declaration associations
  = ExpectedEvidenceManifest evidenceIds
```

A financial document must not be silently assigned to multiple authoritative active or final declarations. Protection applies at confirmation/reservation time and must not rely only on `ARCHIVED`; exact transaction and locking mechanics remain an implementation decision.

If newly recognized evidence resolves into an already-finalized historical period, the system surfaces an explicit late-evidence/review-required condition. It does not mutate the archived declaration, assign the evidence to another period, or mark it declared automatically. Accounting treatment remains a human/business decision.

### Declaration operations

After membership is frozen, declaration assembly derives `DeclarationOperation` groups by `(documentDate, payer)`. In the single-declarant deployment the payer will normally be constant, but payer remains explicit business semantics. This grouping need not be a separate persisted entity/table.

The accounting reference is:

```text
operationReference = YYYYMMDD(authoritative documentDate) + applicantCode
```

`applicantCode` is derived from the first four uppercase letters of the actual payer's `Achternaam` under the approved derivation rule. Multiple financial documents with the same date and payer may legitimately share an `operationReference`; it is not unique and never replaces evidence or declaration identity. The derived operation grouping and reference are frozen with the declaration so later profile or derivation-rule changes do not rewrite history.

## Open business decisions

- Exact `applicantCode` normalization for short surnames, spaces, prefixes, hyphens, apostrophes, diacritics, and compound surnames.
- Whether the actual payer can ever differ from the configured declarant.
- Whether a structured historical `DeclarantProfile` snapshot is needed after the final archival PDF exists.

## Consequences

- Reporting cadence can change without changing historical declaration periods.
- Review and confirmation remain distinct from candidate discovery.
- Duplicate assignment is prevented by authoritative associations rather than archival or filename state.
- Operation grouping cannot influence which documents belong to a declaration.

## Dependencies

- ADR 0001 defines the single-declarant profile and applicant-data boundary.
- ADR 0002 defines authoritative `documentDate` and `sourceDocumentId` resolution.
- ADR 0004 defines evidence identity and the common registry.
- ADR 0006 packages the membership frozen by this ADR.
