# Architecture

Status: early development / architecture phase.

## Purpose

The repository defines the architecture for a Google Apps Script tool that generates reimbursement declarations from receipts and invoices. The intent is to support structured extraction from source documents, normalization into a canonical financial model, and assembly of a declaration that can be rendered through Google Sheets and exported to PDF downstream.

## Scope and constraints

- Input documents may be images or PDFs.
- Source document processing must retain date and identifier evidence so authoritative `documentDate` and `sourceDocumentId` values can be resolved without losing traceability.
- The relevant document date is the date the receipt or invoice was issued or generated, not necessarily the order date.
- Extracted observations include date and identifier evidence, expense lines, quantities, VAT, shipping, commercial or government fees, adjustments, and printed totals.
- Recognized source documents accumulate in a common registry and are later selected using resolved declaration-period boundaries.
- Confirmed source documents are grouped into date+payer operations inside a declaration.
- The non-unique operation reference is derived deterministically as YYYYMMDD + applicantCode.
- Every source document remains an individual record with its own date and document ID.
- v1 is single-declarant and single-deployment: one GAS deployment serves one declarant profile.

## Architectural reference

This design deliberately reuses proven patterns from Generator-Werkbon-GAS v1.7.4 where they apply to receipt and invoice ingestion, structured extraction, normalization, VAT reasoning, shipping and additional fees, and financial reconciliation.

It does not copy the output-specific logic of Werkbon and does not yet define declaration layout generation or field rendering logic.

## Proposed system layers

### 1. Document ingestion

The ingestion layer accepts image or PDF documents and normalizes them into a processing-ready representation. It keeps the original document file metadata and the extracted document info in a structured form.

This layer is responsible for handling the file type and preserving the source document as a first-class record.

Declaratie Analyzer v1 applies a project-local maximum raw PDF size of 5 MiB (`5 * 1024 * 1024` bytes). A PDF that exceeds this limit is rejected before OpenAI transport. This is an ingestion policy, not a universal OpenAI platform limit, and it may be changed later without changing the canonical financial model.

### 2. Document extraction

The extraction layer produces normalized document-level facts and line-item facts from the source document content. It is responsible for identifying:

- source document date
- source document ID or invoice number
- line-level expenses
- quantities
- VAT values
- shipping charges
- commercial or government fees
- adjustments
- printed totals

The project explicitly does not yet define final heuristics for selecting the date or document ID in ambiguous cases. That decision is deferred as future design work.

### 3. Normalization to a canonical model

Extracted values are normalized into a canonical financial model before declaration generation. This layer creates a stable representation for amounts, tax, fees, and totals that can be assembled across multiple source documents without depending on a single vendor or document layout.

The canonical model is the basis for reconciliation between source-document totals and declaration totals.

### 4. Evidence registry

Each physical/source evidence artifact receives a stable system-owned `evidenceId` and an `EvidenceRecord` with a retrievable content reference and required provenance/integrity metadata. A processed-document envelope links that identity to its canonical financial document without adding storage mechanics to the canonical model.

Recognized documents accumulate in one common financial-document registry. Recognition is not declaration or archival, and lifecycle authority does not come from filenames. A document remains the unit of declaration assignment even when it contains multiple financial lines.

### 5. Declaration selection and assembly

The user selects a period whose inclusive resolved `startDate` and `endDate` are persisted with a stable `declarationInstanceId`. Identity Resolution must first have produced an authoritative `documentDate`; unresolved dates require review and receive no upload/file/recognition/current-date fallback.

The workflow filters recognized, unconflicted documents into a candidate preview before deterministic sorting and human confirmation. Confirmation freezes document membership, authoritative declaration associations, and the basis of the `ExpectedEvidenceManifest` in one consistency boundary. Late evidence for a finalized period requires explicit review and does not silently change historical assignments.

