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

### Raw Document Extraction Boundary

`RawDocumentExtraction` is the Source Evidence representation between provider-specific extraction and later normalization, Identity Resolution, and reconciliation. Image and PDF transports may use different provider envelopes, but both must produce this same semantic representation. Transport-specific response fields are not part of this contract.

The completed representation contains trusted local provenance and model-authored observations:

```text
RawDocumentExtraction {
  sourceProvenance: {
    sourceFileName: string,
    mimeType: string
  },
  documentTypeEvidence?: RawObservation,
  identityEvidence: {
    dates: RawObservation[],
    identifiers: RawObservation[]
  },
  financialEvidence: {
    items: RawExpenseObservation[],
    additionalCosts: RawAdditionalCostObservation[],
    adjustments: RawAdjustmentObservation[],
    vat: RawVatObservation[],
    totals: RawTotalObservation[]
  }
}

RawObservation {
  rawValue: string,
  printedLabel?: string,
  context?: string
}

RawExpenseObservation {
  description: RawObservation,
  quantity?: RawObservation,
  printedUnitAmount?: RawObservation,
  printedLineAmount?: RawObservation
}

RawAdditionalCostObservation {
  description?: RawObservation,
  quantity?: RawObservation,
  printedUnitAmount?: RawObservation,
  printedLineAmount?: RawObservation
}

RawAdjustmentObservation {
  description?: RawObservation,
  printedAmount: RawObservation
}

RawVatObservation {
  printedRate?: RawObservation,
  printedAmount?: RawObservation
}

RawTotalObservation {
  printedAmount: RawObservation
}
```

`sourceFileName` and `mimeType` are copied from the locally validated Encoded Source File. They are not model-authored fields, and the model is not trusted to reproduce or establish them. A filename is provenance only; its contents do not become source-document identity through this contract.

The provider/model output consists only of `documentTypeEvidence`, `identityEvidence`, and `financialEvidence`. Structural validation applies to that model-authored portion before local code attaches `sourceProvenance` to form the completed `RawDocumentExtraction`. Model output that attempts to supply provenance or canonical fields is unexpected and fails structural validation.

The two evidence objects and their named collections are required, but every collection may be empty. `documentTypeEvidence` and fields marked with `?` may be omitted; omission, rather than `null`, represents an observation that was not reported. An emitted item requires a description. An emitted additional cost requires at least one printed amount. An emitted adjustment requires its signed printed amount. An emitted VAT observation requires at least a printed rate or printed amount. An emitted total requires its printed amount.

Every emitted `RawObservation` requires a non-empty `rawValue`. `printedLabel` and `context` are included only when observed or needed to preserve the printed meaning. They qualify the specific `RawObservation` in which they occur and are not duplicated on enclosing composite observations; they remain non-authoritative Source Evidence and do not establish VAT, total, or additional-cost classification. Raw monetary and date values retain their source representation at this boundary. Deterministic parsing may later produce integer-minor-unit values or normalized date candidates, but those are not fields of `RawDocumentExtraction`. A normalized date candidate is not an authoritative `documentDate`.

The `vat` collection may contain both line-level and document-level observations. The `totals` collection preserves printed subtotals and totals without assigning them a canonical role. Collections preserve repeated and competing observations in extraction order. Structural validation does not deduplicate, merge, select, or otherwise collapse them into canonical singleton values.

#### Structural Validation and Failure Semantics

Post-model structural validation establishes only that the extraction result conforms to the raw representation. It may validate:

- that the model output is parseable JSON with the expected top-level object;
- that required evidence objects and collections have the declared types;
- that emitted observations use the declared object shapes;
- that required raw values are non-empty strings; and
- that only fields declared by this raw contract are present.

Malformed top-level output fails the complete extraction explicitly. A malformed emitted observation also fails the complete extraction; it is not silently dropped or repaired. Optional observations may be absent and collections may be empty, but an object that is present must satisfy its complete declared shape. Unknown or unexpected fields fail structural validation so that model-authored canonical claims or an unreviewed schema extension cannot pass silently.

Structural validity means only that the reported Source Evidence is well formed. It does not mean that the evidence is complete, financially consistent, sufficient for normalization, or sufficient to resolve identity. Empty or incomplete-but-valid evidence remains available for later insufficiency handling; validation does not turn it into canonical success.

Structural validation does not:

- normalize money into integer minor units;
- normalize or select an authoritative date;
- select a source document ID;
- perform financial arithmetic or reconstruct missing values;
- reconcile printed totals or assign a reconciliation result;
- redistribute VAT;
- decide reimbursement eligibility, declaration grouping, or cross-document consolidation; or
- apply confidence thresholds, fallback heuristics, or silent correction.

#### Classification Authority

Raw collections report the broad kind of evidence observed, but they do not contain model-authored canonical classifications. In particular, the raw contract contains no `SHIPPING` or `FEE` enum, no adjustment-type enum, and no `EXCL_VAT`, `VAT_AMOUNT`, or `INCL_VAT` total-role enum.

Printed labels, descriptions, raw values, and context preserve the evidence needed for later classification. A clearly printed shipping label may therefore be reported as an additional-cost observation, but its placement does not by itself establish the canonical additional-cost type. Adjustment types, including `PERSONAL_BENEFIT`, are assigned only during later evidence-based normalization; weak contextual inference by the extraction model is insufficient. Total roles are likewise established later from printed evidence and are not reconstructed from arithmetic at this boundary.

The absence of raw classification enums does not change the accepted canonical categories below. It keeps their assignment outside model authority and allows ambiguous evidence to remain unresolved.

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
