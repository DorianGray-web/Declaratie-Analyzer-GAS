# ADR 0004: Evidence lifecycle and financial-document registry

Status: Accepted

## Context

Recognized receipts and invoices must remain retrievable and traceable before a declaration period is selected. Filename conventions and period-specific folders cannot provide durable identity or authoritative lifecycle state. The canonical financial model must also remain independent from storage mechanics.

## Decision

The system assigns each physical/source evidence artifact a stable, system-owned `evidenceId`. An `EvidenceRecord` represents that artifact and provides a retrievable content reference plus the original metadata, MIME/type, and integrity/version metadata needed by the eventual storage design. This ADR does not freeze the exact persistence schema.

`evidenceId` answers “Which exact source artifact is this?” It is distinct from the printed business identifier `sourceDocumentId`, the accounting `operationReference`, the technical `declarationInstanceId`, the filename, and receipt-key-like filename semantics. A filename is restricted evidence metadata, not identity or lifecycle authority.

A `ProcessedFinancialDocument`-like envelope links one `evidenceId` to its `CanonicalFinancialDocument`. Storage references remain in the envelope/registry boundary and do not contaminate the canonical financial contract. The exact envelope name and persistence representation may be selected during implementation without weakening this separation.

Successfully recognized documents accumulate in one common financial-document registry. Declaration periods are later selections over that registry; the system does not create January-, February-, or other period-specific source stores. One invoice or receipt may contain many financial lines, but remains one source financial document/evidence artifact for assignment. Line-level routing must not split it across declarations.

Recognition is not declaration and is not archival:

```text
RECOGNIZED != DECLARED
RECOGNIZED != ARCHIVED
```

A recognized document may remain unassigned. Authoritative state must not depend on a filename marker such as `[Recognized]`.

`EvidenceRecord`, the processed-document envelope, and registry rows do not duplicate the configured `DeclarantProfile`. Original evidence and filenames may independently contain PII and are restricted evidence content/metadata under `SECURITY.md`.

## Consequences

- Evidence remains traceable and retrievable independently of declaration cadence.
- The canonical model stays focused on financial-domain facts rather than storage mechanics.
- Period selection and packaging can use stable evidence identity rather than Drive scans or filenames.
- Persistence, content-reference, integrity, and version field shapes remain implementation decisions.

## Dependencies

- ADR 0002 defines the canonical financial document and identity-resolution boundary.
- ADR 0005 defines declaration-period selection and authoritative assignment.
- ADR 0006 uses `evidenceId` as archival manifest membership identity.
