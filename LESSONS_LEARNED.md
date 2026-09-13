# Lessons Learned

This log records reusable engineering lessons while keeping observed evidence
separate from preventive measures adopted by this repository.

## LL-001 — Large QUnitGS2 lifecycles can exceed practical reporter capacity

**Status:** Mitigated and validated in real GAS

**Area:** Google Apps Script test harness and regression validation

**Evidence level:** Direct Declaratie Analyzer real Google Apps Script / QUnitGS2
v23 runtime evidence, supported by earlier cross-project G-W-GAS evidence.

**Source/context:** A substantial G-W-GAS lifecycle ran normally until near its
end but produced malformed, blank, reordered, or incomplete reporter records and
could omit the final summary. The affected logical components passed in fresh,
smaller lifecycles. Reporter behavior also changed when result payloads were
compacted.

### OBSERVED

- The original authoritative `FinancialDocumentRegistry` lifecycle contained 37
  tests and 229 assertions.
- In two isolated real Google Apps Script / QUnitGS2 v23 runs, tests 1–25
  rendered normally, reporter record 26 became malformed or incomplete, and the
  final summary did not render.
- The logical recognition/persistence component containing original test 26 was
  then run independently: 6 tests, 38 assertions, 0 failures, with a complete
  reporter. Original test 26 passed all 8 of its assertions.
- The permanent architecture-aligned partition was then validated in real GAS:
  `foundation` passed 11 tests / 80 assertions / 0 failures;
  `serialization` passed 7 / 40 / 0; `persistence` passed 12 / 66 / 0; and
  `read-models` passed 7 / 43 / 0.
- All original Registry tests and assertions remain represented: 37 tests and
  229 assertions in total.
- In the earlier G-W-GAS case, a successful assertion exposed two complete
  serialized projection strings as QUnit actual and expected operands and the
  reporter lost the test record/summary. Performing the same complete comparison
  in code and supplying QUnit only the boolean result avoided that failure.

### INFERENCE

- No Registry semantic failure was reproduced.
- The evidence supports QUnitGS2 lifecycle/result-reporting pressure in the
  combined Registry lifecycle.
- The evidence does not establish a specific CacheService implementation
  mechanism or a universal byte, test-count, or assertion-count threshold.
- Neither 25 tests nor 155 of 229 assertions is a demonstrated platform limit.

### MITIGATION

- Partition large real-GAS QUnit lifecycles only at natural architectural
  component boundaries while preserving every semantic test and assertion.
- If a malformed boundary appears, rerun the affected logical component in a
  fresh lifecycle before classifying it as a semantic failure.
- Do not mechanically slice lifecycles by counts or introduce magic thresholds.

**Incorrect assumption / failure pattern:** Treating one large GAS lifecycle as
the sole authoritative regression gate, or treating an incomplete reporter
record as immediate proof of a semantic test failure.

**Transferable evidence:** Independent architecture-aligned lifecycles isolate
logical components and reduce practical result-persistence/reporting pressure.
When one lifecycle is incomplete, the first incomplete reporter record and the
last completed record identify where diagnosis should begin.

**Resulting invariant / operational rule:** Authoritative GAS regression runs use
independent architecture-owned batches. Diagnose an incomplete run by locating
the first incomplete record, confirming preceding completion, and rerunning that
logical component in a fresh lifecycle before classifying a semantic failure.

For an assertion specifically demonstrated to expose very large complete values
to the reporter, preserve the complete comparison in code and give QUnit the
boolean result with bounded diagnostics. Do not apply this transformation to
ordinary assertions without evidence.

**Current Declaratie Analyzer mitigation:** `doGet(e)` accepts four explicit
architecture-aligned Registry batch selectors and registers only the selected
component. The legacy parameterless full suite remains a non-authoritative
convenience.

**Regression protection / verification:** A dedicated test-harness batch audits
that every registered test module belongs to exactly one authoritative batch and
that invalid selectors fail closed. All four Registry batches completed their
real-GAS reporter lifecycles with no failures.

**Do not repeat:** Do not introduce an authoritative monolithic GAS lifecycle,
partition by arbitrary test counts, silently fall back on selector errors, infer
a semantic failure from incomplete reporting alone, or expose large operands to
QUnit merely for verbose diagnostics.

**Limitations / unresolved aspects:** No universal safe test count, assertion
count, serialized-byte threshold, or exact CacheService mechanism is established.
Local success does not prove GAS/QUnitGS2 reporter completion.

## LL-002 — QUnitGS2 browser reporting requires the host-project results bridge

**Status:** Required integration contract

**Area:** Google Apps Script QUnitGS2 v23 browser/server integration

### OBSERVED

- Real QUnitGS2 requires the host project to expose the project-global
  `getResultsFromServer()` bridge used by the browser reporter.
- Without that bridge, server-side test execution may complete while the browser
  reporter cannot retrieve and render the results.
- Local QUnit-compatible tests do not exercise this deployed browser/server
  bridge.

### INFERENCE

- Passing local compatibility tests cannot prove that the real QUnitGS2 browser
  reporter can retrieve server results.

### MITIGATION

- Preserve the host-project `getResultsFromServer()` bridge and validate reporter
  completion through the deployed real-GAS web application.
