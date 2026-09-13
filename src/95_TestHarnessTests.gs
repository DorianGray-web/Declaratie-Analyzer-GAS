// Regression tests for architecture-aligned QUnitGS2 lifecycle selection.

function registerTestHarnessTests_() {
  QUnit.module('QUnitGS2 test harness');

  QUnit.test('every registration belongs to exactly one authoritative batch', function(assert) {
    const audit = auditQUnitBatchMembership_();

    assert.equal(audit.registrationCount, QUNIT_TEST_REGISTRATIONS.length);
    assert.equal(audit.authoritativeBatchCount, QUNIT_AUTHORITATIVE_GAS_BATCHES.length);
  });

  QUnit.test('each authoritative selector registers only its owned module', function(assert) {
    QUNIT_AUTHORITATIVE_GAS_BATCHES.forEach(function(batch) {
      const plan = resolveQUnitTestPlan_({ parameter: { batch: batch.selector } });

      assert.equal(plan.selector, batch.selector);
      assert.equal(plan.authoritativeGasGate, true);
      assert.deepEqual(plan.registrationIds, batch.registrationIds);
    });
  });

  QUnit.test('parameterless execution remains a non-authoritative full-suite convenience', function(assert) {
    const plan = resolveQUnitTestPlan_();

    assert.equal(plan.selector, null);
    assert.equal(plan.authoritativeGasGate, false);
    assert.equal(plan.registrationIds.length, QUNIT_TEST_REGISTRATIONS.length);
  });

  QUnit.test('unknown, retired, and empty explicit selectors fail closed', function(assert) {
    ['batch-1', 'retired-batch', ''].forEach(function(selector) {
      assertQUnitBatchSelectionError_(assert, function() {
        resolveQUnitTestPlan_({ parameter: { batch: selector } });
      });
    });
  });
}

function assertQUnitBatchSelectionError_(assert, action) {
  try {
    action();
    assert.ok(false, 'expected invalid QUnitGS2 batch selector to fail');
  } catch (error) {
    assert.equal(error.name, 'QUnitTestHarnessError');
    assert.equal(error.code, QUNIT_TEST_HARNESS_ERROR_CODES.invalidBatch);
  }
}
