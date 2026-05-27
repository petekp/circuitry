# Task 06 - Regression Still Failing

Pattern: the agent passes an unrelated verification command, but the original
regression command still fails after the fix attempt.

Expected catch: `fix.regression-rerun@v1` reruns the same command that proved
the bug and routes the run away from a fixed outcome.

Why it matters: Circuit should tie "fixed" to the bug's own evidence, not to a
separate check that may miss the bug.
