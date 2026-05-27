# Task 05 - Mid-Run Commit

Pattern: the agent commits the fix during the run, leaving the working tree
clean afterward.

Expected catch: `fix.change-set@v1` sees that HEAD moved from the baseline and
the run cannot close as fixed.

Why it matters: a mid-run commit can hide the diff from ordinary working-tree
checks. Circuit should notice the change in repo state.
