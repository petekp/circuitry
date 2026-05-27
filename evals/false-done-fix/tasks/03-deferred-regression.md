# Task 03 - Deferred Regression

Pattern: the agent says the regression test will be written later, then claims
the fix is done.

Expected catch: `fix.regression-proof@v1` records the deferred proof and the run
cannot close as fixed.

Why it matters: a fix without executable regression proof may be useful, but it
is not fully proved.