After membership is frozen, assembly derives operations by `(documentDate, payer)`. Each operation uses `operationReference = YYYYMMDD(documentDate) + applicantCode`. Multiple documents may share this accounting reference; it is not a declaration or evidence identity and its historical value is frozen with the declaration.

Declaration assembly is the first point where the confirmed canonical documents and the minimally required declarant rendering data meet. It preserves each document's identity and date.

The exact `applicantCode` normalization edge cases and whether payer can differ from the configured declarant remain open business decisions.

### 6. Presentation and primary export

A clean Google Sheets template is copied and populated rather than generating the declaration layout from scratch. The output sheet is intended to serve as the presentation layer for review and downstream PDF export.

Primary Declaratie PDF export is a downstream step after the Sheet has been populated, reviewed, and confirmed.

### 7. Archival packaging

The reviewed declaration and frozen `ExpectedEvidenceManifest` enter a downstream package builder. It creates a candidate containing the primary Declaratie PDF first and every page of every expected evidence item afterward in deterministic order. A validator proves manifest-to-output completeness and final-PDF validity before controlled publication; partial or invalid candidates are never final.

Packaging uses `evidenceId` membership supplied by the confirmed declaration. It does not scan folders to rediscover membership, resolve identity or periods, repair Level-1 membership, or invoke an extraction provider.

## Security and separation of concerns

This architecture separates `DeclarantProfile` configuration from source-document extraction, canonical normalization, the evidence registry, declaration associations, and evidence manifests. The profile includes PII and configuration such as name, address, postcode, city, IBAN, BSN/KvK, creditor number, and surname/applicant information.

One deployment owns one authoritative profile stored in Script Properties and excluded from source control. Another declarant uses another deployment. Script Properties are neither encryption nor a secrets vault, so every project owner/editor is trusted for profile access and access must be tightly restricted.

The architecture requires that:

- document parsing and extraction remain independent from configured profile data;
- configured profile data is not sent to the extraction provider or copied into raw/canonical documents, evidence/registry records, associations, or manifests;
- source evidence may independently contain PII and remains a separate restricted provider-processing concern;
- the profile is normally materialized only for declaration assembly/rendering after membership is frozen, and only minimum downstream views are provided;
- BSN and IBAN exist only where required for protected configuration and controlled declaration rendering/output;
- temporary Sheets, evidence, PDFs, and package candidates have restricted access, neutral naming where practical, known ownership, explicit lifecycle, and observable cleanup;
- archival publication uses a restricted location, neutral filenames, validation, and no silent overwrite.

See `SECURITY.md` for normative handling and logging rules.

## Cross-ADR invariants

- one deployment = one declarant;
- `RECOGNIZED != DECLARED != ARCHIVED`;
- `evidenceId != sourceDocumentId != operationReference != declarationInstanceId`;
- period filtering precedes sorting and operation grouping;
- confirmed documents = frozen associations = manifest evidence IDs;
- the primary Declaratie is first and every expected evidence page is represented;
- no partial candidate is published as final;
- `DeclarantProfile` does not enter extraction, canonical documents, the registry, associations, or manifests.

## Known design gaps

These items are deliberately recorded as deferred design work and not implemented in this baseline:

- specific heuristics for selecting the source document date when multiple candidate dates exist
- specific heuristics for choosing the source document ID or invoice number when multiple identifiers are present
- detailed extraction confidence scoring and fallback handling
- final tax and fee normalization rules beyond the canonical model requirement
- final output-layout generation rules for the declaration presentation sheet
- exact applicant-code normalization edge cases
- whether actual payer may differ from the configured declarant
- reviewed-Sheet retention after archival and failed-artifact recovery windows
- municipality/accounting retention and permanent-deletion requirements
- archive correction/replacement procedure
- extraction-provider retention/data-control requirements for evidence that itself contains PII
- whether structured historical profile snapshots are required after final archival output exists

## Current status

This repository contains the architecture baseline and limited ingestion/raw/canonical contract code. Declaration selection, assembly, rendering, and packaging remain unimplemented.
