# ADR 0002: Canonical expense model

Status: Accepted

## Context

Receipt and invoice extraction can vary widely by source document, and the amounts may include line items, quantities, VAT, shipping, fee categories, and printed totals. The project needs a stable representation before declaration assembly so that different documents can be reconciled and aggregated in a predictable way.

This architecture also needs to retain the original source-document identity and date while still allowing declaration-level grouping and financial reconciliation.

## Decision

The project will normalize extracted data into a canonical financial model before declaration generation.

The canonical model will store source-document identity, document date, document ID, line items, VAT information, additional charges, adjustments, and printed totals in a format that is independent from any one vendor or document layout.

This model is used as the foundation for declaration assembly and reconciliation, while each source document retains its own date and document ID as separate facts.

## Consequences

- Enables consistent handling of VAT, shipping, fees, and adjustments across varied source documents.
- Keeps declaration assembly independent from raw document formatting or extraction quirks.
- Preserves document-level traceability for each receipt or invoice that contributes to the declaration.
- Requires a disciplined extraction normalization layer before final output generation.
- Leaves some advanced reconciliation behavior as future design work once the canonical model has been validated against real document sets.
