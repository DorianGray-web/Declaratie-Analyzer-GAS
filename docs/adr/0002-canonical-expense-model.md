# ADR 0002: Canonical expense model

Status: Accepted

## Context

Receipt and invoice extraction can vary widely by source document, and the amounts may include line items, quantities, VAT, shipping, fee categories, and printed totals. The project needs a stable representation before declaration assembly so that different documents can be reconciled and aggregated in a predictable way.

This architecture also needs to retain the original source-document identity and date while still allowing declaration-level grouping and financial reconciliation.

## Decision

The project will normalize extracted data into a canonical financial model before declaration generation.

The canonical model will store source-document identity, document date, document ID, line items, VAT information, additional charges, adjustments, and printed totals in a format that is independent from any one vendor or document layout.

This model is used as the foundation for declaration assembly and reconciliation, while each source document retains its own date and document ID as separate facts.

## Minimal Canonical Financial Document Contract

This section defines the minimal canonical financial contract for a normalized source document. It establishes a stable boundary between source-document extraction/normalization and future declaration assembly.

The contract is financial-domain oriented. It is not shaped around Google Sheets rows, Werkbon materials, bonId, receipt keys, declaration references, or monthly grouping logic.

### Source Provenance

- sourceFileName: original file name of the source document.
- mimeType: MIME type of the source document.

### Identity Boundary

- documentDate: the relevant document date when authoritatively resolved. This value may be unresolved.
- sourceDocumentId: the authoritative source-document identifier when resolved. This value may be unresolved.
- Authoritative selection rules for documentDate and sourceDocumentId remain deferred. No heuristics are defined at this layer.

#### Source Document Identity Evidence

Source Document Identity Evidence is the non-authoritative set of identity-related observations extracted from a source document. It is an intermediate boundary between extraction and authoritative identity resolution; it is not part of the canonical identity merely because an extraction model reported it.

An observation may preserve:

- the observed value;
- the printed/raw value when normalization occurs;
- the printed label, when one is present;
- the semantic or document context in which the value appears; and
- the document type available to extraction.

This list defines the required evidence semantics, not a final serialization shape. Every normalized identity value must remain traceable to its printed source-document evidence.

Equivalent identity evidence can appear under different labels or through document context. For example, an invoice date may be printed as either an explicit invoice-date label or as a date within an invoice header, while a receipt identifier may appear as a bon number or ticket identifier. A printed label is therefore evidence but is not, by itself, a universal selection rule. The absence of one particular label does not establish that identity evidence is absent.

Dates and identifiers with other meanings, such as order dates, order numbers, customer numbers, due dates, cash-register or transaction data, and barcodes, may coexist with identity evidence. They must retain their observed meaning and must not silently replace the source-document identity.

The boundary is:

1. Extraction reports observed Source Document Identity Evidence.
2. Identity Resolution evaluates that evidence under an authoritative selection policy.
3. Only sufficiently resolved values populate `documentDate` and `sourceDocumentId` in the Canonical Financial Document.

Extraction, including model-based extraction, does not make the final authoritative selection. If Identity Resolution cannot distinguish identity evidence sufficiently, the corresponding canonical field remains unresolved. Universal selection heuristics, vendor-specific rules, confidence thresholds, and fallback behavior remain deferred.

### Financial Expenses

Expense lines contain:

- description
- quantity
- printedUnitAmount (when present on the source document)
- printedLineAmount

### Additional Costs

- shipping: optional description and printedAmount
- fee: optional description and printedAmount

Additional costs are classified separately from line items.

### VAT Evidence

VAT information represents values extracted from printed source-document evidence. No allocation of VAT across line items or cost categories is performed.

### Printed Totals

- exclVAT
- vatAmount
- inclVAT

These reflect printed totals from the source document.

### Reconciliation

- status: result of deterministic reconciliation (e.g. reconciled, unreconciled).
- difference: numeric difference when reconciliation is performed.

Reconciliation uses printed financial values. Printed values are preferred over any reconstructed amounts. Reconciliation is performed by deterministic code, not by the extraction step. Reconciliation outcomes and discrepancies must remain visible to downstream logic.

### Constraints

- The contract contains no declarant profile data or PII.
- Declarant data is never required by this contract and must not be sent to extraction.
- This model precedes declaration assembly. It does not include assembly, grouping, or presentation concerns.
- The model may be extended in the future, but extensions must preserve the minimal contract as the exchange format from normalization.

## Consequences

- Enables consistent handling of VAT, shipping, fees, and adjustments across varied source documents.
- Keeps declaration assembly independent from raw document formatting or extraction quirks.
- Preserves document-level traceability for each receipt or invoice that contributes to the declaration.
- Requires a disciplined extraction normalization layer before final output generation.
- Leaves some advanced reconciliation behavior as future design work once the canonical model has been validated against real document sets.
