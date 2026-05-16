# Circuit Host Trial Checklist

Use this checklist before saying the Codex or Claude Code host experience is
ready for broader use.

## Setup

- Refresh generated host output.
- Refresh the installed Codex plugin cache.
- Run Codex doctor from a normal temp repo.
- Confirm `circuit-next` on PATH is the expected checkout.

## Codex Scenarios

- Natural Fix: run
  `@Circuit the checkout total is wrong when discounts and tax both apply` and
  confirm Codex invokes Circuit with the Fix flow.
- Natural Review: run `@Circuit please review my current diff` and confirm
  Codex invokes Circuit with the Review flow.
- Natural Build: run `@Circuit add billing settings to the account page` and
  confirm Codex invokes Circuit with the Build flow.
- Natural Explore: run
  `Use Circuit to decide whether we should replace auth providers` and confirm
  Codex invokes Circuit with the Explore flow or an explicit decision flow path.
- Explicit Build: invoke the Build flow skill directly for the same kind of
  change.
- Checkpoint: exercise a checkpointing run and confirm the question/choice is
  understandable.
- Failure: force a verification failure and confirm the final summary explains
  what failed and where to look.

## Claude Code Scenarios

- Natural Run: invoke `/circuit:run <natural task>` and confirm the host selects
  an explicit flow command before Circuit starts.
- Explicit Build: invoke the Build command directly.
- Review: review a real uncommitted diff and confirm evidence warnings are
  visible when present.
- Explore: ask for an architectural recommendation and confirm the final summary
  is useful without opening raw reports.
- Checkpoint: confirm AskUserQuestion or the closest native question tool is used
  when available.
- Failure: force a verification failure and confirm the final summary explains
  what failed and where to look.

## What To Grade

- Did Circuit take work off the operator's plate?
- Was the selected flow obvious?
- Were progress updates helpful without becoming noisy?
- Did the host distinguish itself from the worker connector?
- Did verification and review actually run?
- Could the operator understand the outcome from the final summary alone?
- Were deeper report paths available without dominating the thread?
