import {
  type ChangePacketV0 as ChangePacket,
  ChangePacketV0,
  type SafeApplyReasonCode,
  type SafeApplyResultV0 as SafeApplyResult,
  SafeApplyResultV0,
} from '../../schemas/change-packet.js';
import { Ref, type Ref as RefValue } from '../../schemas/ref.js';

export type SafeApplyRejectOnlyInput = {
  readonly decisionId: string;
  readonly changePacketRef: RefValue;
  readonly packet: unknown;
  readonly actualBaseRef?: string;
  readonly treeHashMatches?: boolean;
};

export type SafeApplyRejectOnlyOutcome =
  | {
      readonly status: 'packet_invalid';
      readonly reason_codes: readonly ['packet_invalid'];
      readonly issues: readonly string[];
    }
  | {
      readonly status: 'recorded';
      readonly result: SafeApplyResult;
    };

function uniqueReasonCodes(codes: readonly SafeApplyReasonCode[]): SafeApplyReasonCode[] {
  return [...new Set(codes)];
}

function generatedSurfaceStatus(packet: ChangePacket): {
  readonly status: 'pass' | 'fail' | 'not_required';
  readonly reason?: SafeApplyReasonCode;
  readonly drift_check_ref?: RefValue;
} {
  if (packet.generated_surfaces.status === 'not_touched') {
    return { status: 'not_required' };
  }
  if (packet.generated_surfaces.status === 'synced') {
    const driftCheckRef = packet.generated_surfaces.drift_check_ref;
    if (driftCheckRef === undefined) {
      return { status: 'fail', reason: 'generated_surface_drift' };
    }
    return { status: 'pass', drift_check_ref: driftCheckRef };
  }
  return { status: 'fail', reason: 'generated_surface_drift' };
}

function protectedFileStatus(packet: ChangePacket): {
  readonly status: 'pass' | 'fail' | 'checkpoint_required';
  readonly reason?: SafeApplyReasonCode;
} {
  if (packet.protected_files.files.length === 0) {
    return { status: 'pass' };
  }
  if (packet.protected_files.decision === 'checkpointed') {
    return { status: 'checkpoint_required', reason: 'protected_file_touched' };
  }
  if (packet.protected_files.decision === 'rejected') {
    return { status: 'fail', reason: 'protected_file_touched' };
  }
  return { status: 'pass' };
}

export function evaluateSafeApplyRejectOnly(
  input: SafeApplyRejectOnlyInput,
): SafeApplyRejectOnlyOutcome {
  const changePacketRef = Ref.parse(input.changePacketRef);
  const packetResult = ChangePacketV0.safeParse(input.packet);
  if (!packetResult.success) {
    return {
      status: 'packet_invalid',
      reason_codes: ['packet_invalid'],
      issues: packetResult.error.issues.map((issue) => issue.message),
    };
  }

  const packet = packetResult.data;
  const actualBaseRef = input.actualBaseRef ?? packet.base.ref;
  const treeHashMatches = input.treeHashMatches ?? true;
  const reasonCodes: SafeApplyReasonCode[] = [];

  const baseCheckStatus = actualBaseRef === packet.base.ref && treeHashMatches ? 'pass' : 'fail';
  if (baseCheckStatus === 'fail') reasonCodes.push('base_mismatch');

  const dirtyParentStatus = packet.base.dirty_parent.state === 'dirty_rejected' ? 'fail' : 'pass';
  if (dirtyParentStatus === 'fail') reasonCodes.push('dirty_parent');

  const patchStatus = packet.patch.applies_to_base ? 'pass' : 'fail';
  if (patchStatus === 'fail') reasonCodes.push('apply_conflict');

  const touchedFileStatus = packet.touched_files.worker_claim_matches_runtime ? 'pass' : 'fail';
  if (touchedFileStatus === 'fail') reasonCodes.push('touched_files_mismatch');

  const generatedSurface = generatedSurfaceStatus(packet);
  if (generatedSurface.reason !== undefined) reasonCodes.push(generatedSurface.reason);

  const protectedFile = protectedFileStatus(packet);
  if (protectedFile.reason !== undefined) reasonCodes.push(protectedFile.reason);

  const rejected = reasonCodes.length > 0;
  const result = SafeApplyResultV0.parse({
    schema_version: 1,
    kind: 'safe_apply.result',
    decision_id: input.decisionId,
    change_packet_ref: changePacketRef,
    action: rejected ? 'rejected' : 'accepted_for_review',
    outcome: 'fail',
    reason_codes: rejected ? uniqueReasonCodes(reasonCodes) : ['review_required'],
    base_check: {
      status: baseCheckStatus,
      expected_ref: packet.base.ref,
      actual_ref: actualBaseRef,
      tree_hash_match: treeHashMatches,
    },
    dirty_parent_check: {
      status: dirtyParentStatus,
      policy_ref: packet.base.dirty_parent.policy_ref,
      refs: [
        packet.base.status_ref,
        ...(packet.base.dirty_parent.baseline_snapshot_ref === undefined
          ? []
          : [packet.base.dirty_parent.baseline_snapshot_ref]),
      ],
    },
    patch_check: {
      status: patchStatus,
      conflict_files: [],
      partial_mutation: 'none',
    },
    touched_file_check: {
      status: touchedFileStatus,
      runtime_ref: packet.touched_files.runtime_ref,
      ...(packet.touched_files.worker_claim_ref === undefined
        ? {}
        : { worker_claim_ref: packet.touched_files.worker_claim_ref }),
    },
    proof_check: {
      status: 'pass',
      proof_assessment_refs: packet.proof_assessment_refs,
    },
    protected_file_check: {
      status: protectedFile.status,
      files: packet.protected_files.files,
      ...(packet.protected_files.checkpoint_ref === undefined
        ? {}
        : { checkpoint_ref: packet.protected_files.checkpoint_ref }),
    },
    generated_surface_check: {
      status: generatedSurface.status,
      ...(generatedSurface.drift_check_ref === undefined
        ? {}
        : { drift_check_ref: generatedSurface.drift_check_ref }),
    },
    final_verification: {
      status: 'not_run',
    },
  });

  return {
    status: 'recorded',
    result,
  };
}
