# ADR 0001: Single-declarant deployment

Status: Accepted

## Context

The project is a Google Apps Script tool for reimbursement declarations. The declaration process necessarily involves declarant PII and configuration values, including name, address, postcode, city, IBAN, BSN, creditor number, and applicant code. These data elements are sensitive and must not be committed to Git.

The product must also support a workflow that mixes source-document extraction with a declarant profile. The repository is starting from a clean architecture baseline and must keep the initial scope defensible and operationally simple.

## Decision

The initial v1 implementation will be a single-declarant deployment model: one Google Apps Script project serves one declarant profile.

The declarant profile is stored in Apps Script Script Properties rather than in source control. Declaration generation, extraction, presentation, and export are all scoped to that single profile.

## Consequences

- Simplifies configuration and reduces deployment risk in v1.
- Keeps declarant PII out of Git and source-controlled artifacts.
- Requires strict access control to the Apps Script project because Script Properties are not a dedicated secrets-management system.
- Limits the first version to one declarant per deployment and avoids multi-profile complexity that would require broader identity and access controls.
- Keeps the system architecture aligned with a narrow, auditable reimbursement workflow.
