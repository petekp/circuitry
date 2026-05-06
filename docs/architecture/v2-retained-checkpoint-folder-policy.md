# Core-v2 Retained Checkpoint Folder Policy

Date: 2026-05-05

## Decision

Retained/v1 checkpoint run folders remain resumable through the retained
runtime.

Core-v2 will not resume retained/v1 checkpoint folders in the current migration
lane. Resume dispatch follows the saved run folder:

```text
core-v2-marked run folder -> core-v2 resume
retained/v1 run folder -> retained runtime resume
```

This is a compatibility commitment, not a claim that old runtime deletion is
ready.

## Why

Checkpoint resume is durable operator state. A retained/v1 run folder may have:

- retained trace entries;
- retained derived snapshot assumptions;
- retained checkpoint request and response files;
- retained checkpoint report validation;
- retained progress and status projection expectations.

Replaying that folder through core-v2 would be a migration feature. It would
need its own design and user-facing risk decision. It should not happen as a
side effect of selector widening.

## Support Duration

Retained/v1 checkpoint folders should stay supported until one of these is
true:

1. A dedicated migration plan safely converts retained/v1 checkpoint folders to
   core-v2 folders.
2. The product explicitly retires old checkpoint folder resume after a
   deprecation window.
3. The repo has evidence that no supported user/operator surface can produce or
   depend on retained/v1 checkpoint folders anymore.

Until then, retained/v1 checkpoint resume is a live compatibility path.

## What Core-v2 Owns Now

Core-v2 owns checkpoint pause/resume for new core-v2-marked Build deep run
folders:

```text
build --mode deep -> core-v2 checkpoint wait
resume core-v2 Build deep folder -> core-v2 resume
```

The v2 path owns:

- v2 checkpoint request and response files;
- first-class v2 checkpoint trace fields;
- v2 request hash/path/choice validation;
- v2 checkpoint report resume validation;
- v2 context restoration;
- v2 waiting status projection;
- v2 post-resume continuation.

## What Retained Runtime Still Owns

Retained runtime still owns:

- retained/v1 checkpoint folder resume;
- retained checkpoint request discovery;
- retained checkpoint request path/hash validation;
- retained allowed-choice validation;
- retained checkpoint report validation;
- retained selection/config context restoration;
- retained trace reader/writer/reducer/snapshot behavior;
- retained progress projection for retained traces.

Phase 5.21 isolates these saved-folder operations behind
`src/compat/retained-checkpoint-folders.ts` without changing behavior. CLI
resume, handoff, and run-status now import retained/v1 checkpoint-folder support
from that boundary instead of the broader retained-runtime facade. The retained
implementations still live under `src/runtime/**`.

## Non-Goals

This policy does not approve:

- routing retained/v1 checkpoint folders through core-v2;
- deleting retained checkpoint resume;
- moving retained trace/reducer/snapshot/progress internals;
- changing resume dispatch to follow fresh-run selector flags;
- making old retained checkpoint folders unsupported.

## Deletion Conditions

Retained checkpoint resume files are not deletion candidates until a future
packet proves all of this:

- no supported command can create a new retained/v1 checkpoint folder, or the
  retained creator is intentionally kept;
- old retained/v1 checkpoint folders are migrated, explicitly retired, or
  intentionally unsupported with a documented recovery path;
- retained checkpoint resume tests are either migrated to v2, reclassified as
  legacy compatibility tests, or removed by product decision;
- `runs show`, progress, result, and handoff behavior for retained/v1 checkpoint
  folders are either preserved or intentionally retired;
- rollback no longer needs retained checkpoint execution, or rollback itself is
  retired.

## User Impact If Retired Later

If retained/v1 checkpoint resume is retired later, users with old waiting
folders would need a clear message and a recovery path. Possible options:

- resume before upgrading;
- rerun the flow from scratch;
- use a one-time migration command;
- keep a legacy resume command for a bounded period.

No such retirement is approved in this phase.

## Required Tests While Supported

Keep tests proving:

- retained/v1 checkpoint folders resume through retained runtime;
- strict v2 flags do not force retained/v1 folders through core-v2;
- rollback keeps Build deep on retained runtime;
- `runs show` projects retained waiting checkpoints;
- handoff continuity can bind to retained waiting runs;
- retained checkpoint request/report tamper checks still reject bad input.
