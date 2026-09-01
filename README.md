# Declaratie-Analyzer-GAS

Status: early development / architecture phase.

This repository is the documentation baseline for a Google Apps Script solution that generates reimbursement declarations from receipts and invoices.

## Purpose

The project will support a declarant workflow in which source documents such as images and PDFs are ingested, extracted into structured financial information, normalized into a canonical model, and assembled into a declaration for a monthly reimbursement submission.

The initial scope is intentionally limited to architecture and design groundwork. No application code, runtime configuration, or deployment artifacts are created in this repository yet.

## Scope

- Google Apps Script tool for reimbursement declarations
- Input documents may be images or PDFs
- Source documents retain separate date and document ID values
- Extract document date, invoice/receipt ID, expense lines, quantities, VAT, shipping, commercial or government fees, adjustments, and printed totals
- Normalize extracted data before declaration generation
- Aggregate multiple source documents into a single declaration when appropriate
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

- The relevant document date is the date the receipt or invoice was issued or generated, not necessarily the order date.
- Declaration reference is deterministically derived as YYYYMMDD + applicantCode.
- Multiple source documents may share the same declaration reference when applicable.
- This v1 implementation is explicitly single-declarant: one GAS deployment serves one declarant profile.
- Declarant PII and configuration such as name, address, postcode, city, IBAN, BSN, creditor number, and applicant code must not be committed to Git; they are stored in Apps Script Script Properties.
- Declarant profile data and source-document extraction remain separate until declaration assembly.
- Declarant PII must not be sent to OpenAI for receipt or invoice extraction.
- Script Properties remove PII from source control but are not a dedicated secrets-management system; access to the Apps Script project must therefore be restricted.
- Date and document ID selection heuristics remain future design work and are not yet decided in this architecture baseline.

## Documentation structure

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes the system and design principles.
- [docs/adr/0001-single-declarant-deployment.md](docs/adr/0001-single-declarant-deployment.md) documents the deployment model.
- [docs/adr/0002-canonical-expense-model.md](docs/adr/0002-canonical-expense-model.md) documents the canonical financial model.
- [docs/adr/0003-google-sheets-template.md](docs/adr/0003-google-sheets-template.md) documents the Sheet-based presentation approach.
- [SECURITY.md](SECURITY.md) documents the security and data-handling boundaries.

## Current status

This repository is intentionally a documentation-first baseline. The application is not implemented yet, and no production deployment or GAS source code is included.
