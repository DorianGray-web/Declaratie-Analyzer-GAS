# Security

Status: early development / architecture phase.

## Core security posture

This project is a Google Apps Script application for reimbursement declarations. It handles receipts, invoices, and declarant data that may include personally identifiable information (PII).

PII and declarant configuration must not be committed to Git. Values such as name, address, postcode, city, IBAN, BSN, creditor number, and applicant code are stored in Apps Script Script Properties instead.

## Data separation

The system must keep source-document extraction and declarant profile data separate until declaration assembly. Receipt or invoice extraction is treated as document-content processing, while declarant profile data is handled as deployment-level configuration.

Declarant-profile values must never be sent to OpenAI for receipt or invoice extraction. The extraction stage should operate only on source-document content and processing metadata required for extraction, not on declarant identity or financial account data.
## Access control

Apps Script Script Properties reduce the risk that PII is exposed through source control, but they are not a dedicated secrets-management system. Access to the Apps Script project must therefore be restricted to a limited set of authorized users and administrators.

The project should be organized so that only the minimum necessary users can edit code, manage Script Properties, and access the declaration output process.

## Operational guidance

- Do not store declared-profile data in repository files, environment variables committed to Git, or logs.
- Do not include applicant or financial profile data when exporting sample or test data.
- Treat the Apps Script project as a restricted application environment rather than a public or broadly accessible automation service.
- Keep document extraction and declarant configuration segregated in both implementation and operational controls.

## Current status

This repository does not yet implement the application, and the security model described here is the baseline policy for the architecture phase.
