# ADR 0003: Google Sheets template-based presentation

Status: Accepted

## Context

The declaration process requires a presentation format for final review and downstream export. The project must produce a reimbursement declaration from normalized document data while maintaining a controlled and auditable workflow. A sheet-based output is the natural fit for a Google Apps Script implementation because it allows review, editing, and final PDF export in a familiar environment.

## Decision

The project will use a Google Sheets template as the presentation layer. A clean template will be copied, then populated with declaration data rather than generating the declaration layout from scratch.

The final PDF export is treated as a downstream step after the populated sheet is assembled and reviewed.

## Consequences

- Keeps the declaration presentation aligned to a known spreadsheet layout and template control.
- Reduces risk of layout drift by avoiding custom sheet construction for each declaration.
- Allows declarant review before final export.
- Keeps the architecture clear: extraction and normalization are separate from the presentation layer.
- Requires template management and version control for the underlying Sheet structure.
