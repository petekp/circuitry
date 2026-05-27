# Task 04 - Not-Proved Baseline

Pattern: the agent claims a regression exists, but the baseline command passes
before any fix is applied.

Expected catch: `fix.regression-proof@v1` records `not-proved` and recovery
routing stops the run from claiming success.

Why it matters: the runtime, not the agent, must observe that the bug really
exists before the fix can be trusted.
