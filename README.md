# Declaratie-Analyzer-GAS

Status: early development / architecture phase.

This repository contains the architecture baseline and early contract implementation for a Google Apps Script solution that generates reimbursement declarations from receipts and invoices.

## Purpose

The project will support a declarant workflow in which source documents such as images and PDFs are ingested, extracted into structured financial information, normalized into a canonical model, and assembled into a declaration for a resolved reporting period.

The project remains documentation-led. Source ingestion and raw/canonical contract work exists, while declaration assignment, presentation, packaging, and production deployment behavior are not yet implemented.

## Scope

- Google Apps Script tool for reimbursement declarations
- Input documents may be images or PDFs
- Source documents retain separate date and document ID values
- Extract document date, invoice/receipt ID, expense lines, quantities, VAT, shipping, commercial or government fees, adjustments, and printed totals
- Normalize extracted data before declaration generation
- Select recognized documents from a common registry by a resolved declaration period
- Group confirmed declaration documents into date+payer operations when appropriate
- Use a Google Sheets template as the presentation layer and populate a copy of a clean template rather than generating the sheet layout from scratch
- Export the final populated sheet to PDF downstream of the Sheet population step

## Architectural reference

This repository intentionally reuses proven architectural approaches from Generator-Werkbon-GAS v1.7.4 where applicable, especially around:

- receipt and invoice ingestion
- structured extraction
- normalization of financial values
- VAT handling
- shipping and additional fee handling
- financial reconciliation

The repository does not copy Werkbon-specific output logic, and it does not implement any final declaration layout logic yet.

## Key design constraints

- The relevant document date represents the issuance/generation date of the receipt or invoice rather than merely the order date. Rules for identifying that date in ambiguous documents remain future design work.
- Each confirmed source document participates in an operation reference derived as YYYYMMDD + applicantCode from authoritative `documentDate` and payer. Multiple documents may share that non-unique reference.
- Stable `evidenceId`, printed `sourceDocumentId`, accounting `operationReference`, and technical `declarationInstanceId` are distinct identities.
- This v1 implementation is explicitly single-declarant: one GAS deployment serves one declarant profile.
- Declarant PII and configuration such as name, address, postcode, city, IBAN, BSN, creditor number, and applicant code must not be committed to Git; they are stored in Apps Script Script Properties.
- Declarant profile data and source-document extraction remain separate until declaration assembly.
- Declarant PII must not be sent to OpenAI for receipt or invoice extraction.
- Script Properties remove PII from source control but are not a dedicated secrets-management system; access to the Apps Script project must therefore be restricted.
- Date and document ID selection heuristics remain future design work and are not yet decided in this architecture baseline.
- Recognition, authoritative declaration assignment, and archival are distinct lifecycle concerns.
- Confirmed membership, frozen declaration associations, and `ExpectedEvidenceManifest` membership must agree before packaging.
- The archival output is one validated PDF with the primary Declaratie first and every expected evidence page afterward; partial candidates are never final.

## Documentation structure

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes the system and design principles.
- [docs/adr/0001-single-declarant-deployment.md](docs/adr/0001-single-declarant-deployment.md) documents the deployment model.
- [docs/adr/0002-canonical-expense-model.md](docs/adr/0002-canonical-expense-model.md) documents the canonical financial model.
- [docs/adr/0003-google-sheets-template.md](docs/adr/0003-google-sheets-template.md) documents the Sheet-based presentation approach.
- [docs/adr/0004-evidence-lifecycle-and-financial-document-registry.md](docs/adr/0004-evidence-lifecycle-and-financial-document-registry.md) documents evidence identity and the common registry.
- [docs/adr/0005-declaration-period-and-document-assignment.md](docs/adr/0005-declaration-period-and-document-assignment.md) documents period selection, assignment, and operation grouping.
- [docs/adr/0006-self-contained-declaratie-archival-package.md](docs/adr/0006-self-contained-declaratie-archival-package.md) documents evidence-complete archival packaging.
- [SECURITY.md](SECURITY.md) documents the security and data-handling boundaries.

## Testing

Authoritative GAS/QUnitGS2 regression gates are independent, architecture-aligned
lifecycles. Invoke the deployed test web app once for each selector:

- `?batch=source-ingestion`
- `?batch=raw-document-extraction`
- `?batch=canonical-financial-document`
- `?batch=evidence-record`
- `?batch=drive-evidence-store`
- `?batch=test-harness`
- `?batch=processed-financial-document`

Each request initializes QUnitGS2 and registers only its selected test module.
An unknown, retired, or explicitly empty selector fails closed instead of running
the full suite.

Calling `doGet()` without an event/batch remains available to local
QUnit-compatible runners and as a legacy full-suite diagnostic. That monolithic
route is not an authoritative GAS regression gate. The repository currently has
no checked-in command-line runner; local harness results and declared structure
do not prove completion of the real GAS reporter lifecycle.

No numeric test, assertion, or payload limit is assumed. See
[LESSONS_LEARNED.md](LESSONS_LEARNED.md)
for the cross-project evidence and diagnostic procedure.

## Current status

This repository is intentionally documentation-led and remains in early development. It includes limited GAS contract/validation code but not the declaration workflow, packaging implementation, or a production deployment.
