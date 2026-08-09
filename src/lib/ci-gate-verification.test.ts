import { describe, it, expect } from "vitest";

/**
 * TEMPORARY — DELETE THIS FILE.
 *
 * This test fails ON PURPOSE, exactly once, to prove the CI gate is real.
 *
 * `.forgejo/workflows/ci.yml` was written, committed, and described in four
 * documents as the project's quality gate. It had never executed — not once.
 * The repository did not exist in Forgejo, so nothing was listening. A pipeline
 * that has never run is indistinguishable from a pipeline that passes, which is
 * the same failure class as a green deploy that never shipped.
 *
 * So the gate does not get to be trusted because it is green. It has to be seen
 * going RED for a real defect first, and then green when the defect is removed.
 * That is the whole point of this file: if CI reports success while this file is
 * present, the gate is decorative and the next commit to break the shop will
 * sail through exactly the same way.
 *
 * The failure is deliberately in `npm test` rather than a type error, because
 * the unit-test step is the gate most likely to catch a real regression here,
 * and because the failure message should be unmistakably intentional to anyone
 * who finds this run in the history later.
 */
describe("CI gate verification (temporary)", () => {
  it("FAILS ON PURPOSE so we can watch the pipeline turn red", () => {
    // If you are reading this in a CI log: nothing is broken. This assertion
    // exists to prove the log you are reading is actually produced.
    expect(
      "the Forgejo CI gate is decorative until it is seen failing"
    ).toBe("proven to fail before it is trusted to pass");
  });
});
