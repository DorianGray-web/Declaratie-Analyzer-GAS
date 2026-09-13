# ADR 0006: Self-contained Declaratie archival package

Status: Accepted

## Context

A reviewed declaration must be archived together with all evidence that belongs to it. Folder scans, filenames, printed document identifiers, and accounting references cannot reliably reconstruct authoritative membership. Packaging must fail closed so that an incomplete or unreadable candidate is never published as final.

## Decision

The downstream boundary is:

```text
ReviewedDeclaration + ExpectedEvidenceManifest
  -> DeclarationPackageBuilder
  -> PackageCandidate
  -> DeclarationPackageValidator
  -> controlled archival publication
```

`ExpectedEvidenceManifest` answers “What evidence must be represented in this declaration package?” It is derived from the frozen membership established by ADR 0005 and uses `evidenceId`. The package builder receives already-resolved membership; it does not rediscover it by scanning Drive or by interpreting filename, `operationReference`, or `sourceDocumentId`.

The final artifact is one self-contained PDF with the primary Declaratie PDF first and every expected source-evidence page afterward. It preserves all pages of multi-page evidence, applies deterministic evidence ordering, provides readable/printable representation, and associates output pages with `evidenceId` where practical. Images may be normalized into printable PDF pages, but this ADR does not mandate a converter.

Completeness has two independent levels:

1. Level 1 — confirmed financial documents equal frozen declaration associations equal manifest `evidenceId` membership.
2. Level 2 — the primary Declaratie and every manifest evidence item equal the validated final package representation.

The package builder must not compensate for a broken Level-1 contract. It does not extract financial facts, resolve `documentDate`, choose a period or membership, classify expenses, guess missing evidence, silently drop unsupported evidence, query the complete `DeclarantProfile`, or send profile/evidence to an AI provider.

Missing, unreadable, unsupported-without-adapter, unconvertible, or unmergeable expected evidence; a completeness mismatch; or an invalid final PDF causes explicit failure. A partial candidate is never published as final. Archival succeeds only after package validation and controlled publication.

### Sensitive artifact lifecycle

Temporary evidence-, profile-, or declaration-bearing artifacts have a known owner, restricted access, neutral technical naming where practical, a known lifecycle, success-path cleanup, failure-path cleanup/recovery, and an observable cleanup result. Moving an artifact to Drive trash is not equivalent to permanent erasure.

ADR 0003's populated Google Sheet is a persistent PII-bearing artifact during human review. Its lifecycle is:

```text
restricted Sheet
  -> human review
  -> confirmation
  -> primary PDF
  -> archival package
  -> validated publication
  -> Sheet cleanup unless an explicit retention policy requires otherwise
```

A valid archival PDF does not become structurally invalid merely because cleanup failed, but the workflow must expose the failure and must not claim fully clean completion while a sensitive temporary artifact remains unresolved.

The final archive uses a dedicated restricted location without broad/public link sharing and neutral filenames containing no BSN, IBAN, surname, `applicantCode`, or unnecessary `operationReference`. There is one authoritative final artifact per package version. Publication must not silently overwrite an archived declaration; corrections/replacements require explicit version semantics. Failed and temporary candidates remain restricted.

## Open business decisions

- Whether reviewed Sheets must be retained after archival.
- The recovery window for failed or in-review artifacts.
- Municipality/accounting retention requirements.
- Whether and when permanent deletion rather than Drive trash is required.
- The archive correction/replacement procedure and version policy.

## Consequences

- A final archive is self-contained and independently reviewable.
- Package completeness is validated against frozen identity-based membership.
- Packaging remains downstream from extraction, normalization, assignment, review, and primary rendering.
- Temporary and final artifacts require explicit access and lifecycle controls.

## Dependencies

- ADR 0003 defines Sheet-based human review and primary PDF export.
- ADR 0004 defines stable evidence identity and retrievable evidence.
- ADR 0005 defines frozen declaration membership and the manifest basis.
