# ADR 0001: Single-declarant deployment

Status: Accepted

## Context

The project is a Google Apps Script tool for reimbursement declarations. The declaration process necessarily involves declarant PII and configuration values, including name, address, postcode, city, IBAN, BSN, creditor number, and applicant code. These data elements are sensitive and must not be committed to Git.

The product must also support a workflow that mixes source-document extraction with a declarant profile. The repository is starting from a clean architecture baseline and must keep the initial scope defensible and operationally simple.

## Decision

The initial v1 implementation will be a single-declarant deployment model: one Google Apps Script project serves one declarant profile.

The full `DeclarantProfile` is the authoritative deployment configuration and is stored in Apps Script Script Properties rather than in source control. It contains the fields required by the declaration, including creditor number when known, creditor/person name, address, postcode and city, IBAN, BSN or KvK, and the surname/applicant information required to derive the accounting reference. This list establishes the architectural concept without freezing a final implementation schema.

One deployment has one `DeclarantProfile`. Another declarant uses a separately configured/deployed instance; v1 is not a shared multi-user or multi-tenant profile store. Every project owner and editor is therefore inside the trusted profile-access boundary and project ownership/editorship must be tightly restricted.

Script Properties separate real profile values from source code and version control and reduce accidental exposure. They are not encryption, a dedicated secrets vault, protection from authorized project code, or protection from trusted project editors. Application-level encryption, Secret Manager, split-key storage, and multi-tenant secret storage are outside the v1 baseline. A stronger secret-management boundary must be reconsidered if project editors can no longer all be trusted with the profile, if privileged runtime access must be separated from code editing, or if governance requirements demand separate key/IAM controls.

The profile is normally materialized only at declaration assembly/rendering, after declaration membership has been confirmed. Downstream code receives only the minimum derived or rendering view it needs. A non-sensitive technical `profileId` may be used where an explicit reference is required, but it is not duplicated on every record by default.

The configured profile must not be copied into `EvidenceRecord`, `RawDocumentExtraction`, `CanonicalFinancialDocument`, the financial-document registry, declaration associations, or `ExpectedEvidenceManifest`, and it must not be supplied to the extraction provider. Source evidence may independently contain PII; that separate provider-processing risk is governed by the security policy.

## Consequences

- Simplifies configuration and reduces deployment risk in v1.
- Keeps declarant PII out of Git and source-controlled artifacts.
- Requires strict access control to the Apps Script project because Script Properties are not a dedicated secrets-management system.
- Requires real profile values to remain out of tests, normal logs, diagnostics, extraction/model requests, and unnecessary intermediate records.
- Requires restricted Drive locations and explicit lifecycle/cleanup for temporary and final PII-bearing artifacts.
- Limits the first version to one declarant per deployment and avoids multi-profile complexity that would require broader identity and access controls.
- Keeps the system architecture aligned with a narrow, auditable reimbursement workflow.
