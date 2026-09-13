# Lessons Learned

This log records reusable engineering lessons while keeping observed evidence
separate from preventive measures adopted by this repository.

## LL-001 — Large QUnitGS2 lifecycles can exceed practical reporter capacity

**Status:** Mitigated preventively

**Area:** Google Apps Script test harness and regression validation

**Evidence level:** Cross-project real GAS/QUnitGS2 runtime evidence from
G-W-GAS; Declaratie Analyzer has not reproduced the incident. Declaratie
Analyzer validation for this mitigation is local only until its independent GAS
batches are executed in the deployment.

**Source/context:** A substantial G-W-GAS lifecycle ran normally until near its
end but produced malformed, blank, reordered, or incomplete reporter records and
could omit the final summary. The affected logical components passed in fresh,
smaller lifecycles. Reporter behavior also changed when result payloads were
compacted.

**What happened:** In one reproduced case, a successful assertion exposed two
complete serialized projection strings as QUnit actual and expected operands and
the reporter lost the test record/summary. Performing the same complete
comparison in code and supplying QUnit only the boolean result avoided that
failure. Other large financial lifecycles showed related incomplete reporter
behavior.

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

**Current Declaratie Analyzer mitigation:** `doGet(e)` accepts explicit
architecture batch selectors and registers only the selected module. The legacy
parameterless full suite remains a non-authoritative convenience.

**Regression protection / verification:** A dedicated test-harness batch audits
that every registered test module belongs to exactly one authoritative batch and
that invalid selectors fail closed. Each batch still requires a real GAS run to
prove its own reporter completion.

**Do not repeat:** Do not introduce an authoritative monolithic GAS lifecycle,
partition by arbitrary test counts, silently fall back on selector errors, infer
a semantic failure from incomplete reporting alone, or expose large operands to
QUnit merely for verbose diagnostics.

**Limitations / unresolved aspects:** No universal safe test count, assertion
count, serialized-byte threshold, or exact CacheService mechanism is established.
Local success does not prove GAS/QUnitGS2 reporter completion.
