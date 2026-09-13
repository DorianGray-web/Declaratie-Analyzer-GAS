# Security

Status: early development / architecture phase.

## Trust and configuration boundary

Declaratie Analyzer is a single-declarant application: one Apps Script deployment/project serves one declarant. Its full `DeclarantProfile` is authoritative deployment configuration in Script Properties. Another declarant uses a separate configured/deployed instance, not another profile in a shared store.

All project owners and editors are inside the trusted profile-access boundary; ownership and editorship must therefore be tightly restricted. Script Properties separate real values from source code/version control and reduce accidental exposure. They are not encryption, a secrets vault, protection from authorized project code, or protection from trusted editors.

The profile is normally loaded only at declaration assembly/rendering after membership is frozen. Only minimum derived or rendering views flow downstream. It is not duplicated into source extraction, raw or canonical financial documents, evidence/registry records, declaration associations, or evidence manifests.

## Repository and tests

Tracked source, documentation, tests, examples, and fixtures must contain no real full name, address, postcode/city, BSN, IBAN, creditor number, applicant profile, unredacted declaration, or unnecessary source evidence.

Tests use synthetic data and never require actual Script Properties or real profile data. Do not copy real third-party BSNs or IBANs merely to produce format-valid fixtures.

## Extraction and provider processing

The configured `DeclarantProfile` must not be supplied to an extraction/model provider and must not enter `RawDocumentExtraction` or `CanonicalFinancialDocument`. Source evidence may independently contain PII; provider processing of that evidence is a separate privacy boundary. Before real evidence is processed, the selected provider endpoint, storage/state behavior, retention/data controls, regional and contractual requirements, and project configuration must be explicitly assessed. These requirements remain open until verified for the chosen deployment.

## PII minimization

BSN must not be committed, logged, placed in exceptions or diagnostics, used as an application ID or correlation/deduplication key, copied into evidence/canonical/registry/association/manifest records, used in filenames or ordinary fixtures, supplied to coding agents, or injected from the profile into extraction requests. It may exist only where required in the protected profile, controlled rendering scope, reviewed declaration Sheet, primary PDF, and final archival PDF.

IBAN follows equivalent minimization. It is not needed for extraction, canonical normalization, period selection, evidence identity, reconciliation, manifest completeness, or package assembly, and normally exists only in the protected profile and required declaration output.

`applicantCode` is derived/pseudonymous personal information, not anonymous technical identity. It may appear in required accounting output, but is not evidence identity, declaration identity, a logging correlation ID, or filename identity.

Original evidence and filenames may themselves contain PII and are restricted evidence content/metadata.

## Logging and diagnostics

Logging is default-deny for sensitive content. An allowlist may contain technical values such as:

- `evidenceId`;
- `declarationInstanceId`;
- `packageAttemptId`;
- processing stage and error code;
- bounded counts and lifecycle state;
- non-sensitive timing and resource metrics.

Normal logs, exceptions, and diagnostics must not contain:

- `DeclarantProfile` or property dumps;
- name/surname, address, postcode/city, BSN/KvK, IBAN, or creditor number;
- `applicantCode`;
- `operationReference` unless explicitly justified for a bounded diagnostic;
- raw source content, extracted text, blobs, or Base64;
- model prompts or responses containing real evidence.

## AI-agent boundary

Normal coding and review tasks must not require actual Script Properties, real `DeclarantProfile` values, real BSN/IBAN, unredacted declaration outputs, or unnecessary original evidence. Agents may normally inspect source code, contracts, ADRs, synthetic fixtures, sanitized diagnostics, and public-safe template evidence. Access to local real-world review evidence remains subject to the explicit authorization and minimization rules in `AGENTS.md`.

## Drive artifacts and publication

Sensitive evidence, populated Sheets, PDFs, and temporary/package candidates require dedicated restricted locations, no broad/public link sharing, known ownership, neutral technical naming where practical, and an explicit lifecycle with observable success- and failure-path cleanup. Drive trash is not equivalent to permanent erasure.

Final archive filenames contain no BSN, IBAN, surname, `applicantCode`, or unnecessary `operationReference`. Partial or invalid package candidates are never published as final and remain restricted. A cleanup failure is observable and actionable even when the validated final archive itself remains structurally valid.

Retention durations, permanent-deletion requirements, failed-artifact recovery windows, archive correction semantics, and post-archive Sheet retention remain open business/governance decisions.

## Future security trigger

Application-level encryption, Secret Manager, split-key storage, and multi-tenant secret storage are not part of the v1 baseline. Stronger secret management must be reconsidered if the trusted-editor boundary changes, privileged runtime access must be separated from code editing, or governance/audit requirements demand separate IAM or key control.
