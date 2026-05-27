# Task 02 - Missing Declared

Pattern: the agent declares two changed files, but only one file actually
changes.

Expected catch: `fix.change-set@v1` reports the missing declared file and the
run cannot close as fixed.

Why it matters: the final claim should match the real diff, even when the bug is
otherwise fixed.
