import type {
  RuntimeAppendRequest,
  RuntimeEventLedgerAppender,
  RuntimeEventLedgerReader,
  RuntimeLedgerSnapshot,
  RuntimePortResult,
} from "./ports.js";
import type {
  LedgerAppendReceipt,
  RuntimeEvent,
  RuntimeFailure,
  RuntimeMessage,
  RuntimeRevision,
  RuntimeRunRef,
  RunRootPath,
} from "./types.js";

export interface InMemoryRuntimeLedgerSeed {
  readonly ref: RuntimeRunRef;
  readonly events?: readonly RuntimeEvent[];
}

export type InMemoryRuntimeLedgerStore =
  RuntimeEventLedgerReader & RuntimeEventLedgerAppender;

function ledgerKey(ref: RuntimeRunRef): RunRootPath {
  return ref.runRoot;
}

function revisionFor(events: readonly RuntimeEvent[]): RuntimeRevision {
  return events.length as RuntimeRevision;
}

function snapshotFor(
  ref: RuntimeRunRef,
  events: readonly RuntimeEvent[],
): RuntimeLedgerSnapshot {
  return {
    ref,
    revision: revisionFor(events),
    events: [...events],
  };
}

function expectedRevisionMismatch(
  request: RuntimeAppendRequest,
  actualRevision: RuntimeRevision,
): RuntimeFailure<"expected_revision_mismatch"> {
  return {
    kind: "expected_revision_mismatch",
    message: "runtime ledger revision changed before append" as RuntimeMessage,
    retryable: true,
    diagnostics: {
      source: "store",
      details: {
        runRoot: request.ref.runRoot,
        commitClass: request.commitClass,
        expectedRevision: request.expectedRevision,
        actualRevision,
        eventCount: request.events.length,
      },
    },
  };
}

export function createInMemoryRuntimeLedgerStore(
  seeds: readonly InMemoryRuntimeLedgerSeed[] = [],
): InMemoryRuntimeLedgerStore {
  const ledgers = new Map<RunRootPath, readonly RuntimeEvent[]>();

  for (const seed of seeds) {
    ledgers.set(ledgerKey(seed.ref), [...(seed.events ?? [])]);
  }

  return {
    readEvents(ref) {
      return {
        ok: true,
        value: snapshotFor(ref, ledgers.get(ledgerKey(ref)) ?? []),
      };
    },
    appendEvents(
      request,
    ): RuntimePortResult<
      LedgerAppendReceipt,
      RuntimeFailure<"expected_revision_mismatch">
    > {
      const key = ledgerKey(request.ref);
      const currentEvents = ledgers.get(key) ?? [];
      const actualRevision = revisionFor(currentEvents);

      if (actualRevision !== request.expectedRevision) {
        return {
          ok: false,
          failure: expectedRevisionMismatch(request, actualRevision),
        };
      }

      const appendedEvents = [...request.events];
      const nextEvents = [...currentEvents, ...appendedEvents];
      ledgers.set(key, nextEvents);

      return {
        ok: true,
        value: {
          expectedRevision: request.expectedRevision,
          finalRevision: revisionFor(nextEvents),
          appendedEvents,
        },
      };
    },
  };
}
