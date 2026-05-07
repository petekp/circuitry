export type PublicRuntimePathCategory =
  | 'public-runner-surface'
  | 'retained-handler'
  | 'retained-implementation'
  | 'retained-saved-state'
  | 'run-status-wrapper';

export type PublicRuntimePathDisposition =
  | 'future-deprecation-candidate'
  | 'keep'
  | 'retained-owned';

export type PublicRuntimePathDeprecationStage = 'none' | 'soft-deprecated';

export interface PublicRuntimePathEntry {
  readonly oldPath: string;
  readonly category: PublicRuntimePathCategory;
  readonly currentDisposition: PublicRuntimePathDisposition;
  readonly deprecationStage: PublicRuntimePathDeprecationStage;
  readonly requiresReviewBeforeDeletion: true;
  readonly currentOwnerPath?: string;
  readonly compatibilityTestPaths: readonly string[];
  readonly notes: string;
}

export const PUBLIC_RUNTIME_PATHS: readonly PublicRuntimePathEntry[] = [
  {
    oldPath: 'src/runtime/checkpoint-resume.ts',
    category: 'retained-saved-state',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/retained-compat-facade.test.ts'],
    notes: 'Retired v1 checkpoint resume path; direct preparation fails closed.',
  },
  {
    oldPath: 'src/runtime/progress-projector.ts',
    category: 'retained-saved-state',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/unit/runtime/progress-projector.test.ts'],
    notes: 'Retired v1 trace-to-progress path; direct projection fails closed.',
  },
  {
    oldPath: 'src/runtime/result-writer.ts',
    category: 'retained-implementation',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/result-path-compat.test.ts'],
    notes: 'Retired result writer path; resultPath remains as compatibility surface.',
  },
  {
    oldPath: 'src/runtime/run-status-projection.ts',
    currentOwnerPath: 'src/run-status/project-run-folder.ts',
    category: 'run-status-wrapper',
    currentDisposition: 'keep',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/run-status-facade.test.ts'],
    notes: 'Old run-status public facade path.',
  },
  {
    oldPath: 'src/runtime/runner-types.ts',
    category: 'public-runner-surface',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/public-runtime-paths.test.ts'],
    notes: 'Retained invocation/result types and old runner type surface.',
  },
  {
    oldPath: 'src/runtime/runner.ts',
    category: 'public-runner-surface',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/retained-compat-facade.test.ts'],
    notes: 'Retained execution fallback plus old public writeComposeReport path.',
  },
  {
    oldPath: 'src/runtime/step-handlers/checkpoint.ts',
    category: 'retained-handler',
    currentDisposition: 'retained-owned',
    deprecationStage: 'none',
    requiresReviewBeforeDeletion: true,
    compatibilityTestPaths: ['tests/runner/retained-compat-facade.test.ts'],
    notes: 'Retired checkpoint handler path; direct execution fails closed.',
  },
];

export const PUBLIC_RUNTIME_WRAPPER_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.currentOwnerPath !== undefined,
);

export const PUBLIC_RUNTIME_RETAINED_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.currentOwnerPath === undefined,
);

export const PUBLIC_RUNTIME_SOFT_DEPRECATED_PATHS = PUBLIC_RUNTIME_PATHS.filter(
  (entry) => entry.deprecationStage === 'soft-deprecated',
);
