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

### Representation Boundary

The architecture separates three representations:

1. Source Evidence preserves the printed/raw value from the source document.
2. Canonical Value is the normalized, calculation-safe business value.
3. Presentation Value is produced by a downstream adapter for display.

For money, a printed value such as `€ 17,29` is preserved as Source Evidence and represented canonically as `1729` integer minor units for EUR. All canonical monetary arithmetic and financial reconciliation use integer minor units, not formatted currency strings or floating-point arithmetic.

Unless a value is explicitly identified as raw Source Evidence, monetary fields in this contract, including fields named `printedAmount`, `printedUnitAmount`, or `printedLineAmount`, contain integer minor units. "Printed" identifies the value's source, not its presentation format.

For presentation, a future Google Sheets adapter may convert `1729` minor units to the numeric spreadsheet value `17.29` and allow the template to display it as `€ 17,29`. Spreadsheet currency and locale formatting are presentation concerns and do not define the canonical financial model. Where spreadsheet formulas or numeric calculations are required, the adapter provides numeric values rather than preformatted currency strings.

### Identity Boundary

- documentDate: the relevant document date when authoritatively resolved, represented as a date-only canonical value in `YYYY-MM-DD` form. This value may be unresolved.
- sourceDocumentId: the authoritative source-document identifier when resolved. This value may be unresolved.
- Authoritative selection rules for documentDate and sourceDocumentId remain deferred. No heuristics are defined at this layer.

`documentDate` is a business date, not an artificial midnight timestamp. Normalization must not introduce a time or timezone-derived date change. A processing value such as `processedAt` is a timestamp and remains separate from source-document identity. For example, the Source Evidence `10 augustus 2026` may normalize to the canonical date `2026-08-10` and later be presented as `10/08/2026`. Google Sheets date formatting remains a presentation concern.

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

### Financial Adjustments

An observed negative financial adjustment is preserved as a signed printed amount. It is not silently discarded and must never be transformed into a positive expense.

An adjustment contains at least:

- description;
- printedAmount: the signed printed amount, represented canonically in integer minor units;
- adjustmentType; and
- traceability to its Source Evidence where normalization occurs.

The v1 adjustment types are:

- `COMMERCIAL_DISCOUNT`: a seller-provided commercial reduction, such as a promotion, seasonal discount, holiday discount, or sale discount, when that meaning is supported by Source Evidence.
- `PERSONAL_BENEFIT`: a reduction arising from a personal accumulated benefit or credit, such as redeemed loyalty points, bonus points, or personal store credit, when that meaning is supported by Source Evidence.
- `OTHER_ADJUSTMENT`: a clearly observed signed financial adjustment whose known meaning does not belong to another accepted category.
- `UNRESOLVED`: an observed adjustment for which Source Evidence is insufficient to assign another accepted type reliably.

Adjustment classification is evidence-based. This contract defines no vendor-specific rules, keyword tables, confidence thresholds, or broader adjustment taxonomy.

### VAT Evidence

VAT information represents values extracted from printed source-document evidence. No allocation of VAT across line items or cost categories is performed.

### Printed Totals

- exclVAT
- vatAmount
- inclVAT

These reflect printed totals from the source document.

### Reconciliation

- status: `MATCHED`, `MISMATCH`, or `NOT_CHECKABLE`.
- difference: the difference in integer minor units when a deterministic comparison is performed; it is unavailable for `NOT_CHECKABLE`.

The statuses mean:

- `MATCHED`: sufficient usable printed financial evidence exists for a deterministic comparison, and the reconstructed arithmetic exactly equals the applicable printed comparison total in integer minor units.
- `MISMATCH`: sufficient usable printed financial evidence exists for a deterministic comparison, but the reconstructed arithmetic differs from the applicable printed comparison total.
- `NOT_CHECKABLE`: the source document does not provide sufficient usable printed evidence for a deterministic comparison.

Missing printed totals do not produce `MATCHED`. Reconciliation uses printed financial values and must not rewrite extracted evidence to force a match. It is performed in integer minor units by deterministic code, not by the extraction step or an OpenAI/model judgment. No arbitrary reconciliation tolerance is applied.

Where Source Evidence supports it, reconciliation may use an appropriate printed excl.-VAT or incl.-VAT comparison basis. Signed adjustments participate in reconstructed source-document arithmetic when the printed evidence establishes that they are part of that arithmetic. Exact reconciliation equations and basis-selection rules that are not established by this contract remain deferred rather than inferred.

Reconciliation determines whether the arithmetic printed on the source document has been reconstructed correctly. It does not decide reimbursement eligibility or the amount that a future declaration policy should reimburse. A document can therefore reconcile successfully after a `PERSONAL_BENEFIT` reduction without establishing whether reimbursement should use the reduced amount, the pre-reduction amount, or another amount.

Reconciliation outcomes and discrepancies remain visible to downstream logic. VAT is not redistributed across expense lines or cost categories during reconciliation.

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
