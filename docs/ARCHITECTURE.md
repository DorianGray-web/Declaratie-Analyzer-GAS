# Architecture

Status: early development / architecture phase.

## Purpose

The repository defines the architecture for a Google Apps Script tool that generates reimbursement declarations from receipts and invoices. The intent is to support structured extraction from source documents, normalization into a canonical financial model, and assembly of a declaration that can be rendered through Google Sheets and exported to PDF downstream.

## Scope and constraints

- Input documents may be images or PDFs.
- Source document processing must retain both the source date and the source document ID or invoice number.
- The relevant document date is the date the receipt or invoice was issued or generated, not necessarily the order date.
- Extracted content includes document date, document ID, expense lines, quantities, VAT, shipping, commercial or government fees, adjustments, and printed totals.
- Multiple source documents may be grouped into a single declaration, typically for a monthly reimbursement submission.
- The declaration reference is derived deterministically as YYYYMMDD + applicantCode.
- Every source document remains an individual record with its own date and document ID.
- v1 is single-declarant and single-deployment: one GAS deployment serves one declarant profile.

## Architectural reference

This design deliberately reuses proven patterns from Generator-Werkbon-GAS v1.7.4 where they apply to receipt and invoice ingestion, structured extraction, normalization, VAT reasoning, shipping and additional fees, and financial reconciliation.

It does not copy the output-specific logic of Werkbon and does not yet define declaration layout generation or field rendering logic.

## Proposed system layers

### 1. Document ingestion

The ingestion layer accepts image or PDF documents and normalizes them into a processing-ready representation. It keeps the original document file metadata and the extracted document info in a structured form.

This layer is responsible for handling the file type and preserving the source document as a first-class record.

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

### 4. Declaration assembly

Multiple source documents may be combined into a declaration for a monthly reimbursement submission. Declaration assembly uses the normalized financial model and the declarant profile, while preserving the identity and dates of each individual source document.

The declaration reference is deterministic and remains reusable across multiple source documents when appropriate.

### 5. Presentation and export

A clean Google Sheets template is copied and populated rather than generating the declaration layout from scratch. The output sheet is intended to serve as the presentation layer for review and downstream PDF export.

Final PDF export is a downstream step after the sheet has been populated and validated.

## Security and separation of concerns

This architecture separates declarant profile configuration from source-document extraction. The declarant profile includes PII and configuration such as name, address, postcode, city, IBAN, BSN, creditor number, and applicant code.

These values are stored in Apps Script Script Properties and are excluded from source control. They are not sent to OpenAI during extraction.

The architecture requires that:

- document parsing and extraction remain independent from declarant profile data
- declaration assembly is the point where both domains are combined
- the Apps Script project is access-restricted because Script Properties are not a dedicated secrets-management system

## Known design gaps

These items are deliberately recorded as deferred design work and not implemented in this baseline:

- specific heuristics for selecting the source document date when multiple candidate dates exist
- specific heuristics for choosing the source document ID or invoice number when multiple identifiers are present
- detailed extraction confidence scoring and fallback handling
- final tax and fee normalization rules beyond the canonical model requirement
- final output-layout generation rules for the declaration presentation sheet

## Current status

This repository contains only the architecture baseline and not the actual application implementation.
